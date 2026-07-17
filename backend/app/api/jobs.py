import logging
import asyncio
from datetime import datetime
from uuid import uuid4
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException, Header, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.core.config import settings
from app.core.db import db_mgr
from app.models.job import JobStatus, JobResponse
from app.models.segment import SegmentResponse, SegmentUpdate
from app.pipeline.extract_audio import extract_audio
from app.pipeline.transcribe import get_transcriber
from app.pipeline.transliterate import transliterator
from app.pipeline.polish_gemini import polish_tanglish_gemini
from app.pipeline.export import to_srt, to_vtt, to_txt

logger = logging.getLogger("captionai.jobs")
router = APIRouter()

# Background task execution
async def run_pipeline(
    job_id: str, 
    video_path: str, 
    source_lang: str = "ta", 
    target_lang: str = "tanglish", 
    gemini_key: str = None
):
    audio_path = str(settings.audio_path / f"{job_id}.wav")
    try:
        # 1. Extract Audio
        await db_mgr.update_job(job_id, {
            "status": JobStatus.EXTRACTING_AUDIO,
            "progress_pct": 10.0
        })
        logger.info(f"Job {job_id}: Extracting audio...")
        
        # Run synchronous audio extraction in a separate thread
        loop = asyncio.get_running_loop()
        duration = await loop.run_in_executor(
            None, 
            extract_audio, 
            video_path, 
            audio_path
        )
        
        await db_mgr.update_job(job_id, {
            "audio_path": audio_path,
            "duration_sec": duration,
            "status": JobStatus.TRANSCRIBING,
            "progress_pct": 20.0
        })
        
        # 2. Transcribe Audio
        logger.info(f"Job {job_id}: Transcribing audio...")
        
        async def on_progress(pct: float):
            # Map whisper progress 0-100 to overall progress 20-80
            overall_pct = 20.0 + (pct * 0.6)
            await db_mgr.update_job(job_id, {"progress_pct": round(overall_pct, 1)})
 
        active_transcriber = get_transcriber()
        raw_segments = await active_transcriber.transcribe_audio(
            audio_path,
            on_progress=on_progress,
            source_lang=source_lang
        )
        
        # 3. Translate/Transliterate
        await db_mgr.update_job(job_id, {
            "status": JobStatus.TRANSLITERATING,
            "progress_pct": 85.0
        })
        logger.info(f"Job {job_id}: Translating/transliterating Tamil to {target_lang}...")
        
        processed_segments = []
        for idx, seg in enumerate(raw_segments):
            text = seg["text"]
            
            # Simple heuristic for segment language detection
            has_tamil = any('\u0b80' <= c <= '\u0bff' for c in text)
            has_english = any('a' <= c.lower() <= 'z' for c in text)
            
            if has_tamil and has_english:
                lang = "mixed"
            elif has_tamil:
                lang = "ta"
            elif has_english:
                lang = "en"
            else:
                lang = "other"
                
            processed_segments.append({
                "id": str(uuid4()),
                "job_id": job_id,
                "index": idx,
                "start_ms": seg["start_ms"],
                "end_ms": seg["end_ms"],
                "detected_language": lang,
                "raw_text": text,
                "caption_text": text, # default to raw text
                "edited": False,
                "confidence": float(seg.get("probability") or 0.0)
            })

        # Process translation
        target_lang_lower = target_lang.lower()
        if target_lang_lower != "tamil":
            # If Groq API key is available, run Llama 3 translation
            if settings.GROQ_API_KEY:
                from app.pipeline.transcribe_groq import groq_transcriber
                try:
                    processed_segments = await loop.run_in_executor(
                        None,
                        groq_transcriber.translate_segments,
                        processed_segments,
                        target_lang
                    )
                except Exception as e:
                    logger.error(f"Error during Groq translation: {e}. Falling back to rule-based.")
                    if target_lang_lower == "tanglish":
                        for seg in processed_segments:
                            if seg["detected_language"] in ("ta", "mixed"):
                                seg["caption_text"] = transliterator.transliterate(seg["raw_text"])
            else:
                # Local rule-based fallback for Tanglish only
                if target_lang_lower == "tanglish":
                    for seg in processed_segments:
                        if seg["detected_language"] in ("ta", "mixed"):
                            seg["caption_text"] = transliterator.transliterate(seg["raw_text"])
        else:
            # If target is Tamil, keep the transcribed Tamil text
            for seg in processed_segments:
                seg["caption_text"] = seg["raw_text"]
            
        # 4. Optional Gemini Polish Pass (Only if target is Tanglish)
        effective_gemini_key = gemini_key or settings.GEMINI_API_KEY
        if effective_gemini_key and target_lang_lower == "tanglish":
            await db_mgr.update_job(job_id, {"progress_pct": 90.0})
            logger.info(f"Job {job_id}: Polishing Tanglish text using Gemini...")
            # Run blocking HTTP post in a thread pool
            processed_segments = await loop.run_in_executor(
                None, 
                polish_tanglish_gemini, 
                processed_segments, 
                effective_gemini_key
            )
            
        # 5. Insert segments and complete job
        if processed_segments:
            await db_mgr.insert_segments(processed_segments)
            
        await db_mgr.update_job(job_id, {
            "status": JobStatus.DONE,
            "progress_pct": 100.0
        })
        logger.info(f"Job {job_id}: Pipeline completed successfully.")
        
    except Exception as e:
        logger.exception(f"Job {job_id} failed:")
        await db_mgr.update_job(job_id, {
            "status": JobStatus.FAILED,
            "error": str(e)
        })



@router.post("/api/jobs", response_model=dict)
async def create_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    source_lang: str = Form("ta"),
    target_lang: str = Form("tanglish"),
    x_gemini_key: str = Header(None, alias="X-Gemini-Key")
):
    """
    Accepts video upload, creates job, and spawns the background pipeline with lang choices.
    """
    job_id = str(uuid4())
    
    # Save uploaded file
    file_ext = Path(file.filename).suffix or ".mp4"
    video_path = str(settings.upload_path / f"{job_id}{file_ext}")
    
    logger.info(f"Saving uploaded video to {video_path}")
    try:
        with open(video_path, "wb") as buffer:
            while chunk := await file.read(65536):
                buffer.write(chunk)
    except Exception as e:
        logger.error(f"Failed to save upload file: {e}")
        raise HTTPException(status_code=500, detail="Failed to save video upload.")
        
    # Insert job record
    job_data = {
        "id": job_id,
        "status": JobStatus.QUEUED,
        "progress_pct": 0.0,
        "video_path": video_path,
        "audio_path": None,
        "duration_sec": 0.0,
        "error": None,
        "source_lang": source_lang,
        "target_lang": target_lang
    }
    await db_mgr.insert_job(job_data)
    
    # Add background processing task
    background_tasks.add_task(run_pipeline, job_id, video_path, source_lang, target_lang, x_gemini_key)
    
    return {"job_id": job_id}

@router.get("/api/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    """
    Fetch job status and metadata.
    """
    job = await db_mgr.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.get("/api/jobs")
async def list_jobs(limit: int = 10):
    """
    List recent jobs.
    """
    jobs = await db_mgr.list_jobs(limit)
    return jobs

@router.get("/api/jobs/{job_id}/segments", response_model=list[SegmentResponse])
async def get_job_segments(job_id: str):
    """
    Fetch all generated caption segments for a job.
    """
    job = await db_mgr.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    segments = await db_mgr.get_segments(job_id)
    return segments

@router.put("/api/jobs/{job_id}/segments/{segment_id}", response_model=dict)
async def update_segment(job_id: str, segment_id: str, payload: SegmentUpdate):
    """
    Update a segment's caption text (inline editing).
    """
    job = await db_mgr.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    await db_mgr.update_segment(segment_id, {
        "caption_text": payload.caption_text,
        "edited": True
    })
    return {"status": "success"}

@router.get("/api/jobs/{job_id}/export")
async def export_captions(job_id: str, format: str = "srt"):
    """
    Export segments in SRT, VTT or TXT format as a downloadable file.
    """
    job = await db_mgr.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    segments = await db_mgr.get_segments(job_id)
    if not segments:
        raise HTTPException(status_code=400, detail="No segments available for export.")
        
    if format == "srt":
        content = to_srt(segments)
        media_type = "application/x-subrip"
        filename = f"captions_{job_id}.srt"
    elif format == "vtt":
        content = to_vtt(segments)
        media_type = "text/vtt"
        filename = f"captions_{job_id}.vtt"
    elif format == "txt":
        content = to_txt(segments)
        media_type = "text/plain"
        filename = f"transcript_{job_id}.txt"
    else:
        raise HTTPException(status_code=400, detail="Invalid export format. Supported: srt, vtt, txt")
        
    # Write content to temporary export file
    export_filepath = settings.export_path / filename
    with open(str(export_filepath), "w", encoding="utf-8") as f:
        f.write(content)
        
    return FileResponse(
        path=str(export_filepath),
        media_type=media_type,
        filename=filename
    )

@router.get("/api/jobs/{job_id}/audio")
async def get_audio(job_id: str):
    """
    Stream the extracted audio file for a job.
    """
    job = await db_mgr.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    audio_path = job.get("audio_path")
    if not audio_path or not Path(audio_path).exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    return FileResponse(
        path=audio_path,
        media_type="audio/wav",
        filename=f"audio_{job_id}.wav"
    )

@router.websocket("/ws/jobs/{job_id}")
async def websocket_progress(websocket: WebSocket, job_id: str):
    """
    WebSocket endpoint streaming live job status and progress updates.
    """
    await websocket.accept()
    logger.info(f"WebSocket client connected for job: {job_id}")
    try:
        while True:
            job = await db_mgr.get_job(job_id)
            if not job:
                await websocket.send_json({"status": "failed", "error": "Job not found"})
                break
                
            await websocket.send_json({
                "status": job["status"],
                "progress_pct": job["progress_pct"],
                "error": job["error"]
            })
            
            # Close connection if job terminal state reached
            if job["status"] in (JobStatus.DONE, JobStatus.FAILED):
                break
                
            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected for job: {job_id}")
    except Exception as e:
        logger.error(f"WebSocket error for job {job_id}: {e}")
        try:
            await websocket.close()
        except:
            pass
