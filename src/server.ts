import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import { ApiClient } from './api/client.js';
import { ModelDiscovery } from './models/discovery.js';
import { flash, flashSchema } from './tools/flash.js';
import { vision } from './tools/vision.js';
import { generateImage } from './tools/image.js';
import { safeMessage } from './utils/data.js';
export const visionSchema = z.object({
  prompt: z.string().min(1).max(32000),
  images: z.array(z.object({ path: z.string().min(1).max(4096).optional(), url: z.url().max(8192).optional() }).strict()
    .refine(value => Boolean(value.path) !== Boolean(value.url), 'Supply exactly one path or URL.')).min(1).max(4)
}).strict();
export const imageSchema = z.object({ prompt: z.string().min(1).max(32000), adapter: z.enum(['auto', 'chat', 'images']).default('auto') }).strict();
const text = (value: unknown) => ({ type: 'text' as const, text: JSON.stringify(value) });
const failure = (error: unknown) => ({ isError: true, content: [text({ error: safeMessage(error) })] });
export function createServer(client: ApiClient) {
  const server = new McpServer({ name: 'gemini-proxy-mcp', version: '0.1.0' });
  const discovery = new ModelDiscovery(client);
  server.registerTool('gemini_flash', {
    description: 'Gemini Flash text, code and document tasks. Optional file reads and exact edits require explicit workspace_root and relative file allowlists. No shell execution. File writes may be partial on failure.',
    inputSchema: flashSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
  }, async input => {
    try { const result = await flash(client, discovery, input); return { content: [text(result)], isError: result.incomplete }; }
    catch (error) { return failure(error); }
  });
  server.registerTool('gemini_vision', {
    description: 'Analyze or compare up to four images. Explicit local image paths are read and sent to the configured proxy; URLs are passed to the proxy without local fetching.',
    inputSchema: visionSchema, annotations: { readOnlyHint: true, openWorldHint: true }
  }, async input => {
    try { return { content: [text(await vision(client, discovery, input))] }; } catch (error) { return failure(error); }
  });
  server.registerTool('image_generate', {
    description: 'Generate an image using a dynamically discovered image model. Choose auto, chat or images adapter. Can incur provider charges. URL results are returned without downloading.',
    inputSchema: imageSchema, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  }, async input => {
    try {
      const result = await generateImage(client, discovery, input);
      return { content: [text({ model: result.model }), ...result.images.map(image => image.type === 'image' ? image : text({ image_url: image.url }))] };
    } catch (error) { return failure(error); }
  });
  return server;
}
