import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ExifTool } from 'exiftool-vendored';
import type { Report } from '../src/types.ts';
import { textChunk, tinyPng } from './helpers.ts';

const CLI = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'shot-analyze-'));
after(() => rmSync(dir, { recursive: true, force: true }));

function runCli(...args: string[]) {
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env });
}

function analyzeJson(path: string): Report {
  const result = runCli('--json', path);
  assert.equal(result.status, 0, result.stderr);
  const [report] = JSON.parse(result.stdout) as Report[];
  assert.ok(report);
  return report;
}

test('reads a real embedded screenshot marker and GPS', async () => {
  const path = join(dir, 'upload.png');
  writeFileSync(path, tinyPng());
  const exiftool = new ExifTool();
  try {
    await exiftool.write(
      path,
      { UserComment: 'Screenshot', GPSLatitude: 37.7, GPSLatitudeRef: 'N', GPSLongitude: 122.4, GPSLongitudeRef: 'W' },
      { writeArgs: ['-overwrite_original'] },
    );
  } finally {
    await exiftool.end();
  }
  const report = analyzeJson(path);
  assert.equal(report.screenshot.verdict, 'marked');
  assert.equal(report.image.width, 1);
  assert.ok(report.findings.some((item) => item.area === 'privacy' && item.severity === 'high'));
});

test('resolves a real GPS position to a nearby city and reads camera settings', async () => {
  const path = join(dir, 'photo.png');
  writeFileSync(path, tinyPng());
  const exiftool = new ExifTool();
  try {
    await exiftool.write(
      path,
      {
        Make: 'Canon', Model: 'EOS R5', FNumber: 2.8, ISO: 400,
        GPSLatitude: 51.5, GPSLongitude: -0.12,
      },
      { writeArgs: ['-overwrite_original'] },
    );
  } finally {
    await exiftool.end();
  }
  const report = analyzeJson(path);
  assert.equal(report.location?.longitude, -0.12);
  assert.equal(report.location?.nearestPlace?.country, 'United Kingdom');
  const camera = report.sections.find((section) => section.id === 'camera');
  assert.ok(camera?.fields.some((field) => field.label === 'Aperture' && field.value === 'f/2.8'));
  assert.equal(report.screenshot.verdict, 'camera');
});

test('flags Stable Diffusion settings in a real PNG text chunk', () => {
  const path = join(dir, 'generated.png');
  writeFileSync(path, tinyPng([textChunk('parameters', 'a cat\nSteps: 20, Sampler: Euler')]));
  const report = analyzeJson(path);
  assert.ok(report.findings.some((item) => item.area === 'provenance'), JSON.stringify(report.tags));
});

test('--deep still reads a normal file', () => {
  const path = join(dir, 'deep.png');
  writeFileSync(path, tinyPng());
  const result = runCli('--deep', '--json', path);
  assert.equal(result.status, 0, result.stderr);
});

test('flags text disguised as PNG', () => {
  const path = join(dir, 'fake.png');
  writeFileSync(path, 'hello, not an image\n');
  const report = analyzeJson(path);
  assert.ok(report.findings.some((item) => /not a recognized image/.test(item.message)));
});

test('flags zip appended to PNG', () => {
  const path = join(dir, 'polyglot.png');
  writeFileSync(path, Buffer.concat([tinyPng(), Buffer.from('PK\x03\x04data', 'latin1')]));
  const report = analyzeJson(path);
  assert.ok(report.findings.some((item) => /ZIP archive/.test(item.message)));
});

test('handles an empty file without crashing', () => {
  const path = join(dir, 'empty.bin');
  writeFileSync(path, '');
  assert.equal(analyzeJson(path).file.sizeBytes, 0);
});

test('missing file exits 1 and still reports the good one', () => {
  const good = join(dir, 'good.png');
  writeFileSync(good, tinyPng());
  const result = runCli(good, join(dir, 'missing.png'));
  assert.equal(result.status, 1);
  assert.match(result.stdout, /good\.png/);
  assert.match(result.stderr, /missing\.png/);
});

test('directory exits 1 with a clear error', () => {
  const result = runCli(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not a regular file/);
});

test('no arguments exits 2 with usage', () => {
  const result = runCli();
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});
