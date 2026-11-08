import React, { useState } from 'react';
import { X, Volume2, Mic, Settings, Sliders, CheckCircle2, User } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../../utils/languages.js';

export function SettingsModal({
  isOpen = false,
  onClose,
  localLanguage = 'en',
  onLocalLanguageChange,
  remoteLanguage = 'es',
  onRemoteLanguageChange,
  volumeBoost = true,
  onToggleVolumeBoost,
  onTestSpeaker,
  speechRate = 1.1,
  onSpeechRateChange,
  audioLevel = 0,
  voiceGender = 'female',
  onVoiceGenderChange
}) {
  const [testingSpeaker, setTestingSpeaker] = useState(false);

  if (!isOpen) return null;

  const handleSpeakerTest = () => {
    setTestingSpeaker(true);
    if (onTestSpeaker) onTestSpeaker();
    setTimeout(() => setTestingSpeaker(false), 2200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md select-none font-sans text-sm">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden relative space-y-4">
        {/* Modal Header */}
        <div className="bg-slate-800/60 border-b border-slate-800 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                Audio & Voice Settings
              </h3>
              <p className="text-xs text-slate-400">
                Configure your speaker output, microphone level, and speech rate.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* 1. Loudspeaker Output & Audio Test */}
          <div className="rounded-xl bg-slate-800/40 border border-slate-700/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-white text-sm">Loudspeaker Output</span>
                <p className="text-xs text-slate-400">Test speaker playback and volume</p>
              </div>

              <button
                type="button"
                onClick={handleSpeakerTest}
                className="btn-secondary h-11 px-5 py-2.5 rounded-xl text-sm font-medium"
              >
                <Volume2 className="w-4 h-4" />
                <span>{testingSpeaker ? 'Playing...' : 'Test Speaker'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-700/60">
              <span className="text-slate-300 text-xs font-medium">Loudspeaker Volume Boost:</span>
              <button
                onClick={onToggleVolumeBoost}
                className={`btn-base h-11 px-5 py-2.5 rounded-xl text-sm font-medium ${
                  volumeBoost ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {volumeBoost ? '+6dB Active' : 'Off (Standard)'}
              </button>
            </div>
          </div>

          {/* 2. Microphone Hardware Sensor */}
          <div className="rounded-xl bg-slate-800/40 border border-slate-700/60 p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-white text-sm flex items-center gap-2">
                <Mic className="w-4 h-4 text-emerald-400" />
                <span>Microphone Input Level</span>
              </span>
              <span className="text-xs font-mono font-medium text-emerald-400">{audioLevel}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-75"
                style={{ width: `${Math.min(100, audioLevel * 1.5)}%` }}
              />
            </div>
          </div>

          {/* 3. Neural Voice Persona & Speed */}
          <div className="rounded-xl bg-slate-800/40 border border-slate-700/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white text-sm">Voice Persona & Speed</span>
              <span className="text-xs font-semibold text-blue-400">{speechRate}x Speed</span>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={() => onVoiceGenderChange('female')}
                className={`btn-base flex-1 h-11 px-5 py-2.5 rounded-xl text-sm font-medium ${
                  voiceGender === 'female'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                Female Voice
              </button>
              <button
                onClick={() => onVoiceGenderChange('male')}
                className={`btn-base flex-1 h-11 px-5 py-2.5 rounded-xl text-sm font-medium ${
                  voiceGender === 'male'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                Male Voice
              </button>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Conversational Pace</span>
                <span>{speechRate}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.5"
                step="0.05"
                value={speechRate}
                onChange={(e) => onSpeechRateChange(parseFloat(e.target.value))}
                className="w-full accent-blue-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-800/60 border-t border-slate-800 px-5 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="btn-primary h-11 px-5 py-2.5 rounded-xl font-semibold text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
