"""Deterministic scheme rule and version services; no scheme-specific criteria live here."""
from datetime import date, datetime
from operator import eq, ne, gt, lt, ge, le
from app.core.errors import InvalidTransition, Immutable
OPERATORS={"EQUALS":eq,"NOT_EQUALS":ne,"GREATER_THAN":gt,"LESS_THAN":lt,"GREATER_THAN_OR_EQUAL":ge,"LESS_THAN_OR_EQUAL":le}
def read_path(payload, path):
    value=payload
    for part in path.split('.'):
        if isinstance(value,dict): value=value.get(part)
        else: return None
    return value
def evaluate_rule(rule, payload):
    op=rule["operator"]; observed=read_path(payload,rule["field"]); expected=rule.get("value")
    if op=="EXISTS": passed=observed is not None
    elif op=="NOT_EXISTS": passed=observed is None
    elif op=="IN": passed=observed in expected
    elif op=="NOT_IN": passed=observed not in expected
    elif op=="BETWEEN": passed=expected[0] <= observed <= expected[1]
    elif op in ("AND","OR"):
        results=[evaluate_rule(item,payload)["passed"] for item in rule.get("rules",[])]
        passed=all(results) if op=="AND" else any(results)
    elif op=="NOT": passed=not evaluate_rule(rule["rule"],payload)["passed"]
    elif op in OPERATORS: passed=OPERATORS[op](observed,expected)
    else: passed=False
    return {"rule_id":rule.get("rule_id"),"rule_name":rule.get("name"),"operator":op,"observed_value":observed,"expected_value":expected,"passed":passed,"source_reference":rule.get("source_reference"),"scheme_version":rule.get("scheme_version_id")}
def evaluate_rules(rules,payload):
    results=[evaluate_rule(rule,payload) for rule in rules]
    return {"result":"ELIGIBLE" if all(x["passed"] for x in results) else "INELIGIBLE","rules":results}
def assert_mutable(version):
    if version.status=="PUBLISHED": raise Immutable("Published scheme versions are immutable")
def next_status(current, target, transitions):
    if target not in transitions.get(current,[]): raise InvalidTransition(f"Cannot transition from {current} to {target}")
    return target
