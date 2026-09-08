import fs from 'node:fs/promises';
import path from 'node:path';
import { SafeError } from './data.js';
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export function imageMime(bytes: Uint8Array): string {
  const b = Buffer.from(bytes);
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
  if (['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('ascii'))) return 'image/gif';
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  throw new SafeError('Unsupported image: expected PNG, JPEG, GIF or WebP bytes.');
}
export function imageUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new SafeError('Invalid image URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new SafeError('Image URL must be HTTP(S) without embedded credentials.');
  return url.href;
}
export async function localImage(file: string): Promise<string> {
  try {
    if (!path.isAbsolute(file) || file.startsWith('\\\\') || file.startsWith('//') || file.slice(path.parse(file).root.length).includes(':'))
      throw new SafeError('Use an absolute local image path; network paths and alternate streams are not supported.');
    let current = path.parse(file).root;
    for (const part of file.slice(current.length).split(path.sep)) {
      if (!part || part === '.' || part === '..') throw new SafeError('Invalid image path.');
      current = path.join(current, part);
      if ((await fs.lstat(current)).isSymbolicLink()) throw new SafeError('Image links are not allowed.');
    }
    const handle = await fs.open(file, 'r');
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.nlink > 1 || stat.size > MAX_IMAGE_BYTES) throw new SafeError('Image must be a regular file no larger than 8 MiB.');
      const buffer = Buffer.alloc(MAX_IMAGE_BYTES + 1);
      let total = 0;
      while (total < buffer.length) {
        const { bytesRead } = await handle.read(buffer, total, buffer.length - total, null);
        if (!bytesRead) break; total += bytesRead;
      }
      if (total > MAX_IMAGE_BYTES) throw new SafeError('Image exceeds 8 MiB.');
      const bytes = buffer.subarray(0, total);
      return `data:${imageMime(bytes)};base64,${bytes.toString('base64')}`;
    } finally { await handle.close(); }
  } catch (error) {
    if (error instanceof SafeError) throw error;
    throw new SafeError('Cannot read local image. Check file access and format.');
  }
}
export function decodeImage(value: string, mime?: string): { data: string; mimeType: string } {
  const match = value.match(/^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=\r\n]+)$/);
  const data = (match?.[2] ?? value).replace(/[\r\n]/g, '');
  if (data.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data))
    throw new SafeError('Invalid or oversized generated image.');
  const bytes = Buffer.from(data, 'base64');
  if (bytes.length > MAX_IMAGE_BYTES) throw new SafeError('Generated image exceeds 8 MiB.');
  const mimeType = imageMime(bytes);
  if ((match?.[1] ?? mime) && (match?.[1] ?? mime) !== mimeType) throw new SafeError('Image MIME type does not match its bytes.');
  return { data: bytes.toString('base64'), mimeType };
}
