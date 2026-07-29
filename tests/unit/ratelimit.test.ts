import { checkRateLimit, trackSpend, checkSpendLimit } from '../../src/ratelimit.js';

let passed = 0;
let total = 0;

function assert(condition: boolean, name: string) {
  total++;
  if (condition) { passed++; console.log(`  PASS  ${name}`); }
  else { console.log(`  FAIL  ${name}`); }
}

function testFirstRequestAllowed() {
  console.log('\ncheckRateLimit');
  const result = checkRateLimit('wallet-001');
  assert(result.allowed === true, 'first request from wallet is allowed');
  assert(result.remaining > 0, 'remaining count is positive');
  assert(result.resetAt > Date.now(), 'resetAt is in the future');
}

function testMultipleRequests() {
  const wallet = 'wallet-rapid';
  // Exhaust the limit (default 60/min)
  let lastResult = checkRateLimit(wallet);
  for (let i = 0; i < 59; i++) {
    lastResult = checkRateLimit(wallet);
  }
  // Next one should be blocked
  const blocked = checkRateLimit(wallet);
  assert(lastResult.allowed === false || blocked.allowed === false, 'requests blocked after limit exhausted');
}

function testDifferentWallets() {
  const a = checkRateLimit('wallet-a');
  const b = checkRateLimit('wallet-b');
  assert(a.allowed && b.allowed, 'different wallets are independently rate limited');
}

function testTrackSpend() {
  console.log('\ntrackSpend');
  trackSpend('wallet-spend', '5.00');
  const result = checkSpendLimit('wallet-spend');
  assert(result.allowed === true, 'spend within limit is allowed');
  assert(result.remaining <= 10, 'remaining reflects tracked spend');
}

function testCheckSpendLimitFresh() {
  const result = checkSpendLimit('wallet-fresh');
  assert(result.allowed === true, 'fresh wallet has no spend limit issues');
  assert(result.remaining === 10, 'fresh wallet has full remaining budget');
}

testFirstRequestAllowed();
testMultipleRequests();
testDifferentWallets();
testTrackSpend();
testCheckSpendLimitFresh();

console.log(`\n${passed}/${total} ratelimit tests passed`);
process.exit(passed === total ? 0 : 1);
