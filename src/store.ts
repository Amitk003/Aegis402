import { createClient, type RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

// In-memory fallback Map for when Redis is not available
const memoryStore = new Map<string, { value: string; expiresAt: number }>();

const STORE_TYPE = process.env.REDIS_URL ? 'redis' : 'memory';

export type LockStore = 'redis' | 'memory';

export const getStoreType = (): LockStore => STORE_TYPE as LockStore;

export const connectStore = async () => {
  if (STORE_TYPE === 'redis') {
    redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    redisClient.on('error', (err) => console.log('Redis Client Error', err));
    await redisClient.connect();
  }
};

export const acquireLock = async (nonce: string, ttlSeconds = 60): Promise<boolean> => {
  if (redisClient) {
    const result = await redisClient.set(`lock:${nonce}`, 'processing', {
      NX: true,
      EX: ttlSeconds
    });
    return result === 'OK';
  }

  // In-memory fallback
  const key = `lock:${nonce}`;
  const existing = memoryStore.get(key);
  const now = Date.now();

  if (existing && existing.expiresAt > now) {
    return false; // Lock is still active
  }

  // Clean expired and set new lock
  memoryStore.set(key, { value: 'processing', expiresAt: now + ttlSeconds * 1000 });
  return true;
};
