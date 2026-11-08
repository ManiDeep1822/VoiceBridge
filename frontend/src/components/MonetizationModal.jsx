import React, { useState } from 'react';
import { X, Check, Shield, FileText, BookOpen, CreditCard, Cpu, Building2 } from 'lucide-react';

export function MonetizationModal({
  isOpen = false,
  onClose,
  activeTier = 'free',
  onSelectTier,
  currency = 'INR',
  onToggleCurrency
}) {
  const [selectedBillingCycle, setSelectedBillingCycle] = useState('monthly');
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [gstNumber, setGstNumber] = useState('');

  if (!isOpen) return null;

  const isINR = currency === 'INR';

  const pricing = {
    pro: {
      monthly: isINR ? 2999 : 49,
      annual: isINR ? 2399 : 39,
    },
    enterprise: {
      monthly: isINR ? 19999 : 299,
      annual: isINR ? 15999 : 249,
    }
  };

  const symbol = isINR ? '₹' : '$';

  const handleActivate = (tier) => {
    onSelectTier(tier);
    setCheckoutSuccess(true);
    setTimeout(() => {
      setCheckoutSuccess(false);
      onClose();
    }, 1400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md select-none font-sans text-sm">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="bg-slate-800/60 border-b border-slate-800 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                Plans & Licensing
              </h3>
              <p className="text-xs text-slate-400">
                Choose the best plan for individuals and enterprise teams
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleCurrency}
              className="btn-secondary h-9 px-3 rounded-lg text-xs font-medium"
            >
              <span>{isINR ? '₹ INR' : '$ USD'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {checkoutSuccess && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 p-3.5 text-center flex items-center justify-center gap-2 font-semibold text-sm">
              <Check className="w-5 h-5 text-emerald-400" />
              <span>Plan activated successfully! Features unlocked for this session.</span>
            </div>
          )}

          {/* Billing Interval Toggle */}
          <div className="flex justify-center">
            <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-1 flex items-center">
              <button
                onClick={() => setSelectedBillingCycle('monthly')}
                className={`h-9 px-4 rounded-lg text-xs font-semibold transition-colors ${
                  selectedBillingCycle === 'monthly'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setSelectedBillingCycle('annual')}
                className={`h-9 px-4 rounded-lg text-xs font-semibold transition-colors ${
                  selectedBillingCycle === 'annual'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Annual (Save 20%)
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* TIER 1: COMMUNITY / FREE */}
            <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Community</span>
                  {activeTier === 'free' && (
                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      Active
                    </span>
                  )}
                </div>

                <div className="mb-2">
                  <span className="text-3xl font-extrabold text-white">{symbol}0</span>
                  <span className="text-xs text-slate-400 ml-1">/ forever</span>
                </div>

                <p className="text-xs text-slate-400 leading-normal mb-4">
                  Free browser-based live voice translation for personal and casual calls.
                </p>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Unlimited 2-Way Calls</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>45+ Core Languages</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <X className="w-4 h-4 shrink-0" />
                    <span>AI Meeting Minutes</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <X className="w-4 h-4 shrink-0" />
                    <span>Domain Glossaries</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleActivate('free')}
                disabled={activeTier === 'free'}
                className="btn-secondary w-full h-11 px-5 py-2.5 rounded-xl text-sm font-medium"
              >
                {activeTier === 'free' ? 'Current Plan' : 'Select Free'}
              </button>
            </div>

            {/* TIER 2: PRO */}
            <div className="rounded-2xl border-2 border-blue-500 bg-slate-800/80 p-5 flex flex-col justify-between space-y-4 relative shadow-xl shadow-blue-950/30">
              <div className="absolute -top-3 right-4 bg-blue-600 text-white font-bold text-[11px] px-2.5 py-0.5 rounded-full shadow-md">
                Popular
              </div>

              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Professional</span>
                  {activeTier === 'pro' && (
                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      Active
                    </span>
                  )}
                </div>

                <div className="mb-2">
                  <span className="text-3xl font-extrabold text-white">
                    {symbol}{pricing.pro[selectedBillingCycle].toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-400 ml-1">/ month</span>
                </div>

                <p className="text-xs text-slate-300 leading-normal mb-4">
                  For cross-border business calls, international clients, and negotiations.
                </p>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-100">
                    <Check className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>AI Executive Minutes & Summary</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-100">
                    <Check className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Jargon Lock (6 Industry Sectors)</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-100">
                    <Check className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>+6dB Loudspeaker Volume Booster</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-100">
                    <Check className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Priority Low-Latency Route</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleActivate('pro')}
                className="btn-primary w-full h-11 px-5 py-2.5 rounded-xl text-sm font-semibold"
              >
                {activeTier === 'pro' ? 'Current Plan' : 'Upgrade to Pro'}
              </button>
            </div>

            {/* TIER 3: ENTERPRISE */}
            <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold text-purple-400 uppercase tracking-wide">Enterprise</span>
                  {activeTier === 'enterprise' && (
                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      Active
                    </span>
                  )}
                </div>

                <div className="mb-2">
                  <span className="text-3xl font-extrabold text-white">
                    {symbol}{pricing.enterprise[selectedBillingCycle].toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-400 ml-1">/ month</span>
                </div>

                <p className="text-xs text-slate-400 leading-normal mb-4">
                  Multi-seat enterprise solution with compliance, dedicated servers, and custom SLAs.
                </p>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-200">
                    <Check className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Unlimited Enterprise Seats</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-200">
                    <Check className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Indian GSTIN Corporate Tax Invoices</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-200">
                    <Check className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Dedicated Private WebSocket Node</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-200">
                    <Check className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Custom Vocabulary Modeling</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleActivate('enterprise')}
                className="btn-secondary w-full h-11 px-5 py-2.5 rounded-xl text-sm font-semibold"
              >
                {activeTier === 'enterprise' ? 'Current Plan' : 'Select Enterprise'}
              </button>
            </div>
          </div>

          {/* Corporate GST Verification Panel */}
          <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span>Corporate GST Tax Invoice (India)</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                18% Input Tax Credit (ITC) applied automatically to corporate registrations.
              </p>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                placeholder="27AAAAA0000A1Z5"
                maxLength={15}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44 uppercase"
              />
              <button
                type="button"
                onClick={() => alert(`GSTIN ${gstNumber || 'VERIFIED'}: Invoice eligibility confirmed.`)}
                className="btn-secondary h-11 px-5 py-2.5 rounded-xl text-xs font-medium shrink-0"
              >
                Verify
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
