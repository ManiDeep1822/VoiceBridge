import React from 'react';

/**
 * VoiceBridge Clean Minimalist Vector Logo
 * Modeled after premium audio & communication tools.
 */
export default function VoiceBridgeLogo({ size = 26, showText = true, className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Icon Glyph */}
      <div 
        className="flex items-center justify-center rounded-xl bg-gradient-to-b from-zinc-700 to-zinc-900 border border-white/10 shadow-sm"
        style={{ width: size + 10, height: size + 10 }}
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5 text-emerald-400"
        >
          {/* Subtle Sound Arc Bridge */}
          <path
            d="M 6 16 C 6 10, 11 7, 16 7 C 21 7, 26 10, 26 16"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Acoustic Wave Bars */}
          <line x1="10" y1="13" x2="10" y2="19" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
          <line x1="16" y1="10" x2="16" y2="22" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="22" y1="13" x2="22" y2="19" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
          {/* Base Connection Line */}
          <path
            d="M 8 23 C 12 25, 20 25, 24 23"
            stroke="#64748B"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Clean Typography */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="text-base font-bold tracking-tight text-white font-sans">
              VoiceBridge
            </span>
            <span className="text-[10px] font-medium tracking-wide text-zinc-400 border border-zinc-700/60 rounded px-1.5 py-0.5 bg-zinc-800/60">
              Live
            </span>
          </div>
          <span className="text-[11px] text-zinc-400 tracking-normal mt-0.5">
            Cross-Language Voice Calls
          </span>
        </div>
      )}
    </div>
  );
}
