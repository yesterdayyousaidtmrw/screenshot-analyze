import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { FileFacts } from './types.ts';

type Digests = Pick<FileFacts, 'md5' | 'sha1' | 'sha256'>;

async function digestFile(path: string): Promise<Digests> {
  const md5 = createHash('md5');
  const sha1 = createHash('sha1');
  const sha256 = createHash('sha256');
  for await (const chunk of createReadStream(path)) {
    md5.update(chunk);
    sha1.update(chunk);
    sha256.update(chunk);
  }
  return { md5: md5.digest('hex'), sha1: sha1.digest('hex'), sha256: sha256.digest('hex') };
}

export async function readFileFacts(path: string): Promise<FileFacts> {
  const stats = await stat(path);
  if (!stats.isFile()) throw new Error('not a regular file');
  return {
    sizeBytes: stats.size,
    ...(await digestFile(path)),
    createdAt: stats.birthtime.toISOString(),
    modifiedAt: stats.mtime.toISOString(),
  };
}
