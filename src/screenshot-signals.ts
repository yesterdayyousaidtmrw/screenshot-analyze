import { findText } from './tags.ts';
import type { Evidence, LocalAttributes, ScreenshotAssessment, ScreenshotVerdict, Tags } from './types.ts';

const SCREENSHOT_NAME = /(screen[\s_-]?shot|screen[\s_-]?capture|cleanshot|snip(ping)?[\s_-])/i;
const GENERIC_PROFILE = /srgb|adobe rgb|display p3|generic|rec\.? ?(709|2020)|gray|grey/i;
const CAMERA_TAGS = ['Make', 'Model', 'LensModel', 'ExposureTime', 'FNumber', 'ISO'];

export interface ScreenshotInput {
  fileName: string;
  tags: Tags;
  localAttributes: LocalAttributes | null;
}

function markerEvidence({ tags, localAttributes }: ScreenshotInput): Evidence[] {
  const evidence: Evidence[] = [];
  if (localAttributes?.isScreenCapture) {
    const kind = localAttributes.captureType ? ` (${localAttributes.captureType})` : '';
    evidence.push({ weight: 'strong', detail: `macOS flagged this file as a screen capture${kind}` });
  }
  if (findText(tags, 'UserComment')?.toLowerCase() === 'screenshot') {
    evidence.push({ weight: 'strong', detail: 'embedded UserComment is "Screenshot" (Apple capture marker)' });
  }
  return evidence;
}

function circumstantialEvidence({ fileName, tags }: ScreenshotInput): Evidence[] {
  const evidence: Evidence[] = [];
  if (SCREENSHOT_NAME.test(fileName)) {
    evidence.push({ weight: 'moderate', detail: 'file name follows a screenshot naming pattern' });
  }
  const profile = findText(tags, 'ProfileDescription');
  if (findText(tags, 'ProfileClass') === 'Display Device Profile' && profile && !GENERIC_PROFILE.test(profile)) {
    evidence.push({ weight: 'weak', detail: `color profile comes from a display: ${profile}` });
  }
  return evidence;
}

function cameraEvidence(tags: Tags): Evidence[] {
  const found = CAMERA_TAGS.filter((name) => findText(tags, name) !== null);
  return found.length === 0 ? [] : [{ weight: 'against', detail: `camera tags present: ${found.join(', ')}` }];
}

export function decideVerdict(evidence: Evidence[]): ScreenshotVerdict {
  const has = (weight: Evidence['weight']) => evidence.some((item) => item.weight === weight);
  if (has('strong')) return has('against') ? 'conflicting' : 'marked';
  if (has('against')) return 'camera';
  if (has('moderate') && has('weak')) return 'likely';
  if (has('moderate') || has('weak')) return 'possible';
  return 'unknown';
}

export function assessScreenshot(input: ScreenshotInput): ScreenshotAssessment {
  const evidence = [...markerEvidence(input), ...circumstantialEvidence(input), ...cameraEvidence(input.tags)];
  return { verdict: decideVerdict(evidence), evidence };
}
