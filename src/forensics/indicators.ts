import { readFile } from 'node:fs/promises';
import type { Finding, Indicators } from '../types.ts';

const MAX_SCAN_BYTES = 64 * 1024 * 1024;
const MAX_PER_KIND = 10;
const URL = /https?:\/\/[A-Za-z0-9][A-Za-z0-9._~:/?#@!$&'()*+,;=%-]{3,200}/g;
// Lowercase domains only: random binary bytes usually mix case.
const EMAIL = /[A-Za-z0-9._+-]{1,64}@[a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63})*\.[a-z]{2,12}(?![A-Za-z0-9])/g;
// "icon@2x.png" asset names, Chrome MHTML part IDs, Sentry DSNs.
const NOT_EMAIL = /@\dx\.|\.(png|jpe?g|gif|svg|webp|js|css|blink)$|\.sentry\.io$/;
const USER_PATH = /(?:\/Users\/|\/home\/|[A-Z]:\\Users\\)[A-Za-z0-9._-]{2,32}/g;
// Schema namespaces appear in nearly every XMP or ICC block and say nothing about the file.
const SCHEMA_HOST = /(?:ns\.adobe\.com|w3\.org|purl\.org|iptc\.org|cipa\.jp|apple\.com\/DTDs|ns\.google\.com|ns\.microsoft\.com|color\.org|aiim\.org|xmlsoap\.org|schemas\.)/i;

function unique(matches: Iterable<string>): string[] {
  return [...new Set(matches)].slice(0, MAX_PER_KIND);
}

export function extractIndicators(text: string): Indicators {
  return {
    urls: unique([...text.matchAll(URL)].map(([url]) => url).filter((url) => !SCHEMA_HOST.test(url))),
    emails: unique([...text.matchAll(EMAIL)].map(([email]) => email).filter((email) => !NOT_EMAIL.test(email))),
    userPaths: unique([...text.matchAll(USER_PATH)].map(([path]) => path)),
  };
}

export function indicatorFindings({ urls, emails, userPaths }: Indicators): Finding[] {
  const findings: Finding[] = [];
  if (userPaths.length > 0) {
    findings.push({ severity: 'warn', area: 'privacy', message: `local user path inside the file: ${userPaths.join(', ')}` });
  }
  if (emails.length > 0) {
    findings.push({ severity: 'warn', area: 'privacy', message: `email address inside the file: ${emails.join(', ')}` });
  }
  if (urls.length > 0) findings.push({ severity: 'info', area: 'privacy', message: `URLs inside the file: ${urls.join(', ')}` });
  return findings;
}

export async function readIndicators(path: string, sizeBytes: number): Promise<Indicators> {
  if (sizeBytes > MAX_SCAN_BYTES) return { urls: [], emails: [], userPaths: [] };
  return extractIndicators((await readFile(path)).toString('latin1'));
}
