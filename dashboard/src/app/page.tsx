'use client';

import { useState, useEffect } from 'react';

interface AttackBreakdown {
  [key: string]: number;
}

interface LogEntry {
  timestamp: number;
  method: string;
  path: string;
  status: string;
  wallet?: string;
  amount?: string;
  attackType?: string;
  detail?: string;
}

interface Stats {
  totalRequests: number;
  totalUsdc: number;
  attacksMitigated: number;
  recentRequestsPerMinute: number;
  attackBreakdown: AttackBreakdown;
  lastRequests: LogEntry[];
}

const STATUS_COLORS: Record<string, string> = {
  challenged: 'text-yellow-400',
  paid: 'text-green-400',
  rejected: 'text-red-400',
  rate_limited: 'text-orange-400',
  blocked: 'text-red-500'
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString();
}

function truncate(s: string, n = 20) {
  return s.length > n ? s.slice(0, n) + '...' : s;
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const fetchStats = () => {
      fetch('http://localhost:3000/stats')
        .then(r => r.json())
        .then(setStats)
        .catch(() => {});
    };
    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 font-sans">
      <header className="mb-8 border-b border-gray-700 pb-4">
        <h1 className="text-4xl font-bold text-blue-400">Aegis402 Dashboard</h1>
        <p className="text-gray-400 mt-2">Enterprise-Grade Verification-Native Agentic Firewall</p>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
          <h2 className="text-xl font-semibold mb-2">Total Requests</h2>
          <p className="text-5xl font-bold text-green-400">
            {stats ? stats.totalRequests.toLocaleString() : '...'}
          </p>
          <p className="text-sm text-gray-400 mt-2">
            {stats ? stats.recentRequestsPerMinute : 0}/min
          </p>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
          <h2 className="text-xl font-semibold mb-2">USDC Settled</h2>
          <p className="text-5xl font-bold text-blue-400">
            {stats ? stats.totalUsdc.toFixed(2) : '...'}
          </p>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
          <h2 className="text-xl font-semibold mb-2">Attacks Blocked</h2>
          <p className="text-5xl font-bold text-red-400">
            {stats ? stats.attacksMitigated : '...'}
          </p>
          {stats && Object.keys(stats.attackBreakdown).length > 0 && (
            <div className="text-xs text-gray-400 mt-2">
              {Object.entries(stats.attackBreakdown).map(([type, count]) => (
                <div key={type}>{type}: {count}</div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
          <h2 className="text-xl font-semibold mb-2">Status</h2>
          <p className="text-2xl font-bold text-green-400">Operational</p>
          <p className="text-sm text-gray-400 mt-2">
            {stats ? 'Live' : 'Connecting...'}
          </p>
        </div>
      </main>

      <section className="mt-12">
        <h2 className="text-2xl font-bold mb-4">Live Request Log</h2>
        <div className="bg-black p-4 rounded-xl font-mono text-sm border border-gray-800 overflow-y-auto h-80">
          {stats && stats.lastRequests.length > 0 ? (
            stats.lastRequests.map((entry, i) => (
              <div key={i} className={STATUS_COLORS[entry.status] || 'text-gray-400'}>
                [{formatTime(entry.timestamp)}] {entry.status.toUpperCase()} {entry.method} {truncate(entry.path, 40)}
                {entry.wallet && ` - ${truncate(entry.wallet, 16)}`}
                {entry.amount && ` $${entry.amount}`}
                {entry.attackType && ` [${entry.attackType}]`}
              </div>
            ))
          ) : (
            <div className="text-gray-500">Waiting for data...</div>
          )}
        </div>
      </section>
    </div>
  );
}
