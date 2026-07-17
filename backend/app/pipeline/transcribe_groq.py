import os
import logging
import asyncio
from pathlib import Path

from groq import Groq
from app.core.config import settings

logger = logging.getLogger("captionai.transcribe_groq")

# Groq Whisper endpoint limits
GROQ_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB hard limit
GROQ_WHISPER_MODEL = "whisper-large-v3"


class GroqTranscriber:
    """
    Transcribes audio using Groq's hosted Whisper API.
    Returns the same segment dict format as WhisperTranscriber so the
    rest of the pipeline is backend-agnostic.

    Segment dict schema:
        start_ms    : int   — segment start in milliseconds
        end_ms      : int   — segment end in milliseconds
        text        : str   — transcript text
        words       : list  — empty list (Groq verbose_json omits word-level data)
        probability : float — always 0.0 (not provided by Groq API)
        language    : str   — detected or requested language code
    """

    def __init__(self):
        self._client: Groq | None = None

    def _get_client(self) -> Groq:
        if not self._client:
            keys = self._get_keys()
            self._client = Groq(api_key=keys[0])
        return self._client

    def _get_keys(self) -> list[str]:
        api_key_str = settings.GROQ_API_KEY
        if not api_key_str:
            raise ValueError(
                "GROQ_API_KEY is not set. "
                "Add it to your .env file or set TRANSCRIBE_BACKEND=local to use the local model."
            )
        return [k.strip() for k in api_key_str.split(",") if k.strip()]

    def _execute_with_failover(self, operation_fn):
        """
        Executes a Groq API function with automatic failover/load-balancing
        across multiple comma-separated GROQ_API_KEYs.
        """
        keys = self._get_keys()
        last_error = None
        for api_key in keys:
            try:
                client = Groq(api_key=api_key)
                return operation_fn(client)
            except Exception as e:
                logger.error(f"Groq API key starting with '{api_key[:8]}' failed: {e}")
                last_error = e
        raise last_error or RuntimeError("All configured Groq API keys failed.")

    def _transcribe_sync(
        self, 
        audio_path: str, 
        source_lang: str | None = "ta",
        target_lang: str | None = None
    ) -> tuple[list[dict], str]:
        """
        Blocking call to Groq Whisper API.
        Returns (segments, detected_language).
        """
        file_size = Path(audio_path).stat().st_size
        if file_size > GROQ_MAX_FILE_SIZE_BYTES:
            raise ValueError(
                f"Audio file is {file_size / 1024 / 1024:.1f} MB which exceeds Groq's "
                f"25 MB limit. Use TRANSCRIBE_BACKEND=local for long audio files."
            )

        client = self._get_client()
        is_english_target = target_lang and target_lang.lower().strip() == "english"

        # Chennai Tamil prompt — tells Whisper exactly what kind of speech to expect.
        # This dramatically improves recognition of colloquial Tamil words, slang,
        # code-mixed English, and common Chennai expressions.
        tamil_prompt = (
            "இது சென்னை தமிழில் பேசப்படும் உரையாடல். "
            "பேச்சு தமிழ், ஆங்கிலம் கலந்த Tanglish பாணியில் இருக்கும். "
            "சென்னை, தமிழ்நாடு, கோயம்பேடு, தி.நகர், அண்ணா நகர், "
            "மரீனா பீச், போனா, வந்தேன், சாப்பிட்டேன், "
            "என்ன பண்றே, எப்படி இருக்க, சொல்லு, பாரு, "
            "okay, super, nice, bro, da, machi, "
            "போறேன், வாங்க, நல்லா இருக்கு, செம, mass"
        )

        lang_code = None if source_lang == "detect" else source_lang

        with open(audio_path, "rb") as audio_file:
            if is_english_target:
                logger.info(f"Sending audio to Groq Whisper Translations API ({file_size / 1024 / 1024:.1f} MB)...")
                transcription = client.audio.translations.create(
                    file=audio_file,
                    model=GROQ_WHISPER_MODEL,
                    response_format="verbose_json",  # Required for timestamped segments
                    temperature=0.0,                  # Force deterministic timings to prevent drift
                )
                detected_language = "en"
            else:
                logger.info(f"Sending audio to Groq Whisper Transcriptions API ({file_size / 1024 / 1024:.1f} MB)...")
                transcription = client.audio.transcriptions.create(
                    file=audio_file,
                    model=GROQ_WHISPER_MODEL,
                    response_format="verbose_json",  # Required for timestamped segments
                    language=lang_code,               # Force language code or use None for auto-detect
                    prompt=tamil_prompt if lang_code == "ta" else None, # Guide Whisper if Tamil is selected
                    temperature=0.0,                  # Force deterministic timings to prevent drift/hallucination
                )
                detected_language = getattr(transcription, "language", "unknown")

        raw_segments = getattr(transcription, "segments", []) or []

        segments = []
        for seg in raw_segments:
            # Groq returns segment as an object or dict depending on SDK version
            if isinstance(seg, dict):
                start_s = seg.get("start", 0.0)
                end_s = seg.get("end", 0.0)
                text = (seg.get("text") or "").strip()
            else:
                start_s = getattr(seg, "start", 0.0)
                end_s = getattr(seg, "end", 0.0)
                text = (getattr(seg, "text", "") or "").strip()

            if not text:
                continue

            segments.append({
                "start_ms": int(start_s * 1000),
                "end_ms": int(end_s * 1000),
                "text": text,
                "words": [],       # Groq verbose_json doesn't expose word-level timestamps
                "probability": 0.0,
                "language": detected_language,
            })

        logger.info(
            f"Groq transcription complete: {len(segments)} segments, "
            f"language='{detected_language}'"
        )
        return segments, detected_language

    async def transcribe_audio(
        self,
        audio_path: str,
        on_progress=None,
        source_lang: str | None = "ta",
        target_lang: str | None = None,
    ) -> list[dict]:
        """
        Async-safe wrapper around the Groq Whisper API.
        Matches the WhisperTranscriber.transcribe_audio interface so jobs.py
        doesn't need to know which backend is active.

        Progress reports:
            50%  — before sending to Groq (upload/inference can take a few seconds)
            100% — after segments are received
        """
        if on_progress:
            await on_progress(50.0)

        loop = asyncio.get_running_loop()
        segments, _ = await loop.run_in_executor(
            None,
            self._transcribe_sync,
            audio_path,
            source_lang,
            target_lang,
        )

        if on_progress:
            await on_progress(100.0)

        return segments

    def translate_segments(self, segments: list[dict], target_lang: str) -> list[dict]:
        """
        Translates caption segments to the target language.
        If target is Tamil, preserves transcription.
        If target is Tanglish, uses the custom dictionary-based transliterator.
        Otherwise, translates using Llama 3.
        """
        if not segments:
            return []

        target_lang_lower = target_lang.lower().strip()
        
        # 1. If target is Tamil, keep the raw transcribed Tamil text
        if target_lang_lower == "tamil":
            for seg in segments:
                seg["caption_text"] = seg.get("raw_text", seg.get("text", ""))
            return segments
            
        # 2. If target is Tanglish, use the local dictionary-based transliterator
        if target_lang_lower == "tanglish":
            from app.pipeline.transliterate import transliterator
            for seg in segments:
                raw_text = seg.get("raw_text", seg.get("text", ""))
                seg["caption_text"] = transliterator.transliterate(raw_text)
            return segments

        # 3. For other languages, process using Llama 3 with enhanced Chennai Tamil slang understanding
        to_translate = []
        for idx, seg in enumerate(segments):
            raw = seg.get("raw_text", seg.get("text", ""))
            to_translate.append({
                "index": idx,
                "text": raw.strip()
            })

        logger.info(f"Translating {len(segments)} segments to '{target_lang}' using Llama 3...")
        client = self._get_client()

        system_prompt = (
            f"You are a professional translator and captioner.\n"
            f"Your task is to translate transcript segments from colloquial Chennai Tamil into the target language: '{target_lang}'.\n\n"
            f"Context: The source text is spoken in a casual, colloquial Chennai Tamil dialect. "
            f"It often includes code-mixed English words, local slang, and specific phrasing. Use these translation rules:\n"
            f"- 'மச்சி' / 'மச்சா' / 'மாப்ள' / 'தல' -> 'buddy' / 'brother' / 'friend'\n"
            f"- 'செம' / 'மாஸ்' / 'தூள்' / 'கெத்து' -> 'awesome' / 'cool' / 'great' / 'stylish'\n"
            f"- 'ரொம்ப' / 'ரொம்பவும்' -> 'very' / 'so much'\n"
            f"- 'பண்றேன்' / 'செய்றேன்' -> 'doing' / 'making'\n"
            f"- 'என்ன பண்ற' / 'என்ன பண்றே' -> 'what are you doing?'\n"
            f"- 'கடுப்பு' / 'வெறி' -> 'annoyed' / 'angry'\n"
            f"- 'சாப்ட்டியா' / 'சாப்பிட்டியா' -> 'did you eat?'\n"
            f"- 'போயிட்டு வரேன்' / 'வரேன்' -> 'goodbye' / 'see you'\n\n"
            f"Rules:\n"
            f"1. Translate accurately while matching the exact meaning, style, and casual tone of the speaker.\n"
            f"2. Keep the translation conversational, concise, and formatted for video subtitles.\n"
            f"3. EXTREME PRECISION REQUIRED for technical and medical terms. Double-check your spelling for all scientific/medical words (e.g., output 'Gynecomastia', not 'Gynogomastia').\n"
            f"4. STRICTLY keep the exact same number of items and match the 'index' fields in the output.\n"
            f"5. Output MUST be a valid JSON object containing an array of objects under the key 'translations', where each object has keys: 'index' and 'text'. Do not include markdown code block formatting.\n\n"
            f"Example Output Format:\n"
            f'{{"translations": [{{"index": 0, "text": "translated text here"}}]}}'
        )

        try:
            import json
            chat_completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(to_translate, ensure_ascii=False)}
                ]
            )

            response_text = chat_completion.choices[0].message.content
            parsed = json.loads(response_text)
            translations = parsed.get("translations", [])

            # Map translations back to segments using index
            translation_map = {item["index"]: item["text"] for item in translations}

            for idx, seg in enumerate(segments):
                if idx in translation_map:
                    seg["caption_text"] = translation_map[idx]
                else:
                    seg["caption_text"] = seg.get("raw_text", seg.get("text", ""))

        except Exception as e:
            logger.error(f"Failed to translate segments using Llama 3: {e}")
            for seg in segments:
                seg["caption_text"] = seg.get("raw_text", seg.get("text", ""))

        return segments


groq_transcriber = GroqTranscriber()
