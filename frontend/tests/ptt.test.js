import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getLocaleStrings, LOCALE_STRINGS } from '../src/utils/languages.js';

describe('Strict Push-to-Talk (PTT) & Floor Lock Strings', () => {
  it('provides dual-script channel busy warnings across Indian and global languages', () => {
    const te = getLocaleStrings('te');
    assert.ok(te.channelBusy.includes('ఛానెల్ బిజీగా ఉంది'));
    assert.ok(te.pttHelper.includes('Hold'));

    const hi = getLocaleStrings('hi');
    assert.ok(hi.channelBusy.includes('चैनल व्यस्त है'));
    assert.ok(hi.pttHelper.includes('Hold'));

    const ta = getLocaleStrings('ta');
    assert.ok(ta.channelBusy.includes('சேனல் பிஸியாக உள்ளது'));

    const en = getLocaleStrings('en');
    assert.strictEqual(en.channelBusy, 'Channel Busy (Please Wait)');
    assert.ok(en.pttHelper.includes('Spacebar'));
  });

  it('contains PTT-optimized button labels across all registered locales', () => {
    for (const [code, dict] of Object.entries(LOCALE_STRINGS)) {
      assert.ok(dict.tapToSpeak, `Missing tapToSpeak for locale ${code}`);
      assert.ok(dict.tapWhenDone, `Missing tapWhenDone for locale ${code}`);
      assert.ok(dict.channelBusy, `Missing channelBusy for locale ${code}`);
      assert.ok(dict.pttHelper, `Missing pttHelper for locale ${code}`);
    }
  });
});
