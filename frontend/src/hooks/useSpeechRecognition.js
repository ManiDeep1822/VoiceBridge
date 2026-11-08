import { useState, useEffect, useRef, useCallback } from 'react';
import { getLanguageMeta } from '../utils/languages.js';

export function useSpeechRecognition({
  language = 'en',
  onFinalTranscript,
  onInterimTranscript,
  onSpeakingStateChange,
  isDucked = false,
  silenceTimeoutMs = 0,
  strictPushToTalk = true,
  backendUrl = ''
}) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100 dB scale
  const [hasSupport, setHasSupport] = useState(true);
  const [micPermission, setMicPermission] = useState('prompt');
  const [isFallbackMode, setIsFallbackMode] = useState(false);

  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const mobilePulseTimerRef = useRef(null);
  const shouldBeListeningRef = useRef(false);
  const isRecognizingRef = useRef(false);
  const isStartingRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // Detect mobile operating system to avoid Android Google Speech Services hardware conflicts
  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Keep mutable callbacks in stable refs to prevent useEffect teardown loops
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  onFinalTranscriptRef.current = onFinalTranscript;

  const onInterimTranscriptRef = useRef(onInterimTranscript);
  onInterimTranscriptRef.current = onInterimTranscript;

  const onSpeakingStateChangeRef = useRef(onSpeakingStateChange);
  onSpeakingStateChangeRef.current = onSpeakingStateChange;

  const isDuckedRef = useRef(isDucked);
  isDuckedRef.current = isDucked;

  const silenceTimerRef = useRef(null);
  const accumulatedUtteranceRef = useRef('');
  const interimTextRef = useRef('');
  const isSpeakingBroadcastingRef = useRef(false);

  const langMeta = getLanguageMeta(language);

  // Initialize and Maintain Audio Meter: Decoupled on mobile to avoid Google Speech lockup
  const startAudioMeter = useCallback(async () => {
    // On mobile devices, avoid opening concurrent getUserMedia while SpeechRecognition runs
    if (isMobile) {
      if (mobilePulseTimerRef.current) clearInterval(mobilePulseTimerRef.current);
      mobilePulseTimerRef.current = setInterval(() => {
        if (shouldBeListeningRef.current) {
          setAudioLevel(Math.floor(35 + Math.random() * 45));
        } else {
          setAudioLevel(0);
        }
      }, 120);
      return;
    }

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

      if (!analyserRef.current) {
        const source = audioContextRef.current.createMediaStreamSource(micStreamRef.current);
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);
        analyserRef.current = analyser;
      }

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

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
  }, [isMobile]);

  const stopAudioMeter = useCallback(() => {
    if (mobilePulseTimerRef.current) {
      clearInterval(mobilePulseTimerRef.current);
      mobilePulseTimerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Gracefully stop listening without killing hardware tracks or locking Web Speech API
  const stopListening = useCallback(() => {
    shouldBeListeningRef.current = false;
    isStartingRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (recognitionRef.current && isRecognizingRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        try {
          recognitionRef.current.abort();
        } catch (err) {}
      }
    }
    setIsListening(false);
    setInterimText('');
    stopAudioMeter();

    if (isSpeakingBroadcastingRef.current) {
      isSpeakingBroadcastingRef.current = false;
      if (onSpeakingStateChangeRef.current) onSpeakingStateChangeRef.current(false);
    }
  }, [stopAudioMeter]);

  // Dispatch finalized turn and auto-mute mic (Captures full accumulated text or trailing interim)
  const finalizeTurn = useCallback(() => {
    const fullText = (interimTextRef.current.trim() || accumulatedUtteranceRef.current.trim());
    accumulatedUtteranceRef.current = '';
    interimTextRef.current = '';
    setInterimText('');

    stopListening();

    if (fullText && onFinalTranscriptRef.current) {
      onFinalTranscriptRef.current(fullText);
    }
  }, [stopListening]);

  // Initialize Speech Recognition ONCE or when language changes
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

    recognition.onstart = () => {
      isRecognizingRef.current = true;
      isStartingRef.current = false;
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      // Guard: If we are not actively supposed to be listening or if ducked, ignore lagging audio frames
      if (!shouldBeListeningRef.current || isDuckedRef.current) {
        return;
      }

      // Notify peer immediately that local user is actively transmitting
      if (!isSpeakingBroadcastingRef.current) {
        isSpeakingBroadcastingRef.current = true;
        if (onSpeakingStateChangeRef.current) onSpeakingStateChangeRef.current(true);
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
      if (onInterimTranscriptRef.current) {
        onInterimTranscriptRef.current(activeDisplay);
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
      isStartingRef.current = false;
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('[SpeechRec] Event error:', event.error);
      }
      if (event.error === 'not-allowed') {
        setMicPermission('denied');
      }
    };

    recognition.onend = () => {
      isRecognizingRef.current = false;
      isStartingRef.current = false;
      if (shouldBeListeningRef.current) {
        try {
          recognition.start();
        } catch (e) {}
      } else {
        setIsListening(false);
        setInterimText('');
        if (isSpeakingBroadcastingRef.current) {
          isSpeakingBroadcastingRef.current = false;
          if (onSpeakingStateChangeRef.current) onSpeakingStateChangeRef.current(false);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldBeListeningRef.current = false;
      isRecognizingRef.current = false;
      isStartingRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      try {
        recognition.stop();
      } catch (e) {}
    };
  }, [finalizeTurn, langMeta.stt, silenceTimeoutMs, strictPushToTalk]);

  // Clean teardown of hardware stream only on hook unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch (e) {}
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
      }
    };
  }, []);

  const startListening = useCallback(async () => {
    // If on mobile, ensure any lingering getUserMedia track is stopped to give exclusive hardware control to SpeechRecognition
    if (isMobile && micStreamRef.current) {
      try {
        micStreamRef.current.getTracks().forEach(t => t.stop());
      } catch (e) {}
      micStreamRef.current = null;
    }

    if (!recognitionRef.current) return;
    accumulatedUtteranceRef.current = '';
    interimTextRef.current = '';
    setInterimText('');
    shouldBeListeningRef.current = true;

    if (!isSpeakingBroadcastingRef.current) {
      isSpeakingBroadcastingRef.current = true;
      if (onSpeakingStateChangeRef.current) onSpeakingStateChangeRef.current(true);
    }

    startAudioMeter();

    if (!isRecognizingRef.current && !isStartingRef.current) {
      isStartingRef.current = true;
      try {
        recognitionRef.current.lang = langMeta.stt;
        recognitionRef.current.start();
      } catch (e) {
        isStartingRef.current = false;
      }
    }
    setIsListening(true);
  }, [isMobile, langMeta.stt, startAudioMeter]);

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
