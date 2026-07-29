import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    totalRequests: 1204,
    totalUsdc: 60.20,
    attacksMitigated: 42,
    status: 'Operational'
  });
}
