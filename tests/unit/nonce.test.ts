import { extractNonce } from '../../src/nonce.js';
import type { PaymentPayload } from '../../src/x402.js';

let passed = 0;
let total = 0;

function assert(condition: boolean, name: string) {
  total++;
  if (condition) { passed++; console.log(`  PASS  ${name}`); }
  else { console.log(`  FAIL  ${name}`); }
}

function makePayment(payloadFields: Record<string, unknown>): PaymentPayload {
  return {
    x402Version: 1,
    accepted: { scheme: 'exact', network: 'eip155:84532', asset: 'USDC', amount: '0.05', payTo: '0xTest', maxTimeoutSeconds: 300, extra: {} },
    payload: payloadFields
  };
}

function testExtractNonceStandard() {
  console.log('\nextractNonce standard fields');
  const result = extractNonce(makePayment({ nonce: '0xabc123' }));
  assert(result === '0xabc123', 'extracts standard nonce field');
}

function testExtractNonceV2() {
  const result = extractNonce(makePayment({ nonceV2: '0xdef456' }));
  assert(result === '0xdef456', 'extracts nonceV2 field');
}

function testExtractNonceAuthorizationId() {
  const result = extractNonce(makePayment({ authorizationId: '0x789abc' }));
  assert(result === '0x789abc', 'extracts authorizationId field');
}

function testExtractNonceEip3009() {
  const result = extractNonce(makePayment({ transferWithAuthorization: { nonce: '0xeip3009nonce' } }));
  assert(result === '0xeip3009nonce', 'extracts nested EIP-3009 nonce');
}

function testExtractNonceFallback() {
  const result = extractNonce(makePayment({ some: 'data', other: 'fields' }));
  assert(result !== undefined && result.length > 0, 'fallback produces a value');
}

testExtractNonceStandard();
testExtractNonceV2();
testExtractNonceAuthorizationId();
testExtractNonceEip3009();
testExtractNonceFallback();

console.log(`\n${passed}/${total} nonce tests passed`);
process.exit(passed === total ? 0 : 1);
