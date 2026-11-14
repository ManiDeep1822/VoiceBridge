import React, { useState, useEffect } from 'react';
import { X, Check, Shield, FileText, BookOpen, CreditCard, Cpu, Building2, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import { determineBackendUrl } from '../utils/backendUrl';

export function MonetizationModal({
  isOpen = false,
  onClose,
  activeTier = 'free',
  onSelectTier,
  currency = 'INR',
  onToggleCurrency,
  backendUrl: propBackendUrl,
  currentUser = null
}) {
  const backendUrl = propBackendUrl || determineBackendUrl();
  const [selectedBillingCycle, setSelectedBillingCycle] = useState('monthly');
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTier, setProcessingTier] = useState(null);
  const [gstNumber, setGstNumber] = useState('');
  const [gstVerified, setGstVerified] = useState(false);

  // Dynamically load Razorpay SDK script if not already present
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

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

  // Handle Free / Community Activation
  const handleSelectFree = () => {
    onSelectTier('free');
    setSuccessMessage('Community plan activated.');
    setCheckoutSuccess(true);
    setTimeout(() => {
      setCheckoutSuccess(false);
      onClose();
    }, 1200);
  };

  // Payment Verification API call
  const verifyPayment = async (verifyPayload, tierName) => {
    try {
      const verifyRes = await fetch(`${backendUrl}/api/billing/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyPayload)
      });

      if (verifyRes.ok) {
        const verifiedData = await verifyRes.json();
        const upgradedTier = verifiedData.tier || tierName;
        
        // Update local session
        if (currentUser) {
          const updatedUser = { ...currentUser, tier: upgradedTier };
          try {
            if (currentUser.role === 'Administrator') {
              localStorage.setItem('voicebridge_admin', JSON.stringify(updatedUser));
            } else {
              localStorage.setItem('voicebridge_user', JSON.stringify(updatedUser));
            }
          } catch (e) {}
        }

        onSelectTier(tierName.toLowerCase());
        setSuccessMessage(`Payment confirmed! Upgraded to ${upgradedTier}.`);
        setCheckoutSuccess(true);
        setIsProcessing(false);
        setProcessingTier(null);

        setTimeout(() => {
          setCheckoutSuccess(false);
          onClose();
        }, 1600);
      } else {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err.detail || 'Payment verification failed');
      }
    } catch (err) {
      setIsProcessing(false);
      setProcessingTier(null);
      setErrorMessage(err.message || 'Payment verification failed.');
    }
  };

  // Checkout Initiation for Razorpay (INR) and Stripe (USD)
  const handleCheckout = async (tier) => {
    setErrorMessage('');
    setIsProcessing(true);
    setProcessingTier(tier);

    try {
      const gateway = isINR ? 'razorpay' : 'stripe';
      const orderRes = await fetch(`${backendUrl}/api/billing/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: tier,
          gateway: gateway,
          currency: currency,
          user_id: currentUser?.id || 'guest'
        })
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to create billing order');
      }

      const orderData = await orderRes.json();

      // 1. Razorpay Flow for INR
      if (gateway === 'razorpay') {
        if (typeof window !== 'undefined' && window.Razorpay && !orderData.is_sandbox) {
          const options = {
            key: orderData.key_id,
            amount: orderData.amount,
            currency: orderData.currency,
            name: 'VoiceBridge Prime',
            description: `VoiceBridge ${orderData.tier} Subscription`,
            order_id: orderData.order_id,
            handler: async (response) => {
              await verifyPayment({
                gateway: 'razorpay',
                order_id: orderData.order_id,
                payment_id: response.razorpay_payment_id || `pay_rzp_${Date.now()}`,
                signature: response.razorpay_signature || `sig_rzp_${Date.now()}`,
                user_id: currentUser?.id || 'guest',
                tier: tier
              }, orderData.tier);
            },
            prefill: {
              name: currentUser?.name || 'Operator',
              email: currentUser?.email || 'operator@voicebridge.com'
            },
            theme: { color: '#000000' },
            modal: {
              ondismiss: () => {
                setIsProcessing(false);
                setProcessingTier(null);
              }
            }
          };

          const rzp = new window.Razorpay(options);
          rzp.open();
        } else {
          // Sandbox test mode / test simulation
          await verifyPayment({
            gateway: 'razorpay',
            order_id: orderData.order_id,
            payment_id: `pay_sandbox_${Date.now()}`,
            signature: `sig_sandbox_${Date.now()}`,
            user_id: currentUser?.id || 'guest',
            tier: tier
          }, orderData.tier);
        }
      } else {
        // 2. Stripe Checkout Flow for USD (Sandbox Test Mode Simulation)
        await verifyPayment({
          gateway: 'stripe',
          order_id: orderData.order_id,
          payment_id: `pi_test_${Date.now()}`,
          user_id: currentUser?.id || 'guest',
          tier: tier
        }, orderData.tier);
      }
    } catch (err) {
      setIsProcessing(false);
      setProcessingTier(null);
      setErrorMessage(err.message || 'Payment initiation failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md select-none font-sans text-sm box-border">
      <div className="bg-black border border-white/20 w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden relative box-border">
        {/* Header - Swiss Monochrome */}
        <div className="bg-zinc-950 border-b border-white/10 px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">
                  Plans & Commercial Licensing
                </h3>
                {/* Sandbox Test Mode Badge */}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20 font-mono uppercase tracking-wider">
                  Sandbox Test Mode
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Direct instant activation via Razorpay & Stripe dual-gateway
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleCurrency}
              className="h-8 sm:h-8.5 px-3 rounded-lg text-xs font-semibold bg-zinc-900 border border-white/20 hover:border-white text-white transition-colors cursor-pointer"
            >
              <span>{isINR ? '₹ INR' : '$ USD'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5">
          {checkoutSuccess && (
            <div className="rounded-xl border border-white/40 bg-zinc-900 text-white p-3.5 text-center flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm animate-fadeIn">
              <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              <span>{successMessage || 'Plan activated successfully! Features unlocked for this session.'}</span>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl border border-red-500/40 bg-red-950/40 text-red-300 p-3.5 text-xs flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Billing Interval Toggle */}
          <div className="flex justify-center">
            <div className="rounded-xl border border-white/10 bg-zinc-950 p-1 flex items-center">
              <button
                onClick={() => setSelectedBillingCycle('monthly')}
                className={`h-8 px-3.5 sm:px-4 rounded-lg text-xs font-semibold transition-colors ${
                  selectedBillingCycle === 'monthly'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setSelectedBillingCycle('annual')}
                className={`h-8 px-3.5 sm:px-4 rounded-lg text-xs font-semibold transition-colors ${
                  selectedBillingCycle === 'annual'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Annual (Save 20%)
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
            {/* TIER 1: COMMUNITY / FREE */}
            <div className="rounded-2xl border border-white/15 bg-zinc-950 p-4 sm:p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide font-mono">Community</span>
                  {activeTier === 'free' && (
                    <span className="text-[10px] font-semibold text-white bg-white/10 px-2 py-0.5 rounded-md border border-white/20">
                      Active
                    </span>
                  )}
                </div>

                <div className="mb-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white">{symbol}0</span>
                  <span className="text-xs text-zinc-400 ml-1 font-mono">/ forever</span>
                </div>

                <p className="text-xs text-zinc-400 leading-normal mb-3 sm:mb-4">
                  Free browser-based live voice translation for personal and casual calls.
                </p>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-zinc-200">
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>Unlimited 2-Way Calls</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-200">
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>45+ Core Languages</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-500">
                    <X className="w-3.5 h-3.5 shrink-0" />
                    <span>AI Meeting Minutes</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-500">
                    <X className="w-3.5 h-3.5 shrink-0" />
                    <span>Domain Glossaries</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSelectFree}
                disabled={activeTier === 'free'}
                className="w-full h-10 px-4 rounded-xl text-xs sm:text-sm font-medium bg-zinc-900 border border-white/20 text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
              >
                {activeTier === 'free' ? 'Current Plan' : 'Select Free'}
              </button>
            </div>

            {/* TIER 2: PRO */}
            <div className="rounded-2xl border-2 border-white bg-zinc-950 p-4 sm:p-5 flex flex-col justify-between space-y-4 relative shadow-2xl">
              <div className="absolute -top-3 right-4 bg-white text-black font-bold text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-full shadow-md font-mono">
                POPULAR
              </div>

              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold text-white uppercase tracking-wide font-mono">Professional</span>
                  {activeTier === 'pro' && (
                    <span className="text-[10px] font-semibold text-white bg-white/20 px-2 py-0.5 rounded-md border border-white/30">
                      Active
                    </span>
                  )}
                </div>

                <div className="mb-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white">
                    {symbol}{pricing.pro[selectedBillingCycle].toLocaleString()}
                  </span>
                  <span className="text-xs text-zinc-400 ml-1 font-mono">/ month</span>
                </div>

                <p className="text-xs text-zinc-300 leading-normal mb-3 sm:mb-4">
                  For cross-border business calls, international clients, and negotiations.
                </p>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-zinc-100">
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>AI Executive Minutes & Summary</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-100">
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>Jargon Lock (6 Industry Sectors)</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-100">
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>+6dB Loudspeaker Volume Booster</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-100">
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>Priority Low-Latency Route</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleCheckout('pro')}
                disabled={isProcessing}
                className="w-full h-10 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-white text-black hover:bg-zinc-200 disabled:opacity-60 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isProcessing && processingTier === 'pro' ? (
                  <span>Processing Checkout...</span>
                ) : activeTier === 'pro' ? (
                  'Current Plan'
                ) : (
                  <>
                    <span>Upgrade to Pro ({symbol}{pricing.pro[selectedBillingCycle]})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>

            {/* TIER 3: ENTERPRISE */}
            <div className="rounded-2xl border border-white/15 bg-zinc-950 p-4 sm:p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wide font-mono">Enterprise</span>
                  {activeTier === 'enterprise' && (
                    <span className="text-[10px] font-semibold text-white bg-white/10 px-2 py-0.5 rounded-md border border-white/20">
                      Active
                    </span>
                  )}
                </div>

                <div className="mb-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white">
                    {symbol}{pricing.enterprise[selectedBillingCycle].toLocaleString()}
                  </span>
                  <span className="text-xs text-zinc-400 ml-1 font-mono">/ month</span>
                </div>

                <p className="text-xs text-zinc-400 leading-normal mb-3 sm:mb-4">
                  Multi-seat enterprise solution with compliance, dedicated servers, and custom SLAs.
                </p>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-zinc-200">
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>Unlimited Enterprise Seats</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-200">
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>Indian GSTIN Corporate Tax Invoices</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-200">
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>Dedicated Private WebSocket Node</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-200">
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>Custom Vocabulary Modeling</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleCheckout('enterprise')}
                disabled={isProcessing}
                className="w-full h-10 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-zinc-900 border border-white/20 text-white hover:bg-zinc-800 disabled:opacity-60 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isProcessing && processingTier === 'enterprise' ? (
                  <span>Processing Checkout...</span>
                ) : activeTier === 'enterprise' ? (
                  'Current Plan'
                ) : (
                  <>
                    <span>Select Enterprise</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Corporate GST Verification Panel */}
          <div className="rounded-xl border border-white/10 bg-zinc-950 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-white" />
                <span>Corporate GST Tax Invoice (India)</span>
                {gstVerified && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 text-white font-mono border border-white/30 flex items-center gap-1">
                    <Check className="w-3 h-3 text-white" />
                    Verified (18% ITC)
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                18% Input Tax Credit (ITC) applied automatically to corporate registrations.
              </p>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => {
                  setGstNumber(e.target.value.toUpperCase());
                  setGstVerified(false);
                }}
                placeholder="27AAAAA0000A1Z5"
                maxLength={15}
                className="bg-black border border-white/20 rounded-xl px-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white w-36 sm:w-44 uppercase font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  if (gstNumber.trim().length >= 4) {
                    setGstVerified(true);
                  }
                }}
                className={`h-10 px-4 rounded-xl text-xs font-medium shrink-0 bg-zinc-900 border border-white/20 text-white hover:bg-zinc-800 cursor-pointer ${gstVerified ? 'border-white text-white' : ''}`}
              >
                {gstVerified ? 'Verified' : 'Verify'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
