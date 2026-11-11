import { findNumber, findText } from './tags.ts';
import type { ImageFacts, Tags } from './types.ts';

const METERS_PER_INCH = 0.0254;

function readDpi(tags: Tags): number | null {
  const resolution = findNumber(tags, 'XResolution');
  if (resolution !== null) return resolution;
  const pixelsPerMeter = findNumber(tags, 'PixelsPerUnitX');
  return pixelsPerMeter === null ? null : Math.round(pixelsPerMeter * METERS_PER_INCH);
}

export function readImageFacts(tags: Tags): ImageFacts {
  return {
    width: findNumber(tags, 'ImageWidth'),
    height: findNumber(tags, 'ImageHeight'),
    dpi: readDpi(tags),
    colorProfile: findText(tags, 'ProfileDescription'),
  };
}
