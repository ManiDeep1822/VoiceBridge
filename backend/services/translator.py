import os
import json
import html
import re
import urllib.parse
import asyncio
import aiohttp
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
_gemini_client = None

def _get_gemini_client():
    global _gemini_client
    if _gemini_client is None and GEMINI_API_KEY:
        try:
            from google import genai
            _gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        except Exception as e:
            print(f"[Translator] Error initializing Gemini client: {e}")
    return _gemini_client

# Ultra-fast in-memory LRU cache for frequent conversation phrases
_TRANSLATION_CACHE = {}

def _sanitize_translation(raw: str) -> str:
    """
    Cleans raw translation output: unescapes HTML entities, strips quotes,
    removes markdown bolding or LLM preface text, and discards quota warning messages.
    """
    if not raw or not isinstance(raw, str):
        return ""
    
    clean = html.unescape(raw).strip()

    # Reject quota / rate-limit warnings from free translation APIs
    warning_patterns = [
        "MYMEMORY WARNING",
        "QUERY LENGTH LIMIT EXCEEDED",
        "YOU USED ALL AVAILABLE FREE TRANSLATIONS",
        "INVALID LANGUAGE PAIR",
        "PAIR IS NOT AVAILABLE",
        "PLEASE ENTER A VALID TEXT",
        "TRANSLATION NOT FOUND"
    ]
    for pattern in warning_patterns:
        if pattern in clean.upper():
            return ""

    # Strip markdown bolding or backticks
    if clean.startswith("**") and clean.endswith("**") and len(clean) >= 4:
        clean = clean[2:-2].strip()
    if clean.startswith("*") and clean.endswith("*") and len(clean) >= 2:
        clean = clean[1:-1].strip()
    if clean.startswith("`") and clean.endswith("`") and len(clean) >= 2:
        clean = clean[1:-1].strip()
    clean = re.sub(r'^(?:translation|translated text|output|result)\s*:\s*', '', clean, flags=re.IGNORECASE).strip()
    clean = clean.strip('"\'`“”‘’«» \t\r\n')

    return clean

async def translate_text(text: str, source_lang: str, target_lang: str) -> str:
    """
    Translates text from source_lang to target_lang with multi-engine fallback.
    source_lang and target_lang can be full locale codes like 'te-IN', 'hi-IN' or simple 'te', 'hi'.
    """
    if not text or not str(text).strip():
        return ""
    
    clean_text = str(text).strip()[:1000]
    src = (str(source_lang).split("-")[0].strip().lower() if source_lang else "") or "te"
    tgt = (str(target_lang).split("-")[0].strip().lower() if target_lang else "") or "hi"
    
    if src == tgt:
        return clean_text

    cache_key = f"{src}:{tgt}:{clean_text.lower()}"
    if cache_key in _TRANSLATION_CACHE:
        return _TRANSLATION_CACHE[cache_key]

    def _cache_and_return(result_str: str) -> str:
        clean = _sanitize_translation(result_str)
        if clean:
            if len(_TRANSLATION_CACHE) > 2000:
                _TRANSLATION_CACHE.clear()
            _TRANSLATION_CACHE[cache_key] = clean
            return clean
        return ""

    # Option 1: Ultra-high-speed primary Google Translate API via client=gtx (sub-100ms latency)
    try:
        url = (
            f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={src}&tl={tgt}&dt=t&q="
            + urllib.parse.quote(clean_text)
        )
        async with aiohttp.ClientSession() as session:
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=2.5)) as resp:
                if resp.status == 200:
                    raw_data = await resp.text()
                    data = json.loads(raw_data)
                    if isinstance(data, list) and len(data) > 0 and isinstance(data[0], list):
                        translated = "".join(part[0] for part in data[0] if isinstance(part, list) and len(part) > 0 and isinstance(part[0], str))
                        res = _cache_and_return(translated)
                        if res:
                            return res
    except Exception as e:
        print(f"[Translator] Primary Google translate endpoint failed: {e}")

    # Option 2: Fallback Google Translate endpoint via client=dict-chrome-ex
    try:
        url_fallback = (
            f"https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl={src}&tl={tgt}&q="
            + urllib.parse.quote(clean_text)
        )
        async with aiohttp.ClientSession() as session:
            async with session.get(url_fallback, timeout=aiohttp.ClientTimeout(total=2.5)) as resp:
                if resp.status == 200:
                    raw_data = await resp.text()
                    data = json.loads(raw_data)
                    if isinstance(data, list) and len(data) > 0 and isinstance(data[0], str):
                        res = _cache_and_return(data[0])
                        if res:
                            return res
                    elif isinstance(data, str):
                        res = _cache_and_return(data)
                        if res:
                            return res
    except Exception as e:
        print(f"[Translator] Secondary Google translate endpoint failed: {e}")

    # Option 3: Gemini translation fallback if API key is present
    if GEMINI_API_KEY:
        client = _get_gemini_client()
        if client:
            try:
                prompt = (
                    f"You are a real-time conversational translator. Translate the following speech from "
                    f"language code '{src}' into natural conversational '{tgt}'. "
                    f"Output ONLY the translated text, with no explanations, quotes, or notes.\n\n"
                    f"Original: {clean_text}"
                )
                async def _call_gemini():
                    if hasattr(client, "aio") and hasattr(client.aio, "models"):
                        return await client.aio.models.generate_content(
                            model='gemini-2.5-flash',
                            contents=prompt
                        )
                    return await asyncio.to_thread(
                        client.models.generate_content,
                        model='gemini-2.5-flash',
                        contents=prompt
                    )

                response = await asyncio.wait_for(_call_gemini(), timeout=1.8)
                if response and response.text and response.text.strip():
                    res = _cache_and_return(response.text)
                    if res:
                        return res
            except Exception as e:
                print(f"[Translator] Gemini translation fallback due to: {e}")

    # Option 4: Fallback using MyMemory with strict warning guard
    try:
        pair = f"{src}|{tgt}"
        mm_url = f"https://api.mymemory.translated.net/get?q={urllib.parse.quote(clean_text)}&langpair={pair}"
        async with aiohttp.ClientSession() as session:
            async with session.get(mm_url, timeout=aiohttp.ClientTimeout(total=4)) as resp:
                if resp.status == 200:
                    result = await resp.json(content_type=None)
                    if isinstance(result, dict) and result.get("responseStatus") == 200:
                        translated = result.get("responseData", {}).get("translatedText")
                        if isinstance(translated, str):
                            res = _cache_and_return(translated)
                            if res:
                                return res
    except Exception as e:
        print(f"[Translator] MyMemory fallback failed: {e}")

    # Return sanitized original text if all failed
    return clean_text
