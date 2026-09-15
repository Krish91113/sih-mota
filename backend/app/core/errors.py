from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
class DomainError(Exception):
    status_code=400; code="DOMAIN_ERROR"
    def __init__(self,message,details=None): self.message,self.details=message,details or {}
class NotFound(DomainError): status_code,code=404,"NOT_FOUND"
class Unauthorized(DomainError): status_code,code=401,"UNAUTHORIZED"
class Forbidden(DomainError): status_code,code=403,"FORBIDDEN"
class Conflict(DomainError): status_code,code=409,"CONFLICT"
class InvalidTransition(DomainError): status_code,code=409,"INVALID_TRANSITION"
class Immutable(DomainError): status_code,code=409,"SCHEME_VERSION_IMMUTABLE"
class DuplicateApplication(DomainError): status_code,code=409,"APPLICATION_ALREADY_SUBMITTED"
class RequiredDocumentsMissing(DomainError): status_code,code=409,"REQUIRED_DOCUMENTS_MISSING"
class ApprovalPrerequisiteFailed(DomainError): status_code,code=409,"APPROVAL_PREREQUISITE_FAILED"
class IntegrationUnavailable(DomainError): status_code,code=503,"INTEGRATION_UNAVAILABLE"
class AIUnavailable(DomainError): status_code,code=503,"AI_UNAVAILABLE"
def install_exception_handlers(app):
    @app.exception_handler(DomainError)
    async def domain_handler(request:Request,exc:DomainError): return JSONResponse({"success":False,"error":{"code":exc.code,"message":exc.message,"details":exc.details},"request_id":getattr(request.state,"request_id",None)},status_code=exc.status_code)
    @app.exception_handler(RequestValidationError)
    async def validation_handler(request:Request,exc:RequestValidationError): return JSONResponse({"success":False,"error":{"code":"VALIDATION_ERROR","message":"Request validation failed","details":exc.errors()},"request_id":getattr(request.state,"request_id",None)},status_code=422)
