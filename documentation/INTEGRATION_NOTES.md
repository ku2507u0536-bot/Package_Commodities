# LegalMet — Integration Notes

## Architecture (real, wired, end-to-end)

```
Image
 -> OpenCV            backend/services/image_processing.py       (unchanged)
 -> PaddleOCR          backend/services/ocr.py                    (unchanged)
 -> Regex extraction   backend/services/regex_extraction.py        (unchanged; copy of bundleA/Backend/llm_module.py)
 -> Adapter            backend/services/pipeline.py (new, ~15 lines of actual mapping)
 -> Rule Engine         backend/compliance/{engine,rules_2011_v1,schemas}.py  (unchanged; copy of SIH_project)
 -> Supabase            backend/compliance/database.py             (unchanged; copy of SIH_project)
 -> Frontend            app/inspection/new/page.tsx (unchanged) via lib/api.ts (repointed)
```

## Data contract

Regex output keys already matched almost all of `compliance/service.py`'s
`parse_product_input()` input keys. Only one rename was needed:

```
regex "mfg_date"  ->  rule-engine "manufacture_date"
```

Everything else (`product_name`, `manufacturer`, `address`, `net_quantity`,
`mrp`, `consumer_care`, `country_of_origin`, `unit_sale_price`) passes
through unchanged. See `backend/services/pipeline.py::adapt_regex_output_to_rule_engine_input`.

## Endpoints (backend/main.py, port 8000)

- `POST /inspection/analyze` — canonical full pipeline, image in, saved Supabase result out.
- `POST /inspection/analyze-text` — same pipeline minus OpenCV/OCR steps; kept so the
  existing 7-step wizard UI (`app/inspection/new/page.tsx`), which already calls
  `performOCR()` then `analyzeText()` as two separate stages, needed **zero changes**.
- `POST /inspection/test-compliance` — independent Rule Engine + Supabase test endpoint
  (kept from SIH_project System B).
- `GET /inspection/{id}`, `GET /health` — unchanged in spirit from SIH_project's `api.py`.

## Known external limitation

This project was integrated inside a sandboxed dev environment whose network
egress only allow-lists a short list of package-registry domains. Two things
could not be live-tested there as a result:

1. **Supabase writes** — `scuatokrogdgwnydhwkm.supabase.co` is not on the
   sandbox's allow-list. Every write attempt returned the proxy's own
   `Host not in allowlist` error (not a Supabase error). The code path was
   verified up to that point (regex -> adapter -> rule engine all produced
   correct results), and the endpoints correctly return `success:false,
   saved:false` with an HTTP 5xx instead of a fabricated success — this was
   tested and confirmed.
2. **PaddleOCR model download** — PaddleOCR/PaddleX downloads its model
   weights from its own hosting platform at first use, which is likewise
   not on the sandbox's allow-list (`Exception: No available model hosting
   platforms detected`). `paddleocr`/`paddlepaddle` installed fine from PyPI;
   only the runtime model fetch is blocked here.

On a normal machine/network (which is what `start.bat` / local dev targets),
neither of these applies — both hosts are ordinary public internet endpoints.

## Legacy component

`legacy-flask-service/` (`app.py`, SQLite) is still used by the frontend's
History / Rules / Analytics / Reports pages (`lib/api.ts` functions other
than `performOCR`/`analyzeText`), which were **out of scope** for this
integration pass. Only the new-inspection flow was migrated to the
Regex -> Rule Engine -> Supabase path. Start it separately on port 5000
if you want those pages to keep working.
