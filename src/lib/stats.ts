import type { Entry } from './types';

const dayKey = (ts: string | number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** Consecutive days (ending today, or yesterday if nothing logged yet today) with at least one entry. */
export function currentStreak(entries: Entry[]) {
  const days = new Set(entries.map((e) => dayKey(e.timestamp)));
  const cursor = new Date();
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function isToday(ts: string | number) {
  return dayKey(ts) === dayKey(Date.now());
}
