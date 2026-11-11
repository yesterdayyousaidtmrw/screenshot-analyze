import assert from 'node:assert/strict';
import { test } from 'node:test';
import { identifyPayload, inspectTrailing, jpegEndOffset, pngEndOffset } from '../src/trailing-data.ts';
import { tinyPng } from './helpers.ts';

test('clean PNG ends exactly at IEND', () => {
  const png = tinyPng();
  assert.equal(pngEndOffset(png), png.length);
});

test('appended zip after PNG is identified', () => {
  const png = tinyPng();
  const bytes = Buffer.concat([png, Buffer.from('PK\x03\x04payload', 'latin1')]);
  assert.deepEqual(inspectTrailing(bytes, pngEndOffset(bytes)), {
    status: 'checked',
    trailingBytes: 11,
    allZero: false,
    payload: 'ZIP archive',
  });
});

test('PNG cut off mid-chunk is truncated', () => {
  const png = tinyPng();
  const cut = png.subarray(0, png.length - 16);
  assert.deepEqual(inspectTrailing(cut, pngEndOffset(cut)), { status: 'truncated' });
});

test('JPEG uses the last end marker so multi-picture files are clean', () => {
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9, 0xff, 0xd8, 0xff, 0xd9]);
  assert.equal(jpegEndOffset(bytes), 8);
});

test('binary noise is not called a payload', () => {
  assert.equal(identifyPayload(Buffer.from([1, 2, 3, 4])), null);
});
