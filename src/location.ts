import { findNumber, findText } from './tags.ts';
import type { LocationFacts, NearestPlace, Tags } from './types.ts';

type Coordinates = [latitude: number, longitude: number];

const isValid = ([latitude, longitude]: Coordinates) => Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
const asNumber = (value: unknown) => (typeof value === 'number' ? value : null);

function signedPair(latitude: unknown, longitude: unknown): Coordinates | null {
  const lat = asNumber(latitude);
  const lon = asNumber(longitude);
  return lat === null || lon === null ? null : [lat, lon];
}

// GPS:GPSLatitude is unsigned; the hemisphere lives in its Ref tag.
function fromGpsGroup(tags: Tags): Coordinates | null {
  const pair = signedPair(tags['GPS:GPSLatitude'], tags['GPS:GPSLongitude']);
  if (!pair) return null;
  const south = /^s/i.test(String(tags['GPS:GPSLatitudeRef'] ?? ''));
  const west = /^w/i.test(String(tags['GPS:GPSLongitudeRef'] ?? ''));
  return [south ? -pair[0] : pair[0], west ? -pair[1] : pair[1]];
}

function fromPositionText(text: string | null): Coordinates | null {
  const match = text && /^\s*(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)/.exec(text);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

export function readCoordinates(tags: Tags): Coordinates | null {
  const candidates = [
    signedPair(tags['Composite:GPSLatitude'], tags['Composite:GPSLongitude']),
    fromGpsGroup(tags),
    signedPair(tags['XMP-exif:GPSLatitude'], tags['XMP-exif:GPSLongitude']),
    fromPositionText(findText(tags, 'GPSPosition')),
    fromPositionText(findText(tags, 'GPSCoordinates')),
  ];
  return candidates.find((pair): pair is Coordinates => pair !== null && isValid(pair)) ?? null;
}

function withReference(tags: Tags, valueTag: string, referenceTag: string, unit = ''): string | null {
  const value = findText(tags, valueTag);
  if (value === null) return null;
  const reference = findText(tags, referenceTag);
  return `${value}${unit}${reference ? ` (${reference})` : ''}`;
}

function readAltitude(tags: Tags): string | null {
  const signed = asNumber(tags['Composite:GPSAltitude']) ?? findNumber(tags, 'GPSAltitude');
  return signed === null ? null : `${Math.round(signed * 10) / 10} m`;
}

function readNearestPlace(tags: Tags): NearestPlace | null {
  const city = findText(tags, 'GeolocationCity');
  const country = findText(tags, 'GeolocationCountry');
  if (!city && !country) return null;
  return {
    city,
    region: findText(tags, 'GeolocationRegion'),
    country,
    timeZone: findText(tags, 'GeolocationTimeZone'),
    distance: findText(tags, 'GeolocationDistance'),
  };
}

export function readLocation(tags: Tags): LocationFacts | null {
  const coordinates = readCoordinates(tags);
  if (!coordinates) return null;
  const [latitude, longitude] = coordinates;
  return {
    latitude,
    longitude,
    altitude: readAltitude(tags),
    direction: withReference(tags, 'GPSImgDirection', 'GPSImgDirectionRef', '°'),
    speed: withReference(tags, 'GPSSpeed', 'GPSSpeedRef'),
    accuracy: findText(tags, 'GPSHPositioningError'),
    gpsTime: findText(tags, 'GPSDateTime'),
    mapUrl: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`,
    nearestPlace: readNearestPlace(tags),
  };
}
