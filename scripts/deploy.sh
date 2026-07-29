#!/usr/bin/env bash
# Aegis402 Cloud Deploy Script
# Usage: ./scripts/deploy.sh [--network testnet|mainnet] [--upstream URL] [--pay-to ADDRESS] [--cdp-key-id KEY] [--cdp-key-secret SECRET] [--detach]
set -euo pipefail

NETWORK="${NETWORK:-testnet}"
UPSTREAM="${UPSTREAM:-http://api:8080}"
PAY_TO="${PAY_TO:-}"
CDP_KEY_ID="${CDP_KEY_ID:-}"
CDP_KEY_SECRET="${CDP_KEY_SECRET:-}"
DETACH="${DETACH:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --network) NETWORK="$2"; shift 2 ;;
    --upstream) UPSTREAM="$2"; shift 2 ;;
    --pay-to) PAY_TO="$2"; shift 2 ;;
    --cdp-key-id) CDP_KEY_ID="$2"; shift 2 ;;
    --cdp-key-secret) CDP_KEY_SECRET="$2"; shift 2 ;;
    --detach) DETACH="-d"; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "==> Aegis402 Deploy"

if [ "$NETWORK" = "mainnet" ]; then
  NETWORK_ID="eip155:8453"
  echo "  Target: Base Mainnet (real USDC)"
elif [ "$NETWORK" = "testnet" ]; then
  NETWORK_ID="eip155:84532"
  echo "  Target: Base Sepolia testnet"
else
  echo "  Unknown network '$NETWORK'. Use testnet or mainnet."
  exit 1
fi

echo "==> Generating .env"
cat > .env <<EOF
UPSTREAM_URL=$UPSTREAM
PORT=3000
HOST=0.0.0.0
PRICE=0.05
NETWORK=$NETWORK_ID
ASSET=USDC
PAY_TO=$PAY_TO
CDP_API_KEY_ID=$CDP_KEY_ID
CDP_API_KEY_SECRET=$CDP_KEY_SECRET
NODE_ENV=production
LOG_JSON=true
EOF

echo "==> Starting services"
docker compose up --build $DETACH

echo "==> Checking health"
sleep 3
curl -s http://localhost:3000/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/health
