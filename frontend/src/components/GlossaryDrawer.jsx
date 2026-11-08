import React, { useState } from 'react';
import { X, BookOpen, Lock, Check, Plus, Trash2, ShieldCheck } from 'lucide-react';
import { INDUSTRY_DOMAINS } from '../utils/glossaries.js';

export function GlossaryDrawer({
  isOpen = false,
  onClose,
  activeDomain = 'general',
  onSelectDomain,
  activeTier = 'free',
  onOpenUpgrade
}) {
  const [customTermSource, setCustomTermSource] = useState('');
  const [customTermTarget, setCustomTermTarget] = useState('');
  const [customGlossary, setCustomGlossary] = useState([
    { id: 1, source: 'EBITDA', target: 'EBITDA (Earnings Before Interest, Taxes)', domain: 'fintech' },
    { id: 2, source: 'myocardial infarction', target: 'myocardial infarction (Heart Event)', domain: 'medical' }
  ]);

  if (!isOpen) return null;

  const isProOrEnterprise = activeTier === 'pro' || activeTier === 'enterprise';

  const handleAddTerm = (e) => {
    e.preventDefault();
    if (!customTermSource.trim() || !customTermTarget.trim()) return;

    setCustomGlossary(prev => [
      ...prev,
      {
        id: Date.now(),
        source: customTermSource.trim(),
        target: customTermTarget.trim(),
        domain: activeDomain
      }
    ]);
    setCustomTermSource('');
    setCustomTermTarget('');
  };

  const handleRemoveTerm = (id) => {
    setCustomGlossary(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/85 select-none font-mono text-xs">
      <div className="w-full max-w-2xl bg-[#111111] border-l border-[#262626] h-full flex flex-col justify-between shadow-2xl">
        {/* Header */}
        <div className="bg-[#161616] border-b border-[#262626] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#E61919]" />
            <span className="font-bold text-white uppercase tracking-wider text-xs">
              [ JARGON LOCK // PROPRIETARY TERMINOLOGY ENGINE ]
            </span>
          </div>

          <button onClick={onClose} className="border border-[#262626] hover:border-white p-1 text-[#A1A1AA] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          <p className="text-[11px] text-[#71717A] leading-relaxed">
            Locks critical specialized jargon into preserved tokens so machine translation models never hallucinate or mistranslate proprietary definitions.
          </p>

          {/* Domain Selection Matrix */}
          <div>
            <span className="text-[10px] text-[#71717A] uppercase font-bold">[ SELECT ACTIVE SECTOR DOMAIN ]</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              {INDUSTRY_DOMAINS.map((domain) => {
                const isActive = activeDomain === domain.id;
                return (
                  <button
                    key={domain.id}
                    onClick={() => onSelectDomain(domain.id)}
                    className={`p-2.5 border text-left uppercase transition-colors ${
                      isActive
                        ? 'border-white bg-white text-black font-bold'
                        : 'border-[#262626] bg-[#141414] hover:border-[#404040] text-white'
                    }`}
                  >
                    <div className="text-[11px]">{domain.name}</div>
                    <div className={`text-[9px] mt-1 ${isActive ? 'text-black' : 'text-[#71717A]'}`}>
                      {domain.lockedCount || 24} TERMS LOCKED
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Term Addition Terminal */}
          <div className="border border-[#262626] bg-[#0E0E0E] p-3 space-y-2">
            <span className="text-[10px] text-[#71717A] uppercase font-bold">[ ADD CUSTOM PROPRIETARY TERM ]</span>
            <form onSubmit={handleAddTerm} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={customTermSource}
                onChange={(e) => setCustomTermSource(e.target.value)}
                placeholder="ORIGINAL TERM (e.g. EBITDA)"
                className="flex-1 bg-[#161616] border border-[#333333] px-2.5 py-1.5 text-xs text-white placeholder-[#52525B] focus:outline-none focus:border-white uppercase"
              />
              <input
                type="text"
                value={customTermTarget}
                onChange={(e) => setCustomTermTarget(e.target.value)}
                placeholder="LOCKED TRANSLATION SPEC"
                className="flex-1 bg-[#161616] border border-[#333333] px-2.5 py-1.5 text-xs text-white placeholder-[#52525B] focus:outline-none focus:border-white uppercase"
              />
              <button
                type="submit"
                className="px-4 py-1.5 border border-white bg-white hover:bg-[#E5E5E5] text-black font-bold text-xs uppercase cursor-pointer shrink-0"
              >
                [ LOCK ]
              </button>
            </form>
          </div>

          {/* Locked Terms Table */}
          <div className="border border-[#262626] bg-[#0E0E0E] p-3 space-y-2">
            <span className="text-[10px] text-[#71717A] uppercase font-bold">[ CURRENTLY LOCKED VOCABULARY ]</span>
            <div className="space-y-1.5">
              {customGlossary.map((item) => (
                <div key={item.id} className="border border-[#1F1F1F] bg-[#141414] p-2 flex justify-between items-center text-[11px]">
                  <div className="space-x-2">
                    <span className="text-white font-bold">{item.source}</span>
                    <span className="text-[#71717A]">→</span>
                    <span className="text-[#A1A1AA]">{item.target}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveTerm(item.id)}
                    className="text-[#71717A] hover:text-[#E61919] p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#161616] border-t border-[#262626] p-3 flex justify-between items-center text-[10px] text-[#71717A]">
          <span>PROTECTION ENGINE: ACTIVE</span>
          <span>ENTERPRISE FEATURE 02</span>
        </div>
      </div>
    </div>
  );
}
