/**
 * Real-Time Speech Transcript Deduplicator & Mobile Loop Breaker
 * Eliminates consecutive word repetitions, multi-word phrase loops, and
 * suffix/prefix overlaps caused by Android Chrome's Web Speech API implementation.
 */

/**
 * Removes immediate consecutive word repeats (e.g. "hello hello" -> "hello")
 * and multi-word phrase loops (e.g. "how are you how are you" -> "how are you").
 */
export function deduplicateTokens(text) {
  if (!text || typeof text !== 'string') return '';

  const trimmed = text.trim();
  if (!trimmed) return '';

  // 1. Remove consecutive single-word repeats (collapse 2+ identical adjacent words)
  const words = trimmed.split(/\s+/);
  const dedupedWords = [];
  for (let i = 0; i < words.length; i++) {
    const currentWord = words[i];
    const prevWord = dedupedWords[dedupedWords.length - 1];
    if (!prevWord || currentWord.toLowerCase() !== prevWord.toLowerCase()) {
      dedupedWords.push(currentWord);
    }
  }

  let cleaned = dedupedWords.join(' ');

  // 2. Remove multi-word phrase loops (e.g. "can you hear me can you hear me" -> "can you hear me")
  cleaned = removePhraseLoops(cleaned);

  return cleaned;
}

/**
 * Identifies and removes repeated phrase patterns of length 2 to N words.
 */
export function removePhraseLoops(text) {
  if (!text) return '';
  const words = text.split(/\s+/);
  if (words.length < 4) return text;

  let resultWords = [...words];

  // Check phrase lengths from half the length down to 2
  for (let phraseLen = Math.floor(resultWords.length / 2); phraseLen >= 2; phraseLen--) {
    let i = 0;
    while (i <= resultWords.length - 2 * phraseLen) {
      const phrase1 = resultWords.slice(i, i + phraseLen).map(w => w.toLowerCase()).join(' ');
      const phrase2 = resultWords.slice(i + phraseLen, i + 2 * phraseLen).map(w => w.toLowerCase()).join(' ');

      if (phrase1 === phrase2) {
        // Drop the redundant repeating phrase slice
        resultWords.splice(i + phraseLen, phraseLen);
      } else {
        i++;
      }
    }
  }

  return resultWords.join(' ');
}

/**
 * Merges a newly received speech recognition chunk with the existing accumulated transcript,
 * preventing Android Chrome from appending the entire sentence to itself.
 */
export function mergeStreamingTranscript(existingText, incomingChunk) {
  const cleanExisting = (existingText || '').trim();
  const cleanIncoming = (incomingChunk || '').trim();

  if (!cleanExisting) return cleanIncoming;
  if (!cleanIncoming) return cleanExisting;

  const existingLower = cleanExisting.toLowerCase();
  const incomingLower = cleanIncoming.toLowerCase();

  // 1. Exact duplicate
  if (existingLower === incomingLower) {
    return cleanExisting;
  }

  // 2. Incoming is a superset beginning with existing (Android Chrome full-result replacement)
  if (incomingLower.startsWith(existingLower)) {
    return cleanIncoming;
  }

  // 3. Existing already contains incoming at the end
  if (existingLower.endsWith(incomingLower)) {
    return cleanExisting;
  }

  // 4. Overlap detection (suffix of existing matching prefix of incoming)
  const existingWords = cleanExisting.split(/\s+/);
  const incomingWords = cleanIncoming.split(/\s+/);

  const maxOverlap = Math.min(existingWords.length, incomingWords.length);
  for (let overlap = maxOverlap; overlap > 0; overlap--) {
    const existingSuffix = existingWords.slice(existingWords.length - overlap).map(w => w.toLowerCase()).join(' ');
    const incomingPrefix = incomingWords.slice(0, overlap).map(w => w.toLowerCase()).join(' ');

    if (existingSuffix === incomingPrefix) {
      const nonOverlapping = incomingWords.slice(overlap);
      if (nonOverlapping.length === 0) {
        return cleanExisting;
      }
      return `${cleanExisting} ${nonOverlapping.join(' ')}`;
    }
  }

  // 5. Standard non-overlapping continuation
  return `${cleanExisting} ${cleanIncoming}`;
}
