import { AnimatePresence, motion } from 'framer-motion';
import { BicepsFlexed, BookOpen, Check, Hammer, HeartHandshake, Pencil, PartyPopper, Trash2, X, type LucideIcon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { AddEntryForm, BucketFooter, useCloseOnOutsidePress } from '../components/BucketParts';
import { useApp } from '../context/AppContext';
import type { Bucket, Entry } from '../lib/types';
import { cn } from '../lib/utils';

/** The buckets whose contents are copied into Recall & Strengthen. */
const SOURCE_BUCKETS: Bucket[] = ['prabhupada', 'mentorship', 'workshop'];

const COLUMNS: { bucket: Exclude<Bucket, 'learning'>; title: string; emoji: string; icon: LucideIcon; accent: string; ring: string; ready: string; empty: string; add: string; celebrate: boolean; checklist?: boolean }[] = [
  {
    bucket: 'prabhupada',
    title: 'Srila Prabhupada',
    emoji: '📘',
    icon: BookOpen,
    accent: 'from-amber-300/50 via-amber-200/20 dark:from-amber-500/25 dark:via-amber-500/5',
    ring: 'bg-amber-500 text-white dark:bg-amber-400 dark:text-ink-900',
    ready: 'Ready for the first reading',
    empty: 'Log a reading, e.g. “Read Bhagavad-gita chapter 2 on the soul.”',
    add: 'Add a reading, e.g. Bhagavad-gita chapter 2',
    celebrate: true,
  },
  {
    bucket: 'mentorship',
    title: 'Mentors',
    emoji: '🤝',
    icon: HeartHandshake,
    accent: 'from-sky-300/50 via-sky-200/20 dark:from-sky-500/25 dark:via-sky-500/5',
    ring: 'bg-sky-500 text-white dark:bg-sky-400 dark:text-ink-900',
    ready: 'Ready for the first session',
    empty: 'Log a session, e.g. “Mentor session with Priya on focus.”',
    add: 'Add a session, e.g. Priya on focus',
    celebrate: true,
  },
  {
    bucket: 'workshop',
    title: 'Workshops',
    emoji: '🛠️',
    icon: Hammer,
    accent: 'from-violet-300/50 via-violet-200/20 dark:from-violet-500/25 dark:via-violet-500/5',
    ring: 'bg-violet-500 text-white dark:bg-violet-400 dark:text-ink-900',
    ready: 'Ready for the first workshop',
    empty: 'Log a workshop, e.g. “Attended a workshop on public speaking.”',
    add: 'Add a workshop, e.g. Public speaking',
    celebrate: true,
  },
  {
    bucket: 'recall',
    title: 'Recall & Strengthen',
    emoji: '💪',
    icon: BicepsFlexed,
    accent: 'from-rose-300/50 via-rose-200/20 dark:from-rose-500/25 dark:via-rose-500/5',
    ring: 'bg-rose-500 text-white dark:bg-rose-400 dark:text-ink-900',
    ready: 'Ready to recall',
    empty: '',
    add: '',
    celebrate: true,
    checklist: true,
  },
];

/** Encouragement line that grows with the count. */
const milestone = (n: number) => {
  if (n < 5) return 'Lovely start, keep showing up';
  if (n < 15) return 'You’re on a roll';
  return 'Legendary consistency';
};

export function MentorsSection() {
  const { entries, bulkAdd, notify } = useApp();
  /** Only one column is open at a time. */
  const [openBucket, setOpenBucket] = useState<Bucket | null>(null);
  /** One edit switch for the whole section. While it is on, every entry in every bucket can be edited or deleted. */
  const [editing, setEditing] = useState(false);
  const [building, setBuilding] = useState(false);

  const recallCount = entries.filter((e) => e.bucket === 'recall').length;

  /**
   * Copies every Prabhupada, mentor and workshop entry into a new Recall & Strengthen checklist.
   * The recall column only exists while it has items, so it disappears once everything is ticked off.
   */
  const createRecall = async () => {
    if (building) return;
    if (recallCount > 0) {
      setOpenBucket('recall');
      notify('Your recall list is already open');
      return;
    }
    const sources = entries.filter((e) => SOURCE_BUCKETS.includes(e.bucket));
    if (sources.length === 0) {
      notify('Nothing to recall yet. Add a reading, session or workshop first.', 'info');
      return;
    }
    setBuilding(true);
    try {
      await bulkAdd(sources.map((e) => ({ bucket: 'recall', title: e.title, timestamp: e.timestamp, source: e.source, group: null, ref: e.id })));
      setOpenBucket('recall');
      notify(`Added ${sources.length} to Recall & Strengthen`);
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBuilding(false);
    }
  };

  const visibleColumns = COLUMNS.filter((col) => !col.checklist || recallCount > 0);

  return (
    <div>
      <header className="mb-6 sm:mb-8">
        <p className="eyebrow">Mentors</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Srila Prabhupada, mentors & workshops</h1>
        <div className="mt-2 flex items-start justify-between gap-4">
          <p className="muted max-w-2xl text-[15px]">The three streams that shape you. Expand a card to see every entry.</p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void createRecall()}
              disabled={building}
              aria-label="Recall and strengthen"
              title="Recall and strengthen"
              className="btn-ghost shrink-0 px-2.5 py-2"
            >
              <BicepsFlexed className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              aria-pressed={editing}
              aria-label={editing ? 'Done editing' : 'Edit mentors'}
              title={editing ? 'Done editing' : 'Edit mentors'}
              className={cn('btn-ghost shrink-0 px-2.5 py-2', editing && 'border-leaf-500 text-leaf-700 dark:text-leaf-300')}
            >
              {editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>
      <div className="grid items-start gap-4 md:grid-cols-3">
        {visibleColumns.map((col, i) => (
          <Column
            key={col.bucket}
            col={col}
            index={i}
            items={entries.filter((e) => e.bucket === col.bucket)}
            open={openBucket === col.bucket}
            editing={editing}
            onToggle={() => setOpenBucket((cur) => (cur === col.bucket ? null : col.bucket))}
            onClose={() => setOpenBucket((cur) => (cur === col.bucket ? null : cur))}
          />
        ))}
      </div>
    </div>
  );
}

function Column({
  col,
  items,
  open,
  editing,
  onToggle,
  onClose,
  index,
}: {
  col: (typeof COLUMNS)[number];
  items: Entry[];
  open: boolean;
  editing: boolean;
  onToggle: () => void;
  onClose: () => void;
  index: number;
}) {
  const Icon = col.icon;
  const { bulkAdd } = useApp();
  const columnRef = useRef<HTMLElement>(null);
  useCloseOnOutsidePress(columnRef, open, onClose);
  /** Newest first. */
  const sorted = useMemo(() => [...items].sort((a, b) => b.timestamp.localeCompare(a.timestamp)), [items]);
  const uniqueTitles = new Set(items.map((e) => e.title)).size;
  const thisMonth = items.filter((e) => {
    const d = new Date(e.timestamp);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;
  const celebrating = col.celebrate && items.length > 0;

  return (
    <motion.section
      ref={columnRef}
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, layout: { type: 'spring', stiffness: 300, damping: 32 } }}
      className={cn('card relative min-w-0 overflow-hidden', celebrating && 'ring-1 ring-inset ring-leaf-500/25 dark:ring-leaf-400/20')}
    >
      <div className="relative">
        <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent', col.accent)} aria-hidden />
        <button onClick={onToggle} aria-expanded={open} className="relative block w-full p-5 pb-3 text-left sm:p-6 sm:pb-4">
          <div className="flex items-start justify-between">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/70 text-3xl shadow-sm dark:bg-white/10">{col.emoji}</span>
            <span className={cn('grid min-w-[2.75rem] place-items-center rounded-full px-3 py-1.5 font-display text-xl font-semibold tabular-nums shadow', col.ring)}>
              {items.length}
            </span>
          </div>
          <h2 className="mt-5 font-display text-xl font-semibold leading-tight">{col.title}</h2>
          {col.checklist ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-leaf-700 dark:text-leaf-300">
              {items.length === 0 ? 'All recalled' : `${items.length} to recall, tick each one off`}
            </p>
          ) : (
            col.celebrate && (
              <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-leaf-700 dark:text-leaf-300">
                <motion.span
                  animate={{ rotate: [0, -14, 14, -8, 0], scale: [1, 1.15, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 3 }}
                  className="inline-flex"
                  aria-hidden
                >
                  <PartyPopper className="h-4 w-4" />
                </motion.span>
                {items.length === 0 ? col.ready : milestone(items.length)}
              </p>
            )
          )}
        </button>
        <BucketFooter
          label={
            col.checklist ? (
              <>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Tick off what you recall</span>
              </>
            ) : (
              <>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {uniqueTitles} unique · {thisMonth} this month
                </span>
              </>
            )
          }
          open={open}
          onToggle={onToggle}
        />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-ink-900/5 p-4 sm:p-5 dark:border-white/5">
              {col.checklist ? null : (
                <AddEntryForm
                  placeholder={col.add}
                  onAdd={(title, timestamp) => bulkAdd([{ bucket: col.bucket, title, timestamp, source: 'manual', group: null }])}
                />
              )}
              <div className="scrollbar-thin max-h-[60vh] overflow-y-auto sm:max-h-[32rem]">
                {col.checklist ? (
                  <ul className="space-y-1.5">
                    <AnimatePresence initial={false}>
                      {sorted.map((e) => (
                        <ChecklistItem key={e.id} entry={e} />
                      ))}
                    </AnimatePresence>
                  </ul>
                ) : sorted.length === 0 ? (
                  <p className="muted text-sm">{col.empty}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {sorted.map((e) => (
                      <EntryItem key={e.id} entry={e} editing={editing} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

/**
 * One recall item. Ticking it off removes it from the list for good; the source entry in its own
 * bucket is left alone. When the last item goes, the whole column disappears.
 */
function ChecklistItem({ entry }: { entry: Entry }) {
  const { removeEntry, notify } = useApp();
  const [busy, setBusy] = useState(false);

  const tick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await removeEntry(entry.id);
      notify(`Well done! You recalled and strengthened “${entry.title}”`);
    } catch (err) {
      notify((err as Error).message, 'error');
      setBusy(false);
    }
  };

  return (
    <motion.li
      layout
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden rounded-xl bg-white/50 dark:bg-white/[0.04]"
    >
      <label className="flex cursor-pointer items-start gap-3 px-3.5 py-2.5">
        <input
          type="checkbox"
          checked={false}
          disabled={busy}
          onChange={() => void tick()}
          aria-label={`Recalled: ${entry.title}`}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-leaf-600"
        />
        <span className="min-w-0 break-words text-sm font-semibold leading-relaxed">{entry.title}</span>
      </label>
    </motion.li>
  );
}

/**
 * One entry in a card. Plain text normally. With the section's Edit on, it can be retitled or deleted.
 * The timestamp is set once when the entry is created and is never shown or changed here.
 */
function EntryItem({ entry, editing }: { entry: Entry; editing: boolean }) {
  const { updateEntry, removeEntry, notify } = useApp();
  const [rowEditing, setRowEditing] = useState(false);
  const [draft, setDraft] = useState(entry.title);
  const [confirming, setConfirming] = useState(false);

  if (!editing) {
    return <li className="break-words rounded-xl bg-white/50 px-3.5 py-2.5 text-sm font-semibold dark:bg-white/[0.04]">{entry.title}</li>;
  }

  const save = async () => {
    const clean = draft.trim();
    if (!clean) return;
    try {
      await updateEntry(entry.id, { title: clean });
      setRowEditing(false);
    } catch (err) {
      notify((err as Error).message, 'error');
    }
  };

  return (
    <li className="rounded-xl bg-white/50 p-3 dark:bg-white/[0.04]">
      {rowEditing ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setRowEditing(false);
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void save();
              }
            }}
            rows={2}
            aria-label="Edit title"
            className="input w-full resize-none py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void save()} disabled={!draft.trim()} className="btn-primary px-3 py-1.5 text-xs" aria-label="Save">
              <Check className="h-3.5 w-3.5" /> Save
            </button>
            <button type="button" onClick={() => setRowEditing(false)} className="btn-ghost px-3 py-1.5 text-xs" aria-label="Cancel edit">
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
        </div>
      ) : confirming ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-rose-700 dark:text-rose-300">Delete “{entry.title}”?</p>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => setConfirming(false)} className="btn-ghost px-2.5 py-1 text-xs">
              Keep
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await removeEntry(entry.id);
                  notify('Entry removed', 'info');
                } catch (err) {
                  notify((err as Error).message, 'error');
                }
              }}
              className="btn bg-rose-500/90 px-2.5 py-1 text-xs text-white hover:bg-rose-500"
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 break-words text-sm font-semibold">{entry.title}</p>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                setDraft(entry.title);
                setRowEditing(true);
              }}
              className="muted rounded-lg p-1.5 transition hover:bg-ink-900/5 hover:text-ink-900 dark:hover:bg-white/5 dark:hover:text-leaf-50"
              aria-label="Edit entry"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="muted rounded-lg p-1.5 transition hover:bg-rose-500/10 hover:text-rose-500"
              aria-label="Delete entry"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
