import json
import re
import logging
from pathlib import Path
from indic_transliteration import sanscript

logger = logging.getLogger("captionai.transliterate")

# Dictionary paths
DICTIONARY_FILE = Path(__file__).parent.parent / "tanglish_dictionary.json"

class TanglishTransliterator:
    def __init__(self):
        self.dictionary = {}
        self.sorted_keys = []
        self.load_dictionary()

    def load_dictionary(self):
        try:
            if DICTIONARY_FILE.exists():
                with open(str(DICTIONARY_FILE), "r", encoding="utf-8") as f:
                    self.dictionary = json.load(f)
                # Sort keys descending by length to match the longest Tamil prefix first
                self.sorted_keys = sorted(self.dictionary.keys(), key=len, reverse=True)
                logger.info(f"Loaded {len(self.dictionary)} words from Tanglish dictionary.")
            else:
                logger.warning(f"Tanglish dictionary not found at: {DICTIONARY_FILE}")
        except Exception as e:
            logger.error(f"Failed to load Tanglish dictionary: {e}")

    def rule_based_transliterate(self, iso_text: str) -> str:
        """
        Applies colloquial phonetics rules to standard ISO transliteration.
        """
        text = iso_text.lower()
        
        # Mapping rules to translate formal diacritic spelling to colloquial spelling
        replacements = [
            # Double/triple consonant clusters
            ("ghgh", "kk"),
            ("jhjh", "ch"),
            ("bhbh", "pp"),
            ("dhdh", "th"),
            ("ḍhḍh", "tt"),
            
            # Nasal-plosive / other common clusters
            ("ñc", "nj"),    # e.g., கொஞ்சம -> konjam
            ("ṇḍh", "nd"),   # e.g., வண்டி -> vandi
            ("ṇṭ", "nd"),    # e.g., alternative
            ("ṭṭ", "tt"),    # e.g., பட்டம் -> pattam
            ("ṟṟ", "tr"),    # e.g., வெற்றி -> vetri, காற்று -> kaatru
            ("mbh", "mb"),   # e.g., ரொம்ப -> romba
            ("mp", "mb"),    # e.g., தம்பி -> thambi
            ("ndh", "nd"),   # e.g., வந்தேன் -> vandhen
            ("nt", "nd"),    # e.g., alternative
            
            # Single consonants
            ("gh", "g"),     # e.g., பேசுகிறான் -> pesugiran, போகிறேன் -> pogiren
            ("jh", "s"),     # e.g., பேசு -> pesu
            ("bh", "p"),     # e.g., படம் -> padam, போறேன் -> poren
            ("dh", "th"),    # e.g., தமிழ் -> thamizh, அது -> athu
            ("ḍh", "d"),     # e.g., எப்படி -> eppadi, படம் -> padam
            ("c", "ch"),     # e.g., சென்னை -> chennai
            ("ñ", "ny"),     # e.g., ஞாயிறு -> nyayiru
            ("ṅ", "ng"),
            ("ṭ", "t"),
            ("ṇ", "n"),
            ("ṉ", "n"),
            ("ṟ", "r"),
            ("ḻ", "zh"),     # e.g., தமிழ் -> tamizh
            ("ḷ", "l"),
            ("ṁ", "m"),
            
            # Vowels
            ("ā", "a"),      # Simple colloquial look
            ("ī", "ee"),     # e.g., வீடு -> veedu
            ("ū", "oo"),     # e.g., ஊர் -> oor
            ("ē", "e"),
            ("ō", "o"),
        ]
        
        for src, dst in replacements:
            text = text.replace(src, dst)
            
        return text

    def transliterate_tamil_span(self, span: str) -> str:
        """
        Transliterates a purely Tamil string using dictionary lookups and rule fallback.
        """
        if not span:
            return ""
            
        # 1. Exact Dictionary Match
        if span in self.dictionary:
            return self.dictionary[span]
            
        # 2. Prefix Matching (e.g. சென்னைக்கு -> chennai + க்கு)
        for key in self.sorted_keys:
            if span.startswith(key):
                prefix_val = self.dictionary[key]
                suffix = span[len(key):]
                suffix_val = self.transliterate_tamil_span(suffix)
                return prefix_val + suffix_val
                
        # 3. Fallback to ISO + rules
        iso_val = sanscript.transliterate(span, sanscript.TAMIL, sanscript.ISO)
        return self.rule_based_transliterate(iso_val)

    def transliterate_word(self, word: str) -> str:
        """
        Splits a word token into Tamil and non-Tamil spans, transliterating only the Tamil parts.
        """
        # Split by Tamil unicode character blocks
        parts = re.split(r'([\u0b80-\u0bff]+)', word)
        result = []
        for part in parts:
            if not part:
                continue
            # If it contains Tamil characters, transliterate it
            if any('\u0b80' <= c <= '\u0bff' for c in part):
                result.append(self.transliterate_tamil_span(part))
            else:
                # Keep English/numeric/special characters unchanged
                result.append(part)
        return "".join(result)

    def transliterate(self, text: str) -> str:
        """
        Transliterates a full caption string into Tanglish.
        Detects mixed language, keeping English words intact.
        """
        if not text:
            return ""
            
        # Tokenize by keeping words and punctuation/spaces separate
        tokens = re.split(r'(\s+|[.,!?;:()]+)', text)
        result = []
        for token in tokens:
            if not token:
                continue
            # Transliterate only if there is any Tamil character inside
            if any('\u0b80' <= c <= '\u0bff' for c in token):
                result.append(self.transliterate_word(token))
            else:
                result.append(token)
        return "".join(result)

transliterator = TanglishTransliterator()
