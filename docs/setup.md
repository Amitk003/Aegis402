# Setup Guide

## What you need before starting

- Node.js version 18 or higher
- A Coinbase Developer Platform (CDP) account (free)
- Redis (optional - the proxy works with in-memory storage for development)

## Step 1: Install dependencies

Open a terminal in the project folder and run:

```bash
npm install
```

This installs all required packages including Fastify, the CDP SDK, and the Redis client.

## Step 2: Set up environment variables

Create a file called `.env` in the project root folder:

```
UPSTREAM_URL=http://localhost:8080
REDIS_URL=redis://localhost:6379
CDP_API_KEY=your_cdp_api_key_here
CDP_API_SECRET=your_cdp_api_secret_here
NETWORK=eip155:84532
ASSET=USDC
PAY_TO=0xYourWalletAddressHere
PRICE=0.05
```

- `UPSTREAM_URL` - The API you want to put behind the payment wall
- `CDP_API_KEY` and `CDP_API_SECRET` - Get these from your CDP account
- `NETWORK` - Which blockchain to use (eip155:84532 is Base Sepolia testnet)
- `ASSET` - The stablecoin to accept (USDC)
- `PAY_TO` - Your wallet address that receives the payments
- `PRICE` - How much to charge per API call in USDC

## Step 3: Start the proxy

```bash
npm start
```

This starts the proxy on port 3000.

## Step 4: Test it

Open another terminal and test without a payment header:

```bash
curl http://localhost:3000/api/data
```

You should get a 402 response with a PAYMENT-REQUIRED header.

Now test with a payment signature:

```bash
curl -H "x-payment: <your_signed_payload>" http://localhost:3000/api/data
```

If the signature is valid, the proxy forwards your request to the upstream API and returns the response.

## Troubleshooting

**Proxy won't start:**
- Make sure port 3000 is not in use
- Check that all environment variables are set
- Run `npm install` again to make sure dependencies are installed

**Redis connection error:**
- The proxy falls back to in-memory storage if Redis is not available
- This is fine for development but data is lost when the proxy restarts

**Payment always fails:**
- Make sure you have testnet USDC in your CDP server wallet
- Check that the CDP API key and secret are correct
- Verify the network setting matches your CDP configuration

## Running for production

For production use:

1. Set up a proper Redis instance (not in-memory fallback)
2. Change the network to a mainnet (eip155:8453 for Base)
3. Use real USDC, not testnet
4. Set up monitoring and logging
