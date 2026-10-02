"""Provider-neutral object storage with ImageKit and local disk fallback."""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from hashlib import sha256
import base64, hashlib, hmac, json, logging, os, time, uuid
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

class CloudinaryStorageProvider(StorageService):
    def __init__(self, cloud_name: str, api_key: str, api_secret: str, folder: str = "mota", timeout: float = 20.0):
        self.cloud_name = cloud_name.strip()
        self.api_key = api_key.strip()
        self.api_secret = api_secret.strip()
        self.folder = folder.strip('/')
        self.timeout = timeout
        self.local_fallback = LocalStorageProvider()

    def upload(self, content: bytes, filename: str, content_type: str, folder: str | None = None) -> StoredObject:
        safe = PurePosixPath(filename or "upload").name
        target_folder = (folder or self.folder).strip('/')
        timestamp = str(int(time.time()))

        to_sign = f"folder={target_folder}&timestamp={timestamp}{self.api_secret}"
        signature = hashlib.sha1(to_sign.encode("utf-8")).hexdigest()

        files = {"file": (safe, content, content_type or "application/octet-stream")}
        data = {
            "api_key": self.api_key,
            "timestamp": timestamp,
            "folder": target_folder,
            "signature": signature,
        }

        url = f"https://api.cloudinary.com/v1_1/{self.cloud_name}/auto/upload"

        try:
            response = httpx.post(url, data=data, files=files, timeout=self.timeout)
            response.raise_for_status()
            res_json = response.json()
            public_id = res_json.get("public_id")
            secure_url = res_json.get("secure_url") or res_json.get("url")
            digest = sha256(content).hexdigest()

            return StoredObject(
                key=public_id or f"{target_folder}/{uuid.uuid4()}-{safe}",
                size=len(content),
                sha256=digest,
                provider="cloudinary",
                provider_id=res_json.get("asset_id") or public_id,
                url=secure_url,
                metadata={"mime": content_type, "filename": safe, "cloudinary": res_json},
            )
        except Exception as exc:
            logger.warning("Cloudinary upload failed: %s. Falling back to local storage.", exc)
            fallback_obj = self.local_fallback.upload(content, filename, content_type, folder)
            fallback_obj.metadata["fallback_from"] = "cloudinary"
            fallback_obj.metadata["cloudinary_error"] = str(exc)
            return fallback_obj

    def delete(self, key: str, provider_id: str | None = None) -> None:
        target_id = provider_id or key
        timestamp = str(int(time.time()))
        to_sign = f"public_id={target_id}&timestamp={timestamp}{self.api_secret}"
        signature = hashlib.sha1(to_sign.encode("utf-8")).hexdigest()

        data = {
            "public_id": target_id,
            "api_key": self.api_key,
            "timestamp": timestamp,
            "signature": signature,
        }
        url = f"https://api.cloudinary.com/v1_1/{self.cloud_name}/image/destroy"
        try:
            httpx.post(url, data=data, timeout=self.timeout)
        except Exception as exc:
            logger.warning("Cloudinary delete failed for %s: %s", key, exc)

    def get_signed_url(self, key: str, expires_in: int = 300) -> str:
        if key.startswith("http://") or key.startswith("https://"):
            return key
        if "/" in key and not key.startswith("storage/"):
            return f"https://res.cloudinary.com/{self.cloud_name}/image/upload/{key}"
        return self.local_fallback.get_signed_url(key, expires_in)

    def get_metadata(self, key: str, provider_id: str | None = None) -> dict:
        return {"key": key, "provider": "cloudinary", "provider_id": provider_id}

    def get_file_path(self, key: str) -> str | None:
        return self.local_fallback.get_file_path(key)

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
            logger.warning("ImageKit upload failed: %s. Falling back to local storage.", exc)
            fallback_obj = self.local_fallback.upload(content, filename, content_type, folder)
            fallback_obj.metadata["fallback_from"] = "imagekit"
            fallback_obj.metadata["imagekit_error"] = str(exc)
            return fallback_obj

    def delete(self, key: str, provider_id: str | None = None) -> None:
        if not provider_id:
            raise StorageProviderError(
                "ImageKit delete requires a provider file ID",
                provider="imagekit",
                details={"operation": "delete"},
            )
        try:
            response = httpx.delete(
                f"https://api.imagekit.io/v1/files/{provider_id}",
                auth=(self.private_key, ""),
                timeout=self.timeout,
            )
            response.raise_for_status()
        except Exception as exc:
            raise StorageProviderError(
                f"ImageKit delete failed: {exc}",
                provider="imagekit",
                details={"operation": "delete"},
            ) from exc

    def get_signed_url(self, key: str, expires_in: int = 300) -> str:
        token = uuid.uuid4().hex
        path = "/" + key.lstrip('/')
        signature = hmac.new(self.private_key.encode(), (path + token).encode(), hashlib.sha1).hexdigest()
        return f"{self.endpoint}{path}?ik-t={token}&ik-s={signature}&expires_in={int(expires_in)}"

    def get_metadata(self, key: str, provider_id: str | None = None) -> dict:
        if not provider_id:
            raise StorageProviderError(
                "ImageKit metadata requires a provider file ID",
                provider="imagekit",
                details={"operation": "metadata"},
            )
        try:
            response = httpx.get(
                f"https://api.imagekit.io/v1/files/{provider_id}",
                auth=(self.private_key, ""),
                timeout=self.timeout,
            )
            response.raise_for_status()
            data = response.json()
            return {"key": key, "provider": "imagekit", "provider_id": provider_id, "metadata": data}
        except Exception as exc:
            raise StorageProviderError(
                f"ImageKit metadata fetch failed: {exc}",
                provider="imagekit",
                details={"operation": "metadata"},
            ) from exc

    def get_file_path(self, key: str) -> str | None:
        return None

class MockStorageProvider(LocalStorageProvider):
    def upload(self, content: bytes, filename: str, content_type: str, folder: str | None = None) -> StoredObject:
        stored = super().upload(content, filename, content_type, folder)
        stored.provider = "mock"
        return stored

    def get_signed_url(self, key: str, expires_in: int = 300) -> str:
        return f"{self.endpoint}/documents/file/{key}?expires_in={int(expires_in)}"

def get_storage_provider() -> StorageService:
    settings = get_settings()
    provider_name = settings.storage_provider.lower()
    if provider_name == "cloudinary":
        if not settings.cloudinary_cloud_name or not settings.cloudinary_api_key or not settings.cloudinary_api_secret:
            raise StorageProviderError(
                "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are required when STORAGE_PROVIDER=cloudinary",
                provider="cloudinary",
                details={"operation": "configuration"},
            )
        return CloudinaryStorageProvider(
            settings.cloudinary_cloud_name,
            settings.cloudinary_api_key,
            settings.cloudinary_api_secret,
            settings.cloudinary_folder,
        )
    elif provider_name == "imagekit":
        if not settings.imagekit_private_key or not settings.imagekit_public_key or not settings.imagekit_endpoint:
            raise StorageProviderError(
                "IMAGEKIT_PRIVATE_KEY, IMAGEKIT_PUBLIC_KEY, and IMAGEKIT_ENDPOINT are required when STORAGE_PROVIDER=imagekit",
                provider="imagekit",
                details={"operation": "configuration"},
            )
        return ImageKitStorageProvider(
            settings.imagekit_private_key,
            settings.imagekit_public_key,
            settings.imagekit_endpoint,
            settings.imagekit_folder,
        )
    elif provider_name == "mock":
        return MockStorageProvider()
    return LocalStorageProvider()

ImageKitStorage = ImageKitStorageProvider
CloudinaryStorage = CloudinaryStorageProvider
