import type { ApiClient } from '../api/client.js';
import type { ModelDiscovery } from '../models/discovery.js';
import { selectModel, type RoutingPolicy } from '../models/routing.js';
import { AutoDetectAdapter, ChatCompletionsImageAdapter, ImagesGenerationsAdapter } from '../api/image-adapters.js';
export async function generateImage(client: ApiClient, discovery: ModelDiscovery, input: { prompt: string; adapter: 'auto' | 'chat' | 'images' }, policy?: RoutingPolicy) {
  const model = selectModel(await discovery.get(), 'image', policy).id;
  const Adapter = input.adapter === 'chat' ? ChatCompletionsImageAdapter : input.adapter === 'images' ? ImagesGenerationsAdapter : AutoDetectAdapter;
  return { model, images: await new Adapter(client).generate(model, input.prompt) };
}
