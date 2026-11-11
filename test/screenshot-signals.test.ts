import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessScreenshot } from '../src/screenshot-signals.ts';
import type { LocalAttributes } from '../src/types.ts';

const macCapture: LocalAttributes = {
  source: 'macos',
  downloadZone: null,
  isScreenCapture: true,
  captureType: 'window',
  captureRect: null,
  whereFroms: [],
  quarantine: null,
};

test('macOS capture flag marks a screenshot', () => {
  const result = assessScreenshot({ fileName: 'a.png', tags: {}, localAttributes: macCapture });
  assert.equal(result.verdict, 'marked');
  assert.match(result.evidence[0]?.detail ?? '', /window/);
});

test('Apple UserComment marks a screenshot with no local attributes', () => {
  const tags = { 'ExifIFD:UserComment': 'Screenshot' };
  assert.equal(assessScreenshot({ fileName: 'upload.png', tags, localAttributes: null }).verdict, 'marked');
});

test('name plus display-specific profile is likely', () => {
  const tags = { 'ICC-header:ProfileClass': 'Display Device Profile', 'ICC_Profile:ProfileDescription': 'KA270H' };
  const fileName = 'Screen Shot 2021-04-23 at 11.47.36 PM.png';
  assert.equal(assessScreenshot({ fileName, tags, localAttributes: null }).verdict, 'likely');
});

test('generic sRGB profile is not display evidence', () => {
  const tags = { 'ICC-header:ProfileClass': 'Display Device Profile', 'ICC_Profile:ProfileDescription': 'sRGB IEC61966-2.1' };
  assert.equal(assessScreenshot({ fileName: 'a.png', tags, localAttributes: null }).verdict, 'unknown');
});

test('camera tags mean a photo', () => {
  const tags = { 'IFD0:Make': 'Apple', 'IFD0:Model': 'iPhone 16' };
  assert.equal(assessScreenshot({ fileName: 'IMG_1.jpg', tags, localAttributes: null }).verdict, 'camera');
});

test('screenshot marker plus camera tags conflict', () => {
  const tags = { 'ExifIFD:UserComment': 'Screenshot', 'IFD0:Make': 'Canon' };
  assert.equal(assessScreenshot({ fileName: 'a.jpg', tags, localAttributes: null }).verdict, 'conflicting');
});
