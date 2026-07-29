import type { FastifyRequest, FastifyReply } from 'fastify';
import { createChallenge } from './x402.js';

export const handle402Challenge = (request: FastifyRequest, reply: FastifyReply) => {
  const challenge = createChallenge();

  return reply.status(402)
    .headers(challenge.headers)
    .send({ error: 'Payment Required' });
};

export const checkPaymentHeader = (request: FastifyRequest): string | null => {
  const paymentHeader = request.headers['x-payment'] || request.headers['payment-signature'];
  if (typeof paymentHeader === 'string' && paymentHeader.length > 0) {
    return paymentHeader;
  }
  return null;
};
