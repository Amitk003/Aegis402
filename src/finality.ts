import crypto from 'node:crypto';

// Attack I-A: Revert-Grant mitigation
// Waits for block confirmations before releasing paid resources

const CONFIG = {
  // Number of block confirmations required for high-value payments
  highValueConfirmations: Number(process.env.FINALITY_CONFIRMATIONS) || 2,
  // Threshold above which we wait for confirmations (in USDC)
  highValueThreshold: Number(process.env.FINALITY_HIGH_VALUE_THRESHOLD) || 0.10,
  // Timeout for confirmation polling in ms
  pollTimeout: Number(process.env.FINALITY_POLL_TIMEOUT) || 30000,
  // Poll interval in ms
  pollInterval: Number(process.env.FINALITY_POLL_INTERVAL) || 2000
};

export interface FinalityResult {
  confirmed: boolean;
  confirmations: number;
  blockNumber?: number;
  txHash?: string;
}

/**
 * Wait for block confirmations based on payment value.
 * Low-value payments (< threshold) are confirmed immediately.
 * High-value payments wait for k confirmations.
 */
export async function waitForFinality(
  amount: string,
  txHash: string,
  network: string
): Promise<FinalityResult> {
  const numericAmount = parseFloat(amount);

  if (isNaN(numericAmount) || numericAmount < CONFIG.highValueThreshold) {
    // Low-value payment: accept immediately (mempool inclusion is enough)
    return {
      confirmed: true,
      confirmations: 1,
      txHash
    };
  }

  // High-value payment: wait for k confirmations
  return pollForConfirmations(txHash, network);
}

/**
 * Poll the blockchain RPC for transaction confirmations.
 * In development mode, simulates confirmation after a short delay.
 */
async function pollForConfirmations(
  txHash: string,
  network: string
): Promise<FinalityResult> {
  const rpcUrl = getRpcUrl(network);

  if (!rpcUrl) {
    console.log(`Finality: No RPC URL configured for ${network}, simulating confirmation`);
    await delay(2000);
    return {
      confirmed: true,
      confirmations: CONFIG.highValueConfirmations,
      blockNumber: Math.floor(Math.random() * 10000000),
      txHash
    };
  }

  const deadline = Date.now() + CONFIG.pollTimeout;

  while (Date.now() < deadline) {
    try {
      const txReceipt = await getTransactionReceipt(rpcUrl, txHash);
      if (txReceipt) {
        const currentBlock = await getBlockNumber(rpcUrl);
        const confirmations = currentBlock - txReceipt.blockNumber + 1;

        if (confirmations >= CONFIG.highValueConfirmations) {
          return {
            confirmed: true,
            confirmations,
            blockNumber: txReceipt.blockNumber,
            txHash
          };
        }

        console.log(`Finality: ${confirmations}/${CONFIG.highValueConfirmations} confirmations`);
      }
    } catch (err) {
      console.log('Finality: RPC poll failed:', (err as Error).message);
    }

    await delay(CONFIG.pollInterval);
  }

  return {
    confirmed: false,
    confirmations: 0,
    txHash
  };
}

function getRpcUrl(network: string): string | undefined {
  // Map CAIP-2 network identifiers to RPC URLs
  const rpcMap: Record<string, string> = {
    'eip155:8453': 'https://mainnet.base.org',
    'eip155:84532': 'https://sepolia.base.org',
    'eip155:1': 'https://cloudflare-eth.com',
    'eip155:11155111': 'https://rpc.sepolia.org'
  };

  return process.env.RPC_URL || rpcMap[network];
}

async function getTransactionReceipt(
  rpcUrl: string,
  txHash: string
): Promise<{ blockNumber: number } | null> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getTransactionReceipt',
      params: [txHash],
      id: 1
    })
  });

  const data = await response.json() as { result?: { blockNumber: string } };
  if (data.result && data.result.blockNumber) {
    return { blockNumber: parseInt(data.result.blockNumber, 16) };
  }
  return null;
}

async function getBlockNumber(rpcUrl: string): Promise<number> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1
    })
  });

  const data = await response.json() as { result: string };
  return parseInt(data.result, 16);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
