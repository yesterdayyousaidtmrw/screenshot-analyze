import { globSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const WILDCARD = /[*?]/;
const SKIPPED_DIRECTORY = /(^|[/\\])(\.[^/\\]+|node_modules)([/\\]|$)/;

function expandWildcard(path: string): string[] {
  const matches = globSync(path.replaceAll('\\', '/'));
  return matches.length > 0 ? matches : [path];
}

function walkDirectory(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !SKIPPED_DIRECTORY.test(path.slice(directory.length)));
}

function isDirectory(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false;
}

/** cmd and PowerShell pass wildcards through unexpanded, unlike POSIX shells. */
export function expandPaths(
  paths: string[],
  platform: NodeJS.Platform = process.platform,
  recursive = false,
): string[] {
  const expanded = platform === 'win32'
    ? paths.flatMap((path) => (WILDCARD.test(path) ? expandWildcard(path) : [path]))
    : paths;
  return recursive ? expanded.flatMap((path) => (isDirectory(path) ? walkDirectory(path) : [path])) : expanded;
}

export function parsePathList(text: string): string[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}
