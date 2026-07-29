import type { FastifyRequest, FastifyReply } from 'fastify';

const CONFIG = {
  price: '0.05',
  network: 'eip155:8453',
  asset: 'USDC',
  payTo: '0x1234567890123456789012345678901234567890' // Dummy merchant address
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
    .header('PAYMENT-REQUIRED', base64Challenge)
    .header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
    .send({ error: 'Payment Required', challenge: challengePayload });
};

export const checkPaymentHeader = (request: FastifyRequest): string | null => {
  const paymentHeader = request.headers['x-payment'] || request.headers['payment-signature'];

  if (typeof paymentHeader === 'string') {
    return paymentHeader;
  }
  return null;
};
