"""
Run from the parent directory with:  python -m SIH_project.test_engine

Three demo cases matching the SIH demo plan:
  1. Fully compliant label      -> PASS
  2. Missing/bad fields         -> FAIL
  3. Blurry/ambiguous label     -> REVIEW_REQUIRED
"""

import json

from . import ExtractedFields, run_rule_engine


def case_pass() -> ExtractedFields:
    return ExtractedFields(
        manufacturer="ABC Foods Pvt Ltd", address="123 MG Road, Pune, MH 411001",
        address_confidence=0.9,
        net_quantity_value="200", net_quantity_unit="g", net_quantity_confidence=0.95,
        manufacture_date="08/2026", manufacture_date_confidence=0.92,
        mrp_value="Rs. 99.00", mrp_tax_inclusive_wording_present=True, mrp_confidence=0.97,
        unit_sale_price_value="Rs. 495/kg", unit_sale_price_confidence=0.88,
        consumer_care_phone="1800-123-4567", consumer_care_confidence=0.9,
        is_imported_product=False, is_imported_product_confidence=0.85,
    )


def case_fail() -> ExtractedFields:
    return ExtractedFields(
        manufacturer="XYZ Snacks", address="Some Street, Delhi",
        address_confidence=0.85,
        # net quantity present but wrong/non-standard unit
        net_quantity_value="1", net_quantity_unit="packet", net_quantity_confidence=0.9,
        manufacture_date=None, manufacture_date_confidence=0.9,  # confidently absent
        mrp_value="Rs. 50.00", mrp_tax_inclusive_wording_present=False, mrp_confidence=0.93,
        unit_sale_price_value=None, unit_sale_price_confidence=0.9,
        consumer_care_phone=None, consumer_care_email=None, consumer_care_confidence=0.9,
        is_imported_product=False, is_imported_product_confidence=0.9,
    )


def case_review_required() -> ExtractedFields:
    return ExtractedFields(
        manufacturer="Unclear Pvt Ltd", address="partially blurred address",
        address_confidence=0.4,  # below threshold
        net_quantity_value="250", net_quantity_unit="ml", net_quantity_confidence=0.55,  # below threshold
        manufacture_date="??/2026", manufacture_date_confidence=0.5,  # below threshold
        mrp_value="Rs. 149.00", mrp_tax_inclusive_wording_present=True, mrp_confidence=0.91,
        unit_sale_price_value="Rs. 596/l", unit_sale_price_confidence=0.87,
        consumer_care_phone="022-12345678", consumer_care_confidence=0.9,
        is_imported_product=None, is_imported_product_confidence=0.3,  # couldn't tell
    )


def run_and_print(label: str, fields: ExtractedFields):
    report = run_rule_engine(fields)
    print(f"\n=== {label} ===")
    print(json.dumps(report.to_dict(), indent=2))


if __name__ == "__main__":
    run_and_print("Case 1: Compliant label", case_pass())
    run_and_print("Case 2: Violating label", case_fail())
    run_and_print("Case 3: Ambiguous / low-confidence label", case_review_required())
