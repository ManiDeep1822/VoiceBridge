import logging
import io
import asyncio
import edge_tts
from typing import Optional

logger = logging.getLogger("tts")

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
    rate: str = "+15%", 
    volume: str = "+50%"
) -> bytes:
    """
    Synthesizes text into high-definition audio bytes (MP3 format).
    Primary: Microsoft Edge Neural TTS (+15% rate).
    Fallback: Google gTTS.
    """
    if not text or not str(text).strip():
        return b""
    
    clean_text = str(text).strip()[:1000]
    voice = get_voice(target_lang, gender)

    # Dynamic timeout: Edge-TTS streams at ~15-20 chars/sec; minimum 4.5s, scaling up to 12.0s for long paragraphs
    calc_timeout = max(4.5, min(12.0, 3.5 + len(clean_text) * 0.015))

    # 1. Primary: Microsoft Edge Neural TTS
    async def _stream_edge():
        communicate = edge_tts.Communicate(clean_text, voice=voice, rate=rate, volume=volume)
        audio_chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["data"])
        return b"".join(audio_chunks)

    try:
        result = await asyncio.wait_for(_stream_edge(), timeout=calc_timeout)
        if result:
            return result
    except (asyncio.TimeoutError, Exception) as e:
        logger.warning(f"[TTS] Edge-TTS synthesis failed or timed out for voice '{voice}': {e}. Using gTTS fallback...")

    # 2. Resilient Fallback: Google Text-to-Speech (gTTS)
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
