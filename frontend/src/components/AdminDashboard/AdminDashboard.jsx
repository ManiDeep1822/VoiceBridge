import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Activity, Users, Server,
  CheckCircle2, RefreshCw, PhoneCall, ArrowRight,
  Plus, Trash2, Download, PowerOff, X, UserCheck
} from 'lucide-react';

export function AdminDashboard({
  backendUrl = '',
  currency = 'INR',
  onOpenPricing
}) {
  const [liveRoomsData, setLiveRoomsData] = useState({ total_rooms: 0, rooms: {} });
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
      activeRooms: liveRoomsData.rooms,
      teamMembers: orgUsers
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VoiceBridge_Fleet_Audit_${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#07090C] p-3 sm:p-6 overflow-y-auto w-full space-y-4 sm:space-y-5 select-none font-sans text-sm box-border">
      {/* Header Bar */}
      <div className="rounded-2xl bg-[#0D121F]/90 border border-slate-800/90 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Admin Console
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20 glow-emerald">
              Fleet Operational
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
            Real-time session monitoring, system health metrics, active room management, and enterprise seats.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportTelemetry}
            className="btn-secondary h-10 px-3.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-1.5 shrink-0"
            title="Download fleet audit telemetry"
          >
            <Download className="w-3.5 h-3.5 text-slate-300" />
            <span className="hidden sm:inline">Export Audit</span>
          </button>

          <button
            onClick={fetchLiveRooms}
            disabled={isLoadingRooms}
            className="btn-secondary h-10 px-4 rounded-xl text-xs sm:text-sm font-medium shrink-0 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRooms ? 'animate-spin text-blue-400' : ''}`} />
            <span>Refresh Status</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 text-blue-400 p-3 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl bg-[#0D121F]/80 border border-slate-800/80 p-3.5 sm:p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Monthly Run-Rate</span>
            <span className="font-semibold text-white">{isINR ? '₹ INR' : '$ USD'}</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">
            {isINR ? '₹ 29,80,000' : '$ 35,760'}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">Enterprise licenses</div>
        </div>

        <div className="rounded-xl bg-[#0D121F]/80 border border-slate-800/80 p-3.5 sm:p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Active Live Rooms</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">
            {liveRoomsData.total_rooms} Rooms
          </div>
          <div className="text-[11px] text-emerald-400 font-medium">Real-time WebRTC channels</div>
        </div>

        <div className="rounded-xl bg-[#0D121F]/80 border border-slate-800/80 p-3.5 sm:p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Translation Engine</span>
            <Server className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">Google Neural</div>
          <div className="text-[11px] text-emerald-400 font-medium">Sub-200ms processing</div>
        </div>

        <div className="rounded-xl bg-[#0D121F]/80 border border-slate-800/80 p-3.5 sm:p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>System Health</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">99.98%</div>
          <div className="text-[11px] text-emerald-400 font-medium">All clusters healthy</div>
        </div>
      </div>

      {/* Main Split: Live Rooms + User Seats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 flex-1 min-h-0">
        {/* Active Rooms */}
        <div className="lg:col-span-6 rounded-2xl bg-[#0D121F]/90 border border-slate-800/90 p-4 sm:p-5 space-y-4 shadow-lg flex flex-col justify-between overflow-hidden">
          <div>
            <div className="border-b border-slate-800/80 pb-3.5 mb-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Active Call Sessions
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time rooms currently hosting live callers
                </p>
              </div>

              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {liveRoomsData.total_rooms} Live
              </span>
            </div>

            {Object.keys(liveRoomsData.rooms || {}).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(liveRoomsData.rooms).map(([roomId, participants]) => (
                  <div key={roomId} className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white text-sm">{roomId}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {Array.isArray(participants) ? participants.length : 1} Participant(s) • Live Voice Stream
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse glow-emerald" />
                      <button
                        onClick={() => handleTerminateRoom(roomId)}
                        className="btn-danger h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1"
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
              <div className="text-center py-10 text-slate-500 text-xs">
                <PhoneCall className="w-8 h-8 mx-auto mb-2 opacity-40 text-blue-400" />
                <p className="text-slate-400 font-medium">No active call rooms at this moment.</p>
                <p className="text-[11px] text-slate-500 mt-0.5">When callers join from Call Studio, they will appear here in real time.</p>
              </div>
            )}
          </div>
        </div>

        {/* Organization Members */}
        <div className="lg:col-span-6 rounded-2xl bg-[#0D121F]/90 border border-slate-800/90 p-4 sm:p-5 space-y-4 shadow-lg flex flex-col justify-between overflow-hidden">
          <div>
            <div className="border-b border-slate-800/80 pb-3.5 mb-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Team Members & Seats
                </h3>
                <p className="text-xs text-slate-400">
                  Provisioned operator licenses and access roles
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddMember(prev => !prev)}
                  className="btn-primary h-8.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Member</span>
                </button>

                <button
                  onClick={onOpenPricing}
                  className="btn-secondary h-8.5 px-3 rounded-lg text-xs font-medium"
                >
                  Add Seats
                </button>
              </div>
            </div>

            {/* Inline Add Member Form */}
            {showAddMember && (
              <form onSubmit={handleAddMember} className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80 space-y-2 mb-3">
                <div className="flex justify-between items-center text-xs font-semibold text-white">
                  <span>Provision New Operator</span>
                  <button type="button" onClick={() => setShowAddMember(false)} className="text-slate-400 hover:text-white">
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
                    className="h-8 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="email"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    placeholder="operator@enterprise.com"
                    required
                    className="h-8 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                    className="flex-1 h-8 px-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Operator">Operator</option>
                    <option value="Auditor">Auditor</option>
                    <option value="Administrator">Administrator</option>
                  </select>
                  <button type="submit" className="btn-success h-8 px-4 rounded-lg text-xs font-semibold">
                    Confirm Seat
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-800/80 text-slate-400 text-xs">
                    <th className="pb-3 font-semibold">User</th>
                    <th className="pb-3 font-semibold">Role</th>
                    <th className="pb-3 font-semibold">Plan</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {orgUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3">
                        <div className="font-semibold text-white">{u.name}</div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                      </td>
                      <td className="py-3 text-slate-300">{u.role}</td>
                      <td className="py-3 text-slate-300">{u.tier}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleMemberStatus(u.id)}
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                              u.status === 'Active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-amber-500/10 hover:text-amber-400'
                                : 'bg-slate-800 text-slate-400 hover:text-emerald-400'
                            }`}
                            title="Click to toggle status"
                          >
                            {u.status}
                          </button>
                          <button
                            onClick={() => handleRemoveMember(u.id)}
                            className="text-slate-500 hover:text-red-400 p-1"
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
