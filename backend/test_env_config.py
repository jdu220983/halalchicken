#!/usr/bin/env python3
"""
Test script to verify environment configuration error handling.
Run this to ensure the settings properly detect missing .env files and database variables.
"""
import os
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

print("=" * 60)
print("Environment Configuration Test")
print("=" * 60)

# Test 1: Check which .env file would be loaded
print("\n1. Environment Detection:")
print(f"   ENV variable: {os.getenv('ENV', 'not set')}")
print(f"   DEBUG variable: {os.getenv('DEBUG', 'not set')}")

env = os.getenv("ENV", "").lower()
debug_str = os.getenv("DEBUG", "").lower()

if env == "prod" or env == "production":
    expected_file = ".env.prod"
elif env == "local" or env == "dev" or debug_str in ("true", "1", "yes"):
    expected_file = ".env.local"
else:
    expected_file = ".env.local"

print(f"   Expected file: {expected_file}")
print(f"   File exists: {(backend_dir / expected_file).exists()}")

# Test 2: Check database variables
print("\n2. Database Configuration:")
db_vars = {
    "POSTGRES_DB": os.getenv("POSTGRES_DB"),
    "POSTGRES_USER": os.getenv("POSTGRES_USER"),
    "POSTGRES_PASSWORD": "***" if os.getenv("POSTGRES_PASSWORD") else None,
    "POSTGRES_HOST": os.getenv("POSTGRES_HOST", "localhost (default)"),
    "POSTGRES_PORT": os.getenv("POSTGRES_PORT", "5432 (default)"),
}

for key, value in db_vars.items():
    status = "✓" if value else "✗"
    print(f"   {status} {key}: {value or 'NOT SET'}")

# Test 3: Try importing settings
print("\n3. Settings Import Test:")
try:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings.dev")
    import django

    django.setup()
    from django.conf import settings

    print("   ✓ Settings loaded successfully")
    print(f"   DEBUG mode: {settings.DEBUG}")
    print(f"   Database engine: {settings.DATABASES['default']['ENGINE']}")
    print(f"   Database name: {settings.DATABASES['default']['NAME']}")
    print(f"   Database host: {settings.DATABASES['default']['HOST']}")
except Exception as e:
    print("   ✗ Failed to load settings:")
    print(f"     {type(e).__name__}: {e}")

print("\n" + "=" * 60)
print("Test completed")
print("=" * 60)
