import { createChallenge, parsePaymentHeader, createReceipt } from '../../src/x402.js';

const OLD_ENV = process.env;

function resetEnv() {
  process.env = { ...OLD_ENV };
  process.env.PRICE = '0.05';
  process.env.NETWORK = 'eip155:84532';
  process.env.ASSET = 'USDC';
  process.env.PAY_TO = '0xTestPayToAddress';
}

let passed = 0;
let total = 0;

function assert(condition: boolean, name: string) {
  total++;
  if (condition) { passed++; console.log(`  PASS  ${name}`); }
  else { console.log(`  FAIL  ${name}`); }
}

function testCreateChallenge() {
  console.log('\ncreateChallenge');
  resetEnv();
  const result = createChallenge();

  assert(result.status === undefined, 'no status on result (it uses headers for 402)');
  assert(typeof result.body === 'object', 'body is object');
  assert(typeof result.headers === 'object', 'headers is object');
  assert('payment-required' in result.headers, 'has payment-required header');

  const decoded = JSON.parse(Buffer.from(result.headers['payment-required'], 'base64').toString());
  assert(decoded.accepts !== undefined, 'accepts array exists');
  assert(decoded.accepts[0]?.amount === '0.05', 'amount matches PRICE env');
  assert(decoded.accepts[0]?.network === 'eip155:84532', 'network matches');
  assert(decoded.accepts[0]?.asset === 'USDC', 'asset matches');
}

function testCreateChallengeCustomPrice() {
  console.log('\ncreateChallenge custom price');
  resetEnv();
  process.env.PRICE = '1.50';
  const result = createChallenge();
  const decoded = JSON.parse(Buffer.from(result.headers['payment-required'], 'base64').toString());
  assert(decoded.accepts[0]?.amount === '1.50', 'uses custom price from env');
}

function testParsePaymentHeader() {
  console.log('\nparsePaymentHeader');
  resetEnv();

  const validPayload = {
    x402Version: 1,
    accepted: { scheme: 'exact', network: 'eip155:84532', asset: 'USDC', amount: '0.05', payTo: '0xTest', maxTimeoutSeconds: 300, extra: {} },
    payload: { nonce: '0xabc123', signature: '0xsig' }
  };
  const encoded = Buffer.from(JSON.stringify(validPayload)).toString('base64');
  const result = parsePaymentHeader(encoded);
  assert(result !== null, 'valid base64 JSON parses');
  assert(result?.payload?.nonce === '0xabc123', 'extracts nonce from payload');

  const result2 = parsePaymentHeader('not-json');
  assert(result2 === null, 'invalid base64 returns null');
}

function testCreateReceipt() {
  console.log('\ncreateReceipt');
  const receipt = createReceipt('0xabc123def456');
  assert(receipt.body.txHash === '0xabc123def456', 'tx hash in receipt body');
  assert(receipt.body.status === 'settled', 'status is settled by default');
  assert('payment-response' in receipt.headers, 'has payment-response header');
}

testCreateChallenge();
testCreateChallengeCustomPrice();
testParsePaymentHeader();
testCreateReceipt();

console.log(`\n${passed}/${total} x402 tests passed`);
process.exit(passed === total ? 0 : 1);
