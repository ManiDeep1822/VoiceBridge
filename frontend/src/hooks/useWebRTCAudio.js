import { useEffect, useRef, useState, useCallback } from 'react';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export function useWebRTCAudio({
  socket,
  enabled = false,
  isInitiator = false,
  isMuted = false,
  isTranslationPlaying = false,
  duckingPercentage = 15, // 0 to 100 (e.g. 15% volume during translation)
  originalVoiceVolume = 100 // 0 to 100 (normal playback volume)
}) {
  const [p2pStatus, setP2pStatus] = useState('idle'); // 'idle' | 'connecting' | 'connected' | 'disconnected'
  const [hasRemoteAudio, setHasRemoteAudio] = useState(false);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]);
  const hasRemoteDescriptionRef = useRef(false);
  const volumeRampTimerRef = useRef(null);

  // Smoothly ramp the audio element's volume to target level
  const rampVolume = useCallback((targetVol, durationMs = 150) => {
    if (!remoteAudioRef.current) return;
    const audio = remoteAudioRef.current;
    const clampedTarget = Math.max(0, Math.min(1, targetVol));

    if (volumeRampTimerRef.current) {
      cancelAnimationFrame(volumeRampTimerRef.current);
      volumeRampTimerRef.current = null;
    }

    const startVol = audio.volume;
    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Linear ease
      const newVol = startVol + (clampedTarget - startVol) * progress;
      audio.volume = Math.max(0, Math.min(1, newVol));

      if (progress < 1) {
        volumeRampTimerRef.current = requestAnimationFrame(step);
      } else {
        volumeRampTimerRef.current = null;
      }
    };

    volumeRampTimerRef.current = requestAnimationFrame(step);
  }, []);

  // Handle intelligent voice ducking whenever translation starts or stops
  useEffect(() => {
    if (!remoteAudioRef.current) return;

    const baseNormalVolume = Math.max(0, Math.min(1, originalVoiceVolume / 100));
    const duckedVolume = baseNormalVolume * Math.max(0, Math.min(1, duckingPercentage / 100));

    if (isTranslationPlaying) {
      // Duck remote natural voice down to ducked volume
      rampVolume(duckedVolume, 120);
    } else {
      // Restore remote natural voice back to base normal volume
      rampVolume(baseNormalVolume, 180);
    }
  }, [isTranslationPlaying, duckingPercentage, originalVoiceVolume, rampVolume]);

  // Synchronize local mute state with WebRTC audio tracks
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  // Main WebRTC peer connection setup
  useEffect(() => {
    if (!socket || !enabled) {
      setP2pStatus('idle');
      return;
    }

    let isDestroyed = false;
    hasRemoteDescriptionRef.current = false;
    iceCandidatesQueueRef.current = [];

    // Ensure remote audio element exists in memory
    if (!remoteAudioRef.current) {
      const audio = new Audio();
      audio.autoplay = true;
      audio.playsInline = true;
      audio.volume = originalVoiceVolume / 100;
      remoteAudioRef.current = audio;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;
    setP2pStatus('connecting');

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc_ice_candidate', { candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (isDestroyed) return;
      console.log('[WebRTC] connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setP2pStatus('connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setP2pStatus('disconnected');
      }
    };

    pc.ontrack = (event) => {
      if (isDestroyed) return;
      console.log('[WebRTC] Received remote audio track');
      setHasRemoteAudio(true);
      if (remoteAudioRef.current) {
        const stream = event.streams[0] || new MediaStream([event.track]);
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch((err) => {
          console.warn('[WebRTC] Audio auto-play interrupted:', err);
        });
      }
    };

    // Setup local audio track & start negotiation
    const initLocalMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        if (isDestroyed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        stream.getAudioTracks().forEach((track) => {
          track.enabled = !isMuted;
          pc.addTrack(track, stream);
        });

        // If this peer is initiator, create and send the offer
        if (isInitiator) {
          console.log('[WebRTC] Initiating call (creating offer)...');
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc_offer', { offer });
        }
      } catch (err) {
        console.warn('[WebRTC] getUserMedia failed for P2P audio track:', err);
      }
    };

    initLocalMedia();

    // Socket Signaling Event Handlers
    const handleOffer = async (data) => {
      if (isDestroyed || !data?.offer) return;
      try {
        console.log('[WebRTC] Received offer, creating answer...');
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        hasRemoteDescriptionRef.current = true;

        // Drain queued ICE candidates
        while (iceCandidatesQueueRef.current.length > 0) {
          const candidate = iceCandidatesQueueRef.current.shift();
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc_answer', { answer });
      } catch (e) {
        console.error('[WebRTC] Error handling offer:', e);
      }
    };

    const handleAnswer = async (data) => {
      if (isDestroyed || !data?.answer) return;
      try {
        console.log('[WebRTC] Received answer');
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        hasRemoteDescriptionRef.current = true;

        // Drain queued ICE candidates
        while (iceCandidatesQueueRef.current.length > 0) {
          const candidate = iceCandidatesQueueRef.current.shift();
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        }
      } catch (e) {
        console.error('[WebRTC] Error handling answer:', e);
      }
    };

    const handleIceCandidate = async (data) => {
      if (isDestroyed || !data?.candidate) return;
      try {
        if (hasRemoteDescriptionRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
        } else {
          iceCandidatesQueueRef.current.push(data.candidate);
        }
      } catch (e) {
        console.error('[WebRTC] Error adding ICE candidate:', e);
      }
    };

    socket.on('webrtc_offer', handleOffer);
    socket.on('webrtc_answer', handleAnswer);
    socket.on('webrtc_ice_candidate', handleIceCandidate);

    return () => {
      isDestroyed = true;
      socket.off('webrtc_offer', handleOffer);
      socket.off('webrtc_answer', handleAnswer);
      socket.off('webrtc_ice_candidate', handleIceCandidate);

      if (volumeRampTimerRef.current) {
        cancelAnimationFrame(volumeRampTimerRef.current);
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }

      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
      }

      try {
        pc.close();
      } catch (e) {}
      pcRef.current = null;
      setHasRemoteAudio(false);
      setP2pStatus('idle');
    };
  }, [socket, enabled, isInitiator, isMuted, originalVoiceVolume]);

  return {
    p2pStatus,
    hasRemoteAudio,
    remoteAudioElement: remoteAudioRef.current
  };
}
