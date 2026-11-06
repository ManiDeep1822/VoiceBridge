import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Mic, 
  Volume2, 
  ArrowRight, 
  Globe2, 
  ShieldCheck, 
  Zap, 
  Download,
  CheckCircle2,
  Lock,
  Smartphone,
  X,
  Share2,
  Plus
} from 'lucide-react';
import VoiceBridgeLogo from './VoiceBridgeLogo';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const SUPPORTED_LANGUAGES = [
  { code: 'te', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'en', name: 'English (India)', native: 'English', flag: '🌐' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', flag: '🇮🇳' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', flag: '🇮🇳' },
];

export default function Lobby({ onJoinRoom, defaultRoomId = '' }) {
  const [selectedLang, setSelectedLang] = useState(() => (defaultRoomId ? 'hi' : 'te'));
  const [voiceGender, setVoiceGender] = useState('female');
  const [roomIdInput, setRoomIdInput] = useState(defaultRoomId);
  const [micTested, setMicTested] = useState(false);
  const [isTestingMic, setIsTestingMic] = useState(false);

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

  const generateRoomId = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `call-${id}`;
  };

  const handleStartNewCall = () => {
    const newRoomId = generateRoomId();
    onJoinRoom({
      roomId: newRoomId,
      language: selectedLang,
      voiceGender,
      isCreator: true
    });
  };

  const handleJoinExisting = (e) => {
    e.preventDefault();
    if (!roomIdInput.trim()) return;
    
    let cleanId = roomIdInput.trim();
    if (cleanId.includes('#room=')) {
      cleanId = cleanId.split('#room=')[1];
    } else if (cleanId.includes('?room=')) {
      cleanId = cleanId.split('?room=')[1];
    } else if (cleanId.includes('/room/')) {
      cleanId = cleanId.split('/room/')[1];
    }

    onJoinRoom({
      roomId: cleanId,
      language: selectedLang,
      voiceGender,
      isCreator: false
    });
  };

  const testMicrophone = async () => {
    setIsTestingMic(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicTested(true);
    } catch (err) {
      alert("Microphone permission was not granted. Please allow microphone access in your browser address bar.");
    } finally {
      setIsTestingMic(false);
    }
  };

  return (
    <div className="dynamic-screen bg-[#0B0F19] justify-between p-3.5 sm:p-6 md:p-8 relative overflow-x-hidden safe-area-top safe-area-bottom">
      {/* Ambient background glows */}
      <div className="absolute top-[-15%] left-[-10%] w-[420px] sm:w-[600px] h-[420px] sm:h-[600px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[420px] sm:w-[600px] h-[420px] sm:h-[600px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Enterprise Navigation Bar */}
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between py-2 relative z-20">
        <VoiceBridgeLogo size={28} />

        <div className="flex items-center gap-2.5">
          {/* Telemetry Indicator */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel-subtle text-xs text-slate-300 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-slate-400">Enterprise Node:</span>
            <span className="text-emerald-400 font-semibold">Active (0ms)</span>
          </div>

          {/* Download / Install App Button */}
          {!isInstalled && isInstallable && (
            <button
              type="button"
              onClick={installApp}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold shadow-lg shadow-cyan-950/40 transition-all hover:scale-[1.02] cursor-pointer"
              title="Install VoiceBridge Web App on your device"
            >
              <Download className="w-4 h-4 text-cyan-400 animate-bounce" />
              <span className="hidden xs:inline">Install Web App</span>
              <span className="xs:hidden">Install</span>
            </button>
          )}

          {isInstalled && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>App Installed</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Stage */}
      <main className="max-w-5xl mx-auto w-full my-auto py-4 sm:py-6 relative z-10">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-cyan-500/30 text-cyan-300 text-xs font-semibold mb-3.5 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Enterprise Neural Translation Architecture</span>
          </div>

          <h1 className="hero-heading text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight mb-3">
            Speak in your language. <br />
            <span className="bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              They hear theirs.
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            Zero subscription costs. Seamless live voice calls with realistic Microsoft neural voices across Telugu, Hindi, and Indian regional languages.
          </p>
        </div>

        {/* Configuration Pods */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          {/* Left Column: Language & Voice Controls */}
          <div className="lg:col-span-7 glass-panel rounded-2xl p-4 sm:p-6 space-y-5 border border-slate-800/80 shadow-2xl">
            {/* Spoken Language Picker */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-200">
                  <Globe2 className="w-4 h-4 text-cyan-400" />
                  <span>I will speak in (Your Spoken Language):</span>
                </label>
                <span className="text-[10px] text-cyan-400 font-mono uppercase bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                  Auto VAD
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const isSelected = selectedLang === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setSelectedLang(lang.code)}
                      className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-500/80 text-white shadow-md shadow-cyan-950/50 ring-1 ring-cyan-500/60'
                          : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">{lang.name}</span>
                        <span className="text-sm">{lang.flag}</span>
                      </div>
                      <div className="text-sm font-bold text-white mt-0.5 tracking-wide">{lang.native}</div>
                      {isSelected && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 to-indigo-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* AI Neural Voice Persona */}
            <div>
              <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-200 mb-2.5">
                <Volume2 className="w-4 h-4 text-purple-400" />
                <span>AI Voice Persona (When they hear your translation):</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setVoiceGender('female')}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    voiceGender === 'female'
                      ? 'bg-purple-950/40 border-purple-500/80 text-white ring-1 ring-purple-500/60 shadow-lg shadow-purple-950/40'
                      : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-left">
                    <div className="text-xs sm:text-sm font-bold text-white">Female Natural Voice</div>
                    <div className="text-[10px] text-slate-400">Shruti (TE) / Swara (HI)</div>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded bg-purple-900/40 text-purple-300 font-mono">
                    HD Edge
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setVoiceGender('male')}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    voiceGender === 'male'
                      ? 'bg-purple-950/40 border-purple-500/80 text-white ring-1 ring-purple-500/60 shadow-lg shadow-purple-950/40'
                      : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-left">
                    <div className="text-xs sm:text-sm font-bold text-white">Male Natural Voice</div>
                    <div className="text-[10px] text-slate-400">Mohan (TE) / Madhur (HI)</div>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded bg-purple-900/40 text-purple-300 font-mono">
                    HD Edge
                  </span>
                </button>
              </div>
            </div>

            {/* Mic Diagnostic */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-slate-300" />
                <span>Microphone Readiness</span>
              </span>
              <button
                type="button"
                onClick={testMicrophone}
                disabled={isTestingMic || micTested}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  micTested
                    ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {isTestingMic ? 'Validating...' : micTested ? '✓ Mic Calibrated' : 'Test Microphone'}
              </button>
            </div>
          </div>

          {/* Right Column: Instant Call Actions */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-slate-800/80 shadow-2xl flex flex-col justify-between flex-1">
              {defaultRoomId ? (
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-semibold mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span>Direct Call Invitation</span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-white mb-1">
                    Room: <span className="text-cyan-400 font-mono">{defaultRoomId}</span>
                  </h2>
                  <p className="text-xs text-slate-400 mb-5">
                    Connect instantly with your partner. Your speech will be auto-translated into their language in real-time.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      onJoinRoom({
                        roomId: defaultRoomId,
                        language: selectedLang,
                        voiceGender,
                        isCreator: false,
                      })
                    }
                    className="w-full py-4 px-4 rounded-xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 hover:from-emerald-300 hover:to-blue-400 text-slate-950 font-black text-sm tracking-wide shadow-xl shadow-cyan-500/25 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer group"
                  >
                    <span>Connect to Call Now</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setRoomIdInput('');
                        handleStartNewCall();
                      }}
                      className="text-xs text-slate-500 hover:text-slate-300 underline cursor-pointer"
                    >
                      Or start a fresh room instead
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-base sm:text-lg font-bold text-white">Instant Call Creation</h2>
                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                      Peer-to-Peer
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-5">
                    Creates a secure room link. Share it with your friend to begin continuous voice translation.
                  </p>

                  <button
                    type="button"
                    onClick={handleStartNewCall}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-500 hover:from-cyan-300 hover:to-purple-400 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 group cursor-pointer"
                  >
                    <span>Start a New Call</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              )}

              {!defaultRoomId && (
                <>
                  <div className="my-4 flex items-center gap-3">
                    <div className="h-px bg-slate-800 flex-1" />
                    <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">or join existing</span>
                    <div className="h-px bg-slate-800 flex-1" />
                  </div>

                  <form onSubmit={handleJoinExisting} className="space-y-2.5">
                    <input
                      type="text"
                      placeholder="Enter Call ID or Paste Link (e.g. call-xyz)"
                      value={roomIdInput}
                      onChange={(e) => setRoomIdInput(e.target.value)}
                      className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!roomIdInput.trim()}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-semibold text-xs tracking-wide border border-slate-700 transition-all cursor-pointer"
                    >
                      Join Existing Call
                    </button>
                  </form>
                </>
              )}
            </div>

            {/* Enterprise Trust Badges */}
            <div className="glass-panel rounded-xl p-3 sm:p-3.5 border border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ephemerally Encrypted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>Sub-Second TTS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                <span>Zero Cost Stack</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* iOS / Fallback PWA Install Guide Modal */}
      {showInstallGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-panel p-6 rounded-2xl border border-slate-700 max-w-sm w-full space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowInstallGuide(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <Smartphone className="w-7 h-7 text-cyan-400" />
              <div>
                <h3 className="text-base font-bold text-white">Install VoiceBridge App</h3>
                <p className="text-xs text-slate-400">One-click home screen access</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300">
              {isIOS ? (
                <>
                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="font-bold text-cyan-400">1.</span>
                    <span>Tap the Safari <strong>Share button</strong> <Share2 className="w-3.5 h-3.5 inline mx-1" /> at the bottom of the screen.</span>
                  </div>
                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="font-bold text-cyan-400">2.</span>
                    <span>Scroll down and select <strong>"Add to Home Screen"</strong> <Plus className="w-3.5 h-3.5 inline mx-1" />.</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="font-bold text-cyan-400">1.</span>
                    <span>Open browser menu (three dots <strong>⋮</strong> in top-right).</span>
                  </div>
                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="font-bold text-cyan-400">2.</span>
                    <span>Select <strong>"Install VoiceBridge"</strong> or <strong>"Add to Home screen"</strong>.</span>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowInstallGuide(false)}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs tracking-wider transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Enterprise Footer */}
      <footer className="max-w-6xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between py-2 text-[11px] text-slate-500 relative z-10 gap-2">
        <div>VoiceBridge Enterprise • Real-Time Cross-Language Audio Translation</div>
        <div className="flex items-center gap-3">
          <span>Microsoft Edge Neural Audio</span>
          <span>•</span>
          <span>Web Audio Gain Booster</span>
        </div>
      </footer>
    </div>
  );
}
