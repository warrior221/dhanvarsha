/**
 * Date ranges for the sales reports.
 *
 * PURE MODULE — no database import, so the range picker and the query agree
 * on exactly what "last 7 days" means.
 *
 * EVERYTHING IS IN INDIAN TIME. Orders are stored as UTC instants, and a
 * naive "start of today" would begin at 5:30am IST — so an order placed at
 * 2am in Mumbai would land in yesterday's takings, and the shop owner would
 * find the numbers quietly wrong every morning.
 *
 * India has had no daylight saving since 1945, so the offset is a constant
 * +5:30 rather than anything that needs a timezone library.
 */

/** Minutes that IST runs ahead of UTC. */
const IST_OFFSET_MINUTES = 5 * 60 + 30;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/** The same instant, shifted so its UTC fields read as Indian local time. */
function toIst(instant: Date): Date {
  return new Date(instant.getTime() + IST_OFFSET_MINUTES * MS_PER_MINUTE);
}

/** Midnight at the START of the Indian day containing this instant. */
export function startOfIstDay(instant: Date): Date {
  const ist = toIst(instant);
  const midnightIst = Date.UTC(
    ist.getUTCFullYear(),
    ist.getUTCMonth(),
    ist.getUTCDate(),
  );

  return new Date(midnightIst - IST_OFFSET_MINUTES * MS_PER_MINUTE);
}

/** Midnight at the START of the NEXT Indian day: an exclusive upper bound. */
export function endOfIstDay(instant: Date): Date {
  return new Date(startOfIstDay(instant).getTime() + MS_PER_DAY);
}

/** "2026-09-24" for the Indian day containing this instant. */
export function istDateKey(instant: Date): string {
  const ist = toIst(instant);

  return [
    ist.getUTCFullYear(),
    String(ist.getUTCMonth() + 1).padStart(2, "0"),
    String(ist.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "lastmonth", label: "Last month" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
] as const;

export type RangeKey = (typeof RANGE_OPTIONS)[number]["value"];

const RANGE_KEYS = new Set<string>(RANGE_OPTIONS.map((option) => option.value));

export function isRangeKey(value: string | null): value is RangeKey {
  return value !== null && RANGE_KEYS.has(value);
}

export type DateRange = {
  key: RangeKey;
  label: string;
  /** Inclusive. */
  from: Date;
  /** EXCLUSIVE, so an order at 23:59:59 is counted and midnight is not
   *  counted twice across two ranges. */
  to: Date;
  /** How many Indian days the range spans, for the daily breakdown. */
  days: number;
};

/** Turns a range key into real instants. */
export function resolveRange(key: RangeKey, now: Date = new Date()): DateRange {
  const label = RANGE_OPTIONS.find((option) => option.value === key)!.label;
  const todayStart = startOfIstDay(now);
  const tomorrowStart = new Date(todayStart.getTime() + MS_PER_DAY);

  switch (key) {
    case "today":
      return { key, label, from: todayStart, to: tomorrowStart, days: 1 };

    case "7d":
      return {
        key,
        label,
        from: new Date(todayStart.getTime() - 6 * MS_PER_DAY),
        to: tomorrowStart,
        days: 7,
      };

    case "30d":
      return {
        key,
        label,
        from: new Date(todayStart.getTime() - 29 * MS_PER_DAY),
        to: tomorrowStart,
        days: 30,
      };

    case "month": {
      const ist = toIst(now);
      const from = istMidnight(ist.getUTCFullYear(), ist.getUTCMonth(), 1);

      return { key, label, from, to: tomorrowStart, days: daysBetween(from, tomorrowStart) };
    }

    case "lastmonth": {
      const ist = toIst(now);
      const from = istMidnight(ist.getUTCFullYear(), ist.getUTCMonth() - 1, 1);
      const to = istMidnight(ist.getUTCFullYear(), ist.getUTCMonth(), 1);

      return { key, label, from, to, days: daysBetween(from, to) };
    }

    case "year": {
      const ist = toIst(now);
      const from = istMidnight(ist.getUTCFullYear(), 0, 1);

      return { key, label, from, to: tomorrowStart, days: daysBetween(from, tomorrowStart) };
    }

    case "all":
      // The shop did not exist in 2000; this is simply "everything".
      return {
        key,
        label,
        from: new Date(Date.UTC(2000, 0, 1)),
        to: tomorrowStart,
        days: 0,
      };
  }
}

/** Midnight IST on a given Indian calendar date, as a UTC instant. */
function istMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - IST_OFFSET_MINUTES * MS_PER_MINUTE);
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / MS_PER_DAY));
}

/** Every Indian date key in the range, oldest first. Empty for "all time". */
export function dateKeysInRange(range: DateRange): string[] {
  if (range.days <= 0 || range.days > 370) return [];

  const keys: string[] = [];

  for (let i = 0; i < range.days; i += 1) {
    keys.push(istDateKey(new Date(range.from.getTime() + i * MS_PER_DAY)));
  }

  return keys;
}

/** "24 Sep" for a date key, for chart labels. */
export function shortLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  return `${day} ${MONTHS[(month ?? 1) - 1]}${year ? "" : ""}`;
}
