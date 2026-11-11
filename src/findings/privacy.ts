import { findText } from '../tags.ts';
import type { Finding, LocalAttributes, LocationFacts, Tags } from '../types.ts';

const IDENTITY_TAGS: Array<[string, string]> = [
  ['SerialNumber', 'device serial number'],
  ['InternalSerialNumber', 'device serial number'],
  ['LensSerialNumber', 'lens serial number'],
  ['OwnerName', 'owner name'],
  ['CameraOwnerName', 'owner name'],
  ['Artist', 'author name'],
  ['Creator', 'author name'],
  ['Author', 'author name'],
  ['By-line', 'author name'],
  ['LastModifiedBy', 'last editor name'],
  ['Company', 'company name'],
  ['Manager', 'manager name'],
  ['HostComputer', 'computer name'],
  ['CreatorWorkEmail', 'contact email'],
  ['CreatorWorkTelephone', 'contact phone'],
  ['CreatorAddress', 'contact address'],
];
// Music credits are not personal data, and PDF:Creator is the app that made the file.
const NOT_PERSONAL = /^(ID3|ItemList|Vorbis|RIFF|APE|UserData)|^PDF:Creator$/;
const DEVICE_TAGS = ['Make', 'Model'];
const PEOPLE_TAGS = ['RegionName', 'RegionPersonDisplayName', 'PersonInImage'];
const WRITTEN_PLACE_TAGS = ['Sub-location', 'City', 'Province-State', 'State', 'Country-PrimaryLocationName', 'Country'];
const EMBEDDED_IMAGE = /:(ThumbnailImage|PreviewImage|OtherImage|JpgFromRaw|MPImage\d*)$/;

function gpsFindings(location: LocationFacts | null): Finding[] {
  if (!location) return [];
  const place = location.nearestPlace;
  const near = place ? ` near ${[place.city, place.country].filter(Boolean).join(', ')}` : '';
  return [{
    severity: 'high',
    area: 'privacy',
    message: `embedded GPS location: ${location.latitude}, ${location.longitude}${near}`,
  }];
}

function identityFindings(tags: Tags): Finding[] {
  const personal = Object.fromEntries(Object.entries(tags).filter(([key]) => !NOT_PERSONAL.test(key)));
  const messages = IDENTITY_TAGS.flatMap(([name, label]) => {
    const value = findText(personal, name);
    return value ? [`embedded ${label}: ${value}`] : [];
  });
  return [...new Set(messages)].map((message) => ({ severity: 'warn', area: 'privacy', message }));
}

function peopleFindings(tags: Tags): Finding[] {
  const people = PEOPLE_TAGS.map((name) => findText(tags, name)).find(Boolean);
  return people ? [{ severity: 'warn', area: 'privacy', message: `names people in the image: ${people}` }] : [];
}

function writtenPlaceFindings(tags: Tags): Finding[] {
  const place = [...new Set(WRITTEN_PLACE_TAGS.flatMap((name) => findText(tags, name) ?? []))].join(', ');
  return place ? [{ severity: 'warn', area: 'privacy', message: `place written in metadata: ${place}` }] : [];
}

function deviceFindings(tags: Tags): Finding[] {
  const [make, model] = DEVICE_TAGS.map((name) => findText(tags, name));
  const device = make && model?.toLowerCase().startsWith(make.toLowerCase()) ? model : [make, model].filter(Boolean).join(' ');
  return device ? [{ severity: 'info', area: 'privacy', message: `embedded device: ${device}` }] : [];
}

function embeddedImageFindings(tags: Tags): Finding[] {
  const found = Object.keys(tags).filter((key) => EMBEDDED_IMAGE.test(key));
  if (found.length === 0) return [];
  return [{
    severity: 'info',
    area: 'privacy',
    message: `embedded preview images (${found.join(', ')}) may show the picture before it was cropped or edited`,
  }];
}

function sourceFindings(localAttributes: LocalAttributes | null): Finding[] {
  if (!localAttributes || localAttributes.whereFroms.length === 0) return [];
  return [{
    severity: 'info',
    area: 'privacy',
    message: `downloaded from: ${localAttributes.whereFroms.join(', ')} (local file attribute, usually not uploaded with the file)`,
  }];
}

export function privacyFindings(
  tags: Tags,
  location: LocationFacts | null,
  localAttributes: LocalAttributes | null,
): Finding[] {
  return [
    ...gpsFindings(location),
    ...identityFindings(tags),
    ...peopleFindings(tags),
    ...writtenPlaceFindings(tags),
    ...deviceFindings(tags),
    ...embeddedImageFindings(tags),
    ...sourceFindings(localAttributes),
  ];
}
