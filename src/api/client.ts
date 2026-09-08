import type { Config } from '../config.js';
import { SafeError } from '../utils/data.js';

export class ApiError extends SafeError {
  constructor(public readonly status: number) {
    const hint = status === 401 || status === 403 ? 'Check proxy credentials and permissions.'
      : status === 404 ? 'Check base URL and endpoint support.'
      : status === 429 ? 'Proxy rate limit reached.' : 'Proxy request failed.';
    super(`Provider HTTP ${status}. ${hint}`);
  }
}
export interface ClientOptions { timeoutMs?: number; maxResponseBytes?: number; retries?: number; retryDelayMs?: number; fetch?: typeof fetch }
export class ApiClient {
  constructor(private readonly config: Config, private readonly options: ClientOptions = {}) {}
  redact(text: string): string { return text.split(this.config.apiKey).join('[REDACTED]'); }
  private redactValue(value: unknown): unknown {
    if (typeof value === 'string') return this.redact(value);
    if (Array.isArray(value)) return value.map(item => this.redactValue(item));
    if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [this.redact(key), this.redactValue(item)]));
    return value;
  }
  async request(endpoint: '/models' | '/chat/completions' | '/images/generations', payload?: unknown): Promise<unknown> {
    // Only discovery retries automatically. Repeating generation can duplicate billing.
    const retries = payload === undefined ? (this.options.retries ?? 2) : 0;
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 60_000);
      try {
        const response = await (this.options.fetch ?? fetch)(this.config.baseUrl + endpoint, {
          method: payload === undefined ? 'GET' : 'POST', redirect: 'error', signal: controller.signal,
          headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
          body: payload === undefined ? undefined : JSON.stringify(payload)
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new ApiError(response.status);
        }
        const limit = this.options.maxResponseBytes ?? 24 * 1024 * 1024;
        if (Number(response.headers.get('content-length')) > limit) {
          await response.body?.cancel();
          throw new SafeError('Provider response exceeds size limit.');
        }
        const reader = response.body?.getReader();
        if (!reader) throw new SafeError('Provider returned an empty response.');
        const chunks: Uint8Array[] = [];
        let length = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length > limit) { await reader.cancel(); throw new SafeError('Provider response exceeds size limit.'); }
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
        try { return this.redactValue(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown); }
        catch { throw new SafeError('Provider returned invalid JSON.'); }
      } catch (error) {
        if (error instanceof ApiError && [429, 500, 502, 503, 504].includes(error.status) && attempt < retries) {
          clearTimeout(timer);
          await new Promise(resolve => setTimeout(resolve, (this.options.retryDelayMs ?? 300) * 2 ** attempt));
          continue;
        }
        if (error instanceof SafeError) throw error;
        throw new SafeError(controller.signal.aborted ? 'Provider request timed out.' : 'Provider network request failed. Check connectivity.');
      } finally { clearTimeout(timer); }
    }
  }
}
