import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseBuffer } from 'bplist-parser';
import type { LocalAttributes, Quarantine } from './types.ts';

const run = promisify(execFile);
const METADATA_PREFIX = 'com.apple.metadata:';

async function listAttributes(path: string): Promise<Set<string>> {
  const { stdout } = await run('xattr', [path]);
  return new Set(stdout.split('\n').filter(Boolean));
}

async function readAttributeBytes(path: string, name: string): Promise<Buffer> {
  const { stdout } = await run('xattr', ['-px', name, path]);
  return Buffer.from(stdout.replace(/\s/g, ''), 'hex');
}

async function readPlistAttribute(path: string, names: Set<string>, key: string): Promise<unknown> {
  const name = METADATA_PREFIX + key;
  if (!names.has(name)) return undefined;
  const [value] = parseBuffer(await readAttributeBytes(path, name));
  return value;
}

/** Quarantine format: flags;hex-unix-seconds;agent;uuid */
export function parseQuarantine(raw: string): Quarantine {
  const [, hexSeconds, agent] = raw.trim().split(';');
  const seconds = hexSeconds ? Number.parseInt(hexSeconds, 16) : Number.NaN;
  return {
    downloadedAt: Number.isNaN(seconds) ? null : new Date(seconds * 1000).toISOString(),
    agent: agent || null,
  };
}

export async function readMacAttributes(path: string): Promise<LocalAttributes> {
  const names = await listAttributes(path);
  const [isCapture, captureType, captureRect, whereFroms] = await Promise.all([
    readPlistAttribute(path, names, 'kMDItemIsScreenCapture'),
    readPlistAttribute(path, names, 'kMDItemScreenCaptureType'),
    readPlistAttribute(path, names, 'kMDItemScreenCaptureGlobalRect'),
    readPlistAttribute(path, names, 'kMDItemWhereFroms'),
  ]);
  const quarantineBytes = names.has('com.apple.quarantine')
    ? await readAttributeBytes(path, 'com.apple.quarantine')
    : null;
  return {
    source: 'macos',
    downloadZone: null,
    isScreenCapture: isCapture === undefined ? null : Boolean(isCapture),
    captureType: typeof captureType === 'string' ? captureType : null,
    captureRect: Array.isArray(captureRect) ? captureRect.map(Number) : null,
    whereFroms: Array.isArray(whereFroms) ? whereFroms.filter((url) => typeof url === 'string' && url !== '') : [],
    quarantine: quarantineBytes ? parseQuarantine(quarantineBytes.toString('utf8')) : null,
  };
}
