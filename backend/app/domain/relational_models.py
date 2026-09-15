"""Relational Phase A/B domain tables. JSON is reserved for configurable payloads, not entity identity."""
from datetime import datetime, timezone
import uuid
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

def uid(): return str(uuid.uuid4())
def now(): return datetime.now(timezone.utc)
class Timestamped(Base):
    __abstract__ = True
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now, nullable=False)
class SimpleRecord(Timestamped):
    __abstract__ = True
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    status: Mapped[str | None] = mapped_column(String(40), index=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)
class ApplicantProfile(Timestamped):
    __tablename__="applicant_profiles"; id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid); applicant_id:Mapped[str]=mapped_column(String(36),ForeignKey("applicants.id",ondelete="CASCADE"),unique=True); category:Mapped[str|None]=mapped_column(String(40)); state:Mapped[str|None]=mapped_column(String(100)); district:Mapped[str|None]=mapped_column(String(100)); address:Mapped[dict]=mapped_column(JSON,default=dict); declaration:Mapped[dict]=mapped_column(JSON,default=dict)
class ApplicantAcademicRecord(SimpleRecord):
    __tablename__="applicant_academic_records"; applicant_id:Mapped[str]=mapped_column(String(36),ForeignKey("applicants.id",ondelete="CASCADE"),index=True); institution:Mapped[str|None]=mapped_column(String(255)); programme:Mapped[str|None]=mapped_column(String(255)); year:Mapped[int|None]=mapped_column(Integer)
class ApplicantResearchRecord(SimpleRecord):
    __tablename__="applicant_research_records"; applicant_id:Mapped[str]=mapped_column(String(36),ForeignKey("applicants.id",ondelete="CASCADE"),unique=True); research_status:Mapped[str|None]=mapped_column(String(100)); data:Mapped[dict]=mapped_column(JSON,default=dict)
class ApplicantBankDetail(SimpleRecord):
    __tablename__="applicant_bank_details"; applicant_id:Mapped[str]=mapped_column(String(36),ForeignKey("applicants.id",ondelete="CASCADE"),unique=True); account_last4:Mapped[str|None]=mapped_column(String(4)); encrypted_payload:Mapped[str|None]=mapped_column(Text)
class ApplicantPassportDetail(SimpleRecord):
    __tablename__="applicant_passport_details"; applicant_id:Mapped[str]=mapped_column(String(36),ForeignKey("applicants.id",ondelete="CASCADE"),unique=True); passport_last4:Mapped[str|None]=mapped_column(String(4)); encrypted_payload:Mapped[str|None]=mapped_column(Text)
class Institution(SimpleRecord):
    __tablename__="institutions"; code:Mapped[str]=mapped_column(String(80),unique=True,index=True); name:Mapped[str]=mapped_column(String(255)); institution_type:Mapped[str|None]=mapped_column(String(100)); state:Mapped[str|None]=mapped_column(String(100)); district:Mapped[str|None]=mapped_column(String(100))
class InstitutionUser(SimpleRecord):
    __tablename__="institution_users"; institution_id:Mapped[str]=mapped_column(String(36),ForeignKey("institutions.id",ondelete="CASCADE"),index=True); user_id:Mapped[str]=mapped_column(String(36),ForeignKey("users.id",ondelete="CASCADE"),index=True); __table_args__=(UniqueConstraint("institution_id","user_id"),)
class InstitutionProgramme(SimpleRecord):
    __tablename__="institution_programmes"; institution_id:Mapped[str]=mapped_column(String(36),ForeignKey("institutions.id",ondelete="CASCADE"),index=True); name:Mapped[str]=mapped_column(String(255)); level:Mapped[str|None]=mapped_column(String(80))
class SchemeDocument(SimpleRecord):
    __tablename__="scheme_documents"; scheme_version_id:Mapped[str]=mapped_column(String(36),ForeignKey("scheme_versions.id",ondelete="CASCADE"),index=True); document_code:Mapped[str]=mapped_column(String(80)); label:Mapped[str]=mapped_column(String(255)); required:Mapped[bool]=mapped_column(Boolean,default=True); __table_args__=(UniqueConstraint("scheme_version_id","document_code"),)
class SchemeForm(SimpleRecord):
    __tablename__="scheme_forms"; scheme_version_id:Mapped[str]=mapped_column(String(36),ForeignKey("scheme_versions.id",ondelete="CASCADE"),unique=True); definition:Mapped[dict]=mapped_column(JSON,default=dict); schema_version:Mapped[int]=mapped_column(Integer,default=1)
class SchemeWorkflow(SimpleRecord):
    __tablename__="scheme_workflows"; scheme_version_id:Mapped[str]=mapped_column(String(36),ForeignKey("scheme_versions.id",ondelete="CASCADE"),unique=True); definition:Mapped[dict]=mapped_column(JSON,default=dict)
class SchemeSelectionCriterion(SimpleRecord):
    __tablename__="scheme_selection_criteria"; scheme_version_id:Mapped[str]=mapped_column(String(36),ForeignKey("scheme_versions.id",ondelete="CASCADE"),index=True); criterion_code:Mapped[str]=mapped_column(String(80)); weight:Mapped[float]=mapped_column(Numeric(10,4)); calculation_method:Mapped[str]=mapped_column(String(80)); minimum:Mapped[float|None]=mapped_column(Numeric(10,4)); maximum:Mapped[float|None]=mapped_column(Numeric(10,4)); __table_args__=(UniqueConstraint("scheme_version_id","criterion_code"),)
class SchemeSourceDocument(SimpleRecord):
    __tablename__="scheme_source_documents"; scheme_version_id:Mapped[str]=mapped_column(String(36),ForeignKey("scheme_versions.id",ondelete="CASCADE"),index=True); title:Mapped[str]=mapped_column(String(255)); document_type:Mapped[str|None]=mapped_column(String(80)); document_reference:Mapped[str]=mapped_column(String(500)); section_reference:Mapped[str|None]=mapped_column(String(255)); page_reference:Mapped[str|None]=mapped_column(String(80)); source_url:Mapped[str|None]=mapped_column(String(1000)); effective_from:Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); effective_to:Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); uploaded_document_id:Mapped[str|None]=mapped_column(String(36),ForeignKey("documents.id")); source_reference:Mapped[str]=mapped_column(String(500)); status:Mapped[str]=mapped_column(String(30),default="ACTIVE")
class InstitutionVerificationRecord(SimpleRecord):
    __tablename__="institution_verification_records"; application_id:Mapped[str]=mapped_column(String(36),ForeignKey("applications.id",ondelete="CASCADE"),index=True); institution_id:Mapped[str]=mapped_column(String(36),ForeignKey("institutions.id")); verifier_id:Mapped[str]=mapped_column(String(36),ForeignKey("users.id")); result:Mapped[str]=mapped_column(String(40)); fields:Mapped[dict]=mapped_column(JSON,default=dict); note:Mapped[str|None]=mapped_column(Text)
class ApplicationVersion(Timestamped):
    __tablename__="application_versions"; id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid); application_id:Mapped[str]=mapped_column(String(36),ForeignKey("applications.id",ondelete="CASCADE"),index=True); version_number:Mapped[int]=mapped_column(Integer); actor_id:Mapped[str]=mapped_column(String(36),ForeignKey("users.id")); reason:Mapped[str|None]=mapped_column(String(500)); snapshot:Mapped[dict]=mapped_column(JSON,default=dict); supporting_evidence:Mapped[dict]=mapped_column(JSON,default=dict); __table_args__=(UniqueConstraint("application_id","version_number"),)
class ApplicationAnswer(Timestamped):
    __tablename__="application_answers"; id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid); application_id:Mapped[str]=mapped_column(String(36),ForeignKey("applications.id",ondelete="CASCADE"),index=True); field_key:Mapped[str]=mapped_column(String(255)); value:Mapped[object]=mapped_column(JSON); version_number:Mapped[int]=mapped_column(Integer,default=1); __table_args__=(UniqueConstraint("application_id","field_key","version_number"),)
class ApplicationStatusHistory(Timestamped):
    __tablename__="application_status_history"; id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid); application_id:Mapped[str]=mapped_column(String(36),ForeignKey("applications.id",ondelete="CASCADE"),index=True); from_status:Mapped[str|None]=mapped_column(String(40)); to_status:Mapped[str]=mapped_column(String(40)); actor_id:Mapped[str]=mapped_column(String(36),ForeignKey("users.id")); reason:Mapped[str|None]=mapped_column(String(500)); request_id:Mapped[str|None]=mapped_column(String(100))
class ApplicationNote(Timestamped):
    __tablename__="application_notes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    application_id: Mapped[str] = mapped_column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    note: Mapped[str] = mapped_column(Text, nullable=False)
    internal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

class ApplicationAssignment(SimpleRecord):
    __tablename__="application_assignments"; application_id:Mapped[str]=mapped_column(String(36),ForeignKey("applications.id",ondelete="CASCADE"),index=True); assignee_id:Mapped[str]=mapped_column(String(36),ForeignKey("users.id"),index=True); assignment_type:Mapped[str]=mapped_column(String(80)); __table_args__=(Index("ix_assignment_active","application_id","assignee_id","status"),)
class DocumentVersion(SimpleRecord):
    __tablename__="document_versions"; document_id:Mapped[str]=mapped_column(String(36),ForeignKey("documents.id",ondelete="CASCADE"),index=True); version_number:Mapped[int]=mapped_column(Integer); storage_key:Mapped[str]=mapped_column(String(500)); sha256:Mapped[str]=mapped_column(String(64)); mime:Mapped[str]=mapped_column(String(100)); size:Mapped[int]=mapped_column(Integer); uploaded_by:Mapped[str]=mapped_column(String(36),ForeignKey("users.id")); __table_args__=(UniqueConstraint("document_id","version_number"),)
class DocumentVerification(SimpleRecord):
    __tablename__="document_verifications"; document_id:Mapped[str]=mapped_column(String(36),ForeignKey("documents.id",ondelete="CASCADE"),index=True); verifier_id:Mapped[str]=mapped_column(String(36),ForeignKey("users.id")); result:Mapped[str]=mapped_column(String(40)); reason_code:Mapped[str|None]=mapped_column(String(40)); note:Mapped[str|None]=mapped_column(Text)
class DocumentFlag(SimpleRecord):
    __tablename__="document_flags"; document_id:Mapped[str]=mapped_column(String(36),ForeignKey("documents.id",ondelete="CASCADE"),index=True); flag_code:Mapped[str]=mapped_column(String(80)); severity:Mapped[str]=mapped_column(String(30)); note:Mapped[str|None]=mapped_column(Text)
class DocumentAccessLog(Timestamped):
    __tablename__="document_access_logs"; id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid); document_id:Mapped[str]=mapped_column(String(36),ForeignKey("documents.id",ondelete="CASCADE"),index=True); actor_id:Mapped[str]=mapped_column(String(36),ForeignKey("users.id")); action:Mapped[str]=mapped_column(String(40)); request_id:Mapped[str|None]=mapped_column(String(100))
class EligibilityRun(Timestamped):
    __tablename__="eligibility_runs"; id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid); application_id:Mapped[str]=mapped_column(String(36),ForeignKey("applications.id",ondelete="CASCADE"),index=True); scheme_version_id:Mapped[str]=mapped_column(String(36),ForeignKey("scheme_versions.id")); result:Mapped[str]=mapped_column(String(40)); engine_version:Mapped[str]=mapped_column(String(40)); input_snapshot:Mapped[dict]=mapped_column(JSON,default=dict)
class EligibilityResult(SimpleRecord):
    __tablename__="eligibility_results"; run_id:Mapped[str]=mapped_column(String(36),ForeignKey("eligibility_runs.id",ondelete="CASCADE"),unique=True); result:Mapped[str]=mapped_column(String(40)); explanation:Mapped[dict]=mapped_column(JSON,default=dict)
class EligibilityRuleResult(SimpleRecord):
    __tablename__="eligibility_rule_results"; run_id:Mapped[str]=mapped_column(String(36),ForeignKey("eligibility_runs.id",ondelete="CASCADE"),index=True); rule_id:Mapped[str]=mapped_column(String(80)); rule_name:Mapped[str]=mapped_column(String(255)); operator:Mapped[str]=mapped_column(String(50)); observed_value:Mapped[object]=mapped_column(JSON); expected_value:Mapped[object]=mapped_column(JSON); passed:Mapped[bool]=mapped_column(Boolean); source_reference:Mapped[str]=mapped_column(String(500))
class Workflow(SimpleRecord):
    __tablename__="workflows"; name:Mapped[str]=mapped_column(String(255)); version:Mapped[int]=mapped_column(Integer,default=1); definition:Mapped[dict]=mapped_column(JSON,default=dict)
class WorkflowNode(SimpleRecord):
    __tablename__="workflow_nodes"; workflow_id:Mapped[str]=mapped_column(String(36),ForeignKey("workflows.id",ondelete="CASCADE"),index=True); node_code:Mapped[str]=mapped_column(String(80)); label:Mapped[str]=mapped_column(String(255)); __table_args__=(UniqueConstraint("workflow_id","node_code"),)
class WorkflowTransition(SimpleRecord):
    __tablename__="workflow_transitions"; workflow_id:Mapped[str]=mapped_column(String(36),ForeignKey("workflows.id",ondelete="CASCADE"),index=True); from_node:Mapped[str]=mapped_column(String(80)); to_node:Mapped[str]=mapped_column(String(80)); permission:Mapped[str|None]=mapped_column(String(100)); conditions:Mapped[dict]=mapped_column(JSON,default=dict)
class WorkflowSLA(SimpleRecord):
    __tablename__="workflow_slas"; workflow_id:Mapped[str]=mapped_column(String(36),ForeignKey("workflows.id",ondelete="CASCADE"),index=True); node_code:Mapped[str]=mapped_column(String(80)); working_days:Mapped[int]=mapped_column(Integer); escalation_policy:Mapped[dict]=mapped_column(JSON,default=dict)
class Deficiency(SimpleRecord):
    __tablename__="deficiencies"; application_id:Mapped[str]=mapped_column(String(36),ForeignKey("applications.id",ondelete="CASCADE"),index=True); raised_by:Mapped[str]=mapped_column(String(36),ForeignKey("users.id")); type:Mapped[str]=mapped_column(String(80)); description:Mapped[str]=mapped_column(Text); document_id:Mapped[str|None]=mapped_column(String(36),ForeignKey("documents.id")); severity:Mapped[str]=mapped_column(String(30)); deadline:Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); required_action:Mapped[str]=mapped_column(Text)
class DeficiencyResponse(SimpleRecord):
    __tablename__="deficiency_responses"; deficiency_id:Mapped[str]=mapped_column(String(36),ForeignKey("deficiencies.id",ondelete="CASCADE"),index=True); responded_by:Mapped[str]=mapped_column(String(36),ForeignKey("users.id")); response:Mapped[str]=mapped_column(Text); supporting_documents:Mapped[dict]=mapped_column(JSON,default=dict)
class ScrutinyReview(SimpleRecord):
    __tablename__="scrutiny_reviews"; application_id:Mapped[str]=mapped_column(String(36),ForeignKey("applications.id",ondelete="CASCADE"),index=True); officer_id:Mapped[str]=mapped_column(String(36),ForeignKey("users.id")); started_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); completed_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); decision:Mapped[str|None]=mapped_column(String(40)); notes:Mapped[str|None]=mapped_column(Text)
class SelectionRound(SimpleRecord):
    __tablename__="selection_rounds"; scheme_version_id:Mapped[str]=mapped_column(String(36),ForeignKey("scheme_versions.id")); name:Mapped[str]=mapped_column(String(255)); finalized_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); finalized_by:Mapped[str|None]=mapped_column(String(36),ForeignKey("users.id"))
class SelectionCandidate(SimpleRecord):
    __tablename__="selection_candidates"; round_id:Mapped[str]=mapped_column(String(36),ForeignKey("selection_rounds.id",ondelete="CASCADE"),index=True); application_id:Mapped[str]=mapped_column(String(36),ForeignKey("applications.id"),index=True); rank:Mapped[int|None]=mapped_column(Integer); total_score:Mapped[float|None]=mapped_column(Numeric(12,4)); __table_args__=(UniqueConstraint("round_id","application_id"),)
class SelectionScore(SimpleRecord):
    __tablename__="selection_scores"; candidate_id:Mapped[str]=mapped_column(String(36),ForeignKey("selection_candidates.id",ondelete="CASCADE"),index=True); criterion_code:Mapped[str]=mapped_column(String(80)); raw_value:Mapped[object]=mapped_column(JSON); normalized_value:Mapped[float|None]=mapped_column(Numeric(12,4)); weight:Mapped[float]=mapped_column(Numeric(12,4)); weighted_score:Mapped[float]=mapped_column(Numeric(12,4))
class SelectionReview(SimpleRecord):
    __tablename__="selection_reviews"; candidate_id:Mapped[str]=mapped_column(String(36),ForeignKey("selection_candidates.id",ondelete="CASCADE"),index=True); member_id:Mapped[str]=mapped_column(String(36),ForeignKey("users.id")); decision:Mapped[str]=mapped_column(String(30)); note:Mapped[str|None]=mapped_column(Text); conflict:Mapped[bool]=mapped_column(Boolean,default=False); __table_args__=(UniqueConstraint("candidate_id","member_id"),)
class Approval(SimpleRecord):
    __tablename__="approvals"; application_id:Mapped[str]=mapped_column(String(36),ForeignKey("applications.id",ondelete="CASCADE"),index=True); approver_id:Mapped[str]=mapped_column(String(36),ForeignKey("users.id")); decision:Mapped[str]=mapped_column(String(30)); reason_code:Mapped[str|None]=mapped_column(String(80)); note:Mapped[str|None]=mapped_column(Text); packet_snapshot:Mapped[dict]=mapped_column(JSON,default=dict)
class Award(SimpleRecord):
    __tablename__="awards"; application_id:Mapped[str]=mapped_column(String(36),ForeignKey("applications.id"),unique=True); scheme_version_id:Mapped[str]=mapped_column(String(36),ForeignKey("scheme_versions.id")); amount:Mapped[float]=mapped_column(Numeric(14,2)); awarded_by:Mapped[str]=mapped_column(String(36),ForeignKey("users.id")); award_date:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class FinanceRecord(SimpleRecord):
    __tablename__="finance_records"; award_id:Mapped[str]=mapped_column(String(36),ForeignKey("awards.id"),index=True); record_type:Mapped[str]=mapped_column(String(40)); amount:Mapped[float]=mapped_column(Numeric(14,2)); external_reference:Mapped[str|None]=mapped_column(String(255)); provider:Mapped[str]=mapped_column(String(40),default="mock")
class EmailOtpChallenge(Timestamped):
    __tablename__="email_otp_challenges"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(320), index=True)
    purpose: Mapped[str] = mapped_column(String(40), index=True)
    code_hash: Mapped[str] = mapped_column(String(128))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)

class NotificationTemplate(SimpleRecord):
    __tablename__="notification_templates"; code:Mapped[str]=mapped_column(String(80),unique=True); channel:Mapped[str]=mapped_column(String(30)); subject:Mapped[str|None]=mapped_column(String(255)); body:Mapped[str]=mapped_column(Text); published:Mapped[bool]=mapped_column(Boolean,default=False)
class Notification(SimpleRecord):
    __tablename__="notifications"; user_id:Mapped[str]=mapped_column(String(36),ForeignKey("users.id"),index=True); template_id:Mapped[str|None]=mapped_column(String(36),ForeignKey("notification_templates.id")); channel:Mapped[str]=mapped_column(String(30)); payload:Mapped[dict]=mapped_column(JSON,default=dict); delivered_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
class Grievance(SimpleRecord):
    __tablename__="grievances"; applicant_id:Mapped[str|None]=mapped_column(String(36),ForeignKey("applicants.id")); created_by:Mapped[str]=mapped_column(String(36),ForeignKey("users.id")); category:Mapped[str]=mapped_column(String(50)); subject:Mapped[str]=mapped_column(String(255)); description:Mapped[str]=mapped_column(Text); priority:Mapped[str]=mapped_column(String(30),default="NORMAL"); assigned_to:Mapped[str|None]=mapped_column(String(36),ForeignKey("users.id"))
class GrievanceMessage(SimpleRecord):
    __tablename__="grievance_messages"; grievance_id:Mapped[str]=mapped_column(String(36),ForeignKey("grievances.id",ondelete="CASCADE"),index=True); author_id:Mapped[str]=mapped_column(String(36),ForeignKey("users.id")); message:Mapped[str]=mapped_column(Text); internal:Mapped[bool]=mapped_column(Boolean,default=False)
class IntegrationLog(Timestamped):
    __tablename__="integration_logs"; id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid); provider:Mapped[str]=mapped_column(String(80)); operation:Mapped[str]=mapped_column(String(100)); status:Mapped[str]=mapped_column(String(40)); external_reference:Mapped[str|None]=mapped_column(String(255)); request_metadata:Mapped[dict]=mapped_column(JSON,default=dict); response_metadata:Mapped[dict]=mapped_column(JSON,default=dict)
class Consent(Timestamped):
    __tablename__="consents"; id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid); user_id:Mapped[str]=mapped_column(String(36),ForeignKey("users.id"),index=True); consent_type:Mapped[str]=mapped_column(String(80)); version:Mapped[str]=mapped_column(String(30)); granted:Mapped[bool]=mapped_column(Boolean); evidence:Mapped[dict]=mapped_column(JSON,default=dict)
class SystemConfiguration(Timestamped):
    __tablename__="system_configurations"; key:Mapped[str]=mapped_column(String(120),primary_key=True); value:Mapped[object]=mapped_column(JSON); description:Mapped[str|None]=mapped_column(Text); updated_by:Mapped[str|None]=mapped_column(String(36),ForeignKey("users.id"))
class WorkingCalendar(Timestamped):
    __tablename__="working_calendars"; id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid); name:Mapped[str]=mapped_column(String(120)); timezone:Mapped[str]=mapped_column(String(80),default="Asia/Kolkata"); working_weekdays:Mapped[list]=mapped_column(JSON,default=lambda:[0,1,2,3,4])
class Holiday(Timestamped):
    __tablename__="holidays"; id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid); calendar_id:Mapped[str]=mapped_column(String(36),ForeignKey("working_calendars.id",ondelete="CASCADE"),index=True); date:Mapped[datetime]=mapped_column(DateTime(timezone=True)); name:Mapped[str]=mapped_column(String(255)); __table_args__=(UniqueConstraint("calendar_id","date"),)
class IdempotencyRecord(Timestamped):
    __tablename__="idempotency_records"; id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid); key:Mapped[str]=mapped_column(String(255)); user_id:Mapped[str]=mapped_column(String(36),ForeignKey("users.id")); route:Mapped[str]=mapped_column(String(255)); request_hash:Mapped[str]=mapped_column(String(64)); status_code:Mapped[int|None]=mapped_column(Integer); response:Mapped[dict|None]=mapped_column(JSON); __table_args__=(UniqueConstraint("key","user_id","route"),)
