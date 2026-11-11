import { open } from 'node:fs/promises';
import mediaInfoFactory, { type MediaInfo } from 'mediainfo.js';
import type { Field, Section, TypeFacts } from './types.ts';

type Track = Record<string, unknown>;
type TrackFields = Array<[label: string, key: string]>;

const GENERAL_FIELDS: TrackFields = [
  ['Format', 'Format'],
  ['Overall rate', 'OverallBitRate'],
  ['Encoded by', 'Encoded_Application'],
  ['Encoder lib', 'Encoded_Library'],
  ['Encoded', 'Encoded_Date'],
];
const VIDEO_FIELDS: TrackFields = [
  ['Format', 'Format'],
  ['Profile', 'Format_Profile'],
  ['Width', 'Width'],
  ['Height', 'Height'],
  ['Frame rate', 'FrameRate'],
  ['Frame mode', 'FrameRate_Mode'],
  ['Bit rate', 'BitRate'],
  ['Bit depth', 'BitDepth'],
  ['Chroma', 'ChromaSubsampling'],
  ['HDR', 'HDR_Format'],
  ['Transfer', 'transfer_characteristics'],
];
const AUDIO_FIELDS: TrackFields = [
  ['Format', 'Format'],
  ['Channels', 'Channels'],
  ['Sample rate', 'SamplingRate'],
  ['Bit rate', 'BitRate'],
  ['Bit depth', 'BitDepth'],
  ['Language', 'Language'],
];
const FIELDS_BY_TRACK: Record<string, TrackFields> = { General: GENERAL_FIELDS, Video: VIDEO_FIELDS, Audio: AUDIO_FIELDS };

export interface MediaReader {
  read(path: string, sizeBytes: number): Promise<Section | null>;
  close(): void;
}

export const isMediaType = (type: TypeFacts) => /^(video|audio)\//.test(type.detectedMime ?? '');

export function tracksToSection(tracks: Track[]): Section | null {
  const fields: Field[] = tracks.flatMap((track) => {
    const kind = String(track['@type']);
    return (FIELDS_BY_TRACK[kind] ?? []).flatMap(([label, key]) =>
      track[key] === undefined ? [] : [{ label: kind === 'General' ? label : `${kind} ${label.toLowerCase()}`, value: String(track[key]) }],
    );
  });
  return fields.length === 0 ? null : { id: 'mediainfo', title: 'Streams (MediaInfo)', fields };
}

async function analyzeTracks(mediaInfo: MediaInfo<'object'>, path: string, sizeBytes: number): Promise<Track[]> {
  const handle = await open(path, 'r');
  try {
    const result = await mediaInfo.analyzeData(sizeBytes, async (chunkSize, offset) => {
      const buffer = new Uint8Array(chunkSize);
      const { bytesRead } = await handle.read(buffer, 0, chunkSize, offset);
      return buffer.subarray(0, bytesRead);
    });
    return (result.media?.track ?? []) as unknown as Track[];
  } finally {
    await handle.close();
  }
}

export function createMediaReader(): MediaReader {
  let instance: MediaInfo<'object'> | null = null;
  return {
    async read(path, sizeBytes) {
      instance ??= await mediaInfoFactory({ format: 'object' });
      return tracksToSection(await analyzeTracks(instance, path, sizeBytes));
    },
    close: () => instance?.close(),
  };
}
