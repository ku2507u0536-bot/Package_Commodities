# rule_engine.py
# ---------------------------------------------------------------------------
# Compliance-checking engine based on Legal Metrology (Packaged Commodities)
# Rules, 2011.
#
# The actual rule texts and numbers live in the database `rules` table
# (populated separately by a teammate).  This module only contains the
# *logic* that compares extracted label data against those rules.
# ---------------------------------------------------------------------------

# Fields that MUST appear on every pre-packaged commodity label.
REQUIRED_FIELDS = [
    "net_quantity",
    "mrp",
    "manufacturer",
    "consumer_care",
    "mfg_date",
]


# Standard order for Legal Metrology declaration checks
PREFERRED_RULE_ORDER = [
    "net_quantity",
    "mrp",
    "unit_sale_price",
    "manufacturer",
    "address",
    "consumer_care",
    "mfg_date",
    "best_before",
    "country_of_origin",
    "fssai_license",
]


def check_compliance(data: dict, rules_lookup: dict) -> list:
    """
    Compare extracted label data against Legal Metrology rules.

    Parameters
    ----------
    data : dict
        Structured label data produced by `structure_label_data()`.
        Keys are field names; values are extracted strings or None.
    rules_lookup : dict
        Mapping of field_name → Rule row (as dict) fetched from the DB.
        Example: {"net_quantity": {"id": 1, "rule_number": "6(1)(a)", ...}}

    Returns
    -------
    list[dict]
        One entry per evaluated field with keys:
        field, status ("Present" | "Missing"), rule, rule_id, value.
    """
    if not isinstance(data, dict):
        data = {}

    # If rules_lookup has database rules, evaluate all registered rules
    # Otherwise fallback to baseline REQUIRED_FIELDS (e.g. for standalone unit tests)
    if rules_lookup:
        fields_to_check = [f for f in PREFERRED_RULE_ORDER if f in rules_lookup]
        for f in rules_lookup:
            if f not in fields_to_check:
                fields_to_check.append(f)
    else:
        fields_to_check = REQUIRED_FIELDS

    is_small_pkg = data.get("is_small_package", False)

    report = []
    for field in fields_to_check:
        value = data.get(field)
        is_present = value is not None and str(value).strip() != ""

        # Handle Legal Metrology Rule 26 exemption for small packages (<= 10g / <= 10ml)
        if field == "unit_sale_price" and not is_present and is_small_pkg:
            is_present = True
            value = "Exempt (Rule 26: <= 10g/ml)"

        rule_info = rules_lookup.get(field, {})

        report.append({
            "field": field,
            "status": "Present" if is_present else "Missing",
            "rule": rule_info.get("rule_text", "Rule reference pending"),
            "rule_id": rule_info.get("id"),
            "value": value if is_present else None,
        })

    return report


def compliance_score(report: list) -> float:
    """
    Calculate the compliance score as the percentage of required fields
    that are present, rounded to one decimal place.

    Parameters
    ----------
    report : list[dict]
        Output of `check_compliance()`.

    Returns
    -------
    float
        0.0 – 100.0
    """
    if not report:
        return 0.0

    total = len(report)
    present = sum(1 for item in report if item.get("status") == "Present")
    return round((present / total) * 100.0, 1)


def overall_status(score: float) -> str:
    """
    Derive a human-readable overall status from the numeric score.

    Parameters
    ----------
    score : float
        Compliance score (0.0 – 100.0).

    Returns
    -------
    str
        "Compliant", "Needs Review", or "Non-Compliant".
    """
    if score == 100.0:
        return "Compliant"
    elif score >= 60.0:
        return "Needs Review"
    else:
        return "Non-Compliant"
