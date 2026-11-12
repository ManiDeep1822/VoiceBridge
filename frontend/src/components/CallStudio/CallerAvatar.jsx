import React from 'react';

/**
 * Clean, human-crafted SVG portraits for Call Studio callers.
 * Zero AI emojis, zero neon artifacts. Professional SVG vector avatars.
 */
export function CallerAvatar({ isLocal = true, isSpeaking = false, size = 'default' }) {
  const sizeClasses = size === 'sm' 
    ? 'w-10 h-10 sm:w-12 sm:h-12' 
    : size === 'md' 
      ? 'w-12 h-12 sm:w-16 sm:h-16' 
      : 'w-14 h-14 xs:w-16 xs:h-16 sm:w-20 sm:h-20 md:w-24 md:h-24';

  return (
    <div className={`relative ${sizeClasses} rounded-full flex items-center justify-center shrink-0`}>
      {/* Dynamic Sound Ripple Ring (Active when speaking) */}
      {isSpeaking && (
        <>
          <span className={`absolute inset-0 rounded-full animate-ping opacity-35 ${
            isLocal ? 'bg-blue-500' : 'bg-emerald-500'
          }`} />
          <span className={`absolute -inset-1 rounded-full border-2 ${
            isLocal ? 'border-blue-400 glow-blue' : 'border-emerald-400 glow-emerald'
          } animate-pulse`} />
        </>
      )}

      {/* Clean Human Vector Illustration SVG */}
      <div className={`w-full h-full rounded-full overflow-hidden border-2 shadow-lg flex items-center justify-center ${
        isLocal 
          ? 'bg-gradient-to-b from-slate-700 to-slate-900 border-blue-500/60' 
          : 'bg-gradient-to-b from-slate-800 to-slate-950 border-emerald-500/60'
      }`}>
        {isLocal ? (
          // Human Portrait: Caller 1 (You - Clean business/casual professional SVG)
          <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="50" fill="#1E293B" />
            {/* Background Accent */}
            <circle cx="50" cy="40" r="28" fill="#334155" />
            {/* Hair */}
            <path d="M28 36C28 22 36 14 50 14C64 14 72 22 72 36C72 40 70 44 70 44L68 34C68 34 60 22 50 22C40 22 32 34 32 34L30 44C30 44 28 40 28 36Z" fill="#0F172A" />
            {/* Face */}
            <ellipse cx="50" cy="44" rx="18" ry="21" fill="#F8D7BE" />
            {/* Hair Front */}
            <path d="M32 30C38 23 48 22 68 28C64 24 57 20 49 20C40 20 34 25 32 30Z" fill="#0F172A" />
            {/* Eyes */}
            <ellipse cx="43" cy="42" rx="2.2" ry="2.8" fill="#1E293B" />
            <ellipse cx="57" cy="42" rx="2.2" ry="2.8" fill="#1E293B" />
            {/* Friendly Smile */}
            <path d="M44 54C47 57 53 57 56 54" stroke="#9A3412" strokeWidth="2" strokeLinecap="round" />
            {/* Shoulders / Shirt */}
            <path d="M22 88C22 72 34 65 50 65C66 65 78 72 78 88V100H22V88Z" fill="#2563EB" />
            {/* Shirt Collar */}
            <path d="M44 65L50 74L56 65H44Z" fill="#FFFFFF" />
          </svg>
        ) : (
          // Human Portrait: Caller 2 (Remote Peer - Clean realistic SVG)
          <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="50" fill="#0F172A" />
            {/* Background Accent */}
            <circle cx="50" cy="40" r="28" fill="#1E293B" />
            {/* Hair */}
            <path d="M26 44C26 24 35 15 50 15C65 15 74 24 74 44C74 54 70 60 70 60C64 45 60 40 50 40C40 40 36 45 30 60C30 60 26 54 26 44Z" fill="#334155" />
            {/* Face */}
            <ellipse cx="50" cy="45" rx="17" ry="20" fill="#E2B193" />
            {/* Eyes */}
            <ellipse cx="43" cy="43" rx="2.2" ry="2.8" fill="#0F172A" />
            <ellipse cx="57" cy="43" rx="2.2" ry="2.8" fill="#0F172A" />
            {/* Mouth */}
            <path d="M45 54C48 57 52 57 55 54" stroke="#7C2D12" strokeWidth="2" strokeLinecap="round" />
            {/* Shoulders / Shirt */}
            <path d="M20 90C20 74 32 66 50 66C68 66 80 74 80 90V100H20V90Z" fill="#059669" />
            {/* Shirt Collar */}
            <path d="M43 66L50 75L57 66H43Z" fill="#F8FAFC" />
          </svg>
        )}
      </div>
    </div>
  );
}
