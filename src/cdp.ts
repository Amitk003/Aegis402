import crypto from 'node:crypto';
import { createCdpFacilitatorClient } from '@coinbase/cdp-sdk/x402';
import { parsePaymentHeader, randomTxHash } from './x402.js';
import { prePaymentCheck, postPaymentCheck, recordSettlement } from './mitigations.js';

let cdpMode: 'development' | 'production' = 'development';

let facilitatorClient: {
  verify(paymentPayload: unknown, requirements: unknown): Promise<{ isValid: boolean }>;
  settle(paymentPayload: unknown, requirements: unknown): Promise<{ success: boolean; transaction?: string }>;
} | null = null;

export function isProductionMode(): boolean {
  return cdpMode === 'production';
}

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
    const keyId = process.env.CDP_API_KEY_ID || process.env.CDP_API_KEY || '';
    const keySecret = process.env.CDP_API_KEY_SECRET || process.env.CDP_API_API_SECRET || '';
    facilitatorClient = createCdpFacilitatorClient({
      apiKeyId: keyId || undefined,
      apiKeySecret: keySecret || undefined
    });
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
  paymentHeader: string,
  upstreamUrl: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const payment = parsePaymentHeader(paymentHeader);
  if (!payment) {
    return {
      success: false,
      error: 'Invalid payment header: expected base64 JSON with x402Version, accepted, and payload fields'
    };
  }

  // Run pre-payment security mitigations
  const preCheck = await prePaymentCheck(payment, upstreamUrl);
  if (!preCheck.allowed) {
    return { success: false, error: `Security check failed: ${preCheck.reason}` };
  }

  if (cdpMode === 'development') {
    const txHash = randomTxHash();
    // Run post-payment verification (dev mode: instant)
    const postCheck = await postPaymentCheck(txHash, payment.accepted.amount, payment.accepted.network);
    if (!postCheck.allowed) {
      return { success: false, error: `Finality check failed: ${postCheck.reason}` };
    }
    logPaymentSplit(payment.accepted.amount, payment.accepted.payTo);
    await recordSettlement(extractNonceSafe(payment));
    return { success: true, txHash };
  }

  try {
    if (!facilitatorClient) {
      return { success: false, error: 'CDP facilitator not initialized' };
    }

    const requirements = payment.accepted;

    // Verify the payment
    const verifyResult = await facilitatorClient.verify(payment, requirements);
    if (!verifyResult.isValid) {
      return { success: false, error: 'Payment verification failed' };
    }

    // Settle the payment
    const settleResult = await facilitatorClient.settle(payment, requirements);
    if (!settleResult.success) {
      return { success: false, error: 'Payment settlement failed' };
    }

    const txHash = settleResult.transaction || randomTxHash();
    logPaymentSplit(payment.accepted.amount, payment.accepted.payTo);

    // Run post-payment verification with k-confirmations
    const postCheck = await postPaymentCheck(txHash, payment.accepted.amount, payment.accepted.network);
    if (!postCheck.allowed) {
      return { success: false, error: `Finality check failed: ${postCheck.reason}` };
    }

    await recordSettlement(extractNonceSafe(payment));
    return { success: true, txHash };
  } catch (err) {
    return { success: false, error: `Payment processing failed: ${(err as Error).message}` };
  }
}

/**
 * Get the splitter contract address from env, if configured.
 */
export function getSplitterAddress(): string | undefined {
  return process.env.SPLITTER_ADDRESS || undefined;
}

/**
 * Log the payment split when a splitter contract is configured.
 * In production with SPLITTER_ADDRESS set, the on-chain contract
 * handles the actual split. This function logs what would happen.
 */
export function logPaymentSplit(amount: string, merchantAddress: string): { merchantAmount: string; feeAmount: string } {
  const numericAmount = parseFloat(amount);
  const feeBps = 50; // 0.5%
  const feeAmount = ((numericAmount * feeBps) / 10000).toFixed(6);
  const merchantAmount = (numericAmount - parseFloat(feeAmount)).toFixed(6);
  const splitter = getSplitterAddress();

  const shortAddr = (addr: string) => addr.length > 10 ? addr.slice(0, 6) + '...' + addr.slice(-4) : addr;
  console.log('Payment split:', {
    total: amount,
    merchant: merchantAmount,
    fee: feeAmount,
    feeBps,
    merchantAddress: shortAddr(merchantAddress),
    splitter: splitter ? shortAddr(splitter) : '(not configured, full amount goes to PAY_TO)'
  });

  return { merchantAmount, feeAmount };
}

function extractNonceSafe(payment: { payload: Record<string, unknown> }): string {
  // Dynamic import to avoid circular dependency
  const nonce = payment.payload.nonce
    || payment.payload.nonceV2
    || payment.payload.authorizationId;
  if (typeof nonce === 'string') return nonce;
  return hashString(JSON.stringify(payment));
}

function hashString(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
