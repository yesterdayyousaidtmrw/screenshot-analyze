import sharp from 'sharp';

const RESAVE_QUALITY = 95;
const CHANNELS = 3;
const BLOCK_SIZE = 16;
const PERCENTILE = 0.99;

export interface ErrorMap {
  errors: Uint8Array;
  width: number;
  height: number;
}

/** Per-pixel difference between the image and a fresh JPEG re-save of it. */
export async function computeErrorMap(path: string): Promise<ErrorMap> {
  const original = await sharp(path, { failOn: 'none' }).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = original.info;
  if (channels !== CHANNELS) throw new Error(`expected ${CHANNELS} channels, got ${channels}`);
  const raw = { width, height, channels: CHANNELS } as const;
  const resaved = await sharp(original.data, { raw }).jpeg({ quality: RESAVE_QUALITY, chromaSubsampling: '4:4:4' }).toBuffer();
  const decoded = await sharp(resaved).removeAlpha().raw().toBuffer();
  const errors = new Uint8Array(width * height);
  for (let pixel = 0; pixel < errors.length; pixel++) {
    let largest = 0;
    for (let channel = 0; channel < CHANNELS; channel++) {
      const index = pixel * CHANNELS + channel;
      largest = Math.max(largest, Math.abs((original.data[index] ?? 0) - (decoded[index] ?? 0)));
    }
    errors[pixel] = largest;
  }
  return { errors, width, height };
}

export function meanError({ errors }: ErrorMap): number {
  return errors.length === 0 ? 0 : errors.reduce((sum, value) => sum + value, 0) / errors.length;
}

function blockMeans({ errors, width, height }: ErrorMap): number[] {
  const means: number[] = [];
  for (let top = 0; top < height; top += BLOCK_SIZE) {
    for (let left = 0; left < width; left += BLOCK_SIZE) {
      let sum = 0;
      let count = 0;
      for (let y = top; y < Math.min(top + BLOCK_SIZE, height); y++) {
        for (let x = left; x < Math.min(left + BLOCK_SIZE, width); x++) {
          sum += errors[y * width + x] ?? 0;
          count++;
        }
      }
      means.push(sum / count);
    }
  }
  return means.sort((a, b) => a - b);
}

/** How far the noisiest blocks stand above the typical block. */
export function unevenness(map: ErrorMap): number {
  const means = blockMeans(map);
  const median = means[Math.floor(means.length / 2)] ?? 0;
  const high = means[Math.floor((means.length - 1) * PERCENTILE)] ?? 0;
  return high / Math.max(median, 1);
}

export async function writeHeatmap(map: ErrorMap, destination: string): Promise<void> {
  const peak = Math.max(1, ...map.errors);
  const scaled = Buffer.from(map.errors.map((value) => Math.round((value / peak) * 255)));
  await sharp(scaled, { raw: { width: map.width, height: map.height, channels: 1 } }).png().toFile(destination);
}
