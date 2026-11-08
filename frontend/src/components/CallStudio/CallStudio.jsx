import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, Volume2, PhoneOff, Send, Copy, Check,
  FileText, MessageCircle, Globe, Users, ArrowRight,
  Lock, Radio, VolumeX, MessageSquare, Disc
} from 'lucide-react';
import { SUPPORTED_LANGUAGES, getLanguageMeta, getLocaleStrings } from '../../utils/languages.js';
import { CallerAvatar } from './CallerAvatar.jsx';
import { callRecorder } from '../../utils/callRecorder.js';

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
            sourceLang: localMeta.name,
            targetLang: remoteMeta.name
          });
          localStorage.setItem('voicebridge_recorded_calls', JSON.stringify(pastCalls.slice(0, 20)));
        } catch (e) {}
      }
    }
  };

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
    <div className="flex-1 flex flex-col h-full bg-[#0B0F17] overflow-hidden select-none font-sans text-sm">
      {/* 1. Sleek Top Bar (Google Meet Style: Single Row, Zero Wrap, Compact Badges) */}
      <div className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
        {/* Left: Room Badge */}
        <div className="h-10 px-3 rounded-xl bg-slate-800/90 border border-slate-700/80 flex items-center text-xs font-medium text-slate-200 shrink-0">
          <span className="text-slate-400 mr-1.5 hidden xs:inline">{loc.room}:</span>
          <span className="font-bold text-white tracking-wide">{roomId}</span>
        </div>

        {/* Right: Uniform Actions in a Clean Row */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Call Recording Button (Pillar 4: Zero-Latency Recording) */}
          <button
            onClick={handleToggleRecord}
            className={`h-10 px-3 sm:px-4 py-2 rounded-xl font-medium text-xs flex items-center gap-1.5 transition-all ${
              isRecording
                ? 'bg-red-500/20 border border-red-500/80 text-red-400 animate-pulse shadow-md shadow-red-950/40'
                : 'btn-secondary text-slate-300 hover:text-white'
            }`}
            title={isRecording ? 'Click to stop and save audio recording' : 'Record continuous call audio with zero latency'}
          >
            <Disc className={`w-4 h-4 shrink-0 ${isRecording ? 'text-red-400 animate-spin' : 'text-slate-400'}`} />
            <span>{isRecording ? `REC ${formatRecordTime(recordSeconds)}` : 'Record'}</span>
          </button>

          {/* Quick WhatsApp Share Button */}
          <button
            onClick={handleWhatsAppShare}
            className="btn-success h-10 px-3 sm:px-4 py-2 rounded-xl font-medium text-xs shadow-sm flex items-center gap-1.5"
            title="Share Call Link to WhatsApp"
          >
            <MessageCircle className="w-4 h-4 fill-white text-white shrink-0" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>

          {/* Copy Link Button */}
          <button
            onClick={handleCopyLink}
            className="btn-secondary h-10 px-3 sm:px-4 py-2 rounded-xl font-medium text-xs flex items-center gap-1.5"
            title="Copy Invite Link"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <Copy className="w-4 h-4 text-slate-300 shrink-0" />}
            <span className="hidden sm:inline">{copiedLink ? 'Copied' : loc.copyLink}</span>
          </button>

          {/* Audio Output Status & Test */}
          {!audioUnlocked ? (
            <button
              onClick={onUnlockAudio}
              className="btn-danger h-10 px-3 sm:px-4 py-2 rounded-xl font-semibold text-xs animate-pulse flex items-center gap-1.5"
            >
              <Volume2 className="w-4 h-4 shrink-0" />
              <span className="hidden xs:inline">Speaker</span>
            </button>
          ) : (
            <button
              onClick={onTestSpeaker}
              className="btn-secondary h-10 px-3 py-2 rounded-xl font-medium text-xs hidden sm:flex items-center gap-1.5"
              title="Test speaker output"
            >
              <Volume2 className="w-4 h-4 text-slate-300" />
            </button>
          )}

          {/* Mobile Conversation Drawer Toggle */}
          <button
            onClick={() => setShowMobileChat(prev => !prev)}
            className="btn-secondary h-10 px-3 sm:px-4 py-2 rounded-xl font-medium text-xs flex items-center gap-1.5 lg:hidden"
            title="Toggle Transcript & Messages"
          >
            <MessageSquare className="w-4 h-4 text-slate-300 shrink-0" />
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
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 flex-1 min-h-0">
            {/* CALLER 1: YOU */}
            <div className={`rounded-2xl p-3 sm:p-5 flex flex-col justify-between relative transition-all duration-200 overflow-hidden ${
              isListening
                ? 'bg-slate-900 border-2 border-red-500/80 shadow-2xl shadow-red-950/30'
                : 'bg-slate-900/80 border border-slate-800'
            }`}>
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 sm:pb-3 gap-1 overflow-hidden">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <div className={`w-2 h-2 shrink-0 rounded-full ${isListening ? 'bg-red-400 animate-pulse shadow-[0_0_8px_#EF4444]' : 'bg-emerald-400'}`} />
                  <span className="font-bold text-xs sm:text-sm text-white truncate">{userName} ({loc.you})</span>
                </div>

                <div className="h-7 px-2 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center text-[11px] text-white shrink-0 max-w-[85px] sm:max-w-none">
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
              <div className="flex-1 flex flex-col items-center justify-center my-2 sm:my-4">
                <CallerAvatar isLocal={true} isSpeaking={isListening} />

                <div className="mt-2.5 sm:mt-3 text-center">
                  <div className="text-xs sm:text-base font-bold text-white">
                    {localMeta.native}
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
                    {isListening ? `Speaking (${localAudioLevel}%)` : 'Ready to talk'}
                  </div>
                </div>
              </div>

              {/* Desktop Subtitle Deck (Inside Card) */}
              <div className="hidden lg:flex rounded-xl bg-slate-950/80 border border-slate-800 p-3 min-h-[75px] flex-col justify-center">
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
              <div className={`rounded-2xl p-3 sm:p-5 flex flex-col justify-between relative transition-all duration-200 overflow-hidden ${
                isPeerSpeaking
                  ? 'bg-slate-900 border-2 border-amber-500/80 shadow-2xl shadow-amber-950/30'
                  : 'bg-slate-900/80 border border-slate-800'
              }`}>
                {/* Peer Header */}
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 sm:pb-3 gap-1 overflow-hidden">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <div className={`w-2 h-2 shrink-0 rounded-full ${isPeerSpeaking ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_#F59E0B]' : 'bg-emerald-400'}`} />
                    <span className="font-bold text-xs sm:text-sm text-white truncate">{peerDisplayName}</span>
                  </div>

                  <span className="h-7 px-2 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center text-[11px] font-bold text-emerald-400 shrink-0">
                    {remoteMeta.name}
                  </span>
                </div>

                {/* Peer Central Visual */}
                <div className="flex-1 flex flex-col items-center justify-center my-2 sm:my-4">
                  <CallerAvatar isLocal={false} isSpeaking={isPeerSpeaking || isRemoteSpeaking} />

                  <div className="mt-2.5 sm:mt-3 text-center">
                    <div className="text-xs sm:text-base font-bold text-white">
                      {remoteMeta.native}
                    </div>
                    <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
                      {isPeerSpeaking ? 'Speaking in native...' : isRemoteSpeaking ? 'Playing translation' : 'Loudspeaker active'}
                    </div>
                  </div>
                </div>

                {/* Desktop Subtitle Deck (Peer Card) */}
                <div className="hidden lg:flex rounded-xl bg-slate-950/80 border border-slate-800 p-3 min-h-[75px] flex-col justify-center">
                  {latestRemoteTranslated ? (
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-emerald-400">"{latestRemoteTranslated}"</p>
                      <p className="text-[11px] text-slate-400">Original: "{latestRemoteOriginal}"</p>
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
              <div className="rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/40 p-3 sm:p-5 flex flex-col justify-between items-center text-center overflow-hidden">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-300 mt-2 sm:mt-4">
                  <Users className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>

                <div className="space-y-1.5 max-w-sm my-2 sm:my-4">
                  <h3 className="text-xs sm:text-base font-bold text-white">
                    Share Link to Connect
                  </h3>
                  <p className="text-[10px] sm:text-xs text-slate-400 line-clamp-2 sm:line-clamp-none">
                    Invite remote caller. Real-time translation starts automatically once connected.
                  </p>
                </div>

                <div className="w-full flex flex-col sm:flex-row gap-2 pt-2 sm:pt-4 border-t border-slate-800/80">
                  <button
                    onClick={handleWhatsAppShare}
                    className="btn-success h-10 px-3 sm:px-4 py-2 rounded-xl font-medium text-xs sm:text-sm flex-1"
                  >
                    <MessageCircle className="w-4 h-4 fill-white shrink-0" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    onClick={handleCopyLink}
                    className="btn-secondary h-10 px-3 sm:px-4 py-2 rounded-xl font-medium text-xs sm:text-sm flex-1"
                  >
                    <Copy className="w-4 h-4 shrink-0" />
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* UNIQUE MOBILE FLOATING SUBTITLE ISLAND (Dynamic Pill Island) */}
          <div className="lg:hidden w-full rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 p-3.5 sm:p-4 shadow-2xl flex flex-col justify-center min-h-[80px]">
            {isListening && localInterim ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                  <span>You are speaking:</span>
                </div>
                <p className="text-sm sm:text-base font-bold text-white leading-snug">
                  "{localInterim}"
                </p>
              </div>
            ) : latestRemoteTranslated && (isPeerSpeaking || isRemoteSpeaking) ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{peerDisplayName} (Translated):</span>
                </div>
                <p className="text-sm sm:text-base font-bold text-emerald-400 leading-snug">
                  "{latestRemoteTranslated}"
                </p>
              </div>
            ) : latestLocalOriginal ? (
              <div className="space-y-1">
                <p className="text-xs text-slate-400">Last spoken: "{latestLocalOriginal}"</p>
                <p className="text-xs sm:text-sm font-semibold text-emerald-400">Translated: "{latestLocalTranslated}"</p>
              </div>
            ) : (
              <div className="text-center text-xs text-slate-400 py-1">
                <p className="font-medium text-slate-300">{loc.pttHelper}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Dual-Mode: Hold button to talk or tap once to speak hands-free</p>
              </div>
            )}
          </div>

          {/* Unified Bottom Dock (Standardized Button Sizing) */}
          <div className="rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 p-2.5 sm:p-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3 shrink-0">
            {/* Primary PTT Button */}
            <div className="w-full sm:w-auto flex-1 flex items-stretch sm:items-center gap-2">
              <button
                type="button"
                disabled={isChannelBusy}
                onPointerDown={handlePttPointerDown}
                onPointerUp={handlePttPointerUp}
                onPointerCancel={handlePttPointerCancel}
                onClick={handlePttClick}
                className={`btn-base flex-1 sm:flex-none h-11 px-5 py-2.5 rounded-xl font-bold text-sm tracking-wide shadow-lg ${
                  isChannelBusy
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/40 cursor-not-allowed opacity-80'
                    : isListening
                      ? 'btn-danger shadow-red-950/50 animate-pulse'
                      : 'btn-primary shadow-blue-950/40'
                }`}
              >
                {isChannelBusy ? (
                  <>
                    <Lock className="w-4 h-4 text-amber-400" />
                    <span>{loc.channelBusy}</span>
                  </>
                ) : isListening ? (
                  <>
                    <Mic className="w-4 h-4 text-white" />
                    <span>{loc.tapWhenDone}</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-white" />
                    <span>{loc.tapToSpeak}</span>
                  </>
                )}
              </button>

              {/* Volume Booster Toggle */}
              <button
                onClick={onToggleVolumeBoost}
                className={`btn-secondary h-11 px-3 sm:px-5 py-2.5 rounded-xl font-medium text-xs sm:text-sm ${
                  volumeBoost ? 'border-blue-500/80 text-blue-400 bg-blue-500/10' : ''
                }`}
                title="Loudspeaker Volume Booster (+6dB)"
              >
                <Volume2 className="w-4 h-4 shrink-0" />
                <span>Boost: {volumeBoost ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {/* End Call & Fast Actions */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={onOpenMinutes}
                className="btn-secondary flex-1 sm:flex-none h-11 px-5 py-2.5 rounded-xl font-medium text-sm"
              >
                <FileText className="w-4 h-4" />
                <span>Minutes</span>
              </button>

              <button
                onClick={onDisconnect}
                className="btn-danger flex-1 sm:flex-none h-11 px-5 py-2.5 rounded-xl font-semibold text-sm"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Leave</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Backdrop for Transcript Drawer */}
        {showMobileChat && (
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setShowMobileChat(false)}
          />
        )}

        {/* Right Sidebar: Conversation Log & Quick Phrases (Desktop & Mobile Drawer) */}
        <div className={`w-full lg:w-96 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-800 flex flex-col overflow-hidden shrink-0 ${
          showMobileChat ? 'fixed inset-3 sm:inset-6 z-50 lg:static lg:inset-auto shadow-2xl' : 'hidden lg:flex'
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
