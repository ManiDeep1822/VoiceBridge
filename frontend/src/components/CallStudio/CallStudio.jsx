import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, Volume2, PhoneOff, Send, Copy, Check,
  FileText, MessageCircle, Globe, Users, ArrowRight,
  Lock, Radio, VolumeX, MessageSquare, Disc, BookOpen
} from 'lucide-react';
import { SUPPORTED_LANGUAGES, getLanguageMeta, getLocaleStrings } from '../../utils/languages.js';
import { CallerAvatar } from './CallerAvatar.jsx';
import { callRecorder } from '../../utils/callRecorder.js';
import { evaluatePttRelease, evaluatePttCancel, evaluateSpaceKeyUp } from '../../utils/pttHelper.js';

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
  const [showMobileChat, setShowMobileChat] = useState(false);
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
  const spacePressStartTimeRef = useRef(0);
  const isSpaceKeyDownRef = useRef(false);
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

  // Desktop Spacebar Hotkey (Pure Walkie-Talkie: Hold to Speak, Release to Send)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        if (e.repeat) return;
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        if (isChannelBusyRef.current) return;
        e.preventDefault();

        spacePressStartTimeRef.current = Date.now();
        isSpaceKeyDownRef.current = true;
        isHoldingRef.current = true;
        setIsHolding(true);

        playTactileChirp(true);
        if (onStartListeningRef.current) onStartListeningRef.current();
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
        const evaluation = evaluateSpaceKeyUp(duration);
        if (evaluation.dispatch) {
          playTactileChirp(false);
          if (onFinalizeTurnRef.current) onFinalizeTurnRef.current();
        } else {
          if (onStopListeningRef.current) onStopListeningRef.current();
          showPttTooltip(evaluation.tooltip || 'Hold while speaking');
        }
      }
    };

    const handleWindowBlur = () => {
      if (isSpaceKeyDownRef.current || isHoldingRef.current) {
        const spaceDuration = isSpaceKeyDownRef.current ? Date.now() - spacePressStartTimeRef.current : 0;
        const pointerDuration = isHoldingRef.current ? Date.now() - pointerStartTimeRef.current : 0;
        const duration = Math.max(spaceDuration, pointerDuration);

        isSpaceKeyDownRef.current = false;
        isHoldingRef.current = false;
        setIsHolding(false);

        const evaluation = evaluatePttCancel(duration);
        if (evaluation.dispatch) {
          playTactileChirp(false);
          if (onFinalizeTurnRef.current) onFinalizeTurnRef.current();
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
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleWindowBlur);
    };
  }, [playTactileChirp, showPttTooltip]);

  // Pure Walkie-Talkie Pointer Handlers (Hold to Speak, Release to Send)
  const handlePttPointerDown = (e) => {
    if (isChannelBusyRef.current) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}

    pointerStartTimeRef.current = Date.now();
    isHoldingRef.current = true;
    setIsHolding(true);

    playTactileChirp(true);
    if (onStartListeningRef.current) onStartListeningRef.current();
  };

  const handlePttPointerUp = (e) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}
    e.currentTarget?.blur();
    pttButtonRef.current?.blur();

    if (!isHoldingRef.current) return;
    isHoldingRef.current = false;
    setIsHolding(false);

    const duration = Date.now() - pointerStartTimeRef.current;
    const evaluation = evaluatePttRelease(duration);

    if (evaluation.dispatch) {
      playTactileChirp(false);
      if (onFinalizeTurnRef.current) onFinalizeTurnRef.current();
    } else {
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

    if (!isHoldingRef.current) {
      if (isListeningRef.current) {
        if (onStopListeningRef.current) onStopListeningRef.current();
      }
      return;
    }

    isHoldingRef.current = false;
    setIsHolding(false);

    const duration = Date.now() - pointerStartTimeRef.current;
    const evaluation = evaluatePttCancel(duration);

    if (evaluation.dispatch) {
      playTactileChirp(false);
      if (onFinalizeTurnRef.current) onFinalizeTurnRef.current();
    } else {
      if (onStopListeningRef.current) onStopListeningRef.current();
    }
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
    <div className="flex-1 flex flex-col h-full bg-[#07090C] overflow-hidden select-none font-sans text-sm w-full max-w-full box-border">
      {/* 1. Sleek Top Bar (Google Meet Style: Fully Responsive, Zero Right-Cutoff) */}
      <div className="w-full max-w-full bg-[#0C111D]/90 backdrop-blur-md border-b border-slate-800/90 px-2 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-1.5 sm:gap-2 shrink-0 overflow-hidden box-border">
        {/* Left: Room Badge */}
        <div className="h-8 sm:h-8.5 px-2.5 sm:px-3 rounded-lg bg-slate-800/90 border border-slate-700/80 flex items-center text-xs font-medium text-slate-200 shrink-0">
          <span className="text-slate-400 mr-1 hidden xs:inline">{loc.room}:</span>
          <span className="font-bold text-white tracking-wide text-[11px] sm:text-xs">{roomId}</span>
        </div>

        {/* Right: Actions in a Clean, Non-Overflowing Row */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Call Recording Button */}
          <button
            onClick={handleToggleRecord}
            className={`h-8 sm:h-8.5 px-2 sm:px-3 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all shrink-0 ${
              isRecording
                ? 'bg-red-500/20 border border-red-500/80 text-red-400 glow-red animate-pulse'
                : 'bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 hover:text-white border border-slate-700/80'
            }`}
            title={isRecording ? 'Click to stop and save audio recording' : 'Record continuous call audio with zero latency'}
            aria-label="Toggle Recording"
          >
            <Disc className={`w-3.5 h-3.5 shrink-0 ${isRecording ? 'text-red-400 animate-spin' : 'text-slate-400'}`} />
            <span className="text-[11px] sm:text-xs">{isRecording ? `REC ${formatRecordTime(recordSeconds)}` : 'Record'}</span>
          </button>

          {/* Quick WhatsApp Share Button */}
          <button
            onClick={handleWhatsAppShare}
            className="w-8 h-8 sm:w-auto sm:h-8.5 sm:px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm flex items-center justify-center gap-1.5 shrink-0 transition-colors border border-emerald-500/40"
            title="Share Call Link to WhatsApp"
            aria-label="Share Call Link to WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5 fill-white text-white shrink-0" />
            <span className="hidden sm:inline text-xs">WhatsApp</span>
          </button>

          {/* Copy Link Button */}
          <button
            onClick={handleCopyLink}
            className="w-8 h-8 sm:w-auto sm:h-8.5 sm:px-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 hover:text-white border border-slate-700/80 font-medium text-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors shadow-sm"
            title="Copy Invite Link"
            aria-label="Copy Invite Link"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Copy className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
            <span className="hidden sm:inline text-xs">{copiedLink ? 'Copied' : loc.copyLink}</span>
          </button>

          {/* Quick Replay Audio Button */}
          {latestRemoteTranslated && (
            <button
              onClick={() => onReplayAudio && onReplayAudio(latestRemoteTranslated, localLanguage)}
              className="h-8 sm:h-8.5 px-2 sm:px-2.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-600/60 font-medium text-[11px] sm:text-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors shadow-sm"
              title="Replay translated audio aloud"
              aria-label="Replay translated audio"
            >
              <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden xs:inline">Replay</span>
            </button>
          )}

          {/* Audio Output Status & Test */}
          {!audioUnlocked ? (
            <button
              onClick={onUnlockAudio}
              className="h-8 sm:h-8.5 px-2 sm:px-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-[11px] sm:text-xs animate-pulse glow-red flex items-center justify-center gap-1 shrink-0"
              title="Click to enable speaker output"
              aria-label="Enable Speaker"
            >
              <Volume2 className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xs:inline">Enable Speaker</span>
            </button>
          ) : (
            <button
              onClick={onTestSpeaker}
              className="w-8 h-8 sm:h-8.5 sm:w-auto sm:px-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 border border-slate-700/80 font-medium text-xs hidden sm:flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
              title="Test speaker output sound"
              aria-label="Test Speaker Output"
            >
              <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-xs">Test</span>
            </button>
          )}

          {/* Mobile Conversation Drawer Toggle */}
          <button
            onClick={() => setShowMobileChat(prev => !prev)}
            className="h-8 sm:h-8.5 px-2 sm:px-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 hover:text-white border border-slate-700/80 font-medium text-xs flex items-center justify-center gap-1 shrink-0 lg:hidden shadow-sm"
            title="Toggle Transcript & Messages"
            aria-label="Toggle Transcript & Messages"
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-[11px]">Chat</span>
          </button>
        </div>
      </div>

      {/* 2. Status Banner (Turn Indicator / Floor Lock Notice) */}
      <div className="w-full max-w-full bg-[#090D17] border-b border-slate-800/80 px-2.5 sm:px-4 py-1.5 flex items-center justify-between text-xs overflow-hidden shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
          {isChannelBusy ? (
            <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs truncate">
              <span className="w-2 h-2 rounded-full bg-amber-400 glow-amber animate-pulse shrink-0" />
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">{loc.channelBusy} — {isPeerSpeaking ? `${peerDisplayName} speaking...` : 'Loudspeaker transmitting...'}</span>
            </div>
          ) : isListening ? (
            <div className="flex items-center gap-1.5 text-red-400 font-semibold text-xs truncate">
              <span className="w-2 h-2 rounded-full bg-red-400 glow-red animate-pulse shrink-0" />
              <Radio className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="truncate">{loc.speakingNotice}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium text-xs truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 glow-emerald shrink-0" />
              <span className="truncate">{isPeerConnected ? loc.readyYourTurn : 'Share room link above to start conversation'}</span>
            </div>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2 text-slate-400 text-xs shrink-0 ml-2">
          <span className="text-[11px] font-medium">{isPeerConnected ? '2 Callers Active' : 'Waiting for Remote Caller'}</span>
        </div>
      </div>

      {/* 3. Main Stage: Responsive Desktop Grid / Mobile Stack */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2 sm:p-4 gap-2 sm:gap-4 min-h-0 max-w-full">
        {/* Left Calling Bay */}
        <div className="flex-1 flex flex-col justify-between gap-2 sm:gap-3 overflow-y-auto min-h-0 max-w-full">
          {/* Dual Calling Stage Cards */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4 flex-1 min-h-0">
            {/* CALLER 1: YOU */}
            <div className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-5 flex flex-col justify-between relative transition-all duration-200 overflow-hidden ${
              isListening
                ? 'bg-[#121927] border-2 border-red-500/80 shadow-2xl shadow-red-950/40 glow-red'
                : 'bg-[#0E1422]/90 border border-slate-800/90'
            }`}>
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 sm:pb-3 gap-1 overflow-hidden">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <div className={`w-2 h-2 shrink-0 rounded-full ${isListening ? 'bg-red-400 animate-pulse glow-red' : 'bg-emerald-400'}`} />
                  <span className="font-bold text-xs sm:text-sm text-white truncate">{userName} ({loc.you})</span>
                </div>

                <div className="h-6 sm:h-7 px-1.5 sm:px-2 rounded-md sm:rounded-lg bg-slate-800/90 border border-slate-700/80 flex items-center text-[10px] sm:text-[11px] text-white shrink-0 max-w-[75px] sm:max-w-none">
                  <select
                    value={localLanguage}
                    onChange={(e) => onLocalLanguageChange(e.target.value)}
                    className="bg-transparent text-blue-400 font-bold focus:outline-none cursor-pointer w-full truncate"
                  >
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code} className="bg-slate-900 text-white">
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Center Calling Avatar & Waveform */}
              <div className="flex-1 flex flex-col items-center justify-center my-1.5 sm:my-3">
                <CallerAvatar isLocal={true} isSpeaking={isListening} />

                <div className="mt-2 text-center">
                  <div className="text-xs sm:text-base font-bold text-white tracking-wide">
                    {localMeta.native}
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
                    {isListening ? `Speaking (${localAudioLevel}%)` : 'Ready to talk'}
                  </div>
                </div>
              </div>

              {/* Desktop Subtitle Deck (Inside Card) */}
              <div className="hidden lg:flex rounded-xl bg-[#080C14]/90 border border-slate-800/80 p-3 min-h-[75px] flex-col justify-center">
                {localInterim ? (
                  <p className="text-sm font-bold text-white leading-normal">
                    "{localInterim}"
                  </p>
                ) : latestLocalOriginal ? (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-white">"{latestLocalOriginal}"</p>
                    <p className="text-[11px] text-emerald-400">Translated to {remoteMeta.native}: "{latestLocalTranslated}"</p>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">
                    {loc.pttHelper}
                  </p>
                )}
              </div>
            </div>

            {/* CALLER 2: REMOTE PEER */}
            {isPeerConnected ? (
              <div className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-5 flex flex-col justify-between relative transition-all duration-200 overflow-hidden ${
                isPeerSpeaking
                  ? 'bg-[#121927] border-2 border-amber-500/80 shadow-2xl shadow-amber-950/40 glow-amber'
                  : 'bg-[#0E1422]/90 border border-slate-800/90'
              }`}>
                {/* Peer Header */}
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 sm:pb-3 gap-1 overflow-hidden">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <div className={`w-2 h-2 shrink-0 rounded-full ${isPeerSpeaking ? 'bg-amber-400 animate-pulse glow-amber' : 'bg-emerald-400'}`} />
                    <span className="font-bold text-xs sm:text-sm text-white truncate">{peerDisplayName}</span>
                  </div>

                  <span className="h-6 sm:h-7 px-1.5 sm:px-2 rounded-md sm:rounded-lg bg-slate-800/90 border border-slate-700/80 flex items-center text-[10px] sm:text-[11px] font-bold text-emerald-400 shrink-0 truncate max-w-[70px] sm:max-w-none">
                    {remoteMeta.name}
                  </span>
                </div>

                {/* Peer Central Visual */}
                <div className="flex-1 flex flex-col items-center justify-center my-1.5 sm:my-3">
                  <CallerAvatar isLocal={false} isSpeaking={isPeerSpeaking || isRemoteSpeaking} />

                  <div className="mt-2 text-center">
                    <div className="text-xs sm:text-base font-bold text-white tracking-wide">
                      {remoteMeta.native}
                    </div>
                    <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
                      {isPeerSpeaking ? 'Speaking in native...' : isRemoteSpeaking ? 'Playing translation' : 'Loudspeaker ready'}
                    </div>
                  </div>
                </div>

                {/* Desktop Subtitle Deck (Peer Card) */}
                <div className="hidden lg:flex rounded-xl bg-[#080C14]/90 border border-slate-800/80 p-3 min-h-[75px] flex-col justify-center">
                  {latestRemoteTranslated ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-1 min-w-0 flex-1">
                        <p className="text-sm font-bold text-emerald-400 leading-snug">"{latestRemoteTranslated}"</p>
                        <p className="text-[11px] text-slate-400">Original: "{latestRemoteOriginal}"</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onReplayAudio && onReplayAudio(latestRemoteTranslated, localLanguage)}
                        className="h-8 px-2.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-medium text-xs flex items-center gap-1.5 transition-colors shrink-0 shadow-sm"
                        title="Replay translated audio aloud"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Replay</span>
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">
                      When {peerDisplayName} speaks, words will translate into {localMeta.native} instantly.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* Waiting Card */
              <div className="rounded-xl sm:rounded-2xl border-2 border-dashed border-slate-800/80 bg-[#0E1422]/50 p-2.5 sm:p-5 flex flex-col justify-between items-center text-center overflow-hidden">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-300 mt-1 sm:mt-3">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>

                <div className="space-y-1 max-w-sm my-1 sm:my-3">
                  <h3 className="text-xs sm:text-base font-bold text-white">
                    Share Link to Connect
                  </h3>
                  <p className="text-[10px] sm:text-xs text-slate-400 line-clamp-2">
                    Invite second caller to room. Translation begins instantly.
                  </p>
                </div>

                <div className="w-full flex flex-col sm:flex-row gap-1.5 sm:gap-2 pt-2 border-t border-slate-800/80">
                  <button
                    onClick={handleWhatsAppShare}
                    className="h-8 sm:h-9 px-2 sm:px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs sm:text-sm flex-1 flex items-center justify-center gap-1.5 transition-colors border border-emerald-500/40"
                  >
                    <MessageCircle className="w-3.5 h-3.5 fill-white shrink-0" />
                    <span className="truncate">WhatsApp</span>
                  </button>

                  <button
                    onClick={handleCopyLink}
                    className="h-8 sm:h-9 px-2 sm:px-4 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700/80 font-medium text-xs sm:text-sm flex-1 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{copiedLink ? 'Copied' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* UNIQUE MOBILE FLOATING SUBTITLE ISLAND */}
          <div className="lg:hidden w-full max-w-full rounded-xl bg-[#0E1422]/95 backdrop-blur-xl border border-slate-800/90 p-2.5 sm:p-3.5 shadow-xl flex flex-col justify-center min-h-[64px] sm:min-h-[76px] shrink-0 box-border overflow-hidden">
            {isListening && localInterim ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-ping glow-red" />
                  <span>You are speaking:</span>
                </div>
                <p className="text-xs sm:text-base font-bold text-white leading-snug break-words">
                  "{localInterim}"
                </p>
              </div>
            ) : latestRemoteTranslated && (isPeerSpeaking || isRemoteSpeaking) ? (
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse glow-emerald" />
                    <span>{peerDisplayName} (Translated):</span>
                  </div>
                  <p className="text-xs sm:text-base font-bold text-emerald-400 leading-snug break-words">
                    "{latestRemoteTranslated}"
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onReplayAudio && onReplayAudio(latestRemoteTranslated, localLanguage)}
                  className="h-8 px-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-1 shrink-0"
                  title="Replay translated audio"
                >
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px]">Replay</span>
                </button>
              </div>
            ) : latestRemoteTranslated ? (
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <p className="text-[10px] text-slate-400 truncate">From {peerDisplayName}: "{latestRemoteOriginal}"</p>
                  <p className="text-xs font-bold text-emerald-400 truncate">"{latestRemoteTranslated}"</p>
                </div>
                <button
                  type="button"
                  onClick={() => onReplayAudio && onReplayAudio(latestRemoteTranslated, localLanguage)}
                  className="h-8 px-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-1 shrink-0"
                  title="Replay translated audio"
                >
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px]">Replay</span>
                </button>
              </div>
            ) : latestLocalOriginal ? (
              <div className="space-y-0.5">
                <p className="text-[11px] text-slate-400 truncate">Last spoken: "{latestLocalOriginal}"</p>
                <p className="text-xs font-semibold text-emerald-400 truncate">Translated: "{latestLocalTranslated}"</p>
              </div>
            ) : (
              <div className="text-center text-xs text-slate-400 py-0.5">
                <p className="font-medium text-slate-300 text-xs">{loc.pttHelper}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Walkie-Talkie: Hold button or Spacebar to talk, release to send</p>
              </div>
            )}
          </div>

          {/* Unified Bottom Dock: Ergonomic Mobile Stack / Desktop Row */}
          <div className="rounded-xl sm:rounded-2xl bg-[#0D121F]/95 backdrop-blur-md border border-slate-800/90 p-2 sm:p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 shrink-0 box-border max-w-full">
            {/* Primary Push-to-Talk Button (Large, Ergonomic, Zero Overlap, Anti-Bounce) */}
            <div className="w-full sm:flex-1 flex flex-col items-center relative">
              {pttTooltip && (
                <div className="absolute -top-8 px-2.5 py-1 bg-slate-800 text-amber-300 text-xs font-semibold rounded-md shadow-lg border border-slate-700 pointer-events-none z-20 whitespace-nowrap">
                  {pttTooltip}
                </div>
              )}
              <button
                ref={pttButtonRef}
                type="button"
                disabled={isChannelBusy}
                onPointerDown={handlePttPointerDown}
                onPointerUp={handlePttPointerUp}
                onPointerCancel={handlePttPointerCancel}
                onTouchCancel={handlePttPointerCancel}
                onClick={handlePttClick}
                onFocus={(e) => e.currentTarget.blur()}
                className={`w-full sm:w-auto sm:flex-1 h-12 sm:h-11 px-4 py-2.5 rounded-xl font-bold text-sm tracking-wide shadow-lg touch-none select-none flex items-center justify-center gap-2 transition-colors border ${
                  isChannelBusy
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/40 cursor-not-allowed opacity-80'
                    : isHolding || isListening
                      ? 'bg-red-600 hover:bg-red-500 text-white border-red-500/50 glow-red'
                      : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500/40 shadow-blue-950/40'
                }`}
              >
                {isChannelBusy ? (
                  <>
                    <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="truncate">{loc.channelBusy}</span>
                  </>
                ) : isHolding || isListening ? (
                  <>
                    <Mic className="w-4 h-4 text-white shrink-0" />
                    <span className="truncate">{localLanguage === 'en' ? 'Release to Send' : (loc.tapWhenDone || 'Release to Send')}</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-white shrink-0" />
                    <span className="truncate">{localLanguage === 'en' ? 'Hold to Speak (Space)' : (loc.tapToSpeak || 'Hold to Speak (Space)')}</span>
                  </>
                )}
              </button>
            </div>

            {/* Secondary Controls: 4-Item Grid on Mobile, Flex on Desktop */}
            <div className="grid grid-cols-4 sm:flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto shrink-0">
              {/* Volume Booster Toggle */}
              <button
                onClick={onToggleVolumeBoost}
                className={`h-9 sm:h-11 px-2 sm:px-3 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors border ${
                  volumeBoost
                    ? 'border-blue-500/80 text-blue-400 bg-blue-500/10'
                    : 'border-slate-700/80 bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
                title="Loudspeaker Volume Booster (+6dB)"
              >
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="text-[11px] sm:text-xs truncate">Boost: {volumeBoost ? 'ON' : 'OFF'}</span>
              </button>

              {/* Glossary & Jargon Lock Button (Audited & Added) */}
              <button
                onClick={onOpenGlossary}
                className="h-9 sm:h-11 px-2 sm:px-3 rounded-lg sm:rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-slate-200 hover:text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                title="Open Industry Jargon & Glossary Lock"
              >
                <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400 shrink-0" />
                <span className="text-[11px] sm:text-xs truncate">Glossary</span>
              </button>

              {/* Meeting Minutes */}
              <button
                onClick={onOpenMinutes}
                className="h-9 sm:h-11 px-2 sm:px-3 rounded-lg sm:rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-slate-200 hover:text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                title="View Meeting Minutes & AI Notes"
              >
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 shrink-0" />
                <span className="text-[11px] sm:text-xs truncate">Minutes</span>
              </button>

              {/* Leave Call */}
              <button
                onClick={onDisconnect}
                className="h-9 sm:h-11 px-2 sm:px-3 rounded-lg sm:rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors shadow-sm shadow-red-950/40 border border-red-500/40"
                title="Leave Call Room"
              >
                <PhoneOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="text-[11px] sm:text-xs truncate">Leave</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Backdrop for Transcript Drawer */}
        {showMobileChat && (
          <div 
            className="fixed inset-0 bg-[#07090C]/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setShowMobileChat(false)}
          />
        )}

        {/* Right Sidebar: Conversation Log & Quick Phrases (Desktop & Mobile Drawer) */}
        <div className={`w-full lg:w-96 rounded-2xl bg-[#0D121F]/95 backdrop-blur-xl border border-slate-800/90 flex flex-col overflow-hidden shrink-0 ${
          showMobileChat ? 'fixed inset-3 sm:inset-6 z-50 lg:static lg:inset-auto shadow-2xl' : 'hidden lg:flex'
        }`}>
          <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between">
            <span className="font-bold text-sm text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              <span>Conversation Transcript</span>
            </span>
            {showMobileChat && (
              <button
                onClick={() => setShowMobileChat(false)}
                className="btn-secondary h-8 px-3 rounded-lg text-xs lg:hidden"
              >
                Close
              </button>
            )}
          </div>

          {/* Quick Phrases */}
          <div className="p-3 border-b border-slate-800/80 bg-[#080C14]/50 space-y-2">
            <span className="text-xs font-semibold text-slate-400 block">
              Quick Tap Responses:
            </span>
            <div className="flex flex-col gap-1.5">
              {COMMON_PHRASES.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendTextUtterance(qp.text)}
                  className="w-full h-8.5 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-medium transition-colors flex items-center justify-between border border-slate-700/60"
                >
                  <span className="truncate">{qp.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                </button>
              ))}
            </div>
          </div>

          {/* Transcript History */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-2.5 text-xs">
            {transcript && transcript.length > 1 ? (
              <div className="space-y-2.5">
                {transcript.filter(t => t.id !== 'init-msg').map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border space-y-1 ${
                      item.isLocal
                        ? 'bg-blue-950/20 border-blue-900/40 text-left'
                        : 'bg-emerald-950/20 border-emerald-900/40 text-left'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-semibold ${item.isLocal ? 'text-blue-400' : 'text-emerald-400'}`}>
                        {item.speaker}
                      </span>
                      {!item.isLocal && item.translatedText && (
                        <button
                          type="button"
                          onClick={() => onReplayAudio && onReplayAudio(item.translatedText, localLanguage)}
                          className="p-1 rounded hover:bg-slate-700/60 text-slate-400 hover:text-emerald-400 transition-colors"
                          title="Replay audio"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-white font-medium leading-normal">{item.originalText}</p>
                    {item.translatedText && item.translatedText !== item.originalText && (
                      <p className="text-emerald-400 text-[11px] pt-1 border-t border-slate-800/60">
                        {item.translatedText}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : latestLocalOriginal || latestRemoteOriginal ? (
              <div className="space-y-3">
                {latestLocalOriginal && (
                  <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-900/40 space-y-1">
                    <span className="text-[11px] font-semibold text-blue-400">You ({localMeta.name})</span>
                    <p className="text-white font-medium">{latestLocalOriginal}</p>
                    {latestLocalTranslated && (
                      <p className="text-emerald-400 text-[11px] pt-1 border-t border-slate-700/50">
                        {remoteMeta.name}: {latestLocalTranslated}
                      </p>
                    )}
                  </div>
                )}
                {latestRemoteOriginal && (
                  <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-emerald-400">{peerDisplayName} ({remoteMeta.name})</span>
                      {latestRemoteTranslated && (
                        <button
                          type="button"
                          onClick={() => onReplayAudio && onReplayAudio(latestRemoteTranslated, localLanguage)}
                          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-colors"
                          title="Replay translated audio"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-white font-medium">{latestRemoteOriginal}</p>
                    {latestRemoteTranslated && (
                      <p className="text-emerald-400 text-[11px] pt-1 border-t border-slate-700/50">
                        {localMeta.name}: {latestRemoteTranslated}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-slate-500 py-8">
                <p>Speech and translation history will appear here.</p>
              </div>
            )}
          </div>

          {/* Quick Custom Text Sender */}
          <form onSubmit={handleSend} className="p-3 border-t border-slate-800/80 flex items-center gap-2 bg-[#080C14]/50">
            <input
              type="text"
              value={typedMessage}
              onChange={(e) => setTypedMessage(e.target.value)}
              placeholder="Type a custom message..."
              className="flex-1 h-10 bg-slate-800/90 border border-slate-700 focus:border-blue-500 rounded-xl px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              className="btn-primary h-10 px-4 py-2 rounded-xl font-medium text-xs shadow-md shadow-blue-950/40"
              title="Send text message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
