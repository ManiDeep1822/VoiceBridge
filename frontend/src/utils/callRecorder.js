/**
 * Zero-Latency Continuous Call Audio Recording & Buffer Stitching Engine
 * Concatenates pure audio buffers back-to-back, stripping network round-trip pauses
 * and dead-air delays to produce broadcast-quality call records.
 */

// Helper to encode multi-channel Float32Array into 16-bit PCM WAV Blob
function encodeWAV(audioBuffers, sampleRate = 44100) {
  let totalLength = 0;
  for (const buf of audioBuffers) {
    totalLength += buf.length;
  }

  // Interleave / combine channel samples
  const result = new Float32Array(totalLength);
  let offset = 0;
  for (const buf of audioBuffers) {
    result.set(buf, offset);
    offset += buf.length;
  }

  // Create WAV header & PCM data
  const buffer = new ArrayBuffer(44 + result.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // file length minus RIFF identifier & length
  view.setUint32(4, 36 + result.length * 2, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 is PCM)
  view.setUint16(20, 1, true);
  // channel count (1 = mono)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * blockAlign)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channelCount * bytesPerSample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, result.length * 2, true);

  // Write PCM samples (clamped between -1 and 1)
  let index = 44;
  for (let i = 0; i < result.length; i++) {
    const s = Math.max(-1, Math.min(1, result[i]));
    view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    index += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

class CallRecorderSession {
  constructor() {
    this.isRecording = false;
    this.startTime = 0;
    this.segments = []; // { speaker, text, timestamp, pcmData }
    this.audioContext = null;
  }

  getAudioContext() {
    if ((!this.audioContext || this.audioContext.state === 'closed') && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx({ sampleRate: 44100 });
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  start() {
    this.isRecording = true;
    this.startTime = Date.now();
    this.segments = [];
    return true;
  }

  stop() {
    this.isRecording = false;
    return this.segments.length;
  }

  async addBase64AudioChunk(base64Audio, speaker = 'Remote Peer', text = '') {
    if (!this.isRecording || !base64Audio) return;

    try {
      const cleanBase64 = String(base64Audio).trim();
      const binaryString = atob(cleanBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const ctx = this.getAudioContext();
      if (!ctx) return;

      const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
      const channelData = audioBuffer.getChannelData(0); // Mono PCM

      // Add segment with pure synthesized audio
      this.segments.push({
        speaker,
        text,
        timestamp: Date.now(),
        pcmData: new Float32Array(channelData)
      });
    } catch (err) {
      console.warn('[CallRecorder] Failed to decode audio chunk:', err);
    }
  }

  addPcmChunk(pcmData, speaker = 'Local Caller', text = '') {
    if (!this.isRecording || !pcmData) return;
    this.segments.push({
      speaker,
      text,
      timestamp: Date.now(),
      pcmData: new Float32Array(pcmData)
    });
  }

  hasAudio() {
    return this.segments.length > 0;
  }

  exportStitchedWav() {
    if (this.segments.length === 0) return null;

    const ctx = this.getAudioContext();
    const sampleRate = ctx ? ctx.sampleRate : 44100;

    // Zero-latency buffer stitching:
    // Insert a tiny 80ms silence cushion between turns for natural conversational rhythm
    const silenceSamples = Math.floor(sampleRate * 0.08);
    const silenceBuffer = new Float32Array(silenceSamples);

    const buffersToConcatenate = [];
    for (let i = 0; i < this.segments.length; i++) {
      buffersToConcatenate.push(this.segments[i].pcmData);
      if (i < this.segments.length - 1) {
        buffersToConcatenate.push(silenceBuffer);
      }
    }

    return encodeWAV(buffersToConcatenate, sampleRate);
  }

  downloadRecording(filename = `VoiceBridge_Call_${Date.now()}.wav`) {
    const wavBlob = this.exportStitchedWav();
    if (!wavBlob) return null;

    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);

    return url;
  }
}

export const callRecorder = new CallRecorderSession();
