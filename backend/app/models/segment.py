from typing import Optional
from pydantic import BaseModel

class SegmentBase(BaseModel):
    job_id: str
    index: int
    start_ms: float
    end_ms: float
    detected_language: str
    raw_text: str
    caption_text: str
    edited: bool = False
    confidence: float

class SegmentUpdate(BaseModel):
    caption_text: str

class SegmentResponse(SegmentBase):
    id: str

    class Config:
        from_attributes = True
