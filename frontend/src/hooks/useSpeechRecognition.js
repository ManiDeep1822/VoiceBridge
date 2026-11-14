import { useState, useEffect, useRef, useCallback } from 'react';
import { getLanguageMeta } from '../utils/languages.js';
import { deduplicateTokens, mergeStreamingTranscript } from '../utils/transcriptDeduplicator.js';

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
  const shouldBeListeningRef = useRef(false);
  const isRecognizingRef = useRef(false);
  const isStartingRef = useRef(false);
  const lastStartTimeRef = useRef(0);
  const restartTimerRef = useRef(null);
  const restartAttemptsRef = useRef(0);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // Detect mobile operating system for environment context
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

  // Resilient debounced auto-reconnection for SpeechRecognition drops
  const scheduleRestart = useCallback((delayMs = 150) => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (!shouldBeListeningRef.current || isDuckedRef.current) {
      return;
    }
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (!shouldBeListeningRef.current || isDuckedRef.current) return;
      if (isRecognizingRef.current) return;

      try {
        isStartingRef.current = true;
        lastStartTimeRef.current = Date.now();
        recognitionRef.current?.start();
        restartAttemptsRef.current = 0;
      } catch (err) {
        isStartingRef.current = false;
        // If start throws (e.g. InvalidStateError during teardown), retry with debounced backoff
        if (shouldBeListeningRef.current && !isDuckedRef.current) {
          restartAttemptsRef.current += 1;
          const nextDelay = Math.min(600, 150 + restartAttemptsRef.current * 100);
          scheduleRestart(nextDelay);
        }
      }
    }, delayMs);
  }, []);

  // Unified Web Audio API Audio Meter across both Mobile and Desktop (Laptop Parity)
  const startAudioMeter = useCallback(async () => {
    try {
      // Hardware stream reuse: check if micStreamRef already holds live audio tracks
      let stream = micStreamRef.current;
      const hasLiveTracks = Boolean(stream && stream.getAudioTracks && stream.getAudioTracks().some(t => t.readyState === 'live'));

      if (!hasLiveTracks) {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
          micStreamRef.current = stream;
        }
      }
      setMicPermission('granted');

      if (!micStreamRef.current) return;

      const AudioCtx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AudioCtx) return;

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioCtx();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume().catch(() => {});
      }

      if (!analyserRef.current || analyserRef.current.context !== audioContextRef.current) {
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
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicPermission('denied');
      }
      console.warn('[AudioMeter] Microphone access error:', err);
    }
  }, []);

  const stopAudioMeter = useCallback(() => {
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
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        try {
          recognitionRef.current.abort();
        } catch (err) {}
      }
    }
    isRecognizingRef.current = false;
    setIsListening(false);
    setInterimText('');
    stopAudioMeter();

    if (isSpeakingBroadcastingRef.current) {
      isSpeakingBroadcastingRef.current = false;
      if (onSpeakingStateChangeRef.current) onSpeakingStateChangeRef.current(false);
    }
  }, [stopAudioMeter]);

  // Dispatch finalized turn and auto-mute mic (Captures full accumulated text or trailing interim, deduplicated)
  const finalizeTurn = useCallback(() => {
    const raw = (interimTextRef.current.trim() || accumulatedUtteranceRef.current.trim());
    const fullText = deduplicateTokens(raw);
    accumulatedUtteranceRef.current = '';
    interimTextRef.current = '';
    setInterimText('');

    stopListening();

    if (fullText && onFinalTranscriptRef.current) {
      onFinalTranscriptRef.current(fullText);
    }
  }, [stopListening]);

  // Acoustic Echo Prevention: Strictly halt speech recognition while loudspeaker translated speech is playing
  useEffect(() => {
    if (isDucked) {
      shouldBeListeningRef.current = false;
      isStartingRef.current = false;
      isRecognizingRef.current = false;
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          try {
            recognitionRef.current.abort();
          } catch (err) {}
        }
      }
      setIsListening(false);
      setAudioLevel(0);
      stopAudioMeter();
      if (isSpeakingBroadcastingRef.current) {
        isSpeakingBroadcastingRef.current = false;
        if (onSpeakingStateChangeRef.current) onSpeakingStateChangeRef.current(false);
      }
    }
  }, [isDucked, stopAudioMeter]);

  // Initialize Speech Recognition ONCE or when language changes
  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setHasSupport(false);
      return;
    }

    const recognition = new SpeechRec();
    // Enable continuous listening across both mobile and desktop for complete laptop parity.
    // Smart deduplication in transcriptDeduplicator handles streaming phrase loops cleanly.
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = langMeta.stt;

    recognition.onstart = () => {
      restartAttemptsRef.current = 0;
      if (!shouldBeListeningRef.current) {
        isRecognizingRef.current = false;
        isStartingRef.current = false;
        setIsListening(false);
        try {
          recognition.stop();
        } catch (e) {
          try {
            recognition.abort();
          } catch (err) {}
        }
        return;
      }
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
          accumulatedUtteranceRef.current = deduplicateTokens(
            mergeStreamingTranscript(accumulatedUtteranceRef.current, transcript)
          );
        } else {
          currentInterim = transcript;
        }
      }

      const rawCombined = mergeStreamingTranscript(accumulatedUtteranceRef.current, currentInterim);
      const activeDisplay = deduplicateTokens(rawCombined);
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
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setMicPermission('denied');
        shouldBeListeningRef.current = false;
        setIsListening(false);
        return;
      }
      // Resilient auto-reconnect on mobile silence/no-speech drop
      if (event.error === 'no-speech' && shouldBeListeningRef.current && !isDuckedRef.current) {
        scheduleRestart(150);
      }
    };

    recognition.onend = () => {
      isRecognizingRef.current = false;
      isStartingRef.current = false;
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      if (shouldBeListeningRef.current && !isDuckedRef.current) {
        const elapsed = Date.now() - lastStartTimeRef.current;
        const waitTime = elapsed < 250 ? (250 - elapsed) : 50;
        scheduleRestart(waitTime);
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
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      try {
        recognition.stop();
      } catch (e) {}
    };
  }, [finalizeTurn, langMeta.stt, scheduleRestart, silenceTimeoutMs, strictPushToTalk]);

  // Clean teardown of hardware stream and active timers only on hook unmount
  useEffect(() => {
    return () => {
      shouldBeListeningRef.current = false;
      isStartingRef.current = false;
      isRecognizingRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch (e) {}
        audioContextRef.current = null;
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
      }
    };
  }, []);

  // Background pauses & tab visibility: auto-reconnect speech recognition and resume AudioContext
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && shouldBeListeningRef.current && !isDuckedRef.current) {
        if (!isRecognizingRef.current && !isStartingRef.current) {
          scheduleRestart(100);
        }
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [scheduleRestart]);

  // Permission state observer & automatic recovery when permissions are re-granted in browser settings
  useEffect(() => {
    let permStatus = null;
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      try {
        navigator.permissions.query({ name: 'microphone' }).then((status) => {
          permStatus = status;
          setMicPermission(status.state);
          status.onchange = () => {
            setMicPermission(status.state);
            if (status.state === 'granted') {
              if (shouldBeListeningRef.current) {
                startAudioMeter();
                if (!isRecognizingRef.current && !isStartingRef.current) {
                  scheduleRestart(100);
                }
              }
            }
          };
        }).catch(() => {});
      } catch (e) {}
    }
    return () => {
      if (permStatus) {
        permStatus.onchange = null;
      }
    };
  }, [scheduleRestart, startAudioMeter]);

  const startListening = useCallback(async () => {
    // Acoustic Echo Guard: refuse start if remote translation speech is currently broadcasting
    if (isDuckedRef.current) return;

    if (!recognitionRef.current) return;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    accumulatedUtteranceRef.current = '';
    interimTextRef.current = '';
    setInterimText('');
    shouldBeListeningRef.current = true;
    restartAttemptsRef.current = 0;

    if (!isSpeakingBroadcastingRef.current) {
      isSpeakingBroadcastingRef.current = true;
      if (onSpeakingStateChangeRef.current) onSpeakingStateChangeRef.current(true);
    }

    startAudioMeter();

    if (!isRecognizingRef.current && !isStartingRef.current) {
      isStartingRef.current = true;
      lastStartTimeRef.current = Date.now();
      try {
        recognitionRef.current.lang = langMeta.stt;
        recognitionRef.current.start();
      } catch (e) {
        isStartingRef.current = false;
        scheduleRestart(150);
      }
    }
    setIsListening(true);
  }, [langMeta.stt, scheduleRestart, startAudioMeter]);

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
