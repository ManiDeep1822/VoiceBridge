import React, { useState } from 'react';
import { X, BookOpen, Plus, Trash2, Check, ShieldCheck } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex justify-end bg-[#07090C]/80 backdrop-blur-md select-none font-sans text-sm box-border">
      <div className="w-full max-w-full sm:max-w-lg bg-[#0D121F] border-l border-slate-800/90 h-full flex flex-col justify-between shadow-2xl box-border">
        {/* Header */}
        <div className="bg-[#080C14]/60 border-b border-slate-800/80 px-4 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                Industry Glossary
              </h3>
              <p className="text-xs text-slate-400">
                Preserve technical jargon and domain terms accurately
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 sm:space-y-5">
          <p className="text-xs text-slate-400 leading-relaxed">
            Locked terminology ensures that proprietary acronyms, legal terms, and medical vocabulary are never hallucinated or distorted during live speech translation.
          </p>

          {/* Domain Selection Matrix */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-300 block">
              Active Industry Domain
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {INDUSTRY_DOMAINS.map((domain) => {
                const isActive = activeDomain === domain.id;
                return (
                  <button
                    key={domain.id}
                    onClick={() => onSelectDomain(domain.id)}
                    className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all ${
                      isActive
                        ? 'border-blue-500 bg-blue-500/15 text-white font-semibold glow-blue'
                        : 'border-slate-800/80 bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-medium truncate">{domain.name}</div>
                    <div className={`text-[10px] sm:text-[11px] mt-0.5 sm:mt-1 ${isActive ? 'text-blue-400 font-medium' : 'text-slate-500'}`}>
                      {domain.lockedCount || 24} terms locked
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Term Addition */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 sm:p-4 space-y-3">
            <span className="text-xs font-semibold text-slate-300 block">
              Add Custom Term
            </span>
            <form onSubmit={handleAddTerm} className="flex flex-col gap-2">
              <input
                type="text"
                value={customTermSource}
                onChange={(e) => setCustomTermSource(e.target.value)}
                placeholder="Source Term (e.g. EBITDA)"
                className="w-full h-10 bg-slate-800/90 border border-slate-700/80 focus:border-blue-500 rounded-xl px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <input
                type="text"
                value={customTermTarget}
                onChange={(e) => setCustomTermTarget(e.target.value)}
                placeholder="Target Translation / Expansion"
                className="w-full h-10 bg-slate-800/90 border border-slate-700/80 focus:border-blue-500 rounded-xl px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                className="btn-primary w-full h-10 px-4 rounded-xl text-xs sm:text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                <span>Lock Term</span>
              </button>
            </form>
          </div>

          {/* Locked Terms Table */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 sm:p-4 space-y-3">
            <span className="text-xs font-semibold text-slate-300 block">
              Currently Locked Vocabulary ({customGlossary.length})
            </span>
            <div className="space-y-2">
              {customGlossary.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-800/80 bg-slate-950/70 p-2.5 sm:p-3 flex justify-between items-center text-xs">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <span className="text-white font-semibold block truncate">{item.source}</span>
                    <p className="text-slate-400 text-[11px] truncate">{item.target}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveTerm(item.id)}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 flex items-center justify-center transition-colors shrink-0 ml-2"
                    title="Remove term"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#080C14]/60 border-t border-slate-800/80 p-3.5 sm:p-4 flex justify-between items-center text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Terminology Protection Active
          </span>
          <span>Enterprise Grade</span>
        </div>
      </div>
    </div>
  );
}
