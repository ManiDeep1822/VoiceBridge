import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  ArrowRight, 
  Globe, 
  Volume2, 
  Download,
  CheckCircle2,
  Smartphone,
  X,
  Share2,
  Plus,
  Radio,
  UserCheck
} from 'lucide-react';
import VoiceBridgeLogo from './VoiceBridgeLogo';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const SUPPORTED_LANGUAGES = [
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'en', name: 'English (India)', native: 'English' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
];

export default function Lobby({ onJoinRoom, defaultRoomId = '', onClearDefaultRoom }) {
  const [selectedLang, setSelectedLang] = useState(() => (defaultRoomId ? 'hi' : 'te'));
  const [voiceGender, setVoiceGender] = useState('female');
  const [roomIdInput, setRoomIdInput] = useState(defaultRoomId);
  const [micActive, setMicActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [micTestError, setMicTestError] = useState('');

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);

  const {
    isInstallable,
    isInstalled,
    isIOS,
    showInstallGuide,
    setShowInstallGuide,
    installApp
  } = usePWAInstall();

  useEffect(() => {
    if (defaultRoomId) {
      setRoomIdInput(defaultRoomId);
      setSelectedLang((prev) => (prev === 'te' ? 'hi' : prev));
    }
  }, [defaultRoomId]);

  // Clean up audio test on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const toggleMicTest = async () => {
    setMicTestError('');
    if (micActive) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      setMicActive(false);
      setAudioLevel(0);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      setMicActive(true);

      const updateLevel = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (err) {
      console.warn('[Lobby] Mic test permission denied:', err);
      setMicTestError("Microphone access was denied. Please allow microphone permissions in your browser.");
    }
  };

  // Helper to ensure mic permission is requested directly in user click gesture
  const warmUpMicPermission = async () => {
    // Release any active green room test microphone and audio graph first
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setMicActive(false);
    setAudioLevel(0);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
      }
    } catch (e) {
      console.warn('Microphone permission check on action:', e);
    }
  };

  const generateRoomId = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `call-${id}`;
  };

  const handleStartNewCall = async () => {
    await warmUpMicPermission();
    const newRoomId = generateRoomId();
    onJoinRoom({
      roomId: newRoomId,
      language: selectedLang,
      voiceGender,
      isCreator: true
    });
  };

  const handleJoinInvitedCall = async () => {
    await warmUpMicPermission();
    onJoinRoom({
      roomId: defaultRoomId,
      language: selectedLang,
      voiceGender,
      isCreator: false
    });
  };

  const handleJoinExisting = async (e) => {
    e.preventDefault();
    if (!roomIdInput.trim()) return;
    
    let cleanId = roomIdInput.trim();
    try {
      if (cleanId.includes('http://') || cleanId.includes('https://')) {
        const urlObj = new URL(cleanId);
        if (urlObj.hash && urlObj.hash.includes('room=')) {
          cleanId = urlObj.hash.split('room=')[1].split('&')[0];
        } else if (urlObj.searchParams.get('room')) {
          cleanId = urlObj.searchParams.get('room');
        } else {
          cleanId = urlObj.pathname.split('/').filter(Boolean).pop() || cleanId;
        }
      } else if (cleanId.includes('#room=')) {
        cleanId = cleanId.split('#room=')[1].split('&')[0];
      } else if (cleanId.includes('?room=')) {
        cleanId = cleanId.split('?room=')[1].split('&')[0];
      } else if (cleanId.includes('/room/')) {
        cleanId = cleanId.split('/room/')[1].split('&')[0];
      }
    } catch (err) {
      // Fallback if not a valid URL
    }

    cleanId = cleanId.replace(/[^a-zA-Z0-9_-]/g, '').trim();
    if (!cleanId) return;

    if (cleanId.length < 3 || cleanId.length > 32) {
      alert("Room ID must be between 3 and 32 characters (letters, numbers, dashes, underscores).");
      return;
    }

    await warmUpMicPermission();
    onJoinRoom({
      roomId: cleanId,
      language: selectedLang,
      voiceGender,
      isCreator: false
    });
  };

  const currentLangObj = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang) || SUPPORTED_LANGUAGES[0];

  return (
    <div className="dynamic-screen justify-between p-4 sm:p-6 md:p-8 safe-area-top safe-area-bottom">
      {/* Clean Header Bar */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between py-2 z-10">
        <VoiceBridgeLogo size={24} />

        <div className="flex items-center gap-3">
          {/* Operational status */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Ready for calls</span>
          </div>

          {/* Download App Button */}
          {!isInstalled && isInstallable && (
            <button
              type="button"
              onClick={installApp}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 border border-zinc-700 transition-all cursor-pointer"
              title="Install VoiceBridge Web App"
            >
              <Download className="w-3.5 h-3.5 text-zinc-300" />
              <span>Install App</span>
            </button>
          )}

          {isInstalled && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Installed</span>
            </div>
          )}
        </div>
      </header>

      {/* ========================================================================= */}
      {/* CASE 1: USER JOINED VIA INVITE LINK -> SHOW DEDICATED JOIN SCREEN ONLY   */}
      {/* ========================================================================= */}
      {defaultRoomId ? (
        <main className="max-w-md mx-auto w-full my-auto py-6 sm:py-10 z-10 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
            
            {/* Header / Room info */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Call Invitation</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Join Translation Call
              </h1>
              <p className="text-xs text-zinc-400">
                You've been invited to room <span className="font-mono text-zinc-200 font-semibold">{defaultRoomId}</span>
              </p>
            </div>

            {/* Language & Voice Preferences */}
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  I will speak in:
                </label>
                <div className="relative">
                  <select
                    value={selectedLang}
                    onChange={(e) => setSelectedLang(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-500 transition-all cursor-pointer appearance-none"
                  >
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name} — {l.native}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 text-xs">
                    ▾
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Translated Voice Persona:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVoiceGender('female')}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                      voiceGender === 'female'
                        ? 'bg-zinc-800 border-zinc-500 text-white font-semibold'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    Female (Natural)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoiceGender('male')}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                      voiceGender === 'male'
                        ? 'bg-zinc-800 border-zinc-500 text-white font-semibold'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    Male (Natural)
                  </button>
                </div>
              </div>

              {/* Interactive Microphone Test Preview */}
              <div className="p-3.5 rounded-2xl bg-zinc-850 border border-zinc-800/80 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-400" />
                    Microphone Check
                  </span>
                  <span className={`text-[11px] font-medium ${micActive ? 'text-emerald-400' : 'text-zinc-400'}`}>
                    {micActive ? (audioLevel > 15 ? 'Speech detected' : 'Mic ready') : 'Ready to test'}
                  </span>
                </div>

                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden border border-zinc-750">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: micActive ? `${audioLevel}%` : '0%' }}
                  />
                </div>

                <button
                  type="button"
                  onClick={toggleMicTest}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    micActive
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-600/50'
                      : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-300 border-zinc-700'
                  }`}
                >
                  {micActive ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5 text-zinc-400" />}
                  <span>{micActive ? 'Mic Active • Tap to finish' : 'Test Microphone'}</span>
                </button>

                {micTestError && (
                  <p className="text-[11px] text-rose-400 text-center">{micTestError}</p>
                )}
              </div>
            </div>

            {/* Primary Action Button: JOIN CALL NOW */}
            <div className="pt-2 space-y-3">
              <button
                type="button"
                onClick={handleJoinInvitedCall}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm tracking-wide shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>Join Call Now</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>

              {onClearDefaultRoom && (
                <button
                  type="button"
                  onClick={onClearDefaultRoom}
                  className="w-full text-center text-xs text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                >
                  Want to host a new call instead? Start fresh
                </button>
              )}
            </div>

          </div>
        </main>
      ) : (
        /* ========================================================================= */
        /* CASE 2: HOST / CREATOR VIEW -> START NEW CALL OR JOIN VIA CODE           */
        /* ========================================================================= */
        <main className="max-w-4xl mx-auto w-full my-auto py-6 sm:py-10 z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left Column: Audio Green Room / Mic Preview Tile */}
            <div className="lg:col-span-7 flex flex-col items-center">
              <div className="w-full aspect-[4/3] max-w-md bg-zinc-900 rounded-2xl border border-zinc-800 p-6 flex flex-col justify-between relative shadow-lg overflow-hidden">
                
                {/* Top Row in Preview */}
                <div className="flex items-center justify-between text-xs text-zinc-400 z-10">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Radio className="w-3.5 h-3.5 text-emerald-400" />
                    Audio Preview
                  </span>
                  <span className="text-[11px] bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700 font-mono">
                    {currentLangObj.name} ({currentLangObj.native})
                  </span>
                </div>

                {/* Center Audio Avatar & Equalizer */}
                <div className="flex flex-col items-center justify-center my-auto z-10">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    micActive && audioLevel > 10 
                      ? 'border-emerald-500 bg-emerald-950/20 shadow-md shadow-emerald-500/20' 
                      : 'border-zinc-700 bg-zinc-800'
                  }`}>
                    <span className="text-2xl font-bold text-zinc-200">YOU</span>
                  </div>

                  {/* Live Mic Meter Bar */}
                  <div className="w-32 h-1.5 bg-zinc-800 rounded-full mt-4 overflow-hidden border border-zinc-700/60">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-75"
                      style={{ width: micActive ? `${audioLevel}%` : '0%' }}
                    />
                  </div>
                  <span className="text-[11px] text-zinc-400 mt-1.5 font-medium">
                    {micActive 
                      ? audioLevel > 15 ? 'Speaking detected' : 'Microphone connected' 
                      : 'Click below to test microphone'}
                  </span>
                </div>

                {/* Bottom Preview Action */}
                <div className="flex flex-col items-center justify-center gap-2 z-10">
                  <button
                    type="button"
                    onClick={toggleMicTest}
                    className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                      micActive 
                        ? 'bg-emerald-600 text-white border-emerald-500' 
                        : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-300 border-zinc-700'
                    }`}
                  >
                    {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4 text-zinc-400" />}
                    <span>{micActive ? 'Mic Active (Testing)' : 'Test Microphone'}</span>
                  </button>
                  {micTestError && (
                    <p className="text-[11px] text-rose-400 text-center max-w-xs">{micTestError}</p>
                  )}
                </div>

                {/* Subtle background grid pattern */}
                <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none" />
              </div>

              <p className="text-xs text-zinc-400 mt-3 text-center">
                Your partner will hear your speech converted directly into their chosen language.
              </p>
            </div>

            {/* Right Column: Language Configuration & Call Entry */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
                  Start a Translation Call
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400">
                  Cross-language speech with human neural voices. No subscription or setup needed.
                </p>
              </div>

              {/* Language & Persona Controls */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Your Spoken Language
                  </label>
                  <div className="relative">
                    <select
                      value={selectedLang}
                      onChange={(e) => setSelectedLang(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-500 transition-all cursor-pointer appearance-none"
                    >
                      {SUPPORTED_LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.name} — {l.native}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 text-xs">
                      ▾
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Translated Voice Persona
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setVoiceGender('female')}
                      className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                        voiceGender === 'female'
                          ? 'bg-zinc-800 border-zinc-500 text-white font-semibold'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      Female (Natural)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVoiceGender('male')}
                      className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                        voiceGender === 'male'
                          ? 'bg-zinc-800 border-zinc-500 text-white font-semibold'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      Male (Natural)
                    </button>
                  </div>
                </div>
              </div>

              {/* Creator Launch Options */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleStartNewCall}
                  className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm tracking-wide shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Start Instant Call</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 my-2">
                  <div className="h-px bg-zinc-800 flex-1" />
                  <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">or</span>
                  <div className="h-px bg-zinc-800 flex-1" />
                </div>

                <form onSubmit={handleJoinExisting} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Paste room code (e.g. call-xyz)"
                    value={roomIdInput}
                    onChange={(e) => setRoomIdInput(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!roomIdInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 font-semibold text-xs border border-zinc-700 transition-all cursor-pointer shrink-0"
                  >
                    Join
                  </button>
                </form>
              </div>

            </div>
          </div>
        </main>
      )}

      {/* iOS / Fallback PWA Install Guide Modal */}
      {showInstallGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 max-w-sm w-full space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowInstallGuide(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <Smartphone className="w-6 h-6 text-blue-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Install VoiceBridge</h3>
                <p className="text-xs text-zinc-400">Add to Home Screen for one-click access</p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-zinc-300">
              {isIOS ? (
                <>
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-zinc-800 border border-zinc-700">
                    <span className="font-bold text-blue-400">1.</span>
                    <span>Tap the Safari <strong>Share button</strong> <Share2 className="w-3.5 h-3.5 inline mx-1" /> at the bottom.</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-zinc-800 border border-zinc-700">
                    <span className="font-bold text-blue-400">2.</span>
                    <span>Select <strong>"Add to Home Screen"</strong> <Plus className="w-3.5 h-3.5 inline mx-1" />.</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-zinc-800 border border-zinc-700">
                    <span className="font-bold text-blue-400">1.</span>
                    <span>Click the three dots <strong>⋮</strong> in browser menu.</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-zinc-800 border border-zinc-700">
                    <span className="font-bold text-blue-400">2.</span>
                    <span>Select <strong>"Install VoiceBridge"</strong>.</span>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowInstallGuide(false)}
              className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-white font-semibold text-xs transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Clean Studio Footer */}
      <footer className="max-w-5xl mx-auto w-full flex items-center justify-between py-2 text-[11px] text-zinc-400 z-10 border-t border-zinc-800/60">
        <div>VoiceBridge • Real-Time Voice Translation</div>
        <div className="flex items-center gap-2">
          <span>Microsoft Edge Neural Voices</span>
        </div>
      </footer>
    </div>
  );
}
