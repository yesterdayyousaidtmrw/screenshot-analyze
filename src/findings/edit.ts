import { parseExifDate } from '../exif-date.ts';
import { parseFilenameTime } from '../filename-time.ts';
import { findNumber, findText } from '../tags.ts';
import type { Finding, Tags } from '../types.ts';

const EDITOR =
  /photoshop|lightroom|gimp|affinity|pixelmator|canva|snapseed|paint\.net|imagemagick|graphicsmagick|facetune|picsart|krita|figma|sketch/i;
const SOFTWARE_TAGS = ['Software', 'CreatorTool', 'ProcessingSoftware', 'HistorySoftwareAgent', 'JPEGDigest'];
const DATE_TOLERANCE_MS = 60_000;
const FILENAME_TOLERANCE_MS = 5 * 60_000;

export interface EditInput {
  fileName: string;
  modifiedAt: string;
  tags: Tags;
}

function editorFindings(tags: Tags): Finding[] {
  return SOFTWARE_TAGS.flatMap((name): Finding[] => {
    const software = findText(tags, name);
    if (!software || !EDITOR.test(software)) return [];
    return [{ severity: 'warn', area: 'edit', message: `processed by editing software: ${software}` }];
  });
}

function embeddedDateFindings(tags: Tags): Finding[] {
  const captured = parseExifDate(tags['ExifIFD:DateTimeOriginal']);
  const modified = parseExifDate(tags['IFD0:ModifyDate']);
  if (captured === null || modified === null || Math.abs(modified - captured) <= DATE_TOLERANCE_MS) return [];
  return [{
    severity: 'warn',
    area: 'edit',
    message: `embedded modify date (${tags['IFD0:ModifyDate']}) differs from capture date (${tags['ExifIFD:DateTimeOriginal']})`,
  }];
}

function dimensionFindings(tags: Tags): Finding[] {
  const width = findNumber(tags, 'ImageWidth');
  const height = findNumber(tags, 'ImageHeight');
  const recordedWidth = findNumber(tags, 'ExifImageWidth');
  const recordedHeight = findNumber(tags, 'ExifImageHeight');
  if (width === null || height === null || recordedWidth === null || recordedHeight === null) return [];
  const sameSize = width === recordedWidth && height === recordedHeight;
  const rotated = width === recordedHeight && height === recordedWidth;
  if (sameSize || rotated) return [];
  return [{
    severity: 'warn',
    area: 'edit',
    message: `pixels are ${width}x${height} but metadata recorded ${recordedWidth}x${recordedHeight} (cropped or resized after capture)`,
  }];
}

function filenameTimeFindings({ fileName, modifiedAt }: EditInput): Finding[] {
  const named = parseFilenameTime(fileName);
  if (!named) return [];
  const driftMs = new Date(modifiedAt).getTime() - named.getTime();
  if (Math.abs(driftMs) <= FILENAME_TOLERANCE_MS) return [];
  const minutes = Math.round(Math.abs(driftMs) / 60_000);
  return [{
    severity: 'info',
    area: 'edit',
    message: `file modified time is ${minutes} min from the time in its name (re-saved, renamed, or a different timezone)`,
  }];
}

export function editFindings(input: EditInput): Finding[] {
  return [
    ...editorFindings(input.tags),
    ...embeddedDateFindings(input.tags),
    ...dimensionFindings(input.tags),
    ...filenameTimeFindings(input),
  ];
}
