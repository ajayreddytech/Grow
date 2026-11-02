import { AnimatePresence, motion } from 'framer-motion';
import { Check, PartyPopper, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { bucketLook } from '../lib/bucketLook';
import { defaultBucketId, type Entry, type LearningBucket } from '../lib/types';
import { cn } from '../lib/utils';
import { AddEntryForm, BucketFooter, useCloseOnOutsidePress } from './BucketParts';
import { IconPicker } from './IconPicker';

const plural = (n: number) => (n === 1 ? 'learning' : 'learnings');

/** Encouragement line that grows with the count. */
const milestone = (n: number) => {
  if (n === 0) return 'Ready for the first seed';
  if (n < 5) return 'Planting the first seeds';
  if (n < 15) return 'Growing steadily';
  return 'Deep roots forming';
};

interface Props {
  learnings: Entry[];
}

/**
 * Every learning bucket as a card, styled like the Mentors columns. The single Edit toggle at the top right
 * is the only edit control: while it is on, you can add, rename or delete buckets, and the learnings inside
 * each bucket become editable (edit, move, delete). A learning with no bucket is shown under the default bucket (Others).
 */
export function LearningBuckets({ learnings }: Props) {
  const { learningBuckets } = useApp();
  const [managing, setManaging] = useState(false);
  /** Only one bucket is open at a time. */
  const [openId, setOpenId] = useState<string | null>(null);

  const byBucket = useMemo(() => {
    const home = defaultBucketId(learningBuckets);
    const known = new Set(learningBuckets.map((b) => b.id));
    const map = new Map<string, Entry[]>();
    for (const e of learnings) {
      const id = e.group && known.has(e.group) ? e.group : home;
      if (id) map.set(id, [...(map.get(id) ?? []), e]);
    }
    return map;
  }, [learnings, learningBuckets]);

  return (
    <section className="w-full">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="muted text-sm">
          {learningBuckets.length} {learningBuckets.length === 1 ? 'bucket' : 'buckets'} · {learnings.length} {plural(learnings.length)}
        </p>
        <button
          type="button"
          onClick={() => setManaging((v) => !v)}
          aria-pressed={managing}
          aria-label={managing ? 'Done managing buckets' : 'Manage buckets'}
          title={managing ? 'Done managing buckets' : 'Manage buckets'}
          className={cn('btn-ghost px-2.5 py-2', managing && 'border-leaf-500 text-leaf-700 dark:text-leaf-300')}
        >
          {managing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
        </button>
      </div>

      {managing && <AddBucketForm />}

      <ul className="mt-4 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {learningBuckets.map((b, i) => (
          <BucketCard
            key={b.id}
            bucket={b}
            index={i}
            items={byBucket.get(b.id) ?? []}
            buckets={learningBuckets}
            managing={managing}
            open={openId === b.id}
            onOpenChange={(v) => setOpenId(v ? b.id : null)}
          />
        ))}
      </ul>
    </section>
  );
}

function AddBucketForm() {
  const { addLearningBucket, notify } = useApp();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const clean = name.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      await addLearningBucket(clean, icon);
      setName('');
      setIcon(null);
      notify(`Created “${clean.replace(/\s+/g, ' ')}”`);
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
    >
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New bucket, e.g. Finance"
          maxLength={40}
          aria-label="New bucket name"
          className="input min-w-0 py-2.5"
        />
        <button type="submit" disabled={!name.trim() || busy} className="btn-primary shrink-0 px-4">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
      <div className="space-y-2">
        <p className="muted text-xs font-medium">Choose an icon</p>
        <IconPicker value={icon} onChange={setIcon} name={name.trim() || 'New bucket'} />
      </div>
    </form>
  );
}

type Mode = 'view' | 'rename' | 'delete';

/** One learning bucket as a card with an icon, a blurb, a count, a milestone line and an expandable list of learnings. */
function BucketCard({
  bucket,
  index,
  items,
  buckets,
  managing,
  open,
  onOpenChange,
}: {
  bucket: LearningBucket;
  index: number;
  items: Entry[];
  buckets: LearningBucket[];
  managing: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { renameLearningBucket, removeLearningBucket, bulkAdd, notify } = useApp();
  const cardRef = useRef<HTMLElement>(null);
  const closeCard = useCallback(() => onOpenChange(false), [onOpenChange]);
  useCloseOnOutsidePress(cardRef, open, closeCard);
  const [mode, setMode] = useState<Mode>('view');
  const [draft, setDraft] = useState(bucket.name);
  const [iconDraft, setIconDraft] = useState<string | null>(bucket.icon ?? null);
  const [moveTo, setMoveTo] = useState('');
  const [busy, setBusy] = useState(false);

  const look = bucketLook(bucket.name, bucket.icon);
  const count = items.length;
  const targets = buckets.filter((b) => b.id !== bucket.id);
  // Outside manage mode the card is always in view mode, so a stale rename/delete row closes.
  const current: Mode = managing ? mode : 'view';
  /** Newest first. */
  const sorted = useMemo(() => [...items].sort((a, b) => b.timestamp.localeCompare(a.timestamp)), [items]);
  const uniqueTitles = new Set(items.map((e) => e.title)).size;
  const thisMonth = items.filter((e) => {
    const d = new Date(e.timestamp);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;
  const celebrating = count > 0;

  const addLearning = (title: string, timestamp: string) => bulkAdd([{ bucket: 'learning', title, timestamp, source: 'manual', group: bucket.id }]);

  const save = async () => {
    if (busy || !draft.trim()) return;
    setBusy(true);
    try {
      await renameLearningBucket(bucket.id, draft, iconDraft);
      setMode('view');
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy || !moveTo) return;
    setBusy(true);
    try {
      const target = targets.find((b) => b.id === moveTo)?.name ?? '';
      const moved = await removeLearningBucket(bucket.id, moveTo);
      notify(moved ? `Deleted. ${moved} ${plural(moved)} moved to ${target}` : `Deleted “${bucket.name}”`, 'info');
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const renameRow = (
    <div className="space-y-3 p-5 sm:p-6">
      <p className="eyebrow">Rename or change icon</p>
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
            if (e.key === 'Escape') setMode('view');
          }}
          maxLength={40}
          aria-label={`Rename ${bucket.name}`}
          className="input min-w-0 py-2"
        />
        <button type="button" onClick={() => void save()} disabled={busy || !draft.trim()} className="btn-primary shrink-0 px-3 py-2" aria-label="Save name">
          <Check className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setMode('view')} className="btn-ghost shrink-0 px-3 py-2" aria-label="Cancel rename">
          <X className="h-4 w-4" />
        </button>
      </div>
      <IconPicker value={iconDraft} onChange={setIconDraft} name={draft.trim() || bucket.name} />
      <button
        type="button"
        onClick={() => {
          setMoveTo(defaultBucketId(targets) ?? '');
          setMode('delete');
        }}
        className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:underline dark:text-rose-400"
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete bucket
      </button>
    </div>
  );

  const deleteRow = (
    <div className="space-y-3 bg-rose-500/10 p-5 text-sm sm:p-6">
      <p className="font-medium text-rose-700 dark:text-rose-300">
        Delete “{bucket.name}”?{count > 0 && ` Its ${count} ${plural(count)} will move to another bucket first.`}
      </p>
      {targets.length === 0 ? (
        <p className="muted text-xs">Create another bucket first, then you can delete this one.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label="Move learnings to" className="input min-w-0 flex-1 py-2 text-sm">
            {targets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setMode('view')} className="btn-ghost px-3 py-2 text-xs">
            Keep
          </button>
          <button type="button" onClick={() => void remove()} disabled={busy || !moveTo} className="btn bg-rose-500 px-3 py-2 text-xs text-white hover:bg-rose-600">
            Delete
          </button>
        </div>
      )}
      {targets.length === 0 && (
        <button type="button" onClick={() => setMode('view')} className="btn-ghost px-3 py-2 text-xs">
          Keep
        </button>
      )}
    </div>
  );

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, layout: { type: 'spring', stiffness: 300, damping: 32 } }}
      className="min-w-0"
    >
      <section ref={cardRef} className={cn('card relative min-w-0 overflow-hidden', celebrating && 'ring-1 ring-inset ring-leaf-500/25 dark:ring-leaf-400/20')}>
        {current === 'rename' ? (
          renameRow
        ) : current === 'delete' ? (
          deleteRow
        ) : (
          <div className="relative">
            <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent', look.accent)} aria-hidden />
            <button type="button" onClick={() => onOpenChange(!open)} aria-expanded={open} className="relative block w-full p-5 pb-3 text-left sm:p-6 sm:pb-4">
              <div className="flex items-start justify-between">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/70 text-3xl shadow-sm dark:bg-white/10" aria-hidden>
                  {look.emoji}
                </span>
                <span className={cn('grid min-w-[2.75rem] place-items-center rounded-full px-3 py-1.5 font-display text-xl font-semibold tabular-nums shadow', look.ring)}>
                  {count}
                </span>
              </div>
              <h2 className="mt-5 truncate font-display text-xl font-semibold leading-tight">{bucket.name}</h2>
              <p className="muted mt-1 text-sm leading-snug">{look.blurb}</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-leaf-700 dark:text-leaf-300">
                <motion.span
                  animate={{ rotate: [0, -14, 14, -8, 0], scale: [1, 1.15, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 3 }}
                  className="inline-flex"
                  aria-hidden
                >
                  <PartyPopper className="h-4 w-4" />
                </motion.span>
                {milestone(count)}
              </p>
            </button>
            <BucketFooter label={<span className="truncate">{uniqueTitles} unique · {thisMonth} this month</span>} open={open} onToggle={() => onOpenChange(!open)} />
            {managing && (
              <div className="px-5 pb-5 sm:px-6 sm:pb-6">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(bucket.name);
                    setIconDraft(bucket.icon ?? null);
                    setMode('rename');
                  }}
                  className="text-xs font-semibold text-leaf-700 hover:underline dark:text-leaf-300"
                >
                  Rename, change icon or delete “{bucket.name}”
                </button>
              </div>
            )}
          </div>
        )}

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
                <AddEntryForm placeholder={`Add something you learnt about ${bucket.name}`} onAdd={addLearning} />
                <div className="scrollbar-thin max-h-[60vh] overflow-y-auto sm:max-h-[32rem]">
                  {count === 0 ? (
                    <p className="muted text-sm">{look.example}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {sorted.map((e) => (
                        <ItemRow key={e.id} entry={e} bucketId={bucket.id} buckets={buckets} editing={managing} />
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </motion.li>
  );
}

/** A single learning. Plain text normally; with the bucket's Edit on, it gets inline edit, move-to-bucket and delete. */
function ItemRow({ entry, bucketId, buckets, editing }: { entry: Entry; bucketId: string; buckets: LearningBucket[]; editing: boolean }) {
  const { updateEntry, removeEntry, notify } = useApp();
  const [rowEditing, setRowEditing] = useState(false);
  const [draft, setDraft] = useState(entry.title);
  const [confirming, setConfirming] = useState(false);

  if (!editing) {
    return <li className="break-words rounded-xl bg-white/50 px-3.5 py-2.5 text-sm font-semibold leading-relaxed dark:bg-white/[0.04]">{entry.title}</li>;
  }

  const saveTitle = async () => {
    const clean = draft.trim();
    if (!clean) return;
    try {
      await updateEntry(entry.id, { title: clean });
      setRowEditing(false);
    } catch (err) {
      notify((err as Error).message, 'error');
    }
  };

  const move = async (value: string) => {
    try {
      await updateEntry(entry.id, { group: value });
      notify(`Moved to ${buckets.find((b) => b.id === value)?.name ?? 'another bucket'}`);
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
                void saveTitle();
              }
            }}
            rows={2}
            aria-label="Edit learning"
            className="input w-full resize-none py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void saveTitle()} disabled={!draft.trim()} className="btn-primary px-3 py-1.5 text-xs" aria-label="Save learning">
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
                  notify('Learning removed', 'info');
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
        <>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-semibold leading-relaxed">{entry.title}</p>
            </div>
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
          <label className="mt-2 flex items-center gap-2 text-xs">
            <span className="muted shrink-0">Move to</span>
            <select
              value={bucketId}
              onChange={(e) => void move(e.target.value)}
              aria-label={`Move “${entry.title}” to another bucket`}
              className="input min-w-0 flex-1 py-1 text-xs"
            >
              {buckets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </li>
  );
}
