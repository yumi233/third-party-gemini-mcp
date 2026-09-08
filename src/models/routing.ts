import type { Model } from './discovery.js';
import { SafeError } from '../utils/data.js';
export type Capability = 'text' | 'vision' | 'image';
export interface RoutingPolicy { imageFamilies: RegExp[] }
export const defaultPolicy: RoutingPolicy = { imageFamilies: [/gemini.*flash.*image/i, /gpt.*image/i] };
const imageName = (id: string) => /(?:image|imagen|dall-e)/i.test(id);
function supports(model: Model, capability: Capability): boolean {
  if (model.capabilities) return model.capabilities.includes(capability);
  if (capability === 'image') return imageName(model.id);
  if (capability === 'text') return /gemini.*flash/i.test(model.id) && !/image|audio|tts|embedding/i.test(model.id);
  return /gemini/i.test(model.id) && !/image|audio|tts|embedding/i.test(model.id) || /vision/i.test(model.id);
}
function version(id: string): number[] { return (id.match(/\d+(?:\.\d+)*/)?.[0] ?? '0').split('.').map(Number); }
export function selectModel(models: Model[], capability: Capability, policy = defaultPolicy): Model {
  const candidates = models.filter(m => supports(m, capability) && (capability !== 'text' || /gemini.*flash/i.test(m.id)));
  const family = (m: Model) => {
    if (capability === 'image') { const i = policy.imageFamilies.findIndex(re => re.test(m.id)); return i < 0 ? policy.imageFamilies.length : i; }
    return /gemini.*flash/i.test(m.id) ? 0 : 1;
  };
  candidates.sort((a, b) => {
    const metadata = Number(Boolean(b.capabilities)) - Number(Boolean(a.capabilities));
    if (metadata) return metadata;
    const rank = family(a) - family(b);
    if (rank) return rank;
    const av = version(a.id), bv = version(b.id);
    for (let i = 0; i < Math.max(av.length, bv.length); i++) {
      const diff = (bv[i] ?? 0) - (av[i] ?? 0); if (diff) return diff;
    }
    return Number(/lite/i.test(a.id)) - Number(/lite/i.test(b.id)) || a.id.localeCompare(b.id);
  });
  if (!candidates.length) throw new SafeError(`No compatible ${capability} model discovered.`);
  return candidates[0];
}
