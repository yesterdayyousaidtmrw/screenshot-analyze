import type { SectionSpec } from './pick-fields.ts';

export const TRACES_SECTION: SectionSpec = {
  id: 'traces',
  title: 'IDs and edit history',
  fields: [
    { label: 'Image ID', tags: ['ImageUniqueID'] },
    { label: 'Live photo ID', tags: ['ContentIdentifier', 'MediaGroupUUID'] },
    { label: 'Document ID', tags: ['DocumentID'] },
    { label: 'Original ID', tags: ['OriginalDocumentID'] },
    { label: 'Instance ID', tags: ['InstanceID'] },
    { label: 'Uptime', tags: ['RunTimeSincePowerUp'] },
    { label: 'Capture mode', tags: ['ImageCaptureType'] },
    { label: 'Edit actions', tags: ['HistoryAction'] },
    { label: 'Edit tools', tags: ['HistorySoftwareAgent'] },
    { label: 'Edit times', tags: ['HistoryWhen'] },
    { label: 'Source type', tags: ['DigitalSourceType'] },
    { label: 'Credit', tags: ['Credit'] },
    { label: 'Claim by', tags: ['ClaimGenerator'] },
  ],
};
