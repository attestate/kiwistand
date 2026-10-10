// @format
// ISO 8601 weeks (Monday to Sunday, week 1 holds the year's first Thursday)
// in UTC, for the /weekly archive. A week is { year, week } where year is the
// ISO week-numbering year, so 2026-W01 starts on Monday 29 December 2025.
const DAY = 24 * 60 * 60;
const WEEK = 7 * DAY;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// The ISO week of a unix timestamp (seconds).
export function weekOf(timestamp) {
  const date = new Date(timestamp * 1000);
  const day = (date.getUTCDay() + 6) % 7; // Monday = 0
  // The week belongs to the year its Thursday is in.
  const thursday = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - day + 3,
  );
  const year = new Date(thursday).getUTCFullYear();
  const week = 1 + Math.floor((thursday - Date.UTC(year, 0, 1)) / (WEEK * 1000));
  return { year, week };
}

export function weeksInYear(year) {
  // 28 December is always in the year's last week.
  return weekOf(Date.UTC(year, 11, 28) / 1000).week;
}

// Unix seconds of the week's Monday 00:00 UTC (start) and the next Monday
// (end, exclusive).
export function range({ year, week }) {
  // 4 January is always in week 1.
  const jan4 = Date.UTC(year, 0, 4) / 1000;
  const day = (new Date(jan4 * 1000).getUTCDay() + 6) % 7;
  const start = jan4 - day * DAY + (week - 1) * WEEK;
  return { start, end: start + WEEK };
}

export function format({ year, week }) {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function path(week) {
  return `/weekly/${format(week)}`;
}

// Accepts "2026-W41" and sloppier spellings ("2026-w41", "2026-W5",
// "2026W05"). Returns null for anything else or a week the year doesn't have.
export function parse(value) {
  const match = /^(\d{4})-?[wW](\d{1,2})$/.exec(String(value || ""));
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  if (year < 1970 || week < 1 || week > weeksInYear(year)) return null;
  return { year, week };
}

export function compare(a, b) {
  return a.year - b.year || a.week - b.week;
}

export function current(now = Date.now()) {
  return weekOf(Math.floor(now / 1000));
}

// Decides what a request for /weekly/<value> gets: a 404, a redirect to the
// canonical spelling, or the week. Only past weeks and the current one exist.
export function resolveRequest(value, now = Date.now()) {
  const week = parse(value);
  if (!week || compare(week, current(now)) > 0) return { status: 404 };
  const canonical = format(week);
  if (value !== canonical) {
    return { status: 308, location: `/weekly/${canonical}` };
  }
  return { status: 200, week, isCurrent: compare(week, current(now)) === 0 };
}

function parts(timestamp) {
  const date = new Date(timestamp * 1000);
  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth(),
    year: date.getUTCFullYear(),
  };
}

export function monthName(month) {
  return MONTHS[month];
}

// "Oct 5–11", "Sep 28–Oct 4"
export function shortRange(week) {
  const { start } = range(week);
  const from = parts(start);
  const to = parts(start + 6 * DAY);
  const mon = (m) => MONTHS[m].slice(0, 3);
  return from.month === to.month
    ? `${mon(from.month)} ${from.day}–${to.day}`
    : `${mon(from.month)} ${from.day}–${mon(to.month)} ${to.day}`;
}

// "Mon 5 to Sun 11 October 2026", "Mon 28 September to Sun 4 October 2026",
// "Mon 29 December 2025 to Sun 4 January 2026"
export function longRange(week) {
  const { start } = range(week);
  const from = parts(start);
  const to = parts(start + 6 * DAY);
  const end = `Sun ${to.day} ${MONTHS[to.month]} ${to.year}`;
  if (from.year !== to.year) {
    return `Mon ${from.day} ${MONTHS[from.month]} ${from.year} to ${end}`;
  }
  if (from.month !== to.month) {
    return `Mon ${from.day} ${MONTHS[from.month]} to ${end}`;
  }
  return `Mon ${from.day} to ${end}`;
}
