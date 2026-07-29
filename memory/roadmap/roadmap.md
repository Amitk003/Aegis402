# Roadmap for Aegis402

This roadmap outlines the planned development and future features for the Aegis402 Agentic Firewall project.

## Phase 1: MVP Core (Current)
- Scaffolding of Fastify proxy and Next.js dashboard.
- Implementation of HTTP 402 challenge flow.
- Redis-based atomic locks for idempotency (Attack II mitigation).
- Basic Cache-Control sanitization (Attack III mitigation).
- Pre-flight reachability checks.

## Phase 2: CDP Integration & Settlement Engine
- Implement the actual @coinbase/cdp-sdk integration.
- Replace mock transaction hashes with real Base network settlement receipts.
- Implement EIP-712 domain binding for anti-preemption (Attack I-B mitigation).
- Add configurable k-confirmations WebSocket polling (Attack I-A mitigation).

## Phase 3: Ecosystem Expansion
- Fully integrate the `mcp.ts` wrapper with a live Model Context Protocol server.
- Build extensive dashboard analytics (real-time graphs, anomaly detection).
- Publish Docker images for plug-and-play enterprise deployment.
