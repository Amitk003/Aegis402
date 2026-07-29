// Minimal MCP test server for end-to-end demo
// Runs on port 8080 (default UPSTREAM_URL)
// Implements Model Context Protocol over HTTP

import http from 'http';

const PORT = Number(process.env.MCP_PORT) || 8080;

const tools = [
  {
    name: 'fetch_premium_data',
    description: 'Fetch premium market data for analysis',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Market symbol (e.g. BTC-USD)' },
        timeframe: { type: 'string', enum: ['1d', '1w', '1m'], default: '1d' }
      },
      required: ['symbol']
    }
  },
  {
    name: 'generate_report',
    description: 'Generate an AI-powered analysis report',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Report topic' },
        format: { type: 'string', enum: ['summary', 'detailed', 'presentation'], default: 'detailed' }
      },
      required: ['topic']
    }
  },
  {
    name: 'search_web',
    description: 'Search the web for recent information',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', default: 5 }
      },
      required: ['query']
    }
  }
];

function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  let body = '';

  req.on('data', (chunk: Buffer) => body += chunk.toString());

  req.on('end', () => {
    res.setHeader('content-type', 'application/json');

    // MCP JSON-RPC endpoint
    if (path === '/mcp' || path === '/mcp/') {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      try {
        const rpc = JSON.parse(body);

        if (rpc.method === 'tools/list') {
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id: rpc.id,
            result: { tools }
          }));
          return;
        }

        if (rpc.method === 'tools/call') {
          const toolName = rpc.params?.name;
          const args = rpc.params?.arguments || {};
          const tool = tools.find(t => t.name === toolName);

          if (!tool) {
            res.statusCode = 404;
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              id: rpc.id,
              error: { code: -32602, message: `Unknown tool: ${toolName}` }
            }));
            return;
          }

          const result = executeTool(toolName, args);
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id: rpc.id,
            result: {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
              isError: false
            }
          }));
          return;
        }

        res.statusCode = 400;
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: rpc.id || null,
          error: { code: -32601, message: `Method not found: ${rpc.method}` }
        }));
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Invalid JSON-RPC request' }));
      }
      return;
    }

    // MCP tools/call via REST-style (for proxy detection)
    if (path.startsWith('/mcp/tools/call/')) {
      const toolName = path.replace('/mcp/tools/call/', '');
      const tool = tools.find(t => t.name === toolName);
      if (!tool) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: `Unknown tool: ${toolName}` }));
        return;
      }
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(body); } catch { /* use defaults */ }
      const result = executeTool(toolName, args);
      res.end(JSON.stringify({
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: false
      }));
      return;
    }

    // Health check
    if (path === '/health' || path === '/') {
      res.end(JSON.stringify({ status: 'ok', server: 'mcp-demo', tools: tools.map(t => t.name) }));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  });
}

function executeTool(name: string, args: Record<string, unknown>): Record<string, unknown> {
  const timestamp = new Date().toISOString();

  switch (name) {
    case 'fetch_premium_data':
      return {
        tool: name,
        symbol: args.symbol || 'UNKNOWN',
        price: (Math.random() * 50000 + 10000).toFixed(2),
        volume: Math.floor(Math.random() * 1000000),
        change: (Math.random() * 10 - 5).toFixed(2) + '%',
        timestamp,
        source: 'premium-market-data-feed'
      };

    case 'generate_report':
      return {
        tool: name,
        topic: args.topic || 'General',
        format: args.format || 'detailed',
        report: `AI-generated analysis report on "${args.topic || 'General'}".\n\n` +
          'Executive Summary:\n' +
          '- Market trend: Bullish\n' +
          '- Key insights: [redacted for premium]\n' +
          '- Recommendations: Further analysis required\n\n' +
          'Full report available upon additional payment.',
        timestamp
      };

    case 'search_web':
      return {
        tool: name,
        query: args.query || '',
        results: [
          { title: `Result 1 for ${args.query}`, url: `https://example.com/1`, snippet: 'Premium search result...' },
          { title: `Result 2 for ${args.query}`, url: `https://example.com/2`, snippet: 'Another premium result...' }
        ],
        totalResults: 2,
        timestamp
      };

    default:
      return { tool: name, result: 'Executed successfully', timestamp };
  }
}

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`MCP demo server running on http://localhost:${PORT}`);
  console.log(`Tools: ${tools.map(t => t.name).join(', ')}`);
});
