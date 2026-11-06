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

  const startListening = useCallback(() => {
    shouldListenRef.current = true;
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      // Ignored if already started
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    flushTranscript();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);
  }, [flushTranscript]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = langLocale;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      if (isMutedRef.current) return;

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

      // Live interim text display only (does NOT prematurely flush audio)
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
      if (event.error === 'no-speech') {
        return;
      }
      console.warn('[SpeechRecognition] error:', event.error);
      if (event.error === 'not-allowed') {
        setMicError('Microphone permission is blocked. Please allow mic access in your browser address bar.');
      } else if (event.error === 'network') {
        setMicError('Speech recognition requires an internet connection for regional language packs.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      // Auto-restart safely with delay to prevent CPU lockups
      if (shouldListenRef.current && !isMutedRef.current) {
        restartTimerRef.current = setTimeout(() => {
          if (shouldListenRef.current && !isMutedRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
              setIsListening(true);
            } catch (err) {}
          }
        }, 350);
      }
    };

    recognitionRef.current = recognition;

    if (shouldListenRef.current && !isMutedRef.current) {
      try {
        recognition.start();
        setIsListening(true);
      } catch (e) {}
    }

    return () => {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      try {
        recognition.stop();
      } catch (e) {}
    };
  }, [langLocale, flushTranscript]);

  // Handle mute changes
  useEffect(() => {
    if (isMuted) {
      flushTranscript();
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setIsListening(false);
    } else if (shouldListenRef.current) {
      startListening();
    }
  }, [isMuted, flushTranscript, startListening]);

  return {
    isListening,
    isSupported,
    micError,
    startListening,
    stopListening
  };
}
