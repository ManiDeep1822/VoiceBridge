import pytest
try:
    from backend.services.prosody_engine import (
        normalize_spoken_slang,
        classify_and_punctuate_intent,
        enhance_conversational_text,
        deduplicate_phrase_loops,
    )
except ImportError:
    from services.prosody_engine import (
        normalize_spoken_slang,
        classify_and_punctuate_intent,
        enhance_conversational_text,
        deduplicate_phrase_loops,
    )

def test_normalize_spoken_slang_telugu():
    raw = "నేను రేపు వస్తన్నా"
    clean = normalize_spoken_slang(raw, "te")
    assert "వస్తున్నాను" in clean

    raw2 = "నువ్వు ఎక్కడికిపోతావ్"
    clean2 = normalize_spoken_slang(raw2, "te")
    assert "ఎక్కడికి వెళ్తున్నావు" in clean2

def test_normalize_spoken_slang_hindi():
    raw = "वो जा रिया है"
    clean = normalize_spoken_slang(raw, "hi")
    assert "जा रहे" in clean

    raw2 = "काइको बोल रिया"
    clean2 = normalize_spoken_slang(raw2, "hi")
    assert "क्यों" in clean2

def test_normalize_spoken_slang_english():
    raw = "I wanna go home cuz I gotta sleep"
    clean = normalize_spoken_slang(raw, "en")
    assert "want to" in clean
    assert "got to" in clean

def test_classify_and_punctuate_questions_english():
    punctuated, intent = classify_and_punctuate_intent("Where are you going", "en")
    assert intent == "question"
    assert punctuated.endswith("?")

    punctuated2, intent2 = classify_and_punctuate_intent("Can you hear me", "en")
    assert intent2 == "question"
    assert punctuated2.endswith("?")

    punctuated3, intent3 = classify_and_punctuate_intent("This is right, isn't it", "en")
    assert intent3 == "question"
    assert punctuated3.endswith("?")

def test_classify_and_punctuate_questions_telugu():
    punctuated, intent = classify_and_punctuate_intent("మీరు ఎప్పుడు వస్తారు", "te")
    assert intent == "question"
    assert punctuated.endswith("?")

    punctuated2, intent2 = classify_and_punctuate_intent("మీరు బాగున్నారా", "te")
    assert intent2 == "question"
    assert punctuated2.endswith("?")

    punctuated3, intent3 = classify_and_punctuate_intent("ఇది అవునా", "te")
    assert intent3 == "question"
    assert punctuated3.endswith("?")

def test_classify_and_punctuate_questions_hindi():
    punctuated, intent = classify_and_punctuate_intent("आप कहाँ जा रहे हैं", "hi")
    assert intent == "question"
    assert punctuated.endswith("?")

    punctuated2, intent2 = classify_and_punctuate_intent("आप कल आओगे क्या", "hi")
    assert intent2 == "question"
    assert punctuated2.endswith("?")

def test_classify_and_punctuate_exclamations():
    punctuated, intent = classify_and_punctuate_intent("Help me immediately", "en")
    assert intent == "exclamation"
    assert punctuated.endswith("!")

    punctuated2, intent2 = classify_and_punctuate_intent("త్వరగా రండి", "te")
    assert intent2 == "exclamation"
    assert punctuated2.endswith("!")

def test_classify_and_punctuate_statements():
    punctuated, intent = classify_and_punctuate_intent("I am working on the project", "en")
    assert intent == "statement"
    assert punctuated.endswith(".")

def test_enhance_conversational_text():
    enhanced, intent = enhance_conversational_text("నువ్వు ఎక్కడికిపోతావ్", "te")
    assert intent == "question"
    assert "ఎక్కడికి వెళ్తున్నావు" in enhanced
    assert enhanced.endswith("?")

def test_deduplicate_phrase_loops():
    raw_repeated = "hello hello hello how are you how are you"
    clean = deduplicate_phrase_loops(raw_repeated)
    assert clean == "hello how are you"

    raw_single = "testing testing one two"
    clean_single = deduplicate_phrase_loops(raw_single)
    assert clean_single == "testing one two"
