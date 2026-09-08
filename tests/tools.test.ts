import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { createServer, visionSchema } from '../src/server.js';
import { ModelDiscovery } from '../src/models/discovery.js';
import { flash, flashSchema } from '../src/tools/flash.js';
import { vision } from '../src/tools/vision.js';
import { AutoDetectAdapter, parseImages } from '../src/api/image-adapters.js';
import { localImage, decodeImage, imageUrl } from '../src/utils/image.js';
import { Workspace } from '../src/tools/workspace.js';
import { completion, mockClient, png } from './helpers.js';

test('real MCP handshake, three tools, text/vision/image calls and validation', async () => {
  const api = mockClient((url, body) => url.endsWith('/models') ? { data: [{ id: 'gemini-flash' }, { id: 'gemini-flash-image' }] }
    : body.modalities ? completion(`data:image/png;base64,${png}`) : completion('OK'));
  const server = createServer(api), client = new Client({ name: 'test', version: '0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(a); await client.connect(b);
    assert.deepEqual((await client.listTools()).tools.map(t => t.name).sort(), ['gemini_flash', 'gemini_vision', 'image_generate']);
    assert.equal((await client.callTool({ name: 'gemini_flash', arguments: { task: 'Hello' } })).isError, false);
    assert.ok(!(await client.callTool({ name: 'gemini_vision', arguments: { prompt: 'Describe', images: [{ url: 'https://images.example/a.png' }] } })).isError);
    assert.match(JSON.stringify(await client.callTool({ name: 'image_generate', arguments: { prompt: 'A chair' } })), /image\/png/);
    const bad = await client.callTool({ name: 'gemini_flash', arguments: { task: '' } }); assert.equal(bad.isError, true);
  } finally { await client.close(); await server.close(); }
});
test('image adapters accept base64, URL, multimodal content and markdown', () => {
  for (const response of [{ data: [{ b64_json: png }] }, completion(`data:image/png;base64,${png}`), completion([{ type: 'image_url', image_url: { url: `data:image/png;base64,${png}` } }]), completion(`![image](data:image/png;base64,${png})`)])
    assert.equal(parseImages(response)[0].type, 'image');
  assert.deepEqual(parseImages({ data: [{ url: 'https://images.example/a.png' }] }), [{ type: 'url', url: 'https://images.example/a.png' }]);
  for (const response of [null, {}, completion('no image'), { data: [{ url: 'file:///secret' }] }]) assert.throws(() => parseImages(response));
  assert.throws(() => decodeImage('not an image')); assert.throws(() => imageUrl('https://user:pass@images.example'));
});
test('auto adapter falls back only for explicit unsupported endpoint errors', async () => {
  const calls: string[] = [];
  const client = mockClient(url => { calls.push(url); return url.endsWith('/chat/completions') ? new Response('', { status: 404 }) : { data: [{ b64_json: png }] }; });
  await new AutoDetectAdapter(client).generate('image-model', 'chair'); assert.equal(calls.length, 2);
  for (const response of [new Response('', { status: 500 }), completion('no image')]) {
    let count = 0;
    await assert.rejects(new AutoDetectAdapter(mockClient(() => { count++; return response; })).generate('image-model', 'chair'));
    assert.equal(count, 1);
  }
});
test('local images validate format, size, paths and explicit vision inputs', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-image-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'sample.png'); await fs.writeFile(file, Buffer.from(png, 'base64'));
  assert.equal(await localImage(file), `data:image/png;base64,${png}`);
  const linked = path.join(root, 'linked.png'); await fs.link(file, linked);
  await assert.rejects(localImage(linked), /regular file/); await fs.unlink(linked);
  await assert.rejects(localImage(root)); await assert.rejects(localImage('relative.png'));
  await fs.writeFile(path.join(root, 'secret.txt'), 'secret'); await assert.rejects(localImage(path.join(root, 'secret.txt')), /Unsupported/);
  const big = path.join(root, 'big.png'); await fs.writeFile(big, Buffer.alloc(8 * 1024 * 1024 + 1)); await assert.rejects(localImage(big), /8 MiB/);
  assert.equal(visionSchema.safeParse({ prompt: 'x', images: [{}] }).success, false);
  const client = mockClient((url, body) => {
    if (url.endsWith('/models')) return { data: [{ id: 'gemini-flash' }] };
    assert.match(JSON.stringify(body), /data:image\/png;base64/); return completion('a pixel');
  });
  assert.equal((await vision(client, new ModelDiscovery(client), { prompt: 'describe', images: [{ path: file }] })).text, 'a pixel');
});
test('workspace denies traversal, protected files, hardlinks and unapproved writes', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-workspace-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'sample.txt'), 'before');
  const workspace = new Workspace(root, [], ['sample.txt']);
  await workspace.applyPatch({ path: 'sample.txt', old_text: 'before', new_text: '$&after' });
  assert.equal(await fs.readFile(path.join(root, 'sample.txt'), 'utf8'), '$&after');
  for (const name of ['../outside', '.env', '.git/config', 'a:stream', 'sample.txt.', 'credentials.json'])
    await assert.rejects(new Workspace(root, [name]).readFiles([name]));
  await assert.rejects(new Workspace(root, ['sample.txt']).applyPatch({ path: 'sample.txt', old_text: '$&after', new_text: 'x' }));
  await fs.link(path.join(root, 'sample.txt'), path.join(root, 'linked.txt'));
  await assert.rejects(new Workspace(root, ['linked.txt']).readFiles(['linked.txt']));
});
test('worker executes only allowed exact edits and reports partial failure', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-worker-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'sample.txt'), 'before'); let count = 0;
  const client = mockClient(url => {
    if (url.endsWith('/models')) return { data: [{ id: 'gemini-flash' }] };
    if (count++) return new Response('', { status: 500 });
    return { choices: [{ message: { role: 'assistant', tool_calls: [
      { id: '1', function: { name: 'apply_patch', arguments: JSON.stringify({ path: 'sample.txt', old_text: 'before', new_text: 'after' }) } },
      { id: '2', function: { name: 'shell', arguments: '{}' } }
    ] } }] };
  });
  const result = await flash(client, new ModelDiscovery(client), flashSchema.parse({ task: 'edit', workspace_root: root, write_files: ['sample.txt'] }));
  assert.equal(result.incomplete, true); assert.match(result.summary, /Partial edits/);
  assert.deepEqual(result.audit, [{ tool: 'apply_patch', ok: true }, { tool: 'denied', ok: false }]);
  assert.equal(await fs.readFile(path.join(root, 'sample.txt'), 'utf8'), 'after');
});
