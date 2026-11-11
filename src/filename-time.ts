// JS \s covers the U+202F macOS puts before AM/PM.
const MAC_NAME = /(\d{4})-(\d{2})-(\d{2}) at (\d{1,2})\.(\d{2})\.(\d{2})\s*(AM|PM)?/i;
const ANDROID_NAME = /screenshot[_-](\d{4})-?(\d{2})-?(\d{2})[_-](\d{2})-?(\d{2})-?(\d{2})/i;

const WINDOWS_NAME = /screenshot (\d{4})-(\d{2})-(\d{2}) (\d{2})(\d{2})(\d{2})/i;

function to24Hour(hour: number, meridiem: string | undefined): number {
  if (!meridiem) return hour;
  return (hour % 12) + (meridiem.toUpperCase() === 'PM' ? 12 : 0);
}

/** Reads the capture time from a screenshot's file name, in this machine's timezone. */
export function parseFilenameTime(fileName: string): Date | null {
  const match = MAC_NAME.exec(fileName) ?? ANDROID_NAME.exec(fileName) ?? WINDOWS_NAME.exec(fileName);
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number) as [
    number, number, number, number, number, number,
  ];
  return new Date(year, month - 1, day, to24Hour(hour, match[7]), minute, second);
}
