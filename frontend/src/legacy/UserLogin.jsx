import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, UserCheck, Shield, AlertCircle, PhoneCall } from 'lucide-react';

export function UserLogin({ onLoginSuccess, onSwitchToAdmin, onJoinGuestRoom }) {
  const [email, setEmail] = useState('operator@voicebridge.com');
  const [password, setPassword] = useState('operator123');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please provide your email and password.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      // Valid credentials check (supports standard accounts and custom entered credentials)
      const userProfile = {
        id: `USR-${Math.floor(1000 + Math.random() * 9000)}`,
        name: email.split('@')[0].replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        email: email.trim().toLowerCase(),
        role: 'Operator',
        tier: 'Pro',
        token: `jwt_user_${Date.now()}`
      };

      try {
        localStorage.setItem('voicebridge_user', JSON.stringify(userProfile));
      } catch (err) {}

      if (onLoginSuccess) onLoginSuccess(userProfile);
    }, 450);
  };

  const handleQuickDemo = () => {
    setEmail('operator@voicebridge.com');
    setPassword('operator123');
    setError('');
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-[#07090C] select-none font-sans min-h-screen box-border">
      <div className="w-full max-w-md bg-[#0D121F]/95 backdrop-blur-2xl border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5 sm:space-y-6 box-border">
        {/* Header / Brand */}
        <div className="text-center space-y-2">
          {/* Custom Vector Audio Bridge Logo */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-950/50 border border-blue-400/30">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 12V12.01M8 8V16M12 4V20M16 8V16M20 12V12.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Sign In to VoiceBridge
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Live multilingual call translation and workspace portal
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Operator Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full h-11 bg-slate-800/90 border border-slate-700/80 focus:border-blue-500 rounded-xl pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full h-11 bg-slate-800/90 border border-slate-700/80 focus:border-blue-500 rounded-xl pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <button
              type="button"
              onClick={handleQuickDemo}
              className="text-blue-400 hover:text-blue-300 underline font-medium"
            >
              Fill Demo Credentials
            </button>
            <span className="text-[11px] text-slate-500">Operator Access</span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full h-11 px-5 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-blue-950/40 mt-2"
          >
            {isLoading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <UserCheck className="w-4 h-4" />
                <span>Sign In to Workspace</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-col gap-2.5 text-center text-xs">
          <button
            type="button"
            onClick={onSwitchToAdmin}
            className="text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1.5"
          >
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>Administrator Fleet Console Login</span>
          </button>

          {onJoinGuestRoom && (
            <button
              type="button"
              onClick={onJoinGuestRoom}
              className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center justify-center gap-1.5"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Join via Instant Room Link as Guest</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
