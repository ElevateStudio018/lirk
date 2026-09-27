/** Date helpers that work on plain YYYY-MM-DD strings in the Europe/Stockholm calendar. */

export const TIME_ZONE = "Europe/Stockholm";

export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function toUTC(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(date: string, days: number): string {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUTC(to).getTime() - toUTC(from).getTime()) / 86_400_000);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  const wd = toUTC(date).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export const WEEKDAYS = [
  { value: 1, short: "Mån", long: "måndag" },
  { value: 2, short: "Tis", long: "tisdag" },
  { value: 3, short: "Ons", long: "onsdag" },
  { value: 4, short: "Tor", long: "torsdag" },
  { value: 5, short: "Fre", long: "fredag" },
  { value: 6, short: "Lör", long: "lördag" },
  { value: 7, short: "Sön", long: "söndag" },
] as const;

/** "Idag", "Imorgon", "Torsdag", or "12 okt" for dates further away. */
export function friendlyDate(date: string, today: string = todayISO()): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "Idag";
  if (diff === 1) return "Imorgon";
  if (diff === -1) return "Igår";
  if (diff > 1 && diff < 7) {
    const name = WEEKDAYS[isoWeekday(date) - 1].long;
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", timeZone: "UTC" }).format(toUTC(date));
}

export function longDate(date: string): string {
  return new Intl.DateTimeFormat("sv-SE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(toUTC(date));
}
