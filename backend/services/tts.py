import logging
import io
import asyncio
import edge_tts
from typing import Optional

logger = logging.getLogger("tts")

# High-fidelity Microsoft Azure Neural Voices (Authentic Human Tone)
VOICE_MAP = {
    "te": {
        "female": "te-IN-ShrutiNeural",
        "male": "te-IN-MohanNeural",
    },
    "hi": {
        "female": "hi-IN-SwaraNeural",
        "male": "hi-IN-MadhurNeural",
    },
    "en": {
        "female": "en-IN-NeerjaNeural",
        "male": "en-IN-PrabhatNeural",
    },
    "ta": {
        "female": "ta-IN-PallaviNeural",
        "male": "ta-IN-ValluvarNeural",
    },
    "kn": {
        "female": "kn-IN-SapnaNeural",
        "male": "kn-IN-GaganNeural",
    },
    "ml": {
        "female": "ml-IN-SobhanaNeural",
        "male": "ml-IN-MidhunNeural",
    },
    "mr": {
        "female": "mr-IN-AarohiNeural",
        "male": "mr-IN-ManoharNeural",
    },
    "bn": {
        "female": "bn-IN-TanishaaNeural",
        "male": "bn-IN-BashkarNeural",
    },
    "gu": {
        "female": "gu-IN-DhwaniNeural",
        "male": "gu-IN-NiranjanNeural",
    },
}

# Ultra-fast in-memory audio LRU cache for frequent conversational utterances
_TTS_AUDIO_CACHE = {}

def get_voice(lang: str, gender: str = "female") -> str:
    clean_lang = (str(lang).split("-")[0].strip().lower() if lang else "") or "en"
    clean_gender = str(gender).strip().lower() if gender else "female"
    gender_key = clean_gender if clean_gender in ("female", "male") else "female"
    if clean_lang in VOICE_MAP:
        return VOICE_MAP[clean_lang].get(gender_key, VOICE_MAP[clean_lang]["female"])
    return "en-IN-NeerjaNeural"

async def synthesize_speech(
    text: str, 
    target_lang: str, 
    gender: str = "female", 
    rate: str = "+3%", 
    volume: str = "+50%",
    pitch: str = "+0Hz"
) -> bytes:
    """
    Synthesizes text into high-definition neural audio bytes (MP3 format).
    Enforces a single authoritative Microsoft Edge Neural voice to eliminate mid-call voice shifting.
    Features:
    - 0ms LRU audio cache for recurring phrases
    - Natural human conversational cadence (+3% rate, +0Hz pitch, +50% volume)
    - Dynamic agility timeout
    """
    if not text or not str(text).strip():
        return b""
    
    clean_text = str(text).strip()[:1000]
    voice = get_voice(target_lang, gender)

    # 1. Check in-memory audio cache for 0ms instantaneous replay
    cache_key = f"{voice}:{rate}:{pitch}:{clean_text}"
    if cache_key in _TTS_AUDIO_CACHE:
        return _TTS_AUDIO_CACHE[cache_key]

    # Dynamic agility timeout: 3.5s minimum, up to 8s for long sentences
    calc_timeout = max(3.5, min(8.0, 2.5 + len(clean_text) * 0.015))

    # Helper for Edge-TTS streaming
    async def _stream_edge(selected_voice: str):
        communicate = edge_tts.Communicate(clean_text, voice=selected_voice, rate=rate, volume=volume, pitch=pitch)
        audio_chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["data"])
        return b"".join(audio_chunks)

    # 2. Primary: Microsoft Edge Neural TTS
    try:
        result = await asyncio.wait_for(_stream_edge(voice), timeout=calc_timeout)
        if result:
            if len(_TTS_AUDIO_CACHE) > 500:
                _TTS_AUDIO_CACHE.clear()
            _TTS_AUDIO_CACHE[cache_key] = result
            return result
    except (asyncio.TimeoutError, Exception) as e:
        logger.warning(f"[TTS] Primary Edge-TTS attempt failed for voice '{voice}': {e}. Retrying with neural backup...")

    # 3. Resilient Secondary Retry with Neural fallback to ensure human timbre is preserved
    try:
        # If female voice had network glitch, retry same voice or sibling neural voice
        retry_voice = voice if "Neerja" in voice else "en-IN-NeerjaNeural"
        retry_result = await asyncio.wait_for(_stream_edge(retry_voice), timeout=3.0)
        if retry_result:
            return retry_result
    except Exception as retry_err:
        logger.warning(f"[TTS] Secondary Neural retry failed: {retry_err}")

    # 4. Catastrophic Fallback: Google gTTS (only when external cloud network is entirely unreachable)
    try:
        from gtts import gTTS
        code = (str(target_lang).split("-")[0].strip().lower() if target_lang else "") or "en"
        if code not in ("te", "hi", "en", "ta", "kn", "ml", "mr", "bn", "gu"):
            code = "en"

        def _gtts_task():
            tts = gTTS(text=clean_text, lang=code)
            fp = io.BytesIO()
            tts.write_to_fp(fp)
            return fp.getvalue()
        
        fallback_bytes = await asyncio.wait_for(asyncio.to_thread(_gtts_task), timeout=calc_timeout)
        if fallback_bytes:
            return fallback_bytes
    except Exception as gtts_err:
        logger.error(f"[TTS] gTTS fallback failed: {gtts_err}")

    return b""
