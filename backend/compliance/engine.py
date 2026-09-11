"""
The Rule Engine itself: runs one versioned set of deterministic checks
against ExtractedFields and produces a ComplianceReport.

This is the ONLY component in the whole pipeline allowed to decide
PASS / FAIL / REVIEW_REQUIRED. OCR and the AI extraction step feed data
IN here — they never see or override what comes OUT.
"""

from .schemas import ExtractedFields, ComplianceReport
from . import rules_2011_v1

# Registry of every rule set version this system knows about.
# Add a new entry here when the law is amended — never delete old ones,
# so a scan from 2024 keeps citing the rule version active in 2024.
RULE_REGISTRY = {
    rules_2011_v1.RULE_VERSION: rules_2011_v1.CHECKS,
}

DEFAULT_RULE_VERSION = rules_2011_v1.RULE_VERSION


def run_rule_engine(
    fields: ExtractedFields,
    rule_version: str = DEFAULT_RULE_VERSION,
) -> ComplianceReport:
    if rule_version not in RULE_REGISTRY:
        raise ValueError(
            f"Unknown rule version '{rule_version}'. "
            f"Known versions: {list(RULE_REGISTRY.keys())}"
        )

    checks = RULE_REGISTRY[rule_version]
    results = [check(fields) for check in checks]

    statuses = {r.status for r in results}
    if "FAIL" in statuses:
        overall = "FAIL"
    elif "REVIEW_REQUIRED" in statuses:
        overall = "REVIEW_REQUIRED"
    else:
        overall = "PASS"

    return ComplianceReport(
        rule_version=rule_version,
        overall_status=overall,
        fields=results,
    )
