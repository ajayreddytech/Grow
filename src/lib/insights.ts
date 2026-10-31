import { toMs } from './text';
import { currentStreak } from './stats';
import type { Bucket, Entry, LearningBucket } from './types';

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface Insight {
  label: string;
  value: string;
  hint?: string;
}

const dayNumber = (ms: number) => {
  const d = new Date(ms);
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / DAY_MS);
};

/** The longest run of consecutive days with at least one entry. */
function longestStreak(entries: Entry[]) {
  const days = [...new Set(entries.map((e) => dayNumber(toMs(e.timestamp))))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  days.forEach((d, i) => {
    run = i > 0 && d === days[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

/** The title that appears most often in a stream, when it appears more than once. */
function mostRevisited(items: Entry[]) {
  const counts = new Map<string, number>();
  for (const e of items) counts.set(e.title, (counts.get(e.title) ?? 0) + 1);
  let top: [string, number] | null = null;
  for (const pair of counts) if (!top || pair[1] > top[1]) top = pair;
  return top && top[1] > 1 ? top : null;
}

const timeOfDay = (hour: number) => {
  if (hour >= 5 && hour < 12) return 'in the morning';
  if (hour >= 12 && hour < 17) return 'in the afternoon';
  if (hour >= 17 && hour < 22) return 'in the evening';
  return 'late at night';
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Insights about the learner, the stored data and each stream. Empty when nothing is saved yet. */
export function buildInsights(entries: Entry[], buckets: LearningBucket[]) {
  const now = Date.now();
  const sorted = [...entries].sort((a, b) => toMs(a.timestamp) - toMs(b.timestamp));
  const first = sorted[0];
  const count = (b: Bucket) => entries.filter((e) => e.bucket === b).length;
  const learnings = entries.filter((e) => e.bucket === 'learning');

  const byWeekday = new Array<number>(7).fill(0);
  const byHour = new Array<number>(24).fill(0);
  for (const e of entries) {
    const d = new Date(toMs(e.timestamp));
    byWeekday[d.getDay()]++;
    byHour[d.getHours()]++;
  }
  const topWeekday = byWeekday.indexOf(Math.max(...byWeekday));
  const topHour = byHour.indexOf(Math.max(...byHour));

  const last30 = entries.filter((e) => now - toMs(e.timestamp) < 30 * DAY_MS).length;
  const prev30 = entries.filter((e) => {
    const age = now - toMs(e.timestamp);
    return age >= 30 * DAY_MS && age < 60 * DAY_MS;
  }).length;

  const voice = entries.filter((e) => e.source === 'voice').length;
  const filed = learnings.filter((e) => e.group && buckets.some((b) => b.id === e.group)).length;
  const bucketName = new Map(buckets.map((b) => [b.id, b.name]));
  const perBucket = new Map<string, number>();
  for (const e of learnings) {
    const name = e.group && bucketName.get(e.group);
    if (name) perBucket.set(name, (perBucket.get(name) ?? 0) + 1);
  }
  const topBucket = [...perBucket].sort((a, b) => b[1] - a[1])[0];

  const streams = (['prabhupada', 'mentorship', 'workshop'] as const).map((b) => {
    const items = entries.filter((e) => e.bucket === b);
    return { bucket: b, items, repeat: mostRevisited(items) };
  });

  const about: Insight[] = [];
  const data: Insight[] = [];
  const streamInsights: Insight[] = [];

  if (!first) {
    return { about, data, streams: streamInsights, empty: true };
  }

  const days = Math.max(1, Math.round((now - toMs(first.timestamp)) / DAY_MS));
  about.push({ label: 'Growing for', value: plural(days, 'day'), hint: `Since your first entry on ${new Date(toMs(first.timestamp)).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` });
  about.push({ label: 'Streak', value: plural(currentStreak(entries), 'day'), hint: `Longest run: ${plural(longestStreak(entries), 'day')}` });
  about.push({ label: 'You tend to write on', value: WEEKDAYS[topWeekday], hint: `${byWeekday[topWeekday]} of ${entries.length} entries` });
  about.push({ label: 'Your usual time', value: timeOfDay(topHour), hint: `Most entries are logged ${timeOfDay(topHour)}` });
  about.push({
    label: 'Last 30 days',
    value: plural(last30, 'entry'),
    hint: prev30 === 0 ? (last30 > 0 ? 'New activity compared with the 30 days before' : 'Nothing logged in the last 30 days yet') : `${last30 >= prev30 ? '+' : ''}${Math.round(((last30 - prev30) / prev30) * 100)}% vs the 30 days before`,
  });

  data.push({ label: 'Records saved', value: String(entries.length), hint: `${count('learning')} learnings, ${count('prabhupada') + count('mentorship') + count('workshop')} across books, mentors and workshops` });
  data.push({ label: 'Captured by voice', value: entries.length ? `${Math.round((voice / entries.length) * 100)}%` : '0%', hint: `${voice} by voice, ${entries.length - voice} typed by hand` });
  data.push({ label: 'Learnings filed', value: `${filed} of ${learnings.length}`, hint: learnings.length - filed ? `${plural(learnings.length - filed, 'learning')} still in the default bucket` : 'Everything is filed in a bucket' });
  data.push({ label: 'Buckets', value: String(buckets.length), hint: topBucket ? `${topBucket[0]} holds the most, with ${plural(topBucket[1], 'learning')}` : 'Add learnings to see which bucket leads' });

  streamInsights.push({ label: 'Learnings', value: String(count('learning')), hint: `${new Set(learnings.map((e) => e.title)).size} unique takeaways` });
  for (const s of streams) {
    const name = s.bucket === 'prabhupada' ? 'Books' : s.bucket === 'mentorship' ? 'Mentors' : 'Workshops';
    streamInsights.push({
      label: name,
      value: String(s.items.length),
      hint: s.repeat ? `Most revisited: ${s.repeat[0]} (${s.repeat[1]}×)` : s.items.length ? `${new Set(s.items.map((e) => e.title)).size} unique` : 'Nothing logged yet',
    });
  }

  return { about, data, streams: streamInsights, empty: false };
}
