# Legal Metrology Rule Engine

A standalone, deterministic module. No AI calls happen inside this folder —
it only judges data that's already been extracted by OCR/Gemini upstream.

## Files

- `config.py` — confidence threshold, valid units
- `schemas.py` — `ExtractedFields` (input), `FieldResult`/`ComplianceReport` (output)
- `rules_2011_v1.py` — one check function per Rule 6 clause + `RULE_VERSION`
- `engine.py` — `run_rule_engine()`, plus `RULE_REGISTRY` for versioning
- `test_engine.py` — 3 runnable demo cases (PASS / FAIL / REVIEW_REQUIRED)

## Quick start

```bash
python -m SIH_project.test_engine
```

## Wiring it into the FastAPI pipeline

```python
from rule_engine import ExtractedFields, run_rule_engine

@app.post("/check-compliance")
def check_compliance(scan_id: str):
    fields = load_gemini_extraction(scan_id)  # -> ExtractedFields
    report = run_rule_engine(fields)          # deterministic, versioned
    save_report(scan_id, report)
    return report.to_dict()
```

## Adding a new mandatory field

1. Add the field(s) + a `_confidence` float to `ExtractedFields` in `schemas.py`.
2. Write one `check_<field>(f: ExtractedFields) -> FieldResult` function in
   `rules_2011_v1.py`, following the existing pattern:
   - confidence below `CONFIDENCE_THRESHOLD` → `REVIEW_REQUIRED`
   - value missing/invalid → `FAIL` with a `reason` and the exact `rule_ref`
   - otherwise → `PASS`
3. Add the function to the `CHECKS` list.

## Handling a future amendment to the Rules

**Never edit an existing rule file.** Copy `rules_2011_v1.py` to
`rules_2011_v2.py`, change what the amendment changed, give it a new
`RULE_VERSION` string, and register it in `engine.py`'s `RULE_REGISTRY`.
Old scans keep citing whichever version was active when they ran — nothing
about historical audit results ever silently changes.
