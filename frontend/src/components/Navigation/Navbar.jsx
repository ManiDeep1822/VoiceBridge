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
    <header className="w-full max-w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-2.5 sm:px-4 py-2 flex items-center justify-between select-none z-30 shrink-0 font-sans overflow-hidden">
      {/* Left: Brand Identity */}
      <div className="flex items-center gap-2 sm:gap-6 min-w-0">
        <div 
          className="flex items-center gap-2 sm:gap-3 cursor-pointer group min-w-0" 
          onClick={() => onSelectTab('studio')}
        >
          {/* Professional Vector SVG VoiceBridge Logo */}
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="sm:w-5 sm:h-5">
              <path d="M4 12V12.01M8 8V16M12 4V20M16 8V16M20 12V12.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm sm:text-base tracking-tight text-white truncate">
                VoiceBridge
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium border border-slate-700 hidden xs:inline">
                Enterprise
              </span>
            </div>
            <span className="text-[10px] sm:text-xs text-slate-400 hidden sm:block truncate">
              Live Call Translator
            </span>
          </div>
        </div>

        {/* Center: Navigation System (Desktop) */}
        <nav className="hidden md:flex items-center gap-1.5 p-1 bg-slate-800/60 rounded-xl border border-slate-700/50">
          <button
            onClick={() => onSelectTab('studio')}
            className={`h-9 px-3.5 rounded-lg flex items-center gap-2 transition-all text-xs font-semibold ${
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
            className={`h-9 px-3.5 rounded-lg flex items-center gap-2 transition-all text-xs font-semibold ${
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
            className={`h-9 px-3.5 rounded-lg flex items-center gap-2 transition-all text-xs font-semibold ${
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
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Mobile Tab Switcher Icons */}
        <div className="flex md:hidden items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 mr-1">
          <button
            onClick={() => onSelectTab('studio')}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
              activeTab === 'studio' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
            title="Call Studio"
          >
            <PhoneCall className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSelectTab('user-dashboard')}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
              activeTab === 'user-dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
            title="Workspace Dashboard"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSelectTab('admin-dashboard')}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
              activeTab === 'admin-dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
            title="Admin Fleet"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Connection State Badge (Desktop) */}
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
          className="h-8 sm:h-9 px-2 sm:px-3 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-xs font-medium flex items-center gap-1 text-slate-200 transition-colors"
          title="Plans & Pricing"
        >
          <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300 shrink-0" />
          <span className="hidden sm:inline">{isINR ? '₹' : '$'} Plan:</span>
          <span className="font-semibold text-white uppercase text-[11px] sm:text-xs">{activeTier}</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="w-8 h-8 sm:w-auto sm:h-9 sm:px-3 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors"
          title="Audio & Language Settings"
          aria-label="Settings"
        >
          <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="hidden sm:inline">Settings</span>
        </button>

        {/* User Profile & Sign Out OR Sign In */}
        {currentUser ? (
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="h-8 px-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 hidden lg:flex items-center gap-2 text-xs text-white">
              <div className="w-5 h-5 rounded-md bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center text-[10px]">
                {currentUser.name ? currentUser.name[0] : 'U'}
              </div>
              <span className="font-medium truncate max-w-[80px]">{currentUser.name}</span>
            </div>

            <button
              onClick={onLogout}
              className="h-8 w-8 sm:w-auto sm:px-3 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 flex items-center justify-center gap-1 text-xs font-medium text-slate-300 hover:text-red-400 hover:border-red-500/40 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenLogin}
            className="h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-lg sm:rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center justify-center"
            title="Sign In to Operator Workspace"
          >
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}
