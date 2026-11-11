import sharp from 'sharp';

const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;
export const HASH_BITS = 64;

/** 64-bit difference hash, auto-rotated so EXIF orientation doesn't change it. */
export async function differenceHash(input: string | Buffer): Promise<string> {
  const pixels = await sharp(input, { failOn: 'none' })
    .rotate()
    .greyscale()
    .resize(HASH_WIDTH, HASH_HEIGHT, { fit: 'fill' })
    .raw()
    .toBuffer();
  let bits = 0n;
  for (let row = 0; row < HASH_HEIGHT; row++) {
    for (let column = 0; column < HASH_WIDTH - 1; column++) {
      const left = pixels[row * HASH_WIDTH + column] ?? 0;
      const right = pixels[row * HASH_WIDTH + column + 1] ?? 0;
      bits = (bits << 1n) | (left < right ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, '0');
}

export function hammingDistance(first: string, second: string): number {
  let difference = BigInt(`0x${first}`) ^ BigInt(`0x${second}`);
  let count = 0;
  while (difference > 0n) {
    count += Number(difference & 1n);
    difference >>= 1n;
  }
  return count;
}
