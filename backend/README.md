# MoTA Scholarship Backend

Production-structured FastAPI modular monolith implementing the backend contract in `Backend_FRD.md`.

## Run locally

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
copy .env.example .env
alembic upgrade head
python scripts/seed.py
uvicorn app.main:app --reload
```

Swagger: `http://localhost:8000/docs`.

Provider configuration is documented by `.env.example`. Development defaults are mock storage and mock email. Use Gmail SMTP with an App Password; do not use a normal Gmail password.

## Docker

`docker compose up --build` starts PostgreSQL and the API. No Redis, Celery, Kafka, or external government credentials are required.

## Design notes

- PostgreSQL is the default source of truth; documents are metadata only and are accessed through a storage abstraction.
- Scheme configuration, form definitions, workflow payloads and rules are data-driven; no NFST/NOS criteria are embedded.
- AI and government services are explicit mock/unavailable boundaries.
- Storage provider selection uses `STORAGE_PROVIDER=mock|imagekit`; email uses `EMAIL_PROVIDER=mock|smtp`. Real ImageKit and Gmail SMTP credentials are read only from environment variables.
- Consequential mutations write append-only audit records.
- Use `X-Request-ID` to correlate requests. API errors use `{success,error,request_id}`.
