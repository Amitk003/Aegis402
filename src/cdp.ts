import { parsePaymentHeader, randomTxHash } from './x402.js';
import { acquireLock } from './store.js';

let cdpMode: 'production' | 'development' = 'development';

let facilitatorClient: {
  verify(paymentPayload: unknown, requirements: unknown): Promise<{ isValid: boolean }>;
  settle(paymentPayload: unknown, requirements: unknown): Promise<{ success: boolean; transaction?: string }>;
} | null = null;

export function hasCdpCredentials(): boolean {
  return !!(process.env.CDP_API_KEY_ID || process.env.CDP_API_KEY);
}

export async function initCdp(): Promise<boolean> {
  if (!hasCdpCredentials()) {
    console.log('CDP: No credentials set. Using development mode (simulated payments).');
    cdpMode = 'development';
    return false;
  }

  try {
    const { createCdpFacilitatorClient } = await import('@coinbase/cdp-sdk/x402');
    const keyId = process.env.CDP_API_KEY_ID || process.env.CDP_API_KEY || '';
    const keySecret = process.env.CDP_API_KEY_SECRET || process.env.CDP_API_SECRET || '';
    facilitatorClient = createCdpFacilitatorClient({
      apiKeyId: keyId || undefined,
      apiKeySecret: keySecret || undefined
    } as any);
    cdpMode = 'production';
    console.log('CDP: Facilitator connected. Real payment processing enabled.');
    return true;
  } catch (err) {
    console.log('CDP: Facilitator initialization failed, using development mode:', (err as Error).message);
    cdpMode = 'development';
    return false;
  }
}

export async function processPayment(
  paymentHeader: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const payment = parsePaymentHeader(paymentHeader);
  if (!payment) {
    return {
      success: false,
      error: 'Invalid payment header: expected base64 JSON with x402Version, accepted, and payload fields'
    };
  }

  // Attack II: Idempotency check using the payload's unique identifier
  const nonce = extractNonceFromPayload(payment);
  const locked = await acquireLock(nonce);
  if (!locked) {
    return { success: false, error: 'Duplicate payment: this nonce was already used' };
  }

  if (cdpMode === 'development') {
    return { success: true, txHash: randomTxHash() };
  }

  try {
    // Verify the payment with the CDP facilitator
    if (!facilitatorClient) {
      return { success: false, error: 'CDP facilitator not initialized' };
    }

    const requirements = payment.accepted;

    const verifyResult = await facilitatorClient.verify(payment, requirements);
    if (!verifyResult.isValid) {
      return { success: false, error: 'Payment verification failed' };
    }

    // Settle the payment
    const settleResult = await facilitatorClient.settle(payment, requirements);
    if (!settleResult.success) {
      return { success: false, error: 'Payment settlement failed' };
    }

    return { success: true, txHash: settleResult.transaction || randomTxHash() };
  } catch (err) {
    return { success: false, error: `Payment processing failed: ${(err as Error).message}` };
  }
}

function extractNonceFromPayload(payment: { payload: Record<string, unknown> }): string {
  // Try common nonce field names in order of preference
  const nonce = payment.payload.nonce
    || payment.payload.nonceV2
    || payment.payload.authorizationId;
  if (typeof nonce === 'string') {
    return nonce;
  }
  // Fallback: hash the entire payload
  return cryptoHash(JSON.stringify(payment));
}

function cryptoHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}
