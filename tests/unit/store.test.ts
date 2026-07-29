// Store tests - use in-memory mode (no REDIS_URL set)
import { acquireLock, markSettled, isSettled } from '../../src/store.js';

let passed = 0;
let total = 0;

function assert(condition: boolean, name: string) {
  total++;
  if (condition) { passed++; console.log(`  PASS  ${name}`); }
  else { console.log(`  FAIL  ${name}`); }
}

async function testAcquireLockNew() {
  console.log('\nacquireLock');
  const result = await acquireLock('test-lock-001');
  assert(result === true, 'acquires lock for new nonce');
}

async function testAcquireLockDuplicate() {
  const nonce = 'test-lock-002';
  const first = await acquireLock(nonce);
  assert(first === true, 'first acquisition succeeds');
  const second = await acquireLock(nonce);
  assert(second === false, 'second acquisition fails (already locked)');
}

async function testMarkSettled() {
  const nonce = 'test-settle-001';
  await acquireLock(nonce);
  await markSettled(nonce);
  const settled = await isSettled(nonce);
  assert(settled === true, 'nonce is settled after markSettled');
}

async function testIsSettledFalse() {
  const result = await isSettled('non-existent-nonce');
  assert(result === false, 'unknown nonce is not settled');
}

async function testLockAfterSettled() {
  const nonce = 'test-lock-after-settle';
  await markSettled(nonce);
  const lock = await acquireLock(nonce);
  assert(lock === false, 'cannot acquire lock on already settled nonce');
}

async function testMultipleNonces() {
  const lockA = await acquireLock('multi-a');
  const lockB = await acquireLock('multi-b');
  assert(lockA === true && lockB === true, 'different nonces can be locked independently');
}

async function run() {
  console.log('Store tests (in-memory mode)');
  await testAcquireLockNew();
  await testAcquireLockDuplicate();
  await testMarkSettled();
  await testIsSettledFalse();
  await testLockAfterSettled();
  await testMultipleNonces();
  console.log(`\n${passed}/${total} store tests passed`);
  process.exit(passed === total ? 0 : 1);
}

run();
