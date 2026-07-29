# Architecture Guide

## How Aegis402 Works

Aegis402 is a reverse proxy. It sits between the client (usually an AI agent) and your backend API. All requests pass through Aegis402 before reaching your server.

```
AI Agent  -->  Aegis402 Proxy  -->  Your API
                    |
               (checks payment)
```

## The x402 Payment Flow

Here is what happens step by step when an AI agent calls your API through Aegis402:

### Step 1: Client sends request

The AI agent sends a normal HTTP request to your API endpoint. The request goes through Aegis402 first.

### Step 2: Proxy checks for payment

Aegis402 looks for a payment signature in the request headers. If there is no signature, it sends back a 402 response with a PAYMENT-REQUIRED header. This header contains the price, the blockchain network, and your wallet address, all encoded in base64.

### Step 3: Client signs the payment

The AI agent reads the PAYMENT-REQUIRED header. It creates a cryptographic signature using EIP-3009 (a standard for token transfers). This signature says "I promise to pay X USDC." The agent does not need ETH or any gas token to create this signature.

### Step 4: Client retries with signature

The agent sends the same request again, but this time it adds the signed payment in the X-PAYMENT header.

### Step 5: Proxy verifies and settles

Aegis402 receives the signed payment. It checks:

- Is this signature valid? (cryptographic verification)
- Is this nonce already used? (prevents replay attacks)
- Is the caller allowed? (prevents front-running)

If everything checks out, the proxy sends the signature to a Payment Facilitator (managed by Coinbase CDP). The facilitator submits the transaction to the blockchain and pays the gas fee.

### Step 6: Proxy delivers the response

Once the blockchain confirms the payment, Aegis402 forwards the original request to your API. When your API responds, the proxy adds a PAYMENT-RESPONSE header with the on-chain transaction hash and sends everything back to the AI agent.

## Security Mitigations

Aegis402 blocks 5 known attacks on the x402 protocol:

### Replay Attack Prevention

Each payment signature has a unique 32-byte nonce. Aegis402 stores this nonce in Redis (or in memory for development). If a second request arrives with the same nonce, it gets rejected with a 409 Conflict response. This prevents an attacker from using the same signature across multiple parallel requests.

### Cache Leakage Prevention

Aegis402 removes all cache headers from the upstream response and replaces them with:

```
Cache-Control: private, no-cache, no-store, must-revalidate
```

This ensures that CDNs, proxy servers, and browsers never cache paid content. Every request must go through the payment check.

### Settlement Preemption Prevention

The payment signature is bound to a specific caller address (the Aegis402 facilitator). If an attacker tries to submit the signed payment to the blockchain directly, the transaction fails because the caller does not match. Only the Aegis402 facilitator can settle the payment.

### Revert-Grant Prevention

For high-value payments, Aegis402 waits for a configurable number of block confirmations before delivering the data. This prevents blockchain reorganizations from reversing the payment after the data is sent.

### Sybil Attack Prevention

Aegis402 verifies the identity of upstream endpoints using cryptographic attestations. AI agents can verify they are connecting to the real server and not a fake copy.

## Components

### Proxy Engine (src/index.ts)
The main entry point. Creates the HTTP server, registers routes, and wires everything together.

### Interceptor (src/interceptor.ts)
Handles the 402 challenge - creates the PAYMENT-REQUIRED payload and checks incoming payment headers.

### Idempotency Lock (src/redis.ts)
Manages nonce locking to prevent replay attacks. Uses Redis SET NX for atomic locking.

### Reachability Checker (src/reachability.ts)
Checks if the upstream API is alive before processing a payment. Prevents agents from paying for dead servers.

### MCP Bridge (src/mcp.ts)
Integrates with the Model Context Protocol to allow per-tool payment gating for AI agents.
