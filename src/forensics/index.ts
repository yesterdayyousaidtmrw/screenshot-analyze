import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ExifReader } from '../exif.ts';
import type { ElaFacts, FileFacts, Finding, ForensicsFacts, Tags, TypeFacts } from '../types.ts';
import { computeErrorMap, meanError, unevenness, writeHeatmap } from './ela.ts';
import { indicatorFindings, readIndicators } from './indicators.ts';
import { differenceHash } from './perceptual-hash.ts';
import { checkThumbnail } from './thumbnail.ts';

const PIXEL_TYPES = new Set(['png', 'jpg', 'webp', 'gif', 'tif', 'avif']);
const UNEVEN_THRESHOLD = 6;

export interface ForensicsInput {
  path: string;
  name: string;
  file: FileFacts;
  type: TypeFacts;
  tags: Tags;
  exif: ExifReader;
  outDir: string | null;
}

export interface ForensicsOutcome {
  facts: ForensicsFacts;
  findings: Finding[];
}

function outputPath(input: ForensicsInput, suffix: string): string | null {
  return input.outDir ? join(input.outDir, `${input.name}.${input.file.sha256.slice(0, 8)}.${suffix}`) : null;
}

async function runEla(input: ForensicsInput): Promise<ElaFacts> {
  const map = await computeErrorMap(input.path);
  const heatmapPath = outputPath(input, 'ela.png');
  if (heatmapPath) await writeHeatmap(map, heatmapPath);
  return { meanError: Math.round(meanError(map) * 100) / 100, unevenness: Math.round(unevenness(map) * 100) / 100, heatmapPath };
}

function elaFindings(ela: ElaFacts, type: TypeFacts): Finding[] {
  if (type.detectedExtension !== 'jpg' || ela.unevenness < UNEVEN_THRESHOLD) return [];
  return [{
    severity: 'info',
    area: 'edit',
    message: `uneven compression error (${ela.unevenness}x): could be an edited region or just high-detail areas, inspect the heat map`,
  }];
}

async function analyzePixels(input: ForensicsInput): Promise<Omit<ForensicsOutcome['facts'], 'indicators'> & { findings: Finding[] }> {
  const perceptualHash = await differenceHash(input.path);
  const ela = await runEla(input);
  const thumbnail = await checkThumbnail(input.path, input.tags, input.exif, perceptualHash, outputPath(input, 'thumb.jpg'));
  return {
    perceptualHash,
    ela,
    thumbnailDistance: thumbnail.distance,
    thumbnailPath: thumbnail.savedPath,
    findings: [...elaFindings(ela, input.type), ...thumbnail.findings],
  };
}

const NO_PIXELS = { perceptualHash: null, ela: null, thumbnailDistance: null, thumbnailPath: null, findings: [] };

async function analyzePixelsSafely(input: ForensicsInput): ReturnType<typeof analyzePixels> {
  if (!PIXEL_TYPES.has(input.type.detectedExtension ?? '')) return NO_PIXELS;
  try {
    return await analyzePixels(input);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ...NO_PIXELS, findings: [{ severity: 'info', area: 'integrity', message: `pixel analysis failed: ${reason}` }] };
  }
}

export async function analyzeForensics(input: ForensicsInput): Promise<ForensicsOutcome> {
  if (input.outDir) await mkdir(input.outDir, { recursive: true });
  const { findings, ...pixels } = await analyzePixelsSafely(input);
  const indicators = await readIndicators(input.path, input.file.sizeBytes);
  return { facts: { ...pixels, indicators }, findings: [...findings, ...indicatorFindings(indicators)] };
}
