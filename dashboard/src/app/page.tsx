export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 font-sans">
      <header className="mb-8 border-b border-gray-700 pb-4">
        <h1 className="text-4xl font-bold text-blue-400">Aegis402 Dashboard</h1>
        <p className="text-gray-400 mt-2">Enterprise-Grade Verification-Native Agentic Firewall</p>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
          <h2 className="text-xl font-semibold mb-2">Total Requests Intercepted</h2>
          <p className="text-5xl font-bold text-green-400">1,204</p>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
          <h2 className="text-xl font-semibold mb-2">Total USDC Settled</h2>
          <p className="text-5xl font-bold text-blue-400">60.20</p>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
          <h2 className="text-xl font-semibold mb-2">Attacks Mitigated</h2>
          <p className="text-5xl font-bold text-red-400">42</p>
          <p className="text-sm text-gray-400 mt-2">Replay & Idempotency blocks</p>
        </div>
      </main>

      <section className="mt-12">
        <h2 className="text-2xl font-bold mb-4">Live Security Log</h2>
        <div className="bg-black p-4 rounded-xl font-mono text-sm border border-gray-800 overflow-y-auto h-64">
          <div className="text-green-500">[OK] Settled Tx: 0x8a9b... -> Forwarded to MCP</div>
          <div className="text-red-500">[BLOCK] 409 Conflict: Nonce replay detected from 192.168.1.1</div>
          <div className="text-green-500">[OK] Cache-Control headers sanitized for /api/data</div>
          <div className="text-yellow-500">[WARN] Upstream reachability ping > 500ms</div>
          <div className="text-green-500">[OK] 402 Challenge issued to autonomous agent</div>
        </div>
      </section>
    </div>
  );
}
