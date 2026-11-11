import type { TagValue, Tags } from './types.ts';

/** Finds a tag by bare name across exiftool groups, e.g. "Make" matches "IFD0:Make". */
export function findTag(tags: Tags, name: string): TagValue | undefined {
  const suffix = `:${name}`;
  for (const [key, value] of Object.entries(tags)) {
    if (key.endsWith(suffix)) return value;
  }
  return undefined;
}

export function findText(tags: Tags, name: string): string | null {
  const value = findTag(tags, name);
  if (value === undefined) return null;
  const text = (Array.isArray(value) ? value.join(', ') : String(value)).trim();
  return text === '' ? null : text;
}

export function findNumber(tags: Tags, name: string): number | null {
  const value = findTag(tags, name);
  return typeof value === 'number' ? value : null;
}
