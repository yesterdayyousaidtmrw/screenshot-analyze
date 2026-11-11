import { ExifTool } from 'exiftool-vendored';
import type { TagValue, Tags } from './types.ts';

// No -fast: it stops before trailers, which is where appended data shows up.
const READ_ARGS = [
  '-G1',
  '-a',
  '-api',
  'largefilesupport=1',
  '-api',
  'geolocation',
  '-api',
  'requesttags=JPEGDigest,JPEGQualityEstimate',
];
// -ee3 walks embedded streams (video GPS tracks, sub-documents); -U keeps unknown tags.
const DEEP_ARGS = ['-ee3', '-U'];
// The geolocation API also tries to match written City tags and warns on a miss.
const NOISE_WARNING = /No such city in Geolocation database/i;

export interface ExifReaderOptions {
  deep: boolean;
}

export interface ExifResult {
  tags: Tags;
  warnings: string[];
}

export interface ExifReader {
  read(path: string): Promise<ExifResult>;
  extractTag(tagName: string, path: string, destination: string): Promise<void>;
  removeAllTags(path: string): Promise<void>;
  close(): Promise<void>;
}

function normalizeValue(value: unknown): TagValue {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === 'object' && value !== null && 'rawValue' in value && typeof value.rawValue === 'string') {
    return value.rawValue;
  }
  return JSON.stringify(value);
}

export function normalizeTags(raw: Record<string, unknown>): Tags {
  const tags: Tags = {};
  for (const [key, value] of Object.entries(raw)) {
    // With -G1 every real tag is "Group:Name"; the rest is exiftool-vendored bookkeeping.
    if (key.includes(':') && value !== undefined && value !== null) tags[key] = normalizeValue(value);
  }
  return tags;
}

export function createExifReader({ deep }: ExifReaderOptions): ExifReader {
  const exiftool = new ExifTool();
  const readArgs = deep ? [...READ_ARGS, ...DEEP_ARGS] : READ_ARGS;
  return {
    async read(path) {
      const raw = await exiftool.read(path, { readArgs });
      const warnings = [...(raw.errors ?? []), ...(raw.warnings ?? [])];
      return {
        tags: normalizeTags(raw as Record<string, unknown>),
        warnings: warnings.filter((warning) => !NOISE_WARNING.test(warning)),
      };
    },
    extractTag: (tagName, path, destination) => exiftool.extractBinaryTag(tagName, path, destination),
    removeAllTags: (path) => exiftool.write(path, {}, { writeArgs: ['-all=', '-overwrite_original'] }).then(() => undefined),
    close: () => exiftool.end(),
  };
}
