"""
Zero-Latency Local Prosody & Intent Classification Engine.
Analyzes transcribed speech across Indian and global languages, cleans regional slangs,
detects communicative intent (Question, Exclamation, Statement), and restores natural punctuation
so that neural speech synthesis models produce authentic human question intonation and feel.
Zero external APIs, 0ms execution time.
"""

import re
from typing import Tuple

# Common spoken slang & contraction dictionaries
# Uses (?<!\S) and (?!\S) instead of \b because Python \b fails on Indic vowel signs/combining marks.
SLANG_MAP = {
    "te": [
        (r'(?<!\S)వస్తన్నా(?!\S)', 'వస్తున్నాను'),
        (r'(?<!\S)పోతాన్నా(?!\S)', 'వెళ్తున్నాను'),
        (r'(?<!\S)పోతావ్(?!\S)', 'వెళ్తావు'),
        (r'(?<!\S)ఎక్కడికిపోతావ్(?!\S)', 'ఎక్కడికి వెళ్తున్నావు'),
        (r'(?<!\S)ఏందీ(?!\S)', 'ఏమిటి'),
        (r'(?<!\S)ఎట్ల(?!\S)', 'ఎలా'),
        (r'(?<!\S)చెప్పుర్రి(?!\S)', 'చెప్పండి'),
    ],
    "hi": [
        (r'(?<!\S)जा रिया(?!\S)', 'जा रहे'),
        (r'(?<!\S)बोल रिया(?!\S)', 'बोल रहे'),
        (r'(?<!\S)काइको(?!\S)', 'क्यों'),
        (r'(?<!\S)मेरेको(?!\S)', 'मुझे'),
    ],
    "en": [
        (r'\bgonna\b', 'going to'),
        (r'\bwanna\b', 'want to'),
        (r'\bgotta\b', 'got to'),
        (r'\bdunno\b', 'do not know'),
        (r'\bwhaddya\b', 'what do you'),
        (r'\bkinda\b', 'kind of'),
        (r'\bya\b', 'you'),
        (r'\br\b', 'are'),
        (r'\bu\b', 'you'),
    ]
}

# Interrogative keywords and patterns across languages
QUESTION_KEYWORDS = {
    "en": [
        r'\b(?:who|what|when|where|why|how|which|whose|whom)\b',
        r'^(?:is|are|am|was|were|can|could|would|will|shall|should|do|does|did|have|has|had|may|might|must)\b',
        r'^(?:aren\'t|isn\'t|wasn\'t|weren\'t|can\'t|couldn\'t|won\'t|don\'t|doesn\'t|didn\'t)\b',
        r'\b(?:right|correct|isn\'t it|aren\'t you|don\'t you|okay|ok)\s*$'
    ],
    "te": [
        r'(?:^|[\s,.:;!?])(?:ఎవరు|ఎవరి|ఎవరికి|ఎవరితో|ఎవరిది|ఏమిటి|ఏంటి|ఎప్పుడు|ఎప్పటికి|ఎక్కడ|ఎక్కడి|ఎక్కడికి|ఎక్కడినుంచి|ఎందుకు|ఎలా|ఎలాగ|ఏది|ఏవి|ఎన్ని|ఎంత)(?:[\s,.:;!?]|$)',
        r'(?:[వరదతటమయనస]ా|కదా|అవునా|కాదా|లేదా|ఉందా|తెలుసా|బాగున్నారా|బాగున్నావా|[ఆఏఓ])\s*$'
    ],
    "hi": [
        r'(?:^|[\s,.:;!?])(?:क्या|कौन|किसने|किसे|किसका|किसके|किससे|कब|कहाँ|किधर|क्यों|कैसे|कैसा|कैसी|कितना|कितने|कितनी)(?:[\s,.:;!?]|$)',
        r'(?:है क्या|होगा क्या|चलेगा क्या|आओगे क्या|जाओगे क्या|है ना|ना)\s*$'
    ],
    "ta": [
        r'(?:^|[\s,.:;!?])(?:யார்|என்ன|எப்போது|எங்கே|ஏன்|எப்படி|எவ்வளவு|எத்தனை|எது)(?:[\s,.:;!?]|$)',
        r'(?:இருக்கா|வருவீங்களா|போவீங்களா|தெரியுமா|பாத்தீங்களா|ஆமாமா)\s*$'
    ],
    "kn": [
        r'(?:^|[\s,.:;!?])(?:ಯಾರು|ಏನು|ಯಾವಾಗ|ಎಲ್ಲಿ|ಏಕೆ|ಹೇಗೆ|ಎಷ್ಟು|ಯಾವ)(?:[\s,.:;!?]|$)',
        r'(?:ಇದೆಯಾ|ಬರ್ತೀರಾ|ಹೋಗ್ತೀರಾ|ಗೊತ್ತಾ)\s*$'
    ],
    "es": [
        r'\b(?:qué|quién|quiénes|cuándo|dónde|por qué|cómo|cuál|cuáles|cuánto|cuánta)\b',
        r'\b(?:verdad|cierto|no)\s*$'
    ]
}

# Exclamatory / urgency keywords
EXCLAMATION_KEYWORDS = {
    "en": [r'\b(?:urgent|hurry|alert|danger|help|stop|emergency|look out|beware|wow|amazing|congratulations)\b'],
    "te": [r'(?:^|[\s,.:;!?])(?:త్వరగా|వెంటనే|ఆగండి|సహాయం|జాగ్రత్త|అత్యవసరం|అద్భుతం|అయ్యో|బాబోయ్)(?:[\s,.:;!?]|$)'],
    "hi": [r'(?:^|[\s,.:;!?])(?:जल्दी|तुरंत|रुको|बचाओ|सावधान|मदद|अरे वाह|अरे यार|शाबाश)(?:[\s,.:;!?]|$)'],
    "ta": [r'(?:^|[\s,.:;!?])(?:சீக்கிரம்|உடனே|நில்லுங்கள்|காப்பாத்துங்க|ஆபத்து|அடடே)(?:[\s,.:;!?]|$)']
}

def normalize_spoken_slang(text: str, lang: str = "en") -> str:
    """
    Cleanses regional slangs and oral spoken contractions into clean,
    standard conversational grammar before translation.
    """
    if not text:
        return ""
    
    clean_lang = (str(lang).split("-")[0].strip().lower() if lang else "") or "en"
    patterns = SLANG_MAP.get(clean_lang, [])
    
    result = text
    for regex, replacement in patterns:
        result = re.sub(regex, replacement, result, flags=re.IGNORECASE)
    
    return result

def classify_and_punctuate_intent(text: str, lang: str = "en") -> Tuple[str, str]:
    """
    Inspects raw transcribed speech (which usually lacks punctuation from STT),
    identifies communicative intent, and injects appropriate terminal punctuation ('?', '!', '.').
    
    Returns:
        (punctuated_text, intent) where intent is 'question' | 'exclamation' | 'statement'
    """
    if not text or not text.strip():
        return ("", "statement")
    
    clean = text.strip()
    clean_lang = (str(lang).split("-")[0].strip().lower() if lang else "") or "en"
    
    # If text already has terminal punctuation, determine intent from it
    if clean.endswith('?'):
        return (clean, "question")
    if clean.endswith('!'):
        return (clean, "exclamation")
    if clean.endswith('.'):
        clean_no_dot = clean[:-1].strip()
    else:
        clean_no_dot = clean

    # 1. Test for Interrogative Intent (Question)
    question_patterns = QUESTION_KEYWORDS.get(clean_lang, QUESTION_KEYWORDS["en"])
    is_question = False
    
    for pattern in question_patterns:
        if re.search(pattern, clean_no_dot, flags=re.IGNORECASE):
            is_question = True
            break
            
    # Also check universal English patterns as fallback
    if not is_question and clean_lang != "en":
        for pattern in QUESTION_KEYWORDS["en"]:
            if re.search(pattern, clean_no_dot, flags=re.IGNORECASE):
                is_question = True
                break

    if is_question:
        return (f"{clean_no_dot}?", "question")

    # 2. Test for Exclamatory / Urgency Intent
    exclaim_patterns = EXCLAMATION_KEYWORDS.get(clean_lang, EXCLAMATION_KEYWORDS["en"])
    is_exclamation = False
    
    for pattern in exclaim_patterns:
        if re.search(pattern, clean_no_dot, flags=re.IGNORECASE):
            is_exclamation = True
            break
            
    if is_exclamation:
        return (f"{clean_no_dot}!", "exclamation")

    # 3. Default to clean declarative statement
    return (f"{clean_no_dot}.", "statement")

def enhance_conversational_text(text: str, source_lang: str) -> Tuple[str, str]:
    """
    Pipeline step combining slang normalization and intent punctuation.
    """
    normalized = normalize_spoken_slang(text, source_lang)
    punctuated, intent = classify_and_punctuate_intent(normalized, source_lang)
    return (punctuated, intent)
