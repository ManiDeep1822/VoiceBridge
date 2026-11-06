import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { 
  Mic, 
  MicOff, 
  PhoneOff, 
  Copy, 
  Check, 
  Share2, 
  Users, 
  Sparkles, 
  Volume2, 
  Radio,
  AlertCircle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import Visualizer from './Visualizer';
import { useSpeechRecognition, LOCALE_MAP } from '../hooks/useSpeechRecognition';
import { useAudioQueue } from '../hooks/useAudioQueue';
import { SUPPORTED_LANGUAGES } from './Lobby';

export default function CallRoom({ 
  roomId, 
  language = 'te', 
  voiceGender = 'female', 
  onLeaveCall 
}) {
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connecting' | 'waiting' | 'connected'
  const [peerInfo, setPeerInfo] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [speechStatus, setSpeechStatus] = useState('Idle'); // 'Idle' | 'Listening' | 'Translating' | 'Playing'
  const [lastDeliveredSentence, setLastDeliveredSentence] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [transcriptHistory, setTranscriptHistory] = useState([]);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);
  const [isSpeakingRemote, setIsSpeakingRemote] = useState(false);

  const socketRef = useRef(null);

  // Audio queue for smooth sequential playback of incoming translated voice with volume boost
  const { enqueueAudio, isPlaying: isQueuePlaying, volume, setVolume, stopAll } = useAudioQueue({
    onStartSpeaking: () => {
      setIsSpeakingRemote(true);
      setSpeechStatus('Speaking translated audio');
    },
    onStopSpeaking: () => {
      setIsSpeakingRemote(false);
      setSpeechStatus('Idle');
    }
  });

  // Auto-mute microphone while partner's translated speech is playing through speaker to prevent echo loop
  const isAutoMuted = isSpeakingRemote || isQueuePlaying;
  const isEffectivelyMuted = isMuted || isAutoMuted;

  // Client-side Speech Recognition with VAD (silence detection)
  const handleSpeechFinal = useCallback((phrase) => {
    if (!socketRef.current || isEffectivelyMuted || !phrase.trim()) return;

    setSpeechStatus('Translating phrase...');
    setIsSpeakingLocal(true);

    socketRef.current.emit('speech_segment', {
      originalText: phrase.trim(),
      sourceLang: language
    });
  }, [isEffectivelyMuted, language]);

  const { isListening, isSupported: isSTTSupported, micError, startListening, stopListening } = useSpeechRecognition({
    language,
    isMuted: isEffectivelyMuted,
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

  // Update language on peer when modified
  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.emit('update_language', {
        language,
        voiceGender
      });
    }
  }, [language, voiceGender]);

  // Connect to Socket.io (strictly once per roomId)
  useEffect(() => {
    // In dev and prod, socket.io uses relative path, window.location.origin, or Vercel env variable
    const backendUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
    const socketInstance = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    // Use session-based stable userId so page refresh reconnects cleanly
    let userId = sessionStorage.getItem('voicebridge_user_id');
    if (!userId) {
      userId = `user_${Math.random().toString(36).substring(2, 7)}`;
      sessionStorage.setItem('voicebridge_user_id', userId);
    }

    socketInstance.on('connect_error', (err) => {
      console.error('[Socket] connect_error:', err);
      setConnectionStatus('error');
    });

    socketInstance.on('connect', () => {
      setConnectionStatus('connecting');
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
      setPeerInfo(data.peer);
      // Start listening once connected
      startListeningRef.current();
    });

    socketInstance.on('peer_disconnected', () => {
      setConnectionStatus('waiting');
      setPeerInfo(null);
      stopAllRef.current();
    });

    socketInstance.on('room_full', (data) => {
      setErrorMessage(data.message || 'Call is at full capacity.');
    });

    socketInstance.on('peer_incoming_speech', () => {
      setIsSpeakingRemote(true);
      setSpeechStatus('Translating incoming speech...');
    });

    // Instant subtitle text delivery (< 200ms)
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
      setSpeechStatus('Playing translated speech');
    });

    socketInstance.on('translated_audio', (payload) => {
      // Fast neural voice playback (+15% conversational pacing)
      if (payload.audioBase64) {
        enqueueAudioRef.current(payload.audioBase64, {
          originalText: payload.originalText,
          translatedText: payload.translatedText
        });
      }
    });

    socketInstance.on('speech_delivered', (data) => {
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
      setIsSpeakingLocal(false);
      setSpeechStatus('Idle');
    });

    return () => {
      stopListeningRef.current();
      stopAllRef.current();
      socketInstance.disconnect();
    };
  }, [roomId]);

  // Call duration counter
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

  const copyRoomLink = () => {
    const shareableUrl = `${window.location.origin}/#room=${roomId}`;
    navigator.clipboard.writeText(shareableUrl);
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

  const currentLangObj = SUPPORTED_LANGUAGES.find(l => l.code === language) || {
    name: language.toUpperCase(),
    native: language.toUpperCase()
  };

  const peerLangObj = peerInfo 
    ? (SUPPORTED_LANGUAGES.find(l => l.code === peerInfo.language) || { name: peerInfo.language, native: peerInfo.language })
    : null;

  return (
    <div className="min-h-screen bg-dark-950 text-white flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden select-none">
      {/* Background ambient lighting */}
      <div className={`absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full blur-[160px] pointer-events-none transition-all duration-1000 ${
        isSpeakingLocal ? 'bg-cyan-500/15' : isSpeakingRemote ? 'bg-purple-500/15' : 'bg-blue-500/05'
      }`} />

      {/* Header Bar */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
            <Radio className="w-4 h-4 text-brand-cyan animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-200">Call ID: {roomId}</span>
              <button
                type="button"
                onClick={copyRoomLink}
                className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all"
                title="Copy shareable invite link"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              {connectionStatus === 'connected' ? `Duration: ${formatTimer(callDuration)}` : 'Waiting for connection...'}
            </div>
          </div>
        </div>

        {/* Status Pill & Transcript Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsTranscriptOpen(prev => !prev)}
            className={`px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isTranscriptOpen
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Live Transcript History"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Transcript</span>
            {transcriptHistory.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/30 text-[10px] text-cyan-200 font-mono">
                {transcriptHistory.length}
              </span>
            )}
          </button>

          {connectionStatus === 'connected' && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/50 border border-emerald-500/40 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Live Active</span>
            </div>
          )}
          {connectionStatus === 'waiting' && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950/50 border border-amber-500/40 text-amber-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Waiting for partner...</span>
            </div>
          )}
          {connectionStatus === 'connecting' && (
            <div className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-xs font-medium">
              Connecting...
            </div>
          )}
          {connectionStatus === 'error' && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
              <span>Offline (Check Server)</span>
            </div>
          )}
        </div>
      </header>

      {/* Error Modal */}
      {errorMessage && (
        <div className="max-w-md mx-auto w-full my-auto z-20 glass-panel border-rose-500/40 rounded-2xl p-6 text-center">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-2">Room Unavailable</h3>
          <p className="text-sm text-slate-400 mb-6">{errorMessage}</p>
          <button
            onClick={onLeaveCall}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs tracking-wide"
          >
            Back to Home
          </button>
        </div>
      )}

      {/* Main Calling Stage */}
      {!errorMessage && (
        <main className="max-w-4xl mx-auto w-full my-auto z-10 flex flex-col items-center">
          {/* Waiting Banner if only 1 participant */}
          {connectionStatus === 'waiting' && (
            <div className="mb-10 text-center max-w-md mx-auto glass-panel p-5 rounded-2xl border-cyan-500/20 shadow-xl">
              <Share2 className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
              <h4 className="text-base font-bold text-white mb-1">Share this call link with your partner</h4>
              <p className="text-xs text-slate-400 mb-4">
                Send this link to the other person. They will choose their language (e.g. Hindi) and connect directly.
              </p>
              <button
                type="button"
                onClick={copyRoomLink}
                className="w-full py-2.5 px-4 rounded-xl bg-cyan-500/15 border border-cyan-500/40 hover:bg-cyan-500/25 text-cyan-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Link Copied to Clipboard!' : 'Copy Invite Link'}</span>
              </button>
            </div>
          )}

          {/* Mic Permission / Network Error Banner */}
          {micError && (
            <div className="mb-6 max-w-md mx-auto w-full p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-300 text-xs text-center flex items-center justify-center gap-2.5 shadow-lg">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{micError}</span>
            </div>
          )}

          {/* Minimalist 2-Participant Circles */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center justify-center max-w-2xl">
            {/* User A (Self) */}
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-4">
                {/* Glowing ring when user is speaking */}
                {isSpeakingLocal && (
                  <div className="absolute inset-0 -m-3 rounded-full bg-cyan-400/20 animate-ping pointer-events-none" />
                )}
                <div className={`w-32 h-32 sm:w-36 sm:h-36 rounded-full glass-panel flex flex-col items-center justify-center border-2 transition-all duration-300 ${
                  isSpeakingLocal 
                    ? 'border-cyan-400 shadow-2xl shadow-cyan-500/40 ring-4 ring-cyan-500/20' 
                    : isMuted 
                    ? 'border-rose-900/60 opacity-60' 
                    : 'border-slate-800'
                }`}>
                  <div className="text-3xl font-extrabold text-white">YOU</div>
                  <div className="text-xs font-semibold text-cyan-400 mt-1">{currentLangObj.native}</div>
                </div>

                {isMuted && (
                  <div className="absolute bottom-1 right-1 p-2 rounded-full bg-rose-600 text-white shadow-md">
                    <MicOff className="w-4 h-4" />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="text-sm font-bold text-slate-200">
                  You ({currentLangObj.name})
                </div>
                <div className="text-xs text-slate-500">
                  {isMuted
                    ? 'Microphone Muted'
                    : isAutoMuted
                    ? 'Mic auto-paused (anti-echo)'
                    : isSpeakingLocal
                    ? 'Listening to speech...'
                    : 'Microphone Ready'}
                </div>
              </div>

              <div className="mt-3">
                <Visualizer isActive={isSpeakingLocal && !isMuted} color="cyan" isIncoming={false} />
              </div>
            </div>

            {/* User B (Peer) */}
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-4">
                {/* Glowing ring when synthetic speech is actively playing */}
                {isSpeakingRemote && (
                  <div className="absolute inset-0 -m-3 rounded-full bg-purple-400/25 animate-ping pointer-events-none" />
                )}
                <div className={`w-32 h-32 sm:w-36 sm:h-36 rounded-full glass-panel flex flex-col items-center justify-center border-2 transition-all duration-300 ${
                  isSpeakingRemote 
                    ? 'border-purple-400 shadow-2xl shadow-purple-500/40 ring-4 ring-purple-500/20' 
                    : connectionStatus === 'connected' 
                    ? 'border-slate-800' 
                    : 'border-dashed border-slate-800/80'
                }`}>
                  {connectionStatus === 'connected' ? (
                    <>
                      <div className="text-3xl font-extrabold text-white">PEER</div>
                      <div className="text-xs font-semibold text-purple-400 mt-1">
                        {peerLangObj ? peerLangObj.native : 'हिन्दी'}
                      </div>
                    </>
                  ) : (
                    <Users className="w-10 h-10 text-slate-600 animate-pulse" />
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm font-bold text-slate-200">
                  {connectionStatus === 'connected' ? `Partner (${peerLangObj?.name || 'Partner'})` : 'Waiting for Partner'}
                </div>
                <div className="text-xs text-slate-500">
                  {connectionStatus === 'connected'
                    ? isSpeakingRemote
                      ? `Speaking in ${peerLangObj?.name || 'Partner Language'}...`
                      : 'Connected'
                    : 'Invite link not yet opened'}
                </div>
              </div>

              <div className="mt-3">
                <Visualizer isActive={isSpeakingRemote} color="purple" isIncoming={true} />
              </div>
            </div>
          </div>

          {/* Live Subtitle Banner */}
          {lastDeliveredSentence && (
            <div className="mt-6 max-w-xl w-full glass-panel border border-cyan-500/30 rounded-2xl p-4 shadow-xl text-center transition-all animate-in fade-in zoom-in-95 duration-300">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-center gap-2">
                <span>{lastDeliveredSentence.speaker === 'self' ? 'You Spoke' : `${peerLangObj?.name || 'Partner'} Spoke`}</span>
                <span className="text-slate-600">•</span>
                <span className="text-cyan-400">Live Translation</span>
              </div>
              <div className="text-sm text-slate-300 font-medium italic mb-2">
                "{lastDeliveredSentence.originalText}"
              </div>
              <div className="text-base text-white font-bold bg-slate-900/80 py-2.5 px-4 rounded-xl border border-slate-800 flex items-center justify-center gap-2 shadow-inner">
                <Volume2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>{lastDeliveredSentence.translatedText}</span>
              </div>
            </div>
          )}

          {/* Central Context Hint */}
          <div className="mt-6 text-center max-w-md">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/80 border border-slate-800 text-slate-300 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              <span>
                {connectionStatus === 'connected'
                  ? `Speak naturally in ${currentLangObj.name}. When you pause, your partner will hear translated ${peerLangObj?.name || 'speech'}.`
                  : 'Call will start automatically when partner connects.'}
              </span>
            </div>
          </div>
        </main>
      )}

      {/* Floating Bottom Control Dock */}
      <footer className="max-w-md mx-auto w-full z-10 flex items-center justify-center">
        <div className="glass-panel p-2.5 rounded-full border border-slate-800 shadow-2xl flex items-center gap-3">
          {/* Mic Mute Toggle */}
          <button
            type="button"
            onClick={toggleMute}
            className={`p-3.5 rounded-full transition-all duration-200 ${
              isMuted
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-slate-800/80 text-white hover:bg-slate-700/80 border border-slate-700'
            }`}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-cyan-400" />}
          </button>

          {/* Copy Link Button */}
          <button
            type="button"
            onClick={copyRoomLink}
            className="p-3.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700 transition-all duration-200"
            title="Copy Invite Link"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Share2 className="w-5 h-5" />}
          </button>

          {/* Transcript Drawer Button */}
          <button
            type="button"
            onClick={() => setIsTranscriptOpen(prev => !prev)}
            className={`p-3.5 rounded-full border transition-all duration-200 ${
              isTranscriptOpen
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border-slate-700'
            }`}
            title="Toggle Live Transcript Drawer"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          {/* Volume Control Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowVolumeSlider(prev => !prev)}
              className={`p-3.5 rounded-full border transition-all duration-200 ${
                showVolumeSlider
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border-slate-700'
              }`}
              title="Speaker Volume & Amplification"
            >
              <Volume2 className="w-5 h-5 text-cyan-400" />
            </button>
            {showVolumeSlider && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 glass-panel p-3.5 rounded-2xl border border-slate-700 shadow-2xl flex flex-col items-center gap-2 w-44 z-50">
                <div className="flex items-center justify-between w-full text-[11px] font-semibold text-slate-300">
                  <span>Voice Volume</span>
                  <span className="text-cyan-400 font-mono">{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <span className="text-[10px] text-slate-500">{volume > 1.0 ? '⚡ Amplified Boost' : 'Standard'}</span>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-slate-800 mx-1" />

          {/* End / Leave Call Button */}
          <button
            type="button"
            onClick={onLeaveCall}
            className="px-5 py-3.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs tracking-wider flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all duration-200"
            title="End Call"
          >
            <PhoneOff className="w-4 h-4" />
            <span>End Call</span>
          </button>
        </div>
      </footer>

      {/* Slide-out Live Bilingual Transcript Drawer */}
      {isTranscriptOpen && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-slate-950/95 backdrop-blur-2xl border-l border-slate-800 shadow-2xl z-50 flex flex-col p-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-sm text-white">Live Conversation Transcript</h3>
            </div>
            <button
              onClick={() => setIsTranscriptOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            {transcriptHistory.length === 0 ? (
              <div className="text-center text-xs text-slate-500 py-16">
                No dialogue yet.<br />Speak in {currentLangObj.name} to see the real-time transcript and translations recorded here.
              </div>
            ) : (
              transcriptHistory.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl text-xs space-y-1.5 border ${
                    item.speaker === 'self'
                      ? 'bg-cyan-950/30 border-cyan-500/30 ml-3'
                      : 'bg-purple-950/30 border-purple-500/30 mr-3'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className={item.speaker === 'self' ? 'text-cyan-400' : 'text-purple-400'}>
                      {item.speaker === 'self' ? `You (${currentLangObj.name})` : `${peerLangObj?.name || 'Partner'}`}
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal">{item.time}</span>
                  </div>
                  <div className="text-slate-300 italic">"{item.originalText}"</div>
                  <div className="text-white font-medium bg-black/40 p-2 rounded-lg border border-slate-800/80">
                    {item.translatedText}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 text-center">
            Zero-latency live translation log
          </div>
        </div>
      )}
    </div>
  );
}
