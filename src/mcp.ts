// MCP (Model Context Protocol) integration
// Routes AI tool calls through Aegis402 payment gating

import { readFileSync, existsSync } from 'node:fs';
import { createChallenge } from './x402.js';
import type { FastifyRequest } from 'fastify';

interface McpToolPricing {
  [toolName: string]: {
    price: string;
    description?: string;
  };
}

interface McpRouteConfig {
  basePath: string;
  tools: McpToolPricing;
  defaultPrice: string;
}

let config: McpRouteConfig = {
  basePath: '/mcp',
  tools: {},
  defaultPrice: process.env.PRICE || '0.05'
};

/**
 * Load MCP pricing configuration from a JSON file.
 * Expected format:
 * {
 *   "tools": {
 *     "generate_report": { "price": "0.10", "description": "Generate AI report" },
 *     "analyze_data": { "price": "0.25" }
 *   },
 *   "defaultPrice": "0.05"
 * }
 */
export function loadMcpConfig(configPath?: string): void {
  const path = configPath || process.env.MCP_CONFIG_PATH || 'pricing.json';

  if (!existsSync(path)) {
    console.log('MCP: No pricing config found at', path, '. Using default pricing.');
    return;
  }

  try {
    const data = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(data);
    config = {
      basePath: parsed.basePath || config.basePath,
      tools: parsed.tools || {},
      defaultPrice: parsed.defaultPrice || config.defaultPrice
    };
    console.log('MCP: Loaded pricing for', Object.keys(config.tools).length, 'tools');
  } catch (err) {
    console.log('MCP: Failed to load pricing config:', (err as Error).message);
  }
}

/**
 * Check if a request is an MCP tool call.
 */
export function isMcpRequest(request: FastifyRequest): boolean {
  const url = request.url.toLowerCase();
  return url.includes('/mcp/tools/call') || url.includes('/mcp/tools/');
}

/**
 * Get the tool name from an MCP request body or URL.
 */
export function getToolName(request: FastifyRequest): string | undefined {
  // Try to extract from request body
  if (request.body) {
    try {
      const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
      if (body.name && typeof body.name === 'string') {
        return body.name;
      }
      if (body.method === 'tools/call' && body.params?.name) {
        return body.params.name;
      }
    } catch {
      // Not JSON
    }
  }

  // Try to extract from URL path
  const url = request.url;
  const match = url.match(/\/tools\/call\/([^/]+)/);
  if (match) return match[1];

  return undefined;
}

/**
 * Get the price for a specific MCP tool.
 * Falls back to default price if tool is not configured.
 */
export function getToolPrice(toolName: string): string {
  if (config.tools[toolName]) {
    return config.tools[toolName].price;
  }
  return config.defaultPrice;
}

/**
 * Get the description for a specific MCP tool.
 */
export function getToolDescription(toolName: string): string {
  const tool = config.tools[toolName];
  if (tool && tool.description) {
    return tool.description;
  }
  return `MCP tool: ${toolName}`;
}

/**
 * Create a payment challenge specific to an MCP tool.
 * Includes the tool name and description in the challenge.
 */
export function createMcpChallenge(toolName: string) {
  const price = getToolPrice(toolName);
  const description = getToolDescription(toolName);

  const baseChallenge = createChallenge();

  // Override the price with the tool-specific price
  const challengeBody = baseChallenge.body;
  const firstAccept = challengeBody.accepts[0];
  if (firstAccept) {
    firstAccept.amount = price;
    firstAccept.extra = { tool: toolName, description };
  }

  const base64Challenge = Buffer.from(JSON.stringify(challengeBody)).toString('base64');

  return {
    headers: {
      'payment-required': base64Challenge,
      'cache-control': 'private, no-cache, no-store, must-revalidate'
    },
    body: challengeBody
  };
}

/**
 * Get all configured tool names and prices.
 */
export function getMcpPricing(): Record<string, { price: string; description?: string }> {
  return { ...config.tools };
}

export { config as mcpConfig };
