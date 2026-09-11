"""
seed_rules.py
─────────────
One-time script to populate the `rules` table with Legal Metrology
(Packaged Commodities) Rules, 2011 — mandatory label declarations.

Usage:
    cd Backend
    python seed_rules.py
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()

# Ensure the current directory is on the path so models can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models import Rule

RULES = [
    {
        "field_name": "net_quantity",
        "rule_number": "Rule 6(1)(b)",
        "rule_text": (
            "Every package shall bear the net quantity of the commodity "
            "contained in it, expressed in terms of the standard unit of "
            "weight or measure."
        ),
        "category": "Package Declarations",
    },
    {
        "field_name": "mrp",
        "rule_number": "Rule 6(1)(d)",
        "rule_text": (
            "Every package shall bear the retail sale price of the package, "
            "which shall be the maximum retail price (MRP) inclusive of all "
            "taxes."
        ),
        "category": "Package Declarations",
    },
    {
        "field_name": "manufacturer",
        "rule_number": "Rule 6(1)(c)",
        "rule_text": (
            "Every package shall bear the name and complete address of the "
            "manufacturer, or where the manufacturer is not the packer, "
            "the name and address of the packer or the importer."
        ),
        "category": "Manufacturer / Importer",
    },
    {
        "field_name": "address",
        "rule_number": "Rule 6(1)(c)",
        "rule_text": (
            "The complete address of the manufacturer or packer, including "
            "the premises where the commodity is manufactured or packed, "
            "shall be declared on the package."
        ),
        "category": "Manufacturer / Importer",
    },
    {
        "field_name": "consumer_care",
        "rule_number": "Rule 6(1)(g)",
        "rule_text": (
            "Every package shall declare the customer care details, "
            "including at least a toll-free consumer care telephone number "
            "or an email address or both."
        ),
        "category": "Consumer Information",
    },
    {
        "field_name": "mfg_date",
        "rule_number": "Rule 6(1)(f)",
        "rule_text": (
            "Every package shall bear the month and year in which the "
            "commodity was manufactured, packed, or imported. The best "
            "before or use-by date shall also be declared."
        ),
        "category": "Date Information",
    },
    {
        "field_name": "country_of_origin",
        "rule_number": "Rule 6(1)(e)",
        "rule_text": (
            "Every package of a commodity that is an import shall bear "
            "the country of origin of the commodity. For domestically "
            "manufactured goods, the country of origin (India) shall be "
            "declared."
        ),
        "category": "Origin",
    },
    {
        "field_name": "best_before",
        "rule_number": "Rule 6(1)(f)",
        "rule_text": (
            "The 'Best Before' or 'Use By' date shall be declared "
            "on every package of a commodity that may deteriorate with time."
        ),
        "category": "Date Information",
    },
    {
        "field_name": "unit_sale_price",
        "rule_number": "Rule 6(1)(h)",
        "rule_text": (
            "Where a commodity is sold by weight, measure or number, "
            "and the net quantity exceeds the prescribed threshold, "
            "the unit sale price per standard unit shall be declared."
        ),
        "category": "Package Declarations",
    },
    {
        "field_name": "fssai_license",
        "rule_number": "FSS Act 2006 / FSSAI Regulations",
        "rule_text": (
            "Every food business operator shall display the FSSAI license "
            "or registration number on the label of every food product "
            "manufactured, packed, or sold."
        ),
        "category": "Food Safety",
    },
]


def seed():
    with app.app_context():
        # Create tables if they don't exist
        db.create_all()

        added = 0
        skipped = 0
        for rule_data in RULES:
            existing = Rule.query.filter_by(field_name=rule_data["field_name"]).first()
            if existing:
                # Update existing rule
                existing.rule_number = rule_data["rule_number"]
                existing.rule_text = rule_data["rule_text"]
                existing.category = rule_data["category"]
                skipped += 1
            else:
                db.session.add(Rule(**rule_data))
                added += 1

        db.session.commit()
        print(f"[OK] Seeded rules table: {added} added, {skipped} updated.")
        print(f"  Total rules in DB: {Rule.query.count()}")


if __name__ == "__main__":
    seed()
