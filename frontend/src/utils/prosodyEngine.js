/**
 * Zero-Latency Client-Side Prosody & Intent Classification Engine.
 * Normalizes colloquial contractions, detects communicative intent (Question, Exclamation, Statement),
 * and restores natural punctuation and pitch modulation for Web Speech API fallback.
 */

export const SLANG_MAP = {
  te: [
    [/(?<!\S)వస్తన్నా(?!\S)/gi, 'వస్తున్నాను'],
    [/(?<!\S)పోతాన్నా(?!\S)/gi, 'వెళ్తున్నాను'],
    [/(?<!\S)పోతావ్(?!\S)/gi, 'వెళ్తావు'],
    [/(?<!\S)ఎక్కడికిపోతావ్(?!\S)/gi, 'ఎక్కడికి వెళ్తున్నావు'],
    [/(?<!\S)ఏందీ(?!\S)/gi, 'ఏమిటి'],
    [/(?<!\S)ఎట్ల(?!\S)/gi, 'ఎలా'],
    [/(?<!\S)చెప్పుర్రి(?!\S)/gi, 'చెప్పండి'],
    [/(?<!\S)తిన్నావా(?!\S)/gi, 'తిన్నారా'],
    [/(?<!\S)వస్తావా(?!\S)/gi, 'వస్తారా'],
  ],
  hi: [
    [/(?<!\S)जा रिया(?!\S)/gi, 'जा रहे'],
    [/(?<!\S)बोल रिया(?!\S)/gi, 'बोल रहे'],
    [/(?<!\S)काइको(?!\S)/gi, 'क्यों'],
    [/(?<!\S)अपण(?!\S)/gi, 'हम'],
    [/(?<!\S)तेरेको(?!\S)/gi, 'आपको'],
    [/(?<!\S)मेरेको(?!\S)/gi, 'मुझे'],
  ],
  en: [
    [/\bgonna\b/gi, 'going to'],
    [/\bwanna\b/gi, 'want to'],
    [/\bgotta\b/gi, 'got to'],
    [/\bdunno\b/gi, 'do not know'],
    [/\bwhaddya\b/gi, 'what do you'],
    [/\bkinda\b/gi, 'kind of'],
    [/\bya\b/gi, 'you'],
    [/\br\b/gi, 'are'],
    [/\bu\b/gi, 'you'],
  ]
};

export const QUESTION_PATTERNS = {
  en: [
    /\b(?:who|what|when|where|why|how|which|whose|whom)\b/i,
    /^(?:is|are|am|was|were|can|could|would|will|shall|should|do|does|did|have|has|had|may|might|must)\b/i,
    /^(?:aren't|isn't|wasn't|weren't|can't|couldn't|won't|don't|doesn't|didn't)\b/i,
    /\b(?:right|correct|isn't it|aren't you|don't you|okay|ok)\s*$/i
  ],
  te: [
    /(?:^|[\s,.:;!?])(?:ఎవరు|ఎవరి|ఎవరికి|ఏమిటి|ఏంటి|ఎప్పుడు|ఎక్కడ|ఎక్కడి|ఎందుకు|ఎలా|ఎలాగ|ఏది|ఏవి|ఎన్ని|ఎంత)(?:[\s,.:;!?]|$)/i,
    /(?:ఉందా|లేదా|అవునా|కాదా|చేస్తారా|వస్తారా|వెళ్తారా|తెలుసా|విన్నారా|బాగున్నారా|వచ్చారా|చూశారా|కదా)\s*$/i,
    /[ఆఏఓ]\s*$/i
  ],
  hi: [
    /(?:^|[\s,.:;!?])(?:क्या|कौन|किसने|किसे|किसका|कब|कहाँ|किधर|क्यों|कैसे|कैसा|कैसी|कितना|कितने|कितनी)(?:[\s,.:;!?]|$)/i,
    /(?:है क्या|होगा क्या|चलेगा क्या|आओगे क्या|जाओगे क्या|है ना|ना)\s*$/i
  ],
  ta: [
    /(?:^|[\s,.:;!?])(?:யார்|என்ன|எப்போது|எங்கே|ஏன்|எப்படி|எவ்வளவு|எத்தனை|எது)(?:[\s,.:;!?]|$)/i,
    /(?:இருக்கா|வருவீங்களா|போவீங்களா|தெரியுமா|பாத்தீங்களா|ஆமாமா)\s*$/i
  ],
  kn: [
    /(?:^|[\s,.:;!?])(?:ಯಾರು|ಏನು|ಯಾವಾಗ|ಎಲ್ಲಿ|ಏಕೆ|ಹೇಗೆ|ಎಷ್ಟು|ಯಾವ)(?:[\s,.:;!?]|$)/i,
    /(?:ಇದೆಯಾ|ಬರ್ತೀರಾ|ಹೋಗ್ತೀರಾ|ಗೊತ್ತಾ)\s*$/i
  ],
  es: [
    /\b(?:qué|quién|quiénes|cuándo|dónde|por qué|cómo|cuál|cuáles|cuánto|cuánta)\b/i,
    /\b(?:verdad|cierto|no)\s*$/i
  ]
};

export const EXCLAMATION_PATTERNS = {
  en: [/\b(?:urgent|hurry|alert|danger|help|stop|emergency|look out|beware|wow|amazing|congratulations)\b/i],
  te: [/(?:^|[\s,.:;!?])(?:త్వరగా|వెంటనే|ఆగండి|సహాయం|జాగ్రత్త|అత్యవసరం|అద్భుతం|అయ్యో|బాబోయ్)(?:[\s,.:;!?]|$)/i],
  hi: [/(?:^|[\s,.:;!?])(?:जल्दी|तुरंत|रुको|बचाओ|सावधान|मदद|अरे वाह|अरे यार|शाबाश)(?:[\s,.:;!?]|$) /i],
  ta: [/(?:^|[\s,.:;!?])(?:சீக்கிரம்|உடனே|நில்லுங்கள்|காப்பாத்துங்க|ஆபத்து|அடடே)(?:[\s,.:;!?]|$)/i]
};

export function normalizeSpokenSlang(text, lang = 'en') {
  if (!text) return '';
  const cleanLang = (lang ? String(lang).split('-')[0].trim().toLowerCase() : '') || 'en';
  const rules = SLANG_MAP[cleanLang] || [];
  let result = text;
  for (const [regex, replacement] of rules) {
    result = result.replace(regex, replacement);
  }
  return result;
}

export function classifyAndPunctuateIntent(text, lang = 'en') {
  if (!text || !text.trim()) {
    return { punctuatedText: '', intent: 'statement' };
  }
  const clean = text.trim();
  const cleanLang = (lang ? String(lang).split('-')[0].trim().toLowerCase() : '') || 'en';

  if (clean.endsWith('?')) return { punctuatedText: clean, intent: 'question' };
  if (clean.endsWith('!')) return { punctuatedText: clean, intent: 'exclamation' };

  const cleanNoDot = clean.endsWith('.') ? clean.slice(0, -1).trim() : clean;

  const questionRules = QUESTION_PATTERNS[cleanLang] || QUESTION_PATTERNS.en;
  let isQuestion = questionRules.some(re => re.test(cleanNoDot));

  if (!isQuestion && cleanLang !== 'en') {
    isQuestion = QUESTION_PATTERNS.en.some(re => re.test(cleanNoDot));
  }

  if (isQuestion) {
    return { punctuatedText: `${cleanNoDot}?`, intent: 'question' };
  }

  const exclaimRules = EXCLAMATION_PATTERNS[cleanLang] || EXCLAMATION_PATTERNS.en;
  const isExclamation = exclaimRules.some(re => re.test(cleanNoDot));

  if (isExclamation) {
    return { punctuatedText: `${cleanNoDot}!`, intent: 'exclamation' };
  }

  return { punctuatedText: `${cleanNoDot}.`, intent: 'statement' };
}

export function enhanceConversationalText(text, lang = 'en') {
  const normalized = normalizeSpokenSlang(text, lang);
  return classifyAndPunctuateIntent(normalized, lang);
}

export function getProsodyParams(punctuatedText) {
  if (!punctuatedText) {
    return { rate: 1.05, pitch: 1.0 };
  }
  const trimmed = punctuatedText.trim();
  if (trimmed.endsWith('?')) {
    // Rising question inflection
    return { rate: 1.05, pitch: 1.18 };
  }
  if (trimmed.endsWith('!')) {
    // Emphatic exclamation
    return { rate: 1.08, pitch: 1.10 };
  }
  // Standard conversational declarative baseline
  return { rate: 1.05, pitch: 1.0 };
}
