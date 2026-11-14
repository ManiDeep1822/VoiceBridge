import React, { useState, useEffect } from 'react';
import { 
  PhoneCall, 
  Volume2, 
  Globe, 
  User, 
  ArrowRight, 
  CheckCircle2, 
  ChevronDown, 
  RefreshCw, 
  Edit3, 
  Check, 
  Radio, 
  Activity, 
  Mic, 
  ShieldCheck, 
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { SUPPORTED_LANGUAGES, getLanguageMeta, getLocaleStrings } from '../../utils/languages.js';

export function PreJoinLobby({
  roomId = 'VOX-ROOM-101',
  onRoomIdChange,
  userName = 'Operator',
  onUserNameChange,
  selectedLanguage = 'en',
  onLanguageChange,
  onJoinMeeting,
  audioLevel = 0,
  onTestAudio,
  isGuestJoin = false
}) {
  const [testingSound, setTestingSound] = useState(false);
  const [customRoom, setCustomRoom] = useState(roomId);
  const [showRoomInput, setShowRoomInput] = useState(false);
  const [isInsecureOrigin, setIsInsecureOrigin] = useState(() => {
    if (typeof window !== 'undefined') {
      const { protocol, hostname } = window.location;
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
      return protocol === 'http:' && !isLocal;
    }
    return false;
  });

  const langMeta = getLanguageMeta(selectedLanguage);
  const loc = getLocaleStrings(selectedLanguage);

  // Sync internal customRoom state when external roomId changes
  useEffect(() => {
    setCustomRoom(roomId);
  }, [roomId]);

  const handleTestSound = () => {
    setTestingSound(true);
    if (onTestAudio) onTestAudio();
    setTimeout(() => setTestingSound(false), 2000);
  };

  const handleGenerateRoom = () => {
    const randomId = `VOX-${Math.floor(100 + Math.random() * 900)}`;
    if (onRoomIdChange) onRoomIdChange(randomId);
    setCustomRoom(randomId);
    setShowRoomInput(false);
  };

  const handleSaveCustomRoom = (e) => {
    e?.preventDefault();
    if (customRoom.trim() && onRoomIdChange) {
      onRoomIdChange(customRoom.trim().toUpperCase());
      setShowRoomInput(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!userName.trim()) return;
    onJoinMeeting();
  };

  return (
    <div className="flex-1 flex items-center justify-center p-3 sm:p-6 bg-black text-white relative overflow-y-auto select-none font-sans w-full max-w-full box-border">
      {/* Swiss Monochrome Subtle Background Grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.15) 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }}
      />

      <div className="w-full max-w-lg bg-black border border-white/20 rounded-2xl p-4 sm:p-7 shadow-2xl space-y-5 box-border relative z-10">
        
        {/* HTTPS Origin Security Guard Banner */}
        {isInsecureOrigin && (
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/30 text-white text-xs flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white shrink-0 animate-pulse" />
              <span className="font-sans text-zinc-300">
                <strong className="text-white">HTTPS Security Warning:</strong> Non-localhost HTTP detected. Mobile browsers (iOS Safari, Android Chrome) require HTTPS or localhost for WebRTC and microphone permissions.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsInsecureOrigin(false)}
              className="text-zinc-400 hover:text-white font-mono text-xs underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Header: Status Pill & Room Info */}
        <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                {isGuestJoin ? 'Guest Call Invitation' : 'Enterprise Telemetry Pre-Join'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-sans">
              {isGuestJoin ? 'Join Live Call' : 'Call Dispatch Lobby'}
            </h1>
          </div>

          {/* Room Pill & Actions */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setShowRoomInput(prev => !prev)}
              className="h-8 px-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-900 border border-white/20 text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Click to edit Room ID"
            >
              <span className="text-zinc-400 text-[11px]">Room:</span>
              <span className="font-bold text-white text-xs tracking-wide font-mono">{roomId}</span>
              <Edit3 className="w-3 h-3 text-zinc-400" />
            </button>

            {!isGuestJoin && (
              <button
                type="button"
                onClick={handleGenerateRoom}
                title="Generate new room ID"
                className="h-8 px-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-900 border border-white/20 text-xs font-medium text-zinc-200 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-white" />
                <span className="text-xs">New</span>
              </button>
            )}
          </div>
        </div>

        {/* Room configuration edit form */}
        {showRoomInput && (
          <form onSubmit={handleSaveCustomRoom} className="p-3 bg-zinc-950 rounded-xl border border-white/20 flex gap-2 animate-fadeIn">
            <input
              type="text"
              value={customRoom}
              onChange={(e) => setCustomRoom(e.target.value.toUpperCase())}
              placeholder="Enter Room Code (e.g. VOX-ROOM-101)"
              className="flex-1 h-9 px-3 bg-black border border-white/20 rounded-lg text-xs font-mono text-white uppercase focus:outline-none focus:border-white font-medium"
            />
            <button type="submit" className="h-9 px-3.5 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold flex items-center gap-1 cursor-pointer">
              <Check className="w-3.5 h-3.5" />
              <span>Apply</span>
            </button>
          </form>
        )}

        {/* Circular Radar Latency Indicator (FaceTime / Swiss style) */}
        <div className="rounded-xl bg-zinc-950 border border-white/20 p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Animated Circular Radar Indicator */}
            <div className="relative w-11 h-11 rounded-full bg-black border border-white/30 flex items-center justify-center shrink-0 overflow-hidden">
              <div className="absolute inset-1 rounded-full border border-white/20" />
              <div className="absolute inset-2 rounded-full border border-white/10" />
              <div className="absolute w-full h-full bg-gradient-to-tr from-transparent via-white/10 to-white/20 animate-spin" style={{ animationDuration: '3s' }} />
              <span className="w-2 h-2 rounded-full bg-white shadow-sm" />
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white tracking-wide">WebRTC Telemetry Link</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-white font-mono font-semibold border border-white/20">
                  18ms RTT
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Duplex mesh channel ready • Zero-jitter Opus 48kHz audio pipeline
              </p>
            </div>
          </div>

          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-[10px] uppercase font-mono text-zinc-500 font-bold">Protocol</span>
            <span className="text-[11px] text-zinc-300 font-mono font-medium">SRTP / DTLS</span>
          </div>
        </div>

        {/* Main Pre-Join Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Language Pairing Selector */}
          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-medium text-zinc-200 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-white" />
                <span>Spoken Language (Your Input)</span>
              </span>
              <span className="text-[11px] font-semibold text-white bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                {langMeta.native}
              </span>
            </label>

            <div className="relative">
              <select
                value={selectedLanguage}
                onChange={(e) => onLanguageChange(e.target.value)}
                className="w-full h-11 bg-zinc-950 border border-white/20 hover:border-white/40 focus:border-white rounded-xl px-4 text-sm text-white font-medium focus:outline-none cursor-pointer appearance-none transition-colors"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-black text-white">
                    {l.native} ({l.name})
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-3.5 text-zinc-400 pointer-events-none flex items-center">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[11px] text-zinc-400 leading-normal">
              Incoming caller speech will be translated into <strong className="text-white">{langMeta.native} ({langMeta.name})</strong> in real time.
            </p>
          </div>

          {/* 2. Display Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-medium text-zinc-200 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <User className="w-4 h-4 text-zinc-300" />
                <span>{isGuestJoin ? 'Your Name (Guest Participant)' : 'Participant Display Name'}</span>
              </span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Required</span>
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => onUserNameChange(e.target.value)}
              placeholder="e.g. Operator Sarah"
              className="w-full h-11 bg-zinc-950 border border-white/20 focus:border-white rounded-xl px-4 text-sm text-white placeholder-zinc-500 focus:outline-none font-medium transition-colors"
              required
            />
          </div>

          {/* 3. Audio Hardware Check: Speaker Test & Microphone Level */}
          <div className="rounded-xl bg-zinc-950 border border-white/20 p-3.5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-white shrink-0" />
                  <span>Audio Output Verification</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Verify loudspeaker playback & system sound before dispatch
                </p>
              </div>

              <button
                type="button"
                onClick={handleTestSound}
                className={`h-9 px-3.5 rounded-xl text-xs font-medium w-full sm:w-auto shrink-0 transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                  testingSound
                    ? 'bg-white text-black border-white animate-pulse'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-white/20'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5 shrink-0" />
                <span>{testingSound ? 'Playing Tone...' : 'Test Speaker'}</span>
              </button>
            </div>

            {/* Mic Level Waveform Bar */}
            <div className="pt-2 border-t border-white/10 flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 shrink-0">
                <Mic className="w-3.5 h-3.5 text-white" />
                <span>Mic Input Level:</span>
              </div>
              <div className="flex-1 h-2 bg-black rounded-full overflow-hidden border border-white/20">
                <div 
                  className="h-full bg-white transition-all duration-100 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(8, audioLevel * 100))}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                {audioLevel > 0.05 ? 'Signal Active' : 'Ready'}
              </span>
            </div>
          </div>

          {/* 4. Join CTA Button */}
          <button
            type="submit"
            className="w-full h-12 px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <PhoneCall className="w-4 h-4 shrink-0" />
            <span>{isGuestJoin ? 'Enter Live Call as Guest' : 'Enter Secure Call Studio'}</span>
            <ArrowRight className="w-4 h-4 ml-1 shrink-0" />
          </button>
        </form>

        {/* Security & Telemetry Footer */}
        <div className="border-t border-white/10 pt-3.5 flex flex-wrap items-center justify-between text-[11px] text-zinc-400 gap-2 font-mono">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
            End-to-End Encrypted
          </span>
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
            Zero-Latency WebRTC
          </span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
            Neural AI Translation
          </span>
        </div>
      </div>
    </div>
  );
}
