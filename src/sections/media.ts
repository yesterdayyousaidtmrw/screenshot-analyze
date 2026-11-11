import type { SectionSpec } from './pick-fields.ts';

export const MEDIA_SECTION: SectionSpec = {
  id: 'media',
  title: 'Video and audio',
  fields: [
    { label: 'Duration', tags: ['QuickTime:Duration', 'Duration', 'MediaDuration'], format: (value) => `${value} s` },
    { label: 'Video codec', tags: ['CompressorID', 'CompressorName', 'VideoCodec', 'VideoCodecID'] },
    { label: 'Frame rate', tags: ['VideoFrameRate', 'FrameRate'] },
    { label: 'Bitrate', tags: ['Composite:AvgBitrate', 'AudioBitrate'] },
    { label: 'Rotation', tags: ['Composite:Rotation'] },
    { label: 'Audio', tags: ['AudioFormat', 'AudioCodec', 'MPEGAudioVersion'] },
    { label: 'Channels', tags: ['AudioChannels', 'ChannelMode', 'NumChannels'] },
    { label: 'Sample rate', tags: ['AudioSampleRate', 'SampleRate'] },
    { label: 'Encoder', tags: ['Encoder', 'EncodedBy', 'WritingApp', 'MuxingApp'] },
    { label: 'Container', tags: ['MajorBrand'] },
    { label: 'Track title', tags: ['ID3v2_3:Title', 'ID3v2_4:Title', 'ID3v1:Title', 'ItemList:Title'] },
    { label: 'Track artist', tags: ['ID3v2_3:Artist', 'ID3v2_4:Artist', 'ID3v1:Artist', 'ItemList:Artist'] },
    { label: 'Album', tags: ['Album'] },
  ],
};
