# Aegis402 Demo Script

## Setup (before recording)

### Terminal 1: MCP Test Server
```bash
npm run demo:mcp
```
Expected output: "MCP demo server running on http://localhost:8080"

### Terminal 2: Aegis402 Proxy
```bash
npm start
```
Expected output: "Server listening on http://0.0.0.0:3000"

### Terminal 3: Dashboard (optional for visual)
```bash
cd dashboard && npm run dev
```
Expected output: "Local: http://localhost:3001"

---

## Demo Flow (record in this order)

### 1. Intro (10 seconds)

Show the terminal with `docker compose up -d` deploying Aegis402.
Show `curl http://localhost:3000/health` returning status OK.

### 2. Call without payment (15 seconds)

```
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"fetch_premium_data","arguments":{"symbol":"BTC-USD"}},"id":1}'
```

Show the 402 response with PAYMENT-REQUIRED header and tool-specific price ($0.01 for search_web, or $0.05 default). Point out the cache-control headers.

### 3. Call with payment (20 seconds)

```
npm run demo:client
```

Show the demo output:
1. Step 1: 402 Payment Required received
2. Step 2: Payment signed and retried
3. Step 3: Tool result received with premium data
4. Step 4: Per-tool pricing demonstration

### 4. Dashboard (15 seconds)

Open http://localhost:3001 in browser.
Show the live stats updating: total requests, USDC settled, attacks blocked.
Point out the live request log showing each step of the demo.

### 5. Security demonstration (20 seconds)

Show replay protection:
- Send the same X-PAYMENT header twice
- First succeeds, second gets 409 Conflict

```
# Extract payment header from first call
PAYLOAD=$(curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_web","arguments":{"query":"test"}},"id":1}' \
  -w '%{header_map}' | ...)

# First call - succeeds
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "X-Payment: $PAYLOAD" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_web","arguments":{"query":"test"}},"id":1}'

# Second call with same payment - blocked (409 or 402)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "X-Payment: $PAYLOAD" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_web","arguments":{"query":"test"}},"id":1}'
```

### 6. Close (10 seconds)

Show summary:
- "Aegis402 adds secure payment gating to any API"
- "Blocks all 5 known x402 attacks"
- "Deploy in 60 seconds with Docker"
- "Real USDC revenue in your wallet"

---

## Key talking points (voiceover)

1. "AI agents are consuming APIs at machine scale. Subscriptions don't work for this."
2. "x402 lets agents pay per-call, but it has security flaws. Aegis402 fixes them."
3. "Sit it in front of any API. No code changes. No Web3 complexity."
4. "Per-tool pricing for MCP servers. Each AI tool can have its own price."
5. "Dashboard shows live revenue and security metrics."
6. "We take 0.5%. You keep the rest. Aligned incentives."
