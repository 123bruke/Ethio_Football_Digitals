from functools import lru_cache
from pathlib import Path
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(PROJECT_ROOT / ".env"), env_file_encoding="utf-8", extra="ignore")

    app_name: str = "PitchSide API"
    environment: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    database_url: str = ""
    postgres_db: str = "pitchside"
    postgres_user: str = "pitchside"
    postgres_password: str = "pitchside_dev"
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "pitchside_neo4j_dev"
    neo4j_enabled: bool = True
    jwt_secret: str = "CHANGE_ME_TO_A_LONG_RANDOM_SECRET_BEFORE_DEPLOYMENT"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60 * 12
    ollama_base_url: str = "http://host.docker.internal:11434"
    ollama_model: str = "llama3.1:8b"
    assistant_timeout_seconds: int = 45
    model_artifact_path: str = str(PROJECT_ROOT / "artifacts" / "football_result.joblib")
    model_metadata_path: str = str(PROJECT_ROOT / "artifacts" / "football_result_metadata.json")
    team_state_path: str = str(PROJECT_ROOT / "data" / "gold" / "team_state_snapshot.json")
    models_directory: str = str(PROJECT_ROOT / "artifacts" / "models")
    data_directory: str = str(PROJECT_ROOT / "data")
    admin_email: str = ""
    admin_username: str = "admin"
    admin_password: str = ""
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    @model_validator(mode="after")
    def assemble_local_database_url(self):
        if not self.database_url:
            self.database_url = URL.create(
                "postgresql+psycopg",
                username=self.postgres_user,
                password=self.postgres_password,
                host="localhost",
                port=5432,
                database=self.postgres_db,
            ).render_as_string(hide_password=False)
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
