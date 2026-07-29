// MCP end-to-end demo
// 1. Starts the MCP test server
// 2. Sends an MCP tool call through Aegis402 proxy
// 3. Gets a 402 challenge with tool-specific pricing
// 4. Signs and retries with payment
// 5. Gets the tool result

import http from 'http';

const PROXY_URL = 'http://localhost:3000';
const TOOL_NAME = 'fetch_premium_data';
const TOOL_ARGS = { symbol: 'BTC-USD', timeframe: '1w' };

function makePaymentPayload(nonce: string): string {
  return Buffer.from(JSON.stringify({
    x402Version: 1,
    accepted: {
      scheme: 'exact',
      network: 'eip155:84532',
      asset: 'USDC',
      amount: '0.01',
      payTo: '0x0000000000000000000000000000000000000000',
      maxTimeoutSeconds: 300,
      extra: { tool: TOOL_NAME }
    },
    payload: { nonce, signature: '0x' + 'a'.repeat(130) }
  })).toString('base64');
}

function request(method: string, path: string, headers: Record<string, string>, body?: string): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; data: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(PROXY_URL + path, {
      method,
      headers: { 'content-type': 'application/json', ...headers }
    }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => data += chunk.toString());
      res.on('end', () => resolve({
        status: res.statusCode || 0,
        headers: res.headers as Record<string, string | string[] | undefined>,
        data
      }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runDemo() {
  console.log('=== Aegis402 MCP Demo ===');
  console.log('');

  // Step 1: Call MCP tool without payment -> expect 402
  console.log('1. AI Agent calls MCP tool without payment...');
  const mcpBody = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: { name: TOOL_NAME, arguments: TOOL_ARGS },
    id: 1
  });

  const step1 = await request('POST', '/mcp', {}, mcpBody);
  const has402 = step1.status === 402;
  const hasPaymentRequired = !!step1.headers['payment-required'];
  console.log(`   Response: ${step1.status} ${has402 ? '(402 Payment Required)' : ''}`);
  console.log(`   Has PAYMENT-REQUIRED header: ${hasPaymentRequired}`);

  if (hasPaymentRequired) {
    try {
      const challenge = JSON.parse(Buffer.from(step1.headers['payment-required'] as string, 'base64').toString());
      console.log(`   Tool price: $${challenge.accepts?.[0]?.amount || 'unknown'} USDC`);
    } catch { /* ignore */ }
  }

  if (!has402) {
    console.log('\nERROR: Expected 402 but got', step1.status);
    console.log('Make sure Aegis402 is running on port 3000');
    process.exit(1);
  }

  // Step 2: Retry with payment
  console.log('\n2. AI Agent generates payment and retries...');
  const paymentPayload = makePaymentPayload('demo-nonce-' + Date.now());
  const step2 = await request('POST', '/mcp', { 'x-payment': paymentPayload }, mcpBody);

  const hasPaymentResponse = !!step2.headers['payment-response'];
  const hasCacheControl = (step2.headers['cache-control'] || '').includes('no-store');

  console.log(`   Response: ${step2.status}`);
  console.log(`   Has PAYMENT-RESPONSE header: ${hasPaymentResponse}`);
  console.log(`   Cache-Control sanitized: ${hasCacheControl}`);

  if (step2.status === 200 && hasPaymentResponse) {
    console.log('\n3. AI Agent receives the tool result!');
    try {
      const result = JSON.parse(step2.data);
      const content = result.result?.content || result.content || [];
      if (content.length > 0) {
        console.log(`   Tool output: ${content[0].text?.slice(0, 200)}...`);
      }
    } catch {
      console.log(`   Raw response (first 200 chars): ${step2.data.slice(0, 200)}`);
    }
  } else {
    // In dev mode, payment might be simulated but upstream may be unreachable
    console.log(`   Note: ${step2.data?.slice(0, 100)}`);
  }

  // Step 3: Show per-tool pricing demo
  console.log('\n4. Per-tool pricing demonstration:');
  for (const tool of ['search_web', 'generate_report', 'fetch_premium_data']) {
    const req = await request('POST', '/mcp', {});
    const challenge = req.headers['payment-required'];
    if (challenge) {
      try {
        const c = JSON.parse(Buffer.from(challenge as string, 'base64').toString());
        console.log(`   ${tool}: $${c.accepts?.[0]?.amount || 'default'} USDC`);
      } catch { /* */ }
    }
  }

  console.log('\n=== Demo Complete ===');
}

runDemo().catch(console.error);
