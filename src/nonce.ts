// Nonce extraction utility for x402 payment payloads

import crypto from 'node:crypto';
import type { PaymentPayload } from './x402.js';

/**
 * Extract the nonce from an x402 payment payload.
 * Tries known field names and falls back to hashing the payload.
 */
export function extractNonce(payment: PaymentPayload): string {
  const payload = payment.payload;

  // Try common nonce field names in order of preference
  const nonce = payload.nonce
    || payload.nonceV2
    || payload.authorizationId
    || (payload.authorization && typeof payload.authorization === 'object'
      ? (payload.authorization as Record<string, unknown>).nonce
      : undefined);

  if (typeof nonce === 'string' && nonce.length > 0) {
    return nonce;
  }

  // Try EIP-3009 specific fields
  const eip3009Fields = [payload.transferWithAuthorization, payload.receiveWithAuthorization];
  for (const field of eip3009Fields) {
    if (field && typeof field === 'object') {
      const f = field as Record<string, unknown>;
      const n = f.nonce || f.authorizationNonce || f.id;
      if (typeof n === 'string') return n;
    }
  }

  // Fallback: hash the payload to create a deterministic nonce
  return hashString(JSON.stringify(payment));
}

function hashString(data: string): string {
  return '0x' + crypto.createHash('sha256').update(data).digest('hex');
}
