import type { DayRow, Sched } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
export const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

export function t12(min: number | null | undefined): string {
  if (min == null) return "";
  let h = Math.floor(min / 60);
  const m = min % 60, ap = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  return `${pad(h)}:${pad(m)} ${ap}`;
}
export const dur = (min: number) => (!min ? "0:00" : `${Math.floor(min / 60)}:${pad(Math.round(min % 60))}`);
export const mdy = (iso: string) => { const [y, m, d] = iso.split("-"); return `${m}/${d}/${y}`; };
export const days = (n: number) => String(Math.round(n * 10) / 10);

export function periodLabel(from: string, to: string): string {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  const last = new Date(Date.UTC(y2, m2, 0)).getUTCDate();
  if (y1 === y2 && m1 === m2 && d1 === 1 && d2 === last) return `${MONTHS[m1 - 1]} ${y1}`;
  return `${mdy(from)} - ${mdy(to)}`;
}
export const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\w/g, (c) => c.toUpperCase());
export function monthLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return `${titleCase(MONTHS[m - 1])} ${y}`;
}
export const schedText = (sc: Sched) => `${t12(sc.amIn)} - ${t12(sc.amOut)} / ${t12(sc.pmIn)} - ${t12(sc.pmOut)}`;

/** Punch times for the four IN/OUT columns. compact = fill left to right like the old HR sheet. */
export function cellsFor(r: DayRow, compact: boolean): string[] {
  const t = r.slots.map((s) => t12(s));
  if (!compact) return t;
  const f = t.filter(Boolean);
  while (f.length < 4) f.push("");
  return f;
}
export const isHolidayRow = (r: DayRow) => r.remarks.length > 0 && !r.punches && r.remarks[0] !== "ABSENT";
