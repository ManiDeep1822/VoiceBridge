import test from 'node:test';
import assert from 'node:assert/strict';

import { getLanguageMeta, SUPPORTED_LANGUAGES } from '../src/utils/languages.js';
import { applyGlossaryProtection, restoreGlossaryTerms, INDUSTRY_DOMAINS } from '../src/utils/glossaries.js';
import { translateTextFast } from '../src/utils/translator.js';

test('Language Utilities & Supported Dialects', async (t) => {
  await t.test('contains all essential global and Indian industrial languages', () => {
    assert.ok(SUPPORTED_LANGUAGES.length >= 25, 'Should support at least 25 languages');
    const codes = SUPPORTED_LANGUAGES.map(l => l.code);
    assert.ok(codes.includes('en'), 'Should support English');
    assert.ok(codes.includes('hi'), 'Should support Hindi');
    assert.ok(codes.includes('te'), 'Should support Telugu');
    assert.ok(codes.includes('es'), 'Should support Spanish');
    assert.ok(codes.includes('de'), 'Should support German');
    assert.ok(codes.includes('ja'), 'Should support Japanese');
  });

  await t.test('resolves language metadata with accurate BCP-47 and TTS identifiers', () => {
    const en = getLanguageMeta('en');
    assert.equal(en.stt, 'en-US');
    assert.equal(en.name, 'English');

    const hi = getLanguageMeta('hi');
    assert.equal(hi.stt, 'hi-IN');
    assert.equal(hi.native, 'हिन्दी');

    const te = getLanguageMeta('te');
    assert.equal(te.stt, 'te-IN');
    assert.equal(te.native, 'తెలుగు');
  });

  await t.test('gracefully fallbacks on unknown language code', () => {
    const unknown = getLanguageMeta('xyz');
    assert.equal(unknown.code, 'xyz');
    assert.ok(unknown.stt);
  });
});

test('Industry Domain Glossaries & Jargon Lock Engine', async (t) => {
  await t.test('provides all 6 industrial domains including Medical, Legal, FinTech and Defense', () => {
    assert.equal(INDUSTRY_DOMAINS.length, 6);
    const ids = INDUSTRY_DOMAINS.map(d => d.id);
    assert.ok(ids.includes('medical'));
    assert.ok(ids.includes('legal'));
    assert.ok(ids.includes('fintech'));
    assert.ok(ids.includes('defense'));
    assert.ok(ids.includes('engineering'));
  });

  await t.test('locks medical terms into preserved bracket tokens', () => {
    const raw = 'The patient had a sudden heart attack yesterday';
    const { processedText, lockedTerms } = applyGlossaryProtection(raw, 'medical');
    assert.ok(processedText.includes('[[myocardial infarction]]'), 'Should lock to myocardial infarction');
    assert.ok(lockedTerms.includes('myocardial infarction'));
  });

  await t.test('locks legal terms accurately', () => {
    const raw = 'The contract covers any unforeseen event';
    const { processedText, lockedTerms } = applyGlossaryProtection(raw, 'legal');
    assert.ok(processedText.includes('[[force majeure]]'), 'Should lock to force majeure');
    assert.ok(lockedTerms.includes('force majeure'));
  });

  await t.test('unpacks preserved glossary terms after translation', () => {
    const translatedWithBrackets = 'El paciente tuvo un [[myocardial infarction]] agudo';
    const restored = restoreGlossaryTerms(translatedWithBrackets);
    assert.equal(restored, 'El paciente tuvo un myocardial infarction agudo');
  });
});

test('Fast Translation Engine & Memory Cache', async (t) => {
  await t.test('returns original string immediately if source and target are identical', async () => {
    const result = await translateTextFast('Hello team', 'en', 'en');
    assert.equal(result, 'Hello team');
  });

  await t.test('returns empty string if input is empty or blank', async () => {
    const result = await translateTextFast('', 'en', 'es');
    assert.equal(result, '');
  });
});
