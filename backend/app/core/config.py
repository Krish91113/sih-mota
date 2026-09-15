from functools import lru_cache
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
class Settings(BaseSettings):
    app_name: str = "MoTA Scholarship Management System"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://mota:mota@localhost:5432/mota"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 14
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://localhost:8080"
    imagekit_endpoint: str = ""
    imagekit_public_key: str = ""
    imagekit_private_key: str = ""
    imagekit_folder: str = "mota/documents"
    storage_provider: str = "mock"
    email_provider: str = "smtp"
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 465
    smtp_username: str = Field(default="", validation_alias=AliasChoices("SMTP_USERNAME", "SMTP_USER"))
    smtp_password: str = Field(default="", validation_alias=AliasChoices("SMTP_PASSWORD", "SMTP_PASS"))
    smtp_from_email: str = Field(default="", validation_alias=AliasChoices("SMTP_FROM_EMAIL", "MAIL_FROM"))
    smtp_from_name: str = "MoTA Scholarship System"
    smtp_timeout_seconds: float = 20.0
    max_upload_bytes: int = 10485760
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
@lru_cache
def get_settings(): return Settings()
