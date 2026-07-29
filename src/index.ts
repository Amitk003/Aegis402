import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';
import http from 'http';
import https from 'https';
import { handle402Challenge, checkPaymentHeader } from './interceptor.js';
import { connectStore } from './store.js';
import { checkReachability } from './reachability.js';
import { initCdp, processPayment, hasCdpCredentials, isProductionMode } from './cdp.js';
import { createReceipt } from './x402.js';
import { checkRateLimit, trackSpend } from './ratelimit.js';
import { loadMcpConfig, isMcpRequest, getToolName, createMcpChallenge } from './mcp.js';
import { recordRequest, getStats } from './stats.js';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
// Set LOG_JSON=true or NODE_ENV=production for structured JSON logging (SIEM-friendly)
const fastify = Fastify({ logger: { level: LOG_LEVEL } });

const UPSTREAM = process.env.UPSTREAM_URL || 'http://localhost:8080';

// Health check endpoint (not payment-gated)
fastify.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
  const upstreamReachable = await checkReachability(UPSTREAM, 2000);
  reply.send({
    status: 'ok',
    version: '1.0.0',
    upstream: UPSTREAM,
    upstreamReachable,
    cdpMode: isProductionMode() ? 'production' : 'development',
    cdpConfigured: hasCdpCredentials()
  });
});

// Stats endpoint for dashboard analytics (not payment-gated)
fastify.get('/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
  reply.send(getStats());
});

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
        initHeaders['cache-control'] = 'private, no-cache, no-store, must-revalidate';
        initHeaders['pragma'] = 'no-cache';
        initHeaders['expires'] = '0';
        initHeaders['vary'] = 'x-payment, authorization';
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
      if (!reply.sent) {
        reply.status(502).send({ error: 'Bad Gateway: Upstream request failed.' });
      }
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
  // Rate limiting by IP
  const clientIp = request.ip;
  const rateCheck = checkRateLimit(clientIp);
  if (!rateCheck.allowed) {
    recordRequest({ timestamp: Date.now(), method: request.method, path: request.url, status: 'rate_limited' });
    reply.header('retry-after', String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)));
    return reply.status(429).send({ error: 'Too Many Requests', detail: rateCheck.reason });
  }

  const paymentHeader = checkPaymentHeader(request);

  if (!paymentHeader) {
    // Check if this is an MCP tool call for tool-specific pricing
    if (isMcpRequest(request)) {
      const toolName = getToolName(request);
      if (toolName) {
        const mcpChallenge = createMcpChallenge(toolName);
        const price = mcpChallenge.body.accepts[0]?.amount || '0.05';
        recordRequest({ timestamp: Date.now(), method: request.method, path: request.url, status: 'challenged', amount: price });
        return reply.status(402)
          .headers(mcpChallenge.headers)
          .send({ error: 'Payment Required', tool: toolName, price });
      }
    }
    recordRequest({ timestamp: Date.now(), method: request.method, path: request.url, status: 'challenged' });
    handle402Challenge(request, reply);
    return;
  }

  // Pre-flight reachability check
  const isReachable = await checkReachability(UPSTREAM);
  if (!isReachable) {
    return reply.status(502).send({ error: 'Bad Gateway: Upstream target is unreachable. Payment aborted.' });
  }

  // Process the x402 payment with security mitigations
  const paymentResult = await processPayment(paymentHeader, UPSTREAM);
  if (!paymentResult.success) {
    recordRequest({ timestamp: Date.now(), method: request.method, path: request.url, status: 'rejected', detail: paymentResult.error });
    return reply.status(402).send({
      error: 'Payment rejected',
      detail: paymentResult.error
    });
  }

  // Track spend for rate limiting
  try {
    const decoded = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
    const walletAddress = decoded.payload?.signer || decoded.signer || clientIp;
    const amount = decoded.accepted?.amount || '0.05';
    trackSpend(walletAddress, amount);
    recordRequest({ timestamp: Date.now(), method: request.method, path: request.url, status: 'paid', wallet: walletAddress, amount });
  } catch {
    recordRequest({ timestamp: Date.now(), method: request.method, path: request.url, status: 'paid' });
  }

  // Forward to upstream
  await proxyToUpstream(request, reply, paymentResult.txHash || '');
});

const start = async () => {
  await connectStore();
  await initCdp();
  loadMcpConfig();
  try {
    await fastify.listen({ port: Number(process.env.PORT) || 3000, host: process.env.HOST || '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
