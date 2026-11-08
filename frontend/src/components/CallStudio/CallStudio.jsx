import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, Volume2, PhoneOff, Send, Copy, Check, ExternalLink,
  BookOpen, FileText, Share2, MessageCircle, Globe, Users, ArrowRight,
  Lock, Radio, MicOff
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
  const pointerStartTimeRef = useRef(0);
  const isPttPointerDownRef = useRef(false);
  const isSpacePressedRef = useRef(false);

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
  const peerDisplayName = remotePeer?.userName || 'Other Person (Remote)';

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
        // Chirp UP (mic key down)
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.04);
      } else {
        // Roger Beep (mic key release / send)
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

  // Desktop Spacebar Hotkey (Hold Spacebar to speak, release to send in 0ms)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        if (isChannelBusyRef.current) return;
        e.preventDefault();
        
        isSpacePressedRef.current = true;
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

        // Release spacebar: 100% guaranteed to stop recording and send in 0ms
        if (isSpacePressedRef.current || isListeningRef.current) {
          isSpacePressedRef.current = false;
          playTactileChirp(false);
          if (onFinalizeTurnRef.current) onFinalizeTurnRef.current();
        }
      }
    };

    const handleWindowBlur = () => {
      // If user tabs away, switches window, or loses focus while holding Spacebar or PTT: immediately stop recording
      if (isSpacePressedRef.current || isPttPointerDownRef.current || isListeningRef.current) {
        isSpacePressedRef.current = false;
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

  // Strict Push-to-Talk (Hold button to speak, release to send in 0ms; or tap to send if already talking)
  const handlePttPointerDown = (e) => {
    if (isChannelBusyRef.current) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}

    pointerStartTimeRef.current = Date.now();
    isPttPointerDownRef.current = true;

    if (!isListeningRef.current) {
      playTactileChirp(true);
      if (onStartListeningRef.current) onStartListeningRef.current();
    }
  };

  const handlePttPointerUp = (e) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}

    const duration = Date.now() - pointerStartTimeRef.current;
    const wasDown = isPttPointerDownRef.current;
    isPttPointerDownRef.current = false;

    // If held for more than 250ms, release immediately stops recording and sends in 0ms!
    if (duration > 250) {
      if (isListeningRef.current || wasDown) {
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
    if (isChannelBusyRef.current) return;
    const duration = Date.now() - pointerStartTimeRef.current;
    
    // For quick tap (<= 250ms):
    // If already speaking, tap immediately finalizes and sends!
    if (duration <= 250 && isListeningRef.current) {
      playTactileChirp(false);
      if (onFinalizeTurnRef.current) onFinalizeTurnRef.current();
    }
  };

  // Accessible, everyday conversational phrases for clear communication
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
    : `https://voxsynapse.com?room=${encodeURIComponent(roomId)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`Join my live translation call on VoiceBridge: ${inviteUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleOpenSecondTab = () => {
    window.open(inviteUrl, '_blank');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0A0A0A] overflow-hidden select-none font-sans text-xs">
      {/* 1. Header Bar with Clear Room Indicator & Sharing */}
      <div className="bg-[#111111] border-b border-[#262626] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center border border-[#333333] bg-[#0E0E0E] px-2.5 py-1">
            <span className="text-[#A1A1AA] text-xs font-mono mr-1.5">{loc.room}:</span>
            <span className="text-white font-bold text-xs tracking-wider">{roomId}</span>
          </div>

          {/* Quick WhatsApp Share Button */}
          <button
            onClick={handleWhatsAppShare}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#20ba59] text-black font-bold text-xs uppercase transition-colors cursor-pointer"
            title="Share Call Link directly to WhatsApp"
          >
            <MessageCircle className="w-4 h-4 fill-black" />
            <span className="hidden sm:inline">{loc.shareWhatsapp}</span>
            <span className="sm:hidden">WhatsApp</span>
          </button>

          {/* Copy Link Button */}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#333333] hover:border-white bg-[#161616] hover:bg-white hover:text-black text-white text-xs font-medium transition-colors"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-[#39FF14]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Copied!' : loc.copyLink}</span>
          </button>

          <button
            onClick={handleOpenSecondTab}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 border border-[#333333] hover:border-white text-[#A1A1AA] hover:text-white text-[11px] transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Test 2nd Window</span>
          </button>
        </div>

        {/* Audio Output Status */}
        <div className="flex items-center gap-2">
          {!audioUnlocked ? (
            <button
              onClick={onUnlockAudio}
              className="border border-[#E61919] bg-[#E61919] text-white px-3 py-1 font-bold text-xs animate-pulse"
            >
              🔊 Activate Loudspeaker
            </button>
          ) : (
            <button
              onClick={onTestSpeaker}
              className="border border-[#333333] bg-[#161616] hover:bg-[#222222] text-white px-2.5 py-1 text-xs"
            >
              🔊 {loc.testSound}
            </button>
          )}

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 border border-[#262626] bg-[#0E0E0E] text-[11px] text-white">
            <span className={`w-2 h-2 ${isPeerConnected ? 'bg-[#39FF14]' : 'bg-[#E61919] animate-pulse'}`} />
            <span>{isPeerConnected ? '2 People Connected' : 'Waiting for Peer'}</span>
          </div>
        </div>
      </div>

      {/* 2. Clear Visual Turn Indicator Banner (Floor Lock & Strict PTT) */}
      <div className="border-b border-[#262626] bg-[#0E0E0E] px-4 py-2 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2.5">
          {isChannelBusy ? (
            <div className="flex items-center gap-2 text-[#F59E0B] font-bold text-sm">
              <span className="w-2.5 h-2.5 bg-[#F59E0B] animate-pulse" />
              <Lock className="w-4 h-4 text-[#F59E0B]" />
              <span>{loc.channelBusy} — {isPeerSpeaking ? `${peerDisplayName} is speaking...` : 'Loudspeaker active'}</span>
            </div>
          ) : isListening ? (
            <div className="flex items-center gap-2 text-[#E61919] font-bold text-sm">
              <span className="w-2.5 h-2.5 bg-[#E61919] animate-pulse" />
              <Radio className="w-4 h-4 text-[#E61919]" />
              <span>{loc.speakingNotice}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[#39FF14] text-xs font-bold">
              <span className="w-2.5 h-2.5 bg-[#39FF14]" />
              <span>{isPeerConnected ? loc.readyYourTurn : 'Share link above to start conversation'}</span>
            </div>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2 text-[#71717A] text-[11px]">
          <span>[STRICT PTT FLOOR LOCKED // ZERO LATENCY]</span>
        </div>
      </div>

      {/* 3. Main Stage: Two Clear Calling Cards + Right Chat */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-3 gap-3">
        {/* Left Calling Bay */}
        <div className="flex-1 flex flex-col justify-between gap-3 overflow-y-auto">
          {/* Dual Station Calling Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-[360px]">
            {/* CALLER 1: YOU */}
            <div className="border-2 border-[#262626] bg-[#111111] p-4 sm:p-5 flex flex-col justify-between relative">
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-[#262626] pb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 ${isListening ? 'bg-[#E61919] animate-pulse' : 'bg-[#39FF14]'}`} />
                  <span className="font-extrabold text-sm text-white">{userName} ({loc.you})</span>
                </div>

                <div className="border border-[#333333] bg-[#161616] px-2.5 py-1 text-xs text-white">
                  <span className="text-[#A1A1AA] mr-1">Language:</span>
                  <select
                    value={localLanguage}
                    onChange={(e) => onLocalLanguageChange(e.target.value)}
                    className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                  >
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code} className="bg-[#161616] text-white">
                        {l.native} ({l.name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Central Audio & Status Visual */}
              <div className="flex-1 flex flex-col items-center justify-center my-4">
                <div className="w-24 h-24 border-2 border-white/20 bg-[#161616] flex flex-col items-center justify-center p-2 text-center">
                  <Mic className={`w-8 h-8 ${isListening ? 'text-[#E61919] animate-bounce' : 'text-white'}`} />
                  <span className="text-[10px] text-white font-bold mt-1">
                    {isListening ? 'TALKING...' : 'MIC READY'}
                  </span>
                </div>

                <div className="mt-3 text-center">
                  <div className="text-sm font-bold text-white">
                    {localMeta.native} Channel
                  </div>
                  <div className="text-xs text-[#A1A1AA] mt-0.5">
                    {isListening ? `Hearing your voice (${localAudioLevel}% dB)` : 'Microphone ready to speak'}
                  </div>
                </div>
              </div>

              {/* Subtitle Teleprompter (Large comfortable text) */}
              <div className="border border-[#262626] bg-[#0A0A0A] p-3.5 min-h-[85px] flex flex-col justify-center">
                {localInterim ? (
                  <p className="text-base font-bold text-white leading-normal">
                    "{localInterim}"
                  </p>
                ) : latestLocalOriginal ? (
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-white leading-snug">
                      "{latestLocalOriginal}"
                    </div>
                    <div className="text-xs text-[#39FF14] font-medium">
                      → [{remoteMeta.native}]: "{latestLocalTranslated}"
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#71717A] leading-relaxed">
                    {isListening
                      ? 'Transmitting live speech... Release button or tap again to send immediately (0ms).'
                      : isChannelBusy
                        ? 'Floor locked while ' + peerDisplayName + ' is transmitting.'
                        : 'Hold to Talk or tap once to Speak (PTT) / Spacebar.'}
                  </p>
                )}
              </div>
            </div>

            {/* CALLER 2: PEER (OR WAITING CARD) */}
            {isPeerConnected ? (
              /* CONNECTED PEER CARD */
              <div className="border-2 border-[#262626] bg-[#111111] p-4 sm:p-5 flex flex-col justify-between relative">
                <div className="flex items-center justify-between border-b border-[#262626] pb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 ${isPeerSpeaking ? 'bg-amber-400 animate-pulse' : 'bg-[#39FF14]'}`} />
                    <span className="font-extrabold text-sm text-white">{peerDisplayName}</span>
                  </div>

                  <div className="border border-[#333333] bg-[#161616] px-2.5 py-1 text-xs text-white font-bold">
                    {remoteMeta.native}
                  </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center my-4">
                  <div className="w-24 h-24 border-2 border-white/20 bg-[#161616] flex flex-col items-center justify-center p-2 text-center">
                    <Volume2 className={`w-8 h-8 ${isRemoteSpeaking ? 'text-[#39FF14] animate-pulse' : 'text-white'}`} />
                    <span className="text-[10px] text-white font-bold mt-1">
                      {isPeerSpeaking ? 'TALKING' : isRemoteSpeaking ? 'LOUDSPEAKER' : 'LISTENING'}
                    </span>
                  </div>

                  <div className="mt-3 text-center">
                    <div className="text-sm font-bold text-white">
                      {remoteMeta.native} Channel
                    </div>
                    <div className="text-xs text-[#A1A1AA] mt-0.5">
                      {isPeerSpeaking ? 'Speaking in their native tongue...' : isRemoteSpeaking ? 'Playing translated speech out loud' : 'Loudspeaker armed'}
                    </div>
                  </div>
                </div>

                {/* Subtitle Teleprompter for Peer */}
                <div className="border border-[#262626] bg-[#0A0A0A] p-3.5 min-h-[85px] flex flex-col justify-center">
                  {latestRemoteTranslated ? (
                    <div className="space-y-1">
                      <div className="text-base font-extrabold text-[#39FF14] leading-snug">
                        "{latestRemoteTranslated}"
                      </div>
                      <div className="text-xs text-[#A1A1AA]">
                        Original [{remoteMeta.name}]: "{latestRemoteOriginal}"
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#71717A] leading-relaxed">
                      When {peerDisplayName} speaks, their words are instantly translated into {localMeta.native} and played out loud through your speaker.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* WAITING TO CONNECT (ACCESSIBLE INVITATION CARD) */
              <div className="border-2 border-dashed border-[#333333] bg-[#111111] p-5 sm:p-6 flex flex-col justify-between items-center text-center">
                <div className="w-16 h-16 bg-[#1A1A1A] border border-[#333333] flex items-center justify-center text-white mb-2">
                  <Users className="w-8 h-8" />
                </div>

                <div className="space-y-2 max-w-sm">
                  <h3 className="text-lg font-extrabold text-white">
                    కాల్‌లో చేరడానికి లింక్ షేర్ చేయండి
                  </h3>
                  <p className="text-sm text-[#A1A1AA] leading-normal">
                    Share the call link with the other person. You can easily share directly to WhatsApp.
                  </p>
                </div>

                <div className="w-full flex flex-col sm:flex-row gap-2 mt-4 pt-3 border-t border-[#262626]">
                  {/* WhatsApp Primary Share */}
                  <button
                    onClick={handleWhatsAppShare}
                    className="flex-1 py-3 bg-[#25D366] hover:bg-[#20ba59] text-black font-extrabold text-xs uppercase flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <MessageCircle className="w-4 h-4 fill-black" />
                    <span>WhatsApp లో పంపండి</span>
                  </button>

                  {/* Copy Link Secondary */}
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 py-3 border border-white bg-white hover:bg-[#E5E5E5] text-black font-extrabold text-xs uppercase flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Primary Controls (Giant Mic Button for Rural Ease) */}
          <div className="border border-[#262626] bg-[#111111] p-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* Giant Dual Strict PTT Mic Button with Floor Lock */}
            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isChannelBusy}
                  onPointerDown={handlePttPointerDown}
                  onPointerUp={handlePttPointerUp}
                  onPointerCancel={handlePttPointerCancel}
                  onClick={handlePttClick}
                  className={`flex-1 sm:flex-none px-6 py-3.5 font-extrabold text-sm uppercase flex items-center justify-center gap-3 border-2 transition-all select-none ${
                    isChannelBusy
                      ? 'border-[#B45309] bg-[#1C1305] text-[#F59E0B] opacity-85 cursor-not-allowed'
                      : isListening
                        ? 'border-[#E61919] bg-[#E61919] text-white animate-pulse shadow-[0_0_25px_rgba(230,25,25,0.7)] cursor-pointer'
                        : 'border-[#39FF14] bg-[#39FF14] text-black hover:bg-[#32e012] cursor-pointer shadow-lg active:translate-y-[1px]'
                  }`}
                >
                  {isChannelBusy ? (
                    <>
                      <Lock className="w-5 h-5 text-[#F59E0B]" />
                      <div className="text-left">
                        <div className="text-xs font-bold leading-tight">{loc.channelBusy}</div>
                        <div className="text-[10px] text-[#D97706] font-mono">[PEER TRANSMITTING // FLOOR LOCKED]</div>
                      </div>
                    </>
                  ) : isListening ? (
                    <>
                      <Mic className="w-5 h-5 stroke-[2.5]" />
                      <div className="text-left">
                        <div className="text-xs font-extrabold leading-tight">{loc.tapWhenDone}</div>
                        <div className="text-[10px] text-white/90 font-mono">RELEASE (HOLD) OR TAP TO SEND (0ms)</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <Radio className="w-5 h-5 stroke-[2.5]" />
                      <div className="text-left">
                        <div className="text-xs font-extrabold leading-tight">{loc.tapToSpeak}</div>
                        <div className="text-[10px] text-black/80 font-mono">HOLD TO TALK OR TAP / SPACEBAR</div>
                      </div>
                    </>
                  )}
                </button>

                <button
                  onClick={onToggleVolumeBoost}
                  className={`px-3 py-3.5 border text-xs font-bold uppercase transition-colors ${
                    volumeBoost ? 'border-white bg-[#1A1A1A] text-white' : 'border-[#333333] bg-[#111111] text-[#71717A]'
                  }`}
                  title="Loudspeaker Volume Booster (+6dB)"
                >
                  <Volume2 className="w-4 h-4 inline mr-1" />
                  <span>+6dB Boost: {volumeBoost ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              <div className="text-[11px] text-[#71717A] px-1 font-mono flex items-center justify-between">
                <span>{isChannelBusy ? 'Channel busy — mic disabled to prevent confusion' : loc.pttHelper}</span>
                <span className="hidden sm:inline">[0ms PTT]</span>
              </div>
            </div>

            {/* Fast Tools & End Call */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={onOpenMinutes}
                className="px-3 py-2 border border-[#333333] hover:border-white bg-[#161616] text-white text-xs font-medium"
              >
                <FileText className="w-3.5 h-3.5 inline mr-1" />
                <span>Minutes</span>
              </button>

              <button
                onClick={onDisconnect}
                className="px-4 py-2 border border-[#E61919] bg-[#1A0A0A] hover:bg-[#E61919] text-[#E61919] hover:text-white font-bold text-xs uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>Leave Call</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Chat & Conversation Presets */}
        <div className="w-full lg:w-96 border border-[#262626] bg-[#111111] flex flex-col overflow-hidden shrink-0">
          <div className="bg-[#161616] border-b border-[#262626] p-3 flex items-center justify-between font-mono">
            <span className="font-bold text-xs uppercase text-white">
              CONVERSATION LOG
            </span>
            <span className="text-[11px] text-[#A1A1AA]">
              {isPeerConnected ? '2/2 Connected' : 'Waiting for Peer'}
            </span>
          </div>

          {/* Everyday Common Phrases */}
          <div className="p-2.5 border-b border-[#262626] bg-[#0E0E0E] space-y-1.5">
            <div className="text-[11px] text-[#A1A1AA] font-bold">
              QUICK PHRASES (TAP TO TRANSLATE):
            </div>
            <div className="flex flex-col gap-1">
              {COMMON_PHRASES.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendTextUtterance(qp.text)}
                  className="w-full px-2.5 py-1.5 border border-[#262626] hover:border-white bg-[#141414] hover:bg-white hover:text-black text-left text-xs text-[#A1A1AA] hover:text-black transition-colors flex items-center justify-between"
                >
                  <span className="font-medium text-white group-hover:text-black">{qp.label}</span>
                  <span className="text-[10px] text-[#71717A]">&gt;</span>
                </button>
              ))}
            </div>
          </div>

          {/* Subtitle Dialogue History */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
            {latestLocalOriginal || latestRemoteOriginal ? (
              <div className="space-y-2.5">
                {latestLocalOriginal && (
                  <div className="border border-[#262626] bg-[#0E0E0E] p-2.5">
                    <div className="flex justify-between items-center text-[10px] text-[#71717A] mb-1 font-mono">
                      <span className="text-white font-bold">{userName} [{localMeta.name}]</span>
                      <span>JUST NOW</span>
                    </div>
                    <div className="text-white font-medium text-sm">&gt; "{latestLocalOriginal}"</div>
                    <div className="text-[#39FF14] text-xs mt-1">
                      → [{remoteMeta.name}]: "{latestLocalTranslated}"
                    </div>
                  </div>
                )}

                {latestRemoteOriginal && (
                  <div className="border border-[#333333] bg-[#161616] p-2.5">
                    <div className="flex justify-between items-center text-[10px] text-[#71717A] mb-1 font-mono">
                      <span className="text-white font-bold">{peerDisplayName} [{remoteMeta.name}]</span>
                      <span className="text-[#39FF14]">SPOKEN OUT LOUD</span>
                    </div>
                    <div className="text-white font-medium text-sm">&gt; "{latestRemoteOriginal}"</div>
                    <div className="text-[#39FF14] font-bold text-sm mt-1">
                      → "{latestRemoteTranslated}"
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-[#71717A] space-y-2">
                <p className="text-xs">
                  {isPeerConnected
                    ? 'Call connected! Tap the green mic button below to talk.'
                    : 'Share the call link on WhatsApp to begin translating.'}
                </p>
              </div>
            )}
          </div>

          {/* Quick Text Input */}
          <form onSubmit={handleSend} className="p-2.5 bg-[#0E0E0E] border-t border-[#262626] flex gap-2">
            <input
              type="text"
              value={typedMessage}
              onChange={(e) => setTypedMessage(e.target.value)}
              placeholder={`Type in ${localMeta.native}...`}
              className="flex-1 bg-[#161616] border border-[#333333] px-3 py-2 text-xs text-white placeholder-[#52525B] focus:outline-none focus:border-white"
            />
            <button
              type="submit"
              disabled={!typedMessage.trim()}
              className="px-4 py-2 bg-white hover:bg-[#E5E5E5] disabled:opacity-30 text-black font-bold text-xs uppercase transition-colors cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
