import React from 'react';
import { PhoneCall, LayoutDashboard, ShieldCheck, Settings, CreditCard, LogOut } from 'lucide-react';

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
  onOpenLogin
}) {
  const isINR = currency === 'INR';

  return (
    <header className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-3 sm:px-4 py-2 flex items-center justify-between select-none z-30 shrink-0 font-sans">
      {/* Left: Brand Identity */}
      <div className="flex items-center gap-3 sm:gap-6">
        <div 
          className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group" 
          onClick={() => onSelectTab('studio')}
        >
          {/* Professional Vector SVG VoiceBridge Logo (Zero AI artifacts) */}
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 12V12.01M8 8V16M12 4V20M16 8V16M20 12V12.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-bold text-sm sm:text-base tracking-tight text-white">
                VoiceBridge
              </span>
              <span className="text-[10px] px-1.5 sm:px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium border border-slate-700">
                Enterprise
              </span>
            </div>
            <span className="text-[11px] sm:text-xs text-slate-400">
              Live Call Translator
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
      <div className="flex items-center gap-2 sm:gap-2.5">
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
          className="btn-secondary h-11 px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-medium"
          title="Plans & Pricing"
        >
          <CreditCard className="w-4 h-4 text-slate-300 shrink-0" />
          <span className="hidden sm:inline">{isINR ? '₹' : '$'} Plan:</span>
          <span className="font-semibold text-white uppercase">{activeTier}</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="btn-secondary h-11 px-3 sm:px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-300 hover:text-white"
          title="Audio & Language Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Settings</span>
        </button>

        {/* User Profile & Sign Out OR Sign In */}
        {currentUser ? (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="h-11 px-3 rounded-xl bg-slate-800/80 border border-slate-700/60 hidden lg:flex items-center gap-2 text-xs text-white">
              <div className="w-6 h-6 rounded-lg bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center text-[11px]">
                {currentUser.name ? currentUser.name[0] : 'U'}
              </div>
              <span className="font-medium truncate max-w-[90px]">{currentUser.name}</span>
            </div>

            <button
              onClick={onLogout}
              className="btn-secondary h-11 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-slate-300 hover:text-red-400 hover:border-red-500/40"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenLogin}
            className="btn-primary h-11 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold"
            title="Sign In to Operator Workspace"
          >
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}
