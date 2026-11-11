import type { Section, Tags } from '../types.ts';
import { CAMERA_SECTION } from './camera.ts';
import { CAPTURE_SECTION } from './capture.ts';
import { COMPRESSION_SECTION } from './compression.ts';
import { DESCRIPTIVE_SECTION } from './descriptive.ts';
import { DOCUMENT_SECTION } from './document.ts';
import { MEDIA_SECTION } from './media.ts';
import { pickSection } from './pick-fields.ts';
import { TRACES_SECTION } from './traces.ts';

const SECTIONS = [
  CAMERA_SECTION,
  CAPTURE_SECTION,
  COMPRESSION_SECTION,
  MEDIA_SECTION,
  DOCUMENT_SECTION,
  DESCRIPTIVE_SECTION,
  TRACES_SECTION,
];

export function readSections(tags: Tags): Section[] {
  return SECTIONS.flatMap((spec) => pickSection(tags, spec) ?? []);
}
