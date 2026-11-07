import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { 
  Mic, 
  MicOff, 
  PhoneOff, 
  Copy, 
  Check, 
  Share2, 
  Volume2, 
  AlertCircle,
  MessageSquare,
  Download,
  X,
  Radio,
  Subtitles,
  Sparkles
} from 'lucide-react';
import VoiceBridgeLogo from './VoiceBridgeLogo';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useAudioQueue } from '../hooks/useAudioQueue';
import { SUPPORTED_LANGUAGES } from './Lobby';

export default function CallRoom({ 
  roomId, 
  language = 'te', 
  voiceGender = 'female', 
  onLeaveCall 
}) {
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connecting' | 'waiting' | 'connected' | 'error'
  const [peerInfo, setPeerInfo] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isPeerMuted, setIsPeerMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [speechStatus, setSpeechStatus] = useState('Idle');
  const [lastDeliveredSentence, setLastDeliveredSentence] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [transcriptHistory, setTranscriptHistory] = useState([]);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);
  const [isSpeakingRemote, setIsSpeakingRemote] = useState(false);

  const socketRef = useRef(null);
  const speechTimerRef = useRef(null);
  const remoteSpeakingTimeoutRef = useRef(null);

  const { enqueueAudio, isPlaying: isQueuePlaying, volume, setVolume, stopAll } = useAudioQueue({
    onStartSpeaking: () => {
      if (remoteSpeakingTimeoutRef.current) {
        clearTimeout(remoteSpeakingTimeoutRef.current);
        remoteSpeakingTimeoutRef.current = null;
      }
      setIsSpeakingRemote(true);
      setSpeechStatus('Speaking translated audio');
    },
    onStopSpeaking: () => {
      setIsSpeakingRemote(false);
      setSpeechStatus('Idle');
    }
  });

  const handleSpeechFinal = useCallback((phrase) => {
    if (!socketRef.current || isMuted || !phrase.trim() || connectionStatus !== 'connected') return;

    setSpeechStatus('Translating phrase...');
    setIsSpeakingLocal(true);

    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    speechTimerRef.current = setTimeout(() => {
      setIsSpeakingLocal(false);
      setSpeechStatus('Idle');
    }, 6000);

    socketRef.current.emit('speech_segment', {
      originalText: phrase.trim(),
      sourceLang: language
    });
  }, [isMuted, language, connectionStatus]);

  // Dedicated speech recognition: never interrupted or aborted by incoming audio playback
  const { 
    isListening, 
    isSupported: isSTTSupported, 
    micError, 
    startListening, 
    stopListening,
    retry: retrySpeech 
  } = useSpeechRecognition({
    language,
    isMuted,
    onSpeechFinal: handleSpeechFinal,
    onSpeechStart: () => {
      setIsSpeakingLocal(true);
      setSpeechStatus('Listening to speech...');
    },
    onSpeechEnd: () => {
      setIsSpeakingLocal(false);
    }
  });

  const enqueueAudioRef = useRef(enqueueAudio);
  enqueueAudioRef.current = enqueueAudio;
  const startListeningRef = useRef(startListening);
  startListeningRef.current = startListening;
  const stopListeningRef = useRef(stopListening);
  stopListeningRef.current = stopListening;
  const stopAllRef = useRef(stopAll);
  stopAllRef.current = stopAll;
  const languageRef = useRef(language);
  languageRef.current = language;
  const voiceGenderRef = useRef(voiceGender);
  voiceGenderRef.current = voiceGender;

  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.emit('update_language', {
        language,
        voiceGender
      });
    }
  }, [language, voiceGender]);

  useEffect(() => {
    const isLocal = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.startsWith('10.') ||
      window.location.hostname.endsWith('.local')
    );
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 
      (isLocal ? window.location.origin : 'https://voicebridge-yd1k.onrender.com');
    
    // Hardened socket connection with persistent websocket transport and auto-reconnect
    const socketInstance = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    let userId = sessionStorage.getItem('voicebridge_user_id');
    if (!userId) {
      userId = `user_${Math.random().toString(36).substring(2, 7)}`;
      sessionStorage.setItem('voicebridge_user_id', userId);
    }

    socketInstance.on('connect_error', (err) => {
      console.error('[Socket] connect_error:', err);
      setConnectionStatus('error');
      setErrorMessage('Unable to reach voice translation server. Reconnecting...');
    });

    socketInstance.on('error', (data) => {
      console.error('[Socket] error:', data);
      setErrorMessage(data?.message || 'Server error occurred.');
      setConnectionStatus('error');
    });

    socketInstance.on('connect', () => {
      setConnectionStatus('connecting');
      setErrorMessage('');
      socketInstance.emit('join_room', {
        roomId,
        userId,
        language: languageRef.current,
        voiceGender: voiceGenderRef.current
      });
    });

    socketInstance.on('waiting_for_peer', () => {
      setConnectionStatus('waiting');
    });

    socketInstance.on('peer_connected', (data) => {
      setConnectionStatus('connected');
      setErrorMessage('');
      setPeerInfo(data.peer);
      setIsPeerMuted(Boolean(data.peer?.isMuted));
      startListeningRef.current();
    });

    socketInstance.on('peer_language_updated', (data) => {
      setPeerInfo((prev) => prev ? { 
        ...prev, 
        language: data.peerLanguage || prev.language,
        voiceGender: data.voiceGender || prev.voiceGender 
      } : null);
    });

    socketInstance.on('peer_mute_changed', (data) => {
      setIsPeerMuted(Boolean(data.isMuted));
    });

    socketInstance.on('peer_disconnected', () => {
      setConnectionStatus('waiting');
      setPeerInfo(null);
      stopAllRef.current();
      stopListeningRef.current();
      setIsSpeakingLocal(false);
      setIsSpeakingRemote(false);
      setSpeechStatus('Idle');
    });

    socketInstance.on('room_full', (data) => {
      setErrorMessage(data?.message || 'Call is at maximum capacity (2 participants).');
      setConnectionStatus('error');
    });

    socketInstance.on('peer_incoming_speech', () => {
      setIsSpeakingRemote(true);
      setSpeechStatus('Translating incoming speech...');
      if (remoteSpeakingTimeoutRef.current) clearTimeout(remoteSpeakingTimeoutRef.current);
      remoteSpeakingTimeoutRef.current = setTimeout(() => {
        setIsSpeakingRemote(false);
        setSpeechStatus('Idle');
      }, 7000);
    });

    socketInstance.on('peer_speech_ended', () => {
      if (remoteSpeakingTimeoutRef.current) clearTimeout(remoteSpeakingTimeoutRef.current);
      setIsSpeakingRemote(false);
      setSpeechStatus('Idle');
    });

    socketInstance.on('peer_incoming_text', (payload) => {
      setLastDeliveredSentence({
        speaker: 'peer',
        originalText: payload.originalText,
        translatedText: payload.translatedText
      });
      setTranscriptHistory((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          speaker: 'peer',
          originalText: payload.originalText,
          translatedText: payload.translatedText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setSpeechStatus('Translating phrase...');
    });

    socketInstance.on('translated_audio', (payload) => {
      if (payload.audioBase64) {
        enqueueAudioRef.current(payload.audioBase64, {
          originalText: payload.originalText,
          translatedText: payload.translatedText
        });
      }
    });

    socketInstance.on('speech_delivered', (data) => {
      if (speechTimerRef.current) {
        clearTimeout(speechTimerRef.current);
        speechTimerRef.current = null;
      }
      setLastDeliveredSentence({
        speaker: 'self',
        originalText: data.originalText,
        translatedText: data.translatedText
      });
      setTranscriptHistory((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          speaker: 'self',
          originalText: data.originalText,
          translatedText: data.translatedText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setTimeout(() => {
        setIsSpeakingLocal(false);
        setSpeechStatus('Idle');
      }, 800);
    });

    socketInstance.on('speech_error', (err) => {
      console.error('[Socket] speech_error:', err);
      if (speechTimerRef.current) {
        clearTimeout(speechTimerRef.current);
        speechTimerRef.current = null;
      }
      setIsSpeakingLocal(false);
      setSpeechStatus('Translation service temporarily busy');
      setTimeout(() => setSpeechStatus('Idle'), 3000);
    });

    return () => {
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
      if (remoteSpeakingTimeoutRef.current) clearTimeout(remoteSpeakingTimeoutRef.current);
      stopListeningRef.current();
      stopAllRef.current();
      socketInstance.disconnect();
    };
  }, [roomId]);

  useEffect(() => {
    let interval = null;
    if (connectionStatus === 'connected') {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [connectionStatus]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyRoomLink = async () => {
    const shareableUrl = `${window.location.origin}/#room=${roomId}`;
    let success = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareableUrl);
        success = true;
      }
    } catch (e) {
      console.warn('[CallRoom] Clipboard API error:', e);
    }

    if (!success) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = shareableUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (err) {
        console.error('[CallRoom] Fallback copy error:', err);
      }
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (socketRef.current) {
      socketRef.current.emit('toggle_mute', { isMuted: nextMuted });
    }
  };

  const downloadTranscript = () => {
    if (transcriptHistory.length === 0) {
      alert("No conversation has occurred yet to download.");
      return;
    }
    const header = [
      `VOICEBRIDGE CALL TRANSCRIPT`,
      `Room ID: ${roomId}`,
      `Date: ${new Date().toLocaleString()}`,
      `Duration: ${formatTimer(callDuration)}`,
      `Participants: You (${currentLangObj.name}) <=> Partner (${peerLangObj?.name || 'Partner'})\n\n`
    ].join('\n');

    const lines = transcriptHistory.map((item) => {
      const speakerName = item.speaker === 'self' 
        ? `You (${currentLangObj.name})` 
        : `Partner (${peerLangObj?.name || 'Partner'})`;
      return `[${item.time}] ${speakerName}:\n  ${item.originalText}\n  -> ${item.translatedText}\n`;
    }).join('\n');

    const fullText = header + lines;
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voicebridge-${roomId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentLangObj = SUPPORTED_LANGUAGES.find(l => l.code === language) || {
    name: language.toUpperCase(),
    native: language.toUpperCase()
  };

  const peerLangObj = peerInfo 
    ? (SUPPORTED_LANGUAGES.find(l => l.code === peerInfo.language) || { name: peerInfo.language, native: peerInfo.language })
    : null;

  return (
    <div className="dynamic-screen justify-between p-3 sm:p-5 md:p-6 safe-area-top safe-area-bottom select-none">
      
      {/* Top Header Navigation */}
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <VoiceBridgeLogo size={22} showText={false} />
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1">
            <span className="text-xs font-mono font-medium text-zinc-300">{roomId}</span>
            <button
              type="button"
              onClick={copyRoomLink}
              className="text-zinc-400 hover:text-white transition-all cursor-pointer p-0.5"
              title="Copy share link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <span className="text-xs text-zinc-400 font-mono hidden sm:inline">
            {connectionStatus === 'connected' ? formatTimer(callDuration) : 'Connecting...'}
          </span>
        </div>

        {/* Right Header Status */}
        <div className="flex items-center gap-2">
          {connectionStatus === 'connected' && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>AI Translation Call</span>
            </div>
          )}
          {connectionStatus === 'waiting' && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Waiting for partner</span>
            </div>
          )}
          {connectionStatus === 'error' && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-medium">
              <span>Disconnected</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Calling Stage: Google Meet / FaceTime Participant Tiles */}
      <main className="max-w-5xl mx-auto w-full my-auto z-10 flex flex-col items-center justify-center py-2 sm:py-4">
        
        {/* Error / Full Room Alert */}
        {(errorMessage || connectionStatus === 'error') && (
          <div className="mb-4 sm:mb-6 text-center max-w-sm w-full bg-rose-950/40 border border-rose-800/80 p-5 rounded-2xl shadow-xl animate-in fade-in">
            <div className="w-10 h-10 rounded-full bg-rose-900/60 border border-rose-700 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-5 h-5 text-rose-400" />
            </div>
            <h3 className="text-sm font-semibold text-rose-200 mb-1">
              {errorMessage ? 'Call Notice' : 'Connection Disconnected'}
            </h3>
            <p className="text-xs text-rose-300/80 mb-4">
              {errorMessage || 'Disconnected from the translation server. Please check your internet connection.'}
            </p>
            <button
              type="button"
              onClick={onLeaveCall}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
            >
              Return to Lobby
            </button>
          </div>
        )}

        {/* Unsupported Browser Speech Recognition Warning */}
        {!isSTTSupported && (
          <div className="mb-4 max-w-lg w-full p-3.5 rounded-2xl bg-amber-950/80 border border-amber-800 text-amber-200 text-xs flex items-center gap-2.5 shadow-xl animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              Your browser does not support Web Speech Recognition. For live voice translation, please use Google Chrome, Microsoft Edge, or Safari.
            </span>
          </div>
        )}

        {/* Waiting For Peer Card */}
        {connectionStatus === 'waiting' && !errorMessage && (
          <div className="mb-4 sm:mb-6 text-center max-w-sm w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl shadow-sm">
            <h3 className="text-sm font-semibold text-white mb-1">Waiting for someone to join</h3>
            <p className="text-xs text-zinc-400 mb-3">
              Share the call link with your friend to connect.
            </p>
            <button
              type="button"
              onClick={copyRoomLink}
              className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              <span>{copied ? 'Link Copied!' : 'Share Call Link'}</span>
            </button>
          </div>
        )}

        {/* Mic Permission Banner if blocked with Actionable Retry Button */}
        {micError && (
          <div className="mb-4 max-w-lg w-full p-3 sm:p-3.5 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center justify-between gap-3 shadow-xl animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{micError}</span>
            </div>
            <button
              type="button"
              onClick={retrySpeech}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold text-xs whitespace-nowrap cursor-pointer transition-all shadow-md shrink-0 flex items-center gap-1.5"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Allow / Retry Mic</span>
            </button>
          </div>
        )}

        {/* The 2 Google Meet Style Participant Tiles */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
          
          {/* Tile 1: You */}
          <div className={`studio-tile relative aspect-[4/3] flex flex-col justify-between p-4 sm:p-5 ${
            isSpeakingLocal ? 'studio-tile-active' : ''
          }`}>
            {/* Top Bar of Tile: Status & Audio Equalizer */}
            <div className="flex items-center justify-between z-10">
              <span className="text-[11px] font-medium text-zinc-400 bg-black/40 px-2 py-0.5 rounded border border-white/5">
                {currentLangObj.name}
              </span>
              {/* Dynamic Equalizer Bars */}
              {isSpeakingLocal && !isMuted && (
                <div className="flex items-center gap-1 h-5">
                  <div className="eq-bar" />
                  <div className="eq-bar" />
                  <div className="eq-bar" />
                  <div className="eq-bar" />
                </div>
              )}
            </div>

            {/* Center Avatar */}
            <div className="flex flex-col items-center justify-center my-auto z-10">
              <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center border transition-all ${
                isSpeakingLocal 
                  ? 'border-emerald-500 bg-emerald-950/20 shadow-md shadow-emerald-500/20' 
                  : 'border-zinc-700 bg-zinc-800'
              }`}>
                <span className="text-2xl font-bold text-zinc-200">YOU</span>
              </div>
            </div>

            {/* Bottom Bar of Tile: Name & Mic status */}
            <div className="flex items-center justify-between z-10">
              <div className="flex flex-col bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-white">You</span>
                  <span className="text-[10px] text-zinc-400">({currentLangObj.native})</span>
                </div>
                <div className="text-[10px]">
                  {micError ? (
                    <span className="text-rose-400 font-medium">Mic Permission Needed</span>
                  ) : isMuted ? (
                    <span className="text-zinc-500">Muted</span>
                  ) : isSpeakingLocal ? (
                    <span className="text-emerald-400 font-medium">Speaking...</span>
                  ) : isListening ? (
                    <span className="text-emerald-400">Microphone Active</span>
                  ) : (
                    <span className="text-zinc-400">Microphone Ready</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={micError ? retrySpeech : toggleMute}
                className={`p-1.5 rounded-full cursor-pointer transition-all ${
                  micError 
                    ? 'bg-rose-600 text-white animate-pulse' 
                    : isMuted 
                    ? 'bg-red-600/90 text-white' 
                    : 'bg-black/50 text-zinc-300'
                }`}
                title={micError ? 'Click to Allow/Retry Microphone' : isMuted ? 'Unmute' : 'Mute'}
              >
                {micError ? <AlertCircle className="w-3.5 h-3.5" /> : isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
              </button>
            </div>
          </div>

          {/* Tile 2: Partner */}
          <div className={`studio-tile relative aspect-[4/3] flex flex-col justify-between p-4 sm:p-5 ${
            isSpeakingRemote ? 'studio-tile-active' : ''
          }`}>
            {/* Top Bar of Tile */}
            <div className="flex items-center justify-between z-10">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-zinc-400 bg-black/40 px-2 py-0.5 rounded border border-white/5">
                  {peerLangObj ? peerLangObj.name : 'Partner'}
                </span>
                {isPeerMuted ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-rose-300 font-semibold bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/40 animate-pulse">
                    <MicOff className="w-2.5 h-2.5" />
                    Muted
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    <Sparkles className="w-2.5 h-2.5" />
                    AI Voice Only
                  </span>
                )}
              </div>
              {/* Dynamic Equalizer Bars */}
              {isSpeakingRemote && !isPeerMuted && (
                <div className="flex items-center gap-1 h-5">
                  <div className="eq-bar" />
                  <div className="eq-bar" />
                  <div className="eq-bar" />
                  <div className="eq-bar" />
                </div>
              )}
            </div>

            {/* Center Avatar */}
            <div className="flex flex-col items-center justify-center my-auto z-10">
              <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center border transition-all ${
                isPeerMuted
                  ? 'border-rose-500/60 bg-rose-950/20 shadow-sm'
                  : isSpeakingRemote 
                  ? 'border-emerald-500 bg-emerald-950/20 shadow-md shadow-emerald-500/20' 
                  : connectionStatus === 'connected' 
                  ? 'border-zinc-700 bg-zinc-800' 
                  : 'border-dashed border-zinc-800 bg-zinc-900/50'
              }`}>
                <span className={`text-2xl font-bold ${isPeerMuted ? 'text-rose-300' : 'text-zinc-300'}`}>
                  {connectionStatus === 'connected' ? 'PEER' : '…'}
                </span>
              </div>
            </div>

            {/* Bottom Bar of Tile */}
            <div className="flex items-center justify-between z-10">
              <div className="flex flex-col bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/5">
                <span className="text-xs font-semibold text-white">
                  {connectionStatus === 'connected' ? `Partner (${peerLangObj?.name || 'Partner'})` : 'Waiting for connection'}
                </span>
                {connectionStatus === 'connected' && (
                  <span className="text-[10px]">
                    {isPeerMuted ? (
                      <span className="text-rose-400 font-medium flex items-center gap-1">
                        <MicOff className="w-2.5 h-2.5 inline" /> Partner muted microphone
                      </span>
                    ) : isSpeakingRemote ? (
                      <span className="text-emerald-400 font-medium">Speaking in your language...</span>
                    ) : (
                      <span className="text-zinc-400">Listening in their language</span>
                    )}
                  </span>
                )}
              </div>
              {connectionStatus === 'connected' && (
                <div className={`p-1.5 rounded-full transition-all ${
                  isPeerMuted ? 'bg-red-600/90 text-white shadow-sm' : 'bg-black/50 text-emerald-400'
                }`}>
                  {isPeerMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Live Closed Caption Overlay (Google Meet / Apple Translate style) */}
        {lastDeliveredSentence && (
          <div className="caption-bar mt-4 w-full max-w-2xl rounded-xl p-3 sm:p-3.5 shadow-lg animate-in fade-in duration-200">
            <div className="flex items-center gap-2 mb-1">
              <Subtitles className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                {lastDeliveredSentence.speaker === 'self' ? 'You Spoke' : `${peerLangObj?.name || 'Partner'} Spoke`}
              </span>
            </div>
            <div className="text-xs sm:text-sm text-zinc-300 font-medium">
              "{lastDeliveredSentence.originalText}"
            </div>
            <div className="text-xs sm:text-sm text-emerald-400 font-semibold mt-1 flex items-center gap-1.5">
              <span>➔</span>
              <span>{lastDeliveredSentence.translatedText}</span>
            </div>
          </div>
        )}

      </main>

      {/* Clean Bottom Control Dock (Google Meet / FaceTime style) */}
      <footer className="max-w-md mx-auto w-full z-20 flex items-center justify-center pb-2">
        <div className="bg-zinc-900 border border-zinc-800 p-2 rounded-full shadow-lg flex items-center gap-2 sm:gap-2.5">
          
          {/* Mute Toggle / Retry Mic if blocked */}
          <button
            type="button"
            onClick={micError ? retrySpeech : toggleMute}
            className={`p-3 rounded-full transition-all cursor-pointer ${
              micError ? 'control-btn-danger animate-pulse' : isMuted ? 'control-btn-danger' : 'control-btn'
            }`}
            title={micError ? 'Tap to Allow/Retry Microphone' : isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {micError ? <MicOff className="w-5 h-5 text-rose-200" /> : isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-zinc-100" />}
          </button>

          {/* Share Link */}
          <button
            type="button"
            onClick={copyRoomLink}
            className="control-btn p-3 rounded-full cursor-pointer"
            title="Copy Invite Link"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Share2 className="w-5 h-5" />}
          </button>

          {/* Transcript History Drawer */}
          <button
            type="button"
            onClick={() => setIsTranscriptOpen(prev => !prev)}
            className={`p-3 rounded-full cursor-pointer ${
              isTranscriptOpen ? 'control-btn-active' : 'control-btn'
            }`}
            title="Open Call Transcript"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          {/* Volume Control Slider */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowVolumeSlider(prev => !prev)}
              className={`p-3 rounded-full cursor-pointer ${
                showVolumeSlider ? 'control-btn-active' : 'control-btn'
              }`}
              title="Speaker Volume"
            >
              <Volume2 className="w-5 h-5" />
            </button>

            {showVolumeSlider && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-zinc-900 p-4 rounded-2xl border border-zinc-800 shadow-2xl flex flex-col gap-2.5 w-56 z-50 animate-in fade-in">
                <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
                  <span className="text-xs font-semibold text-white">AI Voice Volume</span>
                  <span className="font-mono text-xs text-emerald-400 font-semibold">{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>50%</span>
                  <span>100%</span>
                  <span>200%</span>
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-zinc-800 mx-0.5" />

          {/* End Call Button */}
          <button
            type="button"
            onClick={onLeaveCall}
            className="control-btn-danger px-4 py-2.5 rounded-full font-semibold text-xs tracking-wide flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Leave Call"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Leave</span>
          </button>
        </div>
      </footer>

      {/* Clean Live Transcript Drawer */}
      {isTranscriptOpen && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-zinc-900 border-l border-zinc-800 shadow-2xl z-50 flex flex-col p-4 sm:p-5 mobile-drawer-sheet">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-zinc-300" />
              <h3 className="font-bold text-sm text-white">Call Transcript</h3>
            </div>
            <div className="flex items-center gap-2">
              {transcriptHistory.length > 0 && (
                <button
                  type="button"
                  onClick={downloadTranscript}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer"
                  title="Download transcript (.txt)"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsTranscriptOpen(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
            {transcriptHistory.length === 0 ? (
              <div className="text-center text-xs text-zinc-400 py-16">
                No conversation yet.<br />Speech and translations will be recorded here in real-time.
              </div>
            ) : (
              transcriptHistory.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl text-xs space-y-1 border ${
                    item.speaker === 'self'
                      ? 'bg-zinc-800/80 border-zinc-700/60 ml-2'
                      : 'bg-zinc-850 border-zinc-800 mr-2'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold text-zinc-300">
                    <span>{item.speaker === 'self' ? 'You' : (peerLangObj?.name || 'Partner')}</span>
                    <span className="text-[10px] text-zinc-400 font-normal">{item.time}</span>
                  </div>
                  <div className="text-zinc-300">"{item.originalText}"</div>
                  <div className="text-emerald-400 font-medium pt-0.5">
                    ➔ {item.translatedText}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-2.5 border-t border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Encrypted Session</span>
            <button
              onClick={downloadTranscript}
              disabled={transcriptHistory.length === 0}
              className="text-zinc-300 hover:text-white underline disabled:opacity-30 cursor-pointer"
            >
              Export Transcript (.txt)
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
