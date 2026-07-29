// Finality tests - low-value payments accepted immediately
import { waitForFinality } from '../../src/finality.js';

let passed = 0;
let total = 0;

function assert(condition: boolean, name: string) {
  total++;
  if (condition) { passed++; console.log(`  PASS  ${name}`); }
  else { console.log(`  FAIL  ${name}`); }
}

async function testLowValueAcceptedImmediately() {
  console.log('\nwaitForFinality');
  const result = await waitForFinality('0.01', '0xhash001', 'eip155:84532');
  assert(result.confirmed === true, 'low value payment accepted immediately');
  assert(result.confirmations === 1, 'reports 1 confirmation for low value');
}

async function testHighValueInDevMode() {
  const OLD_RPC = process.env.RPC_URL;
  delete process.env.RPC_URL;
  // Use an unknown network so it falls back to simulated confirmation
  const result = await waitForFinality('0.50', '0xhash002', 'unknown:network');
  assert(result.confirmed === true, 'high value simulated in dev mode');
  assert(result.confirmations >= 1, 'reports confirmations in dev mode');
  if (OLD_RPC) process.env.RPC_URL = OLD_RPC;
}

async function testInvalidAmount() {
  const result = await waitForFinality('not-a-number', '0xhash003', 'eip155:84532');
  assert(result.confirmed === true, 'invalid amount treated as low value (accepted)');
}

testLowValueAcceptedImmediately();
await testHighValueInDevMode();
await testInvalidAmount();

console.log(`\n${passed}/${total} finality tests passed`);
process.exit(passed === total ? 0 : 1);
