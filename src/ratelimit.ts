// Rate limiting per agent wallet
// Prevents wallet drain attacks by limiting how much
// a single wallet can spend in a given time window

const walletBuckets = new Map<string, { count: number; resetAt: number }>();

const CONFIG = {
  maxRequestsPerMinute: Number(process.env.RATE_LIMIT_RPM) || 60,
  maxSpendPerHour: Number(process.env.RATE_LIMIT_SPEND) || 10, // USDC
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  reason?: string;
}

/**
 * Check if a wallet is within its rate limits.
 * Limits: max requests per minute, max total spend per hour.
 */
export function checkRateLimit(walletAddress: string): RateLimitResult {
  const now = Date.now();
  const windowMs = 60_000; // 1 minute
  const windowKey = Math.floor(now / windowMs);

  const bucketKey = `${walletAddress}:${windowKey}`;
  const bucket = walletBuckets.get(bucketKey);

  if (!bucket || bucket.resetAt <= now) {
    walletBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: CONFIG.maxRequestsPerMinute - 1, resetAt: now + windowMs };
  }

  if (bucket.count >= CONFIG.maxRequestsPerMinute) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: bucket.resetAt,
      reason: `Rate limit exceeded: max ${CONFIG.maxRequestsPerMinute} requests per minute per wallet`
    };
  }

  bucket.count++;
  return { allowed: true, remaining: CONFIG.maxRequestsPerMinute - bucket.count, resetAt: bucket.resetAt };
}

/**
 * Track spending for a wallet.
 */
export function trackSpend(walletAddress: string, amount: string): void {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount)) return;

  const now = Date.now();
  const hourWindow = 60 * 60 * 1000;
  const hourKey = Math.floor(now / hourWindow);

  const spendKey = `spend:${walletAddress}:${hourKey}`;
  const existing = walletBuckets.get(spendKey);

  if (!existing || existing.resetAt <= now) {
    walletBuckets.set(spendKey, { count: numericAmount, resetAt: now + hourWindow });
  } else {
    existing.count += numericAmount;
  }
}

/**
 * Check if a wallet has exceeded hourly spend limit.
 */
export function checkSpendLimit(walletAddress: string): RateLimitResult {
  const now = Date.now();
  const hourWindow = 60 * 60 * 1000;
  const hourKey = Math.floor(now / hourWindow);

  const spendKey = `spend:${walletAddress}:${hourKey}`;
  const bucket = walletBuckets.get(spendKey);

  if (!bucket || bucket.resetAt <= now) {
    return { allowed: true, remaining: CONFIG.maxSpendPerHour, resetAt: now + hourWindow };
  }

  if (bucket.count >= CONFIG.maxSpendPerHour) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: bucket.resetAt,
      reason: `Spend limit exceeded: max ${CONFIG.maxSpendPerHour} USDC per hour per wallet`
    };
  }

  return {
    allowed: true,
    remaining: CONFIG.maxSpendPerHour - bucket.count,
    resetAt: bucket.resetAt
  };
}
