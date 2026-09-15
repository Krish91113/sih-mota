from datetime import datetime, timezone
import uuid
from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

def uid(): return str(uuid.uuid4())
def now(): return datetime.now(timezone.utc)
class WorkflowAssignment(Base):
    __tablename__='workflow_assignments'
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid); application_id:Mapped[str]=mapped_column(String(36),ForeignKey('applications.id',ondelete='CASCADE'),index=True); stage:Mapped[str]=mapped_column(String(60)); assignee_id:Mapped[str|None]=mapped_column(String(36),ForeignKey('users.id')); assigned_by:Mapped[str]=mapped_column(String(36),ForeignKey('users.id')); status:Mapped[str]=mapped_column(String(30),default='ACTIVE'); assigned_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now); completed_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); due_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); paused_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); resumed_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); escalated_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); sla_status:Mapped[str]=mapped_column(String(30),default='ON_TRACK')
class WorkflowSLAEvent(Base):
    __tablename__='workflow_sla_events'
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid); assignment_id:Mapped[str]=mapped_column(String(36),ForeignKey('workflow_assignments.id',ondelete='CASCADE'),index=True); event_type:Mapped[str]=mapped_column(String(30)); at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now); reason:Mapped[str|None]=mapped_column(Text)
class SelectionTieResolution(Base):
    __tablename__='selection_tie_resolutions'
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid); round_id:Mapped[str]=mapped_column(String(36),ForeignKey('selection_rounds.id',ondelete='CASCADE')); candidate_ids:Mapped[list]=mapped_column(JSON); strategy:Mapped[str]=mapped_column(String(80)); resolved_by:Mapped[str]=mapped_column(String(36),ForeignKey('users.id')); reason:Mapped[str]=mapped_column(Text); created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class SelectionCorrection(Base):
    __tablename__='selection_corrections'
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid); candidate_id:Mapped[str]=mapped_column(String(36),ForeignKey('selection_candidates.id')); requested_by:Mapped[str]=mapped_column(String(36),ForeignKey('users.id')); status:Mapped[str]=mapped_column(String(30),default='REQUESTED'); old_value:Mapped[dict]=mapped_column(JSON); new_value:Mapped[dict]=mapped_column(JSON); reason:Mapped[str]=mapped_column(Text); approved_by:Mapped[str|None]=mapped_column(String(36),ForeignKey('users.id')); approved_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class ApprovalDelegation(Base):
    __tablename__='approval_delegations'
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid); from_user_id:Mapped[str]=mapped_column(String(36),ForeignKey('users.id')); to_user_id:Mapped[str]=mapped_column(String(36),ForeignKey('users.id')); application_id:Mapped[str|None]=mapped_column(String(36),ForeignKey('applications.id')); status:Mapped[str]=mapped_column(String(30),default='ACTIVE'); reason:Mapped[str]=mapped_column(Text); expires_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class FinanceInstallment(Base):
    __tablename__='finance_installments'
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid); award_id:Mapped[str]=mapped_column(String(36),ForeignKey('awards.id',ondelete='CASCADE'),index=True); installment_no:Mapped[int]=mapped_column(); expected_amount:Mapped[float]=mapped_column(Numeric(14,2)); paid_amount:Mapped[float]=mapped_column(Numeric(14,2),default=0); due_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); paid_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True)); status:Mapped[str]=mapped_column(String(30),default='PENDING'); __table_args__=(UniqueConstraint('award_id','installment_no'),)
class PaymentException(Base):
    __tablename__='payment_exceptions'
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid); finance_record_id:Mapped[str]=mapped_column(String(36),ForeignKey('finance_records.id',ondelete='CASCADE')); expected_amount:Mapped[float]=mapped_column(Numeric(14,2)); actual_amount:Mapped[float]=mapped_column(Numeric(14,2)); difference:Mapped[float]=mapped_column(Numeric(14,2)); reason:Mapped[str]=mapped_column(Text); status:Mapped[str]=mapped_column(String(30),default='OPEN'); resolved_by:Mapped[str|None]=mapped_column(String(36),ForeignKey('users.id')); resolved_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
