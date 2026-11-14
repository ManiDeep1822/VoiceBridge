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
import { EnterpriseAuth } from './components/Auth/EnterpriseAuth';

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

  // Authentication & Role Separation State (Enterprise IAM)
  const [currentUser, setCurrentUser] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('voicebridge_user') || localStorage.getItem('voicebridge_admin');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  });

  const [isGuestJoin, setIsGuestJoin] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('mode') === 'join';
    }
    return false;
  });

  const [isInsecureOrigin, setIsInsecureOrigin] = useState(() => {
    if (typeof window !== 'undefined') {
      const { protocol, hostname } = window.location;
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
      return protocol === 'http:' && !isLocal;
    }
    return false;
  });

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    if (user.name) setUserName(user.name);
    if (user.role === 'Administrator') {
      setActiveTab('admin-dashboard');
    } else {
      setActiveTab('studio');
    }
  };

  const handleGuestJoin = ({ roomId: guestRoom, guestName }) => {
    if (guestRoom) setRoomId(guestRoom);
    if (guestName) setUserName(guestName);
    setIsGuestJoin(true);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsGuestJoin(false);
    try {
      localStorage.removeItem('voicebridge_token');
      localStorage.removeItem('voicebridge_user');
      localStorage.removeItem('voicebridge_admin');
    } catch (e) {}
    setActiveTab('studio');
  };

  const handleSelectTab = (tab) => {
    if (tab === 'admin-dashboard') {
      if (currentUser?.role === 'Administrator') {
        setActiveTab('admin-dashboard');
      } else {
        console.warn('Unauthorized access attempt to Admin Fleet Console. Access denied.');
      }
      return;
    }
    setActiveTab(tab);
  };

  // RBAC safety enforcement: non-admins cannot access admin-dashboard
  useEffect(() => {
    if (activeTab === 'admin-dashboard' && currentUser?.role !== 'Administrator') {
      setActiveTab('studio');
    }
  }, [activeTab, currentUser]);

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

  // Auto-restore active session and user tier from backend via GET /api/auth/me
  useEffect(() => {
    const restoreSession = async () => {
      if (typeof window === 'undefined') return;
      try {
        const token = localStorage.getItem('voicebridge_token');
        if (!token) return;

        const res = await fetch(`${backendUrl}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.user) {
            const restoredUser = {
              ...data.user,
              token
            };
            setCurrentUser(restoredUser);
            if (restoredUser.name) setUserName(restoredUser.name);
            if (restoredUser.tier) setActiveTier(restoredUser.tier.toLowerCase());
            if (restoredUser.role === 'Administrator') {
              localStorage.setItem('voicebridge_admin', JSON.stringify(restoredUser));
            } else {
              localStorage.setItem('voicebridge_user', JSON.stringify(restoredUser));
            }
          }
        } else if (res.status === 401) {
          localStorage.removeItem('voicebridge_token');
        }
      } catch (err) {
        // Graceful offline fallback
      }
    };

    restoreSession();
  }, [backendUrl]);

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
    emitSpeechSegment(cleanText, localLanguage, targetLang, activeDomain);

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
    const targetLang = data?.targetLang || localLanguage;
    if (data.audioBase64) {
      lastRemoteAudioBase64Ref.current = data.audioBase64;
      lastRemoteTranslatedTextRef.current = data.translatedText || '';
      speak(data.translatedText, targetLang, data.audioBase64);
      // Zero-latency buffer capture for call recording
      callRecorder.addBase64AudioChunk(data.audioBase64, remotePeer?.userName || 'Remote Caller', data.translatedText);
    } else if (data.translatedText) {
      lastRemoteAudioBase64Ref.current = null;
      lastRemoteTranslatedTextRef.current = data.translatedText;
      speak(data.translatedText, targetLang);
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
    <div className="w-full h-full flex flex-col bg-black text-white select-none relative overflow-hidden font-sans">
      {/* HTTPS Origin Security Guard Top Banner */}
      {isInsecureOrigin && (
        <div className="bg-black border-b border-white/20 text-white px-4 py-2 text-xs flex items-center justify-between gap-3 z-50 shrink-0 animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white shrink-0 animate-pulse" />
            <span className="font-sans font-medium text-zinc-300">
              <strong className="text-white">HTTPS Security Warning:</strong> Non-localhost HTTP detected. Mobile browsers (iOS Safari, Android Chrome) require HTTPS or localhost for WebRTC and microphone permissions.
            </span>
          </div>
          <button
            onClick={() => setIsInsecureOrigin(false)}
            className="text-zinc-400 hover:text-white text-xs underline font-mono shrink-0 cursor-pointer ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {!currentUser && !isGuestJoin ? (
        <EnterpriseAuth
          onLoginSuccess={handleLoginSuccess}
          onGuestJoin={handleGuestJoin}
          initialRoomId={roomId}
          backendUrl={backendUrl}
        />
      ) : (
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
            onOpenLogin={() => {
              setCurrentUser(null);
              setIsGuestJoin(false);
            }}
            roomParticipantCount={remotePeer ? 2 : 1}
          />

          {/* 2. Main Portal Routing Stage */}
          <main className="flex-1 flex flex-col overflow-hidden min-h-0">
            {activeTab === 'studio' && (
              !hasJoinedMeeting ? (
                <PreJoinLobby
                  roomId={roomId}
                  onRoomIdChange={setRoomId}
                  userName={userName}
                  onUserNameChange={setUserName}
                  selectedLanguage={localLanguage}
                  onLanguageChange={handleLocalLanguageChange}
                  onJoinMeeting={handleJoinMeeting}
                  audioLevel={localAudioLevel}
                  onTestAudio={playTestSound}
                  isGuestJoin={isGuestJoin && !currentUser}
                />
              ) : (
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
                  onStopListening={stopListening}
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
                  transcript={transcript}
                />
              )
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
                backendUrl={backendUrl}
              />
            )}

            {activeTab === 'admin-dashboard' && currentUser?.role === 'Administrator' && (
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
            backendUrl={backendUrl}
            currentUser={currentUser}
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
