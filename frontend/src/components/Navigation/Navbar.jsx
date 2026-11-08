import React from 'react';
import { PhoneCall, LayoutDashboard, ShieldCheck, Settings, CreditCard, Sparkles } from 'lucide-react';

export function Navbar({
  activeTab = 'studio',
  onSelectTab,
  connectionState = 'disconnected',
  activeTier = 'free',
  currency = 'INR',
  onOpenPricing,
  onOpenSettings
}) {
  const isINR = currency === 'INR';

  return (
    <header className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-2 flex items-center justify-between select-none z-30 shrink-0 font-sans">
      {/* Left: Brand Identity */}
      <div className="flex items-center gap-6">
        <div 
          className="flex items-center gap-3 cursor-pointer group" 
          onClick={() => onSelectTab('studio')}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-white" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">
                VoiceBridge
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20">
                Live AI
              </span>
            </div>
            <span className="text-xs text-slate-400">
              Universal Call Translator
            </span>
          </div>
        </div>

        {/* Center: Navigation System */}
        <nav className="hidden md:flex items-center gap-1.5 p-1 bg-slate-800/60 rounded-xl border border-slate-700/50">
          <button
            onClick={() => onSelectTab('studio')}
            className={`h-9 px-4 rounded-lg flex items-center gap-2 transition-all text-xs font-semibold ${
              activeTab === 'studio'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <PhoneCall className="w-4 h-4" />
            <span>Call Studio</span>
            {connectionState === 'connected' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => onSelectTab('user-dashboard')}
            className={`h-9 px-4 rounded-lg flex items-center gap-2 transition-all text-xs font-semibold ${
              activeTab === 'user-dashboard'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Workspace</span>
          </button>

          <button
            onClick={() => onSelectTab('admin-dashboard')}
            className={`h-9 px-4 rounded-lg flex items-center gap-2 transition-all text-xs font-semibold ${
              activeTab === 'admin-dashboard'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Admin</span>
          </button>
        </nav>
      </div>

      {/* Right: Actions & Controls */}
      <div className="flex items-center gap-2.5">
        {/* Connection State Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-medium">
          <span className={`w-2 h-2 rounded-full ${
            connectionState === 'connected' ? 'bg-emerald-400 shadow-[0_0_8px_#10B981]' :
            connectionState === 'waiting' ? 'bg-amber-400 animate-pulse' :
            connectionState === 'connecting' ? 'bg-blue-400 animate-pulse' : 'bg-slate-500'
          }`} />
          <span className="text-slate-200">
            {connectionState === 'connected' ? 'Live Connected' :
             connectionState === 'waiting' ? 'Waiting for Peer' :
             connectionState === 'connecting' ? 'Connecting...' : 'Ready'}
          </span>
        </div>

        {/* Pricing Tier Button */}
        <button
          onClick={onOpenPricing}
          className="btn-secondary h-11 px-5 py-2.5 rounded-xl text-sm font-medium"
          title="Plans & Pricing"
        >
          <CreditCard className="w-4 h-4 text-slate-300" />
          <span className="hidden sm:inline">{isINR ? '₹' : '$'} Plan:</span>
          <span className="font-semibold text-white uppercase">{activeTier}</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="btn-secondary h-11 w-11 p-0 rounded-xl flex items-center justify-center text-slate-300 hover:text-white"
          title="Audio & Language Settings"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
