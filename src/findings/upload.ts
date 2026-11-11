import { readFile } from 'node:fs/promises';
import type { Finding, Tags, TrailingData, TypeFacts } from '../types.ts';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif', 'avif', 'bmp', 'tif', 'tiff']);
const EXTENSION_ALIASES: Record<string, string> = {
  jpeg: 'jpg',
  jpe: 'jpg',
  tiff: 'tif',
  heif: 'heic',
  htm: 'html',
  mov: 'mp4',
  qt: 'mp4',
  m4v: 'mp4',
};
// DMG's signature is in its footer; partial downloads carry whatever is arriving.
const NO_RELIABLE_HEADER = new Set(['dmg', 'part', 'crdownload', 'download', 'tmp']);
const ZIP_BASED = new Set(['docx', 'xlsx', 'pptx', 'pages', 'numbers', 'key', 'epub', 'jar', 'apk', 'ipa']);
const EXECUTABLE_CONTENT = new Set(['exe', 'elf', 'macho', 'class', 'wasm', 'swf']);
const CLIENT_EXECUTABLE = new Set(['exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'js', 'vbs', 'ps1', 'sh', 'jar', 'app', 'pkg']);
const SERVER_SCRIPT = new Set(['php', 'phtml', 'phar', 'asp', 'aspx', 'jsp', 'cgi']);
const DOCUMENT = new Set([...IMAGE_EXTENSIONS, 'pdf', 'doc', 'docx', 'txt']);
const ACTIVE_PAYLOAD = /<\?php|<script\b|javascript:|base64_decode|\beval\s*\(/i;
const SVG_ACTIVE = /<script\b|\son\w+\s*=|javascript:|<foreignObject\b|<html[\s>]|(?:xlink:)?href\s*=\s*["']https?:/i;
const MAX_SVG_BYTES = 16 * 1024 * 1024;

const canonical = (extension: string) => EXTENSION_ALIASES[extension] ?? extension;

export function typeFindings(type: TypeFacts): Finding[] {
  const { extension, detectedExtension, detectedMime } = type;
  if (detectedExtension && EXECUTABLE_CONTENT.has(detectedExtension)) {
    return [{ severity: 'high', area: 'upload', message: `contents are executable (${detectedMime})` }];
  }
  if (!detectedExtension) {
    return IMAGE_EXTENSIONS.has(extension)
      ? [{ severity: 'high', area: 'upload', message: `named .${extension} but contents are not a recognized image` }]
      : [];
  }
  if (!extension || NO_RELIABLE_HEADER.has(extension)) return [];
  if (canonical(extension) === canonical(detectedExtension)) return [];
  if (detectedExtension === 'zip' && ZIP_BASED.has(extension)) return [];
  if (detectedExtension === 'xml' && extension === 'svg') return [];
  return [{
    severity: IMAGE_EXTENSIONS.has(extension) ? 'high' : 'warn',
    area: 'upload',
    message: `extension .${extension} does not match contents (${detectedMime})`,
  }];
}

export function doubleExtensionFindings(fileName: string): Finding[] {
  const parts = fileName.toLowerCase().split('.');
  const last = parts.at(-1);
  const previous = parts.at(-2);
  if (parts.length < 3 || !last || !previous) return [];
  const disguisedExecutable = DOCUMENT.has(previous) && CLIENT_EXECUTABLE.has(last);
  const disguisedScript = SERVER_SCRIPT.has(previous) && IMAGE_EXTENSIONS.has(last);
  if (!disguisedExecutable && !disguisedScript) return [];
  return [{ severity: 'high', area: 'upload', message: `suspicious double extension: .${previous}.${last}` }];
}

export function trailingFindings(trailing: TrailingData): Finding[] {
  if (trailing.status === 'truncated') {
    return [{ severity: 'warn', area: 'integrity', message: 'image has no end marker (truncated or corrupt)' }];
  }
  if (trailing.status === 'skipped') {
    return [{ severity: 'info', area: 'integrity', message: `trailing-data check skipped: ${trailing.reason}` }];
  }
  if (trailing.status !== 'checked' || trailing.trailingBytes === 0) return [];
  if (trailing.payload) {
    return [{ severity: 'high', area: 'upload', message: `${trailing.trailingBytes} bytes appended after image end, containing ${trailing.payload}` }];
  }
  return trailing.allZero
    ? [{ severity: 'info', area: 'integrity', message: `${trailing.trailingBytes} zero bytes of padding after image end` }]
    : [{ severity: 'warn', area: 'upload', message: `${trailing.trailingBytes} unknown bytes appended after image end` }];
}

export function metadataPayloadFindings(tags: Tags): Finding[] {
  const hits = Object.entries(tags)
    .filter(([key, value]) => !key.startsWith('System:') && typeof value === 'string' && ACTIVE_PAYLOAD.test(value))
    .map(([key]) => key);
  return hits.length === 0
    ? []
    : [{ severity: 'high', area: 'upload', message: `script-like content inside metadata: ${hits.join(', ')}` }];
}

export function svgFindings(content: string): Finding[] {
  return SVG_ACTIVE.test(content)
    ? [{ severity: 'high', area: 'upload', message: 'SVG contains active content (scripts, event handlers, or external links)' }]
    : [];
}

export async function readSvgFindings(path: string, type: TypeFacts, sizeBytes: number): Promise<Finding[]> {
  if (type.extension !== 'svg') return [];
  if (sizeBytes > MAX_SVG_BYTES) {
    return [{ severity: 'info', area: 'upload', message: 'SVG active-content check skipped: file larger than 16 MB' }];
  }
  return svgFindings(await readFile(path, 'utf8'));
}
