import crypto from 'node:crypto';

export interface PaymentRequirements {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
}

export interface PaymentPayload {
  x402Version: number;
  accepted: PaymentRequirements;
  payload: Record<string, unknown>;
}

export interface PaymentRequired {
  x402Version: number;
  accepts: PaymentRequirements[];
}

export interface PaymentReceipt {
  txHash: string;
  status: 'settled' | 'pending' | 'failed';
  network: string;
}

const CONFIG = {
  price: process.env.PRICE || '0.05',
  network: process.env.NETWORK || 'eip155:84532',
  asset: process.env.ASSET || 'USDC',
  payTo: process.env.PAY_TO || '0x0000000000000000000000000000000000000000'
};

export function createChallenge(): {
  headers: Record<string, string>;
  body: PaymentRequired;
} {
  const requirements: PaymentRequirements = {
    scheme: 'exact',
    network: CONFIG.network,
    asset: CONFIG.asset,
    amount: CONFIG.price,
    payTo: CONFIG.payTo,
    maxTimeoutSeconds: 300,
    extra: {}
  };

  const body: PaymentRequired = {
    x402Version: 1,
    accepts: [requirements]
  };

  return {
    headers: {
      'payment-required': Buffer.from(JSON.stringify(body)).toString('base64'),
      'cache-control': 'private, no-cache, no-store, must-revalidate'
    },
    body
  };
}

export function parsePaymentHeader(headerValue: string): PaymentPayload | null {
  try {
    const decoded = Buffer.from(headerValue, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    if (parsed.x402Version && parsed.accepted && parsed.payload) {
      return parsed as PaymentPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export function createReceipt(
  txHash: string,
  status: PaymentReceipt['status'] = 'settled',
  network?: string
): { headers: Record<string, string>; body: PaymentReceipt } {
  const receipt: PaymentReceipt = { txHash, status, network: network || CONFIG.network };
  return {
    headers: {
      'payment-response': Buffer.from(JSON.stringify(receipt)).toString('base64')
    },
    body: receipt
  };
}

export function randomTxHash(): string {
  return '0x' + crypto.randomBytes(32).toString('hex');
}
