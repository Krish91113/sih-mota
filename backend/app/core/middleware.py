import uuid,time
from starlette.middleware.base import BaseHTTPMiddleware
class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self,request,call_next):
        request_id=request.headers.get("X-Request-ID",str(uuid.uuid4())); request.state.request_id=request_id; started=time.perf_counter()
        response=await call_next(request); response.headers["X-Request-ID"]=request_id; response.headers["X-Content-Type-Options"]="nosniff"; response.headers["X-Frame-Options"]="DENY"; response.headers["Referrer-Policy"]="no-referrer"; response.headers["X-Response-Time-ms"]=str(round((time.perf_counter()-started)*1000,2)); return response
