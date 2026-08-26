/**
 * Calendar-day helpers.
 *
 * Everything here works in the user's *local* calendar and passes days around
 * as "YYYY-MM-DD" strings. That is deliberate: toISOString() converts to UTC
 * first, so a task added at 11pm anywhere behind UTC would be filed under
 * tomorrow, and one added at 1am ahead of UTC under yesterday.
 */

const pad = (n) => String(n).padStart(2, "0");

/** Local calendar day of a Date, as YYYY-MM-DD. */
export function toKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** YYYY-MM-DD back to a Date at local midnight. */
export function fromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = () => toKey(new Date());

/**
 * Shifts a day key by n days.
 *
 * Goes through setDate rather than adding milliseconds, because a day is not
 * always 24 hours - on a daylight-saving boundary the arithmetic version lands
 * on the wrong date.
 */
export function addDays(key, n) {
  const date = fromKey(key);
  date.setDate(date.getDate() + n);
  return toKey(date);
}

export function addMonths(key, n) {
  const date = fromKey(key);
  const day = date.getDate();

  date.setDate(1); // avoids 31 Jan + 1 month landing in March
  date.setMonth(date.getMonth() + n);

  // Clamp to the last day of the new month.
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));

  return toKey(date);
}

/** First and last day of the month containing `key`. */
export function monthRange(key) {
  const date = fromKey(key);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  return { from: toKey(first), to: toKey(last) };
}

// Weeks start on Monday.
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Six rows of seven days covering the month containing `key`, padded out with
 * the neighbouring months so the grid never changes height as you page through.
 */
export function monthGrid(key) {
  const date = fromKey(key);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);

  // getDay() is 0 for Sunday; shift so Monday is 0.
  const lead = (first.getDay() + 6) % 7;

  const start = new Date(first);
  start.setDate(first.getDate() - lead);

  const month = date.getMonth();
  const weeks = [];

  for (let w = 0; w < 6; w += 1) {
    const week = [];
    for (let d = 0; d < 7; d += 1) {
      const cell = new Date(start);
      cell.setDate(start.getDate() + w * 7 + d);
      week.push({ key: toKey(cell), day: cell.getDate(), inMonth: cell.getMonth() === month });
    }
    weeks.push(week);
  }

  return weeks;
}

export function monthLabel(key) {
  return fromKey(key).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** "Wednesday, 26 August" - with Today and Yesterday named rather than dated. */
export function dayLabel(key) {
  const today = todayKey();
  if (key === today) return "Today";
  if (key === addDays(today, -1)) return "Yesterday";
  if (key === addDays(today, 1)) return "Tomorrow";

  return fromKey(key).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** The full date, always - used as a subtitle under a relative label. */
export function fullLabel(key) {
  return fromKey(key).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export const isPast = (key) => key < todayKey();
export const isToday = (key) => key === todayKey();
