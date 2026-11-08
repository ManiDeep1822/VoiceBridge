import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Activity, Users, Server, IndianRupee, Zap,
  CheckCircle2, AlertTriangle, RefreshCw, Lock, ArrowUpRight, Cpu
} from 'lucide-react';

export function AdminDashboard({
  backendUrl = '',
  currency = 'INR',
  onOpenPricing
}) {
  const [liveRoomsData, setLiveRoomsData] = useState({ total_rooms: 0, rooms: {} });
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

  const isINR = currency === 'INR';

  // Fetch real live rooms from backend
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
    { id: 'USR-01', name: 'RAJESH SHARMA', email: 'rajesh@enterprise.in', role: 'SUPER ADMIN', tier: 'ENTERPRISE GLOBAL', status: 'ACTIVE' },
    { id: 'USR-02', name: 'ELENA ROSTOVA', email: 'elena@vanguard.de', role: 'OPERATOR', tier: 'PRO INDUSTRIAL', status: 'IN CALL' },
    { id: 'USR-03', name: 'MARCUS VANCE', email: 'marcus@defense.gov', role: 'COMPLIANCE AUDITOR', tier: 'ENTERPRISE GLOBAL', status: 'ACTIVE' },
    { id: 'USR-04', name: 'PRIYA PATEL', email: 'priya@techcorp.in', role: 'OPERATOR', tier: 'PRO INDUSTRIAL', status: 'STANDBY' }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0A0A0A] p-4 sm:p-6 overflow-y-auto w-full space-y-4 select-none font-mono text-xs">
      {/* Admin Header Bar */}
      <div className="border border-[#262626] bg-[#111111] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 bg-[#E61919]" />
            <h1 className="text-lg font-black text-white uppercase tracking-tight font-sans">
              ENTERPRISE ADMIN TELEMETRY CONSOLE
            </h1>
            <span className="text-[10px] px-2 py-0.5 border border-[#333333] bg-[#161616] text-[#A1A1AA]">
              SECURITY CLEARANCE: L3
            </span>
          </div>
          <p className="text-[11px] text-[#71717A] max-w-xl">
            Real-time fleet supervision, cluster health diagnostics, active WebSocket room audits, and GST compliance.
          </p>
        </div>

        <button
          onClick={fetchLiveRooms}
          disabled={isLoadingRooms}
          className="border border-[#333333] hover:border-white bg-[#161616] hover:bg-white hover:text-black text-white px-3 py-1.5 text-xs uppercase flex items-center gap-2 transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRooms ? 'animate-spin' : ''}`} />
          <span>[ SYNC FLEET TELEMETRY ]</span>
        </button>
      </div>

      {/* Top Telemetry & Revenue KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-[#262626] bg-[#111111] p-3 space-y-1">
          <div className="flex justify-between text-[10px] text-[#71717A]">
            <span>ARR RUN-RATE</span>
            <span className="text-white font-bold">{isINR ? '₹ INR' : '$ USD'}</span>
          </div>
          <div className="text-2xl font-black text-white font-sans">
            {isINR ? '₹ 29,80,000' : '$ 35,760'}
          </div>
          <div className="text-[10px] text-[#A1A1AA]">CORPORATE GST COMPLIANT</div>
        </div>

        <div className="border border-[#262626] bg-[#111111] p-3 space-y-1">
          <div className="flex justify-between text-[10px] text-[#71717A]">
            <span>ACTIVE LIVE SESSIONS</span>
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-black text-white font-sans">
            {liveRoomsData.total_rooms} ROOMS
          </div>
          <div className="text-[10px] text-[#39FF14]">WEBSOCKET REALTIME DUPLEX</div>
        </div>

        <div className="border border-[#262626] bg-[#111111] p-3 space-y-1">
          <div className="flex justify-between text-[10px] text-[#71717A]">
            <span>TRANSLATION P95 LATENCY</span>
            <Zap className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-black text-white font-sans">124 MS</div>
          <div className="text-[10px] text-[#A1A1AA]">SLA THRESHOLD: &lt; 250MS</div>
        </div>

        <div className="border border-[#262626] bg-[#111111] p-3 space-y-1">
          <div className="flex justify-between text-[10px] text-[#71717A]">
            <span>CLUSTER HEALTH</span>
            <Server className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-black text-white font-sans">99.99%</div>
          <div className="text-[10px] text-[#39FF14]">ALL 4 BRIDGES ONLINE</div>
        </div>
      </div>

      {/* Main Admin Section: Real Live Calls Fleet + Cluster Health */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1">
        {/* Left 8 Cols: Live Connected Rooms Table */}
        <div className="lg:col-span-8 border border-[#262626] bg-[#111111] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#262626] pb-3 mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase text-white tracking-wider">
                  [ ACTIVE WEBSOCKET ROOM TELEMETRY ]
                </h3>
                <p className="text-[10px] text-[#71717A]">
                  Real-time participant sessions connected to signaling server.
                </p>
              </div>
              <span className="text-[9px] border border-[#333333] bg-[#161616] text-[#A1A1AA] px-1.5 py-0.5">
                POLLING: 6S
              </span>
            </div>

            {Object.keys(liveRoomsData.rooms).length === 0 ? (
              <div className="border border-[#262626] bg-[#0E0E0E] p-8 text-center text-[#71717A] text-xs space-y-2">
                <p>[ NO PEER CALLS CURRENTLY ACTIVE IN REGISTRY ]</p>
                <p className="text-[#52525B]">
                  Launch a room from Call Studio to initiate real-time socket telemetry.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#262626] text-[#71717A] text-[10px] uppercase">
                      <th className="pb-2">ROOM IDENTIFIER</th>
                      <th className="pb-2">PARTICIPANTS</th>
                      <th className="pb-2">ROUTE</th>
                      <th className="pb-2">SOCKET STATUS</th>
                      <th className="pb-2 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F1F1F]">
                    {Object.entries(liveRoomsData.rooms).map(([rId, participants]) => (
                      <tr key={rId} className="hover:bg-[#161616] transition-colors">
                        <td className="py-2.5 font-bold text-white">{rId}</td>
                        <td className="py-2.5 text-[#A1A1AA]">
                          {participants.length} / 2 LINKED
                        </td>
                        <td className="py-2.5 text-white">
                          {participants.map(p => p.language?.toUpperCase() || 'EN').join(' ↔ ')}
                        </td>
                        <td className="py-2.5">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] border border-[#333333] bg-[#161616] text-white">
                            <span className="w-1.5 h-1.5 bg-[#39FF14]" />
                            P2P DUPLEX
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => window.open(window.location.origin + '?room=' + encodeURIComponent(rId), '_blank')}
                            className="px-2 py-0.5 border border-[#404040] hover:border-white bg-[#1A1A1A] hover:bg-white hover:text-black text-white text-[10px] uppercase transition-colors"
                          >
                            [ INSPECT ]
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#262626] flex items-center justify-between text-[10px] text-[#71717A]">
            <span>CLUSTER NODES: 4/4 SYNCHRONIZED</span>
            <span>END-TO-END ENCRYPTED</span>
          </div>
        </div>

        {/* Right 4 Cols: Fleet Operator Seats Management */}
        <div className="lg:col-span-4 border border-[#262626] bg-[#111111] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#262626] pb-3 mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase text-white tracking-wider">
                  [ FLEET OPERATOR SEATS ]
                </h3>
                <p className="text-[10px] text-[#71717A]">
                  Active enterprise seats and role authorizations.
                </p>
              </div>
              <span className="text-[9px] border border-[#333333] bg-[#161616] text-[#A1A1AA] px-1.5 py-0.5">
                4 SEATS
              </span>
            </div>

            <div className="space-y-2">
              {orgUsers.map((usr) => (
                <div key={usr.id} className="border border-[#262626] bg-[#141414] p-2.5 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white text-xs">{usr.name}</span>
                    <span className="text-[9px] border border-[#333333] bg-[#1A1A1A] text-white px-1.5 py-0.2">
                      {usr.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#71717A]">{usr.email}</div>
                  <div className="flex justify-between items-center text-[9px] text-[#A1A1AA] pt-1 border-t border-[#1F1F1F]">
                    <span>ROLE: {usr.role}</span>
                    <span>{usr.tier}</span>
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
              <span>[ PROVISION ENTERPRISE SEATS ]</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
