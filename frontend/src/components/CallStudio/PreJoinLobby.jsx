import React, { useState } from 'react';
import { PhoneCall, Volume2, Globe, User, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { SUPPORTED_LANGUAGES, getLanguageMeta, getLocaleStrings } from '../../utils/languages.js';

export function PreJoinLobby({
  roomId = 'VOX-ROOM-101',
  userName = 'Operator',
  onUserNameChange,
  selectedLanguage = 'en',
  onLanguageChange,
  onJoinMeeting,
  audioLevel = 0,
  onTestAudio
}) {
  const [testingSound, setTestingSound] = useState(false);
  const langMeta = getLanguageMeta(selectedLanguage);
  const loc = getLocaleStrings(selectedLanguage);

  const handleTestSound = () => {
    setTestingSound(true);
    if (onTestAudio) onTestAudio();
    setTimeout(() => setTestingSound(false), 2000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!userName.trim()) return;
    onJoinMeeting();
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-[#0B0F17] relative overflow-y-auto select-none font-sans">
      <div className="w-full max-w-lg bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="border-b border-slate-800 pb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981]" />
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
                Universal Live Voice
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {loc.joinCall}
            </h1>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200">
            <span className="text-slate-400 mr-1.5">Room:</span>
            <span className="font-bold text-white">{roomId}</span>
          </div>
        </div>

        {/* Form Controls */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Language Selector */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" />
                <span>{loc.languageLabel}</span>
              </span>
              <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                {langMeta.native}
              </span>
            </label>

            <div className="relative">
              <select
                value={selectedLanguage}
                onChange={(e) => onLanguageChange(e.target.value)}
                className="w-full h-12 bg-slate-800 border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-xl px-4 text-base text-white font-medium focus:outline-none cursor-pointer appearance-none transition-colors"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-slate-900 text-white">
                    {l.native} ({l.name})
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-4 text-xs text-slate-400 pointer-events-none">
                ▼
              </div>
            </div>
            <p className="text-xs text-slate-400">
              When the other person speaks, you will hear their voice translated into <strong>{langMeta.native} ({langMeta.name})</strong>.
            </p>
          </div>

          {/* 2. Display Name Input */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-300" />
                <span>{loc.nameLabel}</span>
              </span>
              <span className="text-[11px] text-slate-400">Required</span>
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => onUserNameChange(e.target.value)}
              placeholder="Enter your name"
              className="w-full h-12 bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-xl px-4 text-base text-white placeholder-slate-500 focus:outline-none font-medium transition-colors"
              required
            />
          </div>

          {/* 3. Speaker Test Audio Check */}
          <div className="rounded-xl bg-slate-800/60 border border-slate-700/80 p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>{loc.testSound}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Check speaker to verify translated voice playback
              </p>
            </div>

            <button
              type="button"
              onClick={handleTestSound}
              className="btn-secondary h-11 px-5 py-2.5 rounded-xl text-sm font-medium shrink-0"
            >
              {testingSound ? 'Testing...' : 'Test Speaker'}
            </button>
          </div>

          {/* 4. Primary Join Action Button */}
          <button
            type="submit"
            className="btn-success w-full h-12 px-5 py-2.5 rounded-xl font-bold text-base shadow-lg shadow-emerald-950/40"
          >
            <PhoneCall className="w-5 h-5" />
            <span>{loc.joinCall}</span>
            <ArrowRight className="w-5 h-5 ml-1" />
          </button>
        </form>

        {/* Feature Highlights Footer */}
        <div className="border-t border-slate-800 pt-4 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            End-to-End Encrypted
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
            Low-Bandwidth Optimized
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
            Instant Translation
          </span>
        </div>
      </div>
    </div>
  );
}
