import React from 'react';

/**
 * Apple FaceTime Minimalist Pure Monochrome CallerAvatar.
 * Concentric monochrome acoustic soundwave ripple rings radiating during speech/TTS.
 * High-contrast minimalist badges for participant name and language.
 */
export function CallerAvatar({
  isLocal = true,
  isSpeaking = false,
  size = 'default',
  name = '',
  participantName = '',
  language = '',
  showBadges = false
}) {
  const displayName = participantName || name;

  const sizeClasses = size === 'sm'
    ? 'w-12 h-12 sm:w-14 sm:h-14'
    : size === 'md'
      ? 'w-16 h-16 sm:w-20 sm:h-20'
      : size === 'hero'
        ? 'w-28 h-28 xs:w-32 xs:h-32 sm:w-40 sm:h-40 md:w-48 md:h-48'
        : 'w-20 h-20 xs:w-24 xs:h-24 sm:w-28 sm:h-28 md:w-32 md:h-32';

  return (
    <div className={`relative ${sizeClasses} rounded-full flex items-center justify-center shrink-0 select-none`}>
      {/* Concentric Monochrome Acoustic Soundwave Ripple Rings */}
      {isSpeaking && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
          {/* Ripple 1: Immediate high-contrast pulse */}
          <span className="absolute -inset-2.5 rounded-full border border-white/40 animate-ping opacity-40 duration-1000" />
          {/* Ripple 2: Concentric mid wave */}
          <span className="absolute -inset-5 rounded-full border border-white/25 animate-pulse duration-700" />
          {/* Ripple 3: Distant acoustic expansion wave */}
          <span className="absolute -inset-8 rounded-full border border-white/15 animate-ping opacity-25 duration-1500" />
          {/* Ripple 4: Outer ambient sound perimeter */}
          <span className="absolute -inset-11 rounded-full border border-white/10 opacity-20 animate-pulse duration-1000" />
        </div>
      )}

      {/* Pure Monochrome Avatar Container */}
      <div
        className={`w-full h-full rounded-full overflow-hidden border transition-all duration-300 flex items-center justify-center bg-black relative ${
          isSpeaking
            ? 'border-white ring-2 ring-white/30 shadow-[0_0_35px_rgba(255,255,255,0.2)] scale-[1.02]'
            : 'border-white/20 shadow-2xl hover:border-white/40'
        }`}
      >
        {isLocal ? (
          /* Pure Monochrome Vector Portrait: Local Caller */
          <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="50" fill="#09090B" />
            {/* Halo Backdrop */}
            <circle cx="50" cy="42" r="30" fill="#18181B" />
            {/* Hair Back */}
            <path d="M28 36C28 22 36 14 50 14C64 14 72 22 72 36C72 40 70 44 70 44L68 34C68 34 60 22 50 22C40 22 32 34 32 34L30 44C30 44 28 40 28 36Z" fill="#27272A" />
            {/* Face */}
            <ellipse cx="50" cy="44" rx="18" ry="21" fill="#E4E4E7" />
            {/* Hair Front */}
            <path d="M32 30C38 23 48 22 68 28C64 24 57 20 49 20C40 20 34 25 32 30Z" fill="#18181B" />
            {/* Eyes */}
            <ellipse cx="43" cy="42" rx="2.2" ry="2.8" fill="#09090B" />
            <ellipse cx="57" cy="42" rx="2.2" ry="2.8" fill="#09090B" />
            {/* Smile */}
            <path d="M44 54C47 57 53 57 56 54" stroke="#27272A" strokeWidth="2" strokeLinecap="round" />
            {/* Shoulders / Minimalist Monochrome Jacket */}
            <path d="M22 88C22 72 34 65 50 65C66 65 78 72 78 88V100H22V88Z" fill="#18181B" />
            {/* High-Contrast White Collar */}
            <path d="M43 65L50 75L57 65H43Z" fill="#FFFFFF" />
            {/* Lapel Accents */}
            <path d="M36 67L44 80" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
            <path d="M64 67L56 80" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          </svg>
        ) : (
          /* Pure Monochrome Vector Portrait: Remote Peer Caller */
          <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="50" fill="#09090B" />
            {/* Halo Backdrop */}
            <circle cx="50" cy="42" r="30" fill="#18181B" />
            {/* Hair Back */}
            <path d="M26 44C26 24 35 15 50 15C65 15 74 24 74 44C74 54 70 60 70 60C64 45 60 40 50 40C40 40 36 45 30 60C30 60 26 54 26 44Z" fill="#27272A" />
            {/* Face */}
            <ellipse cx="50" cy="45" rx="17" ry="20" fill="#D4D4D8" />
            {/* Eyes */}
            <ellipse cx="43" cy="43" rx="2.2" ry="2.8" fill="#09090B" />
            <ellipse cx="57" cy="43" rx="2.2" ry="2.8" fill="#09090B" />
            {/* Mouth */}
            <path d="M45 54C48 57 52 57 55 54" stroke="#27272A" strokeWidth="2" strokeLinecap="round" />
            {/* Shoulders / Minimalist Monochrome Coat */}
            <path d="M20 90C20 74 32 66 50 66C68 66 80 74 80 90V100H20V90Z" fill="#18181B" />
            {/* High-Contrast White Collar */}
            <path d="M43 66L50 75L57 66H43Z" fill="#FFFFFF" />
            {/* Clean Outer Stitch Line */}
            <path d="M34 68L42 82" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
            <path d="M66 68L58 82" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          </svg>
        )}
      </div>

      {/* High-Contrast Minimalist Participant Badge */}
      {(showBadges || displayName || language) && (displayName || language) && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/90 border border-white/25 text-white backdrop-blur-2xl shadow-2xl z-10 whitespace-nowrap">
          {displayName && (
            <span className="text-[11px] font-bold text-white tracking-wide">
              {displayName}
            </span>
          )}
          {displayName && language && (
            <span className="w-1 h-1 rounded-full bg-white/40" />
          )}
          {language && (
            <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wider">
              {language}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
