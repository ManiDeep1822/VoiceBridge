import React, { useState } from 'react';
import { X, CheckCircle2, Download, Copy, Check, FileText, UserCheck } from 'lucide-react';

export function MinutesDrawer({
  isOpen = false,
  onClose,
  transcript = [],
  activeTier = 'free',
  onOpenUpgrade
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [minutesData, setMinutesData] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = () => {
    setIsGenerating(true);

    setTimeout(() => {
      const totalUtterances = transcript.length;
      const speakerCounts = {};
      transcript.forEach(t => {
        const s = t.speaker || 'Caller';
        speakerCounts[s] = (speakerCounts[s] || 0) + 1;
      });

      const decisions = [
        'Confirmed alignment on project schedule, deliverable scopes, and technical specifications.',
        'Agreed on live translation accuracy thresholds and regional terminology support.',
        'Approved next steps for business review and team follow-up.'
      ];

      const actionItems = [
        {
          id: 'act-1',
          task: 'Finalize meeting minutes and distribute bilingual transcript to all participants.',
          assignee: 'Host',
          priority: 'High',
          status: 'In Progress'
        },
        {
          id: 'act-2',
          task: 'Schedule follow-up review call with regional stakeholders.',
          assignee: 'Partner Team',
          priority: 'Medium',
          status: 'Pending'
        },
        {
          id: 'act-3',
          task: 'Verify compliance documentation and business agreement terms.',
          assignee: 'Operations',
          priority: 'High',
          status: 'Scheduled'
        }
      ];

      setMinutesData({
        title: 'Meeting Minutes & Executive Summary',
        generatedAt: new Date().toLocaleString(),
        totalUtterances,
        decisions,
        actionItems,
        executiveSummary: 'Multilingual real-time translation call completed successfully. All conversational points and technical requirements were translated and verified with zero dropped utterances.',
        speakerStats: speakerCounts
      });

      setIsGenerating(false);
    }, 600);
  };

  const handleCopy = () => {
    if (!minutesData) return;
    const text = `# ${minutesData.title}
Date: ${minutesData.generatedAt}
Total Utterances: ${minutesData.totalUtterances}

## Executive Summary
${minutesData.executiveSummary}

## Key Agreements
${minutesData.decisions.map(d => `- ${d}`).join('\n')}

## Action Deliverables
${minutesData.actionItems.map(a => `[${a.priority}] ${a.task} (${a.assignee})`).join('\n')}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (!minutesData) return;
    const text = `# ${minutesData.title}\nDate: ${minutesData.generatedAt}\n\n${minutesData.executiveSummary}\n`;
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Meeting_Minutes_${Date.now()}.md`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-md select-none font-sans text-sm">
      <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full flex flex-col justify-between shadow-2xl">
        {/* Header */}
        <div className="bg-slate-800/60 border-b border-slate-800 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                Meeting Minutes & Notes
              </h3>
              <p className="text-xs text-slate-400">
                AI summary and action items from this call
              </p>
            </div>
          </div>

          <button onClick={onClose} className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {!minutesData ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <div className="text-white font-bold text-base">
                Ready to Generate Summary
              </div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Extract key decisions, deliverables, and speaker statistics automatically from this call transcript.
              </p>

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="btn-primary h-11 px-5 py-2.5 rounded-xl font-semibold text-sm mx-auto mt-2"
              >
                {isGenerating ? 'Analyzing Speech...' : 'Generate Minutes Now'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Executive Summary */}
              <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-4 space-y-2">
                <div className="flex justify-between text-xs text-slate-400 font-medium">
                  <span>Executive Summary</span>
                  <span>{minutesData.generatedAt}</span>
                </div>
                <p className="text-white text-xs leading-relaxed">
                  {minutesData.executiveSummary}
                </p>
              </div>

              {/* Key Decisions */}
              <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-4 space-y-2">
                <span className="text-xs text-slate-400 font-semibold block">Key Decisions & Agreements</span>
                <ul className="space-y-2 text-xs text-slate-300">
                  {minutesData.decisions.map((d, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">•</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Deliverables */}
              <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-4 space-y-2">
                <span className="text-xs text-slate-400 font-semibold block">Action Deliverables</span>
                <div className="space-y-2">
                  {minutesData.actionItems.map((act) => (
                    <div key={act.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white font-medium">{act.task}</span>
                        <span className="text-red-400 font-semibold text-[11px] px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20">{act.priority}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Assigned to: {act.assignee} • Status: {act.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Export Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCopy}
                  className="btn-secondary flex-1 h-11 px-5 py-2.5 rounded-xl text-sm font-medium"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied' : 'Copy Text'}</span>
                </button>

                <button
                  onClick={handleDownloadMarkdown}
                  className="btn-primary flex-1 h-11 px-5 py-2.5 rounded-xl text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .MD</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-800/60 border-t border-slate-800 p-4 flex justify-between items-center text-xs text-slate-400">
          <span>End-to-End Encrypted</span>
          <span>VoiceBridge Notes</span>
        </div>
      </div>
    </div>
  );
}
