import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, LocateFixed, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { SectionHeader } from '../components/EntryCard';
import { useApp } from '../context/AppContext';
import { buildInsights, type Insight } from '../lib/insights';
import { toMs } from '../lib/text';
import { buildPeriod, countIn, countPerTick, type Granularity, type Period } from '../lib/time';
import type { Bucket, Entry, LearningBucket } from '../lib/types';
import { cn } from '../lib/utils';

const TIMEFRAMES: Granularity[] = ['day', 'week', 'month', 'year'];
const TF_LABEL: Record<Granularity, string> = { day: 'Day', week: 'Week', month: 'Month', year: 'Year' };

interface ChartConfig {
  key: string;
  title: string;
  subtitle: string;
  color: string;
  filter: (e: Entry) => boolean;
}

const isBucket = (b: Bucket) => (e: Entry) => e.bucket === b;

/** The learning curve shows raw learnings only. Books, mentorship and workshops each get their own chart. */
const CHARTS: ChartConfig[] = [
  { key: 'learnings', title: 'Learning Curve', subtitle: 'Learnings you captured', color: '#27a35f', filter: isBucket('learning') },
  { key: 'books', title: 'Books', subtitle: 'Srila Prabhupada books', color: '#e0a024', filter: isBucket('prabhupada') },
  { key: 'mentorship', title: 'Mentorship', subtitle: 'Mentor sessions', color: '#0ea5e9', filter: isBucket('mentorship') },
  { key: 'workshops', title: 'Workshops', subtitle: 'Workshops attended', color: '#8b5cf6', filter: isBucket('workshop') },
];

export function LearningCurveSection() {
  const { entries, learningBuckets } = useApp();
  const [tf, setTf] = useState<Granularity>('day');
  // Periods back from the current one, shared by every chart so they always show the same span.
  const [offset, setOffset] = useState(0);

  const series = useMemo(
    () => CHARTS.map((c) => ({ ...c, times: entries.filter(c.filter).map((e) => toMs(e.timestamp)) })),
    [entries],
  );

  const changeTf = (g: Granularity) => {
    setTf(g);
    setOffset(0);
  };
  // Positive steps go back in time, negative steps forward. Nothing forward of the current period.
  const shift = (steps: number) => setOffset((o) => Math.max(0, o + steps));
  const period = useMemo(() => buildPeriod(tf, offset), [tf, offset]);
  const previous = useMemo(() => buildPeriod(tf, offset + 1), [tf, offset]);

  return (
    <div>
      <SectionHeader eyebrow="Learning curve" title="Watch yourself grow">
        Drag or swipe any chart to move through time, or use the arrows to step one {TF_LABEL[tf].toLowerCase()} at a time.
      </SectionHeader>

      {/* Controls: sticky so the timeframe and period stay in view while scrolling the charts */}
      <div className="sticky top-3 z-30 mb-5">
        <div className="card glass-strong flex flex-wrap items-center gap-3 p-2.5 shadow-soft">
          <div className="relative flex rounded-xl bg-ink-900/5 p-1 dark:bg-white/5" role="tablist" aria-label="Timeframe">
            {TIMEFRAMES.map((g) => (
              <button
                key={g}
                role="tab"
                aria-selected={tf === g}
                onClick={() => changeTf(g)}
                className={cn('relative rounded-lg px-3.5 py-1.5 text-sm font-semibold transition sm:px-5', tf === g ? 'text-white dark:text-ink-900' : 'muted hover:opacity-100')}
              >
                {tf === g && (
                  <motion.span layoutId="tf-pill" className="absolute inset-0 rounded-lg bg-leaf-600 shadow-glow dark:bg-leaf-400" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                )}
                <span className="relative">{TF_LABEL[g]}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => shift(1)} className="btn-ghost h-9 w-9 rounded-full p-0" aria-label="Earlier">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setOffset(0)} disabled={offset === 0} className="btn-ghost h-9 rounded-full px-3 text-xs">
              Now
            </button>
            <button onClick={() => shift(-1)} disabled={offset === 0} className="btn-ghost h-9 w-9 rounded-full p-0" aria-label="Later">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <p className="muted min-w-0 flex-1 truncate text-right text-sm font-semibold">{period.title}</p>

          <label className="relative flex items-center">
            <LocateFixed className="muted pointer-events-none absolute left-3 h-4 w-4" />
            <select
              aria-label="Jump to current period"
              value=""
              onChange={(e) => {
                if (e.target.value) changeTf(e.target.value as Granularity);
              }}
              className="input w-auto appearance-none rounded-xl py-2 pl-9 pr-8 text-sm font-semibold"
            >
              <option value="">Jump to current…</option>
              {TIMEFRAMES.map((g) => (
                <option key={g} value={g}>
                  Current {TF_LABEL[g]}
                </option>
              ))}
            </select>
            <ChevronRight className="muted pointer-events-none absolute right-3 h-4 w-4 rotate-90" />
          </label>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] lg:items-start">
        <div className="grid min-w-0 gap-5">
          {series.map((s) => (
            <ChartPanel key={s.key} config={s} times={s.times} tf={tf} period={period} previous={previous} onShift={shift} />
          ))}
        </div>
        <aside className="lg:sticky lg:top-28">
          <InsightsPanel entries={entries} buckets={learningBuckets} />
        </aside>
      </div>
    </div>
  );
}

function InsightsPanel({ entries, buckets }: { entries: Entry[]; buckets: LearningBucket[] }) {
  const insights = useMemo(() => buildInsights(entries, buckets), [entries, buckets]);

  return (
    <section className="card space-y-6 p-5 sm:p-6">
      <div>
        <p className="eyebrow">Insights</p>
        <h2 className="mt-1 font-display text-xl font-semibold">Your curve, in numbers</h2>
      </div>

      {insights.empty ? (
        <p className="muted text-sm">Save a learning and your insights will appear here.</p>
      ) : (
        <>
          <InsightGroup title="About you" items={insights.about} />
          <InsightGroup title="Your data" items={insights.data} />
          <InsightGroup title="Your streams" items={insights.streams} />
        </>
      )}
    </section>
  );
}

function InsightGroup({ title, items }: { title: string; items: Insight[] }) {
  return (
    <div>
      <p className="muted mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]">{title}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.label} className="rounded-2xl bg-white/50 px-3.5 py-2.5 dark:bg-white/[0.04]">
            <p className="muted text-[11px]">{item.label}</p>
            <p className="font-display text-lg font-semibold leading-tight">{item.value}</p>
            {item.hint && <p className="muted mt-0.5 text-[11px] leading-snug">{item.hint}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChartPanel({
  config,
  times,
  tf,
  period,
  previous,
  onShift,
}: {
  config: ChartConfig;
  times: number[];
  tf: Granularity;
  period: Period;
  previous: Period;
  onShift: (steps: number) => void;
}) {
  const { theme } = useApp();
  const { key, title, subtitle, color } = config;

  const { data, total, prevTotal, peak } = useMemo(() => {
    const values = countPerTick(times, period);
    const data = period.ticks.map((t, i) => ({ i, label: t.label, fullLabel: t.fullLabel, value: values[i] }));
    const total = values.reduce((a, b) => a + b, 0);
    const prevTotal = countIn(times, previous);
    const peakRow = data.reduce((best, row) => (row.value > best.value ? row : best), { value: 0, fullLabel: '—' } as { value: number; fullLabel: string });
    return { data, total, prevTotal, peak: peakRow };
  }, [times, period, previous]);

  const delta = prevTotal === 0 ? (total > 0 ? 100 : 0) : Math.round(((total - prevTotal) / prevTotal) * 100);

  // ---- Drag / swipe / trackpad panning ----------------------------------
  const areaRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; carry: number } | null>(null);
  const wheelAcc = useRef(0);
  const [dragging, setDragging] = useState(false);

  // Half the chart width is one step, so a short swipe moves a little and a full swipe moves a lot.
  const stepWidth = () => Math.max(120, (areaRef.current?.clientWidth ?? 600) * 0.5);
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { x: e.clientX, carry: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    d.x = e.clientX;
    if (Math.abs(dx) > 4) setDragging(true);
    d.carry += dx;
    const w = stepWidth();
    const steps = Math.trunc(d.carry / w);
    if (steps) {
      d.carry -= steps * w;
      onShift(steps); // dragging right moves back in time
    }
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };
  const onWheel = (e: ReactWheelEvent) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // only horizontal scroll pans
    wheelAcc.current += e.deltaX;
    const w = stepWidth();
    const steps = Math.trunc(wheelAcc.current / w);
    if (steps) {
      wheelAcc.current -= steps * w;
      onShift(-steps); // scrolling right moves forward
    }
  };

  const axis = theme === 'dark' ? 'rgba(239,251,243,0.5)' : 'rgba(6,17,12,0.5)';
  const grid = theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(6,17,12,0.08)';
  const height = 'h-64 sm:h-72';

  return (
    <section className="card flex h-full flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <p className="muted text-xs">{subtitle}</p>
        </div>
        <span
          className={cn('chip', delta >= 0 ? 'bg-leaf-500/15 text-leaf-700 dark:text-leaf-300' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300')}
          title={`Compared with the previous ${TF_LABEL[tf].toLowerCase()}`}
        >
          {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {delta >= 0 ? '+' : ''}
          {delta}% vs previous
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
        <p className="font-display text-3xl font-semibold tabular-nums">{total}</p>
        <p className="muted mb-1 text-[11px]">
          Peak: <span className="font-semibold text-ink-900 dark:text-leaf-50">{peak.value > 0 ? peak.fullLabel : '—'}</span>
          {peak.value > 0 && ` (${peak.value})`}
        </p>
      </div>

      <div
        ref={areaRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
        className={cn('relative mt-4 touch-pan-y select-none', height, dragging ? 'cursor-grabbing' : 'cursor-grab')}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id={`${key}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={grid} />
            <XAxis
              dataKey="i"
              tickFormatter={(i: number) => period.ticks[i]?.label ?? ''}
              tick={{ fill: axis, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={14}
              padding={{ left: 6, right: 6 }}
            />
            <YAxis allowDecimals={false} tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
            {period.nowIndex !== null && (
              <ReferenceLine
                x={period.nowIndex}
                stroke={theme === 'dark' ? '#4bc07c' : '#1a844c'}
                strokeDasharray="4 4"
                label={{ value: 'now', position: 'insideTopRight', fill: axis, fontSize: 10 }}
              />
            )}
            <Tooltip content={<GlassTooltip label={title} color={color} />} cursor={{ stroke: grid, strokeWidth: 24 }} />
            <Area
              type="monotone"
              dataKey="value"
              name={title}
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#${key}-fill)`}
              dot={data.length === 1 ? { r: 4, strokeWidth: 0, fill: color } : false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: theme === 'dark' ? '#0b1a14' : '#fff' }}
              animationDuration={450}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function GlassTooltip({ active, payload, label, color }: TooltipProps<number, string> & { label: string; color: string }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as { fullLabel: string; value: number };
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-xs">
      <p className="mb-1 font-semibold">{row.fullLabel}</p>
      <p className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="muted">{label}</span>
        <span className="ml-auto pl-3 font-semibold tabular-nums">{row.value}</span>
      </p>
    </div>
  );
}
