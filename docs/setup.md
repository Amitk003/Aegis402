# Setup Guide

## What you need before starting

- Node.js version 18 or higher (or Docker)
- A Coinbase Developer Platform (CDP) account (free, optional for development)
- Redis (optional - the proxy works with in-memory storage for development)

## Quick Start with Docker

```bash
cp .env.example .env
# Edit .env with your upstream URL
docker compose up -d
```

The proxy starts on port 3000. Test it:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/data
```

## Quick Start without Docker

### Step 1: Install dependencies

```bash
npm install
```

### Step 2: Set up environment variables

Copy the example file and edit it:

```bash
cp .env.example .env
```

Key variables to set:

| Variable | What it does | Example |
|----------|-------------|---------|
| `UPSTREAM_URL` | Your API that Aegis402 will protect | `http://localhost:8080` |
| `PAY_TO` | Your wallet for receiving payments | `0xYourWalletAddress` |
| `CDP_API_KEY_ID` | From CDP portal (optional for dev) | |
| `NETWORK` | Blockchain to use | `eip155:84532` (Base Sepolia) or `eip155:8453` (Base mainnet) |
| `PRICE` | Cost per API call in USDC | `0.05` |

### Step 3: Start the proxy

```bash
npm start
```

### Step 4: Test it

Test without a payment header:

```bash
curl http://localhost:3000/api/data
```

You get a 402 response with a PAYMENT-REQUIRED header.

Test the health endpoint:

```bash
curl http://localhost:3000/health
```

## Environment Variables

See `.env.example` for the full list of configuration options.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port the proxy listens on |
| `HOST` | `0.0.0.0` | Network interface to bind to |
| `LOG_LEVEL` | `info` | Log level: error, warn, info, debug |
| `RATE_LIMIT_RPM` | `60` | Max requests per minute per IP |
| `RATE_LIMIT_SPEND` | `10` | Max USDC spend per hour per wallet |
| `FINALITY_CONFIRMATIONS` | `2` | Block confirmations for high-value payments |
| `REGISTRY_STRICT` | `false` | When true, only registered endpoints are allowed |

## Troubleshooting

**Proxy won't start:**
- Make sure port 3000 is not in use
- Run `npm install` if dependencies are missing
- Check that `UPSTREAM_URL` is reachable

**Redis connection error:**
- The proxy falls back to in-memory storage if Redis is not available
- In-memory data is lost when the proxy restarts. Use Redis for production.

**Payment always fails in development:**
- The proxy runs in development mode if CDP credentials are not set
- Development mode simulates payments - no real blockchain transactions
- To test with real payments, set CDP_API_KEY_ID and CDP_API_KEY_SECRET
