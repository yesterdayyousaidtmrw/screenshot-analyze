import { extname } from 'node:path';
import { fileTypeFromFile } from 'file-type';
import type { TypeFacts } from './types.ts';

export async function detectType(path: string): Promise<TypeFacts> {
  const detected = await fileTypeFromFile(path);
  return {
    extension: extname(path).slice(1).toLowerCase(),
    detectedExtension: detected?.ext ?? null,
    detectedMime: detected?.mime ?? null,
  };
}
