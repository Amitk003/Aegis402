# Aegis402 - Pitch Deck

## Slide 1: Title

Aegis402
The Verification-Native Agentic Firewall
Secure pay-per-call infrastructure for the AI economy

---

## Slide 2: The Problem

AI agents consume thousands of API calls per day.

Current monetization models fail:
- Subscriptions overcharge or undercharge for unpredictable agent usage
- API keys get stolen and shared
- x402 protocol has zero-day vulnerabilities (arXiv:2605.11781)
  - Replay attacks: one payment used hundreds of times
  - Cache leakage: paid content served for free via CDNs
  - Front-running: payment signatures stolen and resubmitted
  - Settlement preemption: legitimate payments blocked by attackers
  - Sybil endpoints: agents directed to fake services

---

## Slide 3: Our Solution

Aegis402 is a plug-and-play proxy that adds secure x402 payment gating to any API.

- **Sits in front of your existing API** - no code changes needed
- **Blocks all 5 known x402 attacks** - replay, cache leak, front-running, preemption, sybil
- **Per-tool MCP pricing** - different prices for different AI agent tools
- **Automatic payment splitting** - 0.5% fee, rest goes to you

Deploy in 60 seconds: `docker compose up`

---

## Slide 4: Architecture

```
AI Agent -> Aegis402 Proxy -> Your API / MCP Server
               |
          (402 Payment Challenge)
               |
          CDP Facilitator -> Blockchain (Base)
               |
          AegisSplitter Contract
          - Merchant: 99.5%
          - Aegis402: 0.5%
```

Components:
- Fastify reverse proxy with custom HTTP request forwarding
- x402 v2 protocol module (challenge, parse, receipt)
- CDP Hosted Facilitator integration for gasless settlement
- 5 security mitigation modules (finality, binding, nonce, cache, registry)
- In-memory stats tracker with real-time dashboard
- MCP bridge for per-tool AI agent pricing

---

## Slide 5: Market & Business Model

**Target customers:** SaaS companies, DeSci data providers, AI model developers
**Problem they have:** No way to charge AI agents per-call without security risks

**Revenue model:**
- You set your price per API call (e.g. $0.05)
- Aegis402 takes 0.5% from each settled transaction
- No setup fees, no monthly minimums
- Aligned incentives: more traffic = more revenue for everyone

**Market size:** As AI agents grow from millions to billions of daily calls, the need for secure payment infrastructure grows with it. Every API that wants to monetize agent traffic needs an x402 gateway.

---

## Slide 6: Demo

1. AI agent calls `fetch_premium_data` through Aegis402
2. Gets 402 Payment Required - $0.01 USDC for this tool
3. Agent auto-signs payment via CDP server wallet
4. Aegis402 verifies, runs security checks, forwards to MCP server
5. Agent receives premium data
6. Dashboard shows live stats: requests, revenue, attacks blocked

Zero human interaction. Zero code changes. Real USDC on Base.

---

## Slide 7: Technical Differentiators

| Feature | Standard x402 | Aegis402 |
|---------|--------------|----------|
| Replay protection | None | Nonce-based locking (in-memory or Redis) |
| Cache security | None | Forceful no-store headers on all responses |
| Front-running protection | None | EIP-712 caller binding enforcement |
| Finality guarantees | None | Configurable k-confirmation polling |
| Endpoint verification | None | Signed attestation registry |
| MCP per-tool pricing | None | JSON config per tool |
| Dashboard analytics | None | Real-time stats and request log |
| Payment splitting | None | On-chain splitter contract (0.5% fee) |

---

## Slide 8: Get Started

```bash
git clone https://github.com/Amitk003/Aegis402.git
cd Aegis402
cp .env.example .env
# Set your UPSTREAM_URL, PAY_TO, CDP_API_KEY_ID, CDP_API_KEY_SECRET
docker compose up -d
```

- Dashboard: http://localhost:3001
- API Health: http://localhost:3000/health
- Stats: http://localhost:3000/stats

Docs: [docs/](docs/)
GitHub: https://github.com/Amitk003/Aegis402
