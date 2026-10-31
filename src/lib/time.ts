export type Granularity = 'day' | 'week' | 'month' | 'year';

const DAY_MS = 86_400_000;

/** One point on the chart. `index` is its position within the period. */
export interface Tick {
  label: string;
  fullLabel: string;
}

/**
 * A calendar period, shown as a chart. `end` is exclusive. Every view is one point per calendar day,
 * so the day view is a single point. The year view stops at today.
 */
export interface Period {
  start: Date;
  end: Date;
  title: string;
  ticks: Tick[];
  /** Index of the current day, or null when the period is not the current one. */
  nowIndex: number | null;
}

export const startOfDay = (ts: number | Date) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(undefined, opts);

/**
 * The calendar period `offset` steps back from the current one (0 = current). Weeks run Sunday to
 * Saturday, months run from the 1st to the last day, and years run from 1 January.
 */
export function buildPeriod(g: Granularity, offset: number, now = new Date()): Period {
  const today = startOfDay(now);
  const y = now.getFullYear();
  const m = now.getMonth();
  let start: Date;
  let end: Date;
  let title: string;

  if (g === 'day') {
    start = addDays(today, -offset);
    end = addDays(start, 1);
    title = fmt(start, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } else if (g === 'week') {
    start = addDays(today, -today.getDay() - 7 * offset);
    end = addDays(start, 7);
    title = `${fmt(start, { day: 'numeric', month: 'short' })} – ${fmt(addDays(start, 6), { day: 'numeric', month: 'short', year: 'numeric' })}`;
  } else if (g === 'month') {
    start = new Date(y, m - offset, 1);
    end = new Date(y, m - offset + 1, 1);
    title = fmt(start, { month: 'long', year: 'numeric' });
  } else {
    start = new Date(y - offset, 0, 1);
    end = new Date(y - offset + 1, 0, 1);
    title = String(start.getFullYear());
  }

  // Years stop at today, so the current year does not run into the future.
  const last = g === 'year' && offset === 0 ? addDays(today, 1) : end;
  const ticks: Tick[] = [];
  for (let d = new Date(start); d < last; d = addDays(d, 1)) {
    ticks.push({
      label: g === 'week' ? fmt(d, { weekday: 'short', day: 'numeric' }) : g === 'month' ? String(d.getDate()) : fmt(d, { day: 'numeric', month: 'short' }),
      fullLabel: fmt(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    });
  }

  let nowIndex: number | null = null;
  if (offset === 0) {
    const i = Math.round((today.getTime() - start.getTime()) / DAY_MS);
    nowIndex = i >= 0 && i < ticks.length ? i : null;
  }

  return { start, end, title, ticks, nowIndex };
}

/** Maps epoch-millisecond times onto the period's ticks: one count per point. */
export function countPerTick(times: number[], p: Period): number[] {
  const counts = new Array<number>(p.ticks.length).fill(0);
  const from = p.start.getTime();
  const to = p.end.getTime();
  for (const t of times) {
    if (t < from || t >= to) continue;
    const i = Math.round((startOfDay(t).getTime() - from) / DAY_MS);
    if (i >= 0 && i < counts.length) counts[i]++;
  }
  return counts;
}

/** How many of the times fall inside the period. */
export const countIn = (times: number[], p: Period) => times.filter((t) => t >= p.start.getTime() && t < p.end.getTime()).length;
