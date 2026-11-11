import { readFile } from 'node:fs/promises';
import type { TrailingData } from './types.ts';

const MAX_SCAN_BYTES = 256 * 1024 * 1024;
const PNG_CHUNK_OVERHEAD = 12;
const PNG_SIGNATURE_BYTES = 8;

const PAYLOAD_SIGNATURES: Array<[string, RegExp]> = [
  ['ZIP archive', /PK\x03\x04/],
  ['Windows executable', /^MZ/],
  ['ELF executable', /^\x7fELF/],
  ['PHP code', /<\?php/i],
  ['HTML script', /<script\b/i],
  ['shell script', /^#!/],
];

/** Returns the offset just past IEND, or null if the chunk walk runs off the end. */
export function pngEndOffset(bytes: Buffer): number | null {
  let offset = PNG_SIGNATURE_BYTES;
  while (offset + PNG_CHUNK_OVERHEAD <= bytes.length) {
    const next = offset + PNG_CHUNK_OVERHEAD + bytes.readUInt32BE(offset);
    if (next > bytes.length) return null;
    if (bytes.toString('latin1', offset + 4, offset + 8) === 'IEND') return next;
    offset = next;
  }
  return null;
}

/** Uses the LAST end marker: multi-picture JPEGs legitimately hold several. */
export function jpegEndOffset(bytes: Buffer): number | null {
  const marker = bytes.lastIndexOf(Buffer.from([0xff, 0xd9]));
  return marker === -1 ? null : marker + 2;
}

export function identifyPayload(trailing: Buffer): string | null {
  const text = trailing.toString('latin1');
  for (const [label, signature] of PAYLOAD_SIGNATURES) {
    if (signature.test(text)) return label;
  }
  return null;
}

export function inspectTrailing(bytes: Buffer, endOffset: number | null): TrailingData {
  if (endOffset === null) return { status: 'truncated' };
  const trailing = bytes.subarray(endOffset);
  return {
    status: 'checked',
    trailingBytes: trailing.length,
    allZero: trailing.every((byte) => byte === 0),
    payload: identifyPayload(trailing),
  };
}

export async function readTrailingData(
  path: string,
  detectedExtension: string | null,
  sizeBytes: number,
): Promise<TrailingData> {
  if (detectedExtension !== 'png' && detectedExtension !== 'jpg') return { status: 'not-applicable' };
  if (sizeBytes > MAX_SCAN_BYTES) return { status: 'skipped', reason: 'file larger than 256 MB' };
  const bytes = await readFile(path);
  return inspectTrailing(bytes, detectedExtension === 'png' ? pngEndOffset(bytes) : jpegEndOffset(bytes));
}
