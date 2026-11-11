import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readCoordinates, readLocation } from '../src/location.ts';
import { pickSection } from '../src/sections/pick-fields.ts';
import { CAMERA_SECTION } from '../src/sections/camera.ts';
import { readSections } from '../src/sections/index.ts';

test('Composite coordinates keep their sign', () => {
  const tags = { 'GPS:GPSLongitude': 1.9, 'GPS:GPSLatitude': 54.9, 'Composite:GPSLatitude': 54.9, 'Composite:GPSLongitude': -1.9 };
  assert.deepEqual(readCoordinates(tags), [54.9, -1.9]);
});

test('GPS group alone applies hemisphere refs', () => {
  const tags = { 'GPS:GPSLatitude': 33.8, 'GPS:GPSLatitudeRef': 'South', 'GPS:GPSLongitude': 151.2, 'GPS:GPSLongitudeRef': 'East' };
  assert.deepEqual(readCoordinates(tags), [-33.8, 151.2]);
});

test('position text parses', () => {
  assert.deepEqual(readCoordinates({ 'Keys:GPSCoordinates': '37.7 -122.4 12' }), [37.7, -122.4]);
});

test('out-of-range coordinates are rejected', () => {
  assert.equal(readCoordinates({ 'Composite:GPSLatitude': 120, 'Composite:GPSLongitude': 10 }), null);
});

test('no GPS tags means no location', () => {
  assert.equal(readLocation({ 'IFD0:Make': 'Canon' }), null);
});

test('location carries nearest place and map link', () => {
  const location = readLocation({
    'Composite:GPSLatitude': 54.9,
    'Composite:GPSLongitude': -1.9,
    'ExifTool:GeolocationCity': 'Prudhoe',
    'ExifTool:GeolocationCountry': 'United Kingdom',
    'ExifTool:GeolocationDistance': '5.07 km',
  });
  assert.equal(location?.nearestPlace?.city, 'Prudhoe');
  assert.match(location?.mapUrl ?? '', /mlat=54\.9&mlon=-1\.9/);
});

test('camera section formats aperture and shutter, drops n/a', () => {
  const section = pickSection({ 'ExifIFD:FNumber': 1.8, 'ExifIFD:ExposureTime': '1/120', 'Canon:Lens': 'n/a' }, CAMERA_SECTION);
  assert.deepEqual(section?.fields, [
    { label: 'Aperture', value: 'f/1.8' },
    { label: 'Shutter', value: '1/120 s' },
  ]);
});

test('sections with nothing to show are omitted', () => {
  assert.deepEqual(readSections({}), []);
});
