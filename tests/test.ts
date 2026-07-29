import http from 'http';

const PROXY_URL = 'http://localhost:3000';

function makePaymentPayload(nonce: string): string {
  return Buffer.from(JSON.stringify({
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
    payload: { nonce, signature: '0xmocked-signature' }
  })).toString('base64');
}

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
    const payload = makePaymentPayload('test-nonce-001');
    const req = http.request(PROXY_URL, {
      method: 'GET',
      headers: { 'x-payment': payload }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const hasPaymentResponse = !!res.headers['payment-response'];
        const hasCacheControl = (res.headers['cache-control'] || '').includes('no-store');
        const hasVary = (res.headers['vary'] || '').includes('x-payment');
        const noEtag = res.headers['etag'] === undefined;
        console.log(hasPaymentResponse && hasCacheControl ? 'PASS' : 'FAIL', 'Valid payment returns receipt and cache headers');
        if (hasVary) console.log('   Vary header includes x-payment');
        if (noEtag) console.log('   ETag stripped as expected');
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
    const payload = makePaymentPayload('test-nonce-replay');
    const headers = { 'x-payment': payload };

    // First request should succeed
    const req1 = http.request(PROXY_URL, { method: 'GET', headers }, (res1) => {
      res1.on('data', () => {});

      // Second request with same nonce should be blocked
      const req2 = http.request(PROXY_URL, { method: 'GET', headers }, (res2) => {
        res2.on('data', () => {});
        const blocked = res2.statusCode === 409 || res2.statusCode === 402;
        console.log(blocked ? 'PASS' : 'FAIL', 'Replay with same nonce returns 409/402');
        if (!blocked) console.log('  Expected 409 or 402, got', res2.statusCode);
        resolve(blocked);
      });
      req2.on('error', () => resolve(false));
      req2.end();
    });
    req1.on('error', () => resolve(false));
    req1.end();
  });
}

async function testCacheHeaders(): Promise<boolean> {
  return new Promise((resolve) => {
    const payload = makePaymentPayload('test-nonce-cache');
    const req = http.request(PROXY_URL, {
      method: 'GET',
      headers: { 'x-payment': payload }
    }, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        const cc = res.headers['cache-control'] || '';
        const pragma = res.headers['pragma'] || '';
        const expires = res.headers['expires'] || '';
        const cacheSafe = cc.includes('no-store') && pragma.includes('no-cache');
        console.log(cacheSafe ? 'PASS' : 'FAIL', 'Attack III: Cache headers properly sanitized');
        if (!cacheSafe) console.log('  cache-control:', cc, 'pragma:', pragma);
        resolve(cacheSafe);
      });
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function testInvalidPaymentHeader(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(PROXY_URL, {
      method: 'GET',
      headers: { 'x-payment': 'not-base64-json' }
    }, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        const rejected = res.statusCode === 402;
        console.log(rejected ? 'PASS' : 'FAIL', 'Invalid payment header is rejected');
        resolve(rejected);
      });
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function testAcceptMultipleMethods(): Promise<boolean> {
  return new Promise((resolve) => {
    const payload = makePaymentPayload('test-nonce-post');
    const req = http.request(PROXY_URL, {
      method: 'POST',
      headers: { 'x-payment': payload, 'content-type': 'application/json' }
    }, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        console.log(res.statusCode !== 402 ? 'PASS' : 'FAIL', 'POST request with payment is accepted');
        resolve(res.statusCode !== 402);
      });
    });
    req.on('error', () => resolve(false));
    req.write(JSON.stringify({ test: true }));
    req.end();
  });
}

async function runTests() {
  console.log('Aegis402 Proxy Tests');
  console.log('====================');
  console.log('');

  const results = await Promise.all([
    testNoPaymentHeader(),
    testWithPaymentHeader(),
    testReplayProtection(),
    testCacheHeaders(),
    testInvalidPaymentHeader(),
    testAcceptMultipleMethods()
  ]);

  const passed = results.filter(Boolean).length;
  const total = results.length;

  console.log('');
  console.log(`Results: ${passed}/${total} tests passed`);
  process.exit(passed === total ? 0 : 1);
}

runTests();
