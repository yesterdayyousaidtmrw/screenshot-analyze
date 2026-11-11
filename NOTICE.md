# Notice

Runtime libraries:

| Library | License | Used for |
| --- | --- | --- |
| ExifTool, through exiftool-vendored | GPL-1.0+ or Artistic / MIT | Metadata reading, geolocation, metadata removal |
| MediaInfo, through mediainfo.js | BSD-2-Clause | Video and audio stream details |
| sharp | Apache-2.0 | Decoding pixels for forensics |
| file-type | MIT | Real file type detection |
| bplist-parser | MIT | macOS attribute parsing |

Ideas taken from other projects:

| Project | License | What was taken |
| --- | --- | --- |
| typebleed | MIT | Polyglot format checks, adapted in `src/polyglot.ts` |
| Sherloq | GPL-3.0 | Technique only: error level analysis, thumbnail check, string search. No code copied. |
| Ghiro | No license file on GitHub | Technique only: ELA, perceptual hash, preview comparison. No code copied. |
| mat2 | LGPL-3.0 | Technique only: strip a copy and re-check it. No code copied. |
| exifLooter | Apache-2.0 | Technique only: folder scan, piped paths, map link. No code copied. |

## typebleed license

MIT License

Copyright (c) 2026 Prof.Nyanstein

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
