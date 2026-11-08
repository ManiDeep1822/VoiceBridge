import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  normalizeSpokenSlang,
  classifyAndPunctuateIntent,
  enhanceConversationalText,
  getProsodyParams
} from '../src/utils/prosodyEngine.js';

describe('Prosody & Zero-Latency Intent Engine (Client-Side)', () => {
  it('normalizes colloquial rural slangs in Telugu and English', () => {
    const rawTe = 'నేను రేపు వస్తన్నా';
    const cleanTe = normalizeSpokenSlang(rawTe, 'te');
    assert.ok(cleanTe.includes('వస్తున్నాను'));

    const rawEn = 'I wanna join cuz I gotta talk';
    const cleanEn = normalizeSpokenSlang(rawEn, 'en');
    assert.ok(cleanEn.includes('want to'));
    assert.ok(cleanEn.includes('got to'));
  });

  it('detects interrogative intent and appends question mark to questions', () => {
    const q1 = classifyAndPunctuateIntent('Where are you going', 'en');
    assert.strictEqual(q1.intent, 'question');
    assert.ok(q1.punctuatedText.endsWith('?'));

    const q2 = classifyAndPunctuateIntent('మీరు ఎప్పుడు వస్తారు', 'te');
    assert.strictEqual(q2.intent, 'question');
    assert.ok(q2.punctuatedText.endsWith('?'));

    const q3 = classifyAndPunctuateIntent('आप कहाँ जा रहे हैं', 'hi');
    assert.strictEqual(q3.intent, 'question');
    assert.ok(q3.punctuatedText.endsWith('?'));
  });

  it('detects exclamations and urgent phrases', () => {
    const ex1 = classifyAndPunctuateIntent('Help me urgently', 'en');
    assert.strictEqual(ex1.intent, 'exclamation');
    assert.ok(ex1.punctuatedText.endsWith('!'));
  });

  it('preserves declarative statements with standard period', () => {
    const st1 = classifyAndPunctuateIntent('The conference has commenced', 'en');
    assert.strictEqual(st1.intent, 'statement');
    assert.ok(st1.punctuatedText.endsWith('.'));
  });

  it('generates pitch elevation for questions and normalized constant speed', () => {
    const qParams = getProsodyParams('Are you available tomorrow?');
    assert.strictEqual(qParams.pitch, 1.18);
    assert.strictEqual(qParams.rate, 1.05);

    const stParams = getProsodyParams('Yes I will be there.');
    assert.strictEqual(stParams.pitch, 1.0);
    assert.strictEqual(stParams.rate, 1.05);
  });
});
