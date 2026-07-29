import { createClient, type RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

// In-memory fallback stores
const processingLocks = new Map<string, { expiresAt: number }>();
const settledNonces = new Map<string, { expiresAt: number }>();

const STORE_TYPE = process.env.REDIS_URL ? 'redis' : 'memory';

export type LockStore = 'redis' | 'memory';

export const getStoreType = (): LockStore => STORE_TYPE as LockStore;

// Periodic cleanup of expired entries (in-memory mode only)
if (STORE_TYPE === 'memory') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of processingLocks) {
      if (value.expiresAt <= now) processingLocks.delete(key);
    }
    for (const [key, value] of settledNonces) {
      if (value.expiresAt <= now) settledNonces.delete(key);
    }
  }, 30_000);
}

export const connectStore = async () => {
  if (STORE_TYPE === 'redis') {
    redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    redisClient.on('error', (err) => console.log('Redis Client Error', err));
    await redisClient.connect();
  }
};

/**
 * Acquire a processing lock for a nonce.
 * Returns false if the nonce is already locked or already settled.
 * Attack II: Prevents replay attacks by ensuring each nonce is used exactly once.
 */
export const acquireLock = async (nonce: string, ttlSeconds = 60): Promise<boolean> => {
  if (redisClient) {
    // Check if already settled
    const settled = await redisClient.get(`settled:${nonce}`);
    if (settled) return false;

    // Try to acquire lock
    const result = await redisClient.set(`lock:${nonce}`, 'processing', {
      NX: true,
      EX: ttlSeconds
    });
    return result === 'OK';
  }

  // In-memory fallback
  const now = Date.now();

  // Check if already settled
  const settled = settledNonces.get(nonce);
  if (settled && settled.expiresAt > now) return false;

  // Check if already processing
  const existing = processingLocks.get(nonce);
  if (existing && existing.expiresAt > now) return false;

  // Acquire lock
  processingLocks.set(nonce, { expiresAt: now + ttlSeconds * 1000 });
  return true;
};

/**
 * Mark a nonce as settled after successful payment processing.
 * This prevents the same nonce from being used again even after
 * the processing lock expires.
 */
export const markSettled = async (nonce: string, ttlSeconds = 3600): Promise<void> => {
  if (redisClient) {
    await redisClient.set(`settled:${nonce}`, 'settled', { EX: ttlSeconds });
    await redisClient.del(`lock:${nonce}`);
    return;
  }

  const now = Date.now();
  processingLocks.delete(nonce);
  settledNonces.set(nonce, { expiresAt: now + ttlSeconds * 1000 });
};

/**
 * Check if a nonce has already been settled.
 */
export const isSettled = async (nonce: string): Promise<boolean> => {
  if (redisClient) {
    const result = await redisClient.get(`settled:${nonce}`);
    return result !== null;
  }

  const settled = settledNonces.get(nonce);
  return settled !== undefined && settled.expiresAt > Date.now();
};
