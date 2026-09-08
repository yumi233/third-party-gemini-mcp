export interface Config { baseUrl: string; apiKey: string }

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const base = env.GEMINI_PROXY_BASE_URL?.trim();
  const apiKey = env.GEMINI_PROXY_API_KEY?.trim();
  if (!base || !apiKey) throw new Error('Set GEMINI_PROXY_BASE_URL and GEMINI_PROXY_API_KEY.');
  let url: URL;
  try { url = new URL(base); } catch { throw new Error('Invalid GEMINI_PROXY_BASE_URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('Proxy URL must be HTTP(S), without credentials, query or fragment.');
  if (/[\r\n]/.test(apiKey)) throw new Error('Invalid GEMINI_PROXY_API_KEY.');
  return { baseUrl: url.href.replace(/\/+$/, ''), apiKey };
}
