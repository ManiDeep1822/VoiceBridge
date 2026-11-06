import edge_tts
from typing import Optional

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
    code = lang.split("-")[0].lower()
    gender_key = gender.lower() if gender.lower() in ("female", "male") else "female"
    if code in VOICE_MAP:
        return VOICE_MAP[code].get(gender_key, VOICE_MAP[code]["female"])
    return "en-IN-NeerjaNeural"

async def synthesize_speech(
    text: str, 
    target_lang: str, 
    gender: str = "female", 
    rate: str = "+15%", 
    volume: str = "+50%"
) -> bytes:
    """
    Synthesizes text using Microsoft Edge Neural TTS into high-definition audio bytes (MP3 format).
    rate: speed adjustment e.g. "+15%" for natural fast conversational cadence.
    volume: volume boost e.g. "+50%" for loud, clear output on quiet laptop speakers.
    """
    if not text or not text.strip():
        return b""
    
    voice = get_voice(target_lang, gender)
    communicate = edge_tts.Communicate(text.strip(), voice=voice, rate=rate, volume=volume)
    
    audio_chunks = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_chunks.append(chunk["data"])
            
    return b"".join(audio_chunks)
