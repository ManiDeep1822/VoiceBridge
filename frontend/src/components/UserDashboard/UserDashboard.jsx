import React, { useState } from 'react';
import {
  Clock, PhoneCall, CheckCircle2, FileText, Download,
  Globe, User, Search, ChevronRight, Activity, Cpu, ArrowUpRight
} from 'lucide-react';

export function UserDashboard({
  onJoinRoom,
  onOpenMinutes,
  onOpenPricing,
  activeTier = 'free',
  currency = 'INR'
}) {
  const [filterQuery, setFilterQuery] = useState('');
  const [actionItems, setActionItems] = useState([
    {
      id: 'task-1',
      title: 'Audit medical trial protocol translation and lock clinical oncology nomenclature',
      assignee: 'OP-01 (YOU)',
      priority: 'HIGH',
      status: 'IN PROGRESS',
      room: 'VOX-ROOM-101',
      date: 'TODAY, 14:15 IST'
    },
    {
      id: 'task-2',
      title: 'Transmit verified bilingual telemetry summary to Tokyo engineering unit',
      assignee: 'SARAH LIN (TYO)',
      priority: 'MEDIUM',
      status: 'PENDING',
      room: 'VOX-GLOBAL-7',
      date: 'YESTERDAY'
    },
    {
      id: 'task-3',
      title: 'File corporate GSTIN tax invoice and calibrate Pro Industrial fleet seats',
      assignee: 'FINANCE DEPT',
      priority: 'HIGH',
      status: 'COMPLETED',
      room: 'VOX-ROOM-101',
      date: '06 NOV 2026'
    }
  ]);

  const [callHistory, setCallHistory] = useState([
    {
      id: 'call-101',
      roomId: 'VOX-ROOM-101',
      peerName: 'ELENA ROSTOVA',
      sourceLang: '[ENG] ENGLISH',
      targetLang: '[TEL] TELUGU (తెలుగు)',
      duration: '18m 42s',
      timestamp: 'TODAY, 14:15 IST',
      wordsTranslated: 1840,
      qualityScore: '99.4%',
      status: 'LOGGED'
    },
    {
      id: 'call-102',
      roomId: 'GLOBAL-P2P-88',
      peerName: 'CARLOS MENDOZA',
      sourceLang: '[ENG] ENGLISH',
      targetLang: '[ESP] SPANISH (ESPAÑOL)',
      duration: '34m 10s',
      timestamp: 'YESTERDAY, 16:30 IST',
      wordsTranslated: 3420,
      qualityScore: '99.8%',
      status: 'LOGGED'
    },
    {
      id: 'call-103',
      roomId: 'TOKYO-BRIDGE-01',
      peerName: 'KENJI TAKAHASHI',
      sourceLang: '[ENG] ENGLISH',
      targetLang: '[JPN] JAPANESE (日本語)',
      duration: '45m 12s',
      timestamp: '06 NOV 2026',
      wordsTranslated: 4950,
      qualityScore: '99.2%',
      status: 'LOGGED'
    }
  ]);

  const toggleTaskStatus = (id) => {
    setActionItems(prev => prev.map(item => {
      if (item.id === id) {
        const nextStatus = item.status === 'COMPLETED' ? 'IN PROGRESS' : 'COMPLETED';
        return { ...item, status: nextStatus };
      }
      return item;
    }));
  };

  const filteredHistory = callHistory.filter(c =>
    c.roomId.toLowerCase().includes(filterQuery.toLowerCase()) ||
    c.peerName.toLowerCase().includes(filterQuery.toLowerCase()) ||
    c.targetLang.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0A0A0A] p-4 sm:p-6 overflow-y-auto w-full space-y-4 select-none font-mono text-xs">
      {/* Top Banner & Fast Launch */}
      <div className="border border-[#262626] bg-[#111111] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 bg-[#E61919]" />
            <h1 className="text-lg font-black text-white uppercase tracking-tight font-sans">
              OPERATOR WORKSPACE // FLIGHT LOG
            </h1>
            <span className="text-[10px] px-2 py-0.5 border border-[#333333] bg-[#161616] text-white">
              ACCOUNT: {activeTier.toUpperCase()}
            </span>
          </div>
          <p className="text-[11px] text-[#71717A] max-w-xl">
            Audit logs for cross-language sessions, AI-extracted executive deliverables, and compliance documentation.
          </p>
        </div>

        <button
          onClick={() => onJoinRoom('VOX-ROOM-101')}
          className="border border-white bg-white hover:bg-[#E5E5E5] text-black font-bold px-4 py-2 text-xs uppercase flex items-center gap-2 transition-colors cursor-pointer shrink-0"
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>[ LAUNCH LIVE STUDIO ]</span>
        </button>
      </div>

      {/* KPI Telemetry Metrics Grid (Zero border radius, 1px divider lines) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-[#262626] bg-[#111111] p-3 space-y-1">
          <div className="flex justify-between text-[10px] text-[#71717A]">
            <span>TOTAL DURATION</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-black text-white font-sans">98H 04M</div>
          <div className="text-[10px] text-[#A1A1AA]">+14.2% OVER PRIOR CYCLE</div>
        </div>

        <div className="border border-[#262626] bg-[#111111] p-3 space-y-1">
          <div className="flex justify-between text-[10px] text-[#71717A]">
            <span>WORDS TRANSLATED</span>
            <Globe className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-black text-white font-sans">104,210</div>
          <div className="text-[10px] text-[#A1A1AA]">12 GLOBAL CHANNEL PAIRS</div>
        </div>

        <div className="border border-[#262626] bg-[#111111] p-3 space-y-1">
          <div className="flex justify-between text-[10px] text-[#71717A]">
            <span>DELIVERABLES LOGGED</span>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-black text-white font-sans">42 TASKS</div>
          <div className="text-[10px] text-[#A1A1AA]">38 CONFIRMED OR IN-FLIGHT</div>
        </div>

        <div className="border border-[#262626] bg-[#111111] p-3 space-y-1">
          <div className="flex justify-between text-[10px] text-[#71717A]">
            <span>MEAN LATENCY</span>
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-black text-white font-sans">138 MS</div>
          <div className="text-[10px] text-[#39FF14]">P2P DUPLEX OPTIMIZED</div>
        </div>
      </div>

      {/* Main Split: Audit Table + Task Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1">
        {/* Left 8 Cols: Session Audit Records */}
        <div className="lg:col-span-8 border border-[#262626] bg-[#111111] p-4 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262626] pb-3 mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase text-white tracking-wider">
                  [ CALL SESSION AUDIT LOGS ]
                </h3>
                <p className="text-[10px] text-[#71717A]">
                  Archived transcripts, bilingual minutes, and legal teleprompter records.
                </p>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#52525B] absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="FILTER ARCHIVE..."
                  className="bg-[#161616] border border-[#333333] pl-8 pr-2.5 py-1 text-[11px] text-white placeholder-[#52525B] focus:outline-none focus:border-white uppercase w-48"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#262626] text-[#71717A] text-[10px] uppercase">
                    <th className="pb-2">ROOM // PEER</th>
                    <th className="pb-2">TRANSLATION ROUTE</th>
                    <th className="pb-2">DURATION</th>
                    <th className="pb-2">TIMESTAMP</th>
                    <th className="pb-2 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F1F1F]">
                  {filteredHistory.map((call) => (
                    <tr key={call.id} className="hover:bg-[#161616] transition-colors">
                      <td className="py-2.5">
                        <div className="font-bold text-white">{call.peerName}</div>
                        <div className="text-[10px] text-[#71717A]">{call.roomId}</div>
                      </td>
                      <td className="py-2.5 text-white">
                        <span>{call.sourceLang}</span> → <span className="font-bold">{call.targetLang}</span>
                      </td>
                      <td className="py-2.5 text-[#A1A1AA]">{call.duration}</td>
                      <td className="py-2.5 text-[#71717A]">{call.timestamp}</td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={onOpenMinutes}
                          className="px-2 py-0.5 border border-[#404040] hover:border-white bg-[#1A1A1A] hover:bg-white hover:text-black text-white text-[10px] uppercase transition-colors"
                        >
                          [ MINUTES ]
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-3 border-t border-[#262626] flex items-center justify-between text-[10px] text-[#71717A]">
            <span>LOGGED SESSIONS: {filteredHistory.length}</span>
            <button
              onClick={onOpenMinutes}
              className="text-white hover:underline flex items-center gap-1 uppercase font-bold"
            >
              <span>[ EXPORT FULL AUDIT DOSSIER ]</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Right 4 Cols: Extracted Action Items Matrix */}
        <div className="lg:col-span-4 border border-[#262626] bg-[#111111] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#262626] pb-3 mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase text-white tracking-wider">
                  [ EXTRACTED DELIVERABLES ]
                </h3>
                <p className="text-[10px] text-[#71717A]">
                  Auto-parsed action points from speech dialogue.
                </p>
              </div>
              <span className="text-[9px] border border-[#333333] bg-[#161616] text-[#A1A1AA] px-1.5 py-0.5">
                ACTIVE
              </span>
            </div>

            <div className="space-y-2">
              {actionItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => toggleTaskStatus(item.id)}
                  className={`p-2.5 border cursor-pointer transition-colors ${
                    item.status === 'COMPLETED'
                      ? 'border-[#262626] bg-[#0E0E0E] opacity-60'
                      : 'border-[#333333] bg-[#141414] hover:border-white'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={item.status === 'COMPLETED'}
                      onChange={() => {}}
                      className="mt-0.5 accent-[#E61919] cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] leading-snug ${item.status === 'COMPLETED' ? 'line-through text-[#52525B]' : 'text-white'}`}>
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 text-[9px] text-[#71717A] uppercase">
                        <span>OWNER: <strong className="text-white">{item.assignee}</strong></span>
                        <span>|</span>
                        <span className={item.priority === 'HIGH' ? 'text-[#E61919] font-bold' : 'text-amber-400'}>
                          PRIORITY: {item.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-[#262626] mt-3">
            <button
              onClick={onOpenPricing}
              className="w-full py-2 border border-white bg-white hover:bg-[#E5E5E5] text-black font-bold text-xs uppercase flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>[ UPGRADE FLEET CAPACITY: ₹2,999/MO ]</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
