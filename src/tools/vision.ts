import type { ApiClient } from '../api/client.js';
import type { ModelDiscovery } from '../models/discovery.js';
import { selectModel } from '../models/routing.js';
import { imageUrl, localImage } from '../utils/image.js';
import { chatText } from './flash.js';
export async function vision(client: ApiClient, discovery: ModelDiscovery, input: { prompt: string; images: { path?: string; url?: string }[] }) {
  const model = selectModel(await discovery.get(), 'vision').id;
  const content: unknown[] = [{ type: 'text', text: input.prompt }];
  for (const image of input.images) content.push({ type: 'image_url', image_url: { url: image.path ? await localImage(image.path) : imageUrl(image.url!) } });
  const response = await client.request('/chat/completions', { model, messages: [{ role: 'user', content }] });
  return { model, text: chatText(response) };
}
