from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

class JobStatus(str, Enum):
    QUEUED = "queued"
    EXTRACTING_AUDIO = "extracting_audio"
    TRANSCRIBING = "transcribing"
    TRANSLITERATING = "transliterating"
    DONE = "done"
    FAILED = "failed"

class JobBase(BaseModel):
    video_path: str
    audio_path: Optional[str] = None
    duration_sec: float = 0.0

class JobCreate(BaseModel):
    video_path: str

class JobResponse(BaseModel):
    id: str
    status: JobStatus
    progress_pct: float
    video_path: str
    audio_path: Optional[str] = None
    duration_sec: float
    created_at: str
    updated_at: str
    error: Optional[str] = None
    source_lang: Optional[str] = None
    target_lang: Optional[str] = None

    class Config:
        from_attributes = True
