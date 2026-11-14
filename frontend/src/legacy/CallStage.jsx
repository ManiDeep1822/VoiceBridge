import React, { useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Radio, Play, RefreshCw, Users, User, ArrowRightLeft, Activity } from 'lucide-react';
import { SUPPORTED_LANGUAGES, getLanguageMeta } from '../utils/languages.js';

export function CallStage({
  localLanguage = 'en',
  remoteLanguage = 'es',
  onLocalLanguageChange,
  onRemoteLanguageChange,
  isListening = false,
  onToggleMic,
  localAudioLevel = 0,
  remoteAudioLevel = 0,
  isRemoteSpeaking = false,
  isLocalSpeakingTTS = false,
  localInterim = '',
  latestLocalOriginal = '',
  latestLocalTranslated = '',
  latestRemoteOriginal = '',
  latestRemoteTranslated = '',
  mode = 'simulator', // 'p2p' | 'simulator'
  onModeChange,
  roomId = '',
  onRoomIdChange,
  onJoinRoom,
  onLeaveRoom,
  connectionState = 'disconnected',
  onSimulatePeerTurn,
  onReplayLastAudio,
  activeDomain = 'general',
  volumeBoost = true,
  onToggleVolumeBoost
}) {
  const [testInput, setTestInput] = useState('');

  const localMeta = getLanguageMeta(localLanguage);
  const remoteMeta = getLanguageMeta(remoteLanguage);

  return (
    <div className="flex-1 flex flex-col p-3 sm:p-5 gap-4 overflow-y-auto max-w-7xl mx-auto w-full">
      {/* Session Controls & Mode Selector Bar */}
      <div className="bg-[#0C1016] border border-[#1E2733] p-3 flex flex-wrap items-center justify-between gap-3">
        {/* Mode Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-telemetry uppercase text-gray-400">OPERATION MODE:</span>
          <div className="flex bg-[#121820] border border-[#232E3D] p-0.5">
            <button
              onClick={() => onModeChange('simulator')}
              className={`px-3 py-1 text-xs font-telemetry uppercase flex items-center gap-1.5 transition-colors ${
                mode === 'simulator'
                  ? 'bg-emerald-500 text-black font-bold shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Solo Duplex Simulator
            </button>
            <button
              onClick={() => onModeChange('p2p')}
              className={`px-3 py-1 text-xs font-telemetry uppercase flex items-center gap-1.5 transition-colors ${
                mode === 'p2p'
                  ? 'bg-cyan-500 text-black font-bold shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Live P2P Call Room
            </button>
          </div>
        </div>

        {/* Room Joiner (if in P2P mode) */}
        {mode === 'p2p' ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={roomId}
              onChange={(e) => onRoomIdChange(e.target.value)}
              placeholder="ENTER ROOM CODE (e.g. ALPHA-99)"
              className="bg-[#121720] border border-[#2A3749] px-3 py-1 text-xs font-telemetry uppercase tracking-wider text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 w-52"
            />
            {connectionState === 'connected' || connectionState === 'waiting' ? (
              <button
                onClick={onLeaveRoom}
                className="px-3 py-1 bg-red-950/80 hover:bg-red-900 border border-red-500 text-red-200 text-xs font-telemetry uppercase font-semibold transition-colors"
              >
                Disconnect Call
              </button>
            ) : (
              <button
                onClick={onJoinRoom}
                className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-black text-xs font-telemetry uppercase font-bold transition-colors"
              >
                Connect P2P
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-telemetry text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5">
              AUTONOMOUS 2-WAY LOOPBACK
            </span>
            <button
              onClick={onSimulatePeerTurn}
              className="px-3 py-1 bg-[#16202C] hover:bg-[#1E2C3D] border border-cyan-500/50 text-cyan-300 text-xs font-telemetry uppercase flex items-center gap-1.5 transition-colors"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Trigger Peer Response
            </button>
          </div>
        )}

        {/* Audio Loudness Boost */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleVolumeBoost}
            className={`px-2.5 py-1 text-xs font-telemetry uppercase flex items-center gap-1.5 border transition-colors ${
              volumeBoost
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                : 'bg-[#121820] border-[#253242] text-gray-400'
            }`}
            title="Amplify speaker volume output by +6dB with active acoustic ducking"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Audio Boost: +6dB {volumeBoost ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Main Dual-Console Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
        {/* LOCAL CALLER CONSOLE */}
        <div className="bg-[#0A0D12] border border-[#1B232E] flex flex-col p-4 relative overflow-hidden">
          {/* Top Panel Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#18202A]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-extrabold text-xs tracking-wider uppercase text-white">OPERATOR 01 (YOU)</span>
              <span className="text-[10px] font-telemetry text-gray-500">LOCAL TRANSMITTER</span>
            </div>

            {/* Language Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{localMeta.flag}</span>
              <select
                value={localLanguage}
                onChange={(e) => onLocalLanguageChange(e.target.value)}
                className="bg-[#121720] border border-[#263344] text-xs font-telemetry text-emerald-300 px-2 py-1 focus:outline-none focus:border-emerald-400 cursor-pointer"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.name} ({l.native})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Audio Activity & Spectrum Bars */}
          <div className="my-3 flex items-center justify-between bg-[#0E131A] border border-[#19222E] p-2.5">
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleMic}
                className={`p-2.5 rounded-none font-telemetry font-bold text-xs uppercase flex items-center gap-2 transition-all ${
                  isListening
                    ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(0,255,136,0.4)]'
                    : 'bg-red-950/80 text-red-300 border border-red-500 hover:bg-red-900'
                }`}
              >
                {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                {isListening ? 'MIC BROADCASTING' : 'MIC MUTED (CLICK TO START)'}
              </button>
            </div>

            {/* Real-time Audio Level Bar */}
            <div className="flex-1 max-w-[200px] ml-4">
              <div className="flex justify-between text-[10px] font-telemetry text-gray-400 mb-1">
                <span>INPUT LEVEL</span>
                <span className={localAudioLevel > 30 ? 'text-emerald-400 font-bold' : 'text-gray-500'}>
                  {localAudioLevel}%
                </span>
              </div>
              <div className="h-2 bg-[#17202C] overflow-hidden flex">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500 transition-all duration-75"
                  style={{ width: `${localAudioLevel}%` }}
                />
              </div>
            </div>
          </div>

          {/* Live Speaking Interim Teleprompter */}
          <div className="flex-1 bg-[#070A0E] border border-[#161D27] p-3.5 flex flex-col justify-between min-h-[140px]">
            <div>
              <div className="text-[10px] font-telemetry text-gray-500 uppercase flex items-center justify-between mb-2">
                <span>ACTIVE UTTERANCE MONITOR</span>
                {isListening && <span className="text-emerald-400 text-[10px] font-telemetry">LIVE STREAMING</span>}
              </div>

              {localInterim ? (
                <p className="text-base sm:text-lg text-emerald-300 font-medium leading-relaxed font-sans animate-pulse">
                  "{localInterim}"
                </p>
              ) : latestLocalOriginal ? (
                <div className="space-y-1.5">
                  <p className="text-sm text-gray-300 font-medium">"{latestLocalOriginal}"</p>
                  <div className="text-xs font-telemetry text-cyan-400 bg-cyan-950/30 border-l-2 border-cyan-400 pl-2 py-1">
                    <span className="text-gray-500 mr-2">OUTGOING [{remoteMeta.name.toUpperCase()}]:</span>
                    <span>{latestLocalTranslated}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 italic">
                  {isListening
                    ? 'Listening... Speak naturally in ' + localMeta.name + ' — speech is recognized and translated instantly.'
                    : 'Click "MIC MUTED" above to activate live microphone and speak.'}
                </p>
              )}
            </div>

            <div className="pt-2 border-t border-[#141A23] flex items-center justify-between text-[10px] font-telemetry text-gray-500">
              <span>LEXICON: {activeDomain.toUpperCase()}</span>
              <span>STT: BROWSER NATIVE (0-COST)</span>
            </div>
          </div>
        </div>

        {/* REMOTE CALLER CONSOLE */}
        <div className="bg-[#0A0D12] border border-[#1B232E] flex flex-col p-4 relative overflow-hidden">
          {/* Top Panel Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#18202A]">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isRemoteSpeaking ? 'bg-cyan-400 animate-ping' : 'bg-gray-500'
                }`}
              />
              <span className="font-extrabold text-xs tracking-wider uppercase text-white">
                {mode === 'p2p' ? 'PEER 02 (REMOTE CALLER)' : 'AI CALL PARTNER (SIMULATOR)'}
              </span>
              <span className="text-[10px] font-telemetry text-gray-500">RECEIVER & LOUDSPEAKER</span>
            </div>

            {/* Language Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{remoteMeta.flag}</span>
              <select
                value={remoteLanguage}
                onChange={(e) => onRemoteLanguageChange(e.target.value)}
                className="bg-[#121720] border border-[#263344] text-xs font-telemetry text-cyan-300 px-2 py-1 focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.name} ({l.native})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Remote Audio Activity & Loudspeaker Status */}
          <div className="my-3 flex items-center justify-between bg-[#0E131A] border border-[#19222E] p-2.5">
            <div className="flex items-center gap-2">
              <div
                className={`px-3 py-2 text-xs font-telemetry font-bold uppercase flex items-center gap-2 border ${
                  isRemoteSpeaking || isLocalSpeakingTTS
                    ? 'bg-cyan-950 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,229,255,0.3)]'
                    : 'bg-[#131A24] border-[#222E3D] text-gray-400'
                }`}
              >
                <Volume2 className="w-4 h-4" />
                {isRemoteSpeaking || isLocalSpeakingTTS ? 'SPEAKING LOUDLY' : 'LOUDSPEAKER ARMED'}
              </div>

              {latestRemoteTranslated && (
                <button
                  onClick={onReplayLastAudio}
                  className="px-2.5 py-2 bg-[#141C26] hover:bg-[#1E2837] border border-[#263445] text-gray-300 text-xs font-telemetry uppercase flex items-center gap-1 transition-colors"
                  title="Replay translated audio text-to-speech aloud"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Replay
                </button>
              )}
            </div>

            {/* Remote Output Level Meter */}
            <div className="flex-1 max-w-[200px] ml-4">
              <div className="flex justify-between text-[10px] font-telemetry text-gray-400 mb-1">
                <span>SPEAKER OUTPUT</span>
                <span className={remoteAudioLevel > 30 ? 'text-cyan-400 font-bold' : 'text-gray-500'}>
                  {remoteAudioLevel}%
                </span>
              </div>
              <div className="h-2 bg-[#17202C] overflow-hidden flex">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 via-blue-400 to-emerald-400 transition-all duration-75"
                  style={{ width: `${remoteAudioLevel}%` }}
                />
              </div>
            </div>
          </div>

          {/* Incoming Subtitles & Loudspeaker Teleprompter */}
          <div className="flex-1 bg-[#070A0E] border border-[#161D27] p-3.5 flex flex-col justify-between min-h-[140px]">
            <div>
              <div className="text-[10px] font-telemetry text-gray-500 uppercase flex items-center justify-between mb-2">
                <span>INCOMING TRANSLATED SPEECH</span>
                <span className="text-cyan-400 text-[10px] font-telemetry">TTS VOICE SYNTHESIS</span>
              </div>

              {latestRemoteTranslated ? (
                <div className="space-y-2">
                  <div className="text-base sm:text-lg text-white font-semibold leading-relaxed">
                    "{latestRemoteTranslated}"
                  </div>
                  <div className="text-xs font-telemetry text-gray-400 bg-[#101620] border-l-2 border-gray-600 pl-2 py-1">
                    <span className="text-gray-500 mr-2">ORIGINAL [{remoteMeta.name.toUpperCase()}]:</span>
                    <span>{latestRemoteOriginal}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 italic">
                  {mode === 'p2p'
                    ? 'Waiting for remote caller to speak... When they speak, their words are translated to ' + localMeta.name + ' and spoken out loudly through your speakers.'
                    : 'In Solo Simulator mode, click "Trigger Peer Response" or speak into your mic to test 2-way speech translation.'}
                </p>
              )}
            </div>

            <div className="pt-2 border-t border-[#141A23] flex items-center justify-between text-[10px] font-telemetry text-gray-500">
              <span>OUTPUT: EDGE-TTS / WEB SYNTHESIS</span>
              <span>ACOUSTIC DUCKING: ACTIVE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
