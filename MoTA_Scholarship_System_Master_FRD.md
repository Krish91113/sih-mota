# AI-Enabled Scholarship & Fellowship Management System for Scheduled Tribes
## Master Functional Requirements Document (FRD) — Single Source of Truth

**Ministry:** Ministry of Tribal Affairs (MoTA), Government of India
**Initial Schemes:** National Fellowship for ST Students (NFST), National Overseas Scholarship (NOS)
**Extensible to:** National Scholarship/Top Class, Post-Matric (subject to implementation model)

---

## 1. Purpose & Scope

A centralized platform providing a common digital foundation for MoTA scholarship/fellowship schemes, with scheme-specific eligibility, documents, workflows, selection criteria, and communication templates **configured, not hard-coded**.

**End-to-end lifecycle:** Discover Scheme → Register/Auth → Profile → Eligibility Pre-check → Application → Document Collection → OCR/AI → Rule Validation → Submission → Institution/Officer Verification → Scrutiny → Deficiency Handling → Resubmission → Eligibility Confirmation → Screening/Merit → Selection Committee → Approval → Award → Post-Selection (Renewal/Progress) → Completion.

**Core formula:** Digital application management + configurable rules + workflow orchestration + AI document intelligence + human review + dashboards + full auditability.

---

## 2. Design Context (Evidence Basis)

- NFST portal today: ~750 fresh fellows/year, M.Phil/Ph.D pathways, university verification, DigiLocker, grievance handling, SMS/email, dashboards, fresh/renewal workflows.
- NOS portal today: ~20 fresh awards/year, Master's/Ph.D/Post-Doc abroad, DigiLocker, manual upload fallback, grievance, bulk comms, dashboard.
- MoTA regularly issues new-year notices and amendments (2025–26, 2026–27) → **rules and workflows must be versioned**, never permanently embedded in code.

---

## 3. Objectives

**Must:** Digitize full lifecycle; reduce manual scrutiny; detect missing/deficient documents early; automate deterministic eligibility; use AI for document understanding & officer assistance; keep humans as final decision authority; transparent status tracking; configurable scheme rules; role dashboards; full audit trails; secure gov integrations; analytics; faster turnaround; consistent verification; explainable outcomes.

**Must Not (Non-Objectives):**
- LLM makes final award decision
- Auto-reject solely on AI prediction
- AI invents/infers eligibility criteria not officially configured
- Confidential documents exposed to unauthorized users
- Hard-coded current scheme rules
- Large binaries stored in PostgreSQL
- Microservices for every module
- Single AI vendor dependency
- Any external gov integration marked "live" without authorization/credentials

---

## 4. Users & RBAC

| Role | Responsibility |
|---|---|
| Applicant | Apply, upload docs, track, respond to deficiencies |
| Institution Nodal Officer | Verify institutional/academic info |
| Verification Officer | Verify documents & applicant info |
| Scrutiny Officer | Detailed scrutiny |
| Scheme Manager | Scheme config & operations |
| Selection Committee | Review & recommend |
| Approving Authority | Final approve/reject |
| Finance Officer | Sanction/disbursement |
| Grievance Officer | Handle grievances |
| Helpdesk Agent | User support |
| Monitoring Analyst | Controlled analytics |
| Auditor | Audit/evidence trail access |
| Super Admin | Platform-wide administration |
| System Service Account | Machine-to-machine integration |

**Model:** RBAC + Permission Scopes + Data Scopes. Permission format: `RESOURCE:ACTION:SCOPE` (e.g., `APPLICATION:READ:ASSIGNED`, `SCHEME:CONFIGURE`, `APPROVAL:APPROVE`, `AUDIT:EXPORT`).

**Least Privilege = Role + Permission + Scheme Scope + Org Scope + Geo/Data Scope.**
Example: *Scrutiny Officer → NFST only → Assigned applications only → 2026-27 cycle only.* Must NOT auto-see other schemes, unrelated cycles, all documents, or audit-admin data.

### RBAC Matrix (Summary)
| Capability | Applicant | Institute | Verification | Scrutiny | Scheme Mgr | Committee | Approver | Finance | Grievance | Analyst | Auditor | Super Admin |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Start/Submit Application | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Verify Documents | ✗ | Institution | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Configure Scheme | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Review/Score Selection | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | View | ✗ | ✗ | View | Evidence | ✓ |
| Final Approve | ✗ | ✗ | ✗ | ✗ | ✗ | Recommend | ✓ | ✗ | ✗ | ✗ | ✗ | Emergency only |
| Financial Processing | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | Aggregate | Evidence | ✓ |
| Audit Log Access | Own | Limited | Limited | Limited | Scheme | Limited | Limited | Financial | Complaint | Aggregate | ✓ | ✓ |

GIGW 3.0 mandates RBAC, least privilege, strong auth, secure cookies, encrypted comms, security auditing.

---

## 5. Core Functional Modules

**5.1 Public Portal:** Scheme listing, eligibility overview, deadlines, FAQs, required docs, guidelines, notices, multilingual content. Every scheme page shows: Scheme, Academic/Selection Year, Application Window, Eligibility, Documents, Selection Method, Dates, Guideline Version, FAQs.

**5.2 Authentication & Identity**
- *Applicant:* mobile/email + OTP, password login, account recovery, MFA/step-up, session management.
- *Staff:* mandatory MFA, institutional identity, role assignment/approval, activation/deactivation, session revocation, password policy, failed-login monitoring.
- *Future Gov Identity:* Adapters for DigiLocker, Aadhaar (subject to authorization), Gov SSO — none "live" until authorized.

**5.3 Applicant Profile:** Personal/contact/address/ST info, family & income info, academic history, research info, institution details, bank info, passport (NOS), DigiLocker linkage, comms preferences. Must separate **persistent profile data** from **scheme/application-specific data**.

**5.4 Scheme Management Engine (critical module)**
- Scheme entity: `scheme_id, name, short_code, description, type, department, status, current_version, effective_date, academic_year, application_window`.
- **Versioning is mandatory** — e.g., NFST 2025-26 v1 → Amendment 1 → 2026-27 v1. Every submitted application retains the exact scheme version used at submission time.

**5.5 Configurable Eligibility Engine**
- Rules as data, not code. Example:
```json
{"rule_id":"AGE_001","field":"applicant.age","operator":"LESS_THAN_OR_EQUAL","value":35,
 "source_reference":"OFFICIAL_SCHEME_GUIDELINE","effective_from":"2026-04-01"}
```
- Operators: EQUALS, NOT_EQUALS, GT/LT(+OR_EQUAL), IN, NOT_IN, BETWEEN, EXISTS/NOT_EXISTS, DATE_BEFORE/AFTER, MATCH, CROSS_DOCUMENT_MATCH, BOOLEAN, AND/OR/NOT.
- Output states: `Eligible | Ineligible | Needs Manual Review | Unable to Determine`.
- **Every result must be explainable**: rules evaluated, pass/fail per rule, observed vs. permitted values, source scheme version — visible to officers and (per policy) applicants.

**5.6 Dynamic Application Form Engine:** Forms generated from scheme config (Scheme → Form Definition → Sections → Fields → Conditional Fields → Validation). Field types: text, number, date, dropdown, multiselect, radio, checkbox, file, institution/country/university/course selectors, dynamic table. Supports conditional logic (e.g., Ph.D. flag reveals research/supervisor/institution fields).

**5.7 Application Lifecycle (configurable per scheme):**
`DRAFT → SUBMITTED → SYSTEM_VALIDATION → DOCUMENT_REVIEW → INSTITUTION_VERIFICATION → SCRUTINY → DEFICIENCY_RAISED → RESUBMITTED → ELIGIBILITY_CONFIRMED → SCREENING → SELECTION_REVIEW → PROVISIONALLY_SELECTED → FINAL_APPROVAL → AWARDED → POST_SELECTION → COMPLETED / REJECTED / WITHDRAWN / CLOSED`

**5.8 Application Versioning:** Every material edit creates a revision, preserving original value, revised value, actor, timestamp, reason, and evidence.

**5.9 Document Management:** Upload, metadata, versioning, preview, download, validation, OCR, classification, extraction, verification, rejection, resubmission, archival. Document categories (ST certificate, income certificate, marksheets, degree, admission doc, research proposal, passport, offer letter, bank details, institute verification) are **scheme-configured**, not fixed.

**5.10 Storage (ImageKit — MVP):** Free tier: 3GB storage / 20GB bandwidth / 25MB upload cap. Abstracted via `StorageService` interface (`upload, delete, get_signed_url, get_metadata`) with `ImageKitStorage` implementation; future adapters: `S3Storage`, `GovernmentStorage` — prevents vendor lock-in.

**5.11 Document Security Pipeline:**
`Upload → AuthN → AuthZ → Extension Validation → MIME Validation → Size Validation → Malware Scan → SHA-256 Hash → Store (ImageKit) → DB Metadata → AI Processing`
Never trust client-supplied MIME type alone.

---

## 6. AI Architecture

AI is an **assistance layer**, never the legal decision-maker.
`Document → Preprocessing → OCR/Document AI → Classification → Extraction → Normalization → Cross-Document Validation → Rule Engine → Human Review`

**Capabilities:**
1. **Classification** into configured categories with confidence score; below-threshold results require manual classification (never silently auto-selected).
2. **OCR** via provider-abstracted layer (Azure Document Intelligence / Google Document AI / open-source / future).
3. **Structured Extraction** — each field carries `value, confidence, page, bounding_box, extraction_method, model_version, timestamp`.
4. **Cross-Document Consistency** — compares Application ↔ ST Certificate ↔ Degree ↔ Marksheet ↔ Passport ↔ Admission Letter; flags discrepancies with severity for manual review (never concludes fraud independently).
5. **Document Quality Checks** — blur, crop, low-res, missing pages, rotation, empty/damaged file, duplicate/suspiciously identical upload.
6. **Completeness Detection** — Required vs. Uploaded documents, % complete, missing list.
7. **Officer Copilot** — evidence-linked review summary (eligibility status, document status, AI verification breakdown, flagged issues, confidence, recommended action) with links to source evidence.

### AI Guardrails (mandatory)
1. AI is never the final award authority.
2. AI cannot silently alter application data.
3. AI cannot create eligibility rules.
4. Every AI output carries model/version metadata.
5. Critical decisions traceable to source evidence.
6. Human override always possible, with mandatory reason for consequential decisions.
7. Low-confidence results route to manual review.
8. AI text never presented as an official legal decision.
9. Prompts/extraction schemas are version-controlled.
10. AI outputs are fully auditable.
11. Data sent to external AI providers follows approved data-governance policy.

**Confidence policy (configurable defaults, not regulatory):** ≥95% auto-pass for routine review · 85–94% officer review recommended · 60–84% mandatory manual review · <60% unusable/reprocess.

**Fraud/Risk signals** (duplicate hash, similar docs, repeated cert numbers, inconsistent identity, suspicious metadata, implausible dates) are always **ADVISORY**, never "fraud confirmed."

---

## 7. Human-in-the-Loop & Workflow Modules

- **Institution Portal:** registration, authorized officer management, verify admission/enrollment/programme/research status, respond to requests, institutional grievances.
- **Scrutiny Module:** filterable work queue (scheme, year, state, district, institution, status, priority, AI risk, deficiency, SLA aging); full applicant/application/eligibility/document/AI/verification/audit view.
- **Verification States:** Pending, AI Verified, Human Verified, Rejected, Needs Resubmission, Not Required, Expired, Unable to Verify — with reason codes (missing page, expired cert, name mismatch, unreadable, unsupported doc, inconsistent info).
- **Deficiency Management:** type, description, doc reference, severity, deadline, required action, template → applicant Views/Uploads/Submits/Tracks → officer sees old vs. new doc + AI comparison.
- **SLA Management:** `created_at, due_at, completed_at, SLA_status, escalation_level`, configurable escalation, government working-day calendar (national/dept/scheme holidays, weekend policy).
- **Communication:** In-app/Email/SMS (WhatsApp future); version-controlled templates (submission, deficiency, reminder, approval/rejection, selection outcome, grievance update); bulk comms require permission + audit event.
- **Selection Management:** Eligibility Shortlist → Screening → Merit Calculation → Committee Review → Provisional Selection → Final Approval. Supports slots, category allocations (where applicable), tie handling, reserve/waitlist. Criteria must link to the official scheme version.
- **Merit/Scoring Engine:** criterion, weight, calculation method, min/max, source, effective date — activation requires Scheme Manager authorization + version publication.
- **Selection Committee Workspace:** view assigned candidates, evidence, score breakdown, comments, conflict disclosure, abstain, recommend/not-recommend — member-level actions preserved.
- **Final Approval:** full decision packet (eligibility, scrutiny, verification, AI evidence, score, committee recommendation, deficiency history, audit trail); actions: Approve / Reject (reason code required) / Return for Clarification / Return for Scrutiny.
- **Sanction/Financial Module:** award amount config, sanction generation/reference, beneficiary status, financial approval, disbursement status, reconciliation; PFMS integration as separately authorized project.
- **Post-Selection:** Awarded → Enrollment/Joining → Periodic Compliance → Progress → Renewal → Disbursement Tracking → Completion (scheme-specific fields, e.g. NOS: foreign admission/travel/progress/study status).
- **Grievance Module:** categories (Application, Document, Eligibility, Payment, Selection, Technical, Institution, Communication, Other); ticket with priority/SLA/assigned officer/status/history/resolution/appeal.
- **Helpdesk:** applicant lookup, ticket mgmt, guided troubleshooting, comms history, FAQ, escalation — no unrestricted access to sensitive documents by default.

---

## 8. Audit Trail

Logged events include: LOGIN/LOGOUT, OTP_VERIFIED, APPLICATION_CREATED/SUBMITTED, DOCUMENT_UPLOADED/REPLACED, AI_PROCESSED/AI_RESULT_GENERATED, ELIGIBILITY_EXECUTED, DEFICIENCY_RAISED/RESOLVED, DOCUMENT_VERIFIED/REJECTED, SELECTION_RECOMMENDED, APPLICATION_APPROVED/REJECTED, ROLE_CHANGED, SCHEME_UPDATED, RULE_PUBLISHED, REPORT_EXPORTED.

Record schema: `audit_id, timestamp, user_id, role, action, entity_type, entity_id, before_value_hash, after_value_hash, ip, user_agent, request_id, reason`.

**Immutability:** no user edits audit events; corrections create new linked audit events with reason + administrator + timestamp.

---

## 9. Scheme Configuration Governance

`Create Draft → Configure Rules/Documents/Forms/Workflow → Test → Review → Approve → Publish` — **published versions are immutable**. Amendments: `Clone → Modify → Review → Publish new version` (preserves historical decisions).

**Official Source Registry** links every rule to: scheme, version, rule_id, source_document, source_section/page, effective dates, configured_by, approved_by — critical for auditability.

**High-impact changes** (eligibility rules, selection criteria, document requirements, award values, workflow) should follow dual-control: Scheme Manager creates → Reviewer → Approving Authority → Publish.

---

## 10. Government Integrations

- **DigiLocker:** first-class adapter; consent-based retrieval (`Applicant → Consent → DigiLocker → Authorized Retrieval → Metadata → Verification`); stores `source, document_uri, issuer, document_type, retrieved_at, consent_reference, verification_status`.
- **Aadhaar:** optional controlled adapter only, never a default dependency; no raw Aadhaar storage beyond minimal authorized response; governed by UIDAI regulations.
- **Integration readiness model:** `MOCK → SANDBOX → PRODUCTION` for DigiLocker/PFMS/SMS; every external dependency has a mock implementation for development; no placeholder credentials in code.
- **Adapters:** `IntegrationService` → DigiLockerAdapter, IdentityAdapter, EmailAdapter, SMSAdapter, StorageAdapter, FinanceAdapter, UniversityAdapter.
- **Graceful degradation:** if DigiLocker/AI/SMS/Email/Storage unavailable, core application flow continues via manual paths; AI jobs queue for retry.

---

## 11. Data Protection & Privacy

Governed by DPDP Act 2023 and DPDP Rules 2025 (notified 14 Nov 2025, phased commencement — **do not assume all provisions are in force**; map requirements to applicable effective dates).

**Privacy record per data field:** Notice, Purpose, Data Category, Collection Point, Retention Category, Sharing Purpose, Processor Mapping, Deletion Rule, Consent basis, Legal basis.

**Data minimization:** every field needs business purpose, scheme mapping, data classification, retention classification, access classification — do not collect "just in case."

**Data classification:** PUBLIC (guidelines) · INTERNAL (config) · CONFIDENTIAL (application info) · RESTRICTED (identity/documents/security data).

**Retention:** scheme/policy-configurable (Retention Period, Legal Hold, Archive Period, Deletion Rule, Anonymization Rule) — values sourced from official MoTA/records-management requirements, never invented.

---

## 12. Security

**Baseline standards:** OWASP ASVS 5.0, OWASP Top 10, GIGW 3.0, CIS-aligned infra controls, CERT-In guidance.

**Encryption:** TLS in transit; encrypted storage/DB/backups at rest; secrets never in source code/Git/frontend bundles/plain config — env-based initially, dedicated secrets manager in production.

**Mandatory controls:** HTTPS-only, secure cookies (HttpOnly, SameSite), CSRF protection, strict CORS, MFA (staff), RBAC, rate limiting, login throttling, secure password recovery, input validation, output encoding, SQLi/XSS/SSRF/path-traversal prevention, file-upload validation, malware scanning, API authN/authZ, secret rotation, security logging, vulnerability scanning, dependency updates, environment separation.

**API security chain:** Authentication → Authorization → Scope validation → Resource ownership check → Business-rule validation. Never rely on hidden UI buttons for authorization.

**Secure files:** no public URL enumeration (`/file/1`); signed, short-lived, permission-gated URLs only.

**DB security:** encrypted connections, parameterized queries, role-separated DB users, minimal privileges, enforced FK/unique constraints, append-only audit tables.

**Concurrency:** optimistic locking on application, document, selection, scheme config, approval records. Finalized selection rounds lock; corrections require an Amendment Workflow with reason + approval.

**Security audit readiness:** vulnerability assessment, penetration testing, dependency review, API/auth/upload/infra testing, privacy review — GIGW 3.0 requires security audit clearance before production hosting.

---

## 13. Technology Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js, TypeScript, Tailwind CSS, shadcn/ui, React Hook Form, Zod, TanStack Query, ECharts/Recharts |
| Backend | Python, FastAPI, Pydantic, SQLAlchemy, Alembic |
| Database | PostgreSQL |
| Cache/Jobs | Redis + Celery |
| Object Storage | ImageKit (MVP, behind abstraction) |
| AI | Python, OCR provider abstraction, OpenCV, classification, LLM, structured extraction, matching |
| Auth | OAuth2/OIDC via Keycloak or approved managed IdP |
| API Docs | OpenAPI + Swagger UI |
| Deployment | Docker, Nginx, GitHub Actions |
| Monitoring | Sentry, Prometheus, Grafana |
| Security | OWASP ASVS 5.0, OWASP Top 10, GIGW 3.0, CERT-In |

**Backend structure:** Modular monolith (not microservices) with modules: auth, users, applicants, institutions, schemes, applications, documents, eligibility, verification, workflow, deficiencies, scrutiny, selection, approvals, finance, notifications, grievances, analytics, audit, ai.

**AI worker pipeline:** FastAPI → AI Job → Redis/Celery → AI Worker (Preprocessor → OCR Adapter → Classifier → Extractor → Validator → Matcher → Summary Generator).

**Async processing (Celery/Redis) for:** OCR, classification, extraction, cross-document comparison, bulk notification, large reports, virus scanning, batch eligibility. Kafka deferred to future scale, not introduced prematurely.

---

## 14. Core Data Model (entities)

```
users, roles, permissions, user_roles, role_permissions
applicants, applicant_profiles
institutions, institution_users
schemes, scheme_versions, scheme_rules, scheme_documents, scheme_workflows, scheme_forms, scheme_selection_criteria
applications, application_versions, application_answers, application_status_history
documents, document_versions, document_extractions, document_verifications, document_flags
eligibility_runs, eligibility_results, eligibility_rule_results
deficiencies, deficiency_responses
scrutiny_reviews
selection_rounds, selection_candidates, selection_scores, selection_reviews
approvals, awards, finance_records
notifications, notification_templates
grievances, grievance_messages
ai_jobs, ai_results, ai_models, ai_prompt_versions
audit_logs, integration_logs, consents
```

**Application numbering:** human-readable (`NFST-2026-000001`) + separate immutable internal UUID; DB numeric IDs never exposed as identifiers.

**Data integrity rules:** unique application_number; indexed certificate numbers/document hashes; scheme version immutable post-publication; selection results locked after finalization; audit logs append-only.

---

## 15. API Design

Base path: `/api/v1/`
Resources: `auth, users, roles, applicants, schemes, scheme-versions, forms, applications, documents, document-verification, ai, eligibility, workflows, deficiencies, institutions, scrutiny, selection, approvals, awards, finance, notifications, grievances, reports, audit, admin`

Representative endpoints:
```
POST /auth/register | /auth/login | /auth/verify-otp | /auth/refresh | /auth/logout
GET/POST /schemes | POST /schemes/{id}/versions | POST /scheme-versions/{id}/publish
POST /applications | GET/PATCH /applications/{id} | POST /applications/{id}/submit
POST /documents/presign | POST /documents | POST /documents/{id}/verify|reject|resubmit
POST /ai/documents/{id}/classify|extract|validate | POST /ai/applications/{id}/consistency-check
POST /applications/{id}/deficiencies | POST /deficiencies/{id}/respond|close
POST /selection-rounds | POST /selection-rounds/{id}/run|finalize
POST /applications/{id}/approve|reject|return
```

**Idempotency keys required** for: application submission, payment initiation, document retrieval, bulk notification, selection finalization.

---

## 16. State Transitions & Workflow Engine

Workflow definition = nodes + transitions + conditions + permissions + SLA + notifications + escalation. Backend rejects invalid transitions (e.g., `DRAFT → APPROVED` is impossible). Each transition validates: current state, actor permission, scheme workflow, required documents, prerequisite checks, transition conditions.

---

## 17. Reporting & Dashboards

- **Executive:** Total/Submitted/Pending/Under Scrutiny/Deficient/Eligible/Selected/Rejected/Withdrawn/Completed counts.
- **Operational:** Aging, SLA breaches, officer workload, pending documents, deficiency/verification backlog.
- **Scheme Dashboard:** by scheme/year/state/district/institution/course/status/processing time.
- **AI Dashboard:** documents processed, classification accuracy, manual-review rate, low-confidence rate, extraction confidence, AI flags, false-positive outcomes, latency — **reported separately from government decision outcomes.**
- **Applicant Transparency Tracker:** shows progress checkpoints without exposing internal comments, security flags, other applicants' data, or committee deliberations.
- **Processing analytics:** average/median/P90/P95 durations per stage, SLA compliance.
- **Export:** CSV/Excel/PDF, async for large sets, every export logged (who/what/when/filters/count/reason).

---

## 18. Non-Functional Requirements

**Accessibility:** GIGW 3.0 / WCAG 2.1 AA — keyboard nav, semantic HTML, visible focus, labels, accessible errors, screen-reader support, alt text, contrast, scalable text, accessible tables/documents.

**Multilingual:** English/Hindi now, extensible; all UI strings externalized; AI translations must never silently replace legally approved scheme wording.

**Mobile:** responsive across mobile/tablet/desktop; usable on low-end devices/slow networks; progressive/resumable upload with compression.

**Performance targets:** API < 500ms typical; Dashboard API < 2s; Application save < 1s; AI always async (immediate "Upload Accepted / AI Processing Started" response).

**Scalability path:** Start with 1 FastAPI instance + 1 PostgreSQL + 1 Redis + 1 worker pool + ImageKit → grow to multiple API/worker replicas, read replicas, dedicated reporting/AI infra.

**Observability:** request_id/trace_id per request; monitor API latency, error rates, queue depth, OCR/AI latency, DB performance, storage errors, notification failures, login anomalies.

**Security monitoring:** repeated failed logins, privilege escalation attempts, unusual exports/bulk downloads, suspicious document access, unauthorized API access.

**Environments:** Dev / QA / UAT / Production strictly separated; no production credentials or data in dev.

**Business continuity:** application must keep functioning if AI, DigiLocker, SMS, Email, or Storage is down — AI is an accelerator, not a single point of failure.

**Backups/DR:** automated encrypted backups, point-in-time recovery, integrity checks, restore tests; define RPO/RTO, failover procedure, recovery owner.

---

## 19. Testing & Quality

- **Unit:** rules, validators, services, AI parsers, state transitions.
- **Integration:** PostgreSQL, Redis, ImageKit, DigiLocker adapter, email, SMS.
- **E2E:** Applicant (register→apply→upload→submit→deficiency→resubmit); Officer (login→queue→review→verify→deficiency→selection); Approver (review→approve→award).
- **AI Evaluation:** benchmark set covering clear docs, poor scans, varied layouts, language variants, name variations, old/partial/duplicate/incorrect documents. Metrics: classification accuracy, extraction accuracy, precision/recall, manual-review rate, false pos/neg, latency.
- **AI Model Governance record:** `model_name, model_version, prompt_version, schema_version, provider, input_hash, output, confidence, timestamp` — always answerable: "which model produced this result?"

**CI/CD:** Commit → Lint → Unit Tests → Security Scan → Dependency Scan → Build → Integration Tests → Container Scan → Deploy QA → UAT Approval → Production.

**Release checklist:** functional, security, accessibility, performance, backup/recovery, AI benchmark, integration, RBAC, audit verification, retention config, legal/privacy review, GIGW assessment, production security audit.

---

## 20. MVP Scope (Phase 1)

| Track | Scope |
|---|---|
| Applicant | Register, login, profile, NFST + NOS application, document upload, DigiLocker-ready architecture, tracking, deficiency response, notifications, grievance |
| Officer | Dashboard, queue, document verification, AI summary, eligibility results, deficiency, scrutiny |
| Admin | Scheme + version management, eligibility rules, document config, workflow config, user/role management, reports |
| AI | OCR, classification, extraction, cross-document matching, completeness detection, review summary |
| Selection | Eligibility shortlist, merit engine, committee review, final approval |

**Phase 2:** DigiLocker live integration, institution integration, advanced selection workflows, finance integration, advanced analytics, grievance escalation, multilingual support, enhanced fraud signals.

**Phase 3:** Additional MoTA schemes, predictive workload analytics, government SSO, additional verified document sources, enterprise storage, multi-region DR, advanced ML models.

**Explicitly deferred (avoid over-engineering):** Kubernetes, Kafka, dozens of microservices, custom OCR model training, complex data lake, mobile app.

---

## 21. Acceptance Criteria (by role)

**Applicant:** create account → authenticate → complete profile → discover eligible schemes → start/draft/submit application → upload documents → view processing progress → get application number → track workflow → receive/respond to deficiencies → view result → raise grievance.

**Officer:** view/filter assigned cases → review applicant & documents → view AI extraction/confidence/evidence → verify/reject documents → raise deficiencies → review resubmissions → view eligibility reasoning → complete scrutiny → add notes → progress application → audit history preserved.

**Scheme Manager:** create scheme & version → configure documents/forms/eligibility/workflow/SLA/notifications/selection criteria → test → submit for approval → publish → view historical versions.

**Approving Authority:** view full decision packet → verify prerequisites → inspect evidence → review committee recommendation → approve/reject(reason)/return for clarification → digitally recorded decision with full audit trail.

**AI Subsystem:** process documents async → classify → extract structured fields with confidence → detect missing info & cross-document inconsistencies → flag low confidence → produce auditable, model-versioned outputs → route uncertain cases to humans → never issue the final award decision.

**Security:** enforce authN/RBAC/data scopes → TLS → credential protection → upload validation → OWASP risk mitigation → privileged-action logging → MFA → session/account revocation → unauthorized-access prevention → audit-readiness.

**Configurability (key differentiator):** Scheme Manager can introduce a new scheme version — changing eligibility rules, required documents, form fields, workflow states, SLA, notifications, selection criteria — **without modifying core application source code**. Developer involvement required only for genuinely new platform capabilities.

---

## 22. Key KPIs

Application completion rate · average/median processing time · SLA compliance · deficiency rate · resubmission rate · document verification turnaround · AI manual-review rate · AI extraction accuracy · AI false-positive rate · officer workload · selection turnaround · grievance resolution time · notification delivery rate · system availability.

---

## 23. Core Architectural Decisions

1. FastAPI is the primary backend.
2. Python also owns the AI/document-processing layer.
3. PostgreSQL is the system of record.
4. ImageKit is the MVP storage provider, behind an abstract interface.
5. Redis + Celery handle async processing.
6. First release is a modular monolith.
7. Scheme rules are versioned configuration, not code.
8. LLMs extract/assist; deterministic rules evaluate approved criteria.
9. Human officials retain final authority.
10. Every consequential action is auditable.
11. DigiLocker and other gov services are adapters, not hard dependencies.
12. Platform targets GIGW 3.0, WCAG 2.1 AA, OWASP ASVS, and government security-audit readiness.

---

## 24. Repository Structure

```
mota-scholarship-platform/
├── frontend/        (Next.js: app, components, features, hooks, lib, types, tests)
├── backend/app/      (core, auth, users, applicants, institutions, schemes, applications,
│                       documents, eligibility, verification, workflow, deficiencies,
│                       scrutiny, selection, approvals, finance, notifications,
│                       grievances, analytics, audit, integrations) + tests/
├── ai/               (ocr, classification, extraction, validation, matching,
│                       summarization, evaluation)
├── worker/           (tasks, pipelines)
├── infra/            (docker, nginx, scripts)
└── docs/             (api, scheme-config, security, ai)
```

---

## 25. Implementation Roadmap

| Sprint | Focus |
|---|---|
| 1 | Foundation: repo, Docker, FastAPI, Next.js, PostgreSQL, Redis, auth, RBAC, audit framework |
| 2 | Scheme Engine: scheme, version, rules, forms, documents, workflow |
| 3 | Applicant: profile, application, upload, submission, tracking |
| 4 | AI: OCR, classification, extraction, validation, consistency, summary |
| 5 | Officer: queues, scrutiny, verification, deficiency, resubmission |
| 6 | Selection: eligibility, merit, committee, approval |
| 7 | Communication/Grievance: email, SMS, notifications, grievances |
| 8 | Hardening: security, accessibility, performance, audit, backups, monitoring |

---

## 26. Success Definition

The platform is successful when it demonstrably: accepts digital applications → auto-analyzes documents → identifies missing/deficient information → runs deterministic eligibility checks → gives officers an evidence-based AI summary → allows officer verification/override → supports digital deficiency raise-and-response → progresses applications through configurable workflow → applies approved selection criteria → completes final approval with full digital record → logs every action for audit → and allows an entire new scheme to be configured **without rewriting core code**.

---

## 27. Sources

1. MoTA Scholarship page — tribal.nic.in/ScholarshiP.aspx
2. PIB — Scholarship Schemes for ST Students
3. National Fellowship Portal — fellowship.tribal.gov.in
4. National Overseas Scholarship Portal — overseas.tribal.gov.in
5. NFST 2025–26 Advertisement (MoTA)
6. MoTA NOS guidance & 2026–27 notifications
7. GIGW 3.0 — guidelines.india.gov.in
8. ImageKit Pricing — imagekit.io/plans
9. MoTA PFMS sanction-order data
10. DigiLocker Partner Integration — digilocker.gov.in
11. UIDAI Updated Regulations
12. DPDP Act, 2023 (MeitY)
13. DPDP Rules, 2025 (MeitY)
14. OWASP ASVS — owasp.org/projects/asvs
15. GIGW 3.0 Accessibility Guidance
