import React from 'react';
import { PhoneCall, LayoutDashboard, ShieldCheck, Settings, CreditCard, LogOut, Radio } from 'lucide-react';

export function Navbar({
  activeTab = 'studio',
  onSelectTab,
  connectionState = 'disconnected',
  activeTier = 'free',
  currency = 'INR',
  onOpenPricing,
  onOpenSettings,
  currentUser = null,
  onLogout,
  onOpenLogin,
  roomParticipantCount = 1
}) {
  const isINR = currency === 'INR';

  return (
    <header className="w-full max-w-full bg-[#0B0F17]/95 backdrop-blur-md border-b border-slate-800/90 px-2 sm:px-4 py-2 flex items-center justify-between select-none z-30 shrink-0 font-sans box-border overflow-hidden">
      {/* Left: Brand Identity & Desktop Tabs */}
      <div className="flex items-center gap-2 sm:gap-5 min-w-0">
        <div 
          className="flex items-center gap-2 sm:gap-3 cursor-pointer group min-w-0 select-none" 
          onClick={() => onSelectTab && onSelectTab('studio')}
          title="VoiceBridge Home"
        >
          {/* Professional Vector SVG VoiceBridge Logo */}
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-950/50 shrink-0 group-hover:scale-105 transition-transform border border-blue-400/30">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="sm:w-5 sm:h-5">
              <path d="M4 12V12.01M8 8V16M12 4V20M16 8V16M20 12V12.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-white truncate">
                VoiceBridge
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/25 hidden xs:inline uppercase tracking-wider">
                Prime
              </span>
            </div>
            <span className="text-[10px] text-slate-400 hidden sm:block truncate leading-none">
              Real-Time Call Translator
            </span>
          </div>
        </div>

        {/* Center: Desktop Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 p-1 bg-slate-900/90 rounded-xl border border-slate-800">
          <button
            onClick={() => onSelectTab && onSelectTab('studio')}
            className={`h-8 sm:h-8.5 px-3.5 rounded-lg flex items-center gap-2 transition-all text-xs font-semibold ${
              activeTab === 'studio'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/40'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Call Studio</span>
            {connectionState === 'connected' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse glow-emerald" />
            )}
          </button>

          <button
            onClick={() => onSelectTab && onSelectTab('user-dashboard')}
            className={`h-8 sm:h-8.5 px-3.5 rounded-lg flex items-center gap-2 transition-all text-xs font-semibold ${
              activeTab === 'user-dashboard'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/40'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Workspace</span>
          </button>

          <button
            onClick={() => onSelectTab && onSelectTab('admin-dashboard')}
            className={`h-8 sm:h-8.5 px-3.5 rounded-lg flex items-center gap-2 transition-all text-xs font-semibold ${
              activeTab === 'admin-dashboard'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/40'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Admin Fleet</span>
          </button>
        </nav>
      </div>

      {/* Right: Actions & Controls */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Mobile Tab Switcher Icons */}
        <div className="flex md:hidden items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-800 mr-0.5">
          <button
            onClick={() => onSelectTab && onSelectTab('studio')}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
              activeTab === 'studio' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Call Studio"
            aria-label="Call Studio"
          >
            <PhoneCall className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSelectTab && onSelectTab('user-dashboard')}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
              activeTab === 'user-dashboard' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Workspace Dashboard"
            aria-label="Workspace Dashboard"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSelectTab && onSelectTab('admin-dashboard')}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
              activeTab === 'admin-dashboard' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Admin Fleet"
            aria-label="Admin Fleet"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Connection State Badge (Desktop) */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-medium">
          <span className={`w-2 h-2 rounded-full ${
            connectionState === 'connected' ? 'bg-emerald-400 glow-emerald animate-pulse' :
            connectionState === 'waiting' ? 'bg-amber-400 glow-amber animate-pulse' :
            connectionState === 'connecting' ? 'bg-blue-400 glow-blue animate-pulse' : 'bg-slate-500'
          }`} />
          <span className="text-slate-300 text-[11px]">
            {connectionState === 'connected' ? 'Live Connected' :
             connectionState === 'waiting' ? 'Waiting for Caller' :
             connectionState === 'connecting' ? 'Connecting...' : 'Ready'}
          </span>
        </div>

        {/* Pricing Tier Button */}
        <button
          onClick={onOpenPricing}
          className="h-8 sm:h-8.5 px-2 sm:px-3 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-xs font-medium flex items-center gap-1.5 text-slate-200 transition-all hover:border-slate-600 shadow-sm"
          title="Plans & Pricing"
          aria-label="Plans & Pricing"
        >
          <CreditCard className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="hidden sm:inline text-slate-300 text-[11px]">{isINR ? '₹' : '$'} Plan:</span>
          <span className="font-bold text-white uppercase text-[10px] sm:text-xs">{activeTier}</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="w-8 h-8 sm:w-auto sm:h-8.5 sm:px-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white transition-all hover:border-slate-600 shadow-sm"
          title="Audio & Language Settings"
          aria-label="Settings"
        >
          <Settings className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          <span className="hidden sm:inline text-xs">Settings</span>
        </button>

        {/* User Profile & Sign Out OR Sign In */}
        {currentUser ? (
          <div className="flex items-center gap-1 sm:gap-1.5">
            <div className="h-8 sm:h-8.5 px-2 rounded-lg bg-slate-800/90 border border-slate-700/70 hidden xl:flex items-center gap-1.5 text-xs text-white">
              <div className="w-5 h-5 rounded-md bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-[10px] border border-blue-500/30">
                {currentUser.name ? currentUser.name[0].toUpperCase() : 'U'}
              </div>
              <span className="font-medium truncate max-w-[80px] text-[11px]">{currentUser.name}</span>
            </div>

            <button
              onClick={onLogout}
              className="h-8 w-8 sm:w-auto sm:h-8.5 sm:px-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 flex items-center justify-center gap-1 text-xs font-medium text-slate-300 hover:text-red-400 hover:border-red-500/40 transition-colors shadow-sm"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline text-xs">Logout</span>
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenLogin}
            className="h-8 sm:h-8.5 px-2.5 sm:px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center justify-center shadow-md shadow-blue-950/40"
            title="Sign In to Operator Workspace"
            aria-label="Sign In"
          >
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}
