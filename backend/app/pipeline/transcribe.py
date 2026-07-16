import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from faster_whisper import WhisperModel, decode_audio
from faster_whisper.vad import get_speech_timestamps
from app.core.config import settings

logger = logging.getLogger("captionai.transcribe")

class WhisperTranscriber:
    def __init__(self):
        self.model = None

    def load_model(self):
        if self.model is None:
            logger.info(f"Loading Whisper model '{settings.WHISPER_MODEL}' on device '{settings.WHISPER_DEVICE}' with compute type '{settings.WHISPER_COMPUTE_TYPE}'")
            # For Windows CPU running, int8 quantization is highly recommended
            self.model = WhisperModel(
                settings.WHISPER_MODEL,
                device=settings.WHISPER_DEVICE,
                compute_type=settings.WHISPER_COMPUTE_TYPE
            )
            logger.info("Whisper model loaded successfully.")

    def _transcribe_chunk_sync(self, audio_chunk: np.ndarray, chunk_offset_sec: float, locked_lang: str | None) -> tuple[list[dict], str]:
        self.load_model()
        
        # Transcribe the audio slice
        segments, info = self.model.transcribe(
            audio_chunk,
            beam_size=5,
            best_of=5,
            word_timestamps=True,
            vad_filter=False,  # Already chunked using VAD
            condition_on_previous_text=True,
            language=locked_lang
        )
        
        chunk_segments = []
        for seg in segments:
            # Shift timestamps by chunk offset
            start_ms = int((seg.start + chunk_offset_sec) * 1000)
            end_ms = int((seg.end + chunk_offset_sec) * 1000)
            
            words_data = []
            if seg.words:
                for w in seg.words:
                    words_data.append({
                        "word": w.word,
                        "start_ms": int((w.start + chunk_offset_sec) * 1000),
                        "end_ms": int((w.end + chunk_offset_sec) * 1000),
                        "probability": w.probability
                    })

            chunk_segments.append({
                "start_ms": start_ms,
                "end_ms": end_ms,
                "text": seg.text.strip(),
                "words": words_data,
                "probability": seg.avg_logprob,
                "language": info.language
            })
            
        return chunk_segments, info.language

    async def transcribe_audio(
        self, 
        audio_path: str, 
        on_progress=None,
        source_lang: str | None = "ta"
    ) -> list[dict]:
        """
        Transcribes audio using VAD chunking.
        Calls on_progress(percentage: float) to report progress.
        """
        # Run audio decoding in a thread pool since it's CPU bound
        loop = asyncio.get_running_loop()
        logger.info(f"Decoding audio file: {audio_path}")
        audio = await loop.run_in_executor(None, decode_audio, audio_path)
        
        # Get speech timestamps using Silero VAD
        logger.info("Extracting speech timestamps using Silero VAD")
        speech_timestamps = get_speech_timestamps(
            audio,
            threshold=0.5,
            min_speech_duration_ms=250,
            max_speech_duration_s=float('inf'),
            min_silence_duration_ms=100
        )
        
        if not speech_timestamps:
            logger.warning("No speech detected in audio file.")
            return []

        logger.info(f"Detected {len(speech_timestamps)} speech intervals.")
        
        # Group speech intervals into ~30s chunks to avoid cutting words
        chunks = []
        current_chunk = []
        current_duration_samples = 0
        sample_rate = 16000
        max_chunk_samples = 30 * sample_rate # 30 seconds
        
        for interval in speech_timestamps:
            interval_duration = interval["end"] - interval["start"]
            if current_chunk and (current_duration_samples + interval_duration > max_chunk_samples):
                # Close current chunk
                chunks.append(current_chunk)
                current_chunk = [interval]
                current_duration_samples = interval_duration
            else:
                current_chunk.append(interval)
                current_duration_samples += interval_duration
                
        if current_chunk:
            chunks.append(current_chunk)
            
        logger.info(f"Grouped speech into {len(chunks)} chunks for parallel transcription.")
        
        # Transcribe chunks
        all_segments = []
        detected_languages = []
        locked_lang = None if source_lang == "detect" else source_lang
        
        # We limit executor to 2 workers to prevent Windows CPU overload
        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = []
            
            for idx, chunk_intervals in enumerate(chunks):
                # Get start and end sample for chunk, with small 0.5s padding
                start_sample = max(0, chunk_intervals[0]["start"] - int(0.5 * sample_rate))
                end_sample = min(len(audio), chunk_intervals[-1]["end"] + int(0.5 * sample_rate))
                
                chunk_audio = audio[start_sample:end_sample]
                offset_sec = start_sample / sample_rate
                
                # Submit transcription task
                futures.append((idx, chunk_audio, offset_sec))
            
            total_chunks = len(futures)
            for i, (idx, chunk_audio, offset_sec) in enumerate(futures):
                # Check language lock heuristic
                if i >= 3 and not locked_lang and detected_languages:
                    # If 70%+ of the first 3 chunks are the same language, lock it
                    from collections import Counter
                    most_common, count = Counter(detected_languages).most_common(1)[0]
                    if count / len(detected_languages) >= 0.7:
                        locked_lang = most_common
                        logger.info(f"Language lock activated: '{locked_lang}' locked for remaining chunks.")

                # Run transcription synchronously in thread pool
                loop = asyncio.get_running_loop()
                chunk_segs, chunk_lang = await loop.run_in_executor(
                    executor, 
                    self._transcribe_chunk_sync, 
                    chunk_audio, 
                    offset_sec, 
                    locked_lang
                )
                
                all_segments.extend(chunk_segs)
                detected_languages.append(chunk_lang)
                
                if on_progress:
                    progress_pct = int(((i + 1) / total_chunks) * 100)
                    await on_progress(progress_pct)
                    
        # Sort all segments by start time
        all_segments.sort(key=lambda x: x["start_ms"])
        
        # Deduplicate/merge segments with overlaps if any
        # Since we use simple sequential stitching of non-overlapping samples,
        # sorting is sufficient, but let's clean empty segments
        final_segments = [seg for seg in all_segments if seg["text"]]
        
        return final_segments

transcriber = WhisperTranscriber()


def get_transcriber():
    """
    Returns the active transcription backend based on settings.TRANSCRIBE_BACKEND.

    Supported values:
        "groq"  — Groq Cloud Whisper API (fast, no local GPU needed, 25 MB file limit)
        "local" — Local faster-whisper (runs on CPU/GPU, no network required)
    """
    backend = (settings.TRANSCRIBE_BACKEND or "local").lower()
    if backend == "groq":
        from app.pipeline.transcribe_groq import groq_transcriber
        logger.info("Using Groq Cloud Whisper transcription backend.")
        return groq_transcriber
    else:
        logger.info("Using local faster-whisper transcription backend.")
        return transcriber

