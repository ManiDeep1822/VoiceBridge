import os
import json
import urllib.parse
import aiohttp
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Ultra-fast in-memory LRU cache for frequent conversation phrases
_TRANSLATION_CACHE = {}

async def translate_text(text: str, source_lang: str, target_lang: str) -> str:
    """
    Translates text from source_lang to target_lang.
    source_lang and target_lang can be full locale codes like 'te-IN', 'hi-IN' or simple 'te', 'hi'.
    """
    if not text or not text.strip():
        return ""
    
    src = source_lang.split("-")[0].lower()
    tgt = target_lang.split("-")[0].lower()
    
    if src == tgt:
        return text

    cache_key = f"{src}:{tgt}:{text.strip().lower()}"
    if cache_key in _TRANSLATION_CACHE:
        return _TRANSLATION_CACHE[cache_key]

    def _cache_and_return(result_str: str) -> str:
        clean = result_str.strip()
        if clean:
            if len(_TRANSLATION_CACHE) > 2000:
                _TRANSLATION_CACHE.clear()
            _TRANSLATION_CACHE[cache_key] = clean
        return clean

    # Option 1: Try Gemini if API key is present
    if GEMINI_API_KEY:
        try:
            from google import genai
            client = genai.Client(api_key=GEMINI_API_KEY)
            prompt = (
                f"You are a real-time conversational translator. Translate the following speech from "
                f"language code '{src}' into natural conversational '{tgt}'. "
                f"Output ONLY the translated text, with no explanations, quotes, or notes.\n\n"
                f"Original: {text}"
            )
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            if response.text and response.text.strip():
                return _cache_and_return(response.text)
        except Exception as e:
            print(f"[Translator] Gemini translation fallback due to: {e}")

    # Option 2: High-speed free translation API via client=gtx
    try:
        url = (
            f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={src}&tl={tgt}&dt=t&q="
            + urllib.parse.quote(text)
        )
        async with aiohttp.ClientSession() as session:
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                if resp.status == 200:
                    raw_data = await resp.text()
                    data = json.loads(raw_data)
                    translated = "".join(part[0] for part in data[0] if part and part[0])
                    if translated:
                        return _cache_and_return(translated)
    except Exception as e:
        print(f"[Translator] Primary Google translate endpoint failed: {e}")

    # Option 3: Fallback using MyMemory free translation API
    try:
        pair = f"{src}|{tgt}"
        mm_url = f"https://api.mymemory.translated.net/get?q={urllib.parse.quote(text)}&langpair={pair}"
        async with aiohttp.ClientSession() as session:
            async with session.get(mm_url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    translated = result.get("responseData", {}).get("translatedText")
                    if translated:
                        return _cache_and_return(translated)
    except Exception as e:
        print(f"[Translator] MyMemory fallback failed: {e}")

    # Return original text if all failed
    return text
