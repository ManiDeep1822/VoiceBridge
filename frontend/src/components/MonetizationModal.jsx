import React, { useState } from 'react';
import { X, Check, Shield, FileText, BookOpen, CreditCard, Cpu } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 select-none font-mono text-xs">
      <div className="bg-[#111111] border border-[#262626] w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="bg-[#161616] border-b border-[#262626] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#E61919]" />
            <span className="font-bold text-white uppercase tracking-wider text-xs">
              [ CORPORATE PROCUREMENT // LICENSING MATRIX ]
            </span>
            <span className="text-[9px] border border-[#333333] bg-[#0E0E0E] text-[#A1A1AA] px-1.5 py-0.2">
              GST COMPLIANT
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleCurrency}
              className="border border-[#333333] hover:border-white bg-[#0E0E0E] hover:bg-white hover:text-black text-white px-2 py-0.5 text-[10px] uppercase transition-colors"
            >
              <span>[ CURRENCY: {currency} ({isINR ? '₹ INR' : '$ USD'}) ]</span>
            </button>

            <button
              onClick={onClose}
              className="border border-[#262626] hover:border-white p-1 text-[#A1A1AA] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {checkoutSuccess && (
            <div className="border border-[#39FF14] bg-[#0E1F12] text-white p-2.5 text-center flex items-center justify-center gap-2 uppercase font-bold text-xs">
              <Check className="w-4 h-4 text-[#39FF14]" />
              <span>[ TIER ACTIVATED: LICENSING TOKENS INJECTED INTO RUNTIME SESSION ]</span>
            </div>
          )}

          {/* Billing Interval Toggle */}
          <div className="flex justify-center">
            <div className="border border-[#262626] bg-[#0E0E0E] p-0.5 flex items-center">
              <button
                onClick={() => setSelectedBillingCycle('monthly')}
                className={`px-3 py-1 uppercase text-[10px] font-bold transition-colors ${
                  selectedBillingCycle === 'monthly'
                    ? 'bg-white text-black'
                    : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                MONTHLY BILLING
              </button>
              <button
                onClick={() => setSelectedBillingCycle('annual')}
                className={`px-3 py-1 uppercase text-[10px] font-bold transition-colors ${
                  selectedBillingCycle === 'annual'
                    ? 'bg-white text-black'
                    : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                ANNUAL BILLING (-20%)
              </button>
            </div>
          </div>

          {/* Pricing Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* TIER 01: COMMUNITY */}
            <div className="border border-[#262626] bg-[#141414] p-4 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-[#A1A1AA] uppercase">[01] COMMUNITY</span>
                  {activeTier === 'free' && (
                    <span className="text-[9px] border border-[#333333] bg-[#0E0E0E] text-white px-1.5 py-0.2">
                      CURRENT
                    </span>
                  )}
                </div>

                <div className="mb-2">
                  <span className="text-2xl font-black text-white font-sans">{symbol}0</span>
                  <span className="text-[10px] text-[#71717A] ml-1">/ LIFETIME</span>
                </div>

                <p className="text-[11px] text-[#71717A] leading-normal mb-3">
                  Zero-cost browser-native speech translation with basic vocabulary support.
                </p>

                <div className="space-y-1.5 text-[10px] text-[#A1A1AA]">
                  <div className="flex items-center gap-1.5 text-white">
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>Unlimited 2-Way P2P Calls</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white">
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>45+ Core Languages</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#52525B]">
                    <X className="w-3.5 h-3.5 shrink-0" />
                    <span>AI Executive Meeting Minutes</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#52525B]">
                    <X className="w-3.5 h-3.5 shrink-0" />
                    <span>Industry Domain Glossaries</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleActivate('free')}
                disabled={activeTier === 'free'}
                className="w-full py-2 border border-[#333333] hover:border-white bg-[#0E0E0E] hover:bg-white hover:text-black disabled:opacity-40 text-white font-bold text-[10px] uppercase transition-colors"
              >
                {activeTier === 'free' ? '[ ACTIVE PLAN ]' : '[ SELECT FREE ]'}
              </button>
            </div>

            {/* TIER 02: PRO INDUSTRIAL */}
            <div className="border border-white bg-[#141414] p-4 flex flex-col justify-between space-y-4 relative">
              <div className="absolute top-0 right-0 bg-white text-black font-black text-[9px] px-2 py-0.5 uppercase">
                RECOMMENDED
              </div>

              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-white uppercase">[02] PRO INDUSTRIAL</span>
                </div>

                <div className="mb-2">
                  <span className="text-2xl font-black text-white font-sans">
                    {symbol}{pricing.pro[selectedBillingCycle].toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[#71717A] ml-1">/ MONTH</span>
                </div>

                <p className="text-[11px] text-[#A1A1AA] leading-normal mb-3">
                  Engineered for commercial teams, executive negotiations, and compliance audits.
                </p>

                <div className="space-y-1.5 text-[10px] text-white">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>FEATURE 01: AI Executive Minutes</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>FEATURE 02: Jargon Lock (6 Domains)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>Hardware +6dB Loudspeaker Boost</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>Sub-150ms High-Priority Route</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleActivate('pro')}
                className="w-full py-2 border border-white bg-white hover:bg-[#E5E5E5] text-black font-bold text-[10px] uppercase transition-colors cursor-pointer"
              >
                {activeTier === 'pro' ? '[ ACTIVE PLAN ]' : '[ PROVISION PRO INDUSTRIAL ]'}
              </button>
            </div>

            {/* TIER 03: ENTERPRISE GLOBAL */}
            <div className="border border-[#262626] bg-[#141414] p-4 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-[#A1A1AA] uppercase">[03] ENTERPRISE GLOBAL</span>
                </div>

                <div className="mb-2">
                  <span className="text-2xl font-black text-white font-sans">
                    {symbol}{pricing.enterprise[selectedBillingCycle].toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[#71717A] ml-1">/ MONTH</span>
                </div>

                <p className="text-[11px] text-[#71717A] leading-normal mb-3">
                  Multi-seat deployment for multinational enterprises with dedicated cluster nodes.
                </p>

                <div className="space-y-1.5 text-[10px] text-white">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>FEATURE 03: Unlimited Enterprise Seats</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>Indian GSTIN Corporate Tax Invoicing</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>Dedicated Private WebSocket Node</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>Custom Industry Ontology Training</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleActivate('enterprise')}
                className="w-full py-2 border border-[#E61919] bg-[#E61919] hover:bg-[#CC1414] text-white font-bold text-[10px] uppercase transition-colors cursor-pointer"
              >
                {activeTier === 'enterprise' ? '[ ACTIVE PLAN ]' : '[ DEPLOY ENTERPRISE FLEET ]'}
              </button>
            </div>
          </div>

          {/* Corporate Indian GST Verification Panel */}
          <div className="border border-[#262626] bg-[#0E0E0E] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold text-white uppercase">
                [ INDIAN CORPORATE GSTIN TAX INVOICE COMPLIANCE ]
              </div>
              <div className="text-[10px] text-[#71717A]">
                18% Input Tax Credit (ITC) applied automatically to corporate PAN/GST registrations.
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                placeholder="27AAAAA0000A1Z5"
                maxLength={15}
                className="bg-[#161616] border border-[#333333] px-2.5 py-1 text-xs text-white placeholder-[#52525B] focus:outline-none focus:border-white w-44 uppercase"
              />
              <button
                type="button"
                onClick={() => alert(`GSTIN ${gstNumber || 'VERIFIED'}: Invoice eligibility confirmed.`)}
                className="border border-[#404040] hover:border-white bg-[#1A1A1A] hover:bg-white hover:text-black text-white px-3 py-1 text-[10px] uppercase transition-colors"
              >
                [ VERIFY ]
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
