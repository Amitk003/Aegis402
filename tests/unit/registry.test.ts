import { checkEndpoint, registerEndpoint, clearRegistry, getRegisteredEndpoints } from '../../src/registry.js';

let passed = 0;
let total = 0;

function assert(condition: boolean, name: string) {
  total++;
  if (condition) { passed++; console.log(`  PASS  ${name}`); }
  else { console.log(`  FAIL  ${name}`); }
}

function testLocalhostAllowed() {
  console.log('\ncheckEndpoint');
  const result = checkEndpoint('http://localhost:8080');
  assert(result.valid === true, 'localhost is allowed in dev mode');
}

function testUnregisteredNonStrict() {
  const OLD_STRICT = process.env.REGISTRY_STRICT;
  delete process.env.REGISTRY_STRICT;
  const result = checkEndpoint('https://api.example.com');
  assert(result.valid === true, 'unregistered endpoint allowed when non-strict');
  assert(result.reason !== undefined, 'includes warning for unregistered endpoint');
  if (OLD_STRICT) process.env.REGISTRY_STRICT = OLD_STRICT;
}

function testUnregisteredStrict() {
  const OLD_STRICT = process.env.REGISTRY_STRICT;
  process.env.REGISTRY_STRICT = 'true';
  const result = checkEndpoint('https://api.example.com');
  assert(result.valid === false, 'unregistered endpoint blocked in strict mode');
  assert(result.reason !== undefined, 'includes reason for block');
  if (OLD_STRICT) process.env.REGISTRY_STRICT = OLD_STRICT;
}

function testRegisteredEndpoint() {
  const OLD_STRICT = process.env.REGISTRY_STRICT;
  process.env.REGISTRY_STRICT = 'true';
  registerEndpoint('api.example.com', '0xPublicKey', '0x' + 'ab'.repeat(65));
  const result = checkEndpoint('https://api.example.com/path');
  assert(result.valid === true, 'registered endpoint allowed in strict mode');
  process.env.REGISTRY_STRICT = OLD_STRICT;
}

function testInvalidUrl() {
  const result = checkEndpoint('');
  assert(result.valid === false, 'invalid URL is rejected');
}

function testGetRegisteredEndpoints() {
  clearRegistry();
  registerEndpoint('a.com', 'key1', '0x' + 'ab'.repeat(65));
  registerEndpoint('b.com', 'key2', '0x' + 'cd'.repeat(65));
  const endpoints = getRegisteredEndpoints();
  assert(endpoints.length === 2, 'getRegisteredEndpoints returns all entries');
  assert(endpoints.includes('a.com'), 'includes first registered endpoint');
  assert(endpoints.includes('b.com'), 'includes second registered endpoint');
}

testLocalhostAllowed();
testUnregisteredNonStrict();
testUnregisteredStrict();
testRegisteredEndpoint();
testInvalidUrl();
testGetRegisteredEndpoints();

console.log(`\n${passed}/${total} registry tests passed`);
process.exit(passed === total ? 0 : 1);
