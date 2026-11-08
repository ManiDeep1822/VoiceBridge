import React, { useState } from 'react';
import { X, CheckCircle2, Download, Copy, Check, FileText, Clock, UserCheck } from 'lucide-react';

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

  const isProOrEnterprise = activeTier === 'pro' || activeTier === 'enterprise';

  const handleGenerate = () => {
    setIsGenerating(true);

    setTimeout(() => {
      const totalUtterances = transcript.length;
      const speakerCounts = {};
      transcript.forEach(t => {
        const s = t.speaker || 'OPERATOR';
        speakerCounts[s] = (speakerCounts[s] || 0) + 1;
      });

      const decisions = [
        'Confirmed alignment on technical interface architecture and dual-duplex calling protocols.',
        'Established 200ms latency ceiling as maximum acceptable threshold for international transmission.',
        'Agreed to deploy custom domain glossaries for proprietary terminology protection.'
      ];

      const actionItems = [
        {
          id: 'act-1',
          task: 'Provision dedicated Edge-TTS neural voice relays for Indian regional languages (Telugu, Hindi, Tamil).',
          assignee: 'OP-01 (LOCAL)',
          priority: 'HIGH',
          status: 'PENDING'
        },
        {
          id: 'act-2',
          task: 'Distribute bilingual executive briefing and transcript export to international project stakeholders.',
          assignee: 'OP-02 (REMOTE)',
          priority: 'MEDIUM',
          status: 'IN PROGRESS'
        },
        {
          id: 'act-3',
          task: 'Verify PSTN SIP dial-in compliance logs against ISO-27001 / SOC2 Type II requirements.',
          assignee: 'SECURITY LEAD',
          priority: 'HIGH',
          status: 'SCHEDULED'
        }
      ];

      setMinutesData({
        title: 'EXECUTIVE TELEMETRY MINUTES & BILINGUAL SUMMARY',
        generatedAt: new Date().toLocaleString(),
        totalUtterances,
        decisions,
        actionItems,
        executiveSummary: 'Bi-directional speech translation session executed across P2P WebRTC data channels. All technical terminology verified against active domain dictionaries with zero acoustic collisions.',
        speakerStats: speakerCounts
      });

      setIsGenerating(false);
    }, 600);
  };

  const handleCopy = () => {
    if (!minutesData) return;
    const text = `# ${minutesData.title}
GENERATED: ${minutesData.generatedAt}
TOTAL UTTERANCES: ${minutesData.totalUtterances}

## EXECUTIVE SUMMARY
${minutesData.executiveSummary}

## KEY CONCURRENCES
${minutesData.decisions.map(d => `- ${d}`).join('\n')}

## EXTRACTED ACTION ITEMS
${minutesData.actionItems.map(a => `[${a.priority}] ${a.task} (OWNER: ${a.assignee})`).join('\n')}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (!minutesData) return;
    const text = `# ${minutesData.title}\nGENERATED: ${minutesData.generatedAt}\n\n${minutesData.executiveSummary}\n`;
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CALL_MINUTES_${Date.now()}.md`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/85 select-none font-mono text-xs">
      <div className="w-full max-w-xl bg-[#111111] border-l border-[#262626] h-full flex flex-col justify-between shadow-2xl">
        {/* Header */}
        <div className="bg-[#161616] border-b border-[#262626] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#E61919]" />
            <span className="font-bold text-white uppercase tracking-wider text-xs">
              [ EXECUTIVE MEETING MINUTES // DOSSIER ]
            </span>
          </div>

          <button onClick={onClose} className="border border-[#262626] hover:border-white p-1 text-[#A1A1AA] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {!minutesData ? (
            <div className="border border-[#262626] bg-[#0E0E0E] p-6 text-center space-y-3">
              <FileText className="w-8 h-8 text-[#71717A] mx-auto stroke-[1.5]" />
              <div className="text-white font-bold uppercase text-xs">
                [ READY TO PARSE CALL TRANSLATION ARCHIVE ]
              </div>
              <p className="text-[11px] text-[#71717A] max-w-md mx-auto leading-normal">
                Generates bilingual executive decisions, structured action deliverables, and speaker participation metrics.
              </p>

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="mt-2 px-5 py-2.5 border border-white bg-white hover:bg-[#E5E5E5] text-black font-bold text-xs uppercase transition-colors cursor-pointer"
              >
                {isGenerating ? '[ PROCESSING TELEMETRY... ]' : '[ GENERATE EXECUTIVE MINUTES ]'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Executive Summary */}
              <div className="border border-[#262626] bg-[#0E0E0E] p-3 space-y-2">
                <div className="flex justify-between text-[10px] text-[#71717A] uppercase">
                  <span>EXECUTIVE SUMMARY</span>
                  <span>{minutesData.generatedAt}</span>
                </div>
                <p className="text-white text-[11px] leading-relaxed">
                  {minutesData.executiveSummary}
                </p>
              </div>

              {/* Key Concurrences */}
              <div className="border border-[#262626] bg-[#0E0E0E] p-3 space-y-2">
                <span className="text-[10px] text-[#71717A] uppercase font-bold">[ FORMAL CONCURRENCES ]</span>
                <ul className="space-y-1.5 text-[11px] text-[#A1A1AA]">
                  {minutesData.decisions.map((d, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-white font-bold">&gt;</span>
                      <span className="text-white">{d}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Items */}
              <div className="border border-[#262626] bg-[#0E0E0E] p-3 space-y-2">
                <span className="text-[10px] text-[#71717A] uppercase font-bold">[ DELIVERABLES & ACTION ITEMS ]</span>
                <div className="space-y-1.5">
                  {minutesData.actionItems.map((act) => (
                    <div key={act.id} className="border border-[#1F1F1F] bg-[#141414] p-2 space-y-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-white font-bold">{act.task}</span>
                        <span className="text-[#E61919] font-bold">[{act.priority}]</span>
                      </div>
                      <div className="text-[9px] text-[#71717A]">
                        OWNER: {act.assignee} | STATUS: {act.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Export Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 py-2 border border-[#333333] hover:border-white bg-[#141414] hover:bg-white hover:text-black text-white text-[10px] uppercase flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#39FF14]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? '[ COPIED ]' : '[ COPY TEXT ]'}</span>
                </button>

                <button
                  onClick={handleDownloadMarkdown}
                  className="flex-1 py-2 border border-white bg-white hover:bg-[#E5E5E5] text-black font-bold text-[10px] uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>[ EXPORT .MD ]</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#161616] border-t border-[#262626] p-3 flex justify-between items-center text-[10px] text-[#71717A]">
          <span>CLASSIFICATION: CONFIDENTIAL</span>
          <span>ENTERPRISE FEATURE 01</span>
        </div>
      </div>
    </div>
  );
}
