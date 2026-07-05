import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalDiskStorage } from '../src/storage/local-disk';

let root: string;
let storage: LocalDiskStorage;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'taxreturns-storage-'));
  storage = new LocalDiskStorage(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('LocalDiskStorage', () => {
  it('round-trips bytes through put/get', async () => {
    const data = Buffer.from('hello מסמך');
    await storage.put('year1/doc.pdf', data);
    expect(await storage.get('year1/doc.pdf')).toEqual(data);
  });

  it('creates nested parent directories', async () => {
    await storage.put('a/b/c/file.bin', Buffer.from([1, 2, 3]));
    expect(await storage.get('a/b/c/file.bin')).toEqual(Buffer.from([1, 2, 3]));
  });

  it('deletes objects', async () => {
    await storage.put('gone.txt', Buffer.from('x'));
    await storage.delete('gone.txt');
    await expect(storage.get('gone.txt')).rejects.toThrow();
  });

  it('rejects path traversal and absolute keys', async () => {
    await expect(storage.put('../escape.txt', Buffer.from('x'))).rejects.toThrow(
      /key/i,
    );
    await expect(storage.get('/etc/passwd')).rejects.toThrow(/key/i);
    await expect(
      storage.put('a/../../escape.txt', Buffer.from('x')),
    ).rejects.toThrow(/key/i);
  });
});
