import React from 'react';

/**
 * VoiceBridge Enterprise Vector Logo
 * Features dual acoustic poles connected by a resonant bridge wave.
 */
export default function VoiceBridgeLogo({ size = 32, showText = true, className = '' }) {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* SVG Icon */}
      <div 
        className="relative flex items-center justify-center rounded-xl p-2 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-lg shadow-cyan-950/20 group hover:border-cyan-500/40 transition-all duration-300"
        style={{ width: size + 16, height: size + 16 }}
      >
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full transform group-hover:scale-105 transition-transform duration-300"
        >
          <defs>
            <linearGradient id="vb-bridge-grad" x1="4" y1="24" x2="44" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#06B6D4" />
              <stop offset="50%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#A855F7" />
            </linearGradient>
            <linearGradient id="vb-glow-cyan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22D3EE" />
              <stop offset="100%" stopColor="#0891B2" />
            </linearGradient>
            <linearGradient id="vb-glow-purple" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C084FC" />
              <stop offset="100%" stopColor="#7E22CE" />
            </linearGradient>
          </defs>

          {/* Background Ambient Glow */}
          <circle cx="12" cy="24" r="8" fill="#06B6D4" fillOpacity="0.15" />
          <circle cx="36" cy="24" r="8" fill="#A855F7" fillOpacity="0.15" />

          {/* Left Sound Wave Source (Cyan) */}
          <rect x="6" y="18" width="3" height="12" rx="1.5" fill="url(#vb-glow-cyan)" />
          <rect x="11" y="12" width="3.5" height="24" rx="1.75" fill="url(#vb-glow-cyan)" />

          {/* The Connecting Resonance Bridge (Dynamic Sound Arc) */}
          <path
            d="M 14 24 C 18 14, 30 14, 34 24 C 30 34, 18 34, 14 24 Z"
            fill="none"
            stroke="url(#vb-bridge-grad)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Bridge Sound Pulse Center */}
          <circle cx="24" cy="24" r="2.5" fill="#FFFFFF" />
          <circle cx="24" cy="24" r="4.5" stroke="#6366F1" strokeWidth="1.2" strokeDasharray="2 2" />

          {/* Right Sound Wave Target (Purple) */}
          <rect x="33.5" y="12" width="3.5" height="24" rx="1.75" fill="url(#vb-glow-purple)" />
          <rect x="39" y="18" width="3" height="12" rx="1.5" fill="url(#vb-glow-purple)" />
        </svg>
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black tracking-tight text-white font-sans">
              Voice<span className="bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">Bridge</span>
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Pro
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium tracking-wide">
            Real-Time Cross-Language Audio
          </span>
        </div>
      )}
    </div>
  );
}
