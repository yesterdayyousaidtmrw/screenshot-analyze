import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExifReader } from '../exif.ts';
import type { Finding, Tags } from '../types.ts';
import { differenceHash, HASH_BITS, hammingDistance } from './perceptual-hash.ts';

const MISMATCH_BITS = 14;
const THUMBNAIL_TAGS = ['ThumbnailImage', 'PreviewImage'];

export interface ThumbnailCheck {
  distance: number | null;
  savedPath: string | null;
  findings: Finding[];
}

const NO_THUMBNAIL: ThumbnailCheck = { distance: null, savedPath: null, findings: [] };

export function findThumbnailTag(tags: Tags): string | null {
  return THUMBNAIL_TAGS.find((name) => Object.keys(tags).some((key) => key.endsWith(`:${name}`))) ?? null;
}

export function mismatchFindings(distance: number): Finding[] {
  if (distance <= MISMATCH_BITS) return [];
  return [{
    severity: 'warn',
    area: 'edit',
    message: `embedded thumbnail differs from the image (${distance}/${HASH_BITS} bits), it may show the original before editing`,
  }];
}

export async function checkThumbnail(
  path: string,
  tags: Tags,
  exif: ExifReader,
  mainHash: string,
  savePath: string | null,
): Promise<ThumbnailCheck> {
  const tagName = findThumbnailTag(tags);
  if (!tagName) return NO_THUMBNAIL;
  const workDir = await mkdtemp(join(tmpdir(), 'shot-analyze-thumb-'));
  try {
    const extracted = join(workDir, 'thumbnail.jpg');
    await exif.extractTag(tagName, path, extracted);
    const distance = hammingDistance(mainHash, await differenceHash(extracted));
    if (savePath) await copyFile(extracted, savePath);
    return { distance, savedPath: savePath, findings: mismatchFindings(distance) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ...NO_THUMBNAIL, findings: [{ severity: 'info', area: 'integrity', message: `embedded thumbnail could not be compared: ${reason}` }] };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
