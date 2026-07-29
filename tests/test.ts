import http from 'http';

const PROXY_URL = 'http://localhost:3000';

async function testNoPaymentHeader(): Promise<boolean> {
  return new Promise((resolve) => {
    http.get(PROXY_URL, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const passed = res.statusCode === 402 && !!res.headers['payment-required'];
        console.log(passed ? 'PASS' : 'FAIL', 'No payment header returns 402 with challenge');
        if (!passed) {
          console.log('  Expected 402, got', res.statusCode);
        }
        resolve(passed);
      });
    }).on('error', (err) => {
      console.log('FAIL', 'Request failed:', err.message);
      resolve(false);
    });
  });
}

async function testCacheHeaders(): Promise<boolean> {
  return new Promise((resolve) => {
    http.get(PROXY_URL, (res) => {
      const cc = res.headers['cache-control'] || '';
      const passed = cc.includes('no-store');
      console.log(passed ? 'PASS' : 'FAIL', 'Response has Cache-Control: no-store');
      if (!passed) {
        console.log('  Got cache-control:', cc);
      }
      resolve(passed);
    }).on('error', () => resolve(false));
  });
}

async function runTests() {
  console.log('Aegis402 Proxy Tests');
  console.log('====================');
  console.log('Proxy URL:', PROXY_URL);
  console.log('');

  const results = await Promise.all([
    testNoPaymentHeader(),
    testCacheHeaders(),
  ]);

  const passed = results.filter(Boolean).length;
  const total = results.length;

  console.log('');
  console.log(`Results: ${passed}/${total} tests passed`);
  process.exit(passed === total ? 0 : 1);
}

runTests();
