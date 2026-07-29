// In-memory stats tracker for dashboard analytics

interface RequestRecord {
  timestamp: number;
  method: string;
  path: string;
  status: 'challenged' | 'paid' | 'rejected' | 'rate_limited' | 'blocked';
  wallet?: string;
  amount?: string;
  attackType?: string;
  detail?: string;
}

const MAX_RECORDS = 1000;

const records: RequestRecord[] = [];

let totalRequests = 0;
let totalUsdc = 0;
let totalAttacks = 0;

const attackTypeCounts: Record<string, number> = {};

export function recordRequest(record: RequestRecord): void {
  records.unshift(record);
  if (records.length > MAX_RECORDS) records.pop();
  totalRequests++;
  if (record.amount) totalUsdc += parseFloat(record.amount) || 0;
  if (record.status === 'blocked') {
    totalAttacks++;
    if (record.attackType) {
      attackTypeCounts[record.attackType] = (attackTypeCounts[record.attackType] || 0) + 1;
    }
  }
}

export function getStats() {
  const now = Date.now();
  const oneMinuteAgo = now - 60_000;
  const recentRequests = records.filter(r => r.timestamp >= oneMinuteAgo).length;

  return {
    totalRequests,
    totalUsdc: Math.round(totalUsdc * 100) / 100,
    attacksMitigated: totalAttacks,
    recentRequestsPerMinute: recentRequests,
    attackBreakdown: { ...attackTypeCounts },
    lastRequests: records.slice(0, 20)
  };
}
