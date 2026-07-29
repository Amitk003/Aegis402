# Aegis402: The Security Layer for AI Payments

## Monetize your API in 5 minutes. No subscriptions. No browser wallets. No code changes.

AI agents are consuming more and more of the web. Every day, thousands of automated systems scrape your data, call your APIs, and use your compute resources - often for free.

You could block them. Or you could charge them.

### The Old Way: Subscriptions

Monthly subscriptions don't work for AI agents. Agents call APIs unpredictably - sometimes 10 times a day, sometimes 100,000. A flat subscription either overcharges or undercharges. API keys get stolen. Usage limits get abused.

### The New Way: Pay-per-call with x402

x402 is a protocol that lets machines pay each other over standard HTTP. When an AI agent calls your API, it pays you in USDC for exactly that one request. No subscription. No manual approval. No chargebacks.

The payment happens automatically in the background. The agent doesn't need a browser wallet, a credit card, or a human to click "approve."

### The Problem: x402 Has Security Flaws

x402 is new. Researchers found 5 critical attacks that let attackers get data without paying, replay the same payment across multiple requests, or exploit caching layers to leak your paid content.

Standard x402 implementations are vulnerable out of the box.

### Aegis402 Fixes That

Aegis402 is a proxy that sits in front of your API and handles x402 payments securely. It blocks all 5 known attacks:

- **Replay protection:** Each payment can only be used once. Parallel requests with the same signature get rejected.
- **Cache security:** Your paid responses never leak through CDNs or proxy caches.
- **Front-running prevention:** Attackers cannot steal and re-submit payment signatures.
- **Safe settlement:** High-value payments wait for blockchain confirmation before delivering data.
- **Endpoint verification:** AI agents can verify they are paying the real you, not a fake copy.

### What You Get

- **Zero code changes on your end.** Aegis402 sits in front of your existing API. You don't touch your backend.
- **Zero Web3 complexity for your users.** AI agents pay via CDP server wallets. No browser extensions, no seed phrases, no gas fees.
- **Real USDC revenue.** Payments settle on Base or Solana. You get stablecoin revenue in your wallet instantly.
- **Usage-based pricing.** Set any price per API call. $0.001 for a simple lookup, $0.50 for a heavy computation.

### How It Works

1. You deploy Aegis402 in front of your API (Docker or bare metal)
2. You set your price per endpoint
3. AI agents call your API through Aegis402
4. Aegis402 handles the x402 payment flow automatically
5. You receive USDC in your wallet for every successful call

### Quick Start

**Using Docker (recommended):**

```bash
# Clone and deploy
git clone https://github.com/Amitk003/Aegis402.git
cd Aegis402
cp .env.example .env
# Edit .env with your settings
docker compose up -d
```

The proxy starts on port 3000. Check it: `curl http://localhost:3000/health`

**Without Docker:**

```bash
npm install
cp .env.example .env
npm start
```

See the [docs](docs/) folder for detailed setup instructions.

### Business Model

Aegis402 takes a small fee (0.5%) from each transaction. You keep the rest. No setup fees, no monthly minimums.

The more traffic your API handles, the more you earn. And the more we earn. Our incentives are aligned.

---

Aegis402 is the missing security layer for the agentic economy. Deploy it once and start getting paid for every API call, automatically.
