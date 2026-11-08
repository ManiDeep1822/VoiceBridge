import React from 'react';
import { PhoneCall, LayoutDashboard, ShieldCheck, Settings, CreditCard, Activity, Cpu } from 'lucide-react';

export function Navbar({
  activeTab = 'studio',
  onSelectTab,
  connectionState = 'disconnected',
  activeTier = 'free',
  currency = 'INR',
  onOpenPricing,
  onOpenSettings,
  roomParticipantCount = 0
}) {
  const isINR = currency === 'INR';

  return (
    <header className="w-full bg-[#0A0A0A] border-b border-[#262626] px-4 py-2 flex items-center justify-between select-none z-30 shrink-0 font-mono text-xs">
      {/* Left: Industrial Brand Identity */}
      <div className="flex items-center gap-6">
        <div 
          className="flex items-center gap-3 cursor-pointer group" 
          onClick={() => onSelectTab('studio')}
        >
          {/* Hardware Device Spec Mark */}
          <div className="w-8 h-8 border border-white bg-[#141414] flex items-center justify-center text-white font-bold text-xs tracking-tighter">
            <span className="text-[11px] font-black">VX</span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm tracking-tight text-white uppercase">
                VOXSYNAPSE
              </span>
              <span className="text-[9px] px-1.5 py-0.2 border border-[#404040] bg-[#161616] text-[#A1A1AA] uppercase">
                SYS.V2
              </span>
            </div>
            <div className="text-[9px] text-[#71717A] tracking-wider uppercase">
              REAL-TIME TELEMETRY TRANSLATION
            </div>
          </div>
        </div>

        {/* Center: Monolithic Navigation System */}
        <nav className="hidden md:flex items-center border border-[#262626] bg-[#0E0E0E]">
          <button
            onClick={() => onSelectTab('studio')}
            className={`px-3.5 py-1.5 flex items-center gap-2 border-r border-[#262626] transition-colors uppercase text-[11px] ${
              activeTab === 'studio'
                ? 'bg-white text-black font-bold'
                : 'text-[#A1A1AA] hover:text-white hover:bg-[#1A1A1A]'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5 stroke-[1.75]" />
            <span>[01] CALL STUDIO</span>
            {connectionState === 'connected' && (
              <span className="w-1.5 h-1.5 bg-[#E61919]" />
            )}
          </button>

          <button
            onClick={() => onSelectTab('user-dashboard')}
            className={`px-3.5 py-1.5 flex items-center gap-2 border-r border-[#262626] transition-colors uppercase text-[11px] ${
              activeTab === 'user-dashboard'
                ? 'bg-white text-black font-bold'
                : 'text-[#A1A1AA] hover:text-white hover:bg-[#1A1A1A]'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5 stroke-[1.75]" />
            <span>[02] WORKSPACE</span>
          </button>

          <button
            onClick={() => onSelectTab('admin-dashboard')}
            className={`px-3.5 py-1.5 flex items-center gap-2 transition-colors uppercase text-[11px] ${
              activeTab === 'admin-dashboard'
                ? 'bg-white text-black font-bold'
                : 'text-[#A1A1AA] hover:text-white hover:bg-[#1A1A1A]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 stroke-[1.75]" />
            <span>[03] ADMIN CONSOLE</span>
          </button>
        </nav>
      </div>

      {/* Right: Telemetry Indicators & Mechanical Controls */}
      <div className="flex items-center gap-2">
        {/* Hardware Channel Telemetry */}
        <div className="hidden lg:flex items-center gap-2 border border-[#262626] bg-[#111111] px-2.5 py-1 text-[10px] text-[#A1A1AA]">
          <Cpu className="w-3 h-3 text-[#71717A]" />
          <span>CODEC: OPUS-HD</span>
          <span className="text-[#404040]">|</span>
          <span>LATENCY: 18ms</span>
        </div>

        {/* Connection State Indicator */}
        <div className="flex items-center gap-2 border border-[#262626] bg-[#111111] px-3 py-1 text-[11px]">
          <span className={`w-2 h-2 ${
            connectionState === 'connected' ? 'bg-[#39FF14]' :
            connectionState === 'waiting' ? 'bg-[#E61919] animate-pulse' :
            connectionState === 'connecting' ? 'bg-amber-400' : 'bg-[#404040]'
          }`} />
          <span className="text-white uppercase font-bold">
            {connectionState === 'connected' ? 'P2P LINKED' :
             connectionState === 'waiting' ? 'WAITING PEER' :
             connectionState === 'connecting' ? 'CONNECTING' : 'STANDBY'}
          </span>
        </div>

        {/* Commercial Procurement Tier */}
        <button
          onClick={onOpenPricing}
          className="border border-[#404040] hover:border-white bg-[#141414] hover:bg-[#202020] text-white px-3 py-1 text-[11px] font-bold flex items-center gap-1.5 uppercase transition-colors"
          title="Corporate Procurement & Indian GST Licensing"
        >
          <CreditCard className="w-3 h-3 text-[#A1A1AA]" />
          <span>{isINR ? '₹ TIER: ' : '$ TIER: '} {activeTier.toUpperCase()}</span>
        </button>

        {/* Hardware Settings Button */}
        <button
          onClick={onOpenSettings}
          className="border border-[#262626] hover:border-white bg-[#141414] hover:bg-[#202020] text-[#A1A1AA] hover:text-white p-1.5 transition-colors"
          title="Hardware Audio Calibration"
        >
          <Settings className="w-3.5 h-3.5 stroke-[1.75]" />
        </button>
      </div>
    </header>
  );
}
