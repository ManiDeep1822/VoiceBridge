import React, { useState, useEffect } from 'react';
import { Shield, Activity, Zap, Award, FileText, BookOpen, Volume2, Globe } from 'lucide-react';

export function TacticalHeader({
  connectionState = 'disconnected',
  pingMs = 18,
  activeTier = 'free', // 'free' | 'pro' | 'enterprise'
  currency = 'INR', // 'INR' | 'USD'
  onOpenMonetization,
  onOpenMinutes,
  onOpenGlossary,
  audioEngine = 'hybrid'
}) {
  const [timecode, setTimecode] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimecode(now.toISOString().slice(11, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = () => {
    switch (connectionState) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-telemetry uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-telemetry-emerald" />
            P2P Duplex Active
          </span>
        );
      case 'waiting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-telemetry uppercase tracking-wider bg-amber-950/80 text-amber-400 border border-amber-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-telemetry-amber" />
            Waiting for Peer
          </span>
        );
      case 'connecting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-telemetry uppercase tracking-wider bg-cyan-950/80 text-cyan-400 border border-cyan-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            Signaling Handshake
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-telemetry uppercase tracking-wider bg-gray-900 text-gray-400 border border-gray-700">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
            Standby / Solo Duplex
          </span>
        );
    }
  };

  const getTierBadge = () => {
    if (activeTier === 'enterprise') {
      return (
        <button
          onClick={onOpenMonetization}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-telemetry uppercase tracking-wider bg-purple-950/70 text-purple-300 border border-purple-500 hover:bg-purple-900/80 transition-colors"
        >
          <Award className="w-3.5 h-3.5 text-purple-400" />
          Enterprise Tier
        </button>
      );
    }
    if (activeTier === 'pro') {
      return (
        <button
          onClick={onOpenMonetization}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-telemetry uppercase tracking-wider bg-cyan-950/70 text-cyan-300 border border-cyan-500 hover:bg-cyan-900/80 transition-colors"
        >
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          Pro Industrial
        </button>
      );
    }
    return (
      <button
        onClick={onOpenMonetization}
        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-telemetry uppercase tracking-wider bg-amber-950/70 text-amber-300 border border-amber-600/60 hover:bg-amber-900/70 transition-colors"
      >
        <Zap className="w-3.5 h-3.5 text-amber-400" />
        Upgrade ({currency === 'INR' ? '₹2,999' : '$49'})
      </button>
    );
  };

  return (
    <header className="w-full bg-[#080B0F] border-b border-[#1C2532] px-4 py-2.5 flex items-center justify-between select-none z-30">
      {/* Left: Brand & Telemetry Identifiers */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-500 flex items-center justify-center text-black font-bold font-telemetry text-xs tracking-tighter shadow-[0_0_12px_rgba(0,255,136,0.5)]">
            VX
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-white text-sm uppercase">VOXSYNAPSE PRIME</span>
              <span className="text-[10px] font-telemetry px-1 py-0.2 bg-[#141C26] text-gray-400 border border-[#243142]">MK-IV</span>
            </div>
            <div className="text-[10px] font-telemetry text-gray-400 flex items-center gap-2">
              <span>REAL-TIME 2-WAY DUPLEX</span>
              <span className="text-gray-600">/</span>
              <span>ZERO-COST CORE</span>
            </div>
          </div>
        </div>

        {/* Network & Audio State Indicators */}
        <div className="hidden md:flex items-center gap-3 border-l border-[#1C2532] pl-4">
          {getStatusBadge()}

          <div className="flex items-center gap-1 text-[11px] font-telemetry text-gray-400">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>RTT:</span>
            <span className="text-cyan-300 font-semibold">{pingMs}ms</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-telemetry text-gray-400">
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>TTS:</span>
            <span className="text-emerald-300 uppercase font-semibold">HYBRID +6dB</span>
          </div>
        </div>
      </div>

      {/* Right: Enterprise Monetization Tools & Action Buttons */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Domain Glossary Button */}
        <button
          onClick={onOpenGlossary}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-telemetry uppercase text-gray-300 bg-[#10151C] border border-[#222B36] hover:border-gray-500 transition-colors"
          title="Specialized Domain Glossary & Jargon Lock"
        >
          <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Industry Jargon</span>
        </button>

        {/* AI Meeting Minutes Button */}
        <button
          onClick={onOpenMinutes}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-telemetry uppercase text-gray-300 bg-[#10151C] border border-[#222B36] hover:border-gray-500 transition-colors"
          title="Generate AI Meeting Minutes & Action Items"
        >
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Meeting Minutes</span>
        </button>

        {/* Commercial Tier Badge */}
        {getTierBadge()}

        {/* Telemetry Clock */}
        <div className="hidden lg:block text-right border-l border-[#1C2532] pl-3">
          <div className="text-[10px] font-telemetry text-gray-400 tracking-wider">{timecode}</div>
          <div className="text-[9px] font-telemetry text-emerald-500/80 uppercase">AES-256 P2P</div>
        </div>
      </div>
    </header>
  );
}
