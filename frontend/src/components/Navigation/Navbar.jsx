import React, { useState, useEffect, useRef } from 'react';
import { 
  PhoneCall, 
  LayoutDashboard, 
  ShieldCheck, 
  Settings, 
  CreditCard, 
  LogOut, 
  Radio, 
  ChevronDown, 
  User, 
  Activity, 
  Lock, 
  Sparkles,
  Users,
  Shield
} from 'lucide-react';

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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsProfileOpen(false);
      }
    }

    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileOpen]);

  const isAdmin = currentUser?.role === 'Administrator';
  const userInitial = currentUser?.name ? currentUser.name[0].toUpperCase() : 'U';

  return (
    <header className="w-full max-w-full bg-[#0F131C]/95 backdrop-blur-md border-b border-slate-800/90 px-2 sm:px-4 py-2 flex items-center justify-between select-none z-30 shrink-0 font-sans box-border overflow-visible">
      {/* Left: Brand Identity & Public Navigation Tabs */}
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
                Enterprise
              </span>
            </div>
            <span className="text-[10px] text-slate-400 hidden sm:block truncate leading-none">
              Real-Time Call Translator
            </span>
          </div>
        </div>

        {/* Center: Desktop Navigation Tabs (Public - strictly no admin tab) */}
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
        </nav>
      </div>

      {/* Right: Actions, Telemetry & User Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Mobile Tab Switcher (Public - strictly no admin tab) */}
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
        </div>

        {/* Telemetry & Connection Badge (Obsidian Sentinel tokens) */}
        <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${
              connectionState === 'connected' ? 'bg-emerald-400 glow-emerald animate-pulse' :
              connectionState === 'waiting' ? 'bg-amber-400 glow-amber animate-pulse' :
              connectionState === 'connecting' ? 'bg-blue-400 glow-blue animate-pulse' : 'bg-slate-500'
            }`} />
            <span className="text-slate-300 text-[11px] font-medium">
              {connectionState === 'connected' ? 'Live Connected' :
               connectionState === 'waiting' ? 'Waiting Peer' :
               connectionState === 'connecting' ? 'Connecting...' : 'Ready'}
            </span>
          </div>

          <span className="w-px h-3 bg-slate-700/60" />

          {/* Telemetry pill: 24ms RTT • Opus 48kHz */}
          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
            <Activity className="w-3 h-3 text-blue-400" />
            <span>24ms RTT</span>
          </div>

          <span className="w-px h-3 bg-slate-700/60" />

          {/* Room participant count */}
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <Users className="w-3 h-3 text-slate-400" />
            <span>{roomParticipantCount} In Call</span>
          </div>
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

        {/* User Profile Dropdown OR Sign In */}
        {currentUser ? (
          <div className="relative" ref={dropdownRef}>
            {/* User Profile Trigger Button */}
            <button
              onClick={() => setIsProfileOpen(prev => !prev)}
              className={`h-8 sm:h-8.5 px-2 sm:px-2.5 rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                isProfileOpen 
                  ? 'bg-slate-800 border-blue-500 shadow-sm ring-1 ring-blue-500/30' 
                  : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 hover:border-slate-600'
              }`}
              title="User Profile & Security Settings"
              aria-label="User Profile"
              aria-expanded={isProfileOpen}
            >
              {/* Avatar Initial with Role Indicator */}
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 text-white ${
                isAdmin 
                  ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 border border-purple-400/40 shadow-sm shadow-purple-950/40' 
                  : 'bg-gradient-to-tr from-blue-600 to-cyan-600 border border-blue-400/40 shadow-sm shadow-blue-950/40'
              }`}>
                {userInitial}
              </div>

              {/* User Name & Role Pill (Desktop) */}
              <div className="hidden xl:flex flex-col items-start text-left min-w-0">
                <span className="text-xs font-semibold text-white leading-tight truncate max-w-[100px]">
                  {currentUser.name}
                </span>
                <span className={`text-[10px] font-medium leading-none ${
                  isAdmin ? 'text-purple-400' : 'text-blue-400'
                }`}>
                  {isAdmin ? 'Administrator' : 'Operator'}
                </span>
              </div>

              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                isProfileOpen ? 'rotate-180 text-blue-400' : ''
              }`} />
            </button>

            {/* Enterprise User Profile Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-[#0F131C] border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 p-3.5 z-50 animate-fadeIn backdrop-blur-2xl box-border">
                {/* User Identity Header */}
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800/80">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 ${
                    isAdmin 
                      ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 border border-purple-400/40 shadow-md shadow-purple-950/50' 
                      : 'bg-gradient-to-tr from-blue-600 to-cyan-600 border border-blue-400/40 shadow-md shadow-blue-950/50'
                  }`}>
                    {userInitial}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-sm text-white truncate">
                        {currentUser.name}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 truncate block">
                      {currentUser.email || `${currentUser.role.toLowerCase()}@voicebridge.corp`}
                    </span>
                    <div className="mt-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        isAdmin 
                          ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' 
                          : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                      }`}>
                        {isAdmin ? <Shield className="w-3 h-3 text-purple-400" /> : <User className="w-3 h-3 text-blue-400" />}
                        <span>{isAdmin ? 'Administrator' : 'Operator'}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Session Security Indicator */}
                <div className="my-2.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-emerald-400" />
                    <span>Session Security</span>
                  </span>
                  <span className="text-emerald-400 font-medium">Active (AES-256)</span>
                </div>

                {/* Dropdown Navigation Actions */}
                <div className="space-y-1">
                  {/* CRITICAL RBAC RULE: ONLY show 'Admin Fleet Console' if currentUser.role === 'Administrator' */}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        if (onSelectTab) onSelectTab('admin-dashboard');
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-800/50 text-purple-200 text-xs font-semibold flex items-center gap-2.5 transition-all group cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
                      <div className="flex-1 text-left flex items-center justify-between">
                        <span>Admin Fleet Console</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">
                          Tier 3
                        </span>
                      </div>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      if (onSelectTab) onSelectTab('user-dashboard');
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-slate-800/90 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <LayoutDashboard className="w-4 h-4 text-slate-400" />
                    <span>Operator Workspace</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      if (onOpenSettings) onOpenSettings();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-slate-800/90 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>Audio & Language Settings</span>
                  </button>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-800/80 my-2" />

                {/* Logout Action */}
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-red-400" />
                  <span>Terminate Session / Sign Out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenLogin}
            className="h-8 sm:h-8.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-blue-950/40 cursor-pointer"
            title="Sign In to Enterprise Workspace"
            aria-label="Sign In"
          >
            <User className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}
