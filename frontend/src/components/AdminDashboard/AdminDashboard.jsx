import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Activity, Users, Server,
  CheckCircle2, RefreshCw, PhoneCall, ArrowRight,
  Plus, Trash2, Download, PowerOff, X, UserCheck
} from 'lucide-react';
import { determineBackendUrl } from '../../utils/backendUrl';

export function AdminDashboard({
  backendUrl: propBackendUrl = '',
  currency = 'INR',
  onOpenPricing
}) {
  const backendUrl = propBackendUrl || determineBackendUrl();
  const [liveRoomsData, setLiveRoomsData] = useState({ total_rooms: 0, rooms: {} });
  const [totalCallLogs, setTotalCallLogs] = useState(0);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('Operator');
  const [statusMessage, setStatusMessage] = useState('');

  const [orgUsers, setOrgUsers] = useState(() => {
    try {
      const saved = localStorage.getItem('voicebridge_team_members');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      { id: 'USR-01', name: 'Rajesh Sharma', email: 'rajesh@enterprise.in', role: 'Administrator', tier: 'Enterprise', status: 'Active' },
      { id: 'USR-02', name: 'Elena Rostova', email: 'elena@vanguard.de', role: 'Operator', tier: 'Pro', status: 'In Call' },
      { id: 'USR-03', name: 'Marcus Vance', email: 'marcus@defense.gov', role: 'Auditor', tier: 'Enterprise', status: 'Active' },
      { id: 'USR-04', name: 'Priya Patel', email: 'priya@techcorp.in', role: 'Operator', tier: 'Pro', status: 'Active' }
    ];
  });

  const isINR = currency === 'INR';

  useEffect(() => {
    try {
      localStorage.setItem('voicebridge_team_members', JSON.stringify(orgUsers));
    } catch (e) {}
  }, [orgUsers]);

  const fetchLiveRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const url = backendUrl ? `${backendUrl}/api/rooms` : '/api/rooms';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLiveRoomsData(data);
      }

      // Also fetch real call logs count from SQLite
      const logsUrl = backendUrl ? `${backendUrl}/api/call-logs` : '/api/call-logs';
      const logsRes = await fetch(logsUrl);
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        if (logsData && typeof logsData.total === 'number') {
          setTotalCallLogs(logsData.total);
        }
      }
    } catch (e) {
      // Graceful fallback
    } finally {
      setIsLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchLiveRooms();
    const interval = setInterval(fetchLiveRooms, 6000);
    return () => clearInterval(interval);
  }, [backendUrl]);

  const handleTerminateRoom = async (roomId) => {
    try {
      const url = backendUrl ? `${backendUrl}/api/rooms/${roomId}` : `/api/rooms/${roomId}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) {
        setStatusMessage(`Call room ${roomId} was terminated.`);
        setTimeout(() => setStatusMessage(''), 3000);
        fetchLiveRooms();
      }
    } catch (e) {
      console.warn('Failed to terminate room:', e);
    }
  };

  const handleAddMember = (e) => {
    e.preventDefault();
    if (!memberName.trim() || !memberEmail.trim()) return;

    const newMember = {
      id: `USR-${Math.floor(10 + Math.random() * 90)}`,
      name: memberName.trim(),
      email: memberEmail.trim().toLowerCase(),
      role: memberRole,
      tier: 'Pro',
      status: 'Active'
    };

    setOrgUsers(prev => [newMember, ...prev]);
    setMemberName('');
    setMemberEmail('');
    setShowAddMember(false);
    setStatusMessage(`Team member ${newMember.name} added.`);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const handleToggleMemberStatus = (id) => {
    setOrgUsers(prev => prev.map(u => {
      if (u.id === id) {
        const nextStatus = u.status === 'Active' ? 'Inactive' : 'Active';
        return { ...u, status: nextStatus };
      }
      return u;
    }));
  };

  const handleRemoveMember = (id) => {
    setOrgUsers(prev => prev.filter(u => u.id !== id));
  };

  const handleExportTelemetry = () => {
    const report = {
      timestamp: new Date().toISOString(),
      fleetHealth: 'Operational (99.98%)',
      totalLiveRooms: liveRoomsData.total_rooms,
      totalArchivedLogs: totalCallLogs,
      activeRooms: liveRoomsData.rooms,
      teamMembers: orgUsers
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VoiceBridge_Fleet_Audit_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-black p-3 sm:p-6 overflow-y-auto w-full space-y-4 sm:space-y-5 select-none font-sans text-sm box-border">
      {/* Header Bar - Swiss Monochrome */}
      <div className="rounded-2xl bg-zinc-950 border border-white/20 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Admin Console
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-white font-mono uppercase tracking-wider border border-white/20">
              Fleet Operational
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl">
            Real-time session monitoring, system health metrics, active room management, and enterprise seats.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportTelemetry}
            className="h-10 px-3.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-1.5 shrink-0 bg-zinc-900 border border-white/20 text-white hover:bg-zinc-850 hover:border-white transition-colors cursor-pointer"
            title="Download fleet audit telemetry"
          >
            <Download className="w-3.5 h-3.5 text-zinc-300" />
            <span className="hidden sm:inline">Export Audit</span>
          </button>

          <button
            onClick={fetchLiveRooms}
            disabled={isLoadingRooms}
            className="h-10 px-4 rounded-xl text-xs sm:text-sm font-medium shrink-0 flex items-center gap-1.5 bg-white text-black hover:bg-zinc-200 transition-colors cursor-pointer font-semibold shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRooms ? 'animate-spin text-black' : ''}`} />
            <span>Refresh Status</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-xl border border-white/30 bg-zinc-900 text-white p-3 text-xs font-semibold flex items-center gap-2 animate-fadeIn font-mono">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* KPI Metrics - Swiss Minimalist Monochrome */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl bg-zinc-950 border border-white/15 p-3.5 sm:p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-zinc-400 font-mono">
            <span>Monthly Run-Rate</span>
            <span className="font-semibold text-white">{isINR ? '₹ INR' : '$ USD'}</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">
            {isINR ? '₹ 29,80,000' : '$ 35,760'}
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">Enterprise licenses</div>
        </div>

        <div className="rounded-xl bg-zinc-950 border border-white/15 p-3.5 sm:p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-zinc-400 font-mono">
            <span>Active Live Rooms</span>
            <Activity className="w-3.5 h-3.5 text-zinc-300" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">
            {liveRoomsData.total_rooms} Rooms
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">Real-time WebRTC channels</div>
        </div>

        <div className="rounded-xl bg-zinc-950 border border-white/15 p-3.5 sm:p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-zinc-400 font-mono">
            <span>Database Call Logs</span>
            <Server className="w-3.5 h-3.5 text-zinc-300" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">
            {totalCallLogs} Logs
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">SQLite WAL persistence</div>
        </div>

        <div className="rounded-xl bg-zinc-950 border border-white/15 p-3.5 sm:p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-zinc-400 font-mono">
            <span>Fleet Health</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-zinc-300" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">99.98%</div>
          <div className="text-[11px] text-zinc-400 font-mono">All clusters healthy</div>
        </div>
      </div>

      {/* Main Split: Live Rooms + User Seats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 flex-1 min-h-0">
        {/* Active Rooms */}
        <div className="lg:col-span-6 rounded-2xl bg-zinc-950 border border-white/20 p-4 sm:p-5 space-y-4 shadow-lg flex flex-col justify-between overflow-hidden">
          <div>
            <div className="border-b border-white/10 pb-3.5 mb-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Active Call Sessions
                </h3>
                <p className="text-xs text-zinc-400">
                  Real-time rooms currently hosting live callers
                </p>
              </div>

              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 text-white border border-white/20 font-mono">
                {liveRoomsData.total_rooms} Live
              </span>
            </div>

            {Object.keys(liveRoomsData.rooms || {}).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(liveRoomsData.rooms).map(([roomId, participants]) => (
                  <div key={roomId} className="p-3.5 rounded-xl bg-black border border-white/20 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white text-sm font-mono">{roomId}</div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {Array.isArray(participants) ? participants.length : 1} Participant(s) • Live Voice Stream
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                      <button
                        onClick={() => handleTerminateRoom(roomId)}
                        className="h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1 bg-zinc-900 border border-white/20 text-white hover:bg-zinc-800 cursor-pointer"
                        title="Force terminate call room"
                      >
                        <PowerOff className="w-3.5 h-3.5" />
                        <span>End</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-zinc-500 text-xs">
                <PhoneCall className="w-8 h-8 mx-auto mb-2 opacity-40 text-white" />
                <p className="text-zinc-300 font-medium">No active call rooms at this moment.</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">When callers join from Call Studio, they will appear here in real time.</p>
              </div>
            )}
          </div>
        </div>

        {/* Organization Members */}
        <div className="lg:col-span-6 rounded-2xl bg-zinc-950 border border-white/20 p-4 sm:p-5 space-y-4 shadow-lg flex flex-col justify-between overflow-hidden">
          <div>
            <div className="border-b border-white/10 pb-3.5 mb-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Team Members & Seats
                </h3>
                <p className="text-xs text-zinc-400">
                  Provisioned operator licenses and access roles
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddMember(prev => !prev)}
                  className="h-8.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1 bg-white text-black hover:bg-zinc-200 cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Member</span>
                </button>

                <button
                  onClick={onOpenPricing}
                  className="h-8.5 px-3 rounded-lg text-xs font-medium bg-zinc-900 border border-white/20 text-white hover:bg-zinc-800 cursor-pointer"
                >
                  Add Seats
                </button>
              </div>
            </div>

            {/* Inline Add Member Form */}
            {showAddMember && (
              <form onSubmit={handleAddMember} className="p-3 bg-black rounded-xl border border-white/20 space-y-2 mb-3">
                <div className="flex justify-between items-center text-xs font-semibold text-white">
                  <span>Provision New Operator</span>
                  <button type="button" onClick={() => setShowAddMember(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    placeholder="Full Name"
                    required
                    className="h-8 px-2.5 bg-zinc-950 border border-white/20 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white"
                  />
                  <input
                    type="email"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    placeholder="operator@enterprise.com"
                    required
                    className="h-8 px-2.5 bg-zinc-950 border border-white/20 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                    className="flex-1 h-8 px-2 bg-zinc-950 border border-white/20 rounded-lg text-xs text-white focus:outline-none focus:border-white"
                  >
                    <option value="Operator" className="bg-black text-white">Operator</option>
                    <option value="Auditor" className="bg-black text-white">Auditor</option>
                    <option value="Administrator" className="bg-black text-white">Administrator</option>
                  </select>
                  <button type="submit" className="h-8 px-4 rounded-lg text-xs font-semibold bg-white text-black hover:bg-zinc-200 cursor-pointer">
                    Confirm Seat
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-400 text-xs font-mono">
                    <th className="pb-3 font-semibold">User</th>
                    <th className="pb-3 font-semibold">Role</th>
                    <th className="pb-3 font-semibold">Plan</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {orgUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-zinc-900/60 transition-colors">
                      <td className="py-3">
                        <div className="font-semibold text-white">{u.name}</div>
                        <div className="text-xs text-zinc-400 font-mono">{u.email}</div>
                      </td>
                      <td className="py-3 text-zinc-300 font-mono">{u.role}</td>
                      <td className="py-3 text-zinc-300 font-mono">{u.tier}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleMemberStatus(u.id)}
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors font-mono cursor-pointer ${
                              u.status === 'Active'
                                ? 'bg-white/15 text-white border border-white/30 hover:bg-white/25'
                                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/10'
                            }`}
                            title="Click to toggle status"
                          >
                            {u.status}
                          </button>
                          <button
                            onClick={() => handleRemoveMember(u.id)}
                            className="text-zinc-500 hover:text-white p-1 cursor-pointer"
                            title="Remove operator"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
