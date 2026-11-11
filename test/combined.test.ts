import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ExifTool } from 'exiftool-vendored';
import sharp from 'sharp';
import { expandPaths, parsePathList } from '../src/expand-paths.ts';
import { computeErrorMap, unevenness } from '../src/forensics/ela.ts';
import { extractIndicators, indicatorFindings } from '../src/forensics/indicators.ts';
import { differenceHash, hammingDistance } from '../src/forensics/perceptual-hash.ts';
import { mismatchFindings } from '../src/forensics/thumbnail.ts';
import { tracksToSection } from '../src/media-info.ts';
import { detectEmbeddedFormats, polyglotFindings } from '../src/polyglot.ts';
import { cleanedPathFor } from '../src/strip.ts';
import type { Report } from '../src/types.ts';
import { tinyPng } from './helpers.ts';

const CLI = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'shot-analyze-combined-'));
after(() => rmSync(dir, { recursive: true, force: true }));

function runCli(args: string[], input?: string) {
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env, input });
}

function reports(args: string[], input?: string): Report[] {
  const result = runCli(['--json', ...args], input);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout) as Report[];
}

function gradient(width: number, height: number, flip = false): Buffer {
  const pixels = Buffer.alloc(width * height * 3);
  for (let index = 0; index < width * height; index++) {
    const value = Math.floor(((index % width) / width) * 255);
    pixels.fill(flip ? 255 - value : value, index * 3, index * 3 + 3);
  }
  return pixels;
}

const rawImage = (width: number, height: number, flip = false) =>
  sharp(gradient(width, height, flip), { raw: { width, height, channels: 3 } });

function wavFile(): Buffer {
  const samples = Buffer.alloc(8000);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(36 + samples.length, 4);
  header.write('WAVEfmt ', 8, 'latin1');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24);
  header.writeUInt32LE(8000, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write('data', 36, 'latin1');
  header.writeUInt32LE(samples.length, 40);
  return Buffer.concat([header, samples]);
}

test('polyglot: PHP and ZIP inside an image are detected', () => {
  assert.deepEqual(detectEmbeddedFormats('GIF89a<?php system($x); ?>', 'gif'), ['PHP']);
  assert.deepEqual(detectEmbeddedFormats('..PK\x03\x04..PK\x05\x06..', 'png'), ['ZIP']);
});

test('polyglot: a chance "<?=" in binary data is ignored', () => {
  assert.deepEqual(detectEmbeddedFormats('\x01<?=\x9a\x02', 'png'), []);
});

test('polyglot: a PDF is not reported as containing itself', () => {
  assert.deepEqual(polyglotFindings('%PDF-1.4 ... %%EOF', 'pdf'), []);
});

test('PDF with JavaScript is flagged', () => {
  assert.match(polyglotFindings('%PDF-1.4 /JavaScript %%EOF', 'pdf')[0]?.message ?? '', /JavaScript/);
});

test('indicators find URLs, emails and user paths, skip schema URLs', () => {
  const found = extractIndicators('x http://ns.adobe.com/xap/1.0/ https://evil.test/a pat@corp.test /Users/pat/Desktop');
  assert.deepEqual(found, { urls: ['https://evil.test/a'], emails: ['pat@corp.test'], userPaths: ['/Users/pat'] });
  assert.equal(indicatorFindings(found).length, 3);
});

test('asset names and binary noise are not emails', () => {
  const noise = 'icon@2x.png logo@1x.pngUT frame-1@mhtml.blink x@aI.Quq key@o39.ingest.sentry.io';
  assert.deepEqual(extractIndicators(noise).emails, []);
  assert.deepEqual(extractIndicators('reach sam@mail.corp.co.uk now').emails, ['sam@mail.corp.co.uk']);
});

test('perceptual hash: same picture matches, inverted picture does not', async () => {
  const first = await rawImage(64, 64).png().toBuffer();
  const same = await rawImage(64, 64).jpeg().toBuffer();
  const inverted = await rawImage(64, 64, true).png().toBuffer();
  assert.equal(hammingDistance(await differenceHash(first), await differenceHash(same)), 0);
  assert.ok(hammingDistance(await differenceHash(first), await differenceHash(inverted)) > 14);
});

test('thumbnail mismatch threshold', () => {
  assert.deepEqual(mismatchFindings(3), []);
  assert.equal(mismatchFindings(40)[0]?.severity, 'warn');
});

test('ELA: a noisy patch pasted on a flat image raises unevenness', async () => {
  const noise = Buffer.alloc(32 * 32 * 3);
  for (let index = 0; index < noise.length; index++) noise[index] = (index * 97) % 256;
  const path = join(dir, 'pasted.png');
  await sharp({ create: { width: 256, height: 256, channels: 3, background: '#808080' } })
    .composite([{ input: noise, raw: { width: 32, height: 32, channels: 3 }, left: 96, top: 96 }])
    .png()
    .toFile(path);
  assert.ok(unevenness(await computeErrorMap(path)) > 2);
});

test('MediaInfo tracks become labelled fields', () => {
  const section = tracksToSection([{ '@type': 'General', Format: 'MPEG-4' }, { '@type': 'Video', Format: 'AVC', Width: 1920 }]);
  assert.deepEqual(section?.fields, [
    { label: 'Format', value: 'MPEG-4' },
    { label: 'Video format', value: 'AVC' },
    { label: 'Video width', value: '1920' },
  ]);
});

test('MediaInfo reads a real WAV end to end', () => {
  const path = join(dir, 'tone.wav');
  writeFileSync(path, wavFile());
  const [report] = reports([path]);
  const section = report?.sections.find((item) => item.id === 'mediainfo');
  assert.ok(section?.fields.some((field) => field.label === 'Audio sample rate' && field.value === '8000'), JSON.stringify(report?.sections));
});

test('--forensics reports a hash and ELA, --out saves the heat map', async () => {
  const path = join(dir, 'forensic.jpg');
  await rawImage(64, 64).jpeg().toFile(path);
  const out = join(dir, 'maps');
  const [report] = reports(['--forensics', '--out', out, path]);
  assert.match(report?.forensics?.perceptualHash ?? '', /^[0-9a-f]{16}$/);
  assert.ok(report?.forensics?.ela?.heatmapPath && existsSync(report.forensics.ela.heatmapPath));
});

test('--forensics on a non-image still succeeds', () => {
  const path = join(dir, 'note.txt');
  writeFileSync(path, 'contact pat@corp.test');
  const [report] = reports(['--forensics', path]);
  assert.equal(report?.forensics?.ela, null);
  assert.deepEqual(report?.forensics?.indicators.emails, ['pat@corp.test']);
});

test('--strip writes a clean copy and leaves the original untouched', async () => {
  const path = join(dir, 'secret.png');
  writeFileSync(path, tinyPng());
  const exiftool = new ExifTool();
  try {
    await exiftool.write(path, { GPSLatitude: 51.5, GPSLongitude: -0.12, Artist: 'Pat' }, { writeArgs: ['-overwrite_original'] });
  } finally {
    await exiftool.end();
  }
  const before = readFileSync(path);
  const [report] = reports(['--strip', path]);
  assert.equal(report?.strip?.status, 'cleaned');
  assert.deepEqual(readFileSync(path), before);
  const [clean] = reports([cleanedPathFor(path)]);
  assert.equal(clean?.location, null);
  assert.ok(!clean?.findings.some((item) => item.area === 'privacy'), JSON.stringify(clean?.findings));
});

test('--strip refuses to overwrite an existing clean copy', () => {
  const path = join(dir, 'taken.png');
  writeFileSync(path, tinyPng());
  writeFileSync(cleanedPathFor(path), 'keep me');
  const result = runCli(['--strip', path]);
  assert.equal(result.status, 1);
  assert.equal(readFileSync(cleanedPathFor(path), 'utf8'), 'keep me');
});

test('--recursive walks folders and skips hidden ones', () => {
  const root = join(dir, 'tree');
  mkdirSync(join(root, 'nested'), { recursive: true });
  mkdirSync(join(root, '.hidden'), { recursive: true });
  writeFileSync(join(root, 'nested', 'a.png'), 'x');
  writeFileSync(join(root, '.hidden', 'b.png'), 'x');
  assert.deepEqual(expandPaths([root], 'darwin', true), [join(root, 'nested', 'a.png')]);
});

test('paths can be piped on stdin', () => {
  const path = join(dir, 'piped.png');
  writeFileSync(path, tinyPng());
  assert.equal(reports(['-'], `${path}\n`).length, 1);
  assert.deepEqual(parsePathList('a\r\n\r\nb\n'), ['a', 'b']);
});
