import json
import logging
import requests
from app.core.config import settings

logger = logging.getLogger("captionai.polish_gemini")

def polish_tanglish_gemini(segments: list[dict], api_key: str = None) -> list[dict]:
    """
    Polishes rule-based Tanglish segments using the Gemini API.
    Only processes segments detected as Tamil or mixed.
    Accepts an optional user-supplied API key, falling back to the server-configured key.
    """
    # 1. Resolve API key
    key = api_key or settings.GEMINI_API_KEY
    if not key:
        logger.info("No Gemini API key provided. Skipping Gemini polish pass.")
        return segments

    # 2. Filter segments that need polishing (Tamil or mixed)
    polish_indices = []
    lines_to_polish = []
    
    for idx, seg in enumerate(segments):
        # We polish segments that are Tamil or Mixed, and skip English segments
        if seg["detected_language"] in ("ta", "mixed"):
            polish_indices.append(idx)
            lines_to_polish.append(seg["caption_text"])
            
    if not lines_to_polish:
        logger.info("No Tamil/mixed segments to polish.")
        return segments

    logger.info(f"Sending {len(lines_to_polish)} segments to Gemini for Tanglish polishing.")

    # 3. Call Gemini API in batches (e.g. 50 lines at a time) to fit context and keep response clean
    batch_size = 50
    polished_lines = {}

    for i in range(0, len(lines_to_polish), batch_size):
        batch_lines = lines_to_polish[i:i+batch_size]
        batch_indices = polish_indices[i:i+batch_size]
        
        prompt = (
            "You are a native Chennai Tamil speaker and expert in Tanglish (Romanized colloquial Tamil as typed in WhatsApp, Instagram, and YouTube).\n"
            "The audio was spoken in current-day Chennai Tamil — casual, fast, code-mixed with English words.\n\n"
            "Your task: take these rule-based Tanglish transcription lines and polish them so they read EXACTLY how a young Chennai person would type them.\n\n"
            "STYLE GUIDE (Chennai Tanglish):\n"
            "- Use 'dha' not 'tha' for த when it sounds soft (e.g., 'adhu' not 'athu' for அது)\n"
            "- Use 'pa' for ப, 'po' for போ (e.g., 'pona' not 'bhona', 'poren' not 'bhoren')\n"
            "- Use 'zh' for ழ (e.g., 'tamizh', 'vazhkai')\n"
            "- Keep English words in English (e.g., 'phone', 'okay', 'nice', 'bro', 'super')\n"
            "- Use common Chennai slang naturally: 'da', 'di', 'machi', 'thala', 'bro', 'seri'\n"
            "- Drop overly formal transliterations — write how people SPEAK, not how textbooks spell\n"
            "- 'romba' not 'rompba', 'enna' not 'enna', 'sollu' not 'collu'\n\n"
            "CRITICAL RULES:\n"
            "1. Do NOT translate to English. Keep Tamil words in Roman script (Tanglish).\n"
            "2. Do NOT change meaning or remove words unless they are repeated stutters.\n"
            "3. Keep the line count and order EXACTLY identical to input. Return the exact same number of lines.\n"
            "4. If a line is already in natural English or good Tanglish, do not change it.\n"
            "5. Return the result as a JSON array of strings. No markdown formatting.\n"
            f"   Example: [\"line 1\", \"line 2\", ...]\n\n"
            f"Input lines:\n{json.dumps(batch_lines, ensure_ascii=False)}"
        )
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={key}"
        payload = {
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }],
            "generationConfig": {
                "responseMimeType": "application/json"
            }
        }
        
        try:
            headers = {"Content-Type": "application/json"}
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()
            res_data = response.json()
            
            # Extract JSON array
            text_response = res_data["candidates"][0]["content"]["parts"][0]["text"].strip()
            # Clean possible markdown wrapping if any
            if text_response.startswith("```"):
                # strip ```json and ```
                text_response = re.sub(r"^```(?:json)?\n", "", text_response)
                text_response = re.sub(r"\n```$", "", text_response)
                
            results = json.loads(text_response)
            
            if not isinstance(results, list):
                raise ValueError("Gemini did not return a list")
                
            if len(results) != len(batch_lines):
                raise ValueError(f"Line count mismatch: input had {len(batch_lines)}, output had {len(results)}")
                
            # Store polished results mapped to their index in the original segments list
            for original_idx, polished_text in zip(batch_indices, results):
                polished_lines[original_idx] = polished_text
                
            logger.info(f"Successfully polished batch of {len(batch_lines)} lines.")
            
        except Exception as e:
            logger.error(f"Error calling Gemini API for batch {i//batch_size + 1}: {e}. Falling back to rule-based transliteration.")
            # If batch fails, we don't store anything for these indices, leaving them as-is
            continue

    # 4. Apply polished text back to the segments
    for idx, polished_text in polished_lines.items():
        if polished_text and polished_text.strip():
            segments[idx]["caption_text"] = polished_text.strip()
            
    return segments
