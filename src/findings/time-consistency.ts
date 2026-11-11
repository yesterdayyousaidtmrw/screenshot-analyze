import { parseExifDate, parseOffsetMinutes, zoneOffsetMinutes } from '../exif-date.ts';
import { findText } from '../tags.ts';
import type { Finding, Tags } from '../types.ts';

const GPS_TOLERANCE_MS = 5 * 60_000;
const FUTURE_TOLERANCE_MS = 24 * 60 * 60_000;

function captureOffset(tags: Tags): number | null {
  return parseOffsetMinutes(tags['ExifIFD:OffsetTimeOriginal'] ?? tags['ExifIFD:OffsetTime']);
}

function gpsClockFindings(tags: Tags): Finding[] {
  const localMs = parseExifDate(tags['ExifIFD:DateTimeOriginal']);
  const offset = captureOffset(tags);
  const gpsMs = parseExifDate(tags['Composite:GPSDateTime']);
  if (localMs === null || offset === null || gpsMs === null) return [];
  const driftMs = Math.abs(localMs - offset * 60_000 - gpsMs);
  if (driftMs <= GPS_TOLERANCE_MS) return [];
  return [{
    severity: 'warn',
    area: 'edit',
    message: `capture time and GPS clock differ by ${Math.round(driftMs / 60_000)} min (wrong clock or altered date)`,
  }];
}

function zoneFindings(tags: Tags): Finding[] {
  const localMs = parseExifDate(tags['ExifIFD:DateTimeOriginal']);
  const offset = captureOffset(tags);
  const zone = findText(tags, 'GeolocationTimeZone');
  if (localMs === null || offset === null || !zone) return [];
  const expected = zoneOffsetMinutes(zone, localMs - offset * 60_000);
  if (expected === null || expected === offset) return [];
  return [{
    severity: 'info',
    area: 'edit',
    message: `recorded UTC offset does not match ${zone} at the GPS location (traveling, border area, or altered data)`,
  }];
}

function futureFindings(tags: Tags, nowMs: number): Finding[] {
  const localMs = parseExifDate(tags['ExifIFD:DateTimeOriginal']);
  if (localMs === null || localMs <= nowMs + FUTURE_TOLERANCE_MS) return [];
  return [{ severity: 'warn', area: 'edit', message: `capture date is in the future: ${tags['ExifIFD:DateTimeOriginal']}` }];
}

export function timeConsistencyFindings(tags: Tags, nowMs: number = Date.now()): Finding[] {
  return [...gpsClockFindings(tags), ...zoneFindings(tags), ...futureFindings(tags, nowMs)];
}
