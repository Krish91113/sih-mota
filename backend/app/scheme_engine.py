"""Deterministic scheme rule and version services; no scheme-specific criteria live here."""
import re
from datetime import date, datetime
from operator import eq, ge, gt, le, lt, ne
from typing import Any

from app.core.errors import Immutable, InvalidTransition

OPERATORS = {
    "EQUALS": eq,
    "NOT_EQUALS": ne,
    "GREATER_THAN": gt,
    "LESS_THAN": lt,
    "GREATER_THAN_OR_EQUAL": ge,
    "LESS_THAN_OR_EQUAL": le,
}


def read_path(payload: Any, path: str | None) -> Any:
    if not path or not isinstance(payload, dict):
        return None
    value = payload
    for part in path.split("."):
        if isinstance(value, dict):
            value = value.get(part)
        else:
            return None
    return value


def _parse_date(val: Any) -> date | None:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    if isinstance(val, str):
        cleaned = val.strip().split("T")[0]
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y"):
            try:
                return datetime.strptime(cleaned, fmt).date()
            except ValueError:
                continue
    return None


def _normalize_str(val: Any) -> str:
    if val is None:
        return ""
    text = str(val).strip().lower()
    return re.sub(r"\s+", " ", text)


def evaluate_rule(rule: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    op = rule["operator"]
    observed = read_path(payload, rule.get("field"))
    expected = rule.get("value")
    explanation = None

    if op == "EXISTS":
        passed = observed is not None
    elif op == "NOT_EXISTS":
        passed = observed is None
    elif op == "IN":
        passed = observed in (expected or []) if isinstance(expected, (list, tuple, set)) else False
    elif op == "NOT_IN":
        passed = observed not in (expected or []) if isinstance(expected, (list, tuple, set)) else True
    elif op == "BETWEEN":
        passed = (
            expected[0] <= observed <= expected[1]
            if (isinstance(expected, (list, tuple)) and len(expected) >= 2 and observed is not None)
            else False
        )
    elif op == "DATE_BEFORE":
        obs_d, exp_d = _parse_date(observed), _parse_date(expected)
        passed = (obs_d is not None and exp_d is not None and obs_d < exp_d)
        explanation = f"Observed date '{obs_d}' before expected date '{exp_d}': {passed}"
    elif op == "DATE_AFTER":
        obs_d, exp_d = _parse_date(observed), _parse_date(expected)
        passed = (obs_d is not None and exp_d is not None and obs_d > exp_d)
        explanation = f"Observed date '{obs_d}' after expected date '{exp_d}': {passed}"
    elif op == "MATCH":
        if observed is None or expected is None:
            passed = False
        else:
            norm_obs = _normalize_str(observed)
            norm_exp = _normalize_str(expected)
            passed = (norm_obs == norm_exp)
            if not passed and isinstance(expected, str):
                try:
                    passed = bool(re.search(expected, str(observed), re.IGNORECASE))
                except re.error:
                    passed = False
        explanation = f"Match '{observed}' with '{expected}': {passed}"
    elif op == "CROSS_DOCUMENT_MATCH":
        target_path = rule.get("compare_field") or rule.get("target_field") or rule.get("value")
        if isinstance(target_path, str) and read_path(payload, target_path) is not None:
            expected = read_path(payload, target_path)
        else:
            expected = target_path

        obs_d, exp_d = _parse_date(observed), _parse_date(expected)
        if obs_d is not None and exp_d is not None:
            passed = (obs_d == exp_d)
        elif observed is not None and expected is not None:
            passed = (_normalize_str(observed) == _normalize_str(expected))
        else:
            passed = (observed == expected and observed is not None)

        explanation = (
            f"Cross-document match between '{rule.get('field')}' ({observed}) and "
            f"'{target_path}' ({expected}): {'MATCH' if passed else 'MISMATCH'}"
        )
    elif op in ("AND", "OR"):
        results = [evaluate_rule(item, payload)["passed"] for item in rule.get("rules", [])]
        passed = all(results) if op == "AND" else any(results)
    elif op == "NOT":
        passed = not evaluate_rule(rule["rule"], payload)["passed"]
    elif op in OPERATORS:
        passed = (
            OPERATORS[op](observed, expected)
            if (observed is not None and expected is not None)
            else False
        )
    else:
        passed = False

    res = {
        "rule_id": rule.get("rule_id"),
        "rule_name": rule.get("name") or rule.get("rule_name"),
        "field": rule.get("field"),
        "operator": op,
        "observed_value": observed,
        "expected_value": expected,
        "passed": passed,
        "source_reference": rule.get("source_reference"),
        "scheme_version": rule.get("scheme_version_id"),
    }
    if explanation is not None:
        res["explanation"] = explanation
    return res


def evaluate_rules(rules: list[dict[str, Any]], payload: dict[str, Any]) -> dict[str, Any]:
    results = [evaluate_rule(rule, payload) for rule in rules]
    return {
        "result": "ELIGIBLE" if all(x["passed"] for x in results) else "INELIGIBLE",
        "rules": results,
    }


def assert_mutable(version: Any) -> None:
    if version.status == "PUBLISHED":
        raise Immutable("Published scheme versions are immutable")


def next_status(current: str, target: str, transitions: dict[str, list[str]]) -> str:
    if target not in transitions.get(current, []):
        raise InvalidTransition(f"Cannot transition from {current} to {target}")
    return target

