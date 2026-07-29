import Fastify from 'fastify';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import { handle402Challenge, checkPaymentHeader, extractNonce } from './interceptor.js';
import { connectStore, acquireLock, LockStore } from './store.js';
import { checkReachability } from './reachability.js';

const fastify = Fastify({ logger: true });

const UPSTREAM = process.env.UPSTREAM_URL || 'http://localhost:8080';

async function proxyToUpstream(request, reply) {
  const upstreamUrl = new URL(request.url, UPSTREAM);
  const isHttps = upstreamUrl.protocol === 'https:';
  const client = isHttps ? https : http;

  const upstreamHeaders = { ...request.headers };
  delete upstreamHeaders.host;
  delete upstreamHeaders['content-length'];

  return new Promise((resolve, reject) => {
    const proxyReq = client.request(
      upstreamUrl,
      {
        method: request.method,
        headers: upstreamHeaders,
      },
      (proxyRes) => {
        const statusCode = proxyRes.statusCode || 500;

        const responseHeaders = { ...proxyRes.headers };

        // Attack III: Web-Layer Handling mitigation
        responseHeaders['cache-control'] = 'private, no-cache, no-store, must-revalidate';

        // Inject transaction receipt
        const mockTxHash = '0x' + crypto.randomUUID().replace(/-/g, '');
        const paymentResponsePayload = { txHash: mockTxHash, status: 'settled' };
        const base64Response = Buffer.from(JSON.stringify(paymentResponsePayload)).toString('base64');
        responseHeaders['payment-response'] = base64Response;

        reply.raw.writeHead(statusCode, responseHeaders);

        proxyRes.pipe(reply.raw);
        proxyRes.on('end', () => resolve());
      }
    );

    proxyReq.on('error', (err) => {
      fastify.log.error(err, 'Proxy request failed');
      reply.status(502).send({ error: 'Bad Gateway: Upstream request failed.' });
      resolve();
    });

    proxyReq.setTimeout(10000, () => {
      proxyReq.destroy();
      reply.status(504).send({ error: 'Gateway Timeout: Upstream did not respond in time.' });
      resolve();
    });

    if (request.body) {
      proxyReq.write(request.body);
    }
    proxyReq.end();
  });
}

fastify.all('/*', async (request, reply) => {
  const paymentHeader = checkPaymentHeader(request);

  if (!paymentHeader) {
    handle402Challenge(request, reply);
    return;
  }

  // Attack II: Replay and Idempotency mitigation
  const nonce = extractNonce(paymentHeader);

  const locked = await acquireLock(nonce);
  if (!locked) {
    return reply.status(409).send({ error: 'Conflict: Idempotency lock active for this nonce.' });
  }

  // Pre-flight Reachability check
  const isReachable = await checkReachability(UPSTREAM);
  if (!isReachable) {
    return reply.status(502).send({ error: 'Bad Gateway: Upstream target is unreachable. Payment settlement aborted.' });
  }

  await proxyToUpstream(request, reply);
});

const start = async () => {
  await connectStore();
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
