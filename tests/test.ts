import http from 'http';

const test402Challenge = () => {
  return new Promise((resolve) => {
    http.get('http://localhost:3000', (res) => {
      console.log('--- Test 1: Missing Payment Header ---');
      console.log(`Status Code: ${res.statusCode}`);
      console.log(`PAYMENT-REQUIRED header: ${res.headers['payment-required']}`);

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Body: ${data}`);
        if (res.statusCode === 402 && res.headers['payment-required']) {
          console.log('OK Test 1 Passed');
          resolve(true);
        } else {
          console.error('FAIL Test 1 Failed');
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.error('Error during test:', err);
      resolve(false);
    });
  });
};

const runTests = async () => {
  await test402Challenge();
};

runTests();