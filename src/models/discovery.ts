import type { ApiClient } from '../api/client.js';
import { array, record, SafeError } from '../utils/data.js';

export interface Model { id: string; capabilities?: string[] }
export function parseModels(response: unknown): Model[] {
  const rows = record(response).data;
  if (!Array.isArray(rows)) throw new SafeError('Invalid /models response: expected a data array.');
  const found = new Map<string, Model>();
  for (const row of rows) {
    const item = record(row);
    if (typeof item.id !== 'string' || !item.id.trim() || item.id.length > 256) continue;
    const capabilities = Array.isArray(item.capabilities)
      ? array(item.capabilities).filter((v): v is string => typeof v === 'string') : undefined;
    found.set(item.id, { id: item.id, capabilities });
  }
  if (!found.size) throw new SafeError('Proxy returned no usable models.');
  return [...found.values()];
}
export class ModelDiscovery {
  private cache?: { models: Model[]; expires: number };
  private pending?: Promise<Model[]>;
  constructor(private readonly client: ApiClient, private readonly ttlMs = 300_000) {}
  async get(): Promise<Model[]> {
    if (this.cache && this.cache.expires > Date.now()) return this.cache.models;
    if (!this.pending) this.pending = this.client.request('/models').then(parseModels).then(models => {
      this.cache = { models, expires: Date.now() + this.ttlMs }; return models;
    }).finally(() => { this.pending = undefined; });
    return this.pending;
  }
}
