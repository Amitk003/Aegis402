import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';
import http from 'http';
import https from 'https';
import { handle402Challenge, checkPaymentHeader } from './interceptor.js';
import { connectStore } from './store.js';
import { checkReachability } from './reachability.js';
import { initCdp, processPayment } from './cdp.js';
import { createReceipt } from './x402.js';

const fastify = Fastify({ logger: true });

const UPSTREAM = process.env.UPSTREAM_URL || 'http://localhost:8080';

async function proxyToUpstream(request: FastifyRequest, reply: FastifyReply, txHash: string) {
  const urlObj = new URL(request.url, UPSTREAM);
  const isHttps = urlObj.protocol === 'https:';
  const client = isHttps ? https : http;

  const upstreamHeaders: Record<string, string> = {};
  if (request.headers) {
    for (const [key, value] of Object.entries(request.headers)) {
      if (key !== 'host' && key !== 'content-length' && typeof value === 'string') {
        upstreamHeaders[key] = value;
      }
    }
  }

  return new Promise<void>((resolve) => {
    const proxyReq = client.request(
      urlObj,
      { method: request.method, headers: upstreamHeaders, timeout: 10000 },
      (proxyRes) => {
        const statusCode = proxyRes.statusCode || 500;
        const initHeaders: Record<string, string | string[]> = {};
        if (proxyRes.headers) {
          for (const [key, value] of Object.entries(proxyRes.headers)) {
            if (value !== undefined) {
              initHeaders[key] = value;
            }
          }
        }

        // Attack III: Web-Layer Handling mitigation
        // Strip any upstream cache headers and enforce strict privacy
        initHeaders['cache-control'] = 'private, no-cache, no-store, must-revalidate';
        initHeaders['pragma'] = 'no-cache';
        initHeaders['expires'] = '0';
        // Add Vary header to prevent CDN caching by URL alone
        initHeaders['vary'] = 'x-payment, authorization';
        // Remove ETag and Last-Modified to prevent conditional requests bypassing payment
        delete initHeaders['etag'];
        delete initHeaders['last-modified'];

        // Inject payment receipt
        const receipt = createReceipt(txHash);
        initHeaders['payment-response'] = receipt.headers['payment-response'] || '';

        reply.raw.writeHead(statusCode, initHeaders);
        proxyRes.pipe(reply.raw);
        proxyRes.on('end', () => resolve());
      }
    );

    proxyReq.on('error', (err) => {
      fastify.log.error(err, 'Upstream request failed');
      reply.status(502).send({ error: 'Bad Gateway: Upstream request failed.' });
      resolve();
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!reply.sent) {
        reply.status(504).send({ error: 'Gateway Timeout: Upstream did not respond in time.' });
      }
      resolve();
    });

    if (request.body) {
      const bodyStr = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
      proxyReq.write(bodyStr);
    }
    proxyReq.end();
  });
}

fastify.all('/*', async (request: FastifyRequest, reply: FastifyReply) => {
  const paymentHeader = checkPaymentHeader(request);

  if (!paymentHeader) {
    handle402Challenge(request, reply);
    return;
  }

  // Pre-flight reachability check before processing payment
  const isReachable = await checkReachability(UPSTREAM);
  if (!isReachable) {
    return reply.status(502).send({ error: 'Bad Gateway: Upstream target is unreachable. Payment aborted.' });
  }

  // Process the x402 payment with security mitigations
  const result = await processPayment(paymentHeader, UPSTREAM);
  if (!result.success) {
    return reply.status(402).send({
      error: 'Payment rejected',
      detail: result.error
    });
  }

  // Forward to upstream with the tx hash
  await proxyToUpstream(request, reply, result.txHash || '');
});

const start = async () => {
  await connectStore();
  await initCdp();
  try {
    await fastify.listen({ port: Number(process.env.PORT) || 3000, host: process.env.HOST || '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
