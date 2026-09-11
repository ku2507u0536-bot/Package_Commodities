"""
Integration glue ONLY.

Does not reimplement any existing component. Wires together, in order:

    OpenCV (services.image_processing.process_image)
    -> PaddleOCR (services.ocr.run_ocr)
    -> Regex extraction (services.regex_extraction.structure_label_data)
    -> Adapter (normalize field names -> compliance.ExtractedFields)
    -> Rule Engine (compliance.engine.run_rule_engine)
    -> Supabase (compliance.database.save_compliance_report)

Nothing here invents extracted values, overrides the Rule Engine's verdict,
or silently swallows a failed step.
"""

import logging
from typing import Any, Dict, Optional

from .image_processing import process_image
from .ocr import run_ocr, PADDLE_AVAILABLE
from .regex_extraction import structure_label_data

from compliance.service import parse_product_input
from compliance.engine import run_rule_engine
from compliance.database import save_compliance_report, get_client

logger = logging.getLogger("statera.pipeline")


class PipelineError(Exception):
    """Raised when a stage fails; carries which stage failed so the API
    layer can fail safely instead of returning a fabricated success."""

    def __init__(self, stage: str, message: str):
        self.stage = stage
        self.message = message
        super().__init__(f"[{stage}] {message}")


def generate_inspection_id() -> str:
    """
    Sequential INS-001, INS-002, ... IDs.

    No such generator existed in either source system (SIH_project's
    scan_id defaults to a random uuid4; the legacy Flask app used an
    autoincrement DB primary key formatted as INS-{id}). This counts
    existing Supabase rows to keep the human-readable INS-NNN convention
    the frontend/report already expect, without ever reusing or
    overwriting a previous inspection's row.
    """
    try:
        client = get_client()
        res = client.table("scans").select("scan_id", count="exact").execute()
        existing = res.count if res.count is not None else len(res.data or [])
    except Exception as e:
        raise PipelineError("database", f"Could not read scan count from Supabase: {e}")
    return f"INS-{existing + 1:03d}"


# Regex extractor output key -> ExtractedFields/service.parse_product_input input key.
# service.parse_product_input already accepts most regex keys as-is
# (product_name, manufacturer, address, mrp, net_quantity, consumer_care,
# country_of_origin, unit_sale_price) - only real mismatches are renamed here.
_KEY_RENAME = {
    "mfg_date": "manufacture_date",
}


def adapt_regex_output_to_rule_engine_input(extracted: Dict[str, Any]) -> Dict[str, Any]:
    """Regex Output -> Rule Engine Input adapter. Renames mismatched keys
    only; never invents or drops a value that regex actually found."""
    adapted = dict(extracted)
    for regex_key, engine_key in _KEY_RENAME.items():
        if regex_key in adapted and engine_key not in adapted:
            adapted[engine_key] = adapted.pop(regex_key)
    return adapted


def run_full_pipeline(
    file_bytes: bytes,
    filename: str,
    inspection_id: Optional[str] = None,
    rule_version: Optional[str] = None,
) -> Dict[str, Any]:
    """Image bytes in -> saved Supabase inspection result out. Fails safe:
    raises PipelineError (never a fabricated success) if any real stage fails."""

    # 1. OpenCV preprocessing
    try:
        proc_result = process_image(file_bytes, filename)
    except ValueError as ve:
        raise PipelineError("opencv", str(ve))
    except Exception as e:
        raise PipelineError("opencv", f"Unexpected OpenCV failure: {e}")

    processed_path = proc_result["processed_image"]["path"]

    # 2. PaddleOCR
    if not PADDLE_AVAILABLE:
        raise PipelineError("ocr", "PaddleOCR is not installed/available in this environment.")
    try:
        ocr_result = run_ocr(processed_path)
    except Exception as e:
        raise PipelineError("ocr", f"OCR failed: {e}")

    raw_text = ocr_result.get("text", "")
    if not raw_text.strip():
        raise PipelineError("ocr", "OCR produced no text; refusing to fabricate extracted fields.")

    # 3. Regex extraction (existing implementation, untouched)
    extracted = structure_label_data(raw_text)

    # 4. Adapter: regex output -> rule engine input
    adapted = adapt_regex_output_to_rule_engine_input(extracted)

    # 5. Rule Engine (existing implementation, untouched)
    try:
        fields = parse_product_input(adapted)
        report = run_rule_engine(fields, rule_version=rule_version) if rule_version else run_rule_engine(fields)
    except Exception as e:
        raise PipelineError("rule_engine", f"Compliance evaluation failed: {e}")

    # 6. Supabase (existing implementation, untouched)
    scan_id = inspection_id or generate_inspection_id()
    product_name = extracted.get("product_name") or extracted.get("brand")
    try:
        saved_id = save_compliance_report(report=report, scan_id=scan_id, product_name=product_name)
    except Exception as e:
        raise PipelineError("database", f"Supabase save failed: {e}")

    return {
        "success": True,
        "saved": True,
        "inspection_id": saved_id,
        "raw_ocr_text": raw_text,
        "ocr_lines_detected": ocr_result.get("total_lines_detected", 0),
        "extracted_data": extracted,
        "compliance": report.to_dict(),
        "original_image": proc_result["original_image"],
        "processed_image": {
            "filename": proc_result["processed_image"]["filename"],
            "width": proc_result["processed_image"]["width"],
            "height": proc_result["processed_image"]["height"],
            "url": proc_result["processed_image"]["url"],
        },
    }
