# Configuration Reference

## Environment Variables

Aegis402 is configured through environment variables. You can set them in a `.env` file or pass them directly to the process.

### Required Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `UPSTREAM_URL` | `http://localhost:8080` | The URL of your backend API that Aegis402 will protect |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | What port the proxy listens on |
| `HOST` | `0.0.0.0` | What network interface to bind to |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string. If not available, falls back to in-memory storage |
| `PRICE` | `0.05` | Default price per API call in USDC |
| `NETWORK` | `eip155:84532` | Blockchain network reference (CAIP-2 format). Set to `eip155:8453` for Base Mainnet |
| `ASSET` | `USDC` | Which stablecoin to accept |
| `PAY_TO` | - | Your wallet address where payments are sent |
| `CDP_API_KEY_ID` | - | Coinbase Developer Platform API key ID |
| `CDP_API_KEY_SECRET` | - | Coinbase Developer Platform API secret |
| `LOG_LEVEL` | `info` | Logging verbosity: `error`, `warn`, `info`, `debug` |
| `LOG_JSON` | `false` | When `true`, outputs structured JSON logs for SIEM integration. Auto-enabled in production |
| `MCP_CONFIG_PATH` | `pricing.json` | Path to per-tool MCP pricing configuration |
| `FACILITATOR_ADDRESS` | - | Wallet address for caller binding enforcement |
| `SPLITTER_ADDRESS` | - | AegisSplitter contract for automatic payment splitting |
| `FINALITY_CONFIRMATIONS` | `2` | Block confirmations needed for high-value payments |
| `FINALITY_HIGH_VALUE_THRESHOLD` | `0.10` | Payments above this USDC amount get extra finality checks |
| `FINALITY_POLL_TIMEOUT` | `30000` | Max ms to wait for on-chain finality before fallback |
| `RATE_LIMIT_RPM` | `60` | Max requests per minute per IP |
| `RATE_LIMIT_SPEND` | `10` | Max USDC spend per hour per wallet |
| `REGISTRY_STRICT` | `false` | When true, only registered endpoints are allowed |
| `NODE_ENV` | `development` | Set to `production` for stricter validation |

### Price per Endpoint

You can set different prices for different API paths. Create a JSON file called `pricing.json` in the project root:

```json
{
  "/api/data": 0.05,
  "/api/analyze": 0.25,
  "/api/export": 1.00,
  "/api/health": 0
}
```

Paths without a matching entry use the default PRICE. A price of 0 means the endpoint is free (no payment required).

### Network Identifiers

The CAIP-2 format is used to identify blockchains:

| Network | Identifier |
|---------|-----------|
| Base Mainnet | `eip155:8453` |
| Base Sepolia (testnet) | `eip155:84532` |
| Solana Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| Solana Devnet | `solana:EtWTRABZaXqjLkPxpbJvHm4EHMVkHnM7eM` |

## Pricing Model

### Merchant Revenue
When a payment is settled on-chain, the smart contract automatically splits the amount:
- The full price you set goes to your wallet (minus network gas fees)
- A small infrastructure fee (0.5%) goes to the Aegis402 treasury

Example: You set a price of $0.10 per API call. An agent pays $0.10. You receive $0.0995, Aegis402 receives $0.0005.

### No Setup Fees
You can deploy Aegis402 for free. There are no monthly charges or upfront costs. You only pay the infrastructure fee when you actually earn revenue.

## Logging

Logs are printed to stdout in plain text format by default. Each log entry shows:
- Timestamp
- Log level (info, warn, error, debug)
- Request method and URL
- Payment status (paid, pending, rejected)
- Processing time in milliseconds

Example log output:
```
2026-07-29T10:15:30.123Z [INFO] GET /api/data - Payment received, forwarding to upstream
2026-07-29T10:15:30.456Z [INFO] GET /api/data - Response sent, tx: 0x8a9b...
2026-07-29T10:15:31.789Z [WARN] POST /api/write - Rejected: nonce already used
```
