import { classifyAndPunctuateIntent } from '../../../frontend/src/utils/prosodyEngine.js';

const cases = [
  { text: 'जल्दी', lang: 'hi', expected: 'exclamation' },
  { text: 'तुरंत', lang: 'hi', expected: 'exclamation' },
  { text: 'रुको', lang: 'hi', expected: 'exclamation' },
  { text: 'मदद', lang: 'hi', expected: 'exclamation' },
  { text: 'बचाओ', lang: 'hi', expected: 'exclamation' },
  { text: 'सावधान', lang: 'hi', expected: 'exclamation' },
  { text: 'अरे वाह', lang: 'hi', expected: 'exclamation' },
  { text: 'अरे यार', lang: 'hi', expected: 'exclamation' },
  { text: 'शाबाश', lang: 'hi', expected: 'exclamation' },
  { text: 'यहाँ आओ जल्दी', lang: 'hi', expected: 'exclamation' },
  { text: 'जल्दी यहाँ आओ', lang: 'hi', expected: 'exclamation' },
  { text: 'रुको क्या हुआ?', lang: 'hi', expected: 'question' },
  { text: 'यह सामान्य वाक्य है', lang: 'hi', expected: 'statement' },
  { text: 'త్వరగా రండి', lang: 'te', expected: 'exclamation' },
  { text: 'Help immediately', lang: 'en', expected: 'exclamation' },
  { text: 'What is your name', lang: 'en', expected: 'question' }
];

let pass = true;
for (const c of cases) {
  const res = classifyAndPunctuateIntent(c.text, c.lang);
  const ok = res.intent === c.expected;
  console.log((ok ? 'PASS' : 'FAIL') + ': [' + c.lang + '] "' + c.text + '" => ' + res.intent + ' (' + res.punctuatedText + ')');
  if (!ok) pass = false;
}

if (!pass) {
  console.error('FAILED STRESS TEST');
  process.exit(1);
} else {
  console.log('ALL 16 STRESS CASES PASSED');
}
