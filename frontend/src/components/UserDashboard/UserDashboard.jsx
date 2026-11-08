import React, { useState } from 'react';
import {
  Clock, PhoneCall, CheckCircle2, FileText,
  Globe, Search, Check, Activity, Calendar, ArrowRight
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
      title: 'Review supplier contract pricing terms and confirm shipping schedule',
      assignee: 'You',
      priority: 'High',
      status: 'In Progress',
      room: 'VOX-ROOM-101',
      date: 'Today, 14:15'
    },
    {
      id: 'task-2',
      title: 'Send translated meeting minutes to regional partner team',
      assignee: 'Sarah Lin',
      priority: 'Medium',
      status: 'Pending',
      room: 'GLOBAL-ROOM-7',
      date: 'Yesterday'
    },
    {
      id: 'task-3',
      title: 'Confirm GST invoice and business licensing documentation',
      assignee: 'Finance',
      priority: 'High',
      status: 'Completed',
      room: 'VOX-ROOM-101',
      date: '06 Nov'
    }
  ]);

  const [callHistory, setCallHistory] = useState([
    {
      id: 'call-101',
      roomId: 'VOX-ROOM-101',
      peerName: 'Elena Rostova',
      sourceLang: 'English',
      targetLang: 'Telugu (తెలుగు)',
      duration: '18m 42s',
      timestamp: 'Today, 14:15',
      wordsTranslated: 1840,
      status: 'Saved'
    },
    {
      id: 'call-102',
      roomId: 'GLOBAL-P2P-88',
      peerName: 'Carlos Mendoza',
      sourceLang: 'English',
      targetLang: 'Spanish (Español)',
      duration: '34m 10s',
      timestamp: 'Yesterday, 16:30',
      wordsTranslated: 3420,
      status: 'Saved'
    },
    {
      id: 'call-103',
      roomId: 'TOKYO-BRIDGE-01',
      peerName: 'Kenji Takahashi',
      sourceLang: 'English',
      targetLang: 'Japanese (日本語)',
      duration: '45m 12s',
      timestamp: '06 Nov',
      wordsTranslated: 4950,
      status: 'Saved'
    }
  ]);

  const toggleTaskStatus = (id) => {
    setActionItems(prev => prev.map(item => {
      if (item.id === id) {
        const nextStatus = item.status === 'Completed' ? 'In Progress' : 'Completed';
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
    <div className="flex-1 flex flex-col h-full bg-[#0B0F17] p-4 sm:p-6 overflow-y-auto w-full space-y-5 select-none font-sans text-sm">
      {/* Top Banner & Fast Launch */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Call Workspace
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20 uppercase">
              {activeTier} Plan
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
            Review past multilingual call recordings, meeting summaries, and actionable task deliverables.
          </p>
        </div>

        <button
          onClick={() => onJoinRoom('VOX-ROOM-101')}
          className="btn-primary h-11 px-5 py-2.5 rounded-xl text-sm font-semibold shrink-0"
        >
          <PhoneCall className="w-4 h-4" />
          <span>Start Live Call</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Total Call Time</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">98h 04m</div>
          <div className="text-xs text-emerald-400 font-medium">+14% this month</div>
        </div>

        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Words Translated</span>
            <Globe className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">104,210</div>
          <div className="text-xs text-slate-400">Across 12 languages</div>
        </div>

        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Action Items</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">42 Tasks</div>
          <div className="text-xs text-slate-400">38 completed</div>
        </div>

        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Audio Quality</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">Studio HD</div>
          <div className="text-xs text-emerald-400 font-medium">Neural synthesis active</div>
        </div>
      </div>

      {/* Main Split: Audit Table + Task Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
        {/* Left 8 Cols: Session History */}
        <div className="lg:col-span-8 rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  Call History & Transcripts
                </h3>
                <p className="text-xs text-slate-400">
                  Access conversation logs, translated minutes, and past room records.
                </p>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Search calls or rooms..."
                  className="h-11 bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full sm:w-56"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs">
                    <th className="pb-3 font-semibold">Caller & Room</th>
                    <th className="pb-3 font-semibold">Language Route</th>
                    <th className="pb-3 font-semibold">Duration</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3">
                        <div className="font-semibold text-white">{item.peerName}</div>
                        <div className="text-xs text-slate-400">{item.roomId} • {item.timestamp}</div>
                      </td>
                      <td className="py-3 text-slate-300">
                        <span>{item.sourceLang}</span>
                        <span className="text-slate-500 mx-1.5">→</span>
                        <span className="text-emerald-400 font-medium">{item.targetLang}</span>
                      </td>
                      <td className="py-3 text-slate-300">{item.duration}</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => onJoinRoom(item.roomId)}
                          className="btn-secondary h-9 px-4 rounded-lg text-xs font-medium inline-flex"
                        >
                          Rejoin
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Extracted Action Items */}
        <div className="lg:col-span-4 rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  Action Items
                </h3>
                <p className="text-xs text-slate-400">
                  AI-extracted deliverables from calls
                </p>
              </div>

              <button
                onClick={onOpenMinutes}
                className="btn-secondary h-9 px-3.5 rounded-lg text-xs font-medium"
              >
                Minutes
              </button>
            </div>

            <div className="space-y-3">
              {actionItems.map((task) => (
                <div
                  key={task.id}
                  onClick={() => toggleTaskStatus(task.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    task.status === 'Completed'
                      ? 'bg-slate-950/40 border-slate-800 opacity-60'
                      : 'bg-slate-800/70 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                      task.status === 'Completed'
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'border-slate-600'
                    }`}>
                      {task.status === 'Completed' && <Check className="w-3.5 h-3.5" />}
                    </div>

                    <div className="space-y-1">
                      <p className={`text-xs font-medium ${
                        task.status === 'Completed' ? 'line-through text-slate-400' : 'text-slate-100'
                      }`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>{task.assignee}</span>
                        <span>•</span>
                        <span>{task.date}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
            <span className="text-xs text-slate-400">Upgrade for cloud sync</span>
            <button
              onClick={onOpenPricing}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <span>View Plans</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
