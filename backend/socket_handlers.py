import base64
import logging
import re
import time
from typing import Dict, Any, List
from services.translator import translate_text
from services.tts import synthesize_speech

logger = logging.getLogger("socket_handlers")

# Regex to enforce valid room IDs (alphanumeric, dashes, underscores, length 3 to 32)
ROOM_ID_REGEX = re.compile(r"^[a-zA-Z0-9_-]{3,32}$")

# In-memory room store:
# rooms[room_id] = { sid: { "userId": str, "language": str, "voiceGender": str, "isMuted": bool } }
rooms: Dict[str, Dict[str, Any]] = {}
sid_to_room: Dict[str, str] = {}
socket_activity: Dict[str, List[float]] = {}

def register_socket_events(sio):
    @sio.event
    async def connect(sid, environ):
        logger.info(f"Client connected: {sid}")

    @sio.event
    async def disconnect(sid):
        logger.info(f"Client disconnected: {sid}")
        socket_activity.pop(sid, None)
        room_id = sid_to_room.pop(sid, None)
        if room_id and room_id in rooms:
            user_data = rooms[room_id].pop(sid, None)
            # Notify remaining peer
            remaining_sids = list(rooms[room_id].keys())
            if remaining_sids:
                peer_sid = remaining_sids[0]
                await sio.emit("peer_disconnected", {"peerId": user_data.get("userId") if user_data else "peer"}, to=peer_sid)
            else:
                del rooms[room_id]

    @sio.event
    async def join_room(sid, data=None):
        if not isinstance(data, dict):
            data = {}
        room_id = str(data.get("roomId", "")).strip()
        user_id = str(data.get("userId", f"user_{sid[:5]}")).strip()
        language = str(data.get("language", "te")).strip()
        voice_gender = str(data.get("voiceGender", "female")).strip()

        if not room_id or not ROOM_ID_REGEX.match(room_id):
            await sio.emit("error", {"message": "Invalid roomId. Must be 3-32 alphanumeric characters, dashes, or underscores."}, to=sid)
            return

        if room_id not in rooms:
            rooms[room_id] = {}

        # Handle browser refresh / reconnection for same user
        existing_sid = None
        for s, p in rooms[room_id].items():
            if p.get("userId") == user_id:
                existing_sid = s
                break

        if existing_sid and existing_sid != sid:
            logger.info(f"Replacing stale socket {existing_sid} with new socket {sid} for user {user_id}")
            rooms[room_id].pop(existing_sid, None)
            sid_to_room.pop(existing_sid, None)
            try:
                await sio.leave_room(existing_sid, room_id)
            except Exception:
                pass

        if len(rooms[room_id]) >= 2 and sid not in rooms[room_id]:
            await sio.emit("room_full", {"message": "This call is already at maximum capacity (2 participants)."}, to=sid)
            return

        rooms[room_id][sid] = {
            "userId": user_id,
            "language": language,
            "voiceGender": voice_gender,
            "isMuted": False,
            "sid": sid
        }
        sid_to_room[sid] = room_id
        await sio.enter_room(sid, room_id)

        participants = list(rooms[room_id].values())
        logger.info(f"User '{user_id}' ({language}) joined room '{room_id}'. Total participants: {len(participants)}")

        if len(participants) == 1:
            await sio.emit("waiting_for_peer", {"self": rooms[room_id][sid]}, to=sid)
        elif len(participants) == 2:
            # Pair them up with explicit initiator designation for WebRTC negotiation
            p1, p2 = participants[0], participants[1]
            await sio.emit("peer_connected", {"self": p1, "peer": p2, "isInitiator": True}, to=p1["sid"])
            await sio.emit("peer_connected", {"self": p2, "peer": p1, "isInitiator": False}, to=p2["sid"])

    @sio.event
    async def webrtc_offer(sid, data=None):
        if not isinstance(data, dict):
            data = {}
        room_id = sid_to_room.get(sid)
        if room_id and room_id in rooms:
            for peer_sid in rooms[room_id]:
                if peer_sid != sid:
                    await sio.emit("webrtc_offer", data, to=peer_sid)

    @sio.event
    async def webrtc_answer(sid, data=None):
        if not isinstance(data, dict):
            data = {}
        room_id = sid_to_room.get(sid)
        if room_id and room_id in rooms:
            for peer_sid in rooms[room_id]:
                if peer_sid != sid:
                    await sio.emit("webrtc_answer", data, to=peer_sid)

    @sio.event
    async def webrtc_ice_candidate(sid, data=None):
        if not isinstance(data, dict):
            data = {}
        room_id = sid_to_room.get(sid)
        if room_id and room_id in rooms:
            for peer_sid in rooms[room_id]:
                if peer_sid != sid:
                    await sio.emit("webrtc_ice_candidate", data, to=peer_sid)

    @sio.event
    async def update_language(sid, data=None):
        if not isinstance(data, dict):
            data = {}
        room_id = sid_to_room.get(sid)
        if room_id and room_id in rooms and sid in rooms[room_id]:
            new_lang = data.get("language", "te")
            new_gender = data.get("voiceGender", "female")
            rooms[room_id][sid]["language"] = new_lang
            rooms[room_id][sid]["voiceGender"] = new_gender

            # Notify peer of updated language and voice persona
            for peer_sid, peer_info in rooms[room_id].items():
                if peer_sid != sid:
                    await sio.emit("peer_language_updated", {
                        "peerLanguage": new_lang,
                        "voiceGender": new_gender
                    }, to=peer_sid)

    @sio.event
    async def toggle_mute(sid, data=None):
        if not isinstance(data, dict):
            data = {}
        room_id = sid_to_room.get(sid)
        if room_id and room_id in rooms and sid in rooms[room_id]:
            is_muted = bool(data.get("isMuted", False))
            rooms[room_id][sid]["isMuted"] = is_muted
            for peer_sid in rooms[room_id]:
                if peer_sid != sid:
                    await sio.emit("peer_mute_changed", {"isMuted": is_muted}, to=peer_sid)

    @sio.event
    async def speech_segment(sid, data=None):
        """
        Triggered when a user speaks a sentence.
        data: { "originalText": str, "sourceLang": str }
        """
        if not isinstance(data, dict):
            data = {}

        room_id = sid_to_room.get(sid)
        if not room_id or room_id not in rooms:
            return

        sender = rooms[room_id].get(sid)
        if not sender or sender.get("isMuted"):
            return

        # DoS prevention: per-socket sliding window rate limiting (max 5 requests per 3 seconds)
        now = time.time()
        activity = socket_activity.get(sid, [])
        activity = [t for t in activity if now - t < 3.0]
        if len(activity) >= 5:
            logger.warning(f"[RateLimit] Dropping segment spam from socket {sid}")
            await sio.emit("speech_error", {"error": "Rate limit exceeded. Please speak at a natural pace."}, to=sid)
            return
        activity.append(now)
        socket_activity[sid] = activity

        raw_text = str(data.get("originalText", "")).strip()
        # Enforce maximum text payload cap of 1,000 characters
        original_text = raw_text[:1000]
        source_lang = data.get("sourceLang", sender.get("language", "te"))

        if not original_text:
            return

        # Locate the recipient peer
        peers = [p for s, p in rooms[room_id].items() if s != sid]
        if not peers:
            # No listener currently in room
            return

        peer = peers[0]
        peer_sid = peer["sid"]
        target_lang = peer.get("language", "hi")
        # Synthesize using the speaker's chosen voice gender so the listener hears the speaker's persona
        speaker_gender = sender.get("voiceGender", "female")

        try:
            # Notify listener immediately that incoming speech is being translated
            await sio.emit("peer_incoming_speech", {"speakerId": sender["userId"]}, to=peer_sid)

            # 1. Translate text immediately (< 200ms)
            translated_text = await translate_text(original_text, source_lang, target_lang)

            # Stage 1: Deliver instant live subtitle text to listener before audio synthesis
            await sio.emit("peer_incoming_text", {
                "originalText": original_text,
                "translatedText": translated_text,
                "speakerId": sender["userId"],
                "sourceLang": source_lang,
                "targetLang": target_lang
            }, to=peer_sid)

            # Acknowledge to speaker with live subtitle
            await sio.emit("speech_delivered", {
                "originalText": original_text,
                "translatedText": translated_text
            }, to=sid)

            # Stage 2: Fast neural voice synthesis (+15% conversational speed)
            audio_bytes = await synthesize_speech(translated_text, target_lang, speaker_gender, rate="+15%")

            if audio_bytes:
                audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
                
                # Deliver accelerated translated speech audio to peer
                await sio.emit("translated_audio", {
                    "audioBase64": audio_base64,
                    "translatedText": translated_text,
                    "originalText": original_text,
                    "sourceLang": source_lang,
                    "targetLang": target_lang,
                    "speakerId": sender["userId"]
                }, to=peer_sid)
            else:
                # Audio failed or returned empty: release peer's speaking state so UI doesn't hang
                await sio.emit("peer_speech_ended", {"speakerId": sender["userId"]}, to=peer_sid)

        except Exception as e:
            logger.error(f"Error processing speech segment: {e}", exc_info=True)
            await sio.emit("speech_error", {"error": str(e)}, to=sid)
            try:
                await sio.emit("peer_speech_ended", {"speakerId": sender.get("userId", "peer")}, to=peer_sid)
            except Exception:
                pass
