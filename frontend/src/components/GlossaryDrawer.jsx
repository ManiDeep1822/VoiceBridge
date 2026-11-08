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
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-md select-none font-sans text-sm">
      <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full flex flex-col justify-between shadow-2xl">
        {/* Header */}
        <div className="bg-slate-800/60 border-b border-slate-800 px-5 py-4 flex items-center justify-between">
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
            className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
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
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isActive
                        ? 'border-blue-500 bg-blue-500/15 text-white font-semibold'
                        : 'border-slate-800 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-medium">{domain.name}</div>
                    <div className={`text-[11px] mt-1 ${isActive ? 'text-blue-400' : 'text-slate-500'}`}>
                      {domain.lockedCount || 24} terms locked
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Term Addition */}
          <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4 space-y-3">
            <span className="text-xs font-semibold text-slate-300 block">
              Add Custom Term
            </span>
            <form onSubmit={handleAddTerm} className="flex flex-col gap-2.5">
              <input
                type="text"
                value={customTermSource}
                onChange={(e) => setCustomTermSource(e.target.value)}
                placeholder="Source Term (e.g. EBITDA)"
                className="w-full h-11 bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-xl px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <input
                type="text"
                value={customTermTarget}
                onChange={(e) => setCustomTermTarget(e.target.value)}
                placeholder="Target Translation / Expansion"
                className="w-full h-11 bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-xl px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                className="btn-primary w-full h-11 px-5 py-2.5 rounded-xl text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>Lock Term</span>
              </button>
            </form>
          </div>

          {/* Locked Terms Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4 space-y-3">
            <span className="text-xs font-semibold text-slate-300 block">
              Currently Locked Vocabulary ({customGlossary.length})
            </span>
            <div className="space-y-2">
              {customGlossary.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-700/60 bg-slate-800/80 p-3 flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <span className="text-white font-semibold">{item.source}</span>
                    <p className="text-slate-400 text-[11px]">{item.target}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveTerm(item.id)}
                    className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700/60 flex items-center justify-center transition-colors"
                    title="Remove term"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-800/60 border-t border-slate-800 p-4 flex justify-between items-center text-xs text-slate-400">
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
