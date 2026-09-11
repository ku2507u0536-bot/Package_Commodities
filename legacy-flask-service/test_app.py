"""
End-to-end tests for the Packaged Commodities Compliance Checker backend.
Uses an in-memory SQLite database — no Postgres required.
"""

import io
import unittest
from app import app, db
from models import Rule, Inspection, InspectionField
from rule_engine import check_compliance, compliance_score, overall_status, REQUIRED_FIELDS
from ocr_module import extract_text
from llm_module import structure_label_data


class TestRuleEngine(unittest.TestCase):
    """Unit tests for the compliance logic in isolation."""

    def test_all_fields_present(self):
        data = {
            "net_quantity": "500g",
            "mrp": "Rs 120",
            "manufacturer": "XYZ Ltd",
            "consumer_care": "1800-123-456",
            "mfg_date": "01/2026",
        }
        rules_lookup = {}  # no DB rules → still reports "Rule reference pending"
        report = check_compliance(data, rules_lookup)

        self.assertEqual(len(report), len(REQUIRED_FIELDS))
        for item in report:
            self.assertEqual(item["status"], "Present")
        self.assertEqual(compliance_score(report), 100.0)
        self.assertEqual(overall_status(100.0), "Compliant")

    def test_partial_fields(self):
        data = {"net_quantity": "500g", "mrp": "Rs 120"}
        report = check_compliance(data, {})
        score = compliance_score(report)
        self.assertEqual(score, 40.0)
        self.assertEqual(overall_status(score), "Non-Compliant")

    def test_no_fields(self):
        report = check_compliance({}, {})
        self.assertEqual(compliance_score(report), 0.0)
        self.assertEqual(overall_status(0.0), "Non-Compliant")

    def test_needs_review_threshold(self):
        # 3 out of 5 = 60%
        data = {"net_quantity": "x", "mrp": "x", "manufacturer": "x"}
        report = check_compliance(data, {})
        score = compliance_score(report)
        self.assertEqual(score, 60.0)
        self.assertEqual(overall_status(score), "Needs Review")

    def test_overall_status_values(self):
        self.assertEqual(overall_status(100.0), "Compliant")
        self.assertEqual(overall_status(80.0), "Needs Review")
        self.assertEqual(overall_status(60.0), "Needs Review")
        self.assertEqual(overall_status(59.9), "Non-Compliant")
        self.assertEqual(overall_status(0.0), "Non-Compliant")


class TestPlaceholders(unittest.TestCase):
    """Verify the OCR stub and regex extraction work correctly."""

    def test_extract_text_returns_string(self):
        result = extract_text("dummy_path.jpg")
        self.assertIsInstance(result, str)
        self.assertTrue(len(result) > 0)

    def test_structure_label_data_returns_dict(self):
        sample = (
            "Net Wt 500g MRP Rs 120 Manufactured by XYZ Foods Pvt Ltd "
            "Plot 12, Industrial Area, Gurgaon, Haryana 122002 "
            "Consumer Care: 1800-123-4567 Mfg Date: 01/2026 "
            "Country of Origin: India"
        )
        structured = structure_label_data(sample)
        self.assertIsInstance(structured, dict)
        self.assertIsNotNone(structured["net_quantity"])
        self.assertIn("500", structured["net_quantity"])
        self.assertIsNotNone(structured["mrp"])
        self.assertIsNotNone(structured["manufacturer"])
        self.assertIsNotNone(structured["consumer_care"])
        self.assertIsNotNone(structured["mfg_date"])
        self.assertIsNotNone(structured["country_of_origin"])

    def test_structure_empty_text(self):
        structured = structure_label_data("")
        self.assertIsNone(structured["net_quantity"])
        self.assertIsNone(structured["mrp"])


class TestEndpoints(unittest.TestCase):
    """Integration tests for all API routes."""

    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()
        with app.app_context():
            db.create_all()
            InspectionField.query.delete()
            Inspection.query.delete()
            db.session.commit()

    def tearDown(self):
        with app.app_context():
            InspectionField.query.delete()
            Inspection.query.delete()
            db.session.commit()
            db.session.remove()

    # --- /health ---
    def test_health(self):
        resp = self.client.get("/health")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json(), {"status": "ok"})

    # --- /analyze ---
    def test_analyze_success(self):
        dummy = (io.BytesIO(b"\xff\xd8\xff dummy jpeg"), "test_label.jpg")
        resp = self.client.post(
            "/analyze",
            data={"image": dummy},
            content_type="multipart/form-data",
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.get_json()
        self.assertIn("extracted_data", body)
        self.assertIn("compliance_report", body)
        self.assertIn("score", body)
        self.assertIn("status", body)
        self.assertEqual(body["score"], 100.0)
        self.assertEqual(body["status"], "Compliant")
        self.assertEqual(body["image_name"], "test_label.jpg")

    def test_analyze_no_file(self):
        resp = self.client.post("/analyze", data={})
        self.assertEqual(resp.status_code, 400)

    def test_analyze_empty_filename(self):
        dummy = (io.BytesIO(b"data"), "")
        resp = self.client.post(
            "/analyze",
            data={"image": dummy},
            content_type="multipart/form-data",
        )
        self.assertEqual(resp.status_code, 400)

    # --- /history ---
    def test_history_empty_then_populated(self):
        resp = self.client.get("/history")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json(), [])

        # add a scan
        dummy = (io.BytesIO(b"img"), "product.jpg")
        self.client.post("/analyze", data={"image": dummy}, content_type="multipart/form-data")

        resp = self.client.get("/history")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["image_name"], "product.jpg")
        # should include child fields
        self.assertGreater(len(data[0]["fields"]), 0)

    # --- /inspections/<id> ---
    def test_get_inspection_by_id(self):
        dummy = (io.BytesIO(b"img"), "label.jpg")
        create_resp = self.client.post(
            "/analyze", data={"image": dummy}, content_type="multipart/form-data",
        )
        new_id = create_resp.get_json()["id"]

        resp = self.client.get(f"/inspections/{new_id}")
        self.assertEqual(resp.status_code, 200)
        body = resp.get_json()
        self.assertEqual(body["id"], new_id)

    def test_get_inspection_not_found(self):
        resp = self.client.get("/inspections/999")
        self.assertEqual(resp.status_code, 404)

    # --- /rules ---
    def test_rules_empty(self):
        resp = self.client.get("/rules")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json(), [])

    def test_rules_with_data(self):
        with app.app_context():
            db.session.add(Rule(
                field_name="net_quantity",
                rule_number="6(1)(a)",
                rule_text="Every package shall bear the net quantity.",
                category="Mandatory",
            ))
            db.session.commit()

        resp = self.client.get("/rules")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["field_name"], "net_quantity")

    # --- /analyze-text ---
    def test_analyze_text_success(self):
        raw_text = (
            "Net Wt: 500g MRP: Rs 120 Manufactured by: Test Corp "
            "Consumer Care: 1800-000-000 Mfg Date: 01/2026 Country of Origin: India"
        )
        resp = self.client.post(
            "/analyze-text",
            json={"raw_text": raw_text, "image_name": "test_text.jpg"},
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.get_json()
        self.assertIn("id", body)
        self.assertEqual(body["status"], "Compliant")
        self.assertEqual(body["score"], 100.0)

    def test_analyze_text_missing_body(self):
        resp = self.client.post("/analyze-text", json={})
        self.assertEqual(resp.status_code, 400)

    # --- /inspections/<id>/verify ---
    def test_verify_inspection(self):
        dummy = (io.BytesIO(b"img"), "verify_test.jpg")
        create_resp = self.client.post(
            "/analyze", data={"image": dummy}, content_type="multipart/form-data"
        )
        new_id = create_resp.get_json()["id"]

        resp = self.client.post(
            f"/inspections/{new_id}/verify",
            json={
                "decision": "compliant",
                "remarks": "Verified by officer",
                "inspector_name": "Officer Sharma",
                "inspector_id": "INS-007",
            },
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.get_json()
        self.assertEqual(body["verification_status"], "verified")
        self.assertEqual(body["inspector_name"], "Officer Sharma")

    # --- /analytics ---
    def test_analytics_empty(self):
        resp = self.client.get("/analytics")
        self.assertEqual(resp.status_code, 200)
        body = resp.get_json()
        self.assertIn("summary", body)
        self.assertEqual(body["summary"]["totalInspections"], 0)

    def test_analytics_populated(self):
        dummy = (io.BytesIO(b"img"), "analytics_test.jpg")
        self.client.post("/analyze", data={"image": dummy}, content_type="multipart/form-data")

        resp = self.client.get("/analytics")
        self.assertEqual(resp.status_code, 200)
        body = resp.get_json()
        self.assertEqual(body["summary"]["totalInspections"], 1)
        self.assertIn("trendData", body)
        self.assertIn("violationCategories", body)

    # --- /reports ---
    def test_reports(self):
        dummy = (io.BytesIO(b"img"), "report_test.jpg")
        self.client.post("/analyze", data={"image": dummy}, content_type="multipart/form-data")

        resp = self.client.get("/reports")
        self.assertEqual(resp.status_code, 200)
        reports = resp.get_json()
        self.assertEqual(len(reports), 1)
        self.assertIn("id", reports[0])
        self.assertIn("inspectionId", reports[0])

    # --- DELETE /inspections/<id> ---
    def test_delete_inspection(self):
        dummy = (io.BytesIO(b"img"), "delete_test.jpg")
        create_resp = self.client.post(
            "/analyze", data={"image": dummy}, content_type="multipart/form-data"
        )
        new_id = create_resp.get_json()["id"]

        del_resp = self.client.delete(f"/inspections/{new_id}")
        self.assertEqual(del_resp.status_code, 200)

        get_resp = self.client.get(f"/inspections/{new_id}")
        self.assertEqual(get_resp.status_code, 404)


if __name__ == "__main__":
    unittest.main()
