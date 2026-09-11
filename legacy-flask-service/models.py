from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Rule(db.Model):
    """
    Stores Legal Metrology rules loaded from the official Rule 6 schedule.
    This table will be populated by a teammate with data sourced from the
    Legal Metrology (Packaged Commodities) Rules, 2011.
    """
    __tablename__ = "rules"

    id = db.Column(db.Integer, primary_key=True)
    field_name = db.Column(db.String(100), nullable=False, unique=True)
    rule_number = db.Column(db.String(50), nullable=False)
    rule_text = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(100), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "field_name": self.field_name,
            "rule_number": self.rule_number,
            "rule_text": self.rule_text,
            "category": self.category,
        }


class Inspection(db.Model):
    """
    Represents a single product-label compliance inspection.
    Each inspection references zero or more InspectionField rows
    detailing per-field compliance results.
    """
    __tablename__ = "inspections"

    id = db.Column(db.Integer, primary_key=True)
    product_name = db.Column(db.String(255), nullable=True)
    image_name = db.Column(db.String(255), nullable=False)
    raw_ocr_text = db.Column(db.Text, nullable=True)
    raw_extracted_data = db.Column(db.Text, nullable=True)  # JSON string of structured fields
    score = db.Column(db.Float, nullable=False, default=0.0)
    status = db.Column(db.String(50), nullable=False, default="Pending")

    # Inspector verification fields
    inspector_decision = db.Column(db.String(50), nullable=True)     # compliant / confirmed_violation / further_review
    inspector_remarks = db.Column(db.Text, nullable=True)
    inspector_name = db.Column(db.String(255), nullable=True)
    inspector_id = db.Column(db.String(50), nullable=True)
    verification_status = db.Column(db.String(50), nullable=False, default="pending")  # pending / verified / confirmed_violation / further_review
    verified_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(
        db.DateTime, nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = db.Column(
        db.DateTime, nullable=True,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    fields = db.relationship(
        "InspectionField", backref="inspection",
        lazy="joined", cascade="all, delete-orphan",
    )

    def to_dict(self):
        import json
        extracted = None
        if self.raw_extracted_data:
            try:
                extracted = json.loads(self.raw_extracted_data)
            except (json.JSONDecodeError, TypeError):
                extracted = None
        return {
            "id": self.id,
            "product_name": self.product_name,
            "image_name": self.image_name,
            "raw_ocr_text": self.raw_ocr_text,
            "extracted_data": extracted,
            "score": self.score,
            "status": self.status,
            "verification_status": self.verification_status,
            "inspector_decision": self.inspector_decision,
            "inspector_remarks": self.inspector_remarks,
            "inspector_name": self.inspector_name,
            "inspector_id": self.inspector_id,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "fields": [f.to_dict() for f in self.fields],
        }


class InspectionField(db.Model):
    """
    Per-field compliance result within a single inspection.
    Links back to the Rule that was checked, if one exists.
    """
    __tablename__ = "inspection_fields"

    id = db.Column(db.Integer, primary_key=True)
    inspection_id = db.Column(
        db.Integer, db.ForeignKey("inspections.id"), nullable=False,
    )
    field_name = db.Column(db.String(100), nullable=False)
    extracted_value = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(50), nullable=False, default="Missing")
    rule_id = db.Column(
        db.Integer, db.ForeignKey("rules.id"), nullable=True,
    )

    rule = db.relationship("Rule", lazy="joined")

    def to_dict(self):
        return {
            "id": self.id,
            "inspection_id": self.inspection_id,
            "field_name": self.field_name,
            "extracted_value": self.extracted_value,
            "status": self.status,
            "rule_id": self.rule_id,
            "rule": self.rule.to_dict() if self.rule else None,
        }
