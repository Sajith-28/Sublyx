import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # MongoDB settings (optional, defaults to local SQLite if empty)
    MONGO_URI: str = ""
    MONGO_DB_NAME: str = "sublyx"

    # SQLite fallback settings
    SQLITE_DB_PATH: str = "storage/sublyx.db"

    # File storage paths
    STORAGE_DIR: str = "storage"
    UPLOAD_DIR: str = "storage/videos"
    AUDIO_DIR: str = "storage/audio"
    EXPORT_DIR: str = "storage/exports"

    # Whisper configuration
    # Options: tiny, base, small, medium, large-v3, large-v3-turbo
    WHISPER_MODEL: str = "base"
    WHISPER_DEVICE: str = "cpu"  # "cpu", "cuda", or "auto"
    WHISPER_COMPUTE_TYPE: str = "int8"  # "int8", "float16"

    # Transcription backend: "local" (faster-whisper) or "groq" (Groq Cloud Whisper API)
    TRANSCRIBE_BACKEND: str = "local"

    # Groq API key — required when TRANSCRIBE_BACKEND=groq
    # Get yours at https://console.groq.com
    GROQ_API_KEY: str = ""

    # Optional Gemini Polish
    GEMINI_API_KEY: str = ""

    # CORS Allowed Origins
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def upload_path(self) -> Path:
        path = Path(self.UPLOAD_DIR)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def audio_path(self) -> Path:
        path = Path(self.AUDIO_DIR)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def export_path(self) -> Path:
        path = Path(self.EXPORT_DIR)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def sqlite_db_path(self) -> Path:
        path = Path(self.SQLITE_DB_PATH)
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

settings = Settings()
