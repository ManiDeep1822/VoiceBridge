import { useState, useEffect, useRef, useCallback } from 'react';
import { getLanguageMeta } from '../utils/languages.js';
import { getProsodyParams, classifyAndPunctuateIntent } from '../utils/prosodyEngine.js';
import { deduplicateTokens } from '../utils/transcriptDeduplicator.js';

export function useSpeechSynthesis({
  onSpeechStart,
  onSpeechEnd,
  volumeBoost = true, // +6dB Gain via Web Audio
  preferredEngine = 'hybrid' // 'web-speech' | 'edge-tts' | 'hybrid'
}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeVoiceName, setActiveVoiceName] = useState('');
  const [availableVoices, setAvailableVoices] = useState([]);
  const [volume, setVolume] = useState(1.0); // 0.0 to 1.0
  const [speechRate, setSpeechRate] = useState(1.03); // Natural human conversational pace (1.03x)
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const audioContextRef = useRef(null);
  const gainNodeRef = useRef(null);
  const activeAudioElRef = useRef(null);
  const currentUtteranceRef = useRef(null);
  const recentSpokenRef = useRef({});

  // Initialize Web Audio Gain for extra loudness
  const initAudioGain = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          audioContextRef.current = new AudioCtx();
          const gainNode = audioContextRef.current.createGain();
          gainNode.gain.value = volumeBoost ? 1.8 : 1.0;
          gainNode.connect(audioContextRef.current.destination);
          gainNodeRef.current = gainNode;
        }
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      setAudioUnlocked(true);
    } catch (e) {}
  }, [volumeBoost]);

  // Unlock AudioContext and prime SpeechSynthesis on user gesture
  const unlockAudio = useCallback(async () => {
    try {
      initAudioGain();
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        // Prime synthesis with an empty zero-volume utterance
        const silent = new SpeechSynthesisUtterance(' ');
        silent.volume = 0.01;
        window.speechSynthesis.speak(silent);
      }
      setAudioUnlocked(true);
      return true;
    } catch (e) {
      return false;
    }
  }, [initAudioGain]);

  // Load available browser voices
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Find optimal voice for a language
  const findBestVoice = useCallback((langCode) => {
    if (!availableVoices.length) return null;
    const meta = getLanguageMeta(langCode);
    const prefix = meta.code.toLowerCase();

    let match = availableVoices.find(v => v.lang.toLowerCase().replace('_', '-') === meta.stt.toLowerCase());
    if (!match) {
      match = availableVoices.find(v => v.lang.toLowerCase().startsWith(prefix));
    }
    if (!match) {
      match = availableVoices.find(v => v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Neural'));
    }
    return match || availableVoices[0];
  }, [availableVoices]);

  // Play Base64 Audio (from Edge-TTS backend)
  const playBase64Audio = useCallback(async (base64Data) => {
    return new Promise((resolve) => {
      try {
        initAudioGain();
        const audio = new Audio(`data:audio/mp3;base64,${base64Data}`);
        activeAudioElRef.current = audio;
        audio.volume = Math.min(1.0, volume);

        setIsSpeaking(true);
        if (onSpeechStart) onSpeechStart();

        audio.onended = () => {
          setIsSpeaking(false);
          if (onSpeechEnd) onSpeechEnd();
          activeAudioElRef.current = null;
          resolve(true);
        };

        audio.onerror = () => {
          setIsSpeaking(false);
          if (onSpeechEnd) onSpeechEnd();
          activeAudioElRef.current = null;
          resolve(false);
        };

        audio.play().catch(() => {
          setIsSpeaking(false);
          if (onSpeechEnd) onSpeechEnd();
          resolve(false);
        });
      } catch (e) {
        setIsSpeaking(false);
        if (onSpeechEnd) onSpeechEnd();
        resolve(false);
      }
    });
  }, [initAudioGain, onSpeechEnd, onSpeechStart, volume]);

  // Speak text using Web Speech API (Instantaneous, 0ms)
  const speakTextLocal = useCallback((text, targetLang) => {
    if (!window.speechSynthesis || !text) return;

    window.speechSynthesis.cancel();

    const dedupedText = deduplicateTokens(text);
    if (!dedupedText) return;

    const { punctuatedText } = classifyAndPunctuateIntent(dedupedText, targetLang);
    const prosody = getProsodyParams(punctuatedText);

    const utterance = new SpeechSynthesisUtterance(punctuatedText);
    const voice = findBestVoice(targetLang);
    if (voice) {
      utterance.voice = voice;
      setActiveVoiceName(voice.name);
    }
    const meta = getLanguageMeta(targetLang);
    utterance.lang = meta.stt;
    utterance.volume = Math.min(1.0, volume);
    utterance.rate = speechRate || prosody.rate;
    utterance.pitch = prosody.pitch;

    utterance.onstart = () => {
      setIsSpeaking(true);
      if (onSpeechStart) onSpeechStart();
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      if (onSpeechEnd) onSpeechEnd();
      currentUtteranceRef.current = null;
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('[SpeechSynthesis] Utterance error:', e.error);
      }
      setIsSpeaking(false);
      if (onSpeechEnd) onSpeechEnd();
      currentUtteranceRef.current = null;
    };

    currentUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [findBestVoice, onSpeechEnd, onSpeechStart, speechRate, volume]);



  // Stop any ongoing speech
  const stopSpeech = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (activeAudioElRef.current) {
      try {
        activeAudioElRef.current.pause();
        activeAudioElRef.current.currentTime = 0;
      } catch (e) {}
      activeAudioElRef.current = null;
    }
    setIsSpeaking(false);
    if (onSpeechEnd) onSpeechEnd();
  }, [onSpeechEnd]);

  // Main Speak Dispatcher with strict deduplication
  const speak = useCallback(async (text, targetLang, backendAudioBase64 = null) => {
    if (!text || !text.trim()) return;

    const cleanText = deduplicateTokens(text.trim());
    if (!cleanText) return;

    const key = `${targetLang}:${cleanText.toLowerCase()}`;
    const now = Date.now();

    // Prevent duplicate replay of exact same utterance within 3500ms
    if (recentSpokenRef.current[key] && (now - recentSpokenRef.current[key] < 3500)) {
      return;
    }
    recentSpokenRef.current[key] = now;

    // Prune stale keys older than 15 seconds
    for (const k in recentSpokenRef.current) {
      if (now - recentSpokenRef.current[k] > 15000) {
        delete recentSpokenRef.current[k];
      }
    }

    // Stop any ongoing speech so voices never speak concurrently
    stopSpeech();

    // Unlock audio context
    initAudioGain();

    // If backend Edge-TTS base64 is supplied
    if (backendAudioBase64) {
      const ok = await playBase64Audio(backendAudioBase64);
      if (ok) return;
    }

    // Only fallback to browser Web Speech API if engine is explicitly NOT locked to edge-tts
    if (preferredEngine !== 'edge-tts') {
      speakTextLocal(cleanText, targetLang);
    }
  }, [initAudioGain, playBase64Audio, preferredEngine, speakTextLocal, stopSpeech]);

  // Play Audible Test Sound
  const playTestSound = useCallback(() => {
    initAudioGain();
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = audioContextRef.current || new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5 note
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {}

    // Follow with verbal confirmation
    setTimeout(() => {
      speakTextLocal('Loudspeaker audio bridge ready', 'en');
    }, 350);
  }, [initAudioGain, speakTextLocal]);



  return {
    isSpeaking,
    speak,
    stopSpeech,
    activeVoiceName,
    availableVoices,
    volume,
    setVolume,
    speechRate,
    setSpeechRate,
    audioUnlocked,
    unlockAudio,
    playTestSound,
    playBase64Audio
  };
}
