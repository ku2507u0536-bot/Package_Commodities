"""
Integration Service: Connects the Compliance Rule Engine to the Supabase Database.

Responsibilities:
1. Receive structured product information (JSON/dict).
2. Map to ExtractedFields and invoke the existing Rule Engine.
3. Receive the ComplianceReport.
4. Save the inspection and rule-level results to Supabase.
5. Return the saved result.
"""

import re
from typing import Optional, Any
from .schemas import ExtractedFields, ComplianceReport
from .engine import run_rule_engine
from .database import save_compliance_report, get_report


def parse_net_quantity(raw_qty: Any) -> tuple[Optional[str], Optional[str]]:
    """Extracts value and unit from strings like '1 kg', '200g', '500 ml'."""
    if not raw_qty:
        return None, None
    s = str(raw_qty).strip()
    match = re.match(r"^([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]+)?$", s)
    if match:
        val, unit = match.groups()
        return val, (unit.lower() if unit else None)
    return s, None


def parse_product_input(data: dict) -> ExtractedFields:
    """
    Transforms structured product dictionary into ExtractedFields dataclass.
    Preserves provided confidences or defaults to 1.0 for manual/test input.
    """
    conf_default = float(data.get("default_confidence", 1.0))

    # Net quantity parsing
    nq_val = data.get("net_quantity_value")
    nq_unit = data.get("net_quantity_unit")
    if not nq_val and data.get("net_quantity"):
        nq_val, nq_unit = parse_net_quantity(data["net_quantity"])

    # MRP parsing & tax inclusive detection
    mrp_val = data.get("mrp_value") or data.get("mrp")
    tax_inclusive = data.get("mrp_tax_inclusive_wording_present", False)
    if mrp_val and not tax_inclusive:
        mrp_lower = str(mrp_val).lower()
        if "incl" in mrp_lower or "tax" in mrp_lower:
            tax_inclusive = True

    # Import / origin parsing
    country_of_origin = data.get("country_of_origin")
    is_imported = data.get("is_imported_product")
    if is_imported is None and country_of_origin:
        origin_clean = country_of_origin.strip().lower()
        is_imported = origin_clean not in ["india", "in", "ind", "bharat"]
    elif is_imported is None and not country_of_origin:
        is_imported = False

    # Consumer care parsing
    cc_phone = data.get("consumer_care_phone")
    cc_email = data.get("consumer_care_email")
    if not cc_phone and not cc_email and data.get("consumer_care"):
        cc_raw = str(data["consumer_care"]).strip()
        if "@" in cc_raw:
            cc_email = cc_raw
        else:
            cc_phone = cc_raw

    # Address / manufacturer
    mfg = data.get("manufacturer")
    packer = data.get("packer")
    importer = data.get("importer")
    address = data.get("address")

    # Date parsing
    mfg_date = data.get("manufacture_date") or data.get("date_of_packing")

    # Unit sale price
    usp_val = data.get("unit_sale_price_value") or data.get("unit_sale_price")

    return ExtractedFields(
        product_name=data.get("product_name"),
        product_name_confidence=float(data.get("product_name_confidence", conf_default)),

        manufacturer=mfg,
        packer=packer,
        importer=importer,
        address=address,
        address_confidence=float(data.get("address_confidence", conf_default)),

        net_quantity_value=nq_val,
        net_quantity_unit=nq_unit,
        net_quantity_confidence=float(data.get("net_quantity_confidence", conf_default)),

        mrp_value=str(mrp_val) if mrp_val is not None else None,
        mrp_tax_inclusive_wording_present=bool(tax_inclusive),
        mrp_confidence=float(data.get("mrp_confidence", conf_default)),

        unit_sale_price_value=usp_val,
        unit_sale_price_confidence=float(data.get("unit_sale_price_confidence", conf_default)),

        manufacture_date=mfg_date,
        manufacture_date_confidence=float(data.get("manufacture_date_confidence", conf_default)),

        consumer_care_phone=cc_phone,
        consumer_care_email=cc_email,
        consumer_care_confidence=float(data.get("consumer_care_confidence", conf_default)),

        country_of_origin=country_of_origin,
        country_of_origin_confidence=float(data.get("country_of_origin_confidence", conf_default)),

        is_imported_product=is_imported,
        is_imported_product_confidence=float(data.get("is_imported_product_confidence", conf_default)),
    )


def check_compliance_and_save(
    product: dict | ExtractedFields,
    scan_id: Optional[str] = None,
    rule_version: Optional[str] = None,
) -> dict:
    """
    Direct Rule Engine to Database integration:
    Takes either raw product JSON (dict) or ExtractedFields,
    evaluates compliance using the Rule Engine,
    saves the verdict and rule breakdown to Supabase,
    and returns the result.
    """
    if isinstance(product, ExtractedFields):
        fields = product
        product_name = fields.product_name
    elif isinstance(product, dict):
        fields = parse_product_input(product)
        product_name = fields.product_name or product.get("product_name") or product.get("brand")
    else:
        raise ValueError("product must be a dictionary or an ExtractedFields instance.")

    # 1. Run Rule Engine
    if rule_version:
        report: ComplianceReport = run_rule_engine(fields, rule_version=rule_version)
    else:
        report: ComplianceReport = run_rule_engine(fields)

    # 2. Save report to Database
    saved_scan_id = save_compliance_report(
        report=report,
        scan_id=scan_id,
        product_name=product_name,
    )

    # 3. Return combined result
    return {
        "success": True,
        "inspection_id": saved_scan_id,
        "compliance": report.to_dict(),
        "saved": True,
    }


def process_and_save_compliance(
    product_data: dict,
    inspection_id: Optional[str] = None,
    rule_version: Optional[str] = None,
) -> dict:
    """Convenience alias for check_compliance_and_save with dictionary inputs."""
    return check_compliance_and_save(
        product=product_data,
        scan_id=inspection_id,
        rule_version=rule_version,
    )

