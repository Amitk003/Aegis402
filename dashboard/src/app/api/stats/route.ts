import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch('http://localhost:3000/stats', { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      totalRequests: 0,
      totalUsdc: 0,
      attacksMitigated: 0,
      recentRequestsPerMinute: 0,
      attackBreakdown: {},
      lastRequests: []
    });
  }
}
