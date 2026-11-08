import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { callRecorder } from '../src/utils/callRecorder.js';

describe('Zero-Latency Audio Recording & Buffer Stitching', () => {
  it('initializes recorder in stopped state with empty segments', () => {
    assert.strictEqual(callRecorder.isRecording, false);
    assert.strictEqual(callRecorder.segments.length, 0);
  });

  it('starts and stops recording session properly', () => {
    callRecorder.start();
    assert.strictEqual(callRecorder.isRecording, true);

    // Mock adding PCM chunks
    const mockPcm = new Float32Array([0.1, -0.2, 0.3, -0.4]);
    callRecorder.addPcmChunk(mockPcm, 'Caller 1', 'Hello there');

    assert.strictEqual(callRecorder.segments.length, 1);
    assert.strictEqual(callRecorder.segments[0].speaker, 'Caller 1');
    assert.strictEqual(callRecorder.segments[0].text, 'Hello there');

    const count = callRecorder.stop();
    assert.strictEqual(count, 1);
    assert.strictEqual(callRecorder.isRecording, false);
  });

  it('generates a valid WAV Blob upon stitching recorded segments', () => {
    callRecorder.start();
    const pcm1 = new Float32Array([0.05, 0.1, 0.15]);
    const pcm2 = new Float32Array([-0.1, -0.2, -0.3]);

    callRecorder.addPcmChunk(pcm1, 'User', 'Turn 1');
    callRecorder.addPcmChunk(pcm2, 'Peer', 'Turn 2');

    const wavBlob = callRecorder.exportStitchedWav();
    assert.ok(wavBlob, 'WAV blob should be generated');
    assert.strictEqual(wavBlob.type, 'audio/wav');
    assert.ok(wavBlob.size > 44, 'WAV blob must contain headers and PCM data');

    callRecorder.stop();
  });
});
