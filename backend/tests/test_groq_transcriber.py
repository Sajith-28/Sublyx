import pytest
from unittest.mock import MagicMock, patch
from app.pipeline.transcribe_groq import GroqTranscriber

# Mock response class/structures for Groq Whisper
MOCK_WHISPER_RESPONSE = MagicMock()
MOCK_WHISPER_RESPONSE.language = "ta"
MOCK_WHISPER_RESPONSE.segments = [
    MagicMock(start=0.50, end=2.50, text="வணக்கம் நண்பா"),
    MagicMock(start=2.80, end=5.20, text="எப்படி இருக்கீங்க?"),
]

# Mock response class/structures for Groq Llama 3 (valid JSON)
MOCK_LLAMA_VALID_RESPONSE = MagicMock()
MOCK_LLAMA_VALID_RESPONSE.choices = [
    MagicMock(
        message=MagicMock(
            content='{"translations": [{"index": 0, "text": "Vanakkam nanba"}, {"index": 1, "text": "Epdi irukeenga?"}]}'
        )
    )
]

# Mock response class/structures for Groq Llama 3 (malformed JSON - missing closing bracket)
MOCK_LLAMA_MALFORMED_RESPONSE = MagicMock()
MOCK_LLAMA_MALFORMED_RESPONSE.choices = [
    MagicMock(
        message=MagicMock(
            content='{"translations": [{"index": 0, "text": "Vanakkam nanba"}, {"index": 1, "text": "Epdi irukeenga?"}'
        )
    )
]

@patch("app.pipeline.transcribe_groq.settings")
def test_whisper_parsing_logic(mock_settings):
    """Verifies Groq Whisper response parsing converts seconds to milliseconds correctly."""
    mock_settings.GROQ_API_KEY = "mock-key-1,mock-key-2"
    
    transcriber = GroqTranscriber()
    mock_client = MagicMock()
    mock_client.audio.transcriptions.create.return_value = MOCK_WHISPER_RESPONSE
    
    # We patch _get_client to return our mocked client
    with patch.object(transcriber, "_get_client", return_value=mock_client):
        segments, lang = transcriber._transcribe_sync("/path/to/mock_audio.wav", source_lang="ta")
        
        assert lang == "ta"
        assert len(segments) == 2
        
        # Check start/end time conversion to ms
        assert segments[0]["start_ms"] == 500
        assert segments[0]["end_ms"] == 2500
        assert segments[0]["text"] == "வணக்கம் நண்பா"
        assert segments[1]["start_ms"] == 2800
        assert segments[1]["end_ms"] == 5200


@patch("app.pipeline.transcribe_groq.settings")
def test_llama_translation_success(mock_settings):
    """Verifies LLM translation parses correct JSON formatting successfully."""
    mock_settings.GROQ_API_KEY = "mock-key"
    
    transcriber = GroqTranscriber()
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = MOCK_LLAMA_VALID_RESPONSE
    
    input_segments = [
        {"start_ms": 500, "end_ms": 2500, "text": "வணக்கம் நண்பா", "raw_text": "வணக்கம் நண்பா"},
        {"start_ms": 2800, "end_ms": 5200, "text": "எப்படி இருக்கீங்க?", "raw_text": "எப்படி இருக்கீங்க?"}
    ]
    
    with patch.object(transcriber, "_get_client", return_value=mock_client):
        translated = transcriber.translate_segments(input_segments, target_lang="tanglish")
        
        assert len(translated) == 2
        assert translated[0]["caption_text"] == "Vanakkam nanba"
        assert translated[1]["caption_text"] == "Epdi irukeenga?"


@patch("app.pipeline.transcribe_groq.settings")
def test_llama_translation_malformed_json_fallback(mock_settings):
    """Verifies that malformed JSON returned by LLM is handled gracefully and falls back to raw text."""
    mock_settings.GROQ_API_KEY = "mock-key"
    
    transcriber = GroqTranscriber()
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = MOCK_LLAMA_MALFORMED_RESPONSE
    
    input_segments = [
        {"start_ms": 500, "end_ms": 2500, "text": "வணக்கம் நண்பா", "raw_text": "வணக்கம் நண்பா"},
        {"start_ms": 2800, "end_ms": 5200, "text": "எப்படி இருக்கீங்க?", "raw_text": "எப்படி இருக்கீங்க?"}
    ]
    
    with patch.object(transcriber, "_get_client", return_value=mock_client):
        # The code should try to parse JSON, fail on ValueError/JSONDecodeError,
        # and return the original text without raising an exception.
        translated = transcriber.translate_segments(input_segments, target_lang="tanglish")
        
        assert len(translated) == 2
        # Ensure it fell back gracefully to the original Tamil text
        assert translated[0]["caption_text"] == "வணக்கம் நண்பா"
        assert translated[1]["caption_text"] == "எப்படி இருக்கீங்க?"
