import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
test('built entrypoint starts over stdio without network discovery', async () => {
  const client = new Client({ name: 'stdio-test', version: '0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../dist/index.js', import.meta.url))], env: {
    GEMINI_PROXY_BASE_URL: 'https://proxy.example/v1', GEMINI_PROXY_API_KEY: 'mock-secret'
  } });
  try { await client.connect(transport); assert.equal((await client.listTools()).tools.length, 3); }
  finally { await client.close(); }
});
