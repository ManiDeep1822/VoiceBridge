import { useState, useEffect, useRef, useCallback } from 'react';
import { getLanguageMeta } from '../utils/languages.js';

export function useSpeechRecognition({
  language = 'en',
  onFinalTranscript,
  onInterimTranscript,
  onSpeakingStateChange,
  isDucked = false,
  silenceTimeoutMs = 0,
  strictPushToTalk = true // Strict Push-to-Talk eliminates all silence timeout lag and ambient noise
}) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100 dB scale
  const [hasSupport, setHasSupport] = useState(true);
  const [micPermission, setMicPermission] = useState('prompt');

  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const shouldBeListeningRef = useRef(false);
  const isDuckedRef = useRef(isDucked);
  isDuckedRef.current = isDucked;

  const silenceTimerRef = useRef(null);
  const accumulatedUtteranceRef = useRef('');
  const interimTextRef = useRef('');
  const isSpeakingBroadcastingRef = useRef(false);

  const langMeta = getLanguageMeta(language);

  // Initialize Audio Meter
  const startAudioMeter = useCallback(async () => {
    try {
      if (!micStreamRef.current) {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      }
      setMicPermission('granted');

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const source = audioContextRef.current.createMediaStreamSource(micStreamRef.current);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!analyserRef.current || !shouldBeListeningRef.current) {
          setAudioLevel(0);
          return;
        }

        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalized);

        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (err) {
      console.warn('[AudioMeter] Microphone access error:', err);
      setMicPermission('denied');
    }
  }, []);

  const stopAudioMeter = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  const stopListening = useCallback(() => {
    shouldBeListeningRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        // Use abort() for instantaneous 0ms audio capture termination
        recognitionRef.current.abort();
      } catch (e) {
        try {
          recognitionRef.current.stop();
        } catch (err) {}
      }
    }
    setIsListening(false);
    setInterimText('');
    stopAudioMeter();

    if (isSpeakingBroadcastingRef.current) {
      isSpeakingBroadcastingRef.current = false;
      if (onSpeakingStateChange) onSpeakingStateChange(false);
    }
  }, [onSpeakingStateChange, stopAudioMeter]);

  // Dispatch finalized turn and auto-mute mic (Captures full accumulated text or trailing interim)
  const finalizeTurn = useCallback(() => {
    const fullText = (interimTextRef.current.trim() || accumulatedUtteranceRef.current.trim());
    accumulatedUtteranceRef.current = '';
    interimTextRef.current = '';
    setInterimText('');

    // Cut off microphone immediately upon turn completion
    stopListening();

    if (fullText && onFinalTranscript) {
      onFinalTranscript(fullText);
    }
  }, [onFinalTranscript, stopListening]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setHasSupport(false);
      return;
    }

    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = langMeta.stt;

    recognition.onresult = (event) => {
      // Guard: If we are not actively supposed to be listening or if ducked, ignore lagging audio frames
      if (!shouldBeListeningRef.current || isDuckedRef.current) {
        return;
      }

      // Notify peer immediately that local user is actively transmitting
      if (!isSpeakingBroadcastingRef.current) {
        isSpeakingBroadcastingRef.current = true;
        if (onSpeakingStateChange) onSpeakingStateChange(true);
      }

      let currentInterim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || '';
        if (result.isFinal) {
          accumulatedUtteranceRef.current = (accumulatedUtteranceRef.current + ' ' + transcript).trim();
        } else {
          currentInterim += transcript;
        }
      }

      const activeDisplay = (accumulatedUtteranceRef.current + ' ' + currentInterim).trim();
      interimTextRef.current = activeDisplay;
      setInterimText(activeDisplay);
      if (onInterimTranscript) {
        onInterimTranscript(activeDisplay);
      }

      // Silence auto-mute is active ONLY if strictPushToTalk is explicitly turned off
      if (!strictPushToTalk && silenceTimeoutMs > 0) {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        silenceTimerRef.current = setTimeout(() => {
          finalizeTurn();
        }, silenceTimeoutMs);
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('[SpeechRec] Event error:', event.error);
      }
    };

    recognition.onend = () => {
      if (shouldBeListeningRef.current) {
        try {
          recognition.start();
        } catch (e) {}
      } else {
        setIsListening(false);
        setInterimText('');
        if (isSpeakingBroadcastingRef.current) {
          isSpeakingBroadcastingRef.current = false;
          if (onSpeakingStateChange) onSpeakingStateChange(false);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldBeListeningRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      try {
        recognition.stop();
      } catch (e) {}
      stopAudioMeter();
    };
  }, [finalizeTurn, isDuckedRef, langMeta.stt, onInterimTranscript, onSpeakingStateChange, silenceTimeoutMs, stopAudioMeter, strictPushToTalk]);

  const startListening = useCallback(async () => {
    if (!recognitionRef.current) return;
    accumulatedUtteranceRef.current = '';
    interimTextRef.current = '';
    setInterimText('');
    shouldBeListeningRef.current = true;

    // Immediately signal transmission start across socket
    if (!isSpeakingBroadcastingRef.current) {
      isSpeakingBroadcastingRef.current = true;
      if (onSpeakingStateChange) onSpeakingStateChange(true);
    }

    try {
      recognitionRef.current.lang = langMeta.stt;
      recognitionRef.current.start();
      setIsListening(true);
      await startAudioMeter();
    } catch (e) {
      setIsListening(true);
    }
  }, [langMeta.stt, onSpeakingStateChange, startAudioMeter]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      finalizeTurn();
    } else {
      startListening();
    }
  }, [finalizeTurn, isListening, startListening]);

  return {
    isListening,
    interimText,
    audioLevel,
    hasSupport,
    micPermission,
    startListening,
    stopListening,
    toggleListening,
    finalizeTurn,
    micStream: micStreamRef.current
  };
}
