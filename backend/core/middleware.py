import uuid
from typing import Any

from django.conf import settings
from django.utils.deprecation import MiddlewareMixin


class RequestIDMiddleware(MiddlewareMixin):
    HEADER_NAME = "HTTP_X_REQUEST_ID"

    def process_request(self, request):
        rid = request.META.get(self.HEADER_NAME) or str(uuid.uuid4())
        request.request_id = rid  # type: ignore[attr-defined]

    def process_response(self, request, response):
        rid = getattr(request, "request_id", None)
        if rid:
            response["X-Request-ID"] = rid
        return response


class RequestIDLogFilter:
    def filter(self, record: Any) -> bool:  # pragma: no cover - logging infra
        from django.core.handlers.wsgi import WSGIRequest

        rid = None
        if hasattr(record, "request") and isinstance(record.request, WSGIRequest):
            rid = getattr(record.request, "request_id", None)
        record.request_id = rid or "-"
        return True


class SecurityHeadersMiddleware(MiddlewareMixin):
    def process_response(self, request, response):
        response["X-Content-Type-Options"] = "nosniff"
        response["Referrer-Policy"] = "same-origin"
        response["X-Frame-Options"] = "DENY"
        if not settings.DEBUG:
            response["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
            # Optional CSP (enabled via env)
            if getattr(settings, "CSP_ENABLED", False):
                extra_connect = getattr(settings, "CSP_CONNECT_SRC_EXTRA", "").strip()
                connect_src = f"'self' {extra_connect}" if extra_connect else "'self'"
                csp = (
                    "default-src 'self'; "
                    "img-src 'self' data: https:; "
                    "script-src 'self'; "
                    "style-src 'self' 'unsafe-inline'; "
                    f"connect-src {connect_src}; "
                    "font-src 'self' data:; "
                    "frame-ancestors 'none'"
                )
                response["Content-Security-Policy"] = csp
        return response


class SentryUserMiddleware(MiddlewareMixin):
    def process_request(self, request):  # pragma: no cover - trivial
        # If sentry is initialized, attach user id (non-PII) to scope
        try:
            import sentry_sdk  # type: ignore
        except Exception:
            return None
        user_id = getattr(getattr(request, "user", None), "id", None)
        if user_id:
            try:
                sentry_sdk.set_user({"id": str(user_id)})
            except Exception:
                pass
        return None
