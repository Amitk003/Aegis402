import { createClient } from 'redis';

export const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.on('error', (err) => console.log('Redis Client Error', err));

export const connectRedis = async () => {
  if (!redis.isOpen) {
    await redis.connect();
  }
};

/**
 * Attempts to acquire an idempotency lock for the given nonce.
 * @param nonce The 32-byte cryptographic nonce from the payment signature.
 * @returns true if lock acquired successfully, false if nonce already exists.
 */
export const acquireLock = async (nonce: string): Promise<boolean> => {
  // SET NX ensures the key is set only if it does not exist
  // EX sets an expiration (e.g., 60 seconds) so locks don't stay forever
  const result = await redis.set(`lock:${nonce}`, 'processing', {
    NX: true,
    EX: 60
  });

  return result === 'OK';
};
