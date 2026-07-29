import type { FastifyRequest, FastifyReply } from 'fastify';

const CONFIG = {
  price: process.env.PRICE || '0.05',
  network: process.env.NETWORK || 'eip155:84532',
  asset: process.env.ASSET || 'USDC',
  payTo: process.env.PAY_TO || '0x1234567890123456789012345678901234567890'
};

export const handle402Challenge = (request: FastifyRequest, reply: FastifyReply) => {
  const challengePayload = {
    maxAmountRequired: CONFIG.price,
    network: CONFIG.network,
    asset: CONFIG.asset,
    payTo: CONFIG.payTo
  };

  const base64Challenge = Buffer.from(JSON.stringify(challengePayload)).toString('base64');

  return reply.status(402)
    .header('payment-required', base64Challenge)
    .header('cache-control', 'private, no-cache, no-store, must-revalidate')
    .send({ error: 'Payment Required' });
};

export const checkPaymentHeader = (request: FastifyRequest): string | null => {
  const paymentHeader = request.headers['x-payment'] || request.headers['payment-signature'];

  if (typeof paymentHeader === 'string') {
    return paymentHeader;
  }
  return null;
};

export const extractNonce = (paymentHeader: string): string => {
  try {
    const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8');
    const payload = JSON.parse(decoded);
    if (payload.nonce && typeof payload.nonce === 'string') {
      return payload.nonce;
    }
  } catch {
    // Not base64 JSON, try using the header as-is
  }
  // Fallback: hash the header to create a deterministic nonce
  let hash = 0;
  for (let i = 0; i < paymentHeader.length; i++) {
    const char = paymentHeader.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
};
