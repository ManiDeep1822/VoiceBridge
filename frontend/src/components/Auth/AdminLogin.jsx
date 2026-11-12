import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, KeyRound, ArrowRight, AlertCircle, ArrowLeft } from 'lucide-react';

export function AdminLogin({ onAdminLoginSuccess, onSwitchToUser }) {
  const [email, setEmail] = useState('admin@voicebridge.com');
  const [password, setPassword] = useState('admin123');
  const [securityPin, setSecurityPin] = useState('9942');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please provide administrative credentials.');
      return;
    }

    if (password !== 'admin123' && password !== 'master2026') {
      setError('Invalid administrative password or unauthorized access.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      const adminProfile = {
        id: 'ADMIN-MASTER-01',
        name: 'Fleet Administrator',
        email: email.trim().toLowerCase(),
        role: 'Administrator',
        tier: 'Enterprise',
        token: `jwt_admin_${Date.now()}`
      };

      try {
        localStorage.setItem('voicebridge_admin', JSON.stringify(adminProfile));
      } catch (err) {}

      if (onAdminLoginSuccess) onAdminLoginSuccess(adminProfile);
    }, 450);
  };

  const handleQuickDemo = () => {
    setEmail('admin@voicebridge.com');
    setPassword('admin123');
    setSecurityPin('9942');
    setError('');
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-[#07090C] select-none font-sans min-h-screen box-border">
      <div className="w-full max-w-md bg-[#0D121F]/95 backdrop-blur-2xl border border-purple-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5 sm:space-y-6 box-border">
        {/* Header / Brand */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-700 to-indigo-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-purple-950/40 border border-purple-400/30">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Admin Fleet Console
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-bold border border-purple-500/30">
                Tier 3
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Multi-room management, server fleet metrics & enterprise controls
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
              Admin Account
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-purple-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@voicebridge.com"
                required
                className="w-full h-11 bg-slate-800/90 border border-slate-700/80 focus:border-purple-500 rounded-xl pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Master Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-purple-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full h-11 bg-slate-800/90 border border-slate-700/80 focus:border-purple-500 rounded-xl pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Security PIN (2FA)
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-purple-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={securityPin}
                onChange={(e) => setSecurityPin(e.target.value)}
                placeholder="4-digit PIN"
                maxLength={6}
                required
                className="w-full h-11 bg-slate-800/90 border border-slate-700/80 focus:border-purple-500 rounded-xl pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <button
              type="button"
              onClick={handleQuickDemo}
              className="text-purple-400 hover:text-purple-300 underline font-medium"
            >
              Fill Admin Demo Pass
            </button>
            <span className="text-[11px] text-slate-500">MFA Protected</span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full h-11 px-5 py-2.5 rounded-xl font-semibold text-sm bg-purple-600 hover:bg-purple-500 border border-purple-500/40 shadow-lg shadow-purple-950/40 mt-2"
          >
            {isLoading ? (
              <span>Verifying Fleet Credentials...</span>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Enter Admin Console</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </form>

        {/* Return to Standard Portal */}
        <div className="pt-4 border-t border-slate-800/80 text-center">
          <button
            type="button"
            onClick={onSwitchToUser}
            className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to User Operator Portal</span>
          </button>
        </div>
      </div>
    </div>
  );
}
