import Fastify from 'fastify';
import proxy from '@fastify/http-proxy';
import { handle402Challenge, checkPaymentHeader } from './interceptor.js';
import { connectRedis, acquireLock } from './redis.js';
import { checkReachability } from './reachability.js';

const fastify = Fastify({
  logger: true
});

const UPSTREAM = process.env.UPSTREAM_URL || 'http://localhost:8080';

// Register the proxy plugin.
// We intercept the request in the preHandler hook to check for the x402 payment header.
fastify.register(proxy, {
  upstream: UPSTREAM,
  preHandler: async (request, reply) => {
    const paymentHeader = checkPaymentHeader(request);

    if (!paymentHeader) {
      // If no payment header is provided, return a 402 challenge and halt the proxy request.
      handle402Challenge(request, reply);
      return;
    }

    // Attack II: Replay and Idempotency mitigation
    // We assume the paymentHeader contains a JSON with a nonce for simplicity in this implementation.
    // In a real scenario, this would be a decoded EIP-712 payload.
    let nonce = paymentHeader; // fallback
    try {
      const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8');
      const payload = JSON.parse(decoded);
      if (payload.nonce) nonce = payload.nonce;
    } catch(e) {
      // Not JSON/base64, use raw header as nonce
    }

    const locked = await acquireLock(nonce);
    if (!locked) {
      return reply.status(409).send({ error: 'Conflict: Idempotency lock active for this nonce.' });
    }

    // Pre-flight Reachability check
    const isReachable = await checkReachability(UPSTREAM);
    if (!isReachable) {
      return reply.status(502).send({ error: 'Bad Gateway: Upstream target is unreachable. Payment settlement aborted.' });
    }

    // Pass the request to proxy
  },
  replyOptions: {
    onResponse: (request, reply, res) => {
      // Attack III: Web-Layer Handling mitigation
      reply.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');

      // Inject transaction receipt
      const mockTxHash = '0x' + Math.random().toString(16).slice(2) + '...';
      const paymentResponsePayload = { txHash: mockTxHash, status: 'settled' };
      const base64Response = Buffer.from(JSON.stringify(paymentResponsePayload)).toString('base64');

      reply.header('PAYMENT-RESPONSE', base64Response);
      reply.send(res);
    }
  }
});

const start = async () => {
  await connectRedis();
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();