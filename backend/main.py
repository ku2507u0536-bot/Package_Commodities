from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Body, Query
from fastapi.staticfiles import StaticFiles
from services.image_processing import process_image, STATIC_DIR
from services.ocr import run_ocr
from services.regex_extraction import structure_label_data
from services.pipeline import (
    run_full_pipeline,
    adapt_regex_output_to_rule_engine_input,
    generate_inspection_id,
    PipelineError,
)
from compliance.service import parse_product_input
from compliance.engine import run_rule_engine
from compliance.database import save_compliance_report, get_report, get_client

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Statera / LegalMet Inspection Backend",
    description="OpenCV Image Preprocessing + PaddleOCR Text Extraction Backend",
    version="0.3.0",
)

# Configure CORS for local Next.js frontend (allow localhost and LAN devices)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files directory for browser image viewing
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def read_root():
    return {"message": " Backend Running"}


@app.post("/inspection/process-image")
async def process_image_endpoint(file: UploadFile = File(...)):
    """
    Accepts an uploaded image file, processes it with OpenCV
    (resizing, grayscale, Gaussian noise reduction), saves the result,
    and returns image metadata along with the static URL for viewing.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file.content_type}'. Please upload an image file (JPEG, PNG, WEBP).",
        )

    try:
        file_bytes = await file.read()
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        result = process_image(file_bytes, file.filename or "uploaded_image.jpg")
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image processing failed: {str(e)}")


@app.post("/inspection/ocr")
async def ocr_endpoint(file: UploadFile = File(...)):
    """
    Accepts an uploaded product/package image file, passes it through the
    OpenCV preprocessing pipeline, runs PaddleOCR on the processed image,
    and returns the detected text, line breakdown, confidence scores,
    and image URLs.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file.content_type}'. Please upload an image file (JPEG, PNG, WEBP).",
        )

    try:
        file_bytes = await file.read()
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        # 1. OpenCV Preprocessing
        proc_result = process_image(file_bytes, file.filename or "uploaded_image.jpg")
        processed_image_path = proc_result["processed_image"]["path"]

        # 2. PaddleOCR Text Extraction
        ocr_result = run_ocr(processed_image_path)

        return {
            "success": True,
            "text": ocr_result["text"],
            "ocr_details": ocr_result["details"],
            "total_lines_detected": ocr_result["total_lines_detected"],
            "original_image": proc_result["original_image"],
            "processed_image": {
                "filename": proc_result["processed_image"]["filename"],
                "width": proc_result["processed_image"]["width"],
                "height": proc_result["processed_image"]["height"],
                "url": proc_result["processed_image"]["url"],
            },
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR inspection failed: {str(e)}")


def _status_label(overall: str) -> str:
    return {"PASS": "Compliant", "FAIL": "Non-Compliant", "REVIEW_REQUIRED": "Needs Review"}.get(overall, overall)


def _field_status_label(status: str) -> str:
    return {"PASS": "Present", "FAIL": "Missing", "REVIEW_REQUIRED": "Needs Review"}.get(status, status)


def _report_to_legacy_shape(report_dict: dict) -> list:
    """Matches the legacy Flask /analyze-text `compliance_report` list shape
    (field/status/rule/rule_id/value) so the existing frontend adapters keep working."""
    return [
        {
            "field": f["field"],
            "status": _field_status_label(f["status"]),
            "rule": f.get("rule_ref"),
            "rule_id": None,
            "value": f.get("value"),
        }
        for f in report_dict.get("fields", [])
    ]


def _score(report_dict: dict) -> int:
    fields = report_dict.get("fields", [])
    if not fields:
        return 0
    passed = sum(1 for f in fields if f["status"] == "PASS")
    return round(passed / len(fields) * 100)


@app.post("/inspection/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    inspection_id: Optional[str] = Query(None, description="Optional custom inspection ID e.g. INS-001"),
):
    """
    REAL end-to-end pipeline for a single request:
    OpenCV -> PaddleOCR -> Regex extraction -> Rule Engine -> Supabase.
    Fails safely: never returns success/saved:true unless every stage actually succeeded.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail=f"Invalid file type '{file.content_type}'.")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        result = run_full_pipeline(file_bytes, file.filename or "uploaded_image.jpg", inspection_id=inspection_id)
    except PipelineError as pe:
        raise HTTPException(
            status_code=502 if pe.stage in ("ocr", "database") else 500,
            detail={"success": False, "saved": False, "stage": pe.stage, "error": pe.message},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail={"success": False, "saved": False, "error": str(e)})

    report = result["compliance"]
    return {
        "success": True,
        "saved": True,
        "id": result["inspection_id"],
        "inspection_id": result["inspection_id"],
        "image_name": file.filename,
        "raw_ocr_text": result["raw_ocr_text"],
        "extracted_data": result["extracted_data"],
        "compliance_report": _report_to_legacy_shape(report),
        "compliance": report,
        "score": _score(report),
        "status": _status_label(report["overall_status"]),
        "verification_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "original_image": result["original_image"],
        "processed_image": result["processed_image"],
    }


@app.post("/inspection/analyze-text")
async def analyze_text(payload: dict = Body(...)):
    """
    Legacy-contract-compatible endpoint: accepts raw OCR text (as the
    existing frontend's Stage-2/3 flow already sends), runs the same
    Regex -> Rule Engine -> Supabase path as /inspection/analyze, minus
    the image steps. Kept so the existing 7-step wizard UI needs no rewrite.
    """
    raw_text = (payload.get("raw_text") or "").strip()
    image_name = payload.get("image_name", "ocr_upload.jpg")
    if not raw_text:
        raise HTTPException(status_code=400, detail="No text provided in 'raw_text' field.")

    extracted_data = structure_label_data(raw_text)
    adapted = adapt_regex_output_to_rule_engine_input(extracted_data)

    try:
        fields = parse_product_input(adapted)
        report = run_rule_engine(fields)
    except Exception as e:
        raise HTTPException(status_code=500, detail={"success": False, "error": f"Rule engine failed: {e}"})

    try:
        scan_id = generate_inspection_id()
        product_name = extracted_data.get("product_name") or extracted_data.get("brand")
        saved_id = save_compliance_report(report=report, scan_id=scan_id, product_name=product_name)
    except Exception as e:
        raise HTTPException(status_code=502, detail={"success": False, "saved": False, "error": f"Supabase save failed: {e}"})

    report_dict = report.to_dict()
    return {
        "id": saved_id,
        "image_name": image_name,
        "extracted_data": extracted_data,
        "compliance_report": _report_to_legacy_shape(report_dict),
        "score": _score(report_dict),
        "status": _status_label(report_dict["overall_status"]),
        "verification_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/inspection/test-compliance")
def test_compliance(
    payload: dict = Body(..., description="Structured product information JSON"),
    inspection_id: Optional[str] = Query(None),
):
    """Independent Rule Engine + Supabase test endpoint (kept from SIH_project System B),
    for testing compliance logic without going through OCR at all."""
    scan_id = inspection_id or payload.get("inspection_id") or payload.get("scan_id") or generate_inspection_id()
    try:
        fields = parse_product_input(payload)
        report = run_rule_engine(fields)
        saved_id = save_compliance_report(report=report, scan_id=scan_id, product_name=fields.product_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail={"success": False, "saved": False, "error": str(e)})
    return {"success": True, "saved": True, "inspection_id": saved_id, "compliance": report.to_dict()}


@app.get("/inspection/{inspection_id}")
def get_inspection(inspection_id: str):
    try:
        data = get_report(inspection_id)
        if not data or not data.get("scan"):
            raise HTTPException(status_code=404, detail=f"Inspection '{inspection_id}' not found.")
        return {"success": True, "inspection_id": inspection_id, "report": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve report: {e}")


@app.get("/health")
def health_check():
    db_connected = False
    error_msg = None
    try:
        client = get_client()
        client.table("scans").select("scan_id").limit(1).execute()
        db_connected = True
    except Exception as e:
        error_msg = str(e)
    return {"status": "healthy" if db_connected else "degraded", "database_connected": db_connected, "database_error": error_msg}
