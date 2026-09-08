import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from '../src/api/client.js';
import { config, mockClient } from './helpers.js';
for (const status of [401, 403, 404, 429, 500]) test(`HTTP ${status} is safe and readable`, async () => {
  const client = mockClient(() => new Response(`Authorization: Bearer ${config.apiKey}`, { status }));
  await assert.rejects(client.request('/models'), error => {
    assert.match(String(error), new RegExp(`HTTP ${status}`)); assert.ok(!String(error).includes(config.apiKey)); return true;
  });
});
test('invalid JSON and abnormal response shapes are handled without provider body exposure', async () => {
  await assert.rejects(mockClient(() => new Response(config.apiKey)).request('/models'), /invalid JSON/);
  assert.equal(await mockClient(() => null).request('/models'), null);
});
test('request timeout includes response body consumption', async () => {
  const client = new ApiClient(config, { timeoutMs: 10, fetch: async (_url, init) => new Response(new ReadableStream({
    start(controller) { init?.signal?.addEventListener('abort', () => controller.error(new Error(config.apiKey)), { once: true }); }
  })) });
  await assert.rejects(client.request('/models'), /timed out/);
});
test('network errors and echoed keys never expose credentials', async () => {
  const client = new ApiClient(config, { fetch: async () => { throw new Error(config.apiKey); } });
  await assert.rejects(client.request('/models'), error => !String(error).includes(config.apiKey));
  assert.deepEqual(await mockClient(() => ({ text: config.apiKey })).request('/models'), { text: '[REDACTED]' });
});
test('response limits reject both declared and streamed oversize payloads', async () => {
  for (const headers of [{}, { 'content-length': '1000' }]) {
    const client = mockClient(() => new Response('x'.repeat(100), { headers }), { maxResponseBytes: 10 });
    await assert.rejects(client.request('/models'), /size limit/);
  }
});
test('JSON-escaped credential echoes are redacted after parsing', async () => {
  const escaped = config.apiKey.split('').map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  const client = mockClient(() => new Response('{"text":"' + escaped + '"}'));
  assert.deepEqual(await client.request('/models'), { text: '[REDACTED]' });
});
test('transient discovery errors retry; generation errors never duplicate paid requests', async () => {
  let count = 0;
  const client = mockClient(() => ++count < 3 ? new Response('', { status: 503 }) : { data: [] }, { retries: 2, retryDelayMs: 1 });
  await client.request('/models'); assert.equal(count, 3);
  count = 0;
  await assert.rejects(client.request('/chat/completions', {}), /503/); assert.equal(count, 1);
});
test('HTTP requests use exact base path and reject redirects', async () => {
  const client = new ApiClient(config, { fetch: async (url, init) => {
    assert.equal(url, 'https://proxy.example/v1/models'); assert.equal(init?.redirect, 'error');
    assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${config.apiKey}`);
    return Response.json({ data: [] });
  } });
  await client.request('/models');
});
