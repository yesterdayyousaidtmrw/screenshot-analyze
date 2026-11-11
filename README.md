# screenshot analyze

CLI that analyzes the metadata of a screenshot or any uploaded file. Everything runs locally.

```
shot-analyze <file|folder...> [--json] [--all] [--deep] [--forensics] [--out <folder>] [--strip] [-r]
```

- `--all` prints every tag.
- `--deep` also reads embedded streams, such as GPS tracks in video, and unknown tags.
- `--forensics` adds error level analysis, a perceptual hash, an embedded-thumbnail comparison, and URLs, emails and user paths found in the raw bytes.
- `--out <folder>` saves the heat maps and thumbnails.
- `--strip` writes `<name>.clean.<ext>` without metadata, never changes the original, then re-checks the copy.
- `-r` walks folders. `-` reads paths from stdin.

This combines ExifTool, MediaInfo and ideas from Sherloq, Ghiro, mat2, exifLooter and typebleed. See `NOTICE.md`.

It reports:

- **File:** size, real type from magic bytes, dates, SHA-256.
- **Image:** dimensions, DPI, color profile.
- **Location:** coordinates, altitude, direction, speed, GPS time, nearest city and time zone from ExifTool's offline database, OpenStreetMap link. No network calls are made.
- **Camera:** make, model, lens, focal length, aperture, shutter, ISO, flash, white balance, metering, firmware, shutter count.
- **Capture time, video and audio, documents, descriptions, people, IDs, and edit history.**
- **Screenshot verdict:** macOS capture flag, Apple `UserComment` marker, file name, display profile, camera tags.
- **Privacy:** GPS, serial numbers, owner and author names, contact details, named people, written places, device, embedded previews, download URL.
- **Edit signs:** editing software, date mismatches, GPS clock drift, UTC offset that disagrees with the location, future dates, pixels differing from recorded dimensions.
- **AI provenance:** IPTC AI source type, AI tool names, Stable Diffusion and ComfyUI settings, C2PA credentials (detected, signature not validated).
- **Upload risk:** extension mismatch, double extensions, polyglot files, data appended after the image, scripts in metadata, SVG or PDF.
- **Streams:** codec, resolution, frame rate, bit depth, HDR and audio details from MediaInfo.
- **Hashes:** MD5, SHA-1, SHA-256.

Metadata can be forged or stripped, so every result is evidence, not proof. macOS extended attributes and the Windows `Zone.Identifier` stream stay on the computer and are usually absent from a file that was uploaded elsewhere.

Runs on macOS, Windows, and Linux. On Windows, wildcards like `*.png` are expanded by the tool. Run `npm install` on each OS rather than copying `node_modules`, because exiftool ships a different package per platform.

Exit codes: `0` analyzed, `1` a file could not be analyzed, `2` bad usage.

## Develop

```
npm install
npm test
npm run typecheck
npm link
```
