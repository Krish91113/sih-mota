from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.core.database import Base,engine
from app.core.middleware import RequestContextMiddleware
from app.core.errors import install_exception_handlers
from app.auth.router import router as auth_router
from app.domain.router import router as domain_router
from app.real_router import router as relational_router
from app.selection_finance import router as selection_finance_router
from app.notification_service import router as notification_service_router
from app.workflow_api import router as workflow_router
from app.completion_api import router as completion_router
from app.application_notes import router as application_notes_router
from app.finance_api import router as finance_router
from app.domain import models, relational_models, selection_finance_models, core_completion_models
from app.rbac import models as rbac_models
from app.core.audit import AuditLog
from sqlalchemy import text

def create_app():
    app=FastAPI(title=get_settings().app_name,version="1.0.0",description="Production modular monolith API for MoTA scholarship and fellowship management")
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(CORSMiddleware,allow_origins=[x.strip() for x in get_settings().cors_origins.split(",")],allow_credentials=True,allow_methods=["*"],allow_headers=["*"])
    install_exception_handlers(app)
    app.include_router(auth_router,prefix="/api/v1")
    # Register relational provider/report routes before legacy generic catch-all routes.
    app.include_router(notification_service_router,prefix="/api/v1")
    app.include_router(workflow_router,prefix="/api/v1")
    app.include_router(completion_router,prefix="/api/v1")
    app.include_router(application_notes_router,prefix="/api/v1")
    app.include_router(finance_router,prefix="/api/v1")
    app.include_router(relational_router,prefix="/api/v1")
    app.include_router(selection_finance_router,prefix="/api/v1")
    app.include_router(domain_router,prefix="/api/v1")
    @app.get("/ready",tags=["Health"])
    def ready():
        try:
            with engine.connect() as connection: connection.execute(text("SELECT 1"))
            return {"success":True,"data":{"status":"ready"}}
        except Exception:
            return {"success":False,"error":{"code":"DATABASE_UNAVAILABLE","message":"Database is unavailable","details":{}}}
    @app.on_event("startup")
    def startup():
        if get_settings().environment=="development": Base.metadata.create_all(bind=engine)
    return app
app=create_app()
