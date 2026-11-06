import React, { useState, useEffect } from 'react';
import Lobby from './components/Lobby';
import CallRoom from './components/CallRoom';

const getInitialRoomId = () => {
  if (typeof window === 'undefined') return '';
  if (window.location.hash && window.location.hash.includes('#room=')) {
    return window.location.hash.split('#room=')[1].trim();
  }
  const params = new URLSearchParams(window.location.search);
  return (params.get('room') || '').trim();
};

export default function App() {
  const [currentView, setCurrentView] = useState('lobby'); // 'lobby' | 'call'
  const [activeRoomId, setActiveRoomId] = useState(getInitialRoomId);
  const [selectedLanguage, setSelectedLanguage] = useState(() => (getInitialRoomId() ? 'hi' : 'te'));
  const [voiceGender, setVoiceGender] = useState('female');

  // Read room from URL if shared via link
  useEffect(() => {
    const parseUrl = () => {
      const urlRoom = getInitialRoomId();
      if (urlRoom) {
        setActiveRoomId(urlRoom);
      }
    };

    parseUrl();
    window.addEventListener('hashchange', parseUrl);
    return () => window.removeEventListener('hashchange', parseUrl);
  }, []);

  const handleJoinRoom = ({ roomId, language, voiceGender }) => {
    setActiveRoomId(roomId);
    setSelectedLanguage(language);
    setVoiceGender(voiceGender);
    window.location.hash = `room=${roomId}`;
    setCurrentView('call');
  };

  const handleLeaveCall = () => {
    window.location.hash = '';
    setActiveRoomId('');
    setCurrentView('lobby');
  };

  const handleClearDefaultRoom = () => {
    window.location.hash = '';
    setActiveRoomId('');
  };

  return (
    <div className="min-h-screen bg-dark-950 text-white font-sans">
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
    </div>
  );
}
