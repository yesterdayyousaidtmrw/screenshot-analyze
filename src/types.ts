export type TagValue = string | number | boolean | TagValue[];
export type Tags = Record<string, TagValue>;

export type Severity = 'high' | 'warn' | 'info';
export type FindingArea = 'privacy' | 'edit' | 'upload' | 'integrity' | 'provenance';

export interface Field {
  label: string;
  value: string;
}

export interface Section {
  id: string;
  title: string;
  fields: Field[];
}

export interface NearestPlace {
  city: string | null;
  region: string | null;
  country: string | null;
  timeZone: string | null;
  distance: string | null;
}

export interface LocationFacts {
  latitude: number;
  longitude: number;
  altitude: string | null;
  direction: string | null;
  speed: string | null;
  accuracy: string | null;
  gpsTime: string | null;
  mapUrl: string;
  nearestPlace: NearestPlace | null;
}

export interface Finding {
  severity: Severity;
  area: FindingArea;
  message: string;
}

export interface FileFacts {
  sizeBytes: number;
  md5: string;
  sha1: string;
  sha256: string;
  createdAt: string;
  modifiedAt: string;
}

export interface TypeFacts {
  extension: string;
  detectedExtension: string | null;
  detectedMime: string | null;
}

export interface ImageFacts {
  width: number | null;
  height: number | null;
  dpi: number | null;
  colorProfile: string | null;
}

export interface Quarantine {
  downloadedAt: string | null;
  agent: string | null;
}

export interface LocalAttributes {
  source: 'macos' | 'windows';
  downloadZone: string | null;
  isScreenCapture: boolean | null;
  captureType: string | null;
  captureRect: number[] | null;
  whereFroms: string[];
  quarantine: Quarantine | null;
}

export type TrailingData =
  | { status: 'not-applicable' }
  | { status: 'skipped'; reason: string }
  | { status: 'truncated' }
  | { status: 'checked'; trailingBytes: number; allZero: boolean; payload: string | null };

export type ScreenshotVerdict = 'marked' | 'conflicting' | 'likely' | 'possible' | 'camera' | 'unknown';
export type EvidenceWeight = 'strong' | 'moderate' | 'weak' | 'against';

export interface Evidence {
  weight: EvidenceWeight;
  detail: string;
}

export interface ScreenshotAssessment {
  verdict: ScreenshotVerdict;
  evidence: Evidence[];
}

export interface ElaFacts {
  meanError: number;
  unevenness: number;
  heatmapPath: string | null;
}

export interface Indicators {
  urls: string[];
  emails: string[];
  userPaths: string[];
}

export interface ForensicsFacts {
  perceptualHash: string | null;
  ela: ElaFacts | null;
  thumbnailDistance: number | null;
  thumbnailPath: string | null;
  indicators: Indicators;
}

export type StripResult =
  | { status: 'cleaned'; cleanedPath: string; tagsBefore: number; tagsAfter: number; remaining: Finding[] }
  | { status: 'failed'; error: string };

export interface Report {
  path: string;
  name: string;
  file: FileFacts;
  type: TypeFacts;
  image: ImageFacts;
  location: LocationFacts | null;
  sections: Section[];
  forensics: ForensicsFacts | null;
  strip: StripResult | null;
  localAttributes: LocalAttributes | null;
  trailingData: TrailingData;
  screenshot: ScreenshotAssessment;
  findings: Finding[];
  exiftoolWarnings: string[];
  tags: Tags;
}
