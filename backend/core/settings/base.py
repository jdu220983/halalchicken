import logging
import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from django.utils.log import DEFAULT_LOGGING
from dotenv import load_dotenv

# Fix for PostgreSQL locale encoding issues on Windows with non-UTF8 locales
# Prevent libpq from reading system configuration files
os.environ["PGCLIENTENCODING"] = "UTF8"
os.environ["PGSYSCONFDIR"] = str(Path(__file__).resolve().parent)
os.environ["PGSERVICEFILE"] = "/dev/null" if os.name != "nt" else "NUL"


BASE_DIR = Path(__file__).resolve().parent.parent.parent
logger = logging.getLogger(__name__)

# Load environment-specific .env file
# Priority: ENV variable > DEBUG variable > default to local
ENV = os.getenv("ENV", "").lower()
DEBUG_STR = os.getenv("DEBUG", "").lower()

if ENV == "prod" or ENV == "production":
    env_file = BASE_DIR / ".env.prod"
elif ENV == "local" or ENV == "dev" or DEBUG_STR == "true" or DEBUG_STR == "1":
    env_file = BASE_DIR / ".env.local"
else:
    # Default to local for development
    env_file = BASE_DIR / ".env.local"

if env_file.exists():
    load_dotenv(env_file)
    logger.info("Loaded environment variables from %s", env_file)
else:
    logger.warning(
        "Environment file not found at %s. Continuing with existing OS environment.",
        env_file,
    )

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-secret-key-change")
DEBUG = os.getenv("DEBUG", "False").lower() in ("true", "1", "yes")
ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "*").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    # Local
    "shop",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "core.middleware.RequestIDMiddleware",
    "core.middleware.SecurityHeadersMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "core.middleware.SentryUserMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "core.wsgi.application"

# Database configuration - PostgreSQL only
# SQLite is only allowed for pytest with explicit override
if os.getenv("USE_SQLITE_FOR_TESTS") == "1":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
elif os.getenv("DATABASE_URL"):
    # Use DATABASE_URL if provided (helps bypass some encoding issues on Windows)
    DATABASES = {
        "default": dj_database_url.config(
            default=os.getenv("DATABASE_URL"),
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
    # Ensure client_encoding is UTF8
    DATABASES["default"].setdefault("OPTIONS", {})["client_encoding"] = "UTF8"
else:
    # Fallback static PostgreSQL config
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": "halalchicken",
            "USER": "postgres",
            "PASSWORD": "1234",
            "HOST": "localhost",
            "PORT": "5432",
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "shop.User"

# CORS: wide open in dev, controlled via env in prod
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    _origins = os.getenv("CORS_ALLOWED_ORIGINS", "").strip()
    if _origins:
        CORS_ALLOWED_ORIGINS = [o for o in _origins.split(" ") if o]
    else:
        CORS_ALLOWED_ORIGINS = []
    CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True

# Allow custom headers (x-session-id for anonymous cart)
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
    "x-session-id",  # Custom header for anonymous cart sessions
]

# DRF
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "auth": os.getenv("THROTTLE_AUTH_RATE", "10/min"),
        "order_create": os.getenv("THROTTLE_ORDER_CREATE_RATE", "5/min"),
        "upload_import": os.getenv("THROTTLE_UPLOAD_IMPORT_RATE", "3/min"),
    },
}

# CI/pytest can issue many auth requests in a short burst; relax rates in test mode
# to avoid flaky 429s while keeping throttling enabled in normal environments.
if os.getenv("USE_SQLITE_FOR_TESTS") == "1":
    REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {
        "auth": "100000/min",
        "order_create": "100000/min",
        "upload_import": "100000/min",
    }

SPECTACULAR_SETTINGS = {
    "TITLE": "Halal Chicken API",
    "DESCRIPTION": "Price-on-Request e-commerce API",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# JWT
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MIN", "60"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "7"))),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# Celery & Redis
CELERY_BROKER_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"

# Logging with request-id correlation
LOGGING = {
    **DEFAULT_LOGGING,
    "filters": {
        **DEFAULT_LOGGING.get("filters", {}),
        "request_id": {"()": "core.middleware.RequestIDLogFilter"},
    },
    "formatters": {
        **DEFAULT_LOGGING.get("formatters", {}),
        "verbose": {
            "format": "%(asctime)s %(levelname)s %(name)s [req=%(request_id)s] %(message)s",
        },
    },
    "handlers": {
        **DEFAULT_LOGGING.get("handlers", {}),
        "console": {
            **DEFAULT_LOGGING.get("handlers", {}).get("console", {}),
            "filters": ["request_id"],
            "formatter": "verbose",
        },
    },
}

# CSP (opt-in via env)
CSP_ENABLED = os.getenv("CSP_ENABLED", "0") == "1"
CSP_CONNECT_SRC_EXTRA = os.getenv("CSP_CONNECT_SRC_EXTRA", "")
