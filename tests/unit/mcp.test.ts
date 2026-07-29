import { isMcpRequest, getToolName, getToolPrice, getToolDescription, loadMcpConfig } from '../../src/mcp.js';
import type { FastifyRequest } from 'fastify';

let passed = 0;
let total = 0;

function assert(condition: boolean, name: string) {
  total++;
  if (condition) { passed++; console.log(`  PASS  ${name}`); }
  else { console.log(`  FAIL  ${name}`); }
}

function makeRequest(url: string, body?: unknown): FastifyRequest {
  return {
    url,
    method: 'POST',
    body,
    headers: {},
    ip: '127.0.0.1'
  } as unknown as FastifyRequest;
}

function testIsMcpRequest() {
  console.log('\nisMcpRequest');
  assert(isMcpRequest(makeRequest('/mcp/tools/call')) === true, 'detects /mcp/tools/call path');
  assert(isMcpRequest(makeRequest('/mcp/tools/list')) === true, 'detects /mcp/tools/ path');
  assert(isMcpRequest(makeRequest('/api/data')) === false, 'non-MCP path returns false');
  assert(isMcpRequest(makeRequest('/health')) === false, '/health is not MCP');
}

function testGetToolNameFromBody() {
  console.log('\ngetToolName');
  const req = makeRequest('/mcp/tools/call', { name: 'search_web', arguments: { query: 'test' } });
  assert(getToolName(req) === 'search_web', 'extracts tool name from body.name');
}

function testGetToolNameFromJsonRpc() {
  const req = makeRequest('/mcp/tools/call', { method: 'tools/call', params: { name: 'generate_image' } });
  assert(getToolName(req) === 'generate_image', 'extracts tool name from JSON-RPC params.name');
}

function testGetToolNameFromUrl() {
  const req = makeRequest('/mcp/tools/call/analyze_document', {});
  assert(getToolName(req) === 'analyze_document', 'extracts tool name from URL path');
}

function testGetToolNameNoTool() {
  const req = makeRequest('/api/data', {});
  assert(getToolName(req) === undefined, 'returns undefined for non-MCP request');
}

function testGetToolPriceDefault() {
  const price = getToolPrice('unknown_tool');
  assert(price === '0.05', 'returns default price for unknown tool');
}

function testGetToolPriceConfigLoaded() {
  console.log('\ngetToolPrice with config');
  loadMcpConfig();
  const price = getToolPrice('search_web');
  assert(price === '0.01', 'uses configured price for known tool');
}

testIsMcpRequest();
testGetToolNameFromBody();
testGetToolNameFromJsonRpc();
testGetToolNameFromUrl();
testGetToolNameNoTool();
testGetToolPriceDefault();
testGetToolPriceConfigLoaded();

console.log(`\n${passed}/${total} mcp tests passed`);
process.exit(passed === total ? 0 : 1);
