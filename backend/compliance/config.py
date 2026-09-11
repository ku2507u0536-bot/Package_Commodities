"""
Shared constants for the Legal Metrology Rule Engine.
"""

# Below this confidence, we never trust an AI/OCR-extracted value enough
# to make a legal PASS/FAIL call on it -> REVIEW_REQUIRED instead.
CONFIDENCE_THRESHOLD = 0.6

# Legal Metrology (Packaged Commodities) Rules only recognize these
# standard metric units for net quantity declarations.
VALID_QUANTITY_UNITS = {"g", "kg", "ml", "l", "number"}
