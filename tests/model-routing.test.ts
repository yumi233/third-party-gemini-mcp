import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { parseModels, ModelDiscovery } from '../src/models/discovery.js';
import { selectModel } from '../src/models/routing.js';
import { mockClient } from './helpers.js';
test('configuration is environment-only, requires both values and validates URL', () => {
  assert.throws(() => loadConfig({}));
  assert.throws(() => loadConfig({ GEMINI_PROXY_BASE_URL: 'https://proxy.example' }));
  for (const url of ['file:///tmp', 'https://user:password@proxy.example', 'https://proxy.example?key=secret', 'broken'])
    assert.throws(() => loadConfig({ GEMINI_PROXY_BASE_URL: url, GEMINI_PROXY_API_KEY: 'mock' }));
  assert.deepEqual(loadConfig({ GEMINI_PROXY_BASE_URL: 'https://proxy.example/v1/', GEMINI_PROXY_API_KEY: 'mock' }), { baseUrl: 'https://proxy.example/v1', apiKey: 'mock' });
});
test('model parser validates shape, deduplicates and rejects empty lists', () => {
  for (const data of [null, {}, [], { data: [] }, { data: [null, { id: 42 }] }]) assert.throws(() => parseModels(data));
  assert.deepEqual(parseModels({ data: [{ id: 'model' }, { id: 'model' }, null] }), [{ id: 'model', capabilities: undefined }]);
});
test('Flash routing advances numerically and excludes image/audio models', () => {
  const models = ['gemini-3.9-flash', 'gemini-3.10-flash-lite', 'gemini-3.10-flash', 'gemini-7-flash-image', 'gemini-9-flash-audio'].map(id => ({ id }));
  assert.equal(selectModel(models, 'text').id, 'gemini-3.10-flash');
  assert.equal(selectModel([...models, { id: 'gemini-4-flash' }], 'text').id, 'gemini-4-flash');
  assert.throws(() => selectModel([{ id: 'other' }], 'text'));
});
test('vision metadata overrides naming heuristics; image models are not assumed vision models', () => {
  assert.equal(selectModel([{ id: 'gemini-4-flash' }, { id: 'custom', capabilities: ['vision'] }], 'vision').id, 'custom');
  assert.throws(() => selectModel([{ id: 'gemini-4-flash', capabilities: ['text'] }, { id: 'gemini-4-flash-image' }], 'vision'));
});
test('image routing policy is replaceable without fixed version IDs', () => {
  const models = [{ id: 'gemini-4-flash-image' }, { id: 'gpt-image-3' }];
  assert.equal(selectModel(models, 'image').id, 'gemini-4-flash-image');
  assert.equal(selectModel(models, 'image', { imageFamilies: [/gpt/i, /gemini/i] }).id, 'gpt-image-3');
  assert.throws(() => selectModel([], 'image'));
});
test('discovery shares concurrent requests, caches and expires', async () => {
  let count = 0;
  const client = mockClient(() => { count++; return { data: [{ id: 'gemini-flash' }] }; });
  const discovery = new ModelDiscovery(client);
  await Promise.all([discovery.get(), discovery.get()]); await discovery.get(); assert.equal(count, 1);
  const uncached = new ModelDiscovery(client, 0);
  await uncached.get(); await uncached.get(); assert.equal(count, 3);
});
