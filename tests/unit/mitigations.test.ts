// Unit tests for the mitigation coordinator
import { prePaymentCheck, postPaymentCheck, recordSettlement } from '../../src/mitigations.js';

let passed = 0;
let total = 0;

function assert(condition: boolean, name: string) {
  total++;
  if (condition) { passed++; console.log(`  PASS  ${name}`); }
  else { console.log(`  FAIL  ${name}`); }
}

async function testPrePaymentCheckAllowed() {
  console.log('\nprePaymentCheck');
  const OLD_STRICT = process.env.REGISTRY_STRICT;
  delete process.env.REGISTRY_STRICT;
  const result = await prePaymentCheck(
    {
      x402Version: 1,
      accepted: { scheme: 'exact', network: 'eip155:84532', asset: 'USDC', amount: '0.05', payTo: '0xTest', maxTimeoutSeconds: 300, extra: {} },
      payload: { nonce: 'test-mit-001', signature: '0xsig' }
    },
    'http://localhost:8080'
  );
  assert(result.allowed === true, 'valid payment passes pre-payment checks');
  if (OLD_STRICT) process.env.REGISTRY_STRICT = OLD_STRICT;
}

async function testPrePaymentCheckDuplicate() {
  const nonce = 'test-mit-dup';
  const payment = {
    x402Version: 1,
    accepted: { scheme: 'exact', network: 'eip155:84532', asset: 'USDC', amount: '0.05', payTo: '0xTest', maxTimeoutSeconds: 300, extra: {} },
    payload: { nonce, signature: '0xsig' }
  };

  const first = await prePaymentCheck(payment, 'http://localhost:8080');
  assert(first.allowed === true, 'first attempt passes');

  const second = await prePaymentCheck(payment, 'http://localhost:8080');
  assert(second.allowed === false, 'duplicate nonce is blocked');
  assert(second.reason !== undefined, 'blocked with reason');
}

async function testPrePaymentCheckStrictRegistry() {
  const OLD_STRICT = process.env.REGISTRY_STRICT;
  process.env.REGISTRY_STRICT = 'true';
  const result = await prePaymentCheck(
    {
      x402Version: 1,
      accepted: { scheme: 'exact', network: 'eip155:84532', asset: 'USDC', amount: '0.05', payTo: '0xTest', maxTimeoutSeconds: 300, extra: {} },
      payload: { nonce: 'test-mit-002', signature: '0xsig' }
    },
    'https://not-registered.example.com'
  );
  assert(result.allowed === false, 'unregistered endpoint blocked in strict mode');
  process.env.REGISTRY_STRICT = OLD_STRICT;
}

async function testPostPaymentCheckLowValue() {
  const result = await postPaymentCheck('0xhash', '0.01', 'eip155:84532');
  assert(result.allowed === true, 'low value payment passes post-payment check');
}

async function testRecordSettlement() {
  await recordSettlement('test-mit-settle');
  const check = await prePaymentCheck(
    {
      x402Version: 1,
      accepted: { scheme: 'exact', network: 'eip155:84532', asset: 'USDC', amount: '0.05', payTo: '0xTest', maxTimeoutSeconds: 300, extra: {} },
      payload: { nonce: 'test-mit-settle', signature: '0xsig' }
    },
    'http://localhost:8080'
  );
  assert(check.allowed === false, 'settled nonce cannot be reused');
}

await testPrePaymentCheckAllowed();
await testPrePaymentCheckDuplicate();
await testPrePaymentCheckStrictRegistry();
await testPostPaymentCheckLowValue();
await testRecordSettlement();

console.log(`\n${passed}/${total} mitigations tests passed`);
process.exit(passed === total ? 0 : 1);
