import type { SectionSpec } from './pick-fields.ts';

export const DOCUMENT_SECTION: SectionSpec = {
  id: 'document',
  title: 'Document',
  fields: [
    { label: 'Title', tags: ['PDF:Title', 'XML:Title'] },
    { label: 'Author', tags: ['PDF:Author', 'XML:Creator'] },
    { label: 'Last editor', tags: ['LastModifiedBy'] },
    { label: 'Company', tags: ['Company'] },
    { label: 'Created with', tags: ['PDF:Creator', 'XML:Application', 'Application'] },
    { label: 'Producer', tags: ['Producer'] },
    { label: 'Pages', tags: ['PageCount', 'Pages'] },
    { label: 'Words', tags: ['Words'] },
    { label: 'Revision', tags: ['RevisionNumber'] },
    { label: 'Edit time', tags: ['TotalEditTime'] },
    { label: 'Template', tags: ['Template'] },
    { label: 'PDF version', tags: ['PDFVersion'] },
    { label: 'Encrypted', tags: ['Encryption'] },
    { label: 'Created', tags: ['PDF:CreateDate', 'XML:CreateDate'] },
    { label: 'Modified', tags: ['PDF:ModifyDate', 'XML:ModifyDate'] },
  ],
};
