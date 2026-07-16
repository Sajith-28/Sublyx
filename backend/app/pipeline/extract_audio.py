import subprocess
import wave
import logging
from pathlib import Path

logger = logging.getLogger("captionai.extract_audio")

def extract_audio(video_path: str, audio_path: str) -> float:
    """
    Extracts audio from a video file, normalizes it, and saves it as a 16kHz mono WAV file.
    Returns the duration of the audio in seconds.
    """
    video_p = Path(video_path)
    audio_p = Path(audio_path)
    
    if not video_p.exists():
        raise FileNotFoundError(f"Video file not found at: {video_path}")
        
    audio_p.parent.mkdir(parents=True, exist_ok=True)
    
    logger.info(f"Extracting audio from {video_p} to {audio_p}")
    
    # Run ffmpeg with loudnorm for volume normalization
    # -ar 16000: 16kHz sample rate (Whisper standard)
    # -ac 1: 1 channel (mono)
    # -vn: no video
    cmd = [
        "ffmpeg", "-y",
        "-i", str(video_p),
        "-ar", "16000",
        "-ac", "1",
        "-vn",
        "-af", "loudnorm",
        str(audio_p)
    ]
    
    try:
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        logger.info("Audio extraction completed successfully via ffmpeg.")
    except subprocess.CalledProcessError as e:
        logger.warning(f"ffmpeg extraction with loudnorm failed (code {e.returncode}). Retrying without loudnorm...")
        # Fallback to simple extraction if loudnorm fails (e.g. video is too short or lacks audio structure)
        cmd_fallback = [
            "ffmpeg", "-y",
            "-i", str(video_p),
            "-ar", "16000",
            "-ac", "1",
            "-vn",
            str(audio_p)
        ]
        result = subprocess.run(cmd_fallback, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        logger.info("Audio extraction completed successfully via fallback ffmpeg.")
    
    # Calculate duration of the generated WAV file
    duration = 0.0
    if audio_p.exists():
        with wave.open(str(audio_p), 'rb') as wav_file:
            frames = wav_file.getnframes()
            rate = wav_file.getframerate()
            duration = frames / float(rate)
            logger.info(f"WAV audio duration: {duration:.2f} seconds")
            
    return duration
