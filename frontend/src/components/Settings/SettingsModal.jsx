import React, { useState } from 'react';
import { X, Volume2, Mic, Settings, Sliders, CheckCircle2, RefreshCw } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 select-none font-mono text-xs">
      <div className="bg-[#111111] border border-[#262626] w-full max-w-lg shadow-2xl overflow-hidden relative">
        {/* Modal Header */}
        <div className="bg-[#161616] border-b border-[#262626] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#E61919]" />
            <div>
              <h3 className="font-bold text-xs uppercase text-white tracking-wider">
                [ HARDWARE CALIBRATION // AUDIO & DIALECT SPEC ]
              </h3>
              <p className="text-[10px] text-[#71717A]">
                Calibrate input transceivers, loudspeaker gain, and speech rate.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="border border-[#262626] hover:border-white p-1 text-[#A1A1AA] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4">
          {/* 1. Loudspeaker Output & Audio Test */}
          <div className="border border-[#262626] bg-[#0E0E0E] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-white uppercase">[01] LOUDSPEAKER OUTPUT BRIDGE</span>
                <p className="text-[10px] text-[#71717A]">Hardware amplification & audio test</p>
              </div>

              <button
                type="button"
                onClick={handleSpeakerTest}
                className="px-3 py-1 border border-[#333333] hover:border-white bg-[#1A1A1A] hover:bg-white hover:text-black text-white text-[10px] uppercase transition-colors"
              >
                {testingSpeaker ? '[ EMITTING TONE... ]' : '[ EMIT TEST TONE ]'}
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#1F1F1F]">
              <span className="text-[#A1A1AA]">+6dB GAIN BOOST:</span>
              <button
                onClick={onToggleVolumeBoost}
                className={`px-3 py-0.5 border text-[10px] font-bold uppercase ${
                  volumeBoost ? 'border-white bg-white text-black' : 'border-[#333333] bg-[#161616] text-[#71717A]'
                }`}
              >
                {volumeBoost ? 'ACTIVE (+6dB)' : 'OFF (0dB)'}
              </button>
            </div>
          </div>

          {/* 2. Microphone Hardware Sensor */}
          <div className="border border-[#262626] bg-[#0E0E0E] p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-white uppercase">[02] MICROPHONE SENSITIVITY VU</span>
              <span className="text-[10px] text-white">{audioLevel}% dB</span>
            </div>
            <div className="w-full bg-[#161616] border border-[#262626] h-2">
              <div
                className="bg-white h-full transition-all duration-75"
                style={{ width: `${Math.min(100, audioLevel * 1.5)}%` }}
              />
            </div>
          </div>

          {/* 3. Neural Voice Persona & Speed */}
          <div className="border border-[#262626] bg-[#0E0E0E] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white uppercase">[03] VOICE PERSONA & RATE</span>
              <span className="text-[10px] text-white">{speechRate}x SPEED</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => onVoiceGenderChange('female')}
                className={`flex-1 py-1 border text-[10px] uppercase font-bold ${
                  voiceGender === 'female' ? 'border-white bg-white text-black' : 'border-[#333333] bg-[#161616] text-[#71717A]'
                }`}
              >
                FEMALE NEURAL
              </button>
              <button
                onClick={() => onVoiceGenderChange('male')}
                className={`flex-1 py-1 border text-[10px] uppercase font-bold ${
                  voiceGender === 'male' ? 'border-white bg-white text-black' : 'border-[#333333] bg-[#161616] text-[#71717A]'
                }`}
              >
                MALE NEURAL
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-[#71717A]">
                <span>CONVERSATIONAL RATE</span>
                <span>{speechRate}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.5"
                step="0.05"
                value={speechRate}
                onChange={(e) => onSpeechRateChange(parseFloat(e.target.value))}
                className="w-full accent-white bg-[#1A1A1A] cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#161616] border-t border-[#262626] px-4 py-2.5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-white bg-white hover:bg-[#E5E5E5] text-black font-bold text-xs uppercase cursor-pointer"
          >
            [ CLOSE & APPLY ]
          </button>
        </div>
      </div>
    </div>
  );
}
