from .base import *  # noqa

DEBUG = False
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 3600
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True

# Sentry (enabled only if SENTRY_DSN set)
import os
import importlib

SENTRY_DSN = os.getenv("SENTRY_DSN")
if SENTRY_DSN:
	try:
		sentry_sdk = importlib.import_module("sentry_sdk")
		django_integration = importlib.import_module("sentry_sdk.integrations.django")
		DjangoIntegration = django_integration.DjangoIntegration

		sentry_sdk.init(
			dsn=SENTRY_DSN,
			integrations=[DjangoIntegration()],
			traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.0")),
			send_default_pii=False,
		)
	except ModuleNotFoundError:
		logger.warning("SENTRY_DSN is set, but sentry-sdk is not installed.")
