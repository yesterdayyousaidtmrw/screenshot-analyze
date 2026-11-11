import type { SectionSpec } from './pick-fields.ts';

export const DESCRIPTIVE_SECTION: SectionSpec = {
  id: 'descriptive',
  title: 'Description and people',
  fields: [
    { label: 'Title', tags: ['XMP-dc:Title', 'ObjectName', 'Headline'] },
    { label: 'Description', tags: ['ImageDescription', 'Caption-Abstract', 'XMP-dc:Description'] },
    { label: 'Comment', tags: ['File:Comment', 'XPComment'] },
    { label: 'Keywords', tags: ['IPTC:Keywords', 'XMP-dc:Subject', 'XPKeywords'] },
    { label: 'People', tags: ['RegionName', 'RegionPersonDisplayName', 'PersonInImage'] },
    { label: 'Copyright', tags: ['Copyright', 'CopyrightNotice', 'XMP-dc:Rights'] },
    { label: 'City', tags: ['IPTC:City', 'XMP-photoshop:City', 'XMP-iptcExt:LocationShownCity'] },
    { label: 'Place', tags: ['Sub-location', 'XMP-iptcCore:Location'] },
    { label: 'State', tags: ['Province-State', 'XMP-photoshop:State'] },
    { label: 'Country', tags: ['Country-PrimaryLocationName', 'XMP-photoshop:Country'] },
  ],
};
