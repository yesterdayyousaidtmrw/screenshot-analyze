#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { analyzeFile, type AnalyzeOptions, type AnalyzeTools } from './analyze.ts';
import { createExifReader } from './exif.ts';
import { expandPaths, parsePathList } from './expand-paths.ts';
import { createMediaReader } from './media-info.ts';
import { renderReport } from './render.ts';
import type { Report } from './types.ts';

const USAGE = `Usage: shot-analyze <file|folder...> [options]

Analyzes the metadata of screenshots and uploaded files. Use - to read paths from stdin.

Options:
  --json            Print a JSON array, including every tag
  --all             Also print every metadata tag
  --deep            Also read embedded streams and unknown tags (slower)
  --forensics       Add pixel forensics: error level analysis, perceptual hash,
                    thumbnail comparison, URLs and emails inside the file
  --out <folder>    Save forensic heat maps and thumbnails here
  --strip           Write a metadata-free copy next to each file (<name>.clean.<ext>)
  -r, --recursive   Analyze every file inside folders
  -h, --help        Show this help

Exit codes: 0 analyzed, 1 a file could not be analyzed or stripped, 2 bad usage.
Metadata can be forged or stripped, so results are evidence, not proof.`;

type Outcome = Report | { path: string; error: string };

function parseCommandLine() {
  return parseArgs({
    allowPositionals: true,
    options: {
      json: { type: 'boolean', default: false },
      all: { type: 'boolean', default: false },
      deep: { type: 'boolean', default: false },
      forensics: { type: 'boolean', default: false },
      out: { type: 'string' },
      strip: { type: 'boolean', default: false },
      recursive: { type: 'boolean', short: 'r', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
}

async function analyzeOutcome(path: string, tools: AnalyzeTools, options: AnalyzeOptions): Promise<Outcome> {
  try {
    return await analyzeFile(path, tools, options);
  } catch (error) {
    return { path, error: error instanceof Error ? error.message : String(error) };
  }
}

async function analyzeAll(paths: string[], deep: boolean, options: AnalyzeOptions): Promise<Outcome[]> {
  const tools: AnalyzeTools = { exif: createExifReader({ deep }), media: createMediaReader() };
  try {
    const outcomes: Outcome[] = [];
    for (const path of paths) outcomes.push(await analyzeOutcome(resolve(path), tools, options));
    return outcomes;
  } finally {
    tools.media.close();
    await tools.exif.close();
  }
}

function printText(outcomes: Outcome[], showAllTags: boolean): void {
  const reports = outcomes.filter((outcome): outcome is Report => !('error' in outcome));
  if (reports.length > 0) console.log(reports.map((report) => renderReport(report, showAllTags)).join('\n\n---\n\n'));
  for (const outcome of outcomes) {
    if ('error' in outcome) console.error(`shot-analyze: ${outcome.path}: ${outcome.error}`);
  }
}

function resolveInputs(positionals: string[], recursive: boolean): string[] {
  const listed = positionals.flatMap((path) => (path === '-' ? parsePathList(readFileSync(0, 'utf8')) : [path]));
  return expandPaths(listed, process.platform, recursive);
}

const hasFailure = (outcome: Outcome) => 'error' in outcome || outcome.strip?.status === 'failed';

async function main(): Promise<number> {
  let parsed: ReturnType<typeof parseCommandLine>;
  try {
    parsed = parseCommandLine();
  } catch (error) {
    console.error(`shot-analyze: ${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  if (positionals.length === 0) {
    console.error(USAGE);
    return 2;
  }
  const outcomes = await analyzeAll(resolveInputs(positionals, Boolean(values.recursive)), Boolean(values.deep), {
    forensics: Boolean(values.forensics) || values.out !== undefined,
    outDir: values.out === undefined ? null : resolve(values.out),
    strip: Boolean(values.strip),
  });
  if (values.json) console.log(JSON.stringify(outcomes, null, 2));
  else printText(outcomes, Boolean(values.all));
  return outcomes.some(hasFailure) ? 1 : 0;
}

process.exitCode = await main();
