import { readFile } from 'node:fs/promises';
import type { LocalAttributes } from './types.ts';

// Non-NTFS volumes (FAT, exFAT, network shares) have no streams to read.
const NO_STREAM_CODES = new Set(['ENOENT', 'EINVAL', 'ENOTSUP']);
const ZONE_NAMES: Record<string, string> = {
  '0': 'Local machine',
  '1': 'Local intranet',
  '2': 'Trusted sites',
  '3': 'Internet',
  '4': 'Restricted sites',
};
const URL_KEYS = ['HostUrl', 'ReferrerUrl'];

export interface ZoneIdentifier {
  zone: string | null;
  urls: string[];
}

export function parseZoneIdentifier(text: string): ZoneIdentifier {
  const fields = new Map<string, string>();
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const separator = line.indexOf('=');
    if (separator > 0) fields.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }
  const zoneId = fields.get('ZoneId');
  return {
    zone: zoneId === undefined ? null : (ZONE_NAMES[zoneId] ?? `Zone ${zoneId}`),
    urls: URL_KEYS.flatMap((key) => fields.get(key) || []),
  };
}

async function readZoneStream(path: string): Promise<string | null> {
  try {
    return await readFile(`${path}:Zone.Identifier`, 'utf8');
  } catch (error) {
    if (NO_STREAM_CODES.has((error as NodeJS.ErrnoException).code ?? '')) return null;
    throw error;
  }
}

export async function readWindowsAttributes(path: string): Promise<LocalAttributes> {
  const stream = await readZoneStream(path);
  const { zone, urls } = stream === null ? { zone: null, urls: [] } : parseZoneIdentifier(stream);
  return {
    source: 'windows',
    downloadZone: zone,
    isScreenCapture: null,
    captureType: null,
    captureRect: null,
    whereFroms: urls,
    quarantine: null,
  };
}
