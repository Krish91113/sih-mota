from sqlalchemy.orm import Session
from sqlalchemy import String,DateTime,JSON
from sqlalchemy.orm import Mapped,mapped_column
from .database import Base
from datetime import datetime,timezone
import uuid
class AuditLog(Base):
 __tablename__="audit_logs"; id:Mapped[str]=mapped_column(String(36),primary_key=True,default=lambda:str(uuid.uuid4())); event_type:Mapped[str]=mapped_column(String(80),index=True); actor_id:Mapped[str|None]=mapped_column(String(36),nullable=True); entity_type:Mapped[str|None]=mapped_column(String(80),nullable=True); entity_id:Mapped[str|None]=mapped_column(String(36),nullable=True); data:Mapped[dict]=mapped_column(JSON,default=dict); created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=lambda:datetime.now(timezone.utc),index=True)
def audit(db,event_type,actor_id=None,entity_type=None,entity_id=None,data=None): db.add(AuditLog(event_type=event_type,actor_id=actor_id,entity_type=entity_type,entity_id=entity_id,data=data or {}))
