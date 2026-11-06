import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Mic, 
  Volume2, 
  ArrowRight, 
  Globe2, 
  ShieldCheck, 
  Zap, 
  Headphones, 
  Layers
} from 'lucide-react';

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
    
    // Clean room ID if user pasted full URL
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
      alert("Microphone permission denied. Please allow microphone access to talk in calls.");
    } finally {
      setIsTestingMic(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-cyan/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-brand-violet/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Navigation */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between py-2 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-cyan to-brand-blue flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Headphones className="w-5 h-5 text-dark-950 font-bold" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              VoiceBridge
            </h1>
            <p className="text-xs text-slate-400 font-medium">Real-Time Speech-to-Speech Calls</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-800 text-xs text-slate-300">
          <Zap className="w-3.5 h-3.5 text-brand-cyan animate-pulse" />
          <span>Telugu ⇄ Hindi Speech Translation</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full my-auto py-8 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-800/50 text-cyan-400 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Human-Like Neural Voice Replacement</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight mb-4">
            Speak in your language. <br />
            <span className="bg-gradient-to-r from-brand-cyan via-brand-blue to-brand-pink bg-clip-text text-transparent">
              They hear theirs.
            </span>
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto">
            Connect over an audio call with someone from another region. You speak Telugu, they hear natural Hindi — with zero robotic pitch and zero subscription costs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column: Preferences */}
          <div className="md:col-span-7 glass-panel rounded-2xl p-6 sm:p-7 space-y-6 border border-slate-800/80">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-2">
                <Globe2 className="w-4 h-4 text-brand-cyan" />
                I will speak in (Your Spoken Language):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const isSelected = selectedLang === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setSelectedLang(lang.code)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-500/80 text-white shadow-md shadow-cyan-950/50 ring-1 ring-cyan-500/50'
                          : 'bg-dark-900/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs text-slate-400">{lang.name}</div>
                      <div className="text-sm font-bold text-white mt-0.5">{lang.native}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-2">
                <Volume2 className="w-4 h-4 text-brand-pink" />
                AI Voice Persona (When they hear your translated speech):
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setVoiceGender('female')}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                    voiceGender === 'female'
                      ? 'bg-purple-950/40 border-purple-500/80 text-white ring-1 ring-purple-500/50'
                      : 'bg-dark-900/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="text-sm font-medium">Female Voice (Natural)</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-900/60 text-purple-300">Shruti / Swara</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceGender('male')}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                    voiceGender === 'male'
                      ? 'bg-purple-950/40 border-purple-500/80 text-white ring-1 ring-purple-500/50'
                      : 'bg-dark-900/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="text-sm font-medium">Male Voice (Natural)</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-900/60 text-purple-300">Mohan / Madhur</span>
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-slate-300" />
                Microphone Check
              </span>
              <button
                type="button"
                onClick={testMicrophone}
                disabled={isTestingMic || micTested}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  micTested
                    ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {isTestingMic ? 'Checking...' : micTested ? '✓ Mic Ready' : 'Test Microphone'}
              </button>
            </div>
          </div>

          {/* Right Column: Actions */}
          <div className="md:col-span-5 flex flex-col justify-between gap-5">
            <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 flex flex-col justify-between flex-1">
              {defaultRoomId ? (
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-semibold mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                    <span>Call Invite Detected</span>
                  </div>
                  <h3 className="text-xl font-extrabold text-white mb-1">
                    Join Room: <span className="text-cyan-400 font-mono">{defaultRoomId}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mb-6">
                    Select your spoken language on the left, then click below to connect with your partner.
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
                    className="w-full py-4 px-4 rounded-xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 hover:from-emerald-300 hover:to-blue-400 text-slate-950 font-black text-sm tracking-wide shadow-xl shadow-cyan-500/30 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer group"
                  >
                    <span>Connect to Call Now</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>

                  <div className="mt-4 pt-4 border-t border-slate-800/80 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setRoomIdInput('');
                        handleStartNewCall();
                      }}
                      className="text-xs text-slate-500 hover:text-slate-300 underline"
                    >
                      Or ignore invite and start a new call
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Create an Instant Room</h3>
                  <p className="text-xs text-slate-400 mb-6">
                    Generates a link you can share with anyone via WhatsApp or Telegram.
                  </p>

                  <button
                    type="button"
                    onClick={handleStartNewCall}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-dark-950 font-bold text-sm tracking-wide shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all flex items-center justify-center gap-2 group cursor-pointer"
                  >
                    <span>Start a Call</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              )}

              {!defaultRoomId && (
                <>
                  <div className="my-5 flex items-center gap-3">
                    <div className="h-px bg-slate-800 flex-1" />
                    <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">or join existing</span>
                    <div className="h-px bg-slate-800 flex-1" />
                  </div>

                  <form onSubmit={handleJoinExisting} className="space-y-3">
                    <input
                      type="text"
                      placeholder="Paste Call ID or Link (e.g. call-a8b2)"
                      value={roomIdInput}
                      onChange={(e) => setRoomIdInput(e.target.value)}
                      className="w-full bg-dark-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!roomIdInput.trim()}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-750 disabled:opacity-50 text-slate-200 font-semibold text-xs tracking-wide border border-slate-700 transition-all cursor-pointer"
                    >
                      Join Call
                    </button>
                  </form>
                </>
              )}
            </div>

            {/* Feature Guarantees */}
            <div className="glass-panel rounded-xl p-4 border border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>100% Free Tier</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Direct Voice Swap</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Ultra-Low Lag</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full text-center py-2 text-xs text-slate-500 relative z-10">
        VoiceBridge • Built with Microsoft Edge Neural Voices & Real-Time Indic Translation
      </footer>
    </div>
  );
}
