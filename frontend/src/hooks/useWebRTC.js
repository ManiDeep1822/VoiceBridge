import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

export const DEFAULT_ICE_SERVERS = {
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302'
      ]
    },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:80?transport=tcp',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
        'turn:openrelay.metered.ca:3478',
        'turn:openrelay.metered.ca:3478?transport=tcp'
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

export async function fetchIceServers(baseUrl = '') {
  try {
    const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}/api/ice-servers` : '/api/ice-servers';
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 3500) : null;
    const res = await fetch(url, controller ? { signal: controller.signal } : {});
    if (timer) clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[WebRTC] Dynamic ICE server fetch failed, using built-in STUN/OpenRelay fallback:', err);
  }
  return DEFAULT_ICE_SERVERS;
}

export function useWebRTC({
  backendUrl = '',
  roomId = '',
  userId = '',
  userName = 'Operator',
  language = 'en',
  voiceGender = 'female',
  onRemoteTextReceived,
  onRemoteAudioReceived,
  onRemoteSpeechEnded,
  onPeerSpeakingStateChanged
}) {
  const [connectionState, setConnectionState] = useState('disconnected');
  const [remotePeer, setRemotePeer] = useState(null);
  const [isPeerSpeaking, setIsPeerSpeaking] = useState(false);
  const [pingMs, setPingMs] = useState(18);
  const [errorMsg, setErrorMsg] = useState(null);

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const dataChannelRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const iceServersRef = useRef(DEFAULT_ICE_SERVERS);

  // Initialize Socket.IO connection
  const connect = useCallback((targetRoomId) => {
    if (!targetRoomId) return;

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (dataChannelRef.current) {
      try { dataChannelRef.current.close(); } catch (e) {}
      dataChannelRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) {}
      pcRef.current = null;
    }
    if (socketRef.current) {
      try {
        socketRef.current.disconnect();
      } catch (e) {}
      socketRef.current = null;
    }

    setConnectionState('connecting');
    setErrorMsg(null);

    // Asynchronously resolve dynamic ICE servers with STUN/OpenRelay fallback
    fetchIceServers(backendUrl).then((resolvedIce) => {
      if (resolvedIce && resolvedIce.iceServers) {
        iceServersRef.current = resolvedIce;
      }
    }).catch(() => {});

    const socket = io(backendUrl || undefined, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 10000
    });

    socketRef.current = socket;

    socket.on('connect_error', (err) => {
      console.warn('[WebRTC] Signaling socket connection error:', err);
      setErrorMsg('Signaling server unreachable. Retrying connection...');
    });

    socket.on('error', (err) => {
      console.warn('[WebRTC] Socket server error:', err);
      if (err?.message) {
        setErrorMsg(err.message);
      }
    });

    socket.on('connect', () => {
      setConnectionState('connecting');
      socket.emit('join_room', {
        roomId: targetRoomId,
        userId: userId || `OP-${Math.floor(1000 + Math.random() * 9000)}`,
        userName: userName || 'Operator',
        language,
        voiceGender
      });
    });

    socket.on('waiting_for_peer', () => {
      setConnectionState('waiting');
      setRemotePeer(null);
      setIsPeerSpeaking(false);
    });

    socket.on('peer_connected', async (data) => {
      setConnectionState('connected');
      setRemotePeer(data.peer);

      // Resolve ICE servers (use pre-fetched config or fallback)
      let iceConfig = iceServersRef.current || DEFAULT_ICE_SERVERS;
      if (!iceConfig || !iceConfig.iceServers || iceConfig.iceServers.length === 0) {
        iceConfig = await fetchIceServers(backendUrl);
        iceServersRef.current = iceConfig;
      }

      // Create WebRTC PeerConnection for ultra-low latency signaling & data
      const pc = new RTCPeerConnection(iceConfig);
      pcRef.current = pc;

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc_ice_candidate', { candidate: event.candidate });
        }
      };

      // Data Channel for sub-20ms real-time speaking state and telemetry
      if (data.isInitiator) {
        const dc = pc.createDataChannel('vox-telemetry');
        dataChannelRef.current = dc;
        dc.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'speaking_state') {
              setIsPeerSpeaking(Boolean(parsed.isSpeaking));
              if (onPeerSpeakingStateChanged) onPeerSpeakingStateChanged(Boolean(parsed.isSpeaking));
            } else if (onRemoteTextReceived) {
              onRemoteTextReceived(parsed);
            }
          } catch (e) {}
        };

        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc_offer', { offer });
        } catch (err) {
          console.error('[WebRTC] Offer error:', err);
        }
      } else {
        pc.ondatachannel = (event) => {
          const dc = event.channel;
          dataChannelRef.current = dc;
          dc.onmessage = (evt) => {
            try {
              const parsed = JSON.parse(evt.data);
              if (parsed.type === 'speaking_state') {
                setIsPeerSpeaking(Boolean(parsed.isSpeaking));
                if (onPeerSpeakingStateChanged) onPeerSpeakingStateChanged(Boolean(parsed.isSpeaking));
              } else if (onRemoteTextReceived) {
                onRemoteTextReceived(parsed);
              }
            } catch (e) {}
          };
        };
      }
    });

    socket.on('webrtc_offer', async (data) => {
      if (!pcRef.current || !data?.offer) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emit('webrtc_answer', { answer });
      } catch (err) {
        console.warn('[WebRTC] Offer handling error:', err);
      }
    });

    socket.on('webrtc_answer', async (data) => {
      if (!pcRef.current || !data?.answer) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      } catch (err) {
        console.warn('[WebRTC] Answer handling error:', err);
      }
    });

    socket.on('webrtc_ice_candidate', async (data) => {
      if (!pcRef.current || !data?.candidate) return;
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.warn('[WebRTC] ICE candidate error:', err);
      }
    });

    // Real-time "Peer is Speaking..." state notification
    socket.on('peer_speaking_state', (data) => {
      const isSpeaking = Boolean(data.isSpeaking);
      setIsPeerSpeaking(isSpeaking);
      if (onPeerSpeakingStateChanged) onPeerSpeakingStateChanged(isSpeaking);
    });

    // Dynamic peer language and name updates
    socket.on('peer_language_updated', (data) => {
      setRemotePeer(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          language: data.peerLanguage || prev.language,
          voiceGender: data.voiceGender || prev.voiceGender,
          userName: data.userName || prev.userName
        };
      });
    });

    // Remote speech subtitles and translated audio
    socket.on('peer_incoming_text', (data) => {
      setIsPeerSpeaking(false);
      if (onRemoteTextReceived) onRemoteTextReceived(data);
    });

    socket.on('translated_audio', (data) => {
      setIsPeerSpeaking(false);
      if (onRemoteAudioReceived) onRemoteAudioReceived(data);
    });

    socket.on('peer_speech_ended', (data) => {
      setIsPeerSpeaking(false);
      if (onRemoteSpeechEnded) onRemoteSpeechEnded(data);
    });

    socket.on('peer_disconnected', () => {
      setConnectionState('waiting');
      setRemotePeer(null);
      setIsPeerSpeaking(false);
      if (pcRef.current) {
        try { pcRef.current.close(); } catch (e) {}
        pcRef.current = null;
      }
    });

    socket.on('room_full', (data) => {
      setErrorMsg(data?.message || 'Call room is at full capacity (2 participants).');
      setConnectionState('disconnected');
    });

    socket.on('room_terminated', (data) => {
      setErrorMsg(data?.message || 'Call room was terminated by administrator.');
      setConnectionState('disconnected');
      setRemotePeer(null);
      setIsPeerSpeaking(false);
      if (pcRef.current) {
        try { pcRef.current.close(); } catch (e) {}
        pcRef.current = null;
      }
    });

    // Measure Ping
    pingIntervalRef.current = setInterval(() => {
      const start = Date.now();
      socket.emit('ping_check', null, () => {
        setPingMs(Math.max(8, Date.now() - start));
      });
    }, 5000);

  }, [backendUrl, language, onPeerSpeakingStateChanged, onRemoteAudioReceived, onRemoteSpeechEnded, onRemoteTextReceived, userId, userName, voiceGender]);

  const disconnect = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (dataChannelRef.current) {
      try { dataChannelRef.current.close(); } catch (e) {}
      dataChannelRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) {}
      pcRef.current = null;
    }
    if (socketRef.current) {
      try {
        socketRef.current.emit('leave_room');
        socketRef.current.disconnect();
      } catch (e) {}
      socketRef.current = null;
    }
    setConnectionState('disconnected');
    setRemotePeer(null);
    setIsPeerSpeaking(false);
  }, []);

  // Broadcast speaking state (start/stop speaking into mic)
  const emitSpeakingState = useCallback((isSpeaking) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('speaking_state', { isSpeaking: Boolean(isSpeaking) });
    }
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      try {
        dataChannelRef.current.send(JSON.stringify({
          type: 'speaking_state',
          isSpeaking: Boolean(isSpeaking)
        }));
      } catch (e) {}
    }
  }, []);

  // Send speech segment to peer
  const emitSpeechSegment = useCallback((originalText, sourceLang, targetLang, domain = 'general') => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('speech_segment', {
        originalText,
        sourceLang,
        targetLang,
        domain
      });
    }
  }, []);

  // Update language preference on signaling server
  const updateLanguage = useCallback((newLang, newGender, newName) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('update_language', {
        language: newLang,
        voiceGender: newGender || 'female',
        userName: newName || userName
      });
    }
  }, [userName]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionState,
    remotePeer,
    isPeerSpeaking,
    pingMs,
    errorMsg,
    connect,
    disconnect,
    emitSpeakingState,
    emitSpeechSegment,
    updateLanguage
  };
}
