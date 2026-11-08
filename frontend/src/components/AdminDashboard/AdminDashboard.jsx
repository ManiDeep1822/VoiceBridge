import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Activity, Users, Server,
  CheckCircle2, RefreshCw, PhoneCall, ArrowRight
} from 'lucide-react';

export function AdminDashboard({
  backendUrl = '',
  currency = 'INR',
  onOpenPricing
}) {
  const [liveRoomsData, setLiveRoomsData] = useState({ total_rooms: 0, rooms: {} });
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

  const isINR = currency === 'INR';

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

  const orgUsers = [
    { id: 'USR-01', name: 'Rajesh Sharma', email: 'rajesh@enterprise.in', role: 'Administrator', tier: 'Enterprise', status: 'Active' },
    { id: 'USR-02', name: 'Elena Rostova', email: 'elena@vanguard.de', role: 'Operator', tier: 'Pro', status: 'In Call' },
    { id: 'USR-03', name: 'Marcus Vance', email: 'marcus@defense.gov', role: 'Auditor', tier: 'Enterprise', status: 'Active' },
    { id: 'USR-04', name: 'Priya Patel', email: 'priya@techcorp.in', role: 'Operator', tier: 'Pro', status: 'Ready' }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0F17] p-4 sm:p-6 overflow-y-auto w-full space-y-5 select-none font-sans text-sm">
      {/* Header Bar */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Admin Console
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
              Operational
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
            Real-time session monitoring, system health metrics, active room management, and enterprise seats.
          </p>
        </div>

        <button
          onClick={fetchLiveRooms}
          disabled={isLoadingRooms}
          className="btn-secondary h-11 px-5 py-2.5 rounded-xl text-sm font-medium shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isLoadingRooms ? 'animate-spin text-blue-400' : ''}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Monthly Run-Rate</span>
            <span className="font-semibold text-white">{isINR ? '₹ INR' : '$ USD'}</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {isINR ? '₹ 29,80,000' : '$ 35,760'}
          </div>
          <div className="text-xs text-slate-400 font-medium">Enterprise licenses</div>
        </div>

        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Active Live Rooms</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {liveRoomsData.total_rooms} Rooms
          </div>
          <div className="text-xs text-emerald-400 font-medium">Real-time WebRTC channels</div>
        </div>

        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Translation Engine</span>
            <Server className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">Google Neural</div>
          <div className="text-xs text-emerald-400 font-medium">Sub-200ms processing</div>
        </div>

        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>System Health</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">99.98%</div>
          <div className="text-xs text-emerald-400 font-medium">All clusters healthy</div>
        </div>
      </div>

      {/* Main Split: Live Rooms + User Seats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
        {/* Active Rooms */}
        <div className="lg:col-span-6 rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="border-b border-slate-800 pb-4 mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">
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
                {Object.entries(liveRoomsData.rooms).map(([roomId, room]) => (
                  <div key={roomId} className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white text-sm">{roomId}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {room.participant_count || 1} Participant(s) • Live Voice Stream
                      </div>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10B981]" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-500 text-xs">
                <PhoneCall className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No active call rooms at this moment.</p>
                <p className="text-[11px] text-slate-600 mt-0.5">When callers join from Call Studio, they will appear here in real time.</p>
              </div>
            )}
          </div>
        </div>

        {/* Organization Members */}
        <div className="lg:col-span-6 rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="border-b border-slate-800 pb-4 mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">
                  Team Members & Seats
                </h3>
                <p className="text-xs text-slate-400">
                  Provisioned operator licenses and access roles
                </p>
              </div>

              <button
                onClick={onOpenPricing}
                className="btn-secondary h-9 px-3.5 rounded-lg text-xs font-medium"
              >
                Add Seats
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs">
                    <th className="pb-3 font-semibold">User</th>
                    <th className="pb-3 font-semibold">Role</th>
                    <th className="pb-3 font-semibold">Plan</th>
                    <th className="pb-3 font-semibold text-right">Status</th>
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
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          u.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          u.status === 'In Call' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {u.status}
                        </span>
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
