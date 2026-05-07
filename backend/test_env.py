import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
env_file = BASE_DIR / ".env.local"

print(f"Loading from: {env_file}")
print(f"File exists: {env_file.exists()}")

load_dotenv(env_file)

password = os.getenv("POSTGRES_PASSWORD", "")
user = os.getenv("POSTGRES_USER", "")
db = os.getenv("POSTGRES_DB", "")
host = os.getenv("POSTGRES_HOST", "")
port = os.getenv("POSTGRES_PORT", "")

print("\nPostgreSQL Configuration:")
print(f"DB: {repr(db)}")
print(f"User: {repr(user)}")
print(f"Password: {repr(password)}")
print(f"Host: {repr(host)}")
print(f"Port: {repr(port)}")

print(f"\nPassword bytes: {password.encode('utf-8', errors='replace')!r}")
print(f"User bytes: {user.encode('utf-8', errors='replace')!r}")

# Try to build DSN like psycopg2 does
try:
    dsn_parts = []
    if db:
        dsn_parts.append(f"dbname={db}")
    if user:
        dsn_parts.append(f"user={user}")
    if password:
        dsn_parts.append(f"password={password}")
    if host:
        dsn_parts.append(f"host={host}")
    if port:
        dsn_parts.append(f"port={port}")

    dsn = " ".join(dsn_parts)
    print(f"\nDSN: {dsn}")
    print(f"DSN at position 61: {dsn[61] if len(dsn) > 61 else 'N/A'}")
    dsn_bytes = dsn[55:70].encode("utf-8", errors="replace") if len(dsn) > 61 else "N/A"
    print(f"DSN bytes around position 61: {dsn_bytes!r}")
except Exception as e:
    print(f"Error building DSN: {e}")
