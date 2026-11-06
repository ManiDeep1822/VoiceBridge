import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * useAudioQueue:
 * Sequential playback of Base64 MP3 chunks using the Web Audio API with volume amplification.
 * Guarantees that translated speech segments play consecutively without overlapping or cutting off.
 */
export function useAudioQueue({ onStartSpeaking, onStopSpeaking } = {}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1.5); // Default 1.5x volume boost!

  const audioContextRef = useRef(null);
  const queueRef = useRef([]);
  const isProcessingRef = useRef(false);
  const currentSourceRef = useRef(null);
  const analyserRef = useRef(null);
  const gainNodeRef = useRef(null);

  const onStartSpeakingRef = useRef(onStartSpeaking);
  onStartSpeakingRef.current = onStartSpeaking;
  const onStopSpeakingRef = useRef(onStopSpeaking);
  onStopSpeakingRef.current = onStopSpeaking;

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;

      const gainNode = ctx.createGain();
      gainNode.gain.value = volume; // 150% amplification by default

      // Pipeline: GainNode -> Analyser -> Destination
      gainNode.connect(analyser);
      analyser.connect(ctx.destination);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      gainNodeRef.current = gainNode;
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, [volume]);

  // Update hardware gain when user moves slider
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  const base64ToArrayBuffer = (base64) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const playNext = useCallback(async () => {
    if (queueRef.current.length === 0) {
      isProcessingRef.current = false;
      setIsPlaying(false);
      if (onStopSpeakingRef.current) onStopSpeakingRef.current();
      return;
    }

    isProcessingRef.current = true;
    setIsPlaying(true);
    if (onStartSpeakingRef.current) onStartSpeakingRef.current();

    const audioItem = queueRef.current.shift();
    const ctx = initAudioContext();

    try {
      const arrayBuffer = base64ToArrayBuffer(audioItem.base64);
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      // Route audio through amplified gain node
      if (gainNodeRef.current) {
        source.connect(gainNodeRef.current);
      } else if (analyserRef.current) {
        source.connect(analyserRef.current);
      } else {
        source.connect(ctx.destination);
      }

      currentSourceRef.current = source;

      source.onended = () => {
        playNext();
      };

      source.start(0);
    } catch (err) {
      console.error('[AudioQueue] Error decoding/playing audio buffer:', err);
      // Skip bad chunk and play next
      playNext();
    }
  }, [initAudioContext]);

  const enqueueAudio = useCallback((base64String, metadata = {}) => {
    if (!base64String) return;
    initAudioContext();
    queueRef.current.push({ base64: base64String, ...metadata });

    if (!isProcessingRef.current) {
      playNext();
    }
  }, [initAudioContext, playNext]);

  const stopAll = useCallback(() => {
    queueRef.current = [];
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (e) {
        // Ignored
      }
      currentSourceRef.current = null;
    }
    isProcessingRef.current = false;
    setIsPlaying(false);
    if (onStopSpeakingRef.current) onStopSpeakingRef.current();
  }, []);

  useEffect(() => {
    return () => {
      stopAll();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [stopAll]);

  return {
    enqueueAudio,
    isPlaying,
    volume,
    setVolume,
    stopAll,
    initAudioContext,
    analyser: analyserRef.current
  };
}
