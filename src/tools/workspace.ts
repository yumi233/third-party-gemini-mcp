import fs from 'node:fs/promises';
import path from 'node:path';
import { SafeError } from '../utils/data.js';
const LIMIT = 128 * 1024;
/** Caller allowlists are authorization, not an operating-system sandbox. */
export class Workspace {
  private readable: Set<string>;
  private writable: Set<string>;
  constructor(private root: string, readable: string[] = [], writable: string[] = []) {
    if (!path.isAbsolute(root)) throw new SafeError('workspace_root must be an absolute path.');
    this.readable = new Set([...readable, ...writable]); this.writable = new Set(writable);
  }
  private async resolve(name: string, scope: Set<string>): Promise<string> {
    if (!scope.has(name)) throw new SafeError('File is not in caller allowlist.');
    const parts = name.split('/');
    if (parts.some(p => !p || p === '.' || p === '..' || /[\\:<>"|?*\x00-\x1f]/.test(p) || /[. ]$/.test(p))) throw new SafeError('Invalid relative file path.');
    if (parts.some(p => /^(\.|node_modules$|credentials|secrets)|^config\.local|\.(pem|key|pfx)$/i.test(p))) throw new SafeError('Protected file path.');
    let current = await fs.realpath(this.root);
    for (const part of parts) {
      current = path.join(current, part);
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink() || stat.nlink > 1 && stat.isFile()) throw new SafeError('File links are not allowed.');
    }
    const stat = await fs.stat(current);
    if (!stat.isFile() || stat.size > LIMIT) throw new SafeError('Expected a regular file no larger than 128 KiB.');
    return current;
  }
  async readFiles(files: string[]) {
    if (!files.length || files.length > 10) throw new SafeError('Read 1–10 files at a time.');
    return Promise.all(files.map(async name => {
      const file = await this.resolve(name, this.readable);
      const handle = await fs.open(file, 'r');
      try {
        const bytes = Buffer.alloc(LIMIT + 1);
        let total = 0;
        while (total < bytes.length) {
          const { bytesRead } = await handle.read(bytes, total, bytes.length - total, null);
          if (!bytesRead) break; total += bytesRead;
        }
        if (total > LIMIT) throw new SafeError('File grew beyond size limit.');
        return { path: name, content: bytes.subarray(0, total).toString('utf8') };
      } finally { await handle.close(); }
    }));
  }
  async applyPatch(input: { path: string; old_text: string; new_text: string }) {
    if (!input.old_text || Buffer.byteLength(input.new_text) > LIMIT) throw new SafeError('Invalid exact replacement.');
    const file = await this.resolve(input.path, this.writable);
    const before = (await this.readFiles([input.path]))[0].content;
    if (before.split(input.old_text).length !== 2) throw new SafeError('old_text must match exactly once.');
    const after = before.replace(input.old_text, () => input.new_text);
    if (Buffer.byteLength(after) > LIMIT) throw new SafeError('Patched file exceeds size limit.');
    await this.resolve(input.path, this.writable);
    if ((await this.readFiles([input.path]))[0].content !== before) throw new SafeError('File changed concurrently.');
    await fs.writeFile(file, after, 'utf8');
    return { path: input.path, applied: true };
  }
}
