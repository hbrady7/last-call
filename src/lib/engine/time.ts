/**
 * All schedule math lives in America/Chicago. We derive the bar's wall-clock
 * fields from any instant via Intl (host-timezone independent), then do every
 * comparison in "minute of the week" space [0, 10080) so midnight-crossing
 * windows and the Saturday→Sunday wrap fall out of simple modular arithmetic.
 */
export const CHICAGO_TZ = "America/Chicago";
export const MINUTES_PER_DAY = 1440;
export const MINUTES_PER_WEEK = 10080;

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export interface ChicagoNow {
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  /** minutes since local midnight */
  minuteOfDay: number;
  /** minute within the week, 0 = Sunday 00:00 */
  weekMinute: number;
}

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: CHICAGO_TZ,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function chicagoNow(now: Date): ChicagoNow {
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = WEEKDAY_INDEX[get("weekday")] ?? 0;
  // Intl can emit "24" for midnight in hour23 mode; normalise to 0.
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(get("minute"), 10);
  const minuteOfDay = hour * 60 + minute;
  return {
    weekday,
    minuteOfDay,
    weekMinute: weekday * MINUTES_PER_DAY + minuteOfDay,
  };
}

/** "HH:mm" → minutes since midnight. */
export function parseHHmm(t: string): number {
  const [h, m] = t.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}

/** minutes since midnight → "H:MM AM/PM" for display. */
export function formatMinuteOfDay(min: number): string {
  const m = ((min % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  let h = Math.floor(m / 60);
  const mm = m % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${mm.toString().padStart(2, "0")} ${ampm}`;
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
