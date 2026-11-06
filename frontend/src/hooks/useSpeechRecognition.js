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

  // Internal helper to create and start a fresh recognition instance
  const startFreshRecognition = useCallback(() => {
    if (isDestroyedRef.current || !shouldListenRef.current || isMutedRef.current) {
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
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
          // Complete thought marked final: wait 350ms to catch immediate follow-up clause, then flush once
          pauseTimerRef.current = setTimeout(() => {
            flushTranscript();
          }, 350);
        } else if (interimStr && !activeTranscriptRef.current) {
          // Fallback only if speaker went completely silent for over 1.4s without browser marking final
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
          // Google STT cloud server drops continuous socket after idle silence.
          // This is standard Chromium behavior, NOT a permanent fatal offline state!
          networkErrorCountRef.current += 1;
          if (networkErrorCountRef.current >= 5) {
            setMicError('Network connection to speech server timed out. Reconnecting...');
          }
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);

        if (!isDestroyedRef.current && shouldListenRef.current && !isMutedRef.current) {
          // Silent automatic recovery with a brief backoff
          const delay = networkErrorCountRef.current > 0 ? 800 : 350;
          restartTimerRef.current = setTimeout(() => {
            startFreshRecognition();
          }, delay);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.warn('[SpeechRecognition] start error:', err);
      // If start failed (e.g. browser busy), try again once shortly
      if (!isDestroyedRef.current && shouldListenRef.current && !isMutedRef.current) {
        restartTimerRef.current = setTimeout(() => {
          startFreshRecognition();
        }, 1000);
      }
    }
  }, [flushTranscript]);

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

  // Explicit user-triggered retry function for permission recovery
  const retry = useCallback(async () => {
    setMicError(null);
    networkErrorCountRef.current = 0;
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch (e) {
      console.warn('[retry] mic permission prompt failed:', e);
    }
    shouldListenRef.current = true;
    startFreshRecognition();
  }, [startFreshRecognition]);

  // Re-start recognition when language changes
  useEffect(() => {
    if (shouldListenRef.current && !isMuted) {
      startFreshRecognition();
    }
  }, [langLocale, isMuted, startFreshRecognition]);

  // Handle mute changes
  useEffect(() => {
    if (isMuted) {
      flushTranscript();
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
      setIsListening(false);
    } else if (shouldListenRef.current) {
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
