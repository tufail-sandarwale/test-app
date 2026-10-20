from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MOCK_GPS_", env_file=".env", extra="ignore")
    database_url: SecretStr
    jwt_secret: SecretStr
    token_minutes: int = Field(default=30, ge=1, le=1440)
    rate_limit_storage_uri: str = "memory://"

    @field_validator("jwt_secret")
    @classmethod
    def strong_secret(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value()) < 32:
            raise ValueError("JWT secret must contain at least 32 characters.")
        return value

    @field_validator("database_url")
    @classmethod
    def supported_database(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value().startswith(("postgresql+psycopg://", "sqlite://")):
            raise ValueError("Use PostgreSQL with psycopg, or SQLite for local tests.")
        return value