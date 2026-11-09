import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  deduplicateTokens,
  removePhraseLoops,
  mergeStreamingTranscript
} from '../src/utils/transcriptDeduplicator.js';

describe('Real-Time Transcript Deduplication & Loop Breaker', () => {
  it('collapses consecutive single-word repeats', () => {
    assert.strictEqual(deduplicateTokens('hello hello'), 'hello');
    assert.strictEqual(deduplicateTokens('hello hello hello'), 'hello');
    assert.strictEqual(deduplicateTokens('I I am speaking speaking'), 'I am speaking');
    assert.strictEqual(deduplicateTokens('Yes yes YES'), 'Yes');
  });

  it('eliminates multi-word phrase loops caused by mobile re-evaluation', () => {
    assert.strictEqual(removePhraseLoops('can you hear me can you hear me'), 'can you hear me');
    assert.strictEqual(removePhraseLoops('how are you doing how are you doing today'), 'how are you doing today');
    assert.strictEqual(deduplicateTokens('hello world hello world hello world'), 'hello world');
  });

  it('merges overlapping streaming transcript chunks cleanly without duplicating prefixes', () => {
    // Exact duplicate
    assert.strictEqual(mergeStreamingTranscript('hello', 'hello'), 'hello');

    // Superset replacement
    assert.strictEqual(
      mergeStreamingTranscript('hello how', 'hello how are you'),
      'hello how are you'
    );

    // Suffix/prefix overlap
    assert.strictEqual(
      mergeStreamingTranscript('how are you', 'you doing well'),
      'how are you doing well'
    );

    // Non-overlapping continuation
    assert.strictEqual(
      mergeStreamingTranscript('Hello my friend.', 'How are you?'),
      'Hello my friend. How are you?'
    );
  });

  it('handles empty, null, and whitespace-only inputs safely', () => {
    assert.strictEqual(deduplicateTokens(''), '');
    assert.strictEqual(deduplicateTokens(null), '');
    assert.strictEqual(mergeStreamingTranscript('', 'hello'), 'hello');
    assert.strictEqual(mergeStreamingTranscript('hello', ''), 'hello');
  });
});
