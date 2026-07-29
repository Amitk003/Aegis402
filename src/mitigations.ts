// Aegis402 Security Mitigations
// Coordinates all 5 attack mitigations for the x402 protocol

import { waitForFinality, type FinalityResult } from './finality.js';
import { checkCallerBinding } from './binding.js';
import { checkEndpoint } from './registry.js';
import { acquireLock, markSettled, isSettled } from './store.js';
import { extractNonce } from './nonce.js';
import type { PaymentPayload } from './x402.js';

export interface MitigationResult {
  allowed: boolean;
  reason?: string;
  finality?: FinalityResult;
}

export interface MitigationConfig {
  /** Upstream URL to check for sybil/registry */
  upstreamUrl: string;
  /** Amount in USDC string */
  amount: string;
  /** Transaction hash for finality check */
  txHash: string;
  /** CAIP-2 network identifier */
  network: string;
}

/**
 * Run all pre-payment mitigations.
 * Called BEFORE processing the payment.
 */
export async function prePaymentCheck(
  paymentPayload: PaymentPayload,
  upstreamUrl: string
): Promise<MitigationResult> {
  const nonce = extractNonce(paymentPayload);

  // Attack II: Replay and Idempotency check
  const alreadySettled = await isSettled(nonce);
  if (alreadySettled) {
    return { allowed: false, reason: 'Nonce has already been settled (replay blocked)' };
  }

  const locked = await acquireLock(nonce);
  if (!locked) {
    return { allowed: false, reason: 'Nonce is currently being processed (duplicate blocked)' };
  }

  // Attack IV: Sybil / Endpoint verification
  const endpointCheck = checkEndpoint(upstreamUrl);
  if (!endpointCheck.valid) {
    return { allowed: false, reason: endpointCheck.reason };
  }

  // Attack I-B: Settlement preemption / caller binding
  const bindingCheck = checkCallerBinding(paymentPayload.payload, paymentPayload.accepted);
  if (!bindingCheck.valid) {
    return { allowed: false, reason: bindingCheck.reason };
  }

  return { allowed: true };
}

/**
 * Run all post-payment mitigations.
 * Called AFTER the payment is settled on-chain.
 */
export async function postPaymentCheck(
  txHash: string,
  amount: string,
  network: string
): Promise<MitigationResult> {
  // Attack I-A: Revert-Grant mitigation - wait for block confirmations
  const finality = await waitForFinality(amount, txHash, network);
  if (!finality.confirmed) {
    return {
      allowed: false,
      reason: `Transaction did not reach required confirmations within timeout.`,
      finality
    };
  }

  return { allowed: true, finality };
}

/**
 * Record a successful payment so the nonce cannot be replayed.
 */
export async function recordSettlement(nonce: string): Promise<void> {
  await markSettled(nonce);
}
