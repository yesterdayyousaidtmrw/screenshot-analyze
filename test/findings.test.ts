import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFilenameTime } from '../src/filename-time.ts';
import { editFindings } from '../src/findings/edit.ts';
import { privacyFindings } from '../src/findings/privacy.ts';
import { provenanceFindings } from '../src/findings/provenance.ts';
import { timeConsistencyFindings } from '../src/findings/time-consistency.ts';
import { readLocation } from '../src/location.ts';
import {
  doubleExtensionFindings,
  metadataPayloadFindings,
  svgFindings,
  typeFindings,
} from '../src/findings/upload.ts';
import { parseQuarantine } from '../src/mac-attributes.ts';

const type = (extension: string, detectedExtension: string | null, detectedMime: string | null = null) => ({
  extension,
  detectedExtension,
  detectedMime,
});

test('jpeg extension matches jpg contents', () => {
  assert.deepEqual(typeFindings(type('jpeg', 'jpg', 'image/jpeg')), []);
});

test('QuickTime and MP4 share a container, so .mov over mp4 is fine', () => {
  assert.deepEqual(typeFindings(type('mov', 'mp4', 'video/mp4')), []);
});

test('disk images and partial downloads have no reliable header', () => {
  assert.deepEqual(typeFindings(type('dmg', 'xz', 'application/x-xz')), []);
  assert.deepEqual(typeFindings(type('part', 'webm', 'video/webm')), []);
});

test('image extension over other contents is high', () => {
  assert.equal(typeFindings(type('png', 'pdf', 'application/pdf'))[0]?.severity, 'high');
});

test('image extension over unrecognized contents is high', () => {
  assert.equal(typeFindings(type('png', null))[0]?.severity, 'high');
});

test('plain text with no detection is fine', () => {
  assert.deepEqual(typeFindings(type('txt', null)), []);
});

test('executable contents are high under any name', () => {
  assert.equal(typeFindings(type('txt', 'exe', 'application/x-msdownload'))[0]?.severity, 'high');
});

test('double extensions are flagged both ways', () => {
  assert.equal(doubleExtensionFindings('invoice.pdf.exe').length, 1);
  assert.equal(doubleExtensionFindings('shell.php.png').length, 1);
  assert.deepEqual(doubleExtensionFindings('my.holiday.png'), []);
});

test('script in a metadata field is flagged, file path fields are not', () => {
  assert.equal(metadataPayloadFindings({ 'ExifIFD:UserComment': '<?php system($_GET[0]);' }).length, 1);
  assert.deepEqual(metadataPayloadFindings({ 'System:FileName': '<script>.png' }), []);
});

test('SVG active content is flagged', () => {
  assert.equal(svgFindings('<svg onload="alert(1)"></svg>').length, 1);
  assert.deepEqual(svgFindings('<svg><rect width="1"/></svg>'), []);
});

test('GPS is a high privacy finding', () => {
  const location = readLocation({ 'Composite:GPSLatitude': 37.7, 'Composite:GPSLongitude': -122.4 });
  const [finding] = privacyFindings({}, location, null);
  assert.equal(finding?.severity, 'high');
});

test('music artist and PDF app are not personal data', () => {
  assert.deepEqual(privacyFindings({ 'ID3v2_3:Artist': 'A Band', 'PDF:Creator': 'Chromium' }, null, null), []);
});

test('document author and last editor are flagged', () => {
  const findings = privacyFindings({ 'PDF:Author': 'Pat', 'XML:LastModifiedBy': 'Sam' }, null, null);
  assert.equal(findings.length, 2);
});

test('named people and written places are flagged', () => {
  const tags = { 'XMP-mwg-rs:RegionName': ['Pat', 'Sam'], 'IPTC:City': 'Oslo' };
  const messages = privacyFindings(tags, null, null).map((item) => item.message);
  assert.ok(messages.some((message) => /Pat, Sam/.test(message)));
  assert.ok(messages.some((message) => /Oslo/.test(message)));
});

test('embedded thumbnail is noted', () => {
  const [finding] = privacyFindings({ 'IFD1:ThumbnailImage': '(Binary data 28 bytes)' }, null, null);
  assert.match(finding?.message ?? '', /before it was cropped/);
});

test('AI source type, tool, and generator chunk are flagged', () => {
  assert.equal(provenanceFindings({ 'XMP-iptcExt:DigitalSourceType': 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia' }).length, 1);
  assert.equal(provenanceFindings({ 'IFD0:Software': 'Adobe Firefly' }).length, 1);
  assert.equal(provenanceFindings({ 'PNG:Parameters': 'a cat, Steps: 20' }).length, 1);
  assert.deepEqual(provenanceFindings({ 'IFD0:Software': 'Adobe Lightroom' }), []);
});

test('C2PA credentials are noted without claiming validity', () => {
  const [finding] = provenanceFindings({ 'JUMBF:JUMDLabel': 'c2pa' });
  assert.match(finding?.message ?? '', /not validated/);
});

test('GPS clock drift from capture time is flagged', () => {
  const tags = {
    'ExifIFD:DateTimeOriginal': '2026:01:01 12:00:00',
    'ExifIFD:OffsetTimeOriginal': '+01:00',
    'Composite:GPSDateTime': '2026:01:01 15:00:00Z',
  };
  assert.match(timeConsistencyFindings(tags, Date.UTC(2026, 5, 1))[0]?.message ?? '', /differ by 240 min/);
});

test('matching GPS clock is clean', () => {
  const tags = {
    'ExifIFD:DateTimeOriginal': '2026:01:01 12:00:00',
    'ExifIFD:OffsetTimeOriginal': '+01:00',
    'Composite:GPSDateTime': '2026:01:01 11:00:30Z',
  };
  assert.deepEqual(timeConsistencyFindings(tags, Date.UTC(2026, 5, 1)), []);
});

test('offset that disagrees with the location zone is noted, DST-aware', () => {
  const base = { 'ExifIFD:DateTimeOriginal': '2026:07:01 12:00:00', 'ExifTool:GeolocationTimeZone': 'Europe/London' };
  const now = Date.UTC(2027, 0, 1);
  assert.deepEqual(timeConsistencyFindings({ ...base, 'ExifIFD:OffsetTimeOriginal': '+01:00' }, now), []);
  assert.equal(timeConsistencyFindings({ ...base, 'ExifIFD:OffsetTimeOriginal': '+09:00' }, now).length, 1);
});

test('future capture date is flagged', () => {
  const findings = timeConsistencyFindings({ 'ExifIFD:DateTimeOriginal': '2030:01:01 00:00:00' }, Date.UTC(2026, 0, 1));
  assert.match(findings[0]?.message ?? '', /in the future/);
});

test('cropped image is flagged from recorded dimensions', () => {
  const tags = {
    'PNG:ImageWidth': 800,
    'PNG:ImageHeight': 600,
    'ExifIFD:ExifImageWidth': 1790,
    'ExifIFD:ExifImageHeight': 1302,
  };
  const findings = editFindings({ fileName: 'a.png', modifiedAt: new Date().toISOString(), tags });
  assert.match(findings[0]?.message ?? '', /cropped or resized/);
});

test('editing software is flagged', () => {
  const findings = editFindings({
    fileName: 'a.png',
    modifiedAt: new Date().toISOString(),
    tags: { 'IFD0:Software': 'Adobe Photoshop 25.0' },
  });
  assert.equal(findings[0]?.severity, 'warn');
});

test('macOS file name with narrow no-break space parses PM', () => {
  const parsed = parseFilenameTime('Screenshot 2026-11-03 at 7.15.24 PM.png');
  assert.deepEqual(parsed, new Date(2026, 10, 3, 19, 15, 24));
});

test('Windows Snipping Tool file name parses', () => {
  assert.deepEqual(parseFilenameTime('Screenshot 2026-11-03 191524.png'), new Date(2026, 10, 3, 19, 15, 24));
});

test('12 AM parses as midnight', () => {
  assert.equal(parseFilenameTime('Screenshot 2026-11-03 at 12.00.00 AM.png')?.getHours(), 0);
});

test('Android file name parses', () => {
  assert.deepEqual(parseFilenameTime('Screenshot_20261103-191524.png'), new Date(2026, 10, 3, 19, 15, 24));
});

test('quarantine attribute parses agent and time', () => {
  assert.deepEqual(parseQuarantine('0281;6a60348a;Brave;FDCC\n'), {
    downloadedAt: new Date(0x6a60348a * 1000).toISOString(),
    agent: 'Brave',
  });
});
