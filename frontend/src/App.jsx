import React, { useState, useEffect } from 'react';
import Lobby from './components/Lobby';
import CallRoom from './components/CallRoom';
import ErrorBoundary from './components/ErrorBoundary';

const getInitialRoomId = () => {
  if (typeof window === 'undefined') return '';
  if (window.location.hash) {
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (hash.includes('room=')) {
      const parts = hash.split('room=')[1];
      return parts.split('&')[0].replace(/[^a-zA-Z0-9_-]/g, '').trim();
    }
  }
  const params = new URLSearchParams(window.location.search);
  const searchRoom = params.get('room');
  if (searchRoom) {
    return searchRoom.replace(/[^a-zA-Z0-9_-]/g, '').trim();
  }
  return '';
};

export default function App() {
  const [currentView, setCurrentView] = useState('lobby'); // 'lobby' | 'call'
  const [activeRoomId, setActiveRoomId] = useState(getInitialRoomId);
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const saved = window.sessionStorage.getItem('voicebridge_language');
      if (saved) return saved;
    }
    return getInitialRoomId() ? 'hi' : 'te';
  });
  const [voiceGender, setVoiceGender] = useState(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const saved = window.sessionStorage.getItem('voicebridge_voice_gender');
      if (saved) return saved;
    }
    return 'female';
  });

  // Sync room from URL if shared via link or browser back/forward button
  useEffect(() => {
    const parseUrl = () => {
      const urlRoom = getInitialRoomId();
      if (urlRoom) {
        setActiveRoomId(urlRoom);
      } else {
        // Navigated back to base URL
        setCurrentView((prev) => (prev === 'call' ? 'lobby' : prev));
        setActiveRoomId('');
      }
    };

    parseUrl();
    window.addEventListener('hashchange', parseUrl);
    window.addEventListener('popstate', parseUrl);
    return () => {
      window.removeEventListener('hashchange', parseUrl);
      window.removeEventListener('popstate', parseUrl);
    };
  }, []);

  const handleJoinRoom = ({ roomId, language, voiceGender }) => {
    setActiveRoomId(roomId);
    setSelectedLanguage(language);
    setVoiceGender(voiceGender);
    window.location.hash = `room=${roomId}`;
    setCurrentView('call');
  };

  const handleLeaveCall = () => {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem('voicebridge_in_call');
      } catch (e) {}
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      } else {
        window.location.hash = '';
      }
    }
    setActiveRoomId('');
    setCurrentView('lobby');
  };

  const handleClearDefaultRoom = () => {
    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
    } else {
      window.location.hash = '';
    }
    setActiveRoomId('');
  };

  return (
    <div className="min-h-screen bg-dark-950 text-white font-sans">
      <ErrorBoundary onReset={handleLeaveCall}>
        {currentView === 'lobby' ? (
          <Lobby 
            onJoinRoom={handleJoinRoom} 
            defaultRoomId={activeRoomId} 
            onClearDefaultRoom={handleClearDefaultRoom}
          />
        ) : (
          <CallRoom 
            roomId={activeRoomId} 
            language={selectedLanguage} 
            voiceGender={voiceGender} 
            onLeaveCall={handleLeaveCall} 
          />
        )}
      </ErrorBoundary>
    </div>
  );
}
