# Security Mitigations

Aegis402 blocks 5 known attacks on the x402 protocol. This document explains each attack and how Aegis402 prevents it.

## Attack I-A: Revert-Grant

**What happens:** The server sends data as soon as the transaction appears in the mempool. The blockchain reorganizes or the transaction gets dropped. The client got data for free.

**How we prevent it:** `src/finality.ts` implements configurable k-confirmation thresholds. Low-value payments (under $0.10 by default) are accepted immediately. High-value payments wait for the blockchain to confirm the transaction N times before forwarding the response. You can set `FINALITY_CONFIRMATIONS` to 0 (no waiting) up to whatever number you want.

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `FINALITY_CONFIRMATIONS` | 2 | Block confirmations needed for high-value payments |
| `FINALITY_HIGH_VALUE_THRESHOLD` | 0.10 | Minimum payment amount in USDC to wait for confirmations |
| `FINALITY_POLL_TIMEOUT` | 30000 | How long to wait for confirmations before giving up |
| `RPC_URL` | auto | Blockchain RPC URL (auto-detected from network) |

## Attack I-B: Settlement Preemption

**What happens:** Someone intercepts the signed payment payload from the network and submits it to the blockchain themselves. The legitimate facilitator's transaction fails because the nonce is consumed. The merchant gets paid but the client doesn't get their data.

**How we prevent it:** `src/binding.ts` checks that the payment payload restricts who can submit it (caller binding). If the payload does not specify a caller, the transaction is rejected. If it specifies a caller that doesn't match the Aegis402 facilitator, it is also rejected.

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `FACILITATOR_ADDRESS` | empty | The wallet address of the Aegis402 facilitator. Payments must be bound to this address. |

Without FACILITATOR_ADDRESS set, the check logs a warning but allows the payment. Set it to enforce caller binding.

## Attack II: Replay and Idempotency

**What happens:** An attacker copies a valid signed payment and submits it in multiple parallel HTTP requests. The server processes each request and releases the resource multiple times before the blockchain rejects the duplicate settlements.

**How we prevent it:** `src/store.ts` uses atomic locks keyed to the payment nonce. The first request acquires the lock. All subsequent requests with the same nonce get rejected with HTTP 409 Conflict. After the payment settles, the nonce is marked as settled and cannot be reused even after the lock expires.

This works with both Redis (distributed) and an in-memory Map for development.

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | none | Set to enable Redis. Without it, uses in-memory storage |

In-memory storage means locks are lost if the proxy restarts. Use Redis for production.

## Attack III: Web-Layer Handling (Cache Leakage)

**What happens:** After a successful payment, the 200 OK response gets cached by a CDN or proxy cache. Other users request the same URL and receive the cached response without paying.

**How we prevent it:** `src/index.ts` intercepts every outgoing response and:

1. Strips all upstream cache headers
2. Sets `Cache-Control: private, no-cache, no-store, must-revalidate`
3. Sets `Pragma: no-cache`
4. Sets `Expires: 0`
5. Removes `ETag` and `Last-Modified`
6. Adds `Vary: x-payment, authorization`

This ensures no intermediary can cache the response and serve it without payment.

## Attack IV: Server-Selection Sybils

**What happens:** Attackers create fake endpoint listings in agent discovery directories. AI agents get tricked into sending payments to malicious endpoints.

**How we prevent it:** `src/registry.ts` maintains a registry of verified endpoints. Each endpoint has a cryptographic attestation proving its identity. In strict mode (`REGISTRY_STRICT=true`), only registered endpoints can be proxied.

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REGISTRY_STRICT` | false | When true, only registered endpoints are allowed |

### Registering an endpoint

Endpoints can be registered via API or CLI. See the registry module source for details.

## Summary

| Attack | File | What it does |
|--------|------|-------------|
| I-A: Revert-Grant | `src/finality.ts` | Waits for block confirmations |
| I-B: Preemption | `src/binding.ts` | Enforces caller binding |
| II: Replay | `src/store.ts` | Atomic nonce locks |
| III: Cache | `src/index.ts` | Strips cache headers |
| IV: Sybil | `src/registry.ts` | Endpoint verification |
