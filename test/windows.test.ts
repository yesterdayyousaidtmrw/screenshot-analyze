import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { expandPaths } from '../src/expand-paths.ts';
import { assessScreenshot } from '../src/screenshot-signals.ts';
import { parseZoneIdentifier, readWindowsAttributes } from '../src/windows-attributes.ts';

const dir = mkdtempSync(join(tmpdir(), 'shot-analyze-win-'));
after(() => rmSync(dir, { recursive: true, force: true }));

const ZONE_TEXT = '[ZoneTransfer]\r\nZoneId=3\r\nReferrerUrl=https://a.test/page\r\nHostUrl=https://b.test/x.png\r\n';

test('Zone.Identifier parses zone and URLs', () => {
  assert.deepEqual(parseZoneIdentifier(ZONE_TEXT), {
    zone: 'Internet',
    urls: ['https://b.test/x.png', 'https://a.test/page'],
  });
});

test('Zone.Identifier with a BOM and no URLs parses', () => {
  assert.deepEqual(parseZoneIdentifier('﻿[ZoneTransfer]\nZoneId=2\n'), { zone: 'Trusted sites', urls: [] });
});

// "file:Zone.Identifier" is an NTFS stream on Windows and a plain file elsewhere, so this runs on both.
test('reads the download stream next to a file', async () => {
  const path = join(dir, 'downloaded.png');
  writeFileSync(path, 'x');
  writeFileSync(`${path}:Zone.Identifier`, ZONE_TEXT);
  const attributes = await readWindowsAttributes(path);
  assert.equal(attributes.source, 'windows');
  assert.equal(attributes.downloadZone, 'Internet');
  assert.equal(attributes.whereFroms.length, 2);
});

test('a file with no download stream has empty attributes', async () => {
  const path = join(dir, 'local.png');
  writeFileSync(path, 'x');
  const attributes = await readWindowsAttributes(path);
  assert.equal(attributes.downloadZone, null);
  assert.deepEqual(attributes.whereFroms, []);
});

test('wildcards expand on Windows only', () => {
  writeFileSync(join(dir, 'one.jpg'), 'x');
  writeFileSync(join(dir, 'two.jpg'), 'x');
  const pattern = join(dir, '*.jpg');
  assert.equal(expandPaths([pattern], 'win32').length, 2);
  assert.deepEqual(expandPaths([pattern], 'darwin'), [pattern]);
});

test('an unmatched wildcard stays so the CLI can report it', () => {
  const pattern = join(dir, '*.nomatch');
  assert.deepEqual(expandPaths([pattern], 'win32'), [pattern]);
});

test('Windows screenshot names count as evidence', () => {
  for (const fileName of ['Screenshot (12).png', 'Screenshot 2026-11-03 191524.png']) {
    assert.equal(assessScreenshot({ fileName, tags: {}, localAttributes: null }).verdict, 'possible');
  }
});
