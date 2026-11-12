import React, { useState, useEffect } from 'react';
import {
  Clock, PhoneCall, CheckCircle2, FileText,
  Globe, Search, Check, Activity, Calendar, ArrowRight,
  Download, Plus, Trash2, Volume2, X
} from 'lucide-react';

export function UserDashboard({
  onJoinRoom,
  onOpenMinutes,
  onOpenPricing,
  activeTier = 'free',
  currency = 'INR'
}) {
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
    a.click();
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
    <div className="flex-1 flex flex-col h-full bg-[#07090C] p-3 sm:p-6 overflow-y-auto w-full space-y-4 sm:space-y-5 select-none font-sans text-sm box-border">
      {/* Top Banner & Fast Launch */}
      <div className="rounded-2xl bg-[#0D121F]/90 border border-slate-800/90 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Call Workspace
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20 uppercase tracking-wide">
              {activeTier} Plan
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
            Review past multilingual call recordings, meeting summaries, and actionable task deliverables.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            className="btn-secondary h-10 px-3.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-1.5 shrink-0"
            title="Export call logs to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-300" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => onJoinRoom && onJoinRoom('VOX-ROOM-101')}
            className="btn-primary h-10 px-4 sm:px-5 rounded-xl text-xs sm:text-sm font-semibold shrink-0"
          >
            <PhoneCall className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Start Live Call</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl bg-[#0D121F]/80 border border-slate-800/80 p-3.5 sm:p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Total Call Time</span>
            <Clock className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">98h 04m</div>
          <div className="text-[11px] text-emerald-400 font-medium">+14% this month</div>
        </div>

        <div className="rounded-xl bg-[#0D121F]/80 border border-slate-800/80 p-3.5 sm:p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Words Translated</span>
            <Globe className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">104,210</div>
          <div className="text-[11px] text-slate-400">Across 12 languages</div>
        </div>

        <div className="rounded-xl bg-[#0D121F]/80 border border-slate-800/80 p-3.5 sm:p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Action Items</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">{actionItems.length} Tasks</div>
          <div className="text-[11px] text-slate-400">{actionItems.filter(t => t.status === 'Completed').length} completed</div>
        </div>

        <div className="rounded-xl bg-[#0D121F]/80 border border-slate-800/80 p-3.5 sm:p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Audio Quality</span>
            <Activity className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">Studio HD</div>
          <div className="text-[11px] text-emerald-400 font-medium">Neural synthesis active</div>
        </div>
      </div>

      {/* Main Split: Audit Table + Task Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 flex-1 min-h-0">
        {/* Left 8 Cols: Session History */}
        <div className="lg:col-span-8 rounded-2xl bg-[#0D121F]/90 border border-slate-800/90 p-4 sm:p-5 flex flex-col justify-between shadow-lg overflow-hidden">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5 mb-3.5">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Call History & Transcripts
                </h3>
                <p className="text-xs text-slate-400">
                  Access conversation logs, translated minutes, and past room records.
                </p>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Search calls or rooms..."
                  className="h-9 bg-slate-800/90 border border-slate-700/80 rounded-xl pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full sm:w-56"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-800/80 text-slate-400 text-xs">
                    <th className="pb-3 font-semibold">Caller & Room</th>
                    <th className="pb-3 font-semibold">Language Route</th>
                    <th className="pb-3 font-semibold">Duration</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredHistory.length > 0 ? (
                    filteredHistory.map((item) => (
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
                          <div className="flex items-center justify-end gap-1.5">
                            {item.hasAudio && (
                              <button
                                onClick={() => handlePlaySampleAudio(item.id)}
                                className="btn-secondary h-8 px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1"
                                title="Play recorded audio sample"
                              >
                                <Volume2 className={`w-3.5 h-3.5 ${playingCallId === item.id ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
                                <span className="hidden sm:inline">{playingCallId === item.id ? 'Playing' : 'Audio'}</span>
                              </button>
                            )}
                            <button
                              onClick={() => onJoinRoom && onJoinRoom(item.roomId)}
                              className="btn-secondary h-8 px-3 rounded-lg text-xs font-medium inline-flex"
                            >
                              Rejoin
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs text-slate-500">
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
        <div className="lg:col-span-4 rounded-2xl bg-[#0D121F]/90 border border-slate-800/90 p-4 sm:p-5 space-y-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3.5 mb-3.5">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Action Items
                </h3>
                <p className="text-xs text-slate-400">
                  AI-extracted deliverables from calls
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowAddTask(prev => !prev)}
                  className="btn-primary h-8.5 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1"
                  title="Add new action item"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>

                <button
                  onClick={onOpenMinutes}
                  className="btn-secondary h-8.5 px-2.5 rounded-lg text-xs font-medium"
                >
                  Minutes
                </button>
              </div>
            </div>

            {/* Inline Add Task Form */}
            {showAddTask && (
              <form onSubmit={handleAddNewTask} className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80 space-y-2 mb-3">
                <div className="flex justify-between items-center text-xs font-semibold text-white">
                  <span>Create Action Item</span>
                  <button type="button" onClick={() => setShowAddTask(false)} className="text-slate-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Task description..."
                  required
                  className="w-full h-8 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTaskAssignee}
                    onChange={(e) => setNewTaskAssignee(e.target.value)}
                    placeholder="Assignee (e.g. You)"
                    className="flex-1 h-8 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value)}
                    className="h-8 px-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <button type="submit" className="btn-success w-full h-8 rounded-lg text-xs font-semibold">
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
                      ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                      : 'bg-slate-800/70 border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                      task.status === 'Completed'
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'border-slate-600'
                    }`}>
                      {task.status === 'Completed' && <Check className="w-3 h-3" />}
                    </div>

                    <div className="space-y-0.5 flex-1 min-w-0">
                      <p className={`text-xs font-medium leading-snug break-words ${
                        task.status === 'Completed' ? 'line-through text-slate-400' : 'text-slate-100'
                      }`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-400">
                        <span>{task.assignee}</span>
                        <span>•</span>
                        <span className={`font-semibold ${task.priority === 'High' ? 'text-red-400' : 'text-amber-400'}`}>{task.priority}</span>
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
                  className="text-[11px] text-slate-400 hover:text-red-400 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear completed</span>
                </button>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex justify-between items-center">
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
