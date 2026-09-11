import os
import json
import tempfile

from datetime import datetime, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from werkzeug.utils import secure_filename

# ---------------------------------------------------------------------------
# Load environment variables (from .env if present, otherwise from OS env)
# ---------------------------------------------------------------------------
load_dotenv()

from models import db, Rule, Inspection, InspectionField
from ocr_module import extract_text
from llm_module import structure_label_data
from rule_engine import check_compliance, compliance_score, overall_status

# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------
app = Flask(__name__)

# Database URL — falls back to a local SQLite file when the real Postgres
# connection string hasn't been provided yet.
database_url = os.getenv("DATABASE_URL", "sqlite:///compliance.db")
# Heroku-style "postgres://" → "postgresql://" fix
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Enable CORS so the frontend (both localhost and LAN devices) can call these endpoints
CORS(app, origins="*")

# Bind SQLAlchemy to the app
db.init_app(app)

# Create tables on first run (safe no-op if they already exist)
with app.app_context():
    db.create_all()


# ===========================  ROUTES  =====================================


@app.route("/health", methods=["GET"])
def health_check():
    """Simple liveness probe."""
    return jsonify({"status": "ok"}), 200


@app.route("/analyze", methods=["POST"])
def analyze_label():
    """
    Accepts a product-label image via multipart form-data (key: ``image``).

    Pipeline:
      1. Save uploaded file to a temp path
      2. OCR → raw text
      3. LLM/regex → structured dict
      4. Rule engine → per-field compliance report
      5. Persist Inspection + InspectionFields
      6. Return JSON report
    """
    temp_path = None
    try:
        # --- validate upload ---
        if "image" not in request.files:
            return jsonify({"error": "No image file provided. Use key 'image'."}), 400

        image_file = request.files["image"]
        if image_file.filename == "":
            return jsonify({"error": "Empty filename — no file selected."}), 400

        original_name = secure_filename(image_file.filename) or "label.jpg"

        # --- save to temp file ---
        ext = os.path.splitext(original_name)[1] or ".jpg"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            image_file.save(tmp.name)
            temp_path = tmp.name

        # --- 1. OCR ---
        raw_text = extract_text(temp_path)
        if not raw_text or not raw_text.strip():
            return jsonify({"error": "No text detected, please retake photo"}), 400

        # --- 2. Structure ---
        extracted_data = structure_label_data(raw_text)

        # --- 3. Compliance check ---
        # Build a lookup from the DB rules table (field_name → rule dict)
        rules_lookup = {}
        all_rules = Rule.query.all()
        for r in all_rules:
            rules_lookup[r.field_name] = r.to_dict()

        report = check_compliance(extracted_data, rules_lookup)
        score = compliance_score(report)
        status = overall_status(score)

        # --- 4. Persist ---
        inspection = Inspection(
            product_name=extracted_data.get("product_name") or extracted_data.get("manufacturer"),
            image_name=original_name,
            raw_ocr_text=raw_text,
            raw_extracted_data=json.dumps(extracted_data),
            score=score,
            status=status,
        )
        db.session.add(inspection)
        db.session.flush()  # get inspection.id before adding children

        for item in report:
            field = InspectionField(
                inspection_id=inspection.id,
                field_name=item["field"],
                extracted_value=item["value"],
                status=item["status"],
                rule_id=item.get("rule_id"),
            )
            db.session.add(field)

        db.session.commit()

        # --- 5. Respond ---
        return jsonify({
            "id": inspection.id,
            "image_name": inspection.image_name,
            "extracted_data": extracted_data,
            "compliance_report": report,
            "score": score,
            "status": status,
            "created_at": inspection.created_at.isoformat(),
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


@app.route("/analyze-text", methods=["POST"])
def analyze_text():
    """
    Accepts raw OCR text (from the FastAPI/PaddleOCR pipeline) and runs
    the structuring + compliance pipeline on it.

    Expects JSON body:
      {
        "raw_text": "...",
        "image_name": "optional_filename.jpg"
      }

    Returns the full inspection result.
    """
    try:
        data = request.get_json(force=True)
        raw_text = data.get("raw_text", "").strip()
        image_name = data.get("image_name", "ocr_upload.jpg")

        if not raw_text:
            return jsonify({"error": "No text provided in 'raw_text' field."}), 400

        # --- 1. Structure the raw OCR text ---
        extracted_data = structure_label_data(raw_text)

        # --- 2. Compliance check ---
        rules_lookup = {}
        all_rules = Rule.query.all()
        for r in all_rules:
            rules_lookup[r.field_name] = r.to_dict()

        report = check_compliance(extracted_data, rules_lookup)
        score = compliance_score(report)
        status = overall_status(score)

        # --- 3. Persist ---
        inspection = Inspection(
            product_name=extracted_data.get("product_name") or extracted_data.get("manufacturer"),
            image_name=image_name,
            raw_ocr_text=raw_text,
            raw_extracted_data=json.dumps(extracted_data),
            score=score,
            status=status,
        )
        db.session.add(inspection)
        db.session.flush()

        for item in report:
            field = InspectionField(
                inspection_id=inspection.id,
                field_name=item["field"],
                extracted_value=item["value"],
                status=item["status"],
                rule_id=item.get("rule_id"),
            )
            db.session.add(field)

        db.session.commit()

        # --- 4. Respond ---
        return jsonify({
            "id": inspection.id,
            "image_name": inspection.image_name,
            "extracted_data": extracted_data,
            "compliance_report": report,
            "score": score,
            "status": status,
            "verification_status": inspection.verification_status,
            "created_at": inspection.created_at.isoformat(),
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/inspections/<int:inspection_id>/verify", methods=["POST"])
def verify_inspection(inspection_id):
    """
    Save the inspector's verification decision for an inspection.

    Expects JSON body:
      {
        "decision": "compliant" | "confirmed_violation" | "further_review",
        "remarks": "...",
        "inspector_name": "...",
        "inspector_id": "..."
      }
    """
    try:
        inspection = db.session.get(Inspection, inspection_id)
        if not inspection:
            return jsonify({"error": f"Inspection {inspection_id} not found"}), 404

        data = request.get_json(force=True)
        decision = data.get("decision")
        if decision not in ("compliant", "confirmed_violation", "further_review"):
            return jsonify({"error": "Invalid decision. Must be 'compliant', 'confirmed_violation', or 'further_review'."}), 400

        inspection.inspector_decision = decision
        inspection.inspector_remarks = data.get("remarks", "")
        inspection.inspector_name = data.get("inspector_name", "Inspector")
        inspection.inspector_id = data.get("inspector_id", "INS-000")
        inspection.verified_at = datetime.now(timezone.utc)

        # Map decision to verification_status
        if decision == "compliant":
            inspection.verification_status = "verified"
        elif decision == "confirmed_violation":
            inspection.verification_status = "confirmed_violation"
        else:
            inspection.verification_status = "further_review"

        db.session.commit()

        return jsonify(inspection.to_dict()), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/history", methods=["GET"])
def get_history():
    """Return all past inspections, newest first."""
    try:
        inspections = Inspection.query.order_by(Inspection.created_at.desc()).all()
        return jsonify([i.to_dict() for i in inspections]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/inspections/<int:inspection_id>", methods=["GET"])
def get_inspection(inspection_id):
    """Return a single inspection with full field-level detail."""
    try:
        inspection = db.session.get(Inspection, inspection_id)
        if not inspection:
            return jsonify({"error": f"Inspection {inspection_id} not found"}), 404
        return jsonify(inspection.to_dict()), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/rules", methods=["GET"])
def get_rules():
    """
    Return all rows from the Rule table.
    The frontend will use this for a "Rules & Requirements" reference page.
    """
    try:
        rules = Rule.query.all()
        return jsonify([r.to_dict() for r in rules]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/analytics", methods=["GET"])
def get_analytics():
    """
    Return computed inspection analytics for the frontend dashboard.

    Returns summary stats, trend data (monthly), and violation category
    breakdowns — all computed server-side from the database.
    """
    try:
        inspections = Inspection.query.all()
        total = len(inspections)
        if total == 0:
            return jsonify({
                "summary": {
                    "totalInspections": 0,
                    "compliant": 0,
                    "potentialViolations": 0,
                    "needsReview": 0,
                    "complianceRate": 0,
                    "violationRate": 0,
                },
                "trendData": [],
                "violationCategories": [],
            }), 200

        compliant = sum(
            1 for i in inspections
            if (i.status or "").lower() == "compliant"
        )
        violations = sum(
            1 for i in inspections
            if "non" in (i.status or "").lower()
            or "violation" in (i.status or "").lower()
        )
        needs_review = total - compliant - violations
        comp_rate = round((compliant / total) * 100) if total > 0 else 0
        viol_rate = round((violations / total) * 100) if total > 0 else 0

        # --- Trend data: group by month ---
        from collections import defaultdict
        monthly = defaultdict(lambda: {"inspections": 0, "compliant": 0, "violations": 0})
        for ins in inspections:
            if ins.created_at:
                key = ins.created_at.strftime("%b %Y")
                monthly[key]["inspections"] += 1
                status_lower = (ins.status or "").lower()
                if status_lower == "compliant":
                    monthly[key]["compliant"] += 1
                elif "non" in status_lower or "violation" in status_lower:
                    monthly[key]["violations"] += 1

        trend_data = [
            {"date": k, "inspections": v["inspections"],
             "compliant": v["compliant"], "violations": v["violations"]}
            for k, v in monthly.items()
        ]

        # --- Violation categories: count missing fields across all inspections ---
        field_miss_counts = defaultdict(int)
        for ins in inspections:
            for f in ins.fields:
                if (f.status or "").lower() == "missing":
                    field_miss_counts[f.field_name] += 1

        field_label_map = {
            "net_quantity": "Missing Net Quantity",
            "mrp": "Missing MRP Declaration",
            "manufacturer": "Missing Manufacturer Details",
            "consumer_care": "Missing Consumer Care Info",
            "mfg_date": "Missing Manufacturing Date",
            "address": "Missing Address",
            "country_of_origin": "Missing Country of Origin",
            "best_before": "Missing Best Before Date",
            "fssai_license": "Missing FSSAI License",
            "unit_sale_price": "Missing Unit Sale Price",
        }

        total_missing = sum(field_miss_counts.values()) or 1
        violation_categories = sorted(
            [
                {
                    "name": field_label_map.get(k, k),
                    "count": v,
                    "percentage": round((v / total_missing) * 100, 1),
                }
                for k, v in field_miss_counts.items()
            ],
            key=lambda x: x["count"],
            reverse=True,
        )

        return jsonify({
            "summary": {
                "totalInspections": total,
                "compliant": compliant,
                "potentialViolations": violations,
                "needsReview": needs_review,
                "complianceRate": comp_rate,
                "violationRate": viol_rate,
            },
            "trendData": trend_data,
            "violationCategories": violation_categories,
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/reports", methods=["GET"])
def get_reports():
    """
    Return all inspections formatted as downloadable reports.

    Each report corresponds to one inspection and includes the product
    name, compliance status, score, verification status, and field-level
    detail.
    """
    try:
        inspections = Inspection.query.order_by(
            Inspection.created_at.desc()
        ).all()

        reports = []
        for ins in inspections:
            extracted = None
            if ins.raw_extracted_data:
                try:
                    extracted = json.loads(ins.raw_extracted_data)
                except (json.JSONDecodeError, TypeError):
                    extracted = {}

            reports.append({
                "id": f"RPT-{ins.id}",
                "inspectionId": f"INS-{ins.id}",
                "product": ins.product_name or (extracted or {}).get("manufacturer", "Unknown Product"),
                "category": "Packaged Commodities",
                "result": ins.status,
                "score": ins.score,
                "verificationStatus": ins.verification_status,
                "generatedAt": ins.created_at.isoformat() if ins.created_at else None,
                "inspectorName": ins.inspector_name or "Inspector",
                "fields": [f.to_dict() for f in ins.fields],
            })

        return jsonify(reports), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/inspections/<int:inspection_id>", methods=["DELETE"])
def delete_inspection(inspection_id):
    """
    Delete an inspection and all its associated fields.
    """
    try:
        inspection = db.session.get(Inspection, inspection_id)
        if not inspection:
            return jsonify({"error": f"Inspection {inspection_id} not found"}), 404

        db.session.delete(inspection)
        db.session.commit()
        return jsonify({"message": f"Inspection {inspection_id} deleted successfully"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ===========================  ENTRY POINT  ================================

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)

