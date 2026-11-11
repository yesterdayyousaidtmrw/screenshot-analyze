import type { SectionSpec } from './pick-fields.ts';

export const COMPRESSION_SECTION: SectionSpec = {
  id: 'compression',
  title: 'JPEG compression',
  fields: [
    { label: 'Quality est.', tags: ['JPEGQualityEstimate'] },
    { label: 'Encoder match', tags: ['JPEGDigest'] },
    { label: 'Subsampling', tags: ['YCbCrSubSampling'] },
  ],
};
