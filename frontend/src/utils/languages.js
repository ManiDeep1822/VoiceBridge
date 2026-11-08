// Industrial language definitions with BCP-47 STT codes, Native Names, and Edge-TTS voice mappings

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', stt: 'en-US', ttsVoice: 'en-US-JennyNeural', ttsGender: 'female', flag: '🇺🇸', tag: 'USA' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', stt: 'hi-IN', ttsVoice: 'hi-IN-SwaraNeural', ttsGender: 'female', flag: '🇮🇳', tag: 'IND' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', stt: 'te-IN', ttsVoice: 'te-IN-ShrutiNeural', ttsGender: 'female', flag: '🇮🇳', tag: 'TEL' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', stt: 'ta-IN', ttsVoice: 'ta-IN-PallaviNeural', ttsGender: 'female', flag: '🇮🇳', tag: 'TAM' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', stt: 'kn-IN', ttsVoice: 'kn-IN-SapnaNeural', ttsGender: 'female', flag: '🇮🇳', tag: 'KAN' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', stt: 'ml-IN', ttsVoice: 'ml-IN-SobhanaNeural', ttsGender: 'female', flag: '🇮🇳', tag: 'MAL' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', stt: 'mr-IN', ttsVoice: 'mr-IN-AarohiNeural', ttsGender: 'female', flag: '🇮🇳', tag: 'MAR' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', stt: 'bn-IN', ttsVoice: 'bn-IN-TanishaaNeural', ttsGender: 'female', flag: '🇮🇳', tag: 'BEN' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', stt: 'gu-IN', ttsVoice: 'gu-IN-DhwaniNeural', ttsGender: 'female', flag: '🇮🇳', tag: 'GUJ' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', stt: 'pa-IN', ttsVoice: 'pa-IN-GurpreetNeural', ttsGender: 'female', flag: '🇮🇳', tag: 'PUN' },
  { code: 'es', name: 'Spanish', native: 'Español', stt: 'es-ES', ttsVoice: 'es-ES-ElviraNeural', ttsGender: 'female', flag: '🇪🇸', tag: 'ESP' },
  { code: 'de', name: 'German', native: 'Deutsch', stt: 'de-DE', ttsVoice: 'de-DE-KatjaNeural', ttsGender: 'female', flag: '🇩🇪', tag: 'DEU' },
  { code: 'fr', name: 'French', native: 'Français', stt: 'fr-FR', ttsVoice: 'fr-FR-DeniseNeural', ttsGender: 'female', flag: '🇫🇷', tag: 'FRA' },
  { code: 'ja', name: 'Japanese', native: '日本語', stt: 'ja-JP', ttsVoice: 'ja-JP-NanamiNeural', ttsGender: 'female', flag: '🇯🇵', tag: 'JPN' },
  { code: 'zh', name: 'Mandarin Chinese', native: '中文', stt: 'zh-CN', ttsVoice: 'zh-CN-XiaoxiaoNeural', ttsGender: 'female', flag: '🇨🇳', tag: 'CHN' },
  { code: 'ar', name: 'Arabic', native: 'العربية', stt: 'ar-SA', ttsVoice: 'ar-SA-ZariyahNeural', ttsGender: 'female', flag: '🇸🇦', tag: 'SAU' },
  { code: 'ru', name: 'Russian', native: 'Русский', stt: 'ru-RU', ttsVoice: 'ru-RU-SvetlanaNeural', ttsGender: 'female', flag: '🇷🇺', tag: 'RUS' },
  { code: 'pt', name: 'Portuguese', native: 'Português', stt: 'pt-BR', ttsVoice: 'pt-BR-FranciscaNeural', ttsGender: 'female', flag: '🇧🇷', tag: 'BRA' },
  { code: 'it', name: 'Italian', native: 'Italiano', stt: 'it-IT', ttsVoice: 'it-IT-ElsaNeural', ttsGender: 'female', flag: '🇮🇹', tag: 'ITA' },
  { code: 'ko', name: 'Korean', native: '한국어', stt: 'ko-KR', ttsVoice: 'ko-KR-SunHiNeural', ttsGender: 'female', flag: '🇰🇷', tag: 'KOR' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands', stt: 'nl-NL', ttsVoice: 'nl-NL-ColetteNeural', ttsGender: 'female', flag: '🇳🇱', tag: 'NLD' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe', stt: 'tr-TR', ttsVoice: 'tr-TR-EmelNeural', ttsGender: 'female', flag: '🇹🇷', tag: 'TUR' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', stt: 'id-ID', ttsVoice: 'id-ID-GadisNeural', ttsGender: 'female', flag: '🇮🇩', tag: 'IDN' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', stt: 'vi-VN', ttsVoice: 'vi-VN-HoaiMyNeural', ttsGender: 'female', flag: '🇻🇳', tag: 'VNM' },
  { code: 'th', name: 'Thai', native: 'ไทย', stt: 'th-TH', ttsVoice: 'th-TH-PremwadeeNeural', ttsGender: 'female', flag: '🇹🇭', tag: 'THA' },
  { code: 'pl', name: 'Polish', native: 'Polski', stt: 'pl-PL', ttsVoice: 'pl-PL-ZofiaNeural', ttsGender: 'female', flag: '🇵🇱', tag: 'POL' },
  { code: 'sv', name: 'Swedish', native: 'Svenska', stt: 'sv-SE', ttsVoice: 'sv-SE-SofieNeural', ttsGender: 'female', flag: '🇸🇪', tag: 'SWE' }
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
    flag: '🌐',
    tag: normalized.toUpperCase().slice(0, 3)
  };
}

export const LOCALE_STRINGS = {
  te: {
    tapToSpeak: 'మాట్లాడటానికి నొక్కండి (PTT)',
    tapWhenDone: 'పూర్తయింది — పంపండి (0ms)',
    channelBusy: 'ఛానెల్ బిజీగా ఉంది (వేచి ఉండండి)',
    speakingNotice: 'మీరు మాట్లాడుతున్నారు... విడుదల చేస్తే లేదా నొక్కితే వెంటనే పంపబడుతుంది',
    pttHelper: 'నొక్కి పట్టుకుని మాట్లాడండి (Hold) లేదా ఒకసారి నొక్కి మాట్లాడండి (Tap)',
    peerSpeaking: 'అవతలి వ్యక్తి మాట్లాడుతున్నారు...',
    translatingLoud: 'అనువాదం పెద్దగా వినబడుతుంది...',
    readyYourTurn: 'ఇప్పుడు మీ వంతు — మాట్లాడండి',
    copyLink: 'కాల్ లింక్ కాపీ చేయండి',
    shareWhatsapp: 'వాట్సాప్‌లో షేర్ చేయండి',
    you: 'మీరు (You)',
    peer: 'అవతలి వ్యక్తి (Peer)',
    room: 'కాల్ రూమ్',
    testSound: 'వాయిస్ టెస్ట్ చేయండి',
    joinCall: 'కాల్ ప్రారంభించండి',
    nameLabel: 'మీ పేరు (Your Name)',
    languageLabel: 'మీ మాట్లాడే భాష (Your Language)'
  },
  hi: {
    tapToSpeak: 'बोलने के लिए दबाएं (PTT)',
    tapWhenDone: 'पूरा हुआ — भेजें (0ms)',
    channelBusy: 'चैनल व्यस्त है (कृपया प्रतीक्षा करें)',
    speakingNotice: 'आप बोल रहे हैं... छोड़ते ही या दबाते ही तुरंत भेजा जाएगा',
    pttHelper: 'दबाकर रखें (Hold) या एक बार दबाकर बोलें (Tap)',
    peerSpeaking: 'सामने वाला व्यक्ति बोल रहा है...',
    translatingLoud: 'अनुवाद ज़ोर से सुनाया जा रहा है...',
    readyYourTurn: 'अब आपकी बारी है — बोलिए',
    copyLink: 'कॉल लिंक कॉपी करें',
    shareWhatsapp: 'व्हाट्सएप पर शेयर करें',
    you: 'आप (You)',
    peer: 'सामने वाला (Peer)',
    room: 'कॉल रूम',
    testSound: 'आवाज़ चेक करें',
    joinCall: 'कॉल शुरू करें',
    nameLabel: 'आपका नाम (Your Name)',
    languageLabel: 'आपकी भाषा (Your Language)'
  },
  ta: {
    tapToSpeak: 'பேச அழுத்தவும் (PTT)',
    tapWhenDone: 'முடிந்தது — அனுப்புக (0ms)',
    channelBusy: 'சேனல் பிஸியாக உள்ளது (காத்திருங்கள்)',
    speakingNotice: 'நீங்கள் பேசுகிறீர்கள்... வெளியிட்டவுடன் உடனடியாக அனுப்பப்படும்',
    pttHelper: 'அழுத்திப் பிடித்துப் பேசுங்கள் (Hold) அல்லது ஒருமுறை தட்டவும் (Tap)',
    peerSpeaking: 'மற்றவர் பேசுகிறார்...',
    translatingLoud: 'மொழிபெயர்ப்பு ஒலிக்கிறது...',
    readyYourTurn: 'இப்போது உங்கள் முறை — பேசுங்கள்',
    copyLink: 'இணைப்பை நகலெடு',
    shareWhatsapp: 'வாட்ஸ்அப்பில் பகிரவும்',
    you: 'நீங்கள் (You)',
    peer: 'மற்றவர் (Peer)',
    room: 'அறை',
    testSound: 'ஒலி சோதனை',
    joinCall: 'அழைப்பில் இணையுங்கள்',
    nameLabel: 'உங்கள் பெயர் (Your Name)',
    languageLabel: 'உங்கள் மொழி (Your Language)'
  },
  kn: {
    tapToSpeak: 'ಮಾತನಾಡಲು ಒತ್ತಿರಿ (PTT)',
    tapWhenDone: 'ಮುಗಿದಿದೆ — ಕಳುಹಿಸಿ (0ms)',
    channelBusy: 'ಚಾನೆಲ್ ನಿರತವಾಗಿದೆ (ದಯವಿಟ್ಟು ಕಾಯಿರಿ)',
    speakingNotice: 'ನೀವು ಮಾತನಾಡುತ್ತಿದ್ದೀರಿ... ಬಿಟ್ಟ ತಕ್ಷಣ ಕಳುಹಿಸಲಾಗುತ್ತದೆ',
    pttHelper: 'ಹಿಡಿದುಕೊಂಡು ಮಾತನಾಡಿ (Hold) ಅಥವಾ ಒಮ್ಮೆ ಒತ್ತಿ (Tap)',
    peerSpeaking: 'ಇನ್ನೊಬ್ಬರು ಮಾತನಾಡುತ್ತಿದ್ದಾರೆ...',
    translatingLoud: 'ಅನುವಾದ ಧ್ವನಿ ಕೇಳುತ್ತಿದೆ...',
    readyYourTurn: 'ಈಗ ನಿಮ್ಮ ಸರದಿ — ಮಾತನಾಡಿ',
    copyLink: 'ಲಿಂಕ್ ನಕಲಿಸಿ',
    shareWhatsapp: 'ವಾಟ್ಸಾಪ್‌ನಲ್ಲಿ ಹಂಚಿಕೊಳ್ಳಿ',
    you: 'ನೀವು (You)',
    peer: 'ಇನ್ನೊಬ್ಬರು (Peer)',
    room: 'ಕೋಣೆ',
    testSound: 'ಧ್ವನಿ ಪರೀಕ್ಷೆ',
    joinCall: 'ಕರೆ ಪ್ರಾರಂಭಿಸಿ',
    nameLabel: 'ನಿಮ್ಮ ಹೆಸರು (Your Name)',
    languageLabel: 'ನಿಮ್ಮ ಭಾಷೆ (Your Language)'
  },
  mr: {
    tapToSpeak: 'बोलण्यासाठी दाबा (PTT)',
    tapWhenDone: 'झाले — पाठवा (0ms)',
    channelBusy: 'चॅनेल व्यस्त आहे (कृपया थांबा)',
    speakingNotice: 'तुम्ही बोलत आहात... सोडताच लगेच पाठवले जाईल',
    pttHelper: 'दाबून धरा (Hold) किंवा एकदा टॅप करा (Tap)',
    peerSpeaking: 'समोरची व्यक्ती बोलत आहे...',
    translatingLoud: 'अनुवाद मोठ्या आवाजात ऐकू येत आहे...',
    readyYourTurn: 'आता तुमची पाळी आहे',
    copyLink: 'कॉल लिंक कॉपी करा',
    shareWhatsapp: 'व्हॉટ્સॲपवर शेअर करा',
    you: 'तुम्ही (You)',
    peer: 'समोरची व्यक्ती (Peer)',
    room: 'कॉल रूम',
    testSound: 'आवाज तपासा',
    joinCall: 'कॉल सुरू करा',
    nameLabel: 'तुमचे नाव (Your Name)',
    languageLabel: 'तुमची भाषा (Your Language)'
  },
  bn: {
    tapToSpeak: 'বলার জন্য চাপুন (PTT)',
    tapWhenDone: 'সম্পন্ন — পাঠান (0ms)',
    channelBusy: 'চ্যানেল ব্যস্ত (অনুগ্রহ করে অপেক্ষা করুন)',
    speakingNotice: 'আপনি কথা বলছেন... ছেড়ে দিলেই সঙ্গে সঙ্গে পাঠানো হবে',
    pttHelper: 'চেপে ধরে কথা বলুন (Hold) বা একবার ট্যাপ করুন (Tap)',
    peerSpeaking: 'অন্য প্রান্তের ব্যক্তি কথা বলছেন...',
    translatingLoud: 'অনুবাদ জোরে বাজানো হচ্ছে...',
    readyYourTurn: 'এখন আপনার বলার পালা',
    copyLink: 'কল লিংক কপি করুন',
    shareWhatsapp: 'হোয়াটসঅ্যাপে শেয়ার করুন',
    you: 'আপনি (You)',
    peer: 'অপর ব্যক্তি (Peer)',
    room: 'কল রুম',
    testSound: 'সাউন্ড টেস্ট',
    joinCall: 'কল শুরু করুন',
    nameLabel: 'আপনার নাম (Your Name)',
    languageLabel: 'আপনার ভাষা (Your Language)'
  },
  en: {
    tapToSpeak: 'Push to Talk (PTT)',
    tapWhenDone: 'Done — Send (0ms)',
    channelBusy: 'Channel Busy (Please Wait)',
    speakingNotice: 'Transmitting live speech... Release or tap to send immediately (0ms)',
    pttHelper: 'Hold to Talk or Tap once to Speak / Spacebar',
    peerSpeaking: 'Other person is speaking...',
    translatingLoud: 'Speaking translated voice out loud...',
    readyYourTurn: 'Channel Clear — Your Turn to Speak',
    copyLink: 'Copy Call Link',
    shareWhatsapp: 'Share on WhatsApp',
    you: 'You',
    peer: 'Other Person',
    room: 'Call Room',
    testSound: 'Test Sound',
    joinCall: 'Join Call Now',
    nameLabel: 'Your Name',
    languageLabel: 'Your Spoken Language'
  }
};

export function getLocaleStrings(code) {
  const c = (code || 'en').toLowerCase().trim();
  return LOCALE_STRINGS[c] || LOCALE_STRINGS.en;
}
