import { createReadStream, createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join, parse } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { ExifReader } from './exif.ts';

export function cleanedPathFor(path: string): string {
  const { dir, name, ext } = parse(path);
  return join(dir, `${name}.clean${ext}`);
}

/**
 * Writes a metadata-free copy, never touching the original.
 * Copies bytes, not the file: fs.copyFile keeps macOS attributes and Windows streams.
 */
export async function writeCleanCopy(path: string, exif: ExifReader): Promise<string> {
  const cleaned = cleanedPathFor(path);
  await pipeline(createReadStream(path), createWriteStream(cleaned, { flags: 'wx' }));
  try {
    await exif.removeAllTags(cleaned);
    return cleaned;
  } catch (error) {
    await rm(cleaned, { force: true });
    throw error;
  }
}
