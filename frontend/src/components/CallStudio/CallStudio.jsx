import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, Volume2, PhoneOff, Send, Copy, Check,
  FileText, MessageCircle, Globe, Users, ArrowRight,
  Lock, Radio, VolumeX, MessageSquare
} from 'lucide-react';
import { SUPPORTED_LANGUAGES, getLanguageMeta, getLocaleStrings } from '../../utils/languages.js';

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
  onUnlockAudio
}) {
  const [typedMessage, setTypedMessage] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);

  const pointerStartTimeRef = useRef(0);
  const wasListeningBeforePointerRef = useRef(false);
  const isPttPointerDownRef = useRef(false);

  const spacePressStartTimeRef = useRef(0);
  const wasListeningBeforeSpacePressRef = useRef(false);
  const isSpaceKeyDownRef = useRef(false);

  // Floor Lock: When peer is transmitting or translated audio is active on loudspeaker, lock caller mic
  const isChannelBusy = isPeerSpeaking || isRemoteSpeaking;

  const isListeningRef = useRef(isListening);
  isListeningRef.current = isListening;

  const isChannelBusyRef = useRef(isChannelBusy);
  isChannelBusyRef.current = isChannelBusy;

  const onStartListeningRef = useRef(onStartListening);
  onStartListeningRef.current = onStartListening;

  const onFinalizeTurnRef = useRef(onFinalizeTurn);
  onFinalizeTurnRef.current = onFinalizeTurn;

  const isPeerConnected = Boolean(remotePeer) && connectionState === 'connected';

  const localMeta = getLanguageMeta(localLanguage);
  const peerActualLang = remotePeer?.language || remoteLanguage;
  const remoteMeta = getLanguageMeta(peerActualLang);
  const peerDisplayName = remotePeer?.userName || 'Remote Caller';

  const loc = getLocaleStrings(localLanguage);

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

  // Desktop Spacebar Hotkey (Dual-Mode: Hold Spacebar to speak OR Tap once to toggle hands-free)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        if (isChannelBusyRef.current) return;
        e.preventDefault();

        spacePressStartTimeRef.current = Date.now();
        isSpaceKeyDownRef.current = true;

        if (!isListeningRef.current) {
          wasListeningBeforeSpacePressRef.current = false;
          playTactileChirp(true);
          if (onStartListeningRef.current) onStartListeningRef.current();
        } else {
          wasListeningBeforeSpacePressRef.current = true;
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        e.preventDefault();

        const holdDuration = Date.now() - spacePressStartTimeRef.current;
        const wasAlreadyListening = wasListeningBeforeSpacePressRef.current;
        isSpaceKeyDownRef.current = false;

        if (holdDuration > 250) {
          // True Hold-to-Talk release
          playTactileChirp(false);
          if (onFinalizeTurnRef.current) onFinalizeTurnRef.current();
        } else {
          // Quick tap
          if (wasAlreadyListening) {
            playTactileChirp(false);
            if (onFinalizeTurnRef.current) onFinalizeTurnRef.current();
          }
        }
      }
    };

    const handleWindowBlur = () => {
      if (isSpaceKeyDownRef.current || isPttPointerDownRef.current) {
        isSpaceKeyDownRef.current = false;
        isPttPointerDownRef.current = false;
        playTactileChirp(false);
        if (onFinalizeTurnRef.current) onFinalizeTurnRef.current();
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
  }, [playTactileChirp]);

  // Dual-Mode PTT Button (Hold to talk OR Tap once to toggle hands-free)
  const handlePttPointerDown = (e) => {
    if (isChannelBusyRef.current) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}

    pointerStartTimeRef.current = Date.now();
    isPttPointerDownRef.current = true;

    if (!isListeningRef.current) {
      wasListeningBeforePointerRef.current = false;
      playTactileChirp(true);
      if (onStartListeningRef.current) onStartListeningRef.current();
    } else {
      wasListeningBeforePointerRef.current = true;
    }
  };

  const handlePttPointerUp = (e) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}

    const duration = Date.now() - pointerStartTimeRef.current;
    const wasAlreadyListening = wasListeningBeforePointerRef.current;
    isPttPointerDownRef.current = false;

    if (duration > 250) {
      // True Hold-to-Talk release
      playTactileChirp(false);
      if (onFinalizeTurnRef.current) onFinalizeTurnRef.current();
    } else {
      // Quick tap
      if (wasAlreadyListening) {
        playTactileChirp(false);
        if (onFinalizeTurnRef.current) onFinalizeTurnRef.current();
      }
    }
  };

  const handlePttPointerCancel = (e) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}

    isPttPointerDownRef.current = false;
    if (isListeningRef.current) {
      playTactileChirp(false);
      if (onFinalizeTurnRef.current) onFinalizeTurnRef.current();
    }
  };

  const handlePttClick = (e) => {
    e?.preventDefault();
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
    ? `${window.location.origin}?room=${encodeURIComponent(roomId)}`
    : `https://voicebridge.app?room=${encodeURIComponent(roomId)}`;

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
    <div className="flex-1 flex flex-col h-full bg-[#0B0F17] overflow-hidden select-none font-sans text-sm">
      {/* 1. Sleek Top Bar (Sharing & Room Indicator) */}
      <div className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="h-11 px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center text-sm font-medium text-slate-200">
            <span className="text-slate-400 mr-1.5">{loc.room}:</span>
            <span className="font-bold text-white tracking-wide">{roomId}</span>
          </div>

          {/* Quick WhatsApp Share Button */}
          <button
            onClick={handleWhatsAppShare}
            className="btn-success h-11 px-5 py-2.5 rounded-xl font-medium text-sm shadow-sm"
            title="Share Call Link to WhatsApp"
          >
            <MessageCircle className="w-4 h-4 fill-white text-white" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>

          {/* Copy Link Button */}
          <button
            onClick={handleCopyLink}
            className="btn-secondary h-11 px-5 py-2.5 rounded-xl font-medium text-sm"
            title="Copy Invite Link"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
            <span>{copiedLink ? 'Copied' : loc.copyLink}</span>
          </button>
        </div>

        {/* Audio Output Status & Test */}
        <div className="flex items-center gap-2">
          {!audioUnlocked ? (
            <button
              onClick={onUnlockAudio}
              className="btn-danger h-11 px-5 py-2.5 rounded-xl font-semibold text-sm animate-pulse"
            >
              <Volume2 className="w-4 h-4" />
              <span>Enable Speaker</span>
            </button>
          ) : (
            <button
              onClick={onTestSpeaker}
              className="btn-secondary h-11 px-5 py-2.5 rounded-xl font-medium text-sm hidden sm:flex"
              title="Test speaker output"
            >
              <Volume2 className="w-4 h-4 text-slate-300" />
              <span>{loc.testSound}</span>
            </button>
          )}

          {/* Mobile Conversation Drawer Toggle */}
          <button
            onClick={() => setShowMobileChat(prev => !prev)}
            className="btn-secondary h-11 px-5 py-2.5 rounded-xl font-medium text-sm lg:hidden"
            title="Toggle Transcript & Messages"
          >
            <MessageSquare className="w-4 h-4 text-slate-300" />
            <span>Chat</span>
          </button>
        </div>
      </div>

      {/* 2. Status Banner (Human, Professional Turn Indicator) */}
      <div className="bg-slate-950/60 border-b border-slate-800/80 px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5">
          {isChannelBusy ? (
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs sm:text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#F59E0B]" />
              <Lock className="w-4 h-4 text-amber-400" />
              <span>{loc.channelBusy} — {isPeerSpeaking ? `${peerDisplayName} is speaking...` : 'Loudspeaker active'}</span>
            </div>
          ) : isListening ? (
            <div className="flex items-center gap-2 text-red-400 font-semibold text-xs sm:text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse shadow-[0_0_8px_#EF4444]" />
              <Radio className="w-4 h-4 text-red-400" />
              <span>{loc.speakingNotice}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-400 font-medium text-xs sm:text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
              <span>{isPeerConnected ? loc.readyYourTurn : 'Share room link above to start conversation'}</span>
            </div>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2 text-slate-400 text-xs">
          <span>{isPeerConnected ? '2 Participants Connected' : 'Waiting for Remote Caller'}</span>
        </div>
      </div>

      {/* 3. Main Stage: Responsive Desktop Grid / Mobile Stack */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-3 sm:p-4 gap-3 sm:gap-4">
        {/* Left Calling Bay */}
        <div className="flex-1 flex flex-col justify-between gap-3 overflow-y-auto">
          {/* Dual Calling Stage Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 flex-1 min-h-[300px]">
            {/* CALLER 1: YOU */}
            <div className={`rounded-2xl p-4 sm:p-6 flex flex-col justify-between relative transition-all duration-200 ${
              isListening
                ? 'bg-slate-900 border-2 border-red-500/80 shadow-2xl shadow-red-950/30'
                : 'bg-slate-900/80 border border-slate-800'
            }`}>
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-red-400 animate-pulse shadow-[0_0_8px_#EF4444]' : 'bg-emerald-400'}`} />
                  <span className="font-bold text-base text-white">{userName} ({loc.you})</span>
                </div>

                <div className="h-9 px-3 rounded-lg bg-slate-800 border border-slate-700 flex items-center text-xs text-white">
                  <span className="text-slate-400 mr-2">Language:</span>
                  <select
                    value={localLanguage}
                    onChange={(e) => onLocalLanguageChange(e.target.value)}
                    className="bg-transparent text-blue-400 font-bold focus:outline-none cursor-pointer"
                  >
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code} className="bg-slate-900 text-white">
                        {l.native} ({l.name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Center Calling Avatar & Waveform */}
              <div className="flex-1 flex flex-col items-center justify-center my-6">
                <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center transition-all duration-200 relative ${
                  isListening
                    ? 'bg-red-500/10 border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.25)]'
                    : 'bg-slate-800 border-2 border-slate-700'
                }`}>
                  <Mic className={`w-10 h-10 ${isListening ? 'text-red-400 animate-pulse' : 'text-slate-300'}`} />
                  {isListening && (
                    <span className="absolute -bottom-2 text-[10px] font-bold uppercase tracking-wider bg-red-600 text-white px-2.5 py-0.5 rounded-full shadow-md">
                      Speaking
                    </span>
                  )}
                </div>

                <div className="mt-4 text-center">
                  <div className="text-base font-bold text-white">
                    {localMeta.native}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {isListening ? `Transmitting speech (${localAudioLevel}%)` : 'Microphone ready'}
                  </div>
                </div>
              </div>

              {/* Desktop Subtitle Deck (Inside Card) */}
              <div className="hidden lg:flex rounded-xl bg-slate-950/80 border border-slate-800 p-3.5 min-h-[80px] flex-col justify-center">
                {localInterim ? (
                  <p className="text-base font-bold text-white leading-normal">
                    "{localInterim}"
                  </p>
                ) : latestLocalOriginal ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">"{latestLocalOriginal}"</p>
                    <p className="text-xs text-emerald-400">Translated to {remoteMeta.native}: "{latestLocalTranslated}"</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    {loc.pttHelper}
                  </p>
                )}
              </div>
            </div>

            {/* CALLER 2: REMOTE PEER */}
            {isPeerConnected ? (
              <div className={`rounded-2xl p-4 sm:p-6 flex flex-col justify-between relative transition-all duration-200 ${
                isPeerSpeaking
                  ? 'bg-slate-900 border-2 border-amber-500/80 shadow-2xl shadow-amber-950/30'
                  : 'bg-slate-900/80 border border-slate-800'
              }`}>
                {/* Peer Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-3 h-3 rounded-full ${isPeerSpeaking ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_#F59E0B]' : 'bg-emerald-400'}`} />
                    <span className="font-bold text-base text-white">{peerDisplayName}</span>
                  </div>

                  <span className="h-9 px-3 rounded-lg bg-slate-800 border border-slate-700 flex items-center text-xs font-bold text-emerald-400">
                    {remoteMeta.native}
                  </span>
                </div>

                {/* Peer Central Visual */}
                <div className="flex-1 flex flex-col items-center justify-center my-6">
                  <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center transition-all duration-200 relative ${
                    isPeerSpeaking || isRemoteSpeaking
                      ? 'bg-amber-500/10 border-2 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.25)]'
                      : 'bg-slate-800 border-2 border-slate-700'
                  }`}>
                    <Volume2 className={`w-10 h-10 ${isPeerSpeaking || isRemoteSpeaking ? 'text-amber-400 animate-pulse' : 'text-slate-300'}`} />
                    {(isPeerSpeaking || isRemoteSpeaking) && (
                      <span className="absolute -bottom-2 text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-full shadow-md">
                        {isPeerSpeaking ? 'Talking' : 'Playing Voice'}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 text-center">
                    <div className="text-base font-bold text-white">
                      {remoteMeta.native}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {isPeerSpeaking ? 'Speaking in native tongue...' : isRemoteSpeaking ? 'Playing translated speech' : 'Loudspeaker active'}
                    </div>
                  </div>
                </div>

                {/* Desktop Subtitle Deck (Peer Card) */}
                <div className="hidden lg:flex rounded-xl bg-slate-950/80 border border-slate-800 p-3.5 min-h-[80px] flex-col justify-center">
                  {latestRemoteTranslated ? (
                    <div className="space-y-1">
                      <p className="text-base font-bold text-emerald-400">"{latestRemoteTranslated}"</p>
                      <p className="text-xs text-slate-400">Original: "{latestRemoteOriginal}"</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      When {peerDisplayName} speaks, words will translate into {localMeta.native} instantly.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* Waiting Card */
              <div className="rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/40 p-6 flex flex-col justify-between items-center text-center">
                <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-300 mt-4">
                  <Users className="w-8 h-8" />
                </div>

                <div className="space-y-2 max-w-sm my-4">
                  <h3 className="text-lg font-bold text-white">
                    Share Link to Connect Call
                  </h3>
                  <p className="text-xs text-slate-400">
                    Invite the other person to join this room. Real-time translation starts automatically once connected.
                  </p>
                </div>

                <div className="w-full flex flex-col sm:flex-row gap-2.5 pt-4 border-t border-slate-800/80">
                  <button
                    onClick={handleWhatsAppShare}
                    className="btn-success h-11 px-5 py-2.5 rounded-xl font-medium text-sm flex-1"
                  >
                    <MessageCircle className="w-4 h-4 fill-white" />
                    <span>Share on WhatsApp</span>
                  </button>

                  <button
                    onClick={handleCopyLink}
                    className="btn-secondary h-11 px-5 py-2.5 rounded-xl font-medium text-sm flex-1"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* UNIQUE MOBILE FLOATING SUBTITLE ISLAND (Dynamic Pill Island) */}
          <div className="lg:hidden w-full rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 p-4 shadow-2xl flex flex-col justify-center min-h-[90px]">
            {isListening && localInterim ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                  <span>You are speaking:</span>
                </div>
                <p className="text-base font-bold text-white leading-snug">
                  "{localInterim}"
                </p>
              </div>
            ) : latestRemoteTranslated && (isPeerSpeaking || isRemoteSpeaking) ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{peerDisplayName} (Translated):</span>
                </div>
                <p className="text-base font-bold text-emerald-400 leading-snug">
                  "{latestRemoteTranslated}"
                </p>
              </div>
            ) : latestLocalOriginal ? (
              <div className="space-y-1">
                <p className="text-xs text-slate-400">Last spoken: "{latestLocalOriginal}"</p>
                <p className="text-sm font-semibold text-emerald-400">Translated: "{latestLocalTranslated}"</p>
              </div>
            ) : (
              <div className="text-center text-xs text-slate-400 py-1">
                <p className="font-medium text-slate-300">{loc.pttHelper}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Dual-Mode: Hold button to talk or tap once to speak hands-free</p>
              </div>
            )}
          </div>

          {/* Unified Bottom Dock (Standardized Button Sizing) */}
          <div className="rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* Primary PTT Button */}
            <div className="w-full sm:w-auto flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <button
                type="button"
                disabled={isChannelBusy}
                onPointerDown={handlePttPointerDown}
                onPointerUp={handlePttPointerUp}
                onPointerCancel={handlePttPointerCancel}
                onClick={handlePttClick}
                className={`btn-base h-12 px-6 py-2.5 rounded-xl font-bold text-sm tracking-wide shadow-lg ${
                  isChannelBusy
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/40 cursor-not-allowed opacity-80'
                    : isListening
                      ? 'btn-danger shadow-red-950/50 animate-pulse'
                      : 'btn-primary shadow-blue-950/40'
                }`}
              >
                {isChannelBusy ? (
                  <>
                    <Lock className="w-5 h-5 text-amber-400" />
                    <span>{loc.channelBusy}</span>
                  </>
                ) : isListening ? (
                  <>
                    <Mic className="w-5 h-5 text-white" />
                    <span>{loc.tapWhenDone}</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5 text-white" />
                    <span>{loc.tapToSpeak}</span>
                  </>
                )}
              </button>

              {/* Volume Booster Toggle */}
              <button
                onClick={onToggleVolumeBoost}
                className={`btn-secondary h-11 px-5 py-2.5 rounded-xl font-medium text-sm ${
                  volumeBoost ? 'border-blue-500/80 text-blue-400 bg-blue-500/10' : ''
                }`}
                title="Loudspeaker Volume Booster (+6dB)"
              >
                <Volume2 className="w-4 h-4" />
                <span>+6dB Boost: {volumeBoost ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {/* End Call & Fast Actions */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                onClick={onOpenMinutes}
                className="btn-secondary h-11 px-5 py-2.5 rounded-xl font-medium text-sm"
              >
                <FileText className="w-4 h-4" />
                <span>Minutes</span>
              </button>

              <button
                onClick={onDisconnect}
                className="btn-danger h-11 px-5 py-2.5 rounded-xl font-semibold text-sm"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Leave Call</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Conversation Log & Quick Phrases (Desktop & Mobile Drawer) */}
        <div className={`w-full lg:w-96 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 flex flex-col overflow-hidden shrink-0 ${
          showMobileChat ? 'fixed inset-4 z-50 lg:static lg:inset-auto' : 'hidden lg:flex'
        }`}>
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
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
          <div className="p-3 border-b border-slate-800/80 bg-slate-950/40 space-y-2">
            <span className="text-xs font-semibold text-slate-400 block">
              Quick Tap Responses:
            </span>
            <div className="flex flex-col gap-1.5">
              {COMMON_PHRASES.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendTextUtterance(qp.text)}
                  className="w-full h-9 px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors flex items-center justify-between"
                >
                  <span className="truncate">{qp.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                </button>
              ))}
            </div>
          </div>

          {/* Transcript History */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-2.5 text-xs">
            {latestLocalOriginal || latestRemoteOriginal ? (
              <div className="space-y-3">
                {latestLocalOriginal && (
                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-1">
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
                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-1">
                    <span className="text-[11px] font-semibold text-emerald-400">{peerDisplayName} ({remoteMeta.name})</span>
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
          <form onSubmit={handleSend} className="p-3 border-t border-slate-800 flex items-center gap-2 bg-slate-950/40">
            <input
              type="text"
              value={typedMessage}
              onChange={(e) => setTypedMessage(e.target.value)}
              placeholder="Type a custom message..."
              className="flex-1 h-11 bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-xl px-4 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              className="btn-primary h-11 px-5 py-2.5 rounded-xl font-medium text-xs"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
