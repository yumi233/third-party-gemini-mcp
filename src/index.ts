#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { ApiClient } from './api/client.js';
import { loadConfig } from './config.js';
import { createServer } from './server.js';
try {
  const config = loadConfig();
  await createServer(new ApiClient(config)).connect(new StdioServerTransport());
} catch {
  process.stderr.write('Gemini MCP startup failed. Check GEMINI_PROXY_BASE_URL and GEMINI_PROXY_API_KEY and stdio access.\n');
  process.exitCode = 1;
}
