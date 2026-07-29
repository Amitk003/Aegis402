import http from 'http';

const PROXY_URL = 'http://localhost:3000';

async function testNoPaymentHeader(): Promise<boolean> {
  return new Promise((resolve) => {
    http.get(PROXY_URL, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const has402 = res.statusCode === 402;
        const hasPaymentRequired = !!res.headers['payment-required'];
        const hasCacheControl = (res.headers['cache-control'] || '').includes('no-store');
        const allPassed = has402 && hasPaymentRequired && hasCacheControl;
        console.log(allPassed ? 'PASS' : 'FAIL', 'No payment header returns 402 with challenge and cache-control');
        if (!allPassed) {
          console.log('  Status:', res.statusCode, '| Payment-Required:', !!res.headers['payment-required'], '| Cache-Control:', res.headers['cache-control']);
        }
        resolve(allPassed);
      });
    }).on('error', (err) => {
      console.log('FAIL', 'Request failed:', err.message);
      resolve(false);
    });
  });
}

async function testWithPaymentHeader(): Promise<boolean> {
  return new Promise((resolve) => {
    const paymentPayload = Buffer.from(JSON.stringify({
      x402Version: 1,
      accepted: {
        scheme: 'exact',
        network: 'eip155:84532',
        asset: 'USDC',
        amount: '0.05',
        payTo: '0x0000000000000000000000000000000000000000',
        maxTimeoutSeconds: 300,
        extra: {}
      },
      payload: {
        nonce: 'test-nonce-001',
        signature: '0xmocked-signature'
      }
    })).toString('base64');

    const req = http.request(PROXY_URL, {
      method: 'GET',
      headers: { 'x-payment': paymentPayload }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const hasPaymentResponse = !!res.headers['payment-response'];
        const hasCacheControl = (res.headers['cache-control'] || '').includes('no-store');
        console.log(hasPaymentResponse && hasCacheControl ? 'PASS' : 'FAIL', 'Payment header returns receipt and cache-control');
        if (!hasPaymentResponse) console.log('  Missing payment-response header');
        if (!hasCacheControl) console.log('  Missing cache-control: no-store');
        resolve(hasPaymentResponse);
      });
    });

    req.on('error', (err) => {
      console.log('FAIL', 'Request failed:', err.message);
      resolve(false);
    });

    req.end();
  });
}

async function testReplayProtection(): Promise<boolean> {
  return new Promise((resolve) => {
    const paymentPayload = Buffer.from(JSON.stringify({
      x402Version: 1,
      accepted: {
        scheme: 'exact',
        network: 'eip155:84532',
        asset: 'USDC',
        amount: '0.05',
        payTo: '0x0000000000000000000000000000000000000000',
        maxTimeoutSeconds: 300,
        extra: {}
      },
      payload: {
        nonce: 'test-nonce-replay',
        signature: '0xmocked-signature'
      }
    })).toString('base64');

    // Send first request
    const req1 = http.request(PROXY_URL, {
      method: 'GET',
      headers: { 'x-payment': paymentPayload }
    }, (res1) => {
      // Send second request with same nonce
      const req2 = http.request(PROXY_URL, {
        method: 'GET',
        headers: { 'x-payment': paymentPayload }
      }, (res2) => {
        const blocked = res2.statusCode === 409 || res2.statusCode === 402;
        console.log(blocked ? 'PASS' : 'FAIL', 'Replay with same nonce is blocked');
        if (!blocked) console.log('  Expected 409 or 402, got', res2.statusCode);
        resolve(blocked);
      });

      req2.on('error', () => resolve(false));
      req2.end();

      // Drain first response
      res1.on('data', () => {});
    });

    req1.on('error', () => resolve(false));
    req1.end();
  });
}

async function runTests() {
  console.log('Aegis402 Proxy Tests');
  console.log('====================');
  console.log('');

  const results = await Promise.all([
    testNoPaymentHeader(),
    testWithPaymentHeader(),
    testReplayProtection()
  ]);

  const passed = results.filter(Boolean).length;
  const total = results.length;

  console.log('');
  console.log(`Results: ${passed}/${total} tests passed`);
  process.exit(passed === total ? 0 : 1);
}

runTests();
