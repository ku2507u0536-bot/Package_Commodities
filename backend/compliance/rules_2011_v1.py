"""
Legal Metrology (Packaged Commodities) Rules, 2011 — Rule 6 checks.
Rule set version: "2011-r6-v1"

Each function:
  - takes the ExtractedFields (the AI's best guess at what's on the label)
  - returns a FieldResult with a deterministic PASS / FAIL / REVIEW_REQUIRED
  - NEVER calls an LLM. NEVER guesses. Low confidence -> REVIEW_REQUIRED.

To handle a future amendment, do NOT edit these functions — copy this file to
rules_2011_v2.py, change what needs to change, and register both versions in
engine.py so old scans keep citing the rule version that was active when they
ran (see RULE_REGISTRY).
"""

from .schemas import ExtractedFields, FieldResult
from .config import CONFIDENCE_THRESHOLD, VALID_QUANTITY_UNITS


def check_manufacturer_or_packer_or_importer(f: ExtractedFields) -> FieldResult:
    rule_ref = "Rule 6(1)(a)"
    if f.address_confidence < CONFIDENCE_THRESHOLD:
        return FieldResult("manufacturer_packer_importer", "REVIEW_REQUIRED", rule_ref,
                            reason="Low confidence on name/address block")
    has_entity = any([f.manufacturer, f.packer, f.importer])
    if not has_entity:
        return FieldResult("manufacturer_packer_importer", "FAIL", rule_ref,
                            reason="No manufacturer, packer, or importer name found")
    if not f.address:
        return FieldResult("manufacturer_packer_importer", "FAIL", rule_ref,
                            reason="Entity name found but address missing")
    return FieldResult("manufacturer_packer_importer", "PASS", rule_ref,
                        value=f.manufacturer or f.packer or f.importer)


def check_net_quantity(f: ExtractedFields) -> FieldResult:
    rule_ref = "Rule 6(1)(c)"
    if f.net_quantity_confidence < CONFIDENCE_THRESHOLD:
        return FieldResult("net_quantity", "REVIEW_REQUIRED", rule_ref,
                            reason="Low confidence on net quantity")
    if not f.net_quantity_value:
        return FieldResult("net_quantity", "FAIL", rule_ref,
                            reason="Net quantity not found")
    if f.net_quantity_unit not in VALID_QUANTITY_UNITS:
        return FieldResult("net_quantity", "FAIL", rule_ref,
                            reason=f"Unit '{f.net_quantity_unit}' is not a standard unit",
                            value=f.net_quantity_value)
    return FieldResult("net_quantity", "PASS", rule_ref,
                        value=f"{f.net_quantity_value} {f.net_quantity_unit}")


def check_manufacture_date(f: ExtractedFields) -> FieldResult:
    rule_ref = "Rule 6(1)(f)"
    if f.manufacture_date_confidence < CONFIDENCE_THRESHOLD:
        return FieldResult("manufacture_date", "REVIEW_REQUIRED", rule_ref,
                            reason="Low confidence on manufacture/packing date")
    if not f.manufacture_date:
        return FieldResult("manufacture_date", "FAIL", rule_ref,
                            reason="Month & year of manufacture/packing not found")
    return FieldResult("manufacture_date", "PASS", rule_ref, value=f.manufacture_date)


def check_mrp(f: ExtractedFields) -> FieldResult:
    rule_ref = "Rule 6(1)(e)"
    if f.mrp_confidence < CONFIDENCE_THRESHOLD:
        return FieldResult("mrp", "REVIEW_REQUIRED", rule_ref,
                            reason="Low confidence on MRP")
    if not f.mrp_value:
        return FieldResult("mrp", "FAIL", rule_ref, reason="MRP not found")
    if not f.mrp_tax_inclusive_wording_present:
        return FieldResult("mrp", "FAIL", rule_ref,
                            reason="'Inclusive of all taxes' wording missing",
                            value=f.mrp_value)
    return FieldResult("mrp", "PASS", rule_ref, value=f.mrp_value)


def check_unit_sale_price(f: ExtractedFields) -> FieldResult:
    rule_ref = "Rule 6(1)(g)"
    if f.unit_sale_price_confidence < CONFIDENCE_THRESHOLD:
        return FieldResult("unit_sale_price", "REVIEW_REQUIRED", rule_ref,
                            reason="Low confidence on unit sale price")
    if not f.unit_sale_price_value:
        return FieldResult("unit_sale_price", "FAIL", rule_ref,
                            reason="Unit sale price not found")
    return FieldResult("unit_sale_price", "PASS", rule_ref, value=f.unit_sale_price_value)


def check_consumer_care(f: ExtractedFields) -> FieldResult:
    rule_ref = "Rule 6(1)(b)"
    if f.consumer_care_confidence < CONFIDENCE_THRESHOLD:
        return FieldResult("consumer_care", "REVIEW_REQUIRED", rule_ref,
                            reason="Low confidence on consumer care details")
    if not f.consumer_care_phone and not f.consumer_care_email:
        return FieldResult("consumer_care", "FAIL", rule_ref,
                            reason="No consumer care phone or email found")
    value = f.consumer_care_phone or f.consumer_care_email
    return FieldResult("consumer_care", "PASS", rule_ref, value=value)


def check_country_of_origin(f: ExtractedFields) -> FieldResult:
    rule_ref = "Rule 6(1)(h)"
    if f.is_imported_product is None or f.is_imported_product_confidence < CONFIDENCE_THRESHOLD:
        return FieldResult("country_of_origin", "REVIEW_REQUIRED", rule_ref,
                            reason="Import status could not be determined with confidence")
    if f.is_imported_product is False:
        return FieldResult("country_of_origin", "PASS", rule_ref,
                            reason="Not applicable — domestic product")
    # is_imported_product is True from here on
    if f.country_of_origin_confidence < CONFIDENCE_THRESHOLD:
        return FieldResult("country_of_origin", "REVIEW_REQUIRED", rule_ref,
                            reason="Low confidence on country of origin")
    if not f.country_of_origin:
        return FieldResult("country_of_origin", "FAIL", rule_ref,
                            reason="Country of origin missing on imported product")
    return FieldResult("country_of_origin", "PASS", rule_ref, value=f.country_of_origin)


# Every check in this rule set, run in this order by the engine.
CHECKS = [
    check_manufacturer_or_packer_or_importer,
    check_net_quantity,
    check_manufacture_date,
    check_mrp,
    check_unit_sale_price,
    check_consumer_care,
    check_country_of_origin,
]

RULE_VERSION = "2011-r6-v1"
