import { readMacAttributes } from './mac-attributes.ts';
import type { LocalAttributes } from './types.ts';
import { readWindowsAttributes } from './windows-attributes.ts';

export async function readLocalAttributes(path: string): Promise<LocalAttributes | null> {
  if (process.platform === 'darwin') return readMacAttributes(path);
  if (process.platform === 'win32') return readWindowsAttributes(path);
  return null;
}
