"""Provider-neutral object storage with ImageKit and local disk fallback."""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from hashlib import sha256
import base64, hashlib, hmac, json, logging, os, uuid
from pathlib import Path, PurePosixPath
import httpx
from app.core.config import get_settings

logger = logging.getLogger(__name__)

@dataclass
class StoredObject:
    key: str
    size: int
    sha256: str
    provider: str
    provider_id: str | None = None
    url: str | None = None
    metadata: dict = field(default_factory=dict)

class StorageProviderError(RuntimeError):
    def __init__(self, message: str, provider: str = "storage", details: dict | None = None):
        super().__init__(message)
        self.provider = provider
        self.details = details or {}

class StorageService(ABC):
    @abstractmethod
    def upload(self, content: bytes, filename: str, content_type: str, folder: str | None = None) -> StoredObject: ...
    @abstractmethod
    def delete(self, key: str, provider_id: str | None = None) -> None: ...
    @abstractmethod
    def get_signed_url(self, key: str, expires_in: int = 300) -> str: ...
    @abstractmethod
    def get_metadata(self, key: str, provider_id: str | None = None) -> dict: ...
    @abstractmethod
    def get_file_path(self, key: str) -> str | None: ...

class LocalStorageProvider(StorageService):
    def __init__(self, base_dir: str = "storage/documents", endpoint: str = "http://localhost:8000/api/v1"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.endpoint = endpoint.rstrip('/')

    def upload(self, content: bytes, filename: str, content_type: str, folder: str | None = None) -> StoredObject:
        safe_name = PurePosixPath(filename or "upload").name
        file_uuid = uuid.uuid4()
        storage_rel_path = f"{folder.strip('/') if folder else 'mota/documents'}/{file_uuid}-{safe_name}"
        full_dest = self.base_dir / storage_rel_path
        full_dest.parent.mkdir(parents=True, exist_ok=True)

        with open(full_dest, "wb") as f:
            f.write(content)

        digest = sha256(content).hexdigest()
        url = f"{self.endpoint}/documents/file/{storage_rel_path}"

        return StoredObject(
            key=storage_rel_path,
            size=len(content),
            sha256=digest,
            provider="local",
            provider_id=str(file_uuid),
            url=url,
            metadata={"filename": safe_name, "mime": content_type, "path": str(full_dest)},
        )

    def delete(self, key: str, provider_id: str | None = None) -> None:
        full_dest = self.base_dir / key
        if full_dest.exists():
            full_dest.unlink(missing_ok=True)

    def get_signed_url(self, key: str, expires_in: int = 300) -> str:
        return f"{self.endpoint}/documents/file/{key}"

    def get_metadata(self, key: str, provider_id: str | None = None) -> dict:
        full_dest = self.base_dir / key
        if not full_dest.exists():
            return {"key": key, "provider": "local"}
        stat = full_dest.stat()
        return {"key": key, "size": stat.st_size, "provider": "local"}

    def get_file_path(self, key: str) -> str | None:
        full_dest = self.base_dir / key
        if full_dest.exists():
            return str(full_dest)
        return None

class ImageKitStorageProvider(StorageService):
    upload_endpoint = "https://upload.imagekit.io/api/v1/files/upload"

    def __init__(self, private_key: str, public_key: str, endpoint: str, folder: str = "mota/documents", timeout: float = 15.0):
        self.private_key = private_key.strip()
        self.public_key = public_key.strip()
        self.endpoint = endpoint.rstrip('/')
        self.folder = folder.strip('/')
        self.timeout = timeout
        self.local_fallback = LocalStorageProvider()

    def upload(self, content: bytes, filename: str, content_type: str, folder: str | None = None) -> StoredObject:
        safe = PurePosixPath(filename or "upload").name
        key = f"{(folder or self.folder).strip('/')}/{uuid.uuid4()}-{safe}"
        encoded = base64.b64encode(content).decode("ascii")
        payload = {
            "file": encoded,
            "fileName": safe,
            "folder": f"/{(folder or self.folder).strip('/')}",
            "useUniqueFileName": "false",
            "tags": "mota,document",
        }

        try:
            response = httpx.post(
                self.upload_endpoint,
                content=json.dumps(payload),
                headers={"Content-Type": "application/json"},
                auth=(self.private_key, ""),
                timeout=self.timeout,
            )
            response.raise_for_status()
            data = response.json()
            returned_key = data.get("filePath") or key
            digest = sha256(content).hexdigest()
            return StoredObject(
                returned_key,
                len(content),
                digest,
                "imagekit",
                data.get("fileId"),
                data.get("url"),
                {"mime": content_type, "filename": safe, "imagekit": data},
            )
        except Exception as exc:
            logger.warning("ImageKit upload error (%s), falling back to local secure storage", exc)
            return self.local_fallback.upload(content, filename, content_type, folder)

    def delete(self, key: str, provider_id: str | None = None) -> None:
        if not provider_id:
            return self.local_fallback.delete(key, provider_id)
        try:
            response = httpx.delete(
                f"https://api.imagekit.io/v1/files/{provider_id}",
                auth=(self.private_key, ""),
                timeout=self.timeout,
            )
            response.raise_for_status()
        except Exception:
            self.local_fallback.delete(key, provider_id)

    def get_signed_url(self, key: str, expires_in: int = 300) -> str:
        if not key.startswith("http"):
            local_path = self.local_fallback.get_file_path(key)
            if local_path:
                return self.local_fallback.get_signed_url(key, expires_in)
        token = uuid.uuid4().hex
        path = "/" + key.lstrip('/')
        signature = hmac.new(self.private_key.encode(), (path + token).encode(), hashlib.sha1).hexdigest()
        return f"{self.endpoint}{path}?ik-t={token}&ik-s={signature}&expires_in={int(expires_in)}"

    def get_metadata(self, key: str, provider_id: str | None = None) -> dict:
        if not provider_id:
            return self.local_fallback.get_metadata(key, provider_id)
        try:
            response = httpx.get(
                f"https://api.imagekit.io/v1/files/{provider_id}",
                auth=(self.private_key, ""),
                timeout=self.timeout,
            )
            response.raise_for_status()
            data = response.json()
            return {"key": key, "provider": "imagekit", "provider_id": provider_id, "metadata": data}
        except Exception:
            return self.local_fallback.get_metadata(key, provider_id)

    def get_file_path(self, key: str) -> str | None:
        return self.local_fallback.get_file_path(key)

class MockStorageProvider(LocalStorageProvider):
    pass

def get_storage_provider() -> StorageService:
    settings = get_settings()
    if settings.storage_provider.lower() == "imagekit" and settings.imagekit_private_key:
        return ImageKitStorageProvider(
            settings.imagekit_private_key,
            settings.imagekit_public_key,
            settings.imagekit_endpoint,
            settings.imagekit_folder,
        )
    return LocalStorageProvider()

ImageKitStorage = ImageKitStorageProvider
