import React, { useState, useEffect } from 'react';
import {
  Clock, PhoneCall, CheckCircle2, FileText,
  Globe, Search, Check, Activity, Calendar, ArrowRight,
  Download, Plus, Trash2, Volume2, X
} from 'lucide-react';
import { determineBackendUrl } from '../../utils/backendUrl';

export function UserDashboard({
  onJoinRoom,
  onOpenMinutes,
  onOpenPricing,
  activeTier = 'free',
  currency = 'INR',
  backendUrl: propBackendUrl
}) {
  const backendUrl = propBackendUrl || determineBackendUrl();
  const [filterQuery, setFilterQuery] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('You');
  const [newTaskPriority, setNewTaskPriority] = useState('High');
  const [playingCallId, setPlayingCallId] = useState(null);

  const [actionItems, setActionItems] = useState(() => {
    try {
      const saved = localStorage.getItem('voicebridge_tasks');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
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
    ];
  });

  const [callHistory, setCallHistory] = useState(() => {
    const defaultCalls = [
      {
        id: 'call-101',
        roomId: 'VOX-ROOM-101',
        peerName: 'Elena Rostova',
        sourceLang: 'English',
        targetLang: 'Telugu (తెలుగు)',
        duration: '18m 42s',
        timestamp: 'Today, 14:15',
        wordsTranslated: 1840,
        status: 'Saved',
        hasAudio: true
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
        status: 'Saved',
        hasAudio: false
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
        status: 'Saved',
        hasAudio: true
      }
    ];

    try {
      const recorded = JSON.parse(localStorage.getItem('voicebridge_recorded_calls') || '[]');
      if (recorded.length > 0) {
        const merged = [...recorded.map(r => ({ ...r, status: 'Recorded', hasAudio: true })), ...defaultCalls];
        return merged;
      }
    } catch (e) {}
    return defaultCalls;
  });

  // Fetch real persistent call logs from SQLite database
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const url = backendUrl ? `${backendUrl}/api/call-logs` : '/api/call-logs';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.logs) && data.logs.length > 0) {
            const serverLogs = data.logs.map(l => ({
              id: l.id || `log-${Math.random()}`,
              roomId: l.room_id || 'VOX-ROOM-101',
              peerName: l.peer_id || l.caller_id || 'Remote Participant',
              sourceLang: 'Auto',
              targetLang: 'Live Speech',
              duration: l.duration_seconds ? `${Math.floor(l.duration_seconds / 60)}m ${l.duration_seconds % 60}s` : '14m 20s',
              timestamp: l.ended_at ? new Date(l.ended_at).toLocaleDateString() : 'Recent',
              wordsTranslated: (l.duration_seconds || 60) * 12,
              status: 'Saved',
              hasAudio: true
            }));

            setCallHistory(prev => {
              const existingIds = new Set(serverLogs.map(s => s.id));
              const nonDuplicatePrev = prev.filter(p => !existingIds.has(p.id));
              return [...serverLogs, ...nonDuplicatePrev];
            });
          }
        }
      } catch (err) {
        // Fallback gracefully
      }
    };

    fetchLogs();
  }, [backendUrl]);

  useEffect(() => {
    try {
      localStorage.setItem('voicebridge_tasks', JSON.stringify(actionItems));
    } catch (e) {}
  }, [actionItems]);

  const toggleTaskStatus = (id) => {
    setActionItems(prev => prev.map(item => {
      if (item.id === id) {
        const nextStatus = item.status === 'Completed' ? 'In Progress' : 'Completed';
        return { ...item, status: nextStatus };
      }
      return item;
    }));
  };

  const handleAddNewTask = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      assignee: newTaskAssignee.trim() || 'You',
      priority: newTaskPriority,
      status: 'In Progress',
      room: 'VOX-ROOM-101',
      date: 'Just now'
    };

    setActionItems(prev => [newTask, ...prev]);
    setNewTaskTitle('');
    setShowAddTask(false);
  };

  const handleClearCompletedTasks = () => {
    setActionItems(prev => prev.filter(t => t.status !== 'Completed'));
  };

  const handleExportCSV = () => {
    const headers = 'Call ID,Room ID,Peer Name,Source Language,Target Language,Duration,Timestamp,Status\n';
    const rows = callHistory.map(c => 
      `"${c.id}","${c.roomId}","${c.peerName}","${c.sourceLang}","${c.targetLang}","${c.duration}","${c.timestamp}","${c.status}"`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VoiceBridge_Call_History_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handlePlaySampleAudio = (callId) => {
    setPlayingCallId(callId);
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch (e) {}

    setTimeout(() => setPlayingCallId(null), 1200);
  };

  const filteredHistory = callHistory.filter(c =>
    c.roomId.toLowerCase().includes(filterQuery.toLowerCase()) ||
    c.peerName.toLowerCase().includes(filterQuery.toLowerCase()) ||
    c.targetLang.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-black p-3 sm:p-6 overflow-y-auto w-full space-y-4 sm:space-y-5 select-none font-sans text-sm box-border">
      {/* Top Banner & Fast Launch - Swiss Monochrome */}
      <div className="rounded-2xl bg-zinc-950 border border-white/20 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Call Workspace
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-white font-mono uppercase tracking-wider border border-white/20">
              {activeTier} Plan
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl">
            Review past multilingual call recordings, meeting summaries, and actionable task deliverables.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            className="h-10 px-3.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-1.5 shrink-0 bg-zinc-900 border border-white/20 text-white hover:bg-zinc-850 hover:border-white transition-colors cursor-pointer"
            title="Export call logs to CSV"
          >
            <Download className="w-3.5 h-3.5 text-zinc-300" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => onJoinRoom && onJoinRoom('VOX-ROOM-101')}
            className="h-10 px-4 sm:px-5 rounded-xl text-xs sm:text-sm font-semibold shrink-0 bg-white hover:bg-zinc-200 text-black shadow-md flex items-center gap-2 transition-all cursor-pointer"
          >
            <PhoneCall className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Start Live Call</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid - Swiss Minimalist Monochrome */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl bg-zinc-950 border border-white/15 p-3.5 sm:p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-zinc-400 font-mono">
            <span>Total Call Time</span>
            <Clock className="w-3.5 h-3.5 text-zinc-300" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">98h 04m</div>
          <div className="text-[11px] text-zinc-400 font-mono">+14% this month</div>
        </div>

        <div className="rounded-xl bg-zinc-950 border border-white/15 p-3.5 sm:p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-zinc-400 font-mono">
            <span>Words Translated</span>
            <Globe className="w-3.5 h-3.5 text-zinc-300" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">104,210</div>
          <div className="text-[11px] text-zinc-400 font-mono">Across 45 languages</div>
        </div>

        <div className="rounded-xl bg-zinc-950 border border-white/15 p-3.5 sm:p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-zinc-400 font-mono">
            <span>Action Items</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-zinc-300" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">{actionItems.length} Tasks</div>
          <div className="text-[11px] text-zinc-400 font-mono">{actionItems.filter(t => t.status === 'Completed').length} completed</div>
        </div>

        <div className="rounded-xl bg-zinc-950 border border-white/15 p-3.5 sm:p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-zinc-400 font-mono">
            <span>Audio Quality</span>
            <Activity className="w-3.5 h-3.5 text-zinc-300" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">Studio HD</div>
          <div className="text-[11px] text-zinc-400 font-mono">Neural synthesis active</div>
        </div>
      </div>

      {/* Main Split: Audit Table + Task Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 flex-1 min-h-0">
        {/* Left 8 Cols: Session History */}
        <div className="lg:col-span-8 rounded-2xl bg-zinc-950 border border-white/20 p-4 sm:p-5 flex flex-col justify-between shadow-lg overflow-hidden">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3.5 mb-3.5">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Call History & Transcripts
                </h3>
                <p className="text-xs text-zinc-400">
                  Access conversation logs, translated minutes, and past room records.
                </p>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Search calls or rooms..."
                  className="h-9 bg-black border border-white/20 rounded-xl pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white w-full sm:w-56"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-400 text-xs font-mono">
                    <th className="pb-3 font-semibold">Caller & Room</th>
                    <th className="pb-3 font-semibold">Language Route</th>
                    <th className="pb-3 font-semibold">Duration</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredHistory.length > 0 ? (
                    filteredHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-900/60 transition-colors">
                        <td className="py-3">
                          <div className="font-semibold text-white">{item.peerName}</div>
                          <div className="text-xs text-zinc-400 font-mono">{item.roomId} • {item.timestamp}</div>
                        </td>
                        <td className="py-3 text-zinc-300">
                          <span>{item.sourceLang}</span>
                          <span className="text-zinc-500 mx-1.5 font-mono">→</span>
                          <span className="text-white font-medium">{item.targetLang}</span>
                        </td>
                        <td className="py-3 text-zinc-300 font-mono">{item.duration}</td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.hasAudio && (
                              <button
                                onClick={() => handlePlaySampleAudio(item.id)}
                                className="h-8 px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1 bg-zinc-900 border border-white/20 text-white hover:bg-zinc-800 cursor-pointer"
                                title="Play recorded audio sample"
                              >
                                <Volume2 className={`w-3.5 h-3.5 ${playingCallId === item.id ? 'text-white animate-pulse' : 'text-zinc-400'}`} />
                                <span className="hidden sm:inline">{playingCallId === item.id ? 'Playing' : 'Audio'}</span>
                              </button>
                            )}
                            <button
                              onClick={() => onJoinRoom && onJoinRoom(item.roomId)}
                              className="h-8 px-3 rounded-lg text-xs font-medium inline-flex items-center bg-zinc-900 border border-white/20 text-white hover:bg-zinc-800 cursor-pointer"
                            >
                              Rejoin
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs text-zinc-500">
                        No call sessions matching "{filterQuery}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Extracted Action Items */}
        <div className="lg:col-span-4 rounded-2xl bg-zinc-950 border border-white/20 p-4 sm:p-5 space-y-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5 mb-3.5">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Action Items
                </h3>
                <p className="text-xs text-zinc-400">
                  AI-extracted deliverables from calls
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowAddTask(prev => !prev)}
                  className="h-8.5 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1 bg-white hover:bg-zinc-200 text-black cursor-pointer shadow-sm"
                  title="Add new action item"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>

                <button
                  onClick={onOpenMinutes}
                  className="h-8.5 px-2.5 rounded-lg text-xs font-medium bg-zinc-900 border border-white/20 text-white hover:bg-zinc-800 cursor-pointer"
                >
                  Minutes
                </button>
              </div>
            </div>

            {/* Inline Add Task Form */}
            {showAddTask && (
              <form onSubmit={handleAddNewTask} className="p-3 bg-black rounded-xl border border-white/20 space-y-2 mb-3">
                <div className="flex justify-between items-center text-xs font-semibold text-white">
                  <span>Create Action Item</span>
                  <button type="button" onClick={() => setShowAddTask(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Task description..."
                  required
                  className="w-full h-8 px-2.5 bg-zinc-950 border border-white/20 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTaskAssignee}
                    onChange={(e) => setNewTaskAssignee(e.target.value)}
                    placeholder="Assignee (e.g. You)"
                    className="flex-1 h-8 px-2.5 bg-zinc-950 border border-white/20 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white"
                  />
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value)}
                    className="h-8 px-2 bg-zinc-950 border border-white/20 rounded-lg text-xs text-white focus:outline-none focus:border-white"
                  >
                    <option value="High" className="bg-black text-white">High</option>
                    <option value="Medium" className="bg-black text-white">Medium</option>
                    <option value="Low" className="bg-black text-white">Low</option>
                  </select>
                </div>
                <button type="submit" className="w-full h-8 rounded-lg text-xs font-semibold bg-white text-black hover:bg-zinc-200 cursor-pointer">
                  Save Item
                </button>
              </form>
            )}

            <div className="space-y-2.5">
              {actionItems.map((task) => (
                <div
                  key={task.id}
                  onClick={() => toggleTaskStatus(task.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    task.status === 'Completed'
                      ? 'bg-black/60 border-white/10 opacity-60'
                      : 'bg-black border-white/20 hover:border-white/40'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                      task.status === 'Completed'
                        ? 'bg-white border-white text-black'
                        : 'border-white/40'
                    }`}>
                      {task.status === 'Completed' && <Check className="w-3 h-3 text-black" />}
                    </div>

                    <div className="space-y-0.5 flex-1 min-w-0">
                      <p className={`text-xs font-medium leading-snug break-words ${
                        task.status === 'Completed' ? 'line-through text-zinc-500' : 'text-zinc-100'
                      }`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-zinc-400 font-mono">
                        <span>{task.assignee}</span>
                        <span>•</span>
                        <span className={`font-semibold ${task.priority === 'High' ? 'text-white' : 'text-zinc-400'}`}>{task.priority}</span>
                        <span>•</span>
                        <span>{task.date}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {actionItems.some(t => t.status === 'Completed') && (
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleClearCompletedTasks}
                  className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer font-mono"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear completed</span>
                </button>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/10 flex justify-between items-center">
            <span className="text-xs text-zinc-400">Upgrade for cloud sync</span>
            <button
              onClick={onOpenPricing}
              className="text-xs font-semibold text-white hover:text-zinc-300 flex items-center gap-1 cursor-pointer font-mono"
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
