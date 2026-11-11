import { styleText } from 'node:util';
import type { Finding, NearestPlace, Report, ScreenshotVerdict, Severity } from './types.ts';

const VERDICT_LABEL: Record<ScreenshotVerdict, string> = {
  marked: 'YES, metadata marks it as a screenshot',
  conflicting: 'CONFLICTING, has both screenshot markers and camera tags',
  likely: 'LIKELY, based on name and color profile',
  possible: 'POSSIBLE, weak evidence only',
  camera: 'NO, looks like a camera photo',
  unknown: 'UNKNOWN, no markers (metadata may have been stripped)',
};
const SEVERITY_COLOR: Record<Severity, 'red' | 'yellow' | 'cyan'> = { high: 'red', warn: 'yellow', info: 'cyan' };

const heading = (text: string) => styleText('bold', text);
const row = (label: string, value: string) => `  ${label.padEnd(18)} ${value}`;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function fileSection({ file, type }: Report): string[] {
  return [
    heading('File'),
    row('Size', formatBytes(file.sizeBytes)),
    row('Real type', type.detectedMime ?? 'unrecognized'),
    row('Created', file.createdAt),
    row('Modified', file.modifiedAt),
    row('MD5', file.md5),
    row('SHA-1', file.sha1),
    row('SHA-256', file.sha256),
  ];
}

function forensicsSection({ forensics }: Report): string[] {
  if (!forensics) return [];
  const { perceptualHash, ela, thumbnailDistance, thumbnailPath } = forensics;
  const optional: Array<[string, string | null | undefined]> = [
    ['Perceptual', perceptualHash],
    ['ELA mean', ela && String(ela.meanError)],
    ['ELA uneven', ela && `${ela.unevenness}x`],
    ['ELA heat map', ela?.heatmapPath],
    ['Thumb diff', thumbnailDistance === null ? null : `${thumbnailDistance}/64 bits`],
    ['Thumbnail', thumbnailPath],
  ];
  const rows = optional.flatMap(([label, value]) => (value ? [row(label, value)] : []));
  return [heading('Forensics'), ...(rows.length === 0 ? ['  no pixel data for this file type'] : rows)];
}

function stripSection({ strip }: Report): string[] {
  if (!strip) return [];
  if (strip.status === 'failed') return [heading('Strip'), `  failed: ${strip.error}`];
  return [
    heading('Strip'),
    row('Clean copy', strip.cleanedPath),
    row('Tags', `${strip.tagsBefore} before, ${strip.tagsAfter} after`),
    ...(strip.remaining.length === 0 ? ['  no warnings left on the clean copy'] : strip.remaining.map(formatFinding)),
  ];
}

function imageSection({ image }: Report): string[] {
  const rows: string[] = [];
  if (image.width !== null && image.height !== null) rows.push(row('Dimensions', `${image.width} x ${image.height}`));
  if (image.dpi !== null) rows.push(row('DPI', String(image.dpi)));
  if (image.colorProfile) rows.push(row('Profile', image.colorProfile));
  return rows.length === 0 ? [] : [heading('Image'), ...rows];
}

function placeLabel(place: NearestPlace): string {
  const name = [place.city, place.region, place.country].filter(Boolean).join(', ');
  return place.distance ? `${name} (${place.distance} away)` : name;
}

function locationSection({ location }: Report): string[] {
  if (!location) return [];
  const optional: Array<[string, string | null | undefined]> = [
    ['Altitude', location.altitude],
    ['Direction', location.direction],
    ['Speed', location.speed],
    ['Accuracy', location.accuracy],
    ['GPS time', location.gpsTime],
    ['Nearest city', location.nearestPlace && placeLabel(location.nearestPlace)],
    ['Time zone', location.nearestPlace?.timeZone],
  ];
  return [
    heading('Location'),
    row('Coordinates', `${location.latitude}, ${location.longitude}`),
    ...optional.flatMap(([label, value]) => (value ? [row(label, value)] : [])),
    row('Map', location.mapUrl),
  ];
}

function detailSections({ sections }: Report): string[][] {
  return sections.map((section) => [
    heading(section.title),
    ...section.fields.map((field) => row(field.label, field.value)),
  ]);
}

function screenshotSection({ screenshot }: Report): string[] {
  return [
    heading('Screenshot?'),
    `  ${VERDICT_LABEL[screenshot.verdict]}`,
    ...screenshot.evidence.map((item) => `    [${item.weight}] ${item.detail}`),
  ];
}

function localSection({ localAttributes }: Report): string[] {
  if (!localAttributes) return [];
  const { source, captureType, captureRect, quarantine, downloadZone } = localAttributes;
  const rows: string[] = [];
  if (captureType) rows.push(row('Capture', captureType));
  if (captureRect) rows.push(row('Screen rect', captureRect.join(', ')));
  if (quarantine?.agent) rows.push(row('Saved by', quarantine.agent));
  if (quarantine?.downloadedAt) rows.push(row('Downloaded', quarantine.downloadedAt));
  if (downloadZone) rows.push(row('From zone', downloadZone));
  const title = source === 'macos' ? 'macOS attributes' : 'Windows attributes';
  return rows.length === 0 ? [] : [heading(`${title} (stay on this computer)`), ...rows];
}

function formatFinding(finding: Finding): string {
  const tag = styleText(SEVERITY_COLOR[finding.severity], finding.severity.toUpperCase().padEnd(4));
  return `  ${tag} ${finding.area}: ${finding.message}`;
}

function findingsSection({ findings, exiftoolWarnings }: Report): string[] {
  const lines = findings.map(formatFinding);
  const warnings = exiftoolWarnings.map((warning) => `  note exiftool: ${warning}`);
  const body = [...lines, ...warnings];
  return [heading('Findings'), ...(body.length === 0 ? ['  none'] : body)];
}

function tagsSection({ tags }: Report): string[] {
  return [heading('All tags'), ...Object.entries(tags).map(([key, value]) => `  ${key}: ${String(value)}`)];
}

export function renderReport(report: Report, showAllTags: boolean): string {
  const sections = [
    [styleText(['bold', 'underline'], report.name)],
    fileSection(report),
    imageSection(report),
    locationSection(report),
    ...detailSections(report),
    screenshotSection(report),
    localSection(report),
    forensicsSection(report),
    findingsSection(report),
    stripSection(report),
    showAllTags ? tagsSection(report) : [],
  ];
  return sections.filter((lines) => lines.length > 0).map((lines) => lines.join('\n')).join('\n\n');
}
