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
  const [isSupported, setIsSupported] = useState(() => {
    if (typeof window === 'undefined') return true;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  });
  const [micError, setMicError] = useState(null);

  const recognitionRef = useRef(null);
  const pauseTimerRef = useRef(null);
  const activeTranscriptRef = useRef('');
  const latestInterimRef = useRef('');
  const shouldListenRef = useRef(false);
  const isStartingRef = useRef(false);
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
  const prevLangLocaleRef = useRef(langLocale);

  const flushTranscript = useCallback(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }

    const textToEmit = activeTranscriptRef.current.trim();
    latestInterimRef.current = '';
    if (textToEmit.length > 0) {
      // Anti-duplicate protection: Ignore identical or minor duplicate sub-strings within 1.2s
      const now = Date.now();
      const last = lastFlushedRef.current;
      if (
        last.text &&
        now - last.time < 1200 &&
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

  // Acquires and holds the physical mic stream open on desktop so Windows/Chrome never flashes the mic indicator
  const acquireHardwareLock = useCallback(async () => {
    // CRITICAL FIX FOR MOBILE:
    // On Android & iOS mobile devices, the OS audio HAL assigns exclusive microphone access to a single client.
    // Holding a background getUserMedia stream starves webkitSpeechRecognition of audio (feeding it zero bytes/silence).
    // Therefore, on mobile devices, we DO NOT hold a background getUserMedia stream.
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
    if (isMobile) {
      if (micLockStreamRef.current) {
        micLockStreamRef.current.getTracks().forEach((t) => t.stop());
        micLockStreamRef.current = null;
      }
      return null;
    }

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

    if (isStartingRef.current) {
      return;
    }
    isStartingRef.current = true;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      isStartingRef.current = false;
      return;
    }

    try {
      // Keep hardware microphone continuously active
      await acquireHardwareLock();

      // Guard: Check again after awaiting hardware lock
      if (isDestroyedRef.current || !shouldListenRef.current || isMutedRef.current) {
        setIsListening(false);
        return;
      }

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
          const item = event.results[i];
          if (!item || !item[0]) continue;
          const transcriptPart = item[0].transcript || '';
          if (item.isFinal) {
            activeTranscriptRef.current += ' ' + transcriptPart;
            hasFinal = true;
          } else {
            interimStr += transcriptPart;
          }
        }

        latestInterimRef.current = interimStr;

        if (onSpeechStartRef.current) {
          onSpeechStartRef.current();
        }

        if (onSpeechInterimRef.current && interimStr) {
          onSpeechInterimRef.current(interimStr);
        }

        if (pauseTimerRef.current) {
          clearTimeout(pauseTimerRef.current);
          pauseTimerRef.current = null;
        }

        if (hasFinal) {
          pauseTimerRef.current = setTimeout(() => {
            flushTranscript();
          }, 350);
        } else if (interimStr) {
          // Guard: Only flush unfinalized interim if silence persists for 2.0s
          // to avoid premature cut-offs and duplicate phrase emissions
          pauseTimerRef.current = setTimeout(() => {
            if (latestInterimRef.current && !activeTranscriptRef.current.trim()) {
              activeTranscriptRef.current = latestInterimRef.current;
              flushTranscript();
            }
          }, 2000);
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

        // Guarantee that speech spoken right before onend is never lost
        if (!activeTranscriptRef.current.trim() && latestInterimRef.current.trim()) {
          activeTranscriptRef.current = latestInterimRef.current.trim();
          latestInterimRef.current = '';
        }
        if (activeTranscriptRef.current.trim()) {
          flushTranscript();
        }

        if (!isDestroyedRef.current && shouldListenRef.current && !isMutedRef.current) {
          // Keep isListening as true so UI never flickers
          setIsListening(true);
          // Seamless restart on pause
          restartTimerRef.current = setTimeout(() => {
            if (!isDestroyedRef.current && shouldListenRef.current && !isMutedRef.current) {
              startFreshRecognition();
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
      recognitionRef.current = null;
      if (!isDestroyedRef.current && shouldListenRef.current && !isMutedRef.current) {
        restartTimerRef.current = setTimeout(() => {
          startFreshRecognition();
        }, 500);
      }
    } finally {
      isStartingRef.current = false;
    }
  }, [flushTranscript, acquireHardwareLock]);

  const startListening = useCallback(() => {
    shouldListenRef.current = true;
    startFreshRecognition();
  }, [startFreshRecognition]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    isStartingRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
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
      const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
      if (isMobile) {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          tempStream.getTracks().forEach((t) => t.stop());
        }
      } else {
        await acquireHardwareLock();
      }
    } catch (e) {
      console.warn('[retry] mic permission prompt failed:', e);
    }
    shouldListenRef.current = true;
    startFreshRecognition();
  }, [startFreshRecognition, acquireHardwareLock]);

  // Language changes: only re-initialize if locale actually changed
  useEffect(() => {
    if (prevLangLocaleRef.current !== langLocale) {
      prevLangLocaleRef.current = langLocale;
      if (shouldListenRef.current && !isMuted) {
        startFreshRecognition();
      }
    }
  }, [langLocale, isMuted, startFreshRecognition]);

  // Handle mute changes: disable hardware tracks and recognition cleanly
  useEffect(() => {
    if (isMuted) {
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
      activeTranscriptRef.current = '';
      latestInterimRef.current = '';
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);

      if (micLockStreamRef.current) {
        micLockStreamRef.current.getAudioTracks().forEach((t) => {
          t.enabled = false;
        });
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
    } else if (shouldListenRef.current) {
      if (micLockStreamRef.current) {
        micLockStreamRef.current.getAudioTracks().forEach((t) => {
          t.enabled = true;
        });
      }
      startFreshRecognition();
    }
  }, [isMuted, startFreshRecognition]);

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
