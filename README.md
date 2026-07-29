# Aegis402

API proxy that adds x402 payment gating to any HTTP endpoint with built-in security mitigations.

## Quick Start

```bash
git clone https://github.com/Amitk003/Aegis402.git
cd Aegis402
cp .env.example .env
# Edit .env with your upstream URL and payment address
docker compose up -d
```

Proxy starts on port 3000. Check: `curl http://localhost:3000/health`

No Docker: `npm install && npm start`

## How It Works

Aegis402 sits between AI agents and your API. Every incoming request is checked for an x402 payment. If no payment is present, the proxy returns HTTP 402 with a payment challenge. The agent signs a USDC payment and retries. Aegis402 verifies the payment, runs security checks, and forwards the request to your upstream API.

```
AI Agent -> Aegis402 -> Your API
               |
          (402 if no payment)
```

## Security Mitigations

All five attacks from arXiv:2605.11781 are blocked at the proxy layer:

| Attack | Mitigation |
|--------|-----------|
| Revert-Grant (I-A) | Configurable k-confirmation polling before releasing data |
| Settlement Preemption (I-B) | EIP-712 caller binding enforcement |
| Replay / Idempotency (II) | Nonce-based locking with in-memory or Redis store |
| Cache Leakage (III) | Forceful cache-control header injection |
| Sybil Discovery (IV) | Endpoint attestation registry with strict mode |

## Payment Flow

1. Client requests resource - no payment header
2. Aegis402 returns 402 with PAYMENT-REQUIRED header (price, network, asset, payee)
3. Client signs EIP-3009 TransferWithAuthorization and retries with X-PAYMENT header
4. Aegis402 verifies the signature, checks mitigations, forwards to facilitator for settlement
5. Upstream response is returned with PAYMENT-RESPONSE receipt header

## Configuration

Key environment variables in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `UPSTREAM_URL` | `http://localhost:8080` | Your backend API |
| `PRICE` | `0.05` | Default USDC price per request |
| `NETWORK` | `eip155:84532` | Blockchain (use `eip155:8453` for Base Mainnet) |
| `PAY_TO` | - | Your wallet address for payment collection |
| `SPLITTER_ADDRESS` | - | Smart contract address for automatic 0.5% fee split |

Full reference: [docs/configuration.md](docs/configuration.md)

## MCP Integration

Aegis402 can add per-tool payment gating to any MCP server. Configure tool-specific prices in `pricing.json`:

```json
{
  "tools": {
    "search_web": { "price": "0.01" },
    "generate_image": { "price": "0.25" }
  }
}
```

See [docs/mcp.md](docs/mcp.md) for details.

## Project Structure

```
src/           - Proxy source (13 modules)
tests/         - Unit tests (89 across 10 files) + MCP demo server
contracts/     - AegisSplitter.sol payment splitting contract
docs/          - Setup, architecture, configuration, security, MCP
scripts/       - Deploy scripts (PowerShell + Bash)
```

## Business Model

Aegis402 takes 0.5% from each settled payment. The rest goes to your wallet. No setup fees, no monthly minimums.
