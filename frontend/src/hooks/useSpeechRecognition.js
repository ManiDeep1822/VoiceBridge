import { useRef, useState, useEffect, useCallback } from 'react';

// Maps 2-letter language code to standard Speech Recognition locale
export const LOCALE_MAP = {
  te: 'te-IN',
  hi: 'hi-IN',
  en: 'en-IN',
  ta: 'ta-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  mr: 'mr-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
};

export function useSpeechRecognition({
  language = 'te',
  isMuted = false,
  onSpeechFinal,
  onSpeechInterim,
  onSpeechStart,
  onSpeechEnd
}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [micError, setMicError] = useState(null);

  const recognitionRef = useRef(null);
  const pauseTimerRef = useRef(null);
  const activeTranscriptRef = useRef('');
  const shouldListenRef = useRef(false);
  const restartTimerRef = useRef(null);
  const lastFlushedRef = useRef({ text: '', time: 0 });
  const networkErrorCountRef = useRef(0);
  const isDestroyedRef = useRef(false);
  const micLockStreamRef = useRef(null); // Persistent hardware audio stream to prevent Windows/Chrome mic blinking

  // Keep callback refs stable across renders
  const onSpeechFinalRef = useRef(onSpeechFinal);
  onSpeechFinalRef.current = onSpeechFinal;
  const onSpeechInterimRef = useRef(onSpeechInterim);
  onSpeechInterimRef.current = onSpeechInterim;
  const onSpeechStartRef = useRef(onSpeechStart);
  onSpeechStartRef.current = onSpeechStart;
  const onSpeechEndRef = useRef(onSpeechEnd);
  onSpeechEndRef.current = onSpeechEnd;

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const langLocale = LOCALE_MAP[language.split('-')[0].toLowerCase()] || 'te-IN';
  const langLocaleRef = useRef(langLocale);
  langLocaleRef.current = langLocale;

  const flushTranscript = useCallback(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }

    const textToEmit = activeTranscriptRef.current.trim();
    if (textToEmit.length > 0) {
      // Anti-duplicate protection: Ignore identical or minor duplicate sub-strings within 2.5s
      const now = Date.now();
      const last = lastFlushedRef.current;
      if (
        last.text &&
        now - last.time < 2500 &&
        (textToEmit === last.text || (last.text.includes(textToEmit) && textToEmit.length <= last.text.length))
      ) {
        activeTranscriptRef.current = '';
        return;
      }

      lastFlushedRef.current = { text: textToEmit, time: now };
      activeTranscriptRef.current = '';
      if (onSpeechFinalRef.current) {
        onSpeechFinalRef.current(textToEmit);
      }
      if (onSpeechEndRef.current) {
        onSpeechEndRef.current();
      }
    }
  }, []);

  // Acquires and holds the physical mic stream open so Windows/Chrome never flashes the mic indicator off/on
  const acquireHardwareLock = useCallback(async () => {
    if (micLockStreamRef.current && micLockStreamRef.current.active) {
      return micLockStreamRef.current;
    }
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        micLockStreamRef.current = stream;
        return stream;
      }
    } catch (e) {
      console.warn('[SpeechRecognition] Hardware lock error:', e);
    }
    return null;
  }, []);

  // Internal helper to create and start recognition
  const startFreshRecognition = useCallback(async () => {
    if (isDestroyedRef.current || !shouldListenRef.current || isMutedRef.current) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    // Keep hardware microphone continuously active
    await acquireHardwareLock();

    // Clean up any existing instance first
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = langLocaleRef.current;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setMicError(null);
        networkErrorCountRef.current = 0;
      };

      recognition.onresult = (event) => {
        if (isMutedRef.current) return;
        setMicError(null);
        networkErrorCountRef.current = 0;

        let interimStr = '';
        let hasFinal = false;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            activeTranscriptRef.current += ' ' + transcriptPart;
            hasFinal = true;
          } else {
            interimStr += transcriptPart;
          }
        }

        if (onSpeechStartRef.current) {
          onSpeechStartRef.current();
        }

        if (onSpeechInterimRef.current && interimStr) {
          onSpeechInterimRef.current(interimStr);
        }

        if (pauseTimerRef.current) {
          clearTimeout(pauseTimerRef.current);
        }

        if (hasFinal) {
          pauseTimerRef.current = setTimeout(() => {
            flushTranscript();
          }, 350);
        } else if (interimStr && !activeTranscriptRef.current) {
          pauseTimerRef.current = setTimeout(() => {
            activeTranscriptRef.current = interimStr;
            flushTranscript();
          }, 1400);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }

        console.warn('[SpeechRecognition] warning/error:', event.error);

        if (event.error === 'not-allowed') {
          setIsListening(false);
          setMicError('Microphone permission is blocked. Please allow mic access in your browser or click Retry.');
        } else if (event.error === 'network') {
          networkErrorCountRef.current += 1;
          if (networkErrorCountRef.current >= 6) {
            setMicError('Network connection to speech server timed out. Reconnecting...');
          }
        }
      };

      recognition.onend = () => {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);

        if (!isDestroyedRef.current && shouldListenRef.current && !isMutedRef.current) {
          // Keep isListening as true so UI never flickers
          setIsListening(true);
          // Seamless instant restart on pause; mic hardware is locked on via micLockStream
          restartTimerRef.current = setTimeout(() => {
            if (!isDestroyedRef.current && shouldListenRef.current && !isMutedRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                startFreshRecognition();
              }
            }
          }, 50);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.warn('[SpeechRecognition] start error:', err);
      if (!isDestroyedRef.current && shouldListenRef.current && !isMutedRef.current) {
        restartTimerRef.current = setTimeout(() => {
          startFreshRecognition();
        }, 500);
      }
    }
  }, [flushTranscript, acquireHardwareLock]);

  const startListening = useCallback(() => {
    shouldListenRef.current = true;
    startFreshRecognition();
  }, [startFreshRecognition]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    flushTranscript();

    if (micLockStreamRef.current) {
      micLockStreamRef.current.getTracks().forEach((t) => t.stop());
      micLockStreamRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, [flushTranscript]);

  const retry = useCallback(async () => {
    setMicError(null);
    networkErrorCountRef.current = 0;
    try {
      if (micLockStreamRef.current) {
        micLockStreamRef.current.getTracks().forEach((t) => t.stop());
        micLockStreamRef.current = null;
      }
      await acquireHardwareLock();
    } catch (e) {
      console.warn('[retry] mic permission prompt failed:', e);
    }
    shouldListenRef.current = true;
    startFreshRecognition();
  }, [startFreshRecognition, acquireHardwareLock]);

  // Language changes
  useEffect(() => {
    if (shouldListenRef.current && !isMuted) {
      startFreshRecognition();
    }
  }, [langLocale, isMuted, startFreshRecognition]);

  // Handle mute changes: disable hardware tracks and recognition cleanly
  useEffect(() => {
    if (isMuted) {
      flushTranscript();
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);

      if (micLockStreamRef.current) {
        micLockStreamRef.current.getAudioTracks().forEach((t) => {
          t.enabled = false;
        });
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
      setIsListening(false);
    } else if (shouldListenRef.current) {
      if (micLockStreamRef.current) {
        micLockStreamRef.current.getAudioTracks().forEach((t) => {
          t.enabled = true;
        });
      }
      startFreshRecognition();
    }
  }, [isMuted, flushTranscript, startFreshRecognition]);

  // Cleanup on unmount
  useEffect(() => {
    isDestroyedRef.current = false;
    return () => {
      isDestroyedRef.current = true;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);

      if (micLockStreamRef.current) {
        micLockStreamRef.current.getTracks().forEach((t) => t.stop());
        micLockStreamRef.current = null;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.onstart = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch (e) {}
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    micError,
    startListening,
    stopListening,
    retry
  };
}
