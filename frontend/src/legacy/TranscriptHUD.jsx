import React, { useState } from 'react';
import { Copy, Check, Download, Volume2, Search, Trash2 } from 'lucide-react';
import { getLanguageMeta } from '../utils/languages.js';

export function TranscriptHUD({
  transcript = [],
  onClearTranscript,
  onReplayUtterance
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const filtered = transcript.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.originalText?.toLowerCase().includes(term) ||
      item.translatedText?.toLowerCase().includes(term) ||
      item.speaker?.toLowerCase().includes(term)
    );
  });

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(transcript, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `voxsynapse-call-log-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportMarkdown = () => {
    let md = `# VOXSYNAPSE PRIME — 2-Way Call Translation Transcript\n\n`;
    md += `**Generated**: ${new Date().toLocaleString()}\n`;
    md += `**Total Utterances**: ${transcript.length}\n\n---\n\n`;

    transcript.forEach(item => {
      const time = new Date(item.timestamp).toLocaleTimeString();
      md += `### [${time}] ${item.speaker} (${item.sourceLang.toUpperCase()} → ${item.targetLang.toUpperCase()})\n`;
      md += `* **Original**: ${item.originalText}\n`;
      md += `* **Translated**: ${item.translatedText}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-transcript-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#090C11] border-t border-[#1B232E] px-4 py-3 max-w-7xl mx-auto w-full flex flex-col h-56 select-none">
      {/* Transcript Header & Toolbar */}
      <div className="flex items-center justify-between pb-2 border-b border-[#18202A] mb-2">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-xs tracking-wider uppercase text-white">CALL TELEMETRY LOG</span>
          <span className="text-[10px] font-telemetry px-1.5 py-0.5 bg-[#121820] text-gray-400 border border-[#212C3A]">
            {filtered.length} UTTERANCES
          </span>
        </div>

        {/* Search & Action Buttons */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3 h-3 text-gray-500 absolute left-2 top-2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="SEARCH LOGS..."
              className="bg-[#10141C] border border-[#232D3B] pl-6 pr-2 py-0.5 text-[11px] font-telemetry uppercase text-gray-300 placeholder-gray-600 focus:outline-none focus:border-cyan-400 w-36 sm:w-48"
            />
          </div>

          <button
            onClick={handleExportMarkdown}
            className="px-2 py-0.5 text-[10px] font-telemetry uppercase text-gray-300 bg-[#121822] border border-[#222E3D] hover:border-gray-500 flex items-center gap-1 transition-colors"
            title="Export as Markdown Document"
          >
            <Download className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">Export MD</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="px-2 py-0.5 text-[10px] font-telemetry uppercase text-gray-300 bg-[#121822] border border-[#222E3D] hover:border-gray-500 flex items-center gap-1 transition-colors"
            title="Export as structured JSON"
          >
            <Download className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">JSON</span>
          </button>

          {transcript.length > 0 && (
            <button
              onClick={onClearTranscript}
              className="p-1 text-gray-500 hover:text-red-400 transition-colors"
              title="Clear transcript log"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Transcript Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-telemetry text-xs">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-600 text-xs italic">
            No spoken utterances logged yet. Start speaking or trigger a simulator turn to populate the log.
          </div>
        ) : (
          filtered.map((item) => {
            const isLocal = item.isLocal || item.speaker === 'Operator 1 (You)';
            const timeStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            return (
              <div
                key={item.id}
                className="bg-[#0C1016] border border-[#18212C] p-2 hover:border-[#2A3749] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
                  <span className="text-[10px] text-gray-500 shrink-0">{timeStr}</span>
                  <span
                    className={`text-[10px] font-bold uppercase px-1 py-0.2 shrink-0 ${
                      isLocal
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40'
                        : 'bg-cyan-950/80 text-cyan-400 border border-cyan-500/40'
                    }`}
                  >
                    {isLocal ? 'YOU' : 'PEER'}
                  </span>

                  <div className="flex-1 truncate">
                    <span className="text-gray-400 mr-2">"{item.originalText}"</span>
                    <span className="text-white font-semibold">→ "{item.translatedText}"</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <span className="text-[10px] text-gray-500 uppercase">
                    {item.sourceLang} → {item.targetLang}
                  </span>

                  <button
                    onClick={() => onReplayUtterance && onReplayUtterance(item.translatedText, item.targetLang)}
                    className="p-1 text-gray-400 hover:text-cyan-300 transition-colors"
                    title="Speak translated text aloud"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleCopy(item.translatedText, item.id)}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                    title="Copy translation"
                  >
                    {copiedId === item.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
