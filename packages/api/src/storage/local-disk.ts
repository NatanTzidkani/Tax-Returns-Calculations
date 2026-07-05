import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Storage } from './index';

export class LocalDiskStorage implements Storage {
  constructor(private readonly rootDir: string) {}

  /** Resolve a key inside the root, refusing traversal and absolute keys. */
  private resolve(key: string): string {
    if (path.isAbsolute(key)) {
      throw new Error(`storage key must be relative, got: ${key}`);
    }
    const full = path.resolve(this.rootDir, key);
    const root = path.resolve(this.rootDir);
    if (full !== root && !full.startsWith(root + path.sep)) {
      throw new Error(`storage key escapes the storage root: ${key}`);
    }
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await unlink(this.resolve(key));
  }
}
