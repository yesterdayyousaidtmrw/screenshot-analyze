import { basename } from 'node:path';
import { detectType } from './detect-type.ts';
import type { ExifReader } from './exif.ts';
import { readFileFacts } from './file-facts.ts';
import { editFindings } from './findings/edit.ts';
import { privacyFindings } from './findings/privacy.ts';
import { provenanceFindings } from './findings/provenance.ts';
import { timeConsistencyFindings } from './findings/time-consistency.ts';
import {
  doubleExtensionFindings,
  metadataPayloadFindings,
  readSvgFindings,
  trailingFindings,
  typeFindings,
} from './findings/upload.ts';
import { analyzeForensics, type ForensicsOutcome } from './forensics/index.ts';
import { readImageFacts } from './image-facts.ts';
import { readLocalAttributes } from './local-attributes.ts';
import { readLocation } from './location.ts';
import { isMediaType, type MediaReader } from './media-info.ts';
import { readPolyglotFindings } from './polyglot.ts';
import { readSections } from './sections/index.ts';
import { assessScreenshot } from './screenshot-signals.ts';
import { writeCleanCopy } from './strip.ts';
import { readTrailingData } from './trailing-data.ts';
import type { FileFacts, Finding, Report, Section, Severity, StripResult, TypeFacts } from './types.ts';

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, warn: 1, info: 2 };

export interface AnalyzeTools {
  exif: ExifReader;
  media: MediaReader;
}

export interface AnalyzeOptions {
  forensics: boolean;
  outDir: string | null;
  strip: boolean;
}

export const BASIC_ANALYSIS: AnalyzeOptions = { forensics: false, outDir: null, strip: false };

interface MediaOutcome {
  section: Section | null;
  findings: Finding[];
}

async function readMedia(path: string, type: TypeFacts, file: FileFacts, media: MediaReader): Promise<MediaOutcome> {
  if (!isMediaType(type)) return { section: null, findings: [] };
  try {
    return { section: await media.read(path, file.sizeBytes), findings: [] };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { section: null, findings: [{ severity: 'info', area: 'integrity', message: `MediaInfo could not read this file: ${reason}` }] };
  }
}

async function stripFile(path: string, tagsBefore: number, tools: AnalyzeTools): Promise<StripResult> {
  try {
    const cleanedPath = await writeCleanCopy(path, tools.exif);
    const cleaned = await analyzeFile(cleanedPath, tools, BASIC_ANALYSIS);
    return {
      status: 'cleaned',
      cleanedPath,
      tagsBefore,
      tagsAfter: Object.keys(cleaned.tags).length,
      remaining: cleaned.findings.filter((finding) => finding.severity !== 'info'),
    };
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : String(error) };
  }
}

export async function analyzeFile(path: string, tools: AnalyzeTools, options: AnalyzeOptions): Promise<Report> {
  const name = basename(path);
  const file = await readFileFacts(path);
  const [type, localAttributes, { tags, warnings }] = await Promise.all([
    detectType(path),
    readLocalAttributes(path),
    tools.exif.read(path),
  ]);
  const trailingData = await readTrailingData(path, type.detectedExtension, file.sizeBytes);
  const location = readLocation(tags);
  const media = await readMedia(path, type, file, tools.media);
  const forensics: ForensicsOutcome | null = options.forensics
    ? await analyzeForensics({ path, name, file, type, tags, exif: tools.exif, outDir: options.outDir })
    : null;
  const findings: Finding[] = [
    ...typeFindings(type),
    ...doubleExtensionFindings(name),
    ...trailingFindings(trailingData),
    ...metadataPayloadFindings(tags),
    ...(await readSvgFindings(path, type, file.sizeBytes)),
    ...(await readPolyglotFindings(path, type, file.sizeBytes)),
    ...privacyFindings(tags, location, localAttributes),
    ...provenanceFindings(tags),
    ...editFindings({ fileName: name, modifiedAt: file.modifiedAt, tags }),
    ...timeConsistencyFindings(tags),
    ...media.findings,
    ...(forensics?.findings ?? []),
  ].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return {
    path,
    name,
    file,
    type,
    image: readImageFacts(tags),
    location,
    sections: [...readSections(tags), ...(media.section ? [media.section] : [])],
    forensics: forensics?.facts ?? null,
    strip: options.strip ? await stripFile(path, Object.keys(tags).length, tools) : null,
    localAttributes,
    trailingData,
    screenshot: assessScreenshot({ fileName: name, tags, localAttributes }),
    findings,
    exiftoolWarnings: warnings,
    tags,
  };
}
