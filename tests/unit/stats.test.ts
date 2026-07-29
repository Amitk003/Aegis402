import { recordRequest, getStats } from '../../src/stats.js';

let passed = 0;
let total = 0;

function assert(condition: boolean, name: string) {
  total++;
  if (condition) { passed++; console.log(`  PASS  ${name}`); }
  else { console.log(`  FAIL  ${name}`); }
}

function testEmptyStats() {
  console.log('\ngetStats (empty)');
  const stats = getStats();
  assert(stats.totalRequests === 0, 'totalRequests starts at 0');
  assert(stats.totalUsdc === 0, 'totalUsdc starts at 0');
  assert(stats.attacksMitigated === 0, 'attacksMitigated starts at 0');
  assert(Array.isArray(stats.lastRequests), 'lastRequests is array');
}

function testRecordChallenged() {
  console.log('\nrecordRequest challenged');
  recordRequest({ timestamp: Date.now(), method: 'GET', path: '/api/data', status: 'challenged' });
  const stats = getStats();
  assert(stats.totalRequests === 1, 'totalRequests incremented');
  assert(stats.totalUsdc === 0, 'challenged requests do not add USDC');
}

function testRecordPaid() {
  recordRequest({ timestamp: Date.now(), method: 'POST', path: '/api/test', status: 'paid', wallet: '0xabc', amount: '0.25' });
  const stats = getStats();
  assert(stats.totalRequests === 2, 'totalRequests incremented again');
  assert(stats.totalUsdc === 0.25, 'USDC tracked from paid request');
}

function testRecordAttack() {
  recordRequest({ timestamp: Date.now(), method: 'GET', path: '/api/data', status: 'blocked', attackType: 'replay' });
  const stats = getStats();
  assert(stats.attacksMitigated === 1, 'attack blocked incremented');
  assert(stats.attackBreakdown.replay === 1, 'attack breakdown has replay type');
}

function testRecordRateLimited() {
  recordRequest({ timestamp: Date.now(), method: 'GET', path: '/api/data', status: 'rate_limited' });
  const stats = getStats();
  assert(stats.totalRequests === 4, 'totalRequests includes rate limited');
}

function testLastRequestsOrder() {
  const stats = getStats();
  assert(stats.lastRequests.length >= 3, 'lastRequests contains recent entries');
  assert(stats.lastRequests[0]?.status === 'rate_limited', 'most recent is first');
}

testEmptyStats();
testRecordChallenged();
testRecordPaid();
testRecordAttack();
testRecordRateLimited();
testLastRequestsOrder();

console.log(`\n${passed}/${total} stats tests passed`);
process.exit(passed === total ? 0 : 1);
