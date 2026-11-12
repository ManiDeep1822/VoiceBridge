import React, { useState } from 'react';
import { PhoneCall, Volume2, Globe, User, ArrowRight, CheckCircle2, ChevronDown, RefreshCw, Edit3, Check } from 'lucide-react';
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

  const langMeta = getLanguageMeta(selectedLanguage);
  const loc = getLocaleStrings(selectedLanguage);

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
    <div className="flex-1 flex items-center justify-center p-3 sm:p-6 bg-[#07090C] relative overflow-y-auto select-none font-sans w-full max-w-full box-border">
      <div className="w-full max-w-lg bg-[#0E131F]/95 backdrop-blur-2xl border border-slate-800/90 rounded-2xl p-4 sm:p-8 shadow-2xl space-y-5 sm:space-y-6 box-border">
        {/* Header */}
        <div className="border-b border-slate-800/80 pb-4 sm:pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 glow-emerald" />
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
                {isGuestJoin ? 'Guest Call Invitation' : 'Enterprise Voice Bridge'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              {isGuestJoin ? 'Join Live Call' : loc.joinCall}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setShowRoomInput(prev => !prev)}
              className="h-8 px-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors"
              title="Click to edit Room ID"
            >
              <span className="text-slate-400 text-[11px]">Room:</span>
              <span className="font-bold text-white text-xs tracking-wide">{roomId}</span>
              <Edit3 className="w-3 h-3 text-slate-400" />
            </button>

            {!isGuestJoin && (
              <button
                type="button"
                onClick={handleGenerateRoom}
                title="Generate new room ID"
                className="h-8 px-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs">New</span>
              </button>
            )}
          </div>
        </div>

        {/* Room configuration banner */}
        {showRoomInput && (
          <form onSubmit={handleSaveCustomRoom} className="p-3 bg-slate-900/90 rounded-xl border border-slate-700/80 flex gap-2 animate-fadeIn">
            <input
              type="text"
              value={customRoom}
              onChange={(e) => setCustomRoom(e.target.value.toUpperCase())}
              placeholder="Enter Room Code (e.g. ROOM-55)"
              className="flex-1 h-9 px-3 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white uppercase focus:outline-none focus:border-blue-500 font-medium"
            />
            <button type="submit" className="btn-primary h-9 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>Apply</span>
            </button>
          </form>
        )}

        {/* Form Controls */}
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {/* 1. Language Selector */}
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-semibold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" />
                <span>{loc.languageLabel}</span>
              </span>
              <span className="text-[11px] font-bold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                {langMeta.native}
              </span>
            </label>

            <div className="relative">
              <select
                value={selectedLanguage}
                onChange={(e) => onLanguageChange(e.target.value)}
                className="w-full h-11 sm:h-12 bg-slate-800/90 border border-slate-700/80 hover:border-slate-600 focus:border-blue-500 rounded-xl px-4 text-sm sm:text-base text-white font-medium focus:outline-none cursor-pointer appearance-none transition-colors"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-slate-900 text-white">
                    {l.native} ({l.name})
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-3.5 sm:top-4 text-slate-400 pointer-events-none flex items-center">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-normal">
              When the other caller speaks, you will hear their voice translated into <strong className="text-slate-200">{langMeta.native} ({langMeta.name})</strong>.
            </p>
          </div>

          {/* 2. Display Name Input */}
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-semibold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-300" />
                <span>{isGuestJoin ? 'Your Name (Guest)' : loc.nameLabel}</span>
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Required</span>
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => onUserNameChange(e.target.value)}
              placeholder="Enter your name"
              className="w-full h-11 sm:h-12 bg-slate-800/90 border border-slate-700/80 focus:border-blue-500 rounded-xl px-4 text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none font-medium transition-colors"
              required
            />
          </div>

          {/* 3. Speaker Test Audio Check */}
          <div className="rounded-xl bg-slate-800/60 border border-slate-700/80 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{loc.testSound}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Verify speaker playback and hardware output before entering
              </p>
            </div>

            <button
              type="button"
              onClick={handleTestSound}
              className={`h-9 sm:h-10 px-4 rounded-xl text-xs sm:text-sm font-medium w-full sm:w-auto shrink-0 transition-all flex items-center justify-center gap-1.5 border ${
                testingSound
                  ? 'bg-emerald-500/20 border-emerald-500/80 text-emerald-300 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{testingSound ? 'Playing Tone...' : 'Test Speaker'}</span>
            </button>
          </div>

          {/* 4. Primary Join Action Button */}
          <button
            type="submit"
            className="w-full h-11 sm:h-12 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition-all active:scale-[0.99] border border-emerald-500/40"
          >
            <PhoneCall className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span>{loc.joinCall}</span>
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1 shrink-0" />
          </button>
        </form>

        {/* Feature Highlights Footer */}
        <div className="border-t border-slate-800/80 pt-4 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            End-to-End Encrypted
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            Low-Bandwidth WebRTC
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            Instant Translation
          </span>
        </div>
      </div>
    </div>
  );
}
