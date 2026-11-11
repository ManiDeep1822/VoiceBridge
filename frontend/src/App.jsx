import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/Navigation/Navbar';
import { CallStudio } from './components/CallStudio/CallStudio';
import { PreJoinLobby } from './components/CallStudio/PreJoinLobby';
import { UserDashboard } from './components/UserDashboard/UserDashboard';
import { AdminDashboard } from './components/AdminDashboard/AdminDashboard';
import { SettingsModal } from './components/Settings/SettingsModal';
import { MonetizationModal } from './components/MonetizationModal';
import { MinutesDrawer } from './components/MinutesDrawer';
import { GlossaryDrawer } from './components/GlossaryDrawer';
import { UserLogin } from './components/Auth/UserLogin';
import { AdminLogin } from './components/Auth/AdminLogin';

import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import { useWebRTC } from './hooks/useWebRTC';
import { translateTextFast } from './utils/translator';
import { getLanguageMeta } from './utils/languages';
import { callRecorder } from './utils/callRecorder';
import { deduplicateTokens } from './utils/transcriptDeduplicator';
import { determineBackendUrl } from './utils/backendUrl';

export default function App() {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState('studio'); // 'studio' | 'user-dashboard' | 'admin-dashboard'
  const [hasJoinedMeeting, setHasJoinedMeeting] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('joined') === 'true';
    }
    return false;
  });

  // Persistent User & Room Identifier
  const userIdRef = useRef(`OP-${Math.floor(1000 + Math.random() * 9000)}`);
  const [userName, setUserName] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('name') || `Caller ${Math.floor(100 + Math.random() * 900)}`;
    }
    return 'Operator';
  });
  const [roomId, setRoomId] = useState('VOX-ROOM-101');

  // Languages & Domain Jargon
  const [localLanguage, setLocalLanguage] = useState('en');
  const [remoteLanguage, setRemoteLanguage] = useState('te'); // Default English <-> Telugu
  const [activeDomain, setActiveDomain] = useState('general');
  const [voiceGender, setVoiceGender] = useState('female');
  const [volumeBoost, setVolumeBoost] = useState(true);

  // Commercial Tier & Currency
  const [activeTier, setActiveTier] = useState('free'); // 'free' | 'pro' | 'enterprise'
  const [currency, setCurrency] = useState('INR'); // Default Indian Rupee (₹ INR)

  // Authentication & Role Separation State
  const [currentUser, setCurrentUser] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('voicebridge_user') || localStorage.getItem('voicebridge_admin');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  });

  const [authView, setAuthView] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('auth') === 'admin') return 'admin-login';
      if (params.get('auth') === 'login') return 'user-login';
    }
    return 'app';
  });

  const [isGuestJoin] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('mode') === 'join';
    }
    return false;
  });

  const handleUserLoginSuccess = (user) => {
    setCurrentUser(user);
    setUserName(user.name);
    setAuthView('app');
  };

  const handleAdminLoginSuccess = (admin) => {
    setCurrentUser(admin);
    setUserName(admin.name);
    setActiveTab('admin-dashboard');
    setAuthView('app');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('voicebridge_user');
      localStorage.removeItem('voicebridge_admin');
    } catch (e) {}
    setAuthView('user-login');
  };

  const handleSelectTab = (tab) => {
    if (tab === 'admin-dashboard') {
      if (currentUser?.role === 'Administrator') {
        setActiveTab('admin-dashboard');
      } else {
        setAuthView('admin-login');
      }
      return;
    }
    setActiveTab(tab);
  };

  // Modals Visibility
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMinutesOpen, setIsMinutesOpen] = useState(false);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);

  // Live Utterance State
  const [latestLocalOriginal, setLatestLocalOriginal] = useState('');
  const [latestLocalTranslated, setLatestLocalTranslated] = useState('');
  const [latestRemoteOriginal, setLatestRemoteOriginal] = useState('');
  const [latestRemoteTranslated, setLatestRemoteTranslated] = useState('');

  // Conversation Audit Transcript
  const [transcript, setTranscript] = useState([
    {
      id: 'init-msg',
      speaker: 'System',
      isLocal: false,
      originalText: 'VOXSYNAPSE PRIME Duplex Telemetry Ready. End-to-End Encrypted.',
      translatedText: 'VOXSYNAPSE PRIME Duplex Telemetry Ready. End-to-End Encrypted.',
      sourceLang: 'en',
      targetLang: 'en',
      timestamp: Date.now() - 30000
    }
  ]);

  // Read URL Room Parameter (e.g. ?room=VOX-ROOM-101)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room');
      if (urlRoom) {
        setRoomId(urlRoom.toUpperCase());
      }
      const urlLang = params.get('lang');
      if (urlLang) {
        setLocalLanguage(urlLang.toLowerCase());
      }
    }
  }, []);

  // Backend Origin (Localhost dev, 127.0.0.1, LAN IPs, same-origin FastAPI, or Render cloud backend)
  const backendUrl = determineBackendUrl();

  // 1. Loudspeaker Speech Synthesis Hook (TTS Out Loud with Hybrid Engine)
  const {
    isSpeaking: isTTSActive,
    speak,
    stopSpeech,
    audioUnlocked,
    unlockAudio,
    playTestSound,
    speechRate,
    setSpeechRate
  } = useSpeechSynthesis({
    volumeBoost,
    preferredEngine: 'hybrid'
  });

  const lastRemoteAudioBase64Ref = useRef(null);
  const lastRemoteTranslatedTextRef = useRef('');

  // 2. WebRTC & Socket.IO Calling Hook (P2P Duplex without raw audio pass-through)
  const {
    connectionState,
    remotePeer,
    isPeerSpeaking,
    pingMs,
    errorMsg: webrtcError,
    connect: connectWebRTC,
    disconnect: disconnectWebRTC,
    emitSpeakingState,
    emitSpeechSegment,
    updateLanguage: updatePeerLanguage
  } = useWebRTC({
    backendUrl,
    roomId,
    userId: userIdRef.current,
    userName,
    language: localLanguage,
    voiceGender,
    onRemoteTextReceived: (data) => {
      handleRemoteIncomingData(data);
    },
    onRemoteAudioReceived: (data) => {
      handleRemoteAudioReceived(data);
    },
    onRemoteSpeechEnded: () => {
      handleRemoteSpeechEnded();
    }
  });

  // 3. Speech Recognition Hook (Strict Push-to-Talk with 0ms Release Dispatch)
  const {
    isListening,
    interimText: localInterim,
    audioLevel: localAudioLevel,
    startListening,
    stopListening,
    toggleListening,
    finalizeTurn,
    micStream
  } = useSpeechRecognition({
    language: localLanguage,
    isDucked: isTTSActive,
    strictPushToTalk: true, // Strict Push-to-Talk eliminates ambient noise and 100% of silence delay
    onSpeakingStateChange: (speaking) => {
      emitSpeakingState(speaking);
    },
    onFinalTranscript: async (finalText) => {
      await handleDispatchUtterance(finalText);
    }
  });

  // Dispatch an utterance (from Microphone speech OR from quick text input box)
  const handleDispatchUtterance = useCallback(async (text) => {
    if (!text || !text.trim()) return;

    // Apply smart deduplication to eliminate any mobile phrase or word loops
    const cleanText = deduplicateTokens(text);
    if (!cleanText) return;

    unlockAudio();
    setLatestLocalOriginal(cleanText);

    // Target language is peer's language if connected; else fallback to remoteLanguage
    const targetLang = remotePeer?.language || remoteLanguage;

    // 1. Dispatch speech segment across socket (0ms non-blocking; supports 2-peer and solo simulator)
    emitSpeechSegment(cleanText, localLanguage, targetLang);

    // 2. Perform local translation in parallel for local transcript display
    translateTextFast(cleanText, localLanguage, targetLang, activeDomain, backendUrl).then((translated) => {
      setLatestLocalTranslated(translated);
      const utteranceId = `local-${Date.now()}`;
      setTranscript(prev => [
        ...prev,
        {
          id: utteranceId,
          speaker: `${userName} (You)`,
          isLocal: true,
          originalText: cleanText,
          translatedText: translated,
          sourceLang: localLanguage,
          targetLang: targetLang,
          timestamp: Date.now()
        }
      ]);
    }).catch(err => {
      console.warn('[LocalTranslation] Error in local preview:', err);
    });
  }, [activeDomain, backendUrl, emitSpeechSegment, localLanguage, remoteLanguage, remotePeer, unlockAudio, userName]);

  // Handle Incoming Remote Subtitles from Connected Peer (<150ms)
  const handleRemoteIncomingData = useCallback((data) => {
    unlockAudio();

    const orig = data.originalText || '';
    const trans = data.translatedText || orig;

    setLatestRemoteOriginal(orig);
    setLatestRemoteTranslated(trans);
    lastRemoteTranslatedTextRef.current = trans;

    const peerLabel = remotePeer?.userName || 'Peer 2';

    setTranscript(prev => [
      ...prev,
      {
        id: `peer-${Date.now()}`,
        speaker: peerLabel,
        isLocal: false,
        originalText: orig,
        translatedText: trans,
        sourceLang: data.sourceLang || remoteLanguage,
        targetLang: data.targetLang || localLanguage,
        timestamp: Date.now()
      }
    ]);
  }, [localLanguage, remoteLanguage, remotePeer, unlockAudio]);

  // Handle Incoming Base64 Audio from Connected Peer (Authoritative Studio Neural Voice)
  const handleRemoteAudioReceived = useCallback((data) => {
    if (data.audioBase64) {
      lastRemoteAudioBase64Ref.current = data.audioBase64;
      lastRemoteTranslatedTextRef.current = data.translatedText || '';
      speak(data.translatedText, localLanguage, data.audioBase64);
      // Zero-latency buffer capture for call recording
      callRecorder.addBase64AudioChunk(data.audioBase64, remotePeer?.userName || 'Remote Caller', data.translatedText);
    } else if (data.translatedText) {
      lastRemoteAudioBase64Ref.current = null;
      lastRemoteTranslatedTextRef.current = data.translatedText;
      speak(data.translatedText, localLanguage);
    }
  }, [localLanguage, remotePeer, speak]);

  // Robust Hybrid Replay of translated audio
  const handleReplayAudio = useCallback((textToPlay, langToUse) => {
    const text = textToPlay || latestRemoteTranslated || lastRemoteTranslatedTextRef.current;
    const lang = langToUse || localLanguage;
    if (text) {
      unlockAudio();
      const base64 = (text === latestRemoteTranslated) ? lastRemoteAudioBase64Ref.current : null;
      speak(text, lang, base64, { isReplay: true });
    }
  }, [latestRemoteTranslated, localLanguage, speak, unlockAudio]);

  // Handle Peer Speech Ended
  const handleRemoteSpeechEnded = useCallback(() => {
    // Pure Neural audio playback managed via active audio element
  }, []);

  // Language update handlers
  const handleLocalLanguageChange = (newLang) => {
    setLocalLanguage(newLang);
    updatePeerLanguage(newLang, voiceGender, userName);
  };

  const handleRemoteLanguageChange = (newLang) => {
    setRemoteLanguage(newLang);
  };

  // Pre-join entry handler
  const handleJoinMeeting = () => {
    setHasJoinedMeeting(true);
    unlockAudio();
    connectWebRTC(roomId);
  };

  // Leave room handler
  const handleLeaveRoom = () => {
    disconnectWebRTC();
    setHasJoinedMeeting(false);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0B0F17] text-white select-none relative overflow-hidden font-sans">
      {authView === 'user-login' ? (
        <UserLogin
          onLoginSuccess={handleUserLoginSuccess}
          onSwitchToAdmin={() => setAuthView('admin-login')}
          onJoinGuestRoom={() => setAuthView('app')}
        />
      ) : authView === 'admin-login' ? (
        <AdminLogin
          onAdminLoginSuccess={handleAdminLoginSuccess}
          onSwitchToUser={() => setAuthView('user-login')}
        />
      ) : !hasJoinedMeeting ? (
        /* Pre-Join Meeting Lobby (Zoom / Google Meet Style) */
        <PreJoinLobby
          roomId={roomId}
          onRoomIdChange={setRoomId}
          userName={userName}
          onUserNameChange={setUserName}
          selectedLanguage={localLanguage}
          onLanguageChange={setLocalLanguage}
          onJoinMeeting={handleJoinMeeting}
          audioLevel={localAudioLevel}
          onTestAudio={playTestSound}
          isGuestJoin={isGuestJoin}
        />
      ) : (
        /* In-Meeting Experience */
        <>
          {/* 1. Global Navigation Bar */}
          <Navbar
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            connectionState={connectionState}
            activeTier={activeTier}
            currency={currency}
            onOpenPricing={() => setIsPricingOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            currentUser={currentUser}
            onLogout={handleLogout}
            onOpenLogin={() => setAuthView('user-login')}
            roomParticipantCount={remotePeer ? 2 : 1}
          />

          {/* 2. Main Portal Routing Stage */}
          <main className="flex-1 flex flex-col overflow-hidden min-h-0">
            {activeTab === 'studio' && (
              <CallStudio
                roomId={roomId}
                userName={userName}
                onRoomIdChange={setRoomId}
                connectionState={connectionState}
                remotePeer={remotePeer}
                onConnect={() => connectWebRTC(roomId)}
                onDisconnect={handleLeaveRoom}
                localLanguage={localLanguage}
                remoteLanguage={remotePeer?.language || remoteLanguage}
                onLocalLanguageChange={handleLocalLanguageChange}
                onRemoteLanguageChange={handleRemoteLanguageChange}
                isListening={isListening}
                onStartListening={startListening}
                onToggleMic={toggleListening}
                onFinalizeTurn={finalizeTurn}
                localAudioLevel={localAudioLevel}
                isPeerSpeaking={isPeerSpeaking}
                isRemoteSpeaking={isTTSActive}
                isLocalSpeakingTTS={isTTSActive}
                localInterim={localInterim}
                latestLocalOriginal={latestLocalOriginal}
                latestLocalTranslated={latestLocalTranslated}
                latestRemoteOriginal={latestRemoteOriginal}
                latestRemoteTranslated={latestRemoteTranslated}
                onSendTextUtterance={handleDispatchUtterance}
                onReplayAudio={handleReplayAudio}
                onTestSpeaker={playTestSound}
                onOpenMinutes={() => setIsMinutesOpen(true)}
                onOpenGlossary={() => setIsGlossaryOpen(true)}
                activeDomain={activeDomain}
                volumeBoost={volumeBoost}
                onToggleVolumeBoost={() => setVolumeBoost(prev => !prev)}
                audioUnlocked={audioUnlocked}
                onUnlockAudio={unlockAudio}
              />
            )}

            {activeTab === 'user-dashboard' && (
              <UserDashboard
                onJoinRoom={(targetRoom) => {
                  setRoomId(targetRoom);
                  connectWebRTC(targetRoom);
                  setActiveTab('studio');
                }}
                onOpenMinutes={() => setIsMinutesOpen(true)}
                onOpenPricing={() => setIsPricingOpen(true)}
                activeTier={activeTier}
                currency={currency}
              />
            )}

            {activeTab === 'admin-dashboard' && (
              <AdminDashboard
                backendUrl={backendUrl}
                currency={currency}
                onOpenPricing={() => setIsPricingOpen(true)}
              />
            )}
          </main>

          {/* 3. Settings & Audio Hardware Modal */}
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            localLanguage={localLanguage}
            onLocalLanguageChange={handleLocalLanguageChange}
            remoteLanguage={remoteLanguage}
            onRemoteLanguageChange={handleRemoteLanguageChange}
            volumeBoost={volumeBoost}
            onToggleVolumeBoost={() => setVolumeBoost(prev => !prev)}
            onTestSpeaker={playTestSound}
            speechRate={speechRate}
            onSpeechRateChange={setSpeechRate}
            audioLevel={localAudioLevel}
            voiceGender={voiceGender}
            onVoiceGenderChange={setVoiceGender}
          />

          {/* 4. Enterprise Commercial Monetization Modal (₹ INR / $ USD) */}
          <MonetizationModal
            isOpen={isPricingOpen}
            onClose={() => setIsPricingOpen(false)}
            activeTier={activeTier}
            onSelectTier={(tier) => setActiveTier(tier)}
            currency={currency}
            onToggleCurrency={() => setCurrency(prev => prev === 'INR' ? 'USD' : 'INR')}
          />

          {/* 5. Feature 01: AI Corporate Executive Meeting Minutes Drawer */}
          <MinutesDrawer
            isOpen={isMinutesOpen}
            onClose={() => setIsMinutesOpen(false)}
            transcript={transcript}
            activeTier={activeTier}
            onOpenUpgrade={() => {
              setIsMinutesOpen(false);
              setIsPricingOpen(true);
            }}
          />

          {/* 6. Feature 02: Enterprise Domain Glossaries & Jargon Lock Drawer */}
          <GlossaryDrawer
            isOpen={isGlossaryOpen}
            onClose={() => setIsGlossaryOpen(false)}
            activeDomain={activeDomain}
            onSelectDomain={(domain) => setActiveDomain(domain)}
            activeTier={activeTier}
            onOpenUpgrade={() => {
              setIsGlossaryOpen(false);
              setIsPricingOpen(true);
            }}
          />
        </>
      )}
    </div>
  );
}
