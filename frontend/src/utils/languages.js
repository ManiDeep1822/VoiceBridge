// Language definitions with BCP-47 STT codes, Native Names, and Edge-TTS voice mappings
// Clean ISO codes, zero emojis, zero artificial badges

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', stt: 'en-US', ttsVoice: 'en-US-JennyNeural', ttsGender: 'female', tag: 'USA' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', stt: 'hi-IN', ttsVoice: 'hi-IN-SwaraNeural', ttsGender: 'female', tag: 'IND' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', stt: 'te-IN', ttsVoice: 'te-IN-ShrutiNeural', ttsGender: 'female', tag: 'TEL' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', stt: 'ta-IN', ttsVoice: 'ta-IN-PallaviNeural', ttsGender: 'female', tag: 'TAM' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', stt: 'kn-IN', ttsVoice: 'kn-IN-SapnaNeural', ttsGender: 'female', tag: 'KAN' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', stt: 'ml-IN', ttsVoice: 'ml-IN-SobhanaNeural', ttsGender: 'female', tag: 'MAL' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', stt: 'mr-IN', ttsVoice: 'mr-IN-AarohiNeural', ttsGender: 'female', tag: 'MAR' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', stt: 'bn-IN', ttsVoice: 'bn-IN-TanishaaNeural', ttsGender: 'female', tag: 'BEN' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', stt: 'gu-IN', ttsVoice: 'gu-IN-DhwaniNeural', ttsGender: 'female', tag: 'GUJ' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', stt: 'pa-IN', ttsVoice: 'pa-IN-GurpreetNeural', ttsGender: 'female', tag: 'PUN' },
  { code: 'es', name: 'Spanish', native: 'Español', stt: 'es-ES', ttsVoice: 'es-ES-ElviraNeural', ttsGender: 'female', tag: 'ESP' },
  { code: 'de', name: 'German', native: 'Deutsch', stt: 'de-DE', ttsVoice: 'de-DE-KatjaNeural', ttsGender: 'female', tag: 'DEU' },
  { code: 'fr', name: 'French', native: 'Français', stt: 'fr-FR', ttsVoice: 'fr-FR-DeniseNeural', ttsGender: 'female', tag: 'FRA' },
  { code: 'ja', name: 'Japanese', native: '日本語', stt: 'ja-JP', ttsVoice: 'ja-JP-NanamiNeural', ttsGender: 'female', tag: 'JPN' },
  { code: 'zh', name: 'Mandarin Chinese', native: '中文', stt: 'zh-CN', ttsVoice: 'zh-CN-XiaoxiaoNeural', ttsGender: 'female', tag: 'CHN' },
  { code: 'ar', name: 'Arabic', native: 'العربية', stt: 'ar-SA', ttsVoice: 'ar-SA-ZariyahNeural', ttsGender: 'female', tag: 'SAU' },
  { code: 'ru', name: 'Russian', native: 'Русский', stt: 'ru-RU', ttsVoice: 'ru-RU-SvetlanaNeural', ttsGender: 'female', tag: 'RUS' },
  { code: 'pt', name: 'Portuguese', native: 'Português', stt: 'pt-BR', ttsVoice: 'pt-BR-FranciscaNeural', ttsGender: 'female', tag: 'BRA' },
  { code: 'it', name: 'Italian', native: 'Italiano', stt: 'it-IT', ttsVoice: 'it-IT-ElsaNeural', ttsGender: 'female', tag: 'ITA' },
  { code: 'ko', name: 'Korean', native: '한국어', stt: 'ko-KR', ttsVoice: 'ko-KR-SunHiNeural', ttsGender: 'female', tag: 'KOR' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands', stt: 'nl-NL', ttsVoice: 'nl-NL-ColetteNeural', ttsGender: 'female', tag: 'NLD' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe', stt: 'tr-TR', ttsVoice: 'tr-TR-EmelNeural', ttsGender: 'female', tag: 'TUR' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', stt: 'id-ID', ttsVoice: 'id-ID-GadisNeural', ttsGender: 'female', tag: 'IDN' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', stt: 'vi-VN', ttsVoice: 'vi-VN-HoaiMyNeural', ttsGender: 'female', tag: 'VNM' },
  { code: 'th', name: 'Thai', native: 'ไทย', stt: 'th-TH', ttsVoice: 'th-TH-PremwadeeNeural', ttsGender: 'female', tag: 'THA' },
  { code: 'pl', name: 'Polish', native: 'Polski', stt: 'pl-PL', ttsVoice: 'pl-PL-ZofiaNeural', ttsGender: 'female', tag: 'POL' },
  { code: 'sv', name: 'Swedish', native: 'Svenska', stt: 'sv-SE', ttsVoice: 'sv-SE-SofieNeural', ttsGender: 'female', tag: 'SWE' }
];

export function getLanguageMeta(code) {
  const normalized = (code || 'en').toLowerCase().trim();
  const match = SUPPORTED_LANGUAGES.find(l => l.code === normalized);
  if (match) return match;
  return {
    code: normalized,
    name: normalized.toUpperCase(),
    native: normalized.toUpperCase(),
    stt: normalized === 'en' ? 'en-US' : `${normalized}-${normalized.toUpperCase()}`,
    ttsVoice: 'en-US-JennyNeural',
    ttsGender: 'female',
    tag: normalized.toUpperCase().slice(0, 3)
  };
}

export const LOCALE_STRINGS = {
  te: {
    tapToSpeak: 'మాట్లాడటానికి నొక్కండి',
    tapWhenDone: 'పూర్తయింది — పంపండి',
    channelBusy: 'ఛానెల్ బిజీగా ఉంది (వేచి ఉండండి)',
    speakingNotice: 'మీరు మాట్లాడుతున్నారు... విడుదల చేస్తే వెంటనే పంపబడుతుంది',
    pttHelper: 'Hold to talk / పట్టుకుని మాట్లాడండి (Hold Spacebar or Tap)',
    peerSpeaking: 'అవతలి వ్యక్తి మాట్లాడుతున్నారు...',
    translatingLoud: 'అనువాదం పెద్దగా వినబడుతుంది...',
    readyYourTurn: 'ఇప్పుడు మీ వంతు — మాట్లాడండి',
    copyLink: 'కాల్ లింక్ కాపీ చేయండి',
    shareWhatsapp: 'వాట్సాప్‌లో షేర్ చేయండి',
    you: 'మీరు',
    peer: 'అవతలి వ్యక్తి',
    room: 'కాల్ రూమ్',
    testSound: 'వాయిస్ టెస్ట్ చేయండి',
    joinCall: 'కాల్ ప్రారంభించండి',
    nameLabel: 'మీ పేరు',
    languageLabel: 'మీ మాట్లాడే భాష'
  },
  hi: {
    tapToSpeak: 'बोलने के लिए दबाएं',
    tapWhenDone: 'पूरा हुआ — भेजें',
    channelBusy: 'चैनल व्यस्त है (कृपया प्रतीक्षा करें)',
    speakingNotice: 'आप बोल रहे हैं... छोड़ते ही तुरंत भेजा जाएगा',
    pttHelper: 'Hold to talk / दबाकर रखें (Hold Spacebar or Tap)',
    peerSpeaking: 'सामने वाला व्यक्ति बोल रहा है...',
    translatingLoud: 'अनुवाद ज़ोर से सुनाया जा रहा है...',
    readyYourTurn: 'अब आपकी बारी है — बोलिए',
    copyLink: 'कॉल लिंक कॉपी करें',
    shareWhatsapp: 'व्हाट्सएप पर शेयर करें',
    you: 'आप',
    peer: 'सामने वाला',
    room: 'कॉल रूम',
    testSound: 'आवाज़ चेक करें',
    joinCall: 'कॉल शुरू करें',
    nameLabel: 'आपका नाम',
    languageLabel: 'आपकी भाषा'
  },
  ta: {
    tapToSpeak: 'பேச அழுத்தவும்',
    tapWhenDone: 'முடிந்தது — அனுப்புக',
    channelBusy: 'சேனல் பிஸியாக உள்ளது (காத்திருங்கள்)',
    speakingNotice: 'நீங்கள் பேசுகிறீர்கள்... வெளியிட்டவுடன் அனுப்பப்படும்',
    pttHelper: 'அழுத்திப் பிடித்துப் பேசுங்கள் அல்லது தட்டவும்',
    peerSpeaking: 'மற்றவர் பேசுகிறார்...',
    translatingLoud: 'மொழிபெயர்ப்பு ஒலிக்கிறது...',
    readyYourTurn: 'இப்போது உங்கள் முறை — பேசுங்கள்',
    copyLink: 'இணைப்பை நகலெடு',
    shareWhatsapp: 'வாட்ஸ்அப்பில் பகிரவும்',
    you: 'நீங்கள்',
    peer: 'மற்றவர்',
    room: 'அறை',
    testSound: 'ஒலி சோதனை',
    joinCall: 'அழைப்பில் இணையுங்கள்',
    nameLabel: 'உங்கள் பெயர்',
    languageLabel: 'உங்கள் மொழி'
  },
  kn: {
    tapToSpeak: 'ಮಾತನಾಡಲು ಒತ್ತಿರಿ',
    tapWhenDone: 'ಮುಗಿದಿದೆ — ಕಳುಹಿಸಿ',
    channelBusy: 'ಚಾನಲ್ ಕಾರ್ಯನಿರತವಾಗಿದೆ',
    speakingNotice: 'ನೀವು ಮಾತನಾಡುತ್ತಿದ್ದೀರಿ...',
    pttHelper: 'ಹಿಡಿದು ಮಾತನಾಡಿ ಅಥವಾ ಒಮ್ಮೆ ಟ್ಯಾಪ್ ಮಾಡಿ',
    peerSpeaking: 'ಇನ್ನೊಬ್ಬರು ಮಾತನಾಡುತ್ತಿದ್ದಾರೆ...',
    translatingLoud: 'ಧ್ವನಿ ಪ್ಲೇ ಆಗುತ್ತಿದೆ...',
    readyYourTurn: 'ಈಗ ನಿಮ್ಮ ಸರದಿ',
    copyLink: 'ಲಿಂಕ್ ನಕಲಿಸಿ',
    shareWhatsapp: 'ವಾಟ್ಸಾಪ್‌ನಲ್ಲಿ ಹಂಚಿಕೊಳ್ಳಿ',
    you: 'ನೀವು',
    peer: 'ಇತರರು',
    room: 'ಕೋಣೆ',
    testSound: 'ಧ್ವನಿ ಪರೀಕ್ಷೆ',
    joinCall: 'ಕರೆಗೆ ಸೇರಿ',
    nameLabel: 'ನಿಮ್ಮ ಹೆಸರು',
    languageLabel: 'ನಿಮ್ಮ ಭಾಷೆ'
  },
  mr: {
    tapToSpeak: 'बोलण्यासाठी दाबा',
    tapWhenDone: 'झाले — पाठवा',
    channelBusy: 'चॅनेल व्यस्त आहे',
    speakingNotice: 'तुम्ही बोलत आहात...',
    pttHelper: 'दाबून धरा किंवा एकदा टॅप करा',
    peerSpeaking: 'समोरची व्यक्ती बोलत आहे...',
    translatingLoud: 'अनुवाद ऐकू येत आहे...',
    readyYourTurn: 'आता तुमची पाळी आहे',
    copyLink: 'कॉल लिंक कॉपी करा',
    shareWhatsapp: 'व्हॉट्सॲपवर शेअर करा',
    you: 'तुम्ही',
    peer: 'समोरची व्यक्ती',
    room: 'कॉल रूम',
    testSound: 'आवाज तपासा',
    joinCall: 'कॉल सुरू करा',
    nameLabel: 'तुमचे नाव',
    languageLabel: 'तुमची भाषा'
  },
  bn: {
    tapToSpeak: 'বলার জন্য চাপুন',
    tapWhenDone: 'সম্পন্ন — পাঠান',
    channelBusy: 'চ্যানেল ব্যস্ত',
    speakingNotice: 'আপনি কথা বলছেন...',
    pttHelper: 'চেপে ধরে কথা বলুন বা ট্যাপ করুন',
    peerSpeaking: 'অন্য প্রান্তের ব্যক্তি কথা বলছেন...',
    translatingLoud: 'অনুবাদ বাজানো হচ্ছে...',
    readyYourTurn: 'এখন আপনার বলার পালা',
    copyLink: 'কল লিংক কপি করুন',
    shareWhatsapp: 'হোয়াটসঅ্যাপে শেয়ার করুন',
    you: 'আপনি',
    peer: 'অপর ব্যক্তি',
    room: 'কল রুম',
    testSound: 'সাউন্ড টেস্ট',
    joinCall: 'কল শুরু করুন',
    nameLabel: 'আপনার নাম',
    languageLabel: 'আপনার ভাষা'
  },
  en: {
    tapToSpeak: 'Hold to Speak (Space)',
    tapWhenDone: 'Release to Send',
    channelBusy: 'Channel Busy (Please Wait)',
    speakingNotice: 'Transmitting live speech... Release to send',
    pttHelper: 'Hold Spacebar or Hold Button to Talk',
    peerSpeaking: 'Other person is speaking...',
    translatingLoud: 'Speaking translated voice out loud...',
    readyYourTurn: 'Your turn to speak',
    copyLink: 'Copy Link',
    shareWhatsapp: 'Share on WhatsApp',
    you: 'You',
    peer: 'Other Person',
    room: 'Room',
    testSound: 'Test Sound',
    joinCall: 'Join Call',
    nameLabel: 'Your Name',
    languageLabel: 'Your Language'
  }
};

export function getLocaleStrings(code) {
  const c = (code || 'en').toLowerCase().trim();
  return LOCALE_STRINGS[c] || LOCALE_STRINGS.en;
}
