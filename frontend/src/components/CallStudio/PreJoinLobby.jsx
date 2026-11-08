import React, { useState } from 'react';
import { PhoneCall, Volume2, Globe, User, ArrowRight, ShieldCheck, Check } from 'lucide-react';
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
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-[#0A0A0A] relative overflow-hidden select-none font-sans blueprint-grid">
      <div className="w-full max-w-xl bg-[#111111] border border-[#262626] p-6 sm:p-8 z-10 space-y-6 shadow-2xl relative">
        {/* Header with Dual Native + English Language Title */}
        <div className="border-b border-[#262626] pb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 bg-[#39FF14]" />
              <span className="text-xs font-mono text-[#A1A1AA] uppercase tracking-wider">
                VOICEBRIDGE • REAL-TIME CALL TRANSLATION
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {loc.joinCall} <span className="text-[#A1A1AA] text-lg font-normal">/ Join Call</span>
            </h1>
          </div>

          <div className="border border-[#333333] bg-[#161616] px-3 py-1 text-xs font-mono text-white">
            <span className="text-[#71717A]">ROOM:</span> <span className="font-bold">{roomId}</span>
          </div>
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Language Selector (Prominent Native Scripts) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-[#39FF14]" />
                <span>{loc.languageLabel}</span>
              </span>
              <span className="text-xs font-mono font-bold text-[#39FF14]">
                {langMeta.native}
              </span>
            </label>
            <div className="relative">
              <select
                value={selectedLanguage}
                onChange={(e) => onLanguageChange(e.target.value)}
                className="w-full bg-[#161616] border-2 border-[#333333] hover:border-white focus:border-[#39FF14] p-3 text-base sm:text-lg text-white font-medium focus:outline-none cursor-pointer appearance-none"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-[#161616] text-white py-1">
                    {l.native} — {l.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-4 text-xs font-mono text-[#A1A1AA] pointer-events-none">
                ▼
              </div>
            </div>
            <p className="text-xs text-[#A1A1AA] mt-1">
              When the other person speaks in their language, you will hear it translated aloud in <strong>{langMeta.native} ({langMeta.name})</strong>.
            </p>
          </div>

          {/* 2. Display Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-white" />
                <span>{loc.nameLabel}</span>
              </span>
              <span className="text-[10px] font-mono text-[#71717A]">REQUIRED</span>
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => onUserNameChange(e.target.value)}
              placeholder="e.g. Ramesh Kumar / Rajesh"
              className="w-full bg-[#161616] border-2 border-[#333333] focus:border-white p-3 text-base text-white placeholder-[#52525B] focus:outline-none font-medium"
              required
            />
          </div>

          {/* 3. Speaker Check (Simple, Clear Audio Test) */}
          <div className="border border-[#262626] bg-[#0E0E0E] p-3.5 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-[#39FF14]" />
                <span>{loc.testSound} / Check Loudspeaker</span>
              </div>
              <div className="text-xs text-[#71717A] mt-0.5">
                Press button to ensure you can hear the translated voice
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestSound}
              className="border border-[#404040] hover:border-white bg-[#1A1A1A] hover:bg-white hover:text-black text-white px-3.5 py-2 text-xs font-bold uppercase transition-colors shrink-0"
            >
              {testingSound ? 'Playing...' : 'Test Sound'}
            </button>
          </div>

          {/* 4. Giant Friendly Join Button */}
          <button
            type="submit"
            className="w-full py-4 border-2 border-[#39FF14] bg-[#39FF14] hover:bg-[#32e012] active:translate-y-[1px] text-black font-extrabold text-base uppercase tracking-wider flex items-center justify-center gap-3 transition-colors cursor-pointer shadow-lg"
          >
            <PhoneCall className="w-5 h-5 stroke-[2.5]" />
            <span>{loc.joinCall} / Join Call Now</span>
            <ArrowRight className="w-5 h-5 stroke-[2.5]" />
          </button>
        </form>

        {/* Security & Support Note */}
        <div className="border-t border-[#262626] pt-3 flex flex-wrap items-center justify-between text-xs font-mono text-[#71717A]">
          <span>END-TO-END ENCRYPTED</span>
          <span>WORKS ON 2G/3G/4G/5G</span>
          <span>100% FREE CALL TRANSLATION</span>
        </div>
      </div>
    </div>
  );
}
