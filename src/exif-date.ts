/** Reads "YYYY:MM:DD HH:MM:SS" as if UTC, ignoring any zone suffix. */
export function parseExifDate(raw: unknown): number | null {
  const match = typeof raw === 'string' ? /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(raw) : null;
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number) as [
    number, number, number, number, number, number,
  ];
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

/** "+05:30" or "-08:00" to minutes east of UTC. */
export function parseOffsetMinutes(raw: unknown): number | null {
  const match = typeof raw === 'string' ? /^([+-])(\d{2}):(\d{2})$/.exec(raw.trim()) : null;
  if (!match) return null;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
}

/** A named zone's offset at an instant, in minutes east of UTC. */
export function zoneOffsetMinutes(timeZone: string, utcMs: number): number | null {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(utcMs);
  const name = parts.find((part) => part.type === 'timeZoneName')?.value;
  if (name === 'GMT') return 0;
  return name ? parseOffsetMinutes(name.replace('GMT', '')) : null;
}
