"""
Database layer — talks to Supabase.

This file is intentionally the ONLY place in the whole project that knows
Supabase exists. The rule engine (schemas.py, engine.py, rules_2011_v1.py)
never imports this file and never will — it just returns plain Python
objects. This module's only job is: take a ComplianceReport that's already
been decided, and save it.

Setup (one-time):
  1. pip install supabase python-dotenv
  2. Copy .env.example to .env and paste your real Supabase URL + key into it
     (Supabase dashboard -> Project Settings -> API)
  3. Run the SQL in schema.sql (see this project) inside Supabase's SQL editor
     to create the "scans" and "compliance_results" tables, ONCE.
"""

import os
import uuid
from datetime import datetime, timezone

from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client, Client

from .schemas import ComplianceReport

_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=_env_path)
load_dotenv()  # also fallback to current working directory

_client: Client | None = None


def get_client() -> Client:
    """Creates the Supabase client once and reuses it (avoids reconnecting
    on every call)."""
    global _client
    if _client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL / SUPABASE_KEY not set. "
                "Copy .env.example to .env and fill in your real credentials."
            )
        _client = create_client(url, key)
    return _client


def save_compliance_report(
    report: ComplianceReport,
    scan_id: str | None = None,
    product_name: str | None = None,
) -> str:
    """
    Saves a ComplianceReport to Supabase.

    Writes one row to `scans` (the overall verdict) and one row per field
    to `compliance_results` (the detailed breakdown) — matching the
    two-table schema from schema.sql.

    Returns the scan_id used (auto-generated if you don't pass one).
    """
    client = get_client()
    scan_id = scan_id or str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    # 1) Save the overall scan record.
    client.table("scans").insert({
        "scan_id": scan_id,
        "product_name": product_name,
        "rule_version": report.rule_version,
        "overall_status": report.overall_status,
        "created_at": now,
    }).execute()

    # 2) Save each field's individual verdict.
    field_rows = [
        {
            "scan_id": scan_id,
            "field": f.field,
            "status": f.status,
            "rule_ref": f.rule_ref,
            "reason": f.reason,
            "value": f.value,
        }
        for f in report.fields
    ]
    if field_rows:
        client.table("compliance_results").insert(field_rows).execute()

    return scan_id


def get_scan_history(limit: int = 50) -> list[dict]:
    """Fetches recent scans for the dashboard/scan-history screen."""
    client = get_client()
    response = (
        client.table("scans")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return response.data


def get_report(scan_id: str) -> dict:
    """Fetches one scan plus all its field-level results, for the
    Compliance Result / Report screens."""
    client = get_client()
    scan = client.table("scans").select("*").eq("scan_id", scan_id).single().execute()
    fields = (
        client.table("compliance_results")
        .select("*")
        .eq("scan_id", scan_id)
        .execute()
    )
    return {"scan": scan.data, "fields": fields.data}
