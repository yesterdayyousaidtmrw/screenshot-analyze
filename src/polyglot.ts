import { readFile } from 'node:fs/promises';
import type { Finding, TypeFacts } from './types.ts';

// Format checks adapted from typebleed (MIT), see NOTICE.md.
const MAX_SCAN_BYTES = 256 * 1024 * 1024;
const HOST_TYPES = new Set(['png', 'jpg', 'gif', 'webp', 'bmp', 'tif', 'ico', 'pdf']);
const PDF_ACTIVE = /\/JavaScript\b|\/JS[\s(<]|\/Launch\b/;

type FormatCheck = [name: string, matches: (text: string) => boolean];

const FORMAT_CHECKS: FormatCheck[] = [
  ['ZIP', (text) => text.includes('PK\x05\x06') && text.includes('PK\x03\x04')],
  ['PDF', (text) => text.includes('%PDF-') && text.includes('%%EOF')],
  // A bare "<?=" is 3 bytes and hits by chance in compressed data, so require a variable after it.
  ['PHP', (text) => /<\?php\b|<\?=\s*\$/i.test(text)],
  ['HTML', (text) => /<!doctype\s+html|<html[\s>]/i.test(text)],
  ['SVG', (text) => /<svg[\s>]/i.test(text) && text.includes('</svg>')],
];

export function detectEmbeddedFormats(text: string, host: string): string[] {
  return FORMAT_CHECKS.filter(([name, matches]) => name.toLowerCase() !== host && matches(text)).map(([name]) => name);
}

export function polyglotFindings(text: string, host: string): Finding[] {
  const embedded = detectEmbeddedFormats(text, host);
  const findings: Finding[] = embedded.length === 0
    ? []
    : [{ severity: 'high', area: 'upload', message: `polyglot: this ${host.toUpperCase()} also contains ${embedded.join(', ')}` }];
  if (host === 'pdf' && PDF_ACTIVE.test(text)) {
    findings.push({ severity: 'warn', area: 'upload', message: 'PDF contains JavaScript or launch actions' });
  }
  return findings;
}

export async function readPolyglotFindings(path: string, type: TypeFacts, sizeBytes: number): Promise<Finding[]> {
  const host = type.detectedExtension;
  if (!host || !HOST_TYPES.has(host) || sizeBytes > MAX_SCAN_BYTES) return [];
  return polyglotFindings((await readFile(path)).toString('latin1'), host);
}
