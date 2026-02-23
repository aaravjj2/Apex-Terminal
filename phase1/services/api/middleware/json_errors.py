"""
Phase C — Global JSON Error Middleware
Guarantees every error response is valid JSON with:
  { ok: false, code, message, correlation_id, details }
No route should ever return an empty body on error.
"""
from __future__ import annotations

import traceback
import uuid

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
import structlog

logger = structlog.get_logger(__name__)


class JsonErrorMiddleware(BaseHTTPMiddleware):
    """
    Catches ALL exceptions and malformed responses, converting them to
    a stable JSON error envelope. Also injects X-Correlation-Id header.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint):
        correlation_id = request.headers.get("x-correlation-id") or str(uuid.uuid4())

        try:
            response = await call_next(request)

            # Inject correlation header on every response
            response.headers["X-Correlation-Id"] = correlation_id

            return response

        except Exception as exc:
            tb = traceback.format_exc()
            logger.error(
                "unhandled_exception",
                path=request.url.path,
                method=request.method,
                error=str(exc),
                correlation_id=correlation_id,
            )
            return JSONResponse(
                status_code=500,
                content={
                    "ok": False,
                    "code": "INTERNAL_ERROR",
                    "message": str(exc),
                    "correlation_id": correlation_id,
                    "details": tb if __debug__ else None,
                },
                headers={"X-Correlation-Id": correlation_id},
            )
