"""Exercise every REST operation in the OpenAPI document.

The goal is crash detection, not business-rule validation: a non-2xx response
means a guard (role, prerequisite, transition, not-found) worked, while a 5xx
means an unhandled exception in the handler. Each operation is invoked with a
convincing path parameter, query string and JSON body derived from the OpenAPI
schema so the handler body actually executes.

The fixture builds a dedicated SQLite database and overrides ``get_db`` so the
sweep never touches the shared ``test-suite.db`` used by the other modules.
"""
from __future__ import annotations

import os
import pathlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("STORAGE_PROVIDER", "mock")
os.environ.setdefault("EMAIL_PROVIDER", "mock")
os.environ.setdefault("FINANCE_PROVIDER", "mock")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, select  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.main import app  # noqa: E402
from app.core.audit import AuditLog  # noqa: E402
from app.core.database import Base, get_db  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.domain.models import User  # noqa: E402
from tests.smoke_seed import Seeder  # noqa: E402

SMOKE_DB = pathlib.Path(__file__).resolve().parent.parent / "endpoint-smoke.db"
TOKEN: str = ""
IDS: dict[str, list[str]] = {}
ADMIN_EMAIL = "smoke-admin@example.com"
ADMIN_PASSWORD = "Smoke@12345"

# Endpoints excluded from the sweep. Auth routes are covered by dedicated
# tests; the rest mutate the caller's own session or credentials and would
# invalidate the bearer token used by every subsequent call in the sweep.
SKIP_OPERATIONS = {
    ("POST", "/api/v1/auth/login"),
    ("POST", "/api/v1/auth/register"),
    ("POST", "/api/v1/auth/logout"),
    ("POST", "/api/v1/auth/refresh"),
    ("POST", "/api/v1/auth/change-password"),
    ("POST", "/api/v1/auth/forgot-password"),
    ("POST", "/api/v1/auth/request-otp"),
    ("POST", "/api/v1/auth/verify-otp"),
    ("POST", "/api/v1/auth/resend-otp"),
    ("POST", "/api/v1/auth/sessions/{session_id}/revoke"),
}


def _singular(segment: str) -> str:
    segment = segment.strip("/")
    if not segment:
        return ""
    if segment.endswith("ies"):
        return segment[:-3] + "y"
    if segment.endswith("sses") or segment.endswith("shes") or segment.endswith("ches"):
        return segment[:-2]
    if segment.endswith("s") and not segment.endswith("ss"):
        return segment[:-1]
    return segment


PARAM_TABLE_OVERRIDES = {
    "user_id": "users",
    "to_user_id": "users",
    "from_user_id": "users",
    "assignee_id": "users",
    "officer_id": "users",
    "author_id": "users",
    "approver_id": "users",
    "actor_id": "users",
    "reviewed_by": "users",
    "verified_by": "users",
    "created_by": "users",
    "resolved_by": "users",
    "raised_by": "users",
    "responded_by": "users",
    "awarded_by": "users",
    "payee_user_id": "users",
    "applicant_user_id": "users",
    "finalized_by": "users",
    "member_id": "users",
    "granted_by": "users",
    "assigned_by": "users",
    "uploaded_by": "users",
    "version_id": "scheme_versions",
    "application_version_id": "application_versions",
    "parent_id": "institutions",
    "child_id": "institutions",
    "key": "system_configurations",
    "code": "schemes",
    "grievance_id": "grievances",
    "trace_id": "decision_traces",
    "installment_id": "finance_installments",
    "record_id": "finance_records",
    "round_id": "selection_rounds",
    "candidate_id": "selection_candidates",
    "correction_id": "selection_corrections",
    "award_id": "awards",
    "review_id": "scrutiny_reviews",
    "workflow_id": "workflows",
}

# Route collections whose table name is not a simple singular/plural of the URL
# segment. Keys are normalized (hyphens replaced by underscores).
COLLECTION_TABLE_ALIASES = {
    "calendars": ["working_calendars"],
    "evidence": ["evidences"],
    "documents": ["documents"],
    "users": ["users"],
    "records": ["finance_records", "audit_logs"],
    "exceptions": ["payment_exceptions"],
    "assignments": ["application_assignments", "workflow_assignments"],
    "workflow_assignments": ["workflow_assignments"],
    "installments": ["finance_installments"],
    "notifications": ["notifications"],
    "templates": ["notification_templates"],
    "workflows": ["workflows"],
    "history": ["payment_status_history", "application_status_history"],
}


def _resolve_param(name: str, path: str) -> str:
    """Return a real primary key for a path parameter, or a random UUID.

    ``name`` may be a field-style name (``assignee_id``) or the collection
    segment that owns a bare ``{id}`` (``application``). Both forms are turned
    into candidate table names and the first one that the seeder populated
    wins.
    """
    candidates: list[str] = []
    if name in PARAM_TABLE_OVERRIDES:
        candidates.append(PARAM_TABLE_OVERRIDES[name])
    if name.endswith("_id"):
        stem = name[:-3]
        candidates.extend([stem + "s", _singular(stem) + "s"])
    else:
        candidates.extend([name, name + "s", _singular(name) + "s"])

    for table in candidates:
        if IDS.get(table):
            return IDS[table][0]
    return str(uuid.uuid4())


def _table_for_collection(collection: str, parent: str) -> list[str]:
    """Candidate table names for the collection segment that owns a ``{id}``."""
    normalized = collection.replace("-", "_")
    candidates = [normalized, normalized + "s", _singular(normalized) + "s"]
    if parent:
        prefix = parent.replace("-", "_")
        candidates.extend([f"{prefix}_{normalized}", f"{prefix}_{_singular(normalized)}s"])
    candidates.extend(COLLECTION_TABLE_ALIASES.get(normalized, []))
    return candidates


def _resolve_path(path: str) -> str:
    segments = path.strip("/").split("/")
    collection = ""
    parent = ""
    out: list[str] = []
    for segment in segments:
        if segment.startswith("{") and segment.endswith("}"):
            name = segment[1:-1]
            if name in ("id", "ident"):
                for table in _table_for_collection(collection, parent):
                    if IDS.get(table):
                        out.append(IDS[table][0])
                        break
                else:
                    out.append(str(uuid.uuid4()))
            else:
                out.append(_resolve_param(name, path))
        else:
            if collection:
                parent = collection
            collection = segment
            out.append(segment)
    return "/" + "/".join(out)


def _resolve_ref(spec: Any, schema_store: dict) -> Any:
    if isinstance(spec, dict) and "$ref" in spec:
        return schema_store.get(spec["$ref"].rsplit("/", 1)[-1], {})
    return spec if isinstance(spec, dict) else {}


def _sample(name: str, schema: dict, depth: int = 0) -> Any:
    if not isinstance(schema, dict) or depth > 4:
        return None
    if "enum" in schema and schema["enum"]:
        return schema["enum"][0]
    if "default" in schema:
        return schema["default"]
    for combinator in ("anyOf", "oneOf", "allOf"):
        if combinator in schema:
            for option in schema[combinator]:
                resolved = option
                if "$ref" in resolved:
                    return _sample(name, {"type": "object"}, depth)
                merged = dict(resolved)
                merged.setdefault("type", "string")
                if merged.get("type") == "object":
                    return _sample(name, merged, depth + 1)
                return _sample(name, merged, depth + 1)
    if "$ref" in schema:
        return _sample(name, {}, depth + 1)

    fmt = schema.get("format")
    kind = schema.get("type")
    if kind == "array":
        return []
    if kind == "object" or "properties" in schema:
        return {
            prop: _sample(prop, sub or {}, depth + 1)
            for prop, sub in (schema.get("properties") or {}).items()
        }
    if kind == "boolean":
        return True
    if kind == "integer":
        return 1
    if kind == "number":
        return 100.0
    if fmt == "date-time":
        return (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    if fmt == "date":
        return (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat()
    if fmt == "email":
        return f"{uuid.uuid4().hex[:10]}@example.com"
    if fmt == "uri" or fmt == "url":
        return "https://example.test/resource"
    if fmt == "binary":
        return None

    lowered = name.lower()
    if "email" in lowered:
        return f"{uuid.uuid4().hex[:10]}@example.com"
    if "password" in lowered:
        return "Seed@12345"
    if "token" in lowered:
        return "seed-token"
    if "status" in lowered:
        return "ACTIVE"
    if "role" in lowered:
        return "SUPER_ADMIN"
    if "amount" in lowered:
        return 1000.0
    if "phone" in lowered:
        return "9999999999"
    if "id" == lowered:
        return str(uuid.uuid4())
    return f"seed-{uuid.uuid4().hex[:8]}"


def _build_body(operation: dict, schemas: dict) -> tuple[Any, dict]:
    """Return (json_body, files) for an operation, or (None, {}) if none needed."""
    body_spec = operation.get("requestBody")
    if not body_spec:
        return None, {}
    content = body_spec.get("content") or {}
    if "multipart/form-data" in content:
        schema = _resolve_ref((content["multipart/form-data"].get("schema") or {}), schemas)
        files = {}
        data = {}
        for prop, sub in (schema.get("properties") or {}).items():
            sub = _resolve_ref(sub, schemas) if "$ref" in sub else sub
            if sub.get("format") == "binary" or sub.get("type") == "string" and sub.get("format") == "binary":
                files[prop] = (f"{prop}.txt", b"seed-content", "text/plain")
            else:
                data[prop] = _sample(prop, sub)
        for prop in (schema.get("required") or []):
            if prop not in files and prop not in data:
                data[prop] = _sample(prop, (schema.get("properties") or {}).get(prop, {}))
        return None, {"files": files, "data": data}
    if "application/json" in content:
        schema = _resolve_ref((content["application/json"].get("schema") or {}), schemas)
        if not schema:
            return {}, {}
        if schema.get("type") == "object" and not schema.get("required") and not schema.get("properties"):
            # Bare dict/record body.
            return {"data": {"seeded": True}}, {}
        body = {}
        properties = schema.get("properties") or {}
        required = schema.get("required") or list(properties)[:4]
        for prop in required:
            body[prop] = _sample(prop, properties.get(prop, {}))
        return body, {}
    return {}, {}


def _query_params(operation: dict, schemas: dict) -> dict:
    params = {}
    for param in operation.get("parameters") or []:
        param = _resolve_ref(param, schemas)
        if param.get("in") != "query":
            continue
        if param.get("required"):
            params[param["name"]] = _sample(param["name"], param.get("schema") or {})
    return params


def _iter_operations(schema: dict):
    for path, methods in schema["paths"].items():
        for method, operation in methods.items():
            if method in ("get", "post", "put", "patch", "delete"):
                yield path, method.upper(), operation


@pytest.fixture(scope="module")
def client():
    """Build an isolated database and point the app's ``get_db`` at it."""
    SMOKE_DB.unlink(missing_ok=True)
    smoke_engine = create_engine(
        f"sqlite:///{SMOKE_DB.as_posix()}", connect_args={"check_same_thread": False}
    )
    SmokeSession = sessionmaker(bind=smoke_engine, autoflush=False, expire_on_commit=False)

    def _smoke_session():
        db = SmokeSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _smoke_session
    Base.metadata.drop_all(bind=smoke_engine)
    Base.metadata.create_all(bind=smoke_engine)
    try:
        with SmokeSession() as db:
            seeder = Seeder(db, per_table=2)
            seeder.seed_all()
            IDS.update(seeder.ids)
            admin = db.scalar(select(User).where(User.role == "SUPER_ADMIN"))
            if admin is None:
                admin = User(
                    email=ADMIN_EMAIL,
                    password_hash=hash_password(ADMIN_PASSWORD),
                    role="SUPER_ADMIN",
                    full_name="Seed Admin",
                )
                db.add(admin)
            else:
                admin.email = ADMIN_EMAIL
                admin.password_hash = hash_password(ADMIN_PASSWORD)
                admin.role = "SUPER_ADMIN"
                admin.is_active = True
            db.commit()
        yield TestClient(app, raise_server_exceptions=False)
    finally:
        app.dependency_overrides.pop(get_db, None)
        Base.metadata.drop_all(bind=smoke_engine)
        smoke_engine.dispose()
        SMOKE_DB.unlink(missing_ok=True)


@pytest.fixture(scope="module")
def token(client):
    response = client.post("/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert response.status_code == 200, response.text
    return response.json()["data"]["access_token"]


def test_openapi_document_is_valid(client, token):
    schema = client.get("/openapi.json").json()
    assert schema["openapi"].startswith("3.")
    duplicates: dict[tuple[str, str], list[str]] = {}
    for route in app.routes:
        for method in getattr(route, "methods", None) or set():
            if method in ("HEAD", "OPTIONS"):
                continue
            duplicates.setdefault((method, route.path), []).append(getattr(route, "name", "?"))
    clashes = {k: v for k, v in duplicates.items() if len(v) > 1}
    assert not clashes, f"duplicate operations registered: {clashes}"


def test_health_endpoints(client, token):
    for path in ("/health", "/api/v1/health"):
        response = client.get(path)
        assert response.status_code in (200, 404), f"{path} -> {response.status_code}"


def test_audit_chain_is_intact(client, token):
    response = client.get("/api/v1/audit/verify", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["valid"] is True, response.text


def test_every_endpoint_is_reachable(client, token, record_property):
    """Destructive sweep; declared last because it mutates seeded state."""
    schema = client.get("/openapi.json").json()
    schemas = {name: definition for name, definition in (schema.get("components", {}).get("schemas") or {}).items()}

    headers = {"Authorization": f"Bearer {token}"}
    failures: list[str] = []
    distribution: dict[int, int] = {}
    reached: list[str] = []
    checked = 0

    for path, method, operation in _iter_operations(schema):
        if (method, path) in SKIP_OPERATIONS or path in ("/openapi.json", "/docs", "/redoc"):
            continue
        url = _resolve_path(path)
        json_body, extra = _build_body(operation, schemas)
        params = _query_params(operation, schemas)

        kwargs: dict[str, Any] = {"headers": headers, "params": params}
        if json_body is not None:
            kwargs["json"] = json_body
        kwargs.update(extra)

        response = client.request(method, url, **kwargs)
        checked += 1
        distribution[response.status_code // 100] = distribution.get(response.status_code // 100, 0) + 1
        if response.status_code < 500:
            reached.append(f"{method} {path} -> {response.status_code}")
        if response.status_code >= 500:
            failures.append(f"{method} {path} -> {response.status_code} {response.text[:300]}")

    print(f"\nchecked={checked} status-class-distribution={sorted(distribution.items())}")
    record_property("checked", checked)
    assert checked > 200, f"only {checked} operations exercised"
    assert not failures, "unhandled server errors:\n" + "\n".join(failures)
