import { checkCallerBinding } from '../../src/binding.js';

let passed = 0;
let total = 0;

function assert(condition: boolean, name: string) {
  total++;
  if (condition) { passed++; console.log(`  PASS  ${name}`); }
  else { console.log(`  FAIL  ${name}`); }
}

function testNoFacilitatorAddress() {
  console.log('\ncheckCallerBinding (no FACILITATOR_ADDRESS)');
  const result = checkCallerBinding({ some: 'data' }, {});
  assert(result.valid === true, 'skipped check when no FACILITATOR_ADDRESS set');
  assert(result.reason !== undefined, 'includes reason when binding check skipped');
}

function testCallerFieldPresent() {
  const OLD_ADDR = process.env.FACILITATOR_ADDRESS;
  process.env.FACILITATOR_ADDRESS = '0xFacilitatorAddress';
  const result = checkCallerBinding({ caller: '0xFacilitatorAddress' }, {});
  assert(result.valid === true, 'caller field matches facilitator address');
  process.env.FACILITATOR_ADDRESS = OLD_ADDR;
}

function testCallerFieldMismatch() {
  const OLD_ADDR = process.env.FACILITATOR_ADDRESS;
  process.env.FACILITATOR_ADDRESS = '0xFacilitatorAddress';
  const result = checkCallerBinding({ caller: '0xWrongAddress' }, {});
  assert(result.valid === false, 'caller mismatch is rejected');
  assert(result.reason !== undefined, 'includes reason for rejection');
  process.env.FACILITATOR_ADDRESS = OLD_ADDR;
}

function testPermit2Caller() {
  const OLD_ADDR = process.env.FACILITATOR_ADDRESS;
  process.env.FACILITATOR_ADDRESS = '0xFacilitatorAddress';
  const result = checkCallerBinding({
    permit2: { permitted: { caller: '0xFacilitatorAddress' } }
  }, {});
  assert(result.valid === true, 'Permit2 nested caller field is checked');
  process.env.FACILITATOR_ADDRESS = OLD_ADDR;
}

function testDomainVerifyingContract() {
  const OLD_ADDR = process.env.FACILITATOR_ADDRESS;
  process.env.FACILITATOR_ADDRESS = '0xFacilitatorAddress';
  const result = checkCallerBinding({
    domain: { verifyingContract: '0xFacilitatorAddress' }
  }, {});
  assert(result.valid === true, 'domain.verifyingContract is checked as caller binding');
  process.env.FACILITATOR_ADDRESS = OLD_ADDR;
}

function testTransferWithAuthorization() {
  const OLD_ADDR = process.env.FACILITATOR_ADDRESS;
  process.env.FACILITATOR_ADDRESS = '0xFacilitatorAddress';
  const result = checkCallerBinding({
    transferWithAuthorization: { authorized: '0xFacilitatorAddress' }
  }, {});
  assert(result.valid === true, 'transferWithAuthorization.authorized is checked');
  process.env.FACILITATOR_ADDRESS = OLD_ADDR;
}

testNoFacilitatorAddress();
testCallerFieldPresent();
testCallerFieldMismatch();
testPermit2Caller();
testDomainVerifyingContract();
testTransferWithAuthorization();

console.log(`\n${passed}/${total} binding tests passed`);
process.exit(passed === total ? 0 : 1);
