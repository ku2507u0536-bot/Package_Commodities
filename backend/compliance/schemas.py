"""
Data shapes that flow into and out of the Rule Engine.

IMPORTANT DISTINCTION:
- ExtractedFields = what the AI/OCR pipeline THINKS the label says (a guess,
  with a confidence score). Tagged `source: "ai_extracted"` upstream.
- FieldResult / ComplianceReport = what the RULE ENGINE has DECIDED, based on
  deterministic legal checks. Tagged `source: "rule_verified"` upstream.

The Rule Engine never edits ExtractedFields — it only reads them and judges.
"""

from dataclasses import dataclass, field
from typing import Optional, Literal

Status = Literal["PASS", "FAIL", "REVIEW_REQUIRED"]


@dataclass
class ExtractedFields:
    """Best-effort structured output from OCR + AI extraction. Every value
    can be missing (None) — the engine must handle that, never assume it."""

    product_name: Optional[str] = None
    product_name_confidence: float = 0.0

    manufacturer: Optional[str] = None
    packer: Optional[str] = None
    importer: Optional[str] = None
    address: Optional[str] = None
    address_confidence: float = 0.0

    net_quantity_value: Optional[str] = None
    net_quantity_unit: Optional[str] = None
    net_quantity_confidence: float = 0.0

    mrp_value: Optional[str] = None
    mrp_tax_inclusive_wording_present: bool = False
    mrp_confidence: float = 0.0

    unit_sale_price_value: Optional[str] = None
    unit_sale_price_confidence: float = 0.0

    manufacture_date: Optional[str] = None
    manufacture_date_confidence: float = 0.0

    consumer_care_phone: Optional[str] = None
    consumer_care_email: Optional[str] = None
    consumer_care_confidence: float = 0.0

    country_of_origin: Optional[str] = None
    country_of_origin_confidence: float = 0.0

    is_imported_product: Optional[bool] = None
    is_imported_product_confidence: float = 0.0


@dataclass
class FieldResult:
    field: str
    status: Status
    rule_ref: str
    reason: Optional[str] = None
    value: Optional[str] = None


@dataclass
class ComplianceReport:
    rule_version: str
    overall_status: Status
    fields: list[FieldResult] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "rule_version": self.rule_version,
            "overall_status": self.overall_status,
            "fields": [
                {k: v for k, v in vars(f).items() if v is not None}
                for f in self.fields
            ],
        }
