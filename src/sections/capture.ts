import type { SectionSpec } from './pick-fields.ts';

export const CAPTURE_SECTION: SectionSpec = {
  id: 'capture',
  title: 'Capture time',
  fields: [
    { label: 'Taken', tags: ['Composite:SubSecDateTimeOriginal', 'DateTimeOriginal', 'CreationDate'] },
    { label: 'Digitized', tags: ['CreateDate', 'MediaCreateDate'] },
    { label: 'Modified', tags: ['ModifyDate', 'MetadataDate', 'MediaModifyDate'] },
    { label: 'UTC offset', tags: ['OffsetTimeOriginal', 'OffsetTime', 'TimeZone'] },
  ],
};
