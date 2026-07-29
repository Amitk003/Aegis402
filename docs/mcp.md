# MCP (Model Context Protocol) Integration

Aegis402 can add payment gating to any MCP server without changing the server's code. When an AI agent calls a tool through Aegis402, the proxy intercepts the request, checks for payment, and forwards it to the MCP server only after payment is confirmed.

## How it works

AI agents use the Model Context Protocol to call tools on remote servers. Normally these calls are free. With Aegis402, each tool call requires a micro-payment in USDC.

```
AI Agent  -->  Aegis402 Proxy  -->  MCP Server
                   |
              (checks payment
               for tool being called)
```

## Per-Tool Pricing

You can set different prices for different tools using a `pricing.json` file in the project root:

```json
{
  "basePath": "/mcp",
  "defaultPrice": "0.05",
  "tools": {
    "search_web": { "price": "0.01", "description": "Search the web" },
    "generate_image": { "price": "0.25", "description": "Generate an image" },
    "analyze_document": { "price": "0.10", "description": "Analyze a document" },
    "execute_code": { "price": "0.50", "description": "Execute code" },
    "fetch_premium_data": { "price": "0.15", "description": "Access premium data" }
  }
}
```

Tools not listed in the config use the `defaultPrice`. You can change the config file path with the `MCP_CONFIG_PATH` environment variable.

## How Aegis402 Detects MCP Calls

Aegis402 looks for requests to paths containing `/mcp/tools/call` or `/mcp/tools/`. It extracts the tool name from either:

1. The JSON body: `{ "name": "tool_name", "arguments": {...} }`
2. Or the JSON-RPC body: `{ "method": "tools/call", "params": { "name": "tool_name" } }`
3. Or the URL path: `/mcp/tools/call/tool_name`

## Payment Flow for MCP

1. AI agent sends a tool call request to Aegis402
2. Aegis402 detects it as an MCP request and checks for a payment header
3. If no payment header, Aegis402 returns 402 with the tool-specific price
4. The AI agent signs a payment for the exact tool price and retries
5. Aegis402 verifies the payment, checks security mitigations, and forwards to the MCP server
6. The MCP server response is returned to the AI agent with a payment receipt

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_CONFIG_PATH` | `pricing.json` | Path to the per-tool pricing configuration |

## Client Integration

AI agents using the `@x402/fetch` or `@coinbase/cdp-sdk/x402` client libraries can automatically handle the 402 challenge. The client:

1. Receives the 402 response with tool-specific price
2. Signs a USDC payment for that amount
3. Retries the request with the payment signature
4. Gets the tool result

No custom integration code is needed if the client supports x402.
