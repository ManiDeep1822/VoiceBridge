import os
import json
import html
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
    and discards quota warning messages from free APIs.
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
        "PLEASE ENTER A VALID",
        "TRANSLATION NOT FOUND",
        "IS NOT AVAILABLE"
    ]
    for pattern in warning_patterns:
        if pattern in clean.upper():
            return ""

    # Strip accidental surrounding quotation marks
    if (clean.startswith('"') and clean.endswith('"')) or (clean.startswith("'") and clean.endswith("'")):
        clean = clean[1:-1].strip()

    return clean

async def translate_text(text: str, source_lang: str, target_lang: str) -> str:
    """
    Translates text from source_lang to target_lang with multi-engine fallback.
    source_lang and target_lang can be full locale codes like 'te-IN', 'hi-IN' or simple 'te', 'hi'.
    """
    if not text or not text.strip():
        return ""
    
    src = str(source_lang or "te").split("-")[0].lower() or "te"
    tgt = str(target_lang or "hi").split("-")[0].lower() or "hi"
    
    if src == tgt:
        return text

    cache_key = f"{src}:{tgt}:{text.strip().lower()}"
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

    # Option 1: Try Gemini if API key is present (non-blocking async with 3.5s timeout)
    if GEMINI_API_KEY:
        client = _get_gemini_client()
        if client:
            try:
                prompt = (
                    f"You are a real-time conversational translator. Translate the following speech from "
                    f"language code '{src}' into natural conversational '{tgt}'. "
                    f"Output ONLY the translated text, with no explanations, quotes, or notes.\n\n"
                    f"Original: {text}"
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

                response = await asyncio.wait_for(_call_gemini(), timeout=3.5)
                if response and response.text and response.text.strip():
                    res = _cache_and_return(response.text)
                    if res:
                        return res
            except Exception as e:
                print(f"[Translator] Gemini translation fallback due to: {e}")

    # Option 2: High-speed primary Google Translate API via client=gtx
    try:
        url = (
            f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={src}&tl={tgt}&dt=t&q="
            + urllib.parse.quote(text)
        )
        async with aiohttp.ClientSession() as session:
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=5)) as resp:
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

    # Option 3: Fallback Google Translate endpoint via client=dict-chrome-ex
    try:
        url_fallback = (
            f"https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl={src}&tl={tgt}&dt=t&q="
            + urllib.parse.quote(text)
        )
        async with aiohttp.ClientSession() as session:
            headers = {"User-Agent": "Mozilla/5.0 (Chrome-Extension; dict-chrome-ex)"}
            async with session.get(url_fallback, headers=headers, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                if resp.status == 200:
                    raw_data = await resp.text()
                    data = json.loads(raw_data)
                    if isinstance(data, list) and len(data) > 0 and isinstance(data[0], list):
                        translated = "".join(part[0] for part in data[0] if isinstance(part, list) and len(part) > 0 and isinstance(part[0], str))
                        res = _cache_and_return(translated)
                        if res:
                            return res
    except Exception as e:
        print(f"[Translator] Secondary Google translate endpoint failed: {e}")

    # Option 4: Fallback using MyMemory with strict warning guard
    try:
        pair = f"{src}|{tgt}"
        mm_url = f"https://api.mymemory.translated.net/get?q={urllib.parse.quote(text)}&langpair={pair}"
        async with aiohttp.ClientSession() as session:
            async with session.get(mm_url, timeout=aiohttp.ClientTimeout(total=4)) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    translated = result.get("responseData", {}).get("translatedText")
                    res = _cache_and_return(translated)
                    if res:
                        return res
    except Exception as e:
        print(f"[Translator] MyMemory fallback failed: {e}")

    # Return original text if all failed
    return text
