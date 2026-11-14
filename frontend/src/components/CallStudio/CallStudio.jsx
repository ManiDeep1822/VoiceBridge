import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, Volume2, PhoneOff, Send, Copy, Check,
  FileText, MessageCircle, Globe, Users, ArrowRight,
  Lock, Radio, VolumeX, MessageSquare, Disc, BookOpen, X
} from 'lucide-react';
import { SUPPORTED_LANGUAGES, getLanguageMeta, getLocaleStrings } from '../../utils/languages.js';
import { CallerAvatar } from './CallerAvatar.jsx';
import { callRecorder } from '../../utils/callRecorder.js';
import { evaluatePttRelease, evaluatePttCancel, evaluateSpaceKeyUp, PTT_RELEASE_GRACE_MS, MIN_PTT_HOLD_MS, TOUCH_SLOP_PX, isWithinTouchSlop } from '../../utils/pttHelper.js';

/**
 * Apple FaceTime Minimalist Pure Monochrome CallStudio.
 * Pitch Black (#000000) backdrop, high-contrast white borders, centered speaker stage,
 * hierarchical dual-pill speech popovers, centered floating island dock, and full transcript slide-over.
 */
export function CallStudio({
  roomId = 'VOX-ROOM-101',
  userName = 'Operator',
  onRoomIdChange,
  connectionState = 'disconnected',
  remotePeer = null,
  onConnect,
  onDisconnect,
  localLanguage = 'en',
  remoteLanguage = 'te',
  onLocalLanguageChange,
  onRemoteLanguageChange,
  isListening = false,
  onStartListening,
  onStopListening,
  onToggleMic,
  onFinalizeTurn,
  localAudioLevel = 0,
  isPeerSpeaking = false,
  isRemoteSpeaking = false,
  isLocalSpeakingTTS = false,
  localInterim = '',
  latestLocalOriginal = '',
  latestLocalTranslated = '',
  latestRemoteOriginal = '',
  latestRemoteTranslated = '',
  onSendTextUtterance,
  onReplayAudio,
  onTestSpeaker,
  onOpenMinutes,
  onOpenGlossary,
  activeDomain = 'general',
  volumeBoost = true,
  onToggleVolumeBoost,
  audioUnlocked = false,
  onUnlockAudio,
  transcript = []
}) {
  // Derived metadata declared at top of component scope
  const isPeerConnected = Boolean(remotePeer) && connectionState === 'connected';
  const localMeta = getLanguageMeta(localLanguage);
  const peerActualLang = remotePeer?.language || remoteLanguage;
  const remoteMeta = getLanguageMeta(peerActualLang);
  const peerDisplayName = remotePeer?.userName || 'Remote Caller';
  const loc = getLocaleStrings(localLanguage);

  const [typedMessage, setTypedMessage] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [showTranscriptDrawer, setShowTranscriptDrawer] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimerRef = useRef(null);

  useEffect(() => {
    if (isRecording) {
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      setRecordSeconds(0);
    }
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, [isRecording]);

  const formatRecordTime = (totalSec) => {
    const mins = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const secs = (totalSec % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const handleToggleRecord = () => {
    if (!isRecording) {
      callRecorder.start();
      setIsRecording(true);
    } else {
      setIsRecording(false);
      const url = callRecorder.downloadRecording(`VoiceBridge_Call_${roomId}_${Date.now()}.wav`);
      if (url) {
        try {
          const pastCalls = JSON.parse(localStorage.getItem('voicebridge_recorded_calls') || '[]');
          pastCalls.unshift({
            id: `rec-${Date.now()}`,
            roomId,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            duration: `${Math.floor(recordSeconds / 60)}m ${recordSeconds % 60}s`,
            peerName: peerDisplayName,
            sourceLang: localMeta?.name || 'Local',
            targetLang: remoteMeta?.name || 'Remote'
          });
          localStorage.setItem('voicebridge_recorded_calls', JSON.stringify(pastCalls.slice(0, 20)));
        } catch (e) {}
      }
    }
  };

  const [isHolding, setIsHolding] = useState(false);
  const isHoldingRef = useRef(false);
  const pointerStartTimeRef = useRef(0);
  const pointerStartPosRef = useRef({ x: 0, y: 0 });
  const isWithinSlopRef = useRef(true);
  const wasListeningBeforePressRef = useRef(false);
  const wasListeningBeforeSpacePressRef = useRef(false);
  const spacePressStartTimeRef = useRef(0);
  const isSpaceKeyDownRef = useRef(false);
  const releaseTimerRef = useRef(null);
  const [pttTooltip, setPttTooltip] = useState('');
  const tooltipTimerRef = useRef(null);
  const pttButtonRef = useRef(null);

  const showPttTooltip = useCallback((msg = 'Hold while speaking') => {
    setPttTooltip(msg);
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = setTimeout(() => {
      setPttTooltip('');
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    };
  }, []);

  // Floor Lock: When peer is transmitting or translated audio is active on loudspeaker, lock caller mic
  const isChannelBusy = isPeerSpeaking || isRemoteSpeaking;

  const isListeningRef = useRef(isListening);
  isListeningRef.current = isListening;

  const isChannelBusyRef = useRef(isChannelBusy);
  isChannelBusyRef.current = isChannelBusy;

  const onStartListeningRef = useRef(onStartListening);
  onStartListeningRef.current = onStartListening;

  const onStopListeningRef = useRef(onStopListening);
  onStopListeningRef.current = onStopListening;

  const onFinalizeTurnRef = useRef(onFinalizeTurn);
  onFinalizeTurnRef.current = onFinalizeTurn;

  // Tactical Walkie-Talkie Chirps
  const playTactileChirp = useCallback((isOpen) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      if (isOpen) {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.04);
      } else {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(550, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }
    } catch (e) {}
  }, []);

  // Desktop Spacebar Hotkey (Pure Walkie-Talkie & Single-Tap Parity: Hold to Speak, Release to Send, Tap to Toggle)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        if (e.repeat) return;
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        if (isChannelBusyRef.current) return;
        e.preventDefault();

        if (releaseTimerRef.current) {
          clearTimeout(releaseTimerRef.current);
          releaseTimerRef.current = null;
        }

        spacePressStartTimeRef.current = Date.now();
        isSpaceKeyDownRef.current = true;
        wasListeningBeforeSpacePressRef.current = isListeningRef.current;
        isHoldingRef.current = true;
        setIsHolding(true);

        if (!isListeningRef.current) {
          playTactileChirp(true);
          if (onStartListeningRef.current) onStartListeningRef.current();
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        e.preventDefault();

        if (!isSpaceKeyDownRef.current) return;
        isSpaceKeyDownRef.current = false;
        isHoldingRef.current = false;
        setIsHolding(false);

        const duration = Date.now() - spacePressStartTimeRef.current;
        const wasAlreadyListening = wasListeningBeforeSpacePressRef.current;

        // If user pressed Spacebar while already listening, finalize and dispatch turn
        if (wasAlreadyListening) {
          if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
          releaseTimerRef.current = setTimeout(() => {
            playTactileChirp(false);
            if (onFinalizeTurnRef.current) onFinalizeTurnRef.current();
            releaseTimerRef.current = null;
          }, PTT_RELEASE_GRACE_MS);
          return;
        }

        const evaluation = evaluateSpaceKeyUp(duration, { tapToTalk: true, isListening: false });
        if (evaluation.action === 'FINALIZE') {
          if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
          const waitMs = evaluation.waitMs || PTT_RELEASE_GRACE_MS;
          releaseTimerRef.current = setTimeout(() => {
            playTactileChirp(false);
            if (onFinalizeTurnRef.current) onFinalizeTurnRef.current();
            releaseTimerRef.current = null;
          }, waitMs);
        } else if (evaluation.action === 'KEEP_LISTENING') {
          // Single-tap keeps mic listening hands-free
          if (releaseTimerRef.current) {
            clearTimeout(releaseTimerRef.current);
            releaseTimerRef.current = null;
          }
        } else {
          if (releaseTimerRef.current) {
            clearTimeout(releaseTimerRef.current);
            releaseTimerRef.current = null;
          }
          if (onStopListeningRef.current) onStopListeningRef.current();
          showPttTooltip(evaluation.tooltip || 'Hold while speaking');
        }
      }
    };

    const handleWindowBlur = () => {
      if (releaseTimerRef.current) {
        clearTimeout(releaseTimerRef.current);
        releaseTimerRef.current = null;
      }
      if (isSpaceKeyDownRef.current || isHoldingRef.current) {
        const spaceDuration = isSpaceKeyDownRef.current ? Date.now() - spacePressStartTimeRef.current : 0;
        const pointerDuration = isHoldingRef.current ? Date.now() - pointerStartTimeRef.current : 0;
        const duration = Math.max(spaceDuration, pointerDuration);

        isSpaceKeyDownRef.current = false;
        isHoldingRef.current = false;
        setIsHolding(false);

        const evaluation = evaluatePttCancel(duration, { withinSlop: isWithinSlopRef.current, wasHolding: true });
        if (evaluation.dispatch || evaluation.action === 'FINALIZE') {
          playTactileChirp(false);
          if (onFinalizeTurnRef.current) onFinalizeTurnRef.current();
        } else if (evaluation.action === 'IGNORE') {
          // Keep active
        } else {
          if (onStopListeningRef.current) onStopListeningRef.current();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleWindowBlur);

    return () => {
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleWindowBlur);
    };
  }, [playTactileChirp, showPttTooltip]);

  // Walkie-Talkie & Single-Tap Pointer Handlers with Touch-Slop Protection
  const handlePttPointerDown = (e) => {
    if (isChannelBusyRef.current) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}

    if (releaseTimerRef.current) {
      clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }

    pointerStartTimeRef.current = Date.now();
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
    isWithinSlopRef.current = true;
    wasListeningBeforePressRef.current = isListeningRef.current;

    isHoldingRef.current = true;
    setIsHolding(true);

    if (!isListeningRef.current) {
      playTactileChirp(true);
      if (onStartListeningRef.current) onStartListeningRef.current();
    }
  };

  const handlePttPointerMove = (e) => {
    if (!isHoldingRef.current) return;
    const start = pointerStartPosRef.current;
    if (!isWithinTouchSlop(start.x, start.y, e.clientX, e.clientY, TOUCH_SLOP_PX)) {
      isWithinSlopRef.current = false;
    }
  };

  const handlePttPointerUp = (e) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}
    e.currentTarget?.blur();
    pttButtonRef.current?.blur();

    const wasHolding = isHoldingRef.current;
    isHoldingRef.current = false;
    setIsHolding(false);

    const wasAlreadyListening = wasListeningBeforePressRef.current;
    const duration = Date.now() - pointerStartTimeRef.current;

    // Case 1: Tapping while already listening -> user tapped to end speech and dispatch
    if (wasAlreadyListening) {
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = setTimeout(() => {
        playTactileChirp(false);
        if (onFinalizeTurnRef.current) onFinalizeTurnRef.current();
        releaseTimerRef.current = null;
      }, PTT_RELEASE_GRACE_MS);
      return;
    }

    // Case 2: Hold-to-Talk (held >= 200ms) -> finalize and dispatch after trailing grace period
    const evaluation = evaluatePttRelease(duration, { tapToTalk: true, isListening: false });
    if (evaluation.action === 'FINALIZE') {
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
      const waitMs = evaluation.waitMs || PTT_RELEASE_GRACE_MS;
      releaseTimerRef.current = setTimeout(() => {
        playTactileChirp(false);
        if (onFinalizeTurnRef.current) onFinalizeTurnRef.current();
        releaseTimerRef.current = null;
      }, waitMs);
    } else if (evaluation.action === 'KEEP_LISTENING') {
      // Case 3: Single-tap (< 200ms) -> seamless tap-to-talk parity (mic stays active)
      if (releaseTimerRef.current) {
        clearTimeout(releaseTimerRef.current);
        releaseTimerRef.current = null;
      }
    } else {
      if (releaseTimerRef.current) {
        clearTimeout(releaseTimerRef.current);
        releaseTimerRef.current = null;
      }
      if (onStopListeningRef.current) onStopListeningRef.current();
      showPttTooltip(evaluation.tooltip || 'Hold while speaking');
    }
  };

  const handlePttPointerCancel = (e) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}
    e.currentTarget?.blur();
    pttButtonRef.current?.blur();

    const wasHolding = isHoldingRef.current;
    const withinSlop = isWithinSlopRef.current;
    const duration = Date.now() - pointerStartTimeRef.current;

    isHoldingRef.current = false;
    setIsHolding(false);

    if (!wasHolding) {
      if (isListeningRef.current && !releaseTimerRef.current) {
        if (onStopListeningRef.current) onStopListeningRef.current();
      }
      return;
    }

    // Touch-slop protection: accidental pointercancel from mobile touchscreens (finger roll/jitter)
    // must NOT abort active speech
    if (withinSlop) {
      if (duration >= MIN_PTT_HOLD_MS) {
        if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
        releaseTimerRef.current = setTimeout(() => {
          playTactileChirp(false);
          if (onFinalizeTurnRef.current) onFinalizeTurnRef.current();
          releaseTimerRef.current = null;
        }, PTT_RELEASE_GRACE_MS);
      }
      return;
    }

    // Explicit drag outside touch slop: cancel turn
    if (releaseTimerRef.current) {
      clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
    if (onStopListeningRef.current) onStopListeningRef.current();
  };

  const handlePttClick = (e) => {
    e?.preventDefault();
    e?.currentTarget?.blur();
  };

  const COMMON_PHRASES = [
    { label: 'Hello, can you hear me?', text: 'Hello, can you hear my voice clearly?' },
    { label: 'Yes, loud & clear', text: 'Yes, I hear your translated voice loud and clear.' },
    { label: 'Please explain details', text: 'Please explain the details and pricing clearly.' },
    { label: 'I agree / Deal confirmed', text: 'Yes, I agree to this. Everything is confirmed.' },
    { label: 'Thank you, goodbye', text: 'Thank you very much. Have a great day, goodbye.' }
  ];

  const handleSend = (e) => {
    e?.preventDefault();
    if (!typedMessage.trim()) return;
    onSendTextUtterance(typedMessage.trim());
    setTypedMessage('');
  };

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}?room=${encodeURIComponent(roomId)}&mode=join`
    : `https://voicebridge.app?room=${encodeURIComponent(roomId)}&mode=join`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`Join my live translation call on VoiceBridge: ${inviteUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#000000] text-white overflow-hidden select-none font-sans text-sm w-full max-w-full box-border relative">
      {/* 1. FaceTime Minimalist Pure Monochrome Top Bar */}
      <header className="w-full max-w-full bg-black/80 backdrop-blur-2xl border-b border-white/10 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 shrink-0 z-20">
        {/* Left: Room Badge & Dynamic Call Status */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 px-3 rounded-full bg-white/10 border border-white/20 flex items-center gap-2 text-xs font-medium text-white shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
            <span className="text-white/60 hidden xs:inline">{loc.room}:</span>
            <span className="font-bold text-white tracking-wide">{roomId}</span>
          </div>

          {/* Turn / Floor Status Indicator */}
          {isChannelBusy ? (
            <div className="h-8 px-3 rounded-full bg-white/5 border border-white/20 text-white/90 text-xs font-semibold flex items-center gap-1.5 truncate max-w-[200px] sm:max-w-none">
              <Lock className="w-3.5 h-3.5 text-white/70 shrink-0" />
              <span className="truncate">{loc.channelBusy} ({isPeerSpeaking ? `${peerDisplayName}` : 'TTS'})</span>
            </div>
          ) : isListening ? (
            <div className="h-8 px-3 rounded-full bg-white text-black border border-white text-xs font-bold flex items-center gap-1.5 animate-pulse shrink-0">
              <Radio className="w-3.5 h-3.5 text-black shrink-0" />
              <span className="truncate">{loc.speakingNotice || 'Listening...'}</span>
            </div>
          ) : (
            <div className="h-8 px-3 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs hidden md:flex items-center gap-1.5 shrink-0">
              <span className={`w-2 h-2 rounded-full ${isPeerConnected ? 'bg-white/80' : 'bg-white/30 animate-pulse'}`} />
              <span>{isPeerConnected ? '2 Callers Active' : 'Waiting for Remote Caller'}</span>
            </div>
          )}
        </div>

        {/* Right: Quick Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Call Recording Button */}
          <button
            onClick={handleToggleRecord}
            className={`h-8 px-3 rounded-full font-medium text-xs flex items-center gap-1.5 transition-all shrink-0 border ${
              isRecording
                ? 'bg-red-600/30 border-red-500 text-red-300 animate-pulse'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
            }`}
            title={isRecording ? 'Click to stop and save audio recording' : 'Record continuous call audio'}
            aria-label="Toggle Recording"
          >
            <Disc className={`w-3.5 h-3.5 shrink-0 ${isRecording ? 'text-red-400 animate-spin' : 'text-white/70'}`} />
            <span className="text-xs">{isRecording ? `REC ${formatRecordTime(recordSeconds)}` : 'Record'}</span>
          </button>

          {/* Quick WhatsApp Share Button */}
          <button
            onClick={handleWhatsAppShare}
            className="h-8 px-2.5 sm:px-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium text-xs flex items-center gap-1.5 shrink-0 transition-colors"
            title="Share Call Link to WhatsApp"
            aria-label="Share Call Link to WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5 text-white shrink-0" />
            <span className="hidden sm:inline text-xs">WhatsApp</span>
          </button>

          {/* Copy Link Button */}
          <button
            onClick={handleCopyLink}
            className="h-8 px-2.5 sm:px-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium text-xs flex items-center gap-1.5 shrink-0 transition-colors"
            title="Copy Invite Link"
            aria-label="Copy Invite Link"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-white shrink-0" /> : <Copy className="w-3.5 h-3.5 text-white/70 shrink-0" />}
            <span className="hidden sm:inline text-xs">{copiedLink ? 'Copied' : loc.copyLink}</span>
          </button>

          {/* Speaker Unlock / Test */}
          {!audioUnlocked ? (
            <button
              onClick={onUnlockAudio}
              className="h-8 px-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold text-xs animate-pulse flex items-center gap-1.5 shrink-0 shadow-lg"
              title="Click to enable speaker output"
              aria-label="Enable Speaker"
            >
              <Volume2 className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xs:inline">Enable Speaker</span>
            </button>
          ) : (
            <button
              onClick={onTestSpeaker}
              className="h-8 px-2.5 sm:px-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium text-xs hidden sm:flex items-center gap-1.5 shrink-0 transition-colors"
              title="Test speaker output sound"
              aria-label="Test Speaker Output"
            >
              <Volume2 className="w-3.5 h-3.5 text-white/70 shrink-0" />
              <span className="text-xs">Test</span>
            </button>
          )}

          {/* Full Transcript Slide-Over Toggle */}
          <button
            onClick={() => setShowTranscriptDrawer(prev => !prev)}
            className={`h-8 px-3 rounded-full border text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors ${
              showTranscriptDrawer
                ? 'bg-white text-black border-white'
                : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
            }`}
            title="Toggle Transcript Drawer"
            aria-label="Toggle Full Transcript Slide-Over"
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xs:inline">Transcript</span>
          </button>
        </div>
      </header>

      {/* 2. FaceTime Centered Calling Stage (Pitch Black with White Borders) */}
      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 pb-24 sm:pb-28 overflow-y-auto min-h-0 w-full max-w-7xl mx-auto relative">
        {!isPeerConnected ? (
          /* SOLO HERO STAGE: Centered Solo Card when waiting for remote peer */
          <div className="w-full max-w-xl rounded-3xl bg-black/60 backdrop-blur-2xl border border-white/20 p-5 sm:p-8 flex flex-col justify-between items-center text-center shadow-2xl relative overflow-hidden transition-all duration-300 min-h-[400px] sm:min-h-[460px]">
            {/* Solo Card Header */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-white animate-pulse' : 'bg-white/40'}`} />
                <span className="font-bold text-sm text-white tracking-wide">{userName} ({loc.you})</span>
              </div>

              {/* Language Selector Pill */}
              <div className="h-7 px-2.5 rounded-full bg-white/10 border border-white/20 flex items-center text-xs text-white">
                <select
                  value={localLanguage}
                  onChange={(e) => onLocalLanguageChange(e.target.value)}
                  className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="bg-black text-white">
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Center Hero Avatar & Concentric Acoustic Soundwaves */}
            <div className="my-6 flex flex-col items-center justify-center">
              <CallerAvatar
                isLocal={true}
                isSpeaking={isListening}
                size="hero"
                participantName={userName}
                language={localMeta.name}
              />

              <div className="mt-4 text-center">
                <div className="text-base sm:text-xl font-bold text-white tracking-wide">
                  {localMeta.native}
                </div>
                <div className="text-xs text-white/50 mt-1">
                  {isListening ? `Speaking (${localAudioLevel}%)` : 'Ready to talk'}
                </div>
              </div>
            </div>

            {/* Bottom Deck: Hierarchical Live Speech Popover or Waiting Invitation */}
            <div className="w-full">
              {isListening && localInterim ? (
                <div className="w-full rounded-2xl bg-white/10 border border-white/25 p-3.5 backdrop-blur-xl shadow-xl space-y-1 text-left">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-white/70">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    <span>Speaking Live:</span>
                  </div>
                  <p className="text-sm sm:text-base font-bold text-white leading-snug break-words">
                    "{localInterim}"
                  </p>
                </div>
              ) : latestLocalOriginal ? (
                <div className="w-full rounded-2xl bg-white/10 border border-white/25 p-3.5 backdrop-blur-xl shadow-xl flex flex-col gap-2 text-left">
                  <div className="space-y-0.5">
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-white/60">
                      Translated to {remoteMeta.native || remoteMeta.name}:
                    </div>
                    <p className="text-sm sm:text-base font-bold text-white leading-snug break-words">
                      "{latestLocalTranslated || latestLocalOriginal}"
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 border border-white/15 text-[11px] text-white/80 self-start">
                    <span className="text-white/50">{localMeta.name}:</span>
                    <span className="font-medium truncate max-w-[280px]">"{latestLocalOriginal}"</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col items-center gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-white">Waiting for Second Caller to Join</p>
                    <p className="text-[11px] text-white/50">Share room link to connect. Real-time translation begins instantly.</p>
                  </div>
                  <div className="flex items-center gap-2 w-full max-w-xs">
                    <button
                      onClick={handleWhatsAppShare}
                      className="flex-1 h-8 px-3 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-white" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      onClick={handleCopyLink}
                      className="flex-1 h-8 px-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5 text-white/70" />
                      <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* BALANCED DUAL-SPEAKER STAGE: FaceTime Side-by-Side Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full max-w-5xl flex-1 items-stretch">
            {/* CALLER 1 TILE: YOU */}
            <div className={`rounded-3xl bg-black/60 backdrop-blur-2xl border p-5 sm:p-6 flex flex-col justify-between relative transition-all duration-300 overflow-hidden shadow-2xl min-h-[360px] ${
              isListening
                ? 'border-white ring-2 ring-white/30 shadow-[0_0_35px_rgba(255,255,255,0.15)]'
                : 'border-white/20 hover:border-white/30'
            }`}>
              {/* Header */}
              <div className="w-full flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-white animate-pulse' : 'bg-white/40'}`} />
                  <span className="font-bold text-sm text-white tracking-wide">{userName} ({loc.you})</span>
                </div>

                <div className="h-7 px-2.5 rounded-full bg-white/10 border border-white/20 flex items-center text-xs text-white">
                  <select
                    value={localLanguage}
                    onChange={(e) => onLocalLanguageChange(e.target.value)}
                    className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                  >
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code} className="bg-black text-white">
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Center Avatar & Concentric Soundwaves */}
              <div className="my-4 flex flex-col items-center justify-center">
                <CallerAvatar
                  isLocal={true}
                  isSpeaking={isListening}
                  size="default"
                  participantName={userName}
                  language={localMeta.name}
                />

                <div className="mt-3 text-center">
                  <div className="text-sm sm:text-base font-bold text-white tracking-wide">
                    {localMeta.native}
                  </div>
                  <div className="text-xs text-white/50 mt-0.5">
                    {isListening ? `Speaking (${localAudioLevel}%)` : 'Ready to talk'}
                  </div>
                </div>
              </div>

              {/* Live Speech Popover (Adjacent Dual-Pill Bubble) */}
              <div className="w-full min-h-[85px] flex flex-col justify-end">
                {isListening && localInterim ? (
                  <div className="w-full rounded-2xl bg-white/10 border border-white/25 p-3 backdrop-blur-xl shadow-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-white/70">
                      <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                      <span>Speaking Live...</span>
                    </div>
                    <p className="text-sm font-semibold text-white leading-snug break-words">
                      "{localInterim}"
                    </p>
                  </div>
                ) : latestLocalOriginal ? (
                  <div className="w-full rounded-2xl bg-white/10 border border-white/25 p-3 backdrop-blur-xl shadow-xl flex flex-col gap-1.5">
                    <div className="space-y-0.5">
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-white/60">
                        Translated to {remoteMeta.native || remoteMeta.name}:
                      </div>
                      <p className="text-sm font-bold text-white leading-snug break-words">
                        "{latestLocalTranslated || latestLocalOriginal}"
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/60 border border-white/15 text-[10px] text-white/80 self-start">
                      <span className="text-white/50">{localMeta.name}:</span>
                      <span className="font-medium truncate max-w-[200px]">"{latestLocalOriginal}"</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-xs text-white/40 italic py-2">
                    {loc.pttHelper || 'Hold Spacebar or tap mic to speak'}
                  </div>
                )}
              </div>
            </div>

            {/* CALLER 2 TILE: REMOTE PEER */}
            <div className={`rounded-3xl bg-black/60 backdrop-blur-2xl border p-5 sm:p-6 flex flex-col justify-between relative transition-all duration-300 overflow-hidden shadow-2xl min-h-[360px] ${
              isPeerSpeaking || isRemoteSpeaking
                ? 'border-white ring-2 ring-white/30 shadow-[0_0_35px_rgba(255,255,255,0.15)]'
                : 'border-white/20 hover:border-white/30'
            }`}>
              {/* Header */}
              <div className="w-full flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isPeerSpeaking || isRemoteSpeaking ? 'bg-white animate-pulse' : 'bg-white/40'}`} />
                  <span className="font-bold text-sm text-white tracking-wide truncate">{peerDisplayName}</span>
                </div>

                <span className="h-7 px-3 rounded-full bg-white/10 border border-white/20 flex items-center text-xs font-bold text-white tracking-wide">
                  {remoteMeta.name}
                </span>
              </div>

              {/* Center Avatar & Concentric Soundwaves */}
              <div className="my-4 flex flex-col items-center justify-center">
                <CallerAvatar
                  isLocal={false}
                  isSpeaking={isPeerSpeaking || isRemoteSpeaking}
                  size="default"
                  participantName={peerDisplayName}
                  language={remoteMeta.name}
                />

                <div className="mt-3 text-center">
                  <div className="text-sm sm:text-base font-bold text-white tracking-wide">
                    {remoteMeta.native}
                  </div>
                  <div className="text-xs text-white/50 mt-0.5">
                    {isPeerSpeaking ? 'Speaking in native...' : isRemoteSpeaking ? 'Playing translation aloud' : 'Loudspeaker ready'}
                  </div>
                </div>
              </div>

              {/* Live Speech Popover with Prominent Translated Text + 1-Tap Replay */}
              <div className="w-full min-h-[85px] flex flex-col justify-end">
                {latestRemoteTranslated ? (
                  <div className="w-full rounded-2xl bg-white/10 border border-white/25 p-3 backdrop-blur-xl shadow-xl flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-white/60">
                          Translated to {localMeta.native || localMeta.name}:
                        </div>
                        <p className="text-sm font-bold text-white leading-snug break-words">
                          "{latestRemoteTranslated}"
                        </p>
                      </div>
                      {/* 1-Tap Audio Replay Button */}
                      <button
                        type="button"
                        onClick={() => onReplayAudio && onReplayAudio(latestRemoteTranslated, localLanguage)}
                        className="h-7 px-2.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/30 text-white text-xs font-medium flex items-center gap-1 transition-colors shrink-0 shadow-sm active:scale-95"
                        title="Replay translated audio aloud"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-white" />
                        <span className="text-[11px]">Replay</span>
                      </button>
                    </div>
                    {latestRemoteOriginal && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/60 border border-white/15 text-[10px] text-white/80 self-start">
                        <span className="text-white/50">{remoteMeta.name}:</span>
                        <span className="font-medium truncate max-w-[200px]">"{latestRemoteOriginal}"</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-xs text-white/40 italic py-2">
                    When {peerDisplayName} speaks, words translate into {localMeta.native} instantly
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. Floating Island Dock (Centered bottom pill dock with strict touch shielding) */}
      <nav
        className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 max-w-[95vw] rounded-full bg-black/90 border border-white/20 backdrop-blur-2xl shadow-2xl px-3 sm:px-5 py-2 sm:py-2.5 flex items-center gap-1.5 sm:gap-2.5 box-border touch-none select-none"
        style={{
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none'
        }}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Call Controls Dock"
      >
        {/* Primary Mic / PTT Button */}
        <div
          className="relative flex items-center justify-center touch-none select-none"
          style={{
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none'
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {pttTooltip && (
            <div className="absolute -top-10 px-3 py-1 bg-black/95 text-white text-xs font-semibold rounded-full border border-white/30 shadow-2xl pointer-events-none z-40 whitespace-nowrap">
              {pttTooltip}
            </div>
          )}

          <button
            ref={pttButtonRef}
            type="button"
            disabled={isChannelBusy}
            onPointerDown={handlePttPointerDown}
            onPointerMove={handlePttPointerMove}
            onPointerUp={handlePttPointerUp}
            onPointerCancel={handlePttPointerCancel}
            onTouchCancel={handlePttPointerCancel}
            onClick={handlePttClick}
            onFocus={(e) => e.currentTarget.blur()}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              touchAction: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none'
            }}
            className={`h-11 sm:h-12 px-4 sm:px-5 rounded-full font-bold text-xs sm:text-sm tracking-wide touch-none select-none flex items-center gap-2 transition-all border shadow-lg ${
              isChannelBusy
                ? 'bg-white/5 text-white/40 border-white/10 cursor-not-allowed opacity-70'
                : isHolding || isListening
                  ? 'bg-white text-black border-white shadow-[0_0_25px_rgba(255,255,255,0.4)] animate-pulse'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/20 hover:border-white/40 active:scale-95'
            }`}
            title={isChannelBusy ? loc.channelBusy : isListening ? 'Release to Send' : 'Hold to Speak (Space)'}
          >
            {isChannelBusy ? (
              <>
                <Lock className="w-4 h-4 text-white/50 shrink-0" />
                <span className="hidden sm:inline">{loc.channelBusy}</span>
              </>
            ) : isHolding || isListening ? (
              <>
                <Mic className="w-4 h-4 text-black shrink-0" />
                <span>{localLanguage === 'en' ? 'Release to Send' : (loc.tapWhenDone || 'Release to Send')}</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-white shrink-0" />
                <span>{localLanguage === 'en' ? 'Hold to Speak' : (loc.tapToSpeak || 'Hold to Speak')}</span>
              </>
            )}
          </button>
        </div>

        {/* Language Switcher Pill */}
        <div className="h-11 px-2.5 sm:px-3 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 flex items-center gap-1.5 text-xs text-white transition-colors cursor-pointer" title="Switch Spoken Language">
          <Globe className="w-4 h-4 text-white/70 shrink-0" />
          <select
            value={localLanguage}
            onChange={(e) => onLocalLanguageChange(e.target.value)}
            className="bg-transparent text-white font-bold focus:outline-none cursor-pointer max-w-[70px] sm:max-w-[100px] truncate"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} className="bg-black text-white">
                {l.name}
              </option>
            ))}
          </select>
        </div>

        {/* Speaker Toggle / Volume Booster */}
        <button
          onClick={!audioUnlocked ? onUnlockAudio : onToggleVolumeBoost}
          className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all shrink-0 active:scale-95 ${
            !audioUnlocked
              ? 'bg-red-600 hover:bg-red-500 text-white border-red-400 animate-pulse'
              : volumeBoost
                ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
          }`}
          title={!audioUnlocked ? 'Enable Speaker' : `Volume Boost: ${volumeBoost ? 'ON (+6dB)' : 'OFF'}`}
          aria-label="Speaker Toggle"
        >
          <Volume2 className="w-4 h-4" />
        </button>

        {/* Notes / Meeting Minutes */}
        <button
          onClick={onOpenMinutes}
          className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition-colors shrink-0 active:scale-95"
          title="Meeting Minutes & AI Summary"
          aria-label="Meeting Minutes"
        >
          <FileText className="w-4 h-4" />
        </button>

        {/* Glossary & Jargon Lock */}
        <button
          onClick={onOpenGlossary}
          className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition-colors shrink-0 active:scale-95"
          title="Industry Glossary & Jargon Lock"
          aria-label="Industry Glossary"
        >
          <BookOpen className="w-4 h-4" />
        </button>

        {/* Transcript Drawer Toggle */}
        <button
          onClick={() => setShowTranscriptDrawer(prev => !prev)}
          className={`w-11 h-11 rounded-full border flex items-center justify-center transition-colors shrink-0 active:scale-95 ${
            showTranscriptDrawer
              ? 'bg-white text-black border-white'
              : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
          }`}
          title="Toggle Transcript Drawer"
          aria-label="Toggle Transcript Drawer"
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        {/* End Call Button */}
        <button
          onClick={onDisconnect}
          className="w-11 h-11 rounded-full bg-red-600 hover:bg-red-500 text-white border border-red-500/40 shadow-lg shadow-red-900/60 flex items-center justify-center transition-transform active:scale-95 shrink-0"
          title="Leave Call"
          aria-label="Leave Call"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </nav>

      {/* 4. Full Transcript Slide-Over Drawer (On-demand right drawer, keeps stage clean) */}
      {showTranscriptDrawer && (
        <>
          {/* Slide-Over Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setShowTranscriptDrawer(false)}
            aria-hidden="true"
          />

          {/* Slide-Over Drawer Container */}
          <aside className="fixed inset-y-0 right-0 w-full sm:w-96 md:w-[420px] bg-black/95 backdrop-blur-2xl border-l border-white/20 z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-white" />
                <span className="font-bold text-sm text-white">Call Transcript & Messages</span>
              </div>
              <button
                onClick={() => setShowTranscriptDrawer(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                title="Close Drawer"
                aria-label="Close Drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Tap Phrases */}
            <div className="p-3 border-b border-white/10 bg-white/5 space-y-1.5">
              <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider block">
                Quick Responses:
              </span>
              <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                {COMMON_PHRASES.map((qp, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSendTextUtterance(qp.text)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-medium transition-colors flex items-center justify-between text-left"
                  >
                    <span className="truncate">{qp.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-white/40 shrink-0 ml-1" />
                  </button>
                ))}
              </div>
            </div>

            {/* Transcript Log */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
              {transcript && transcript.length > 1 ? (
                <div className="space-y-3">
                  {transcript.filter(t => t.id !== 'init-msg').map((item) => (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-2xl border space-y-1.5 ${
                        item.isLocal
                          ? 'bg-white/10 border-white/20 text-left'
                          : 'bg-white/5 border-white/15 text-left'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-white tracking-wide">
                          {item.speaker}
                        </span>
                        {!item.isLocal && item.translatedText && (
                          <button
                            type="button"
                            onClick={() => onReplayAudio && onReplayAudio(item.translatedText, localLanguage)}
                            className="p-1 rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                            title="Replay audio"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-white font-medium leading-relaxed">{item.originalText}</p>
                      {item.translatedText && item.translatedText !== item.originalText && (
                        <p className="text-white/80 text-[11px] pt-1.5 border-t border-white/10 font-semibold">
                          {item.translatedText}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : latestLocalOriginal || latestRemoteOriginal ? (
                <div className="space-y-3">
                  {latestLocalOriginal && (
                    <div className="p-3.5 rounded-2xl bg-white/10 border border-white/20 space-y-1">
                      <span className="text-[11px] font-bold text-white">You ({localMeta.name})</span>
                      <p className="text-white font-medium">{latestLocalOriginal}</p>
                      {latestLocalTranslated && (
                        <p className="text-white/80 text-[11px] pt-1 border-t border-white/10 font-semibold">
                          {remoteMeta.name}: {latestLocalTranslated}
                        </p>
                      )}
                    </div>
                  )}
                  {latestRemoteOriginal && (
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/15 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-white">{peerDisplayName} ({remoteMeta.name})</span>
                        {latestRemoteTranslated && (
                          <button
                            type="button"
                            onClick={() => onReplayAudio && onReplayAudio(latestRemoteTranslated, localLanguage)}
                            className="p-1 rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                            title="Replay translated audio"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-white font-medium">{latestRemoteOriginal}</p>
                      {latestRemoteTranslated && (
                        <p className="text-white/80 text-[11px] pt-1 border-t border-white/10 font-semibold">
                          {localMeta.name}: {latestRemoteTranslated}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-center text-white/40 py-12">
                  <p>Speech and translation history will appear here in real time.</p>
                </div>
              )}
            </div>

            {/* Quick Custom Message Input */}
            <form onSubmit={handleSend} className="p-3.5 border-t border-white/10 flex items-center gap-2 bg-black">
              <input
                type="text"
                value={typedMessage}
                onChange={(e) => setTypedMessage(e.target.value)}
                placeholder="Type a message to translate..."
                className="flex-1 h-10 bg-white/10 border border-white/20 focus:border-white rounded-full px-4 text-xs text-white placeholder-white/40 focus:outline-none transition-colors"
              />
              <button
                type="submit"
                className="w-10 h-10 rounded-full bg-white text-black hover:bg-white/90 font-medium flex items-center justify-center shrink-0 transition-colors shadow-lg active:scale-95"
                title="Send text message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </aside>
        </>
      )}
    </div>
  );
}
