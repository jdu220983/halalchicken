import os
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from django.conf import settings

# Optional imports aliases to simplify patching in tests
try:  # pragma: no cover - import conveniences for mocking
    import boto3  # type: ignore
except Exception:  # pragma: no cover
    boto3 = None  # type: ignore
try:  # pragma: no cover
    import cloudinary  # type: ignore
    import cloudinary.uploader as cloudinary_uploader  # type: ignore
except Exception:  # pragma: no cover
    cloudinary = None  # type: ignore
    cloudinary_uploader = None  # type: ignore


class StorageBackend(Protocol):
    def save_bytes(self, data: bytes, filename: str, content_type: str | None = None) -> str:
        """Persist bytes and return a URL (public or time-limited signed)."""
        ...


@dataclass
class LocalStorage:
    base_dir: Path
    base_url: str

    def save_bytes(self, data: bytes, filename: str, content_type: str | None = None) -> str:
        self.base_dir.mkdir(parents=True, exist_ok=True)
        dest = self.base_dir / f"{uuid.uuid4()}_{filename}"
        dest.write_bytes(data)
        rel = dest.relative_to(settings.MEDIA_ROOT)
        return f"{self.base_url}/{rel.as_posix()}"


@dataclass
class S3Storage:
    bucket: str
    region: str
    base_path: str

    def _client(self):
        if boto3 is None:  # pragma: no cover
            raise RuntimeError("boto3 is required for S3 storage")
        return boto3.client("s3", region_name=self.region)

    def save_bytes(self, data: bytes, filename: str, content_type: str | None = None) -> str:
        key = f"{self.base_path.rstrip('/')}/{uuid.uuid4()}_{filename}"
        extra = {"ContentType": content_type} if content_type else {}
        self._client().put_object(Bucket=self.bucket, Key=key, Body=data, **extra)
        # presign a GET URL valid for 15 minutes
        return self._client().generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=int(os.getenv("S3_PRESIGN_EXPIRES", "900")),
        )


@dataclass
class CloudinaryStorage:
    folder: str

    def _uploader(self):
        if cloudinary_uploader is None:  # pragma: no cover
            raise RuntimeError("cloudinary is required for CLOUDINARY storage")
        return cloudinary_uploader

    def save_bytes(self, data: bytes, filename: str, content_type: str | None = None) -> str:
        uploader = self._uploader()
        # Cloudinary expects a file-like; we can pass bytes with public_id
        public_id = f"{uuid.uuid4()}_{Path(filename).stem}"
        res = uploader.upload(
            data,
            folder=self.folder,
            public_id=public_id,
            resource_type=("image" if (content_type or "").startswith("image/") else "raw"),
        )
        url = res.get("secure_url") or res.get("url")
        if not url:
            raise RuntimeError("Cloudinary upload did not return a URL")
        return url


def get_storage() -> StorageBackend:
    backend = os.getenv("STORAGE_BACKEND", "LOCAL").upper()
    if backend == "LOCAL":
        media_root = Path(getattr(settings, "MEDIA_ROOT", Path.cwd() / "media"))
        base_url = getattr(settings, "MEDIA_URL", "/media/").rstrip("/")
        return LocalStorage(base_dir=media_root / "files", base_url=base_url)
    if backend == "S3":
        bucket = os.getenv("AWS_S3_BUCKET") or os.getenv("AWS_STORAGE_BUCKET_NAME")
        region = os.getenv("AWS_S3_REGION") or os.getenv("AWS_DEFAULT_REGION")
        if not bucket or not region:
            raise RuntimeError(
                "Missing AWS_S3_BUCKET/AWS_STORAGE_BUCKET_NAME or AWS_S3_REGION/AWS_DEFAULT_REGION"
            )
        base_path = os.getenv("S3_BASE_PATH", "uploads")
        return S3Storage(bucket=bucket, region=region, base_path=base_path)
    if backend == "CLOUDINARY":
        # Expect CLOUDINARY_URL or individual keys configured externally
        folder = os.getenv("CLOUDINARY_FOLDER", "halalchicken")
        return CloudinaryStorage(folder=folder)
    # Fallback to local
    return LocalStorage(
        base_dir=Path(settings.MEDIA_ROOT) / "files",
        base_url=settings.MEDIA_URL.rstrip("/"),
    )
