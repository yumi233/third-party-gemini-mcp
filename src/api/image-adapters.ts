import { ApiClient, ApiError } from './client.js';
import { array, record, SafeError } from '../utils/data.js';
import { decodeImage, imageUrl } from '../utils/image.js';
export type GeneratedImage = { type: 'image'; data: string; mimeType: string } | { type: 'url'; url: string };
export function parseImages(response: unknown): GeneratedImage[] {
  const result: GeneratedImage[] = [];
  const seen = new Set<string>();
  const add = (value: unknown, base64 = false) => {
    if (typeof value !== 'string' || seen.has(value)) return;
    seen.add(value);
    if (result.length >= 4) throw new SafeError('Provider returned too many images (maximum 4).');
    if (base64 || value.startsWith('data:')) result.push({ type: 'image', ...decodeImage(value) });
    else result.push({ type: 'url', url: imageUrl(value) });
  };
  for (const value of array(record(response).data)) {
    const item = record(value);
    if (item.b64_json) add(item.b64_json, true); else if (item.url) add(item.url);
  }
  const message = record(record(array(record(response).choices)[0]).message);
  for (const value of [...array(message.images), ...array(message.content)]) {
    const item = record(value);
    if (item.type === 'image_url' || item.image_url) add(typeof item.image_url === 'string' ? item.image_url : record(item.image_url).url);
    else if (item.type === 'image' && item.data) result.push({ type: 'image', ...decodeImage(String(item.data), typeof item.mimeType === 'string' ? item.mimeType : undefined) });
    else if (item.type === 'text' && typeof item.text === 'string') extractText(item.text, add);
  }
  if (typeof message.content === 'string') extractText(message.content, add);
  if (result.length > 4) throw new SafeError('Provider returned too many images (maximum 4).');
  if (!result.length) throw new SafeError('Provider returned no supported image. Select an explicit adapter or check proxy image support.');
  return result;
}
function extractText(text: string, add: (value: unknown) => void) {
  const trimmed = text.trim();
  if (/^(?:data:image\/|https?:\/\/)[^\s]*$/.test(trimmed)) { add(trimmed); return; }
  for (const match of text.matchAll(/!\[[^\]]*\]\((data:image\/[^\s)]+|https?:\/\/[^\s)]+)\)/g)) add(match[1]);
  for (const match of text.matchAll(/data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+/g)) add(match[0]);
}
export interface ImageProviderAdapter { generate(model: string, prompt: string): Promise<GeneratedImage[]> }
export class ChatCompletionsImageAdapter implements ImageProviderAdapter {
  constructor(private client: ApiClient) {}
  async generate(model: string, prompt: string) {
    return parseImages(await this.client.request('/chat/completions', { model, messages: [{ role: 'user', content: prompt }], modalities: ['text', 'image'] }));
  }
}
export class ImagesGenerationsAdapter implements ImageProviderAdapter {
  constructor(private client: ApiClient) {}
  async generate(model: string, prompt: string) {
    return parseImages(await this.client.request('/images/generations', { model, prompt, n: 1 }));
  }
}
export class AutoDetectAdapter implements ImageProviderAdapter {
  constructor(private client: ApiClient) {}
  async generate(model: string, prompt: string) {
    try { return await new ChatCompletionsImageAdapter(this.client).generate(model, prompt); }
    catch (error) {
      // Only definite endpoint absence permits another paid request.
      if (!(error instanceof ApiError) || ![404, 405, 501].includes(error.status)) throw error;
      return new ImagesGenerationsAdapter(this.client).generate(model, prompt);
    }
  }
}
