import { ApiClient, type ClientOptions } from '../src/api/client.js';
export const config = { baseUrl: 'https://proxy.example/v1', apiKey: 'mock-secret-for-tests' };
export const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5S8AAAAASUVORK5CYII=';
export const completion = (content: unknown) => ({ choices: [{ message: { role: 'assistant', content } }] });
export function mockClient(handler: (url: string, body: Record<string, unknown>) => unknown, options: ClientOptions = {}) {
  return new ApiClient(config, { retries: 0, ...options, fetch: async (url, init) => {
    const result = handler(String(url), JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
    return result instanceof Response ? result : Response.json(result);
  } });
}
