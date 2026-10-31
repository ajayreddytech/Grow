import { AnimatePresence, motion } from 'framer-motion';
import { Flame, Loader2, Mic, Quote as QuoteIcon, Sparkles, Square, Wand2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Logo } from '../components/Logo';
import { Modal } from '../components/Modal';
import { useApp } from '../context/AppContext';
import { useVoiceCapture, type VoiceResult } from '../hooks/useVoiceCapture';
import { extractEntries } from '../lib/ai';
import { quoteForDate } from '../lib/quotes';
import { currentStreak } from '../lib/stats';
import { BUCKETS, defaultBucketId, type Bucket, type NewEntry } from '../lib/types';
import { cn } from '../lib/utils';

interface Pending {
  items: NewEntry[];
  rawText: string;
}

const plural = (n: number) => (n === 1 ? 'entry' : 'entries');

/** Solid colours for dropdown options: the popup does not inherit the select's translucent tint. */
const OPTION_CLASS = 'bg-white text-ink-900 dark:bg-ink-800 dark:text-leaf-50';

export function GrowSection() {
  const { entries, bulkAdd, notify, learningBuckets } = useApp();
  const quote = useMemo(() => quoteForDate(), []);
  const streak = useMemo(() => currentStreak(entries), [entries]);

  const [analyzing, setAnalyzing] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [saving, setSaving] = useState(false);

  const onVoice = async ({ transcript }: VoiceResult) => {
    setAnalyzing(true);
    try {
      const items = await extractEntries(transcript, learningBuckets);
      if (!items.length) notify('No learning found in that — try “I learnt …”.', 'error');
      else setPending({ items, rawText: transcript });
    } catch (err) {
      notify(`Couldn’t process that recording: ${(err as Error).message}`, 'error');
    } finally {
      setAnalyzing(false);
    }
  };
  const voice = useVoiceCapture(onVoice);

  const confirmVoice = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      const fallback = defaultBucketId(learningBuckets);
      await bulkAdd(pending.items.map((i) => ({ ...i, title: i.title.trim(), group: i.bucket === 'learning' ? (i.group ?? fallback) : null })));
      notify(`Saved ${pending.items.length} ${plural(pending.items.length)}`);
      setPending(null);
    } catch (err) {
      notify(`Save failed: ${(err as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const now = new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Logo />
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip glass py-1.5 text-xs">
            {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
          {streak > 0 && (
            <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="chip bg-amber-500/15 py-1.5 text-xs text-amber-800 dark:text-amber-300">
              <Flame className="h-3.5 w-3.5" /> {streak}-day streak
            </motion.span>
          )}
        </div>
      </div>

      {/* Daily quote */}
      <motion.figure
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="card relative overflow-hidden p-6 sm:p-8"
      >
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-leaf-400/20 blur-3xl" aria-hidden />
        <QuoteIcon className="absolute right-4 top-4 h-8 w-8 text-leaf-500/15 sm:right-6 sm:top-6 sm:h-10 sm:w-10" aria-hidden />
        <p className="eyebrow">Today’s impact quote</p>
        <blockquote className="mt-3 pr-8 font-display text-xl font-medium leading-snug tracking-tight sm:text-2xl md:text-[1.7rem]">
          “{quote}”
        </blockquote>
      </motion.figure>

      {/* Voice capture */}
      <section className="card mx-auto flex w-full max-w-xl flex-col items-center justify-center p-6 text-center sm:p-8">
        <p className="eyebrow">Voice capture</p>
        <h2 className="mt-1 font-display text-xl font-semibold">Speak what you learnt</h2>

        <div className="relative my-7 grid h-36 w-36 place-items-center">
          {voice.listening &&
            [0, 0.6, 1.2].map((d) => (
              <span
                key={d}
                className="absolute inset-4 animate-ripple rounded-full bg-leaf-500/40 dark:bg-leaf-400/30"
                style={{ animationDelay: `${d}s` }}
              />
            ))}
          <motion.button
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.04 }}
            onClick={voice.listening ? voice.stop : voice.start}
            disabled={analyzing}
            className={cn(
              'relative grid h-24 w-24 place-items-center rounded-full text-white shadow-glow transition-colors',
              voice.listening ? 'bg-rose-500' : 'bg-gradient-to-br from-leaf-500 to-leaf-700 dark:from-leaf-400 dark:to-leaf-600',
            )}
            aria-label={voice.listening ? 'Stop recording' : 'Start recording'}
          >
            {analyzing ? (
              <Loader2 className="h-9 w-9 animate-spin" />
            ) : voice.listening ? (
              <Square className="h-8 w-8" fill="currentColor" />
            ) : (
              <Mic className="h-10 w-10" />
            )}
          </motion.button>
        </div>

        <p className="muted -mt-3 mb-4 text-xs">Tap the mic and say what you learnt. You can review everything before it’s saved.</p>

        <div className="min-h-[3.5rem] w-full">
          <AnimatePresence mode="wait">
            {analyzing ? (
              <motion.p key="a" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="muted flex items-center justify-center gap-2 text-sm">
                <Wand2 className="h-4 w-4" /> Pulling out the takeaways…
              </motion.p>
            ) : voice.listening ? (
              <motion.p key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm italic">
                {voice.interim || <span className="muted">Listening… tap to stop</span>}
              </motion.p>
            ) : voice.error ? (
              <motion.p key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-rose-600 dark:text-rose-400">
                {voice.error}
              </motion.p>
            ) : !voice.supported ? (
              <motion.p key="u" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="muted text-sm">
                Voice input needs Chrome, Edge or Safari.
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      </section>

      <ConfirmModal
        pending={pending}
        onChange={setPending}
        onClose={() => setPending(null)}
        onSave={confirmVoice}
        saving={saving}
      />
    </div>
  );
}

const toDateValue = (ts: string) => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Encodes where an entry goes as one select value: "learning", "learning:<bucket id>" or a mentor bucket. */
const choiceOf = (item: NewEntry, fallback: string | null) => (item.bucket === 'learning' ? `learning:${item.group ?? fallback}` : item.bucket);

const fromChoice = (value: string): Pick<NewEntry, 'bucket' | 'group'> => {
  const [bucket, group] = value.split(':') as [Bucket, string | undefined];
  return { bucket, group: bucket === 'learning' ? (group ?? null) : null };
};

function ConfirmModal({
  pending,
  onChange,
  onClose,
  onSave,
  saving,
}: {
  pending: Pending | null;
  onChange: (p: Pending) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { learningBuckets } = useApp();
  const fallback = defaultBucketId(learningBuckets);
  const updateItem = (i: number, patch: Partial<NewEntry>) =>
    pending && onChange({ ...pending, items: pending.items.map((item, idx) => (idx === i ? { ...item, ...patch } : item)) });
  const removeItem = (i: number) => pending && onChange({ ...pending, items: pending.items.filter((_, idx) => idx !== i) });
  const hasLearning = !!pending?.items.some((i) => i.bucket === 'learning');
  const canSave = !!pending && pending.items.length > 0 && pending.items.every((i) => i.title.trim()) && (!hasLearning || learningBuckets.length > 0);

  return (
    <Modal open={!!pending} onClose={onClose} title="Confirm your entries" subtitle="Only the takeaway or title and its date are saved. Adjust anything before saving.">
      {pending && (
        <div className="space-y-4">
          {pending.rawText && (
            <p className="muted text-xs">
              <span className="font-semibold">Heard:</span> {pending.rawText}
            </p>
          )}

          {hasLearning && learningBuckets.length === 0 && (
            <p className="rounded-2xl bg-leaf-500/10 p-3 text-xs text-leaf-800 dark:text-leaf-200">
              You don’t have any Learning buckets yet. Create some in the Learning section to file learnings into them.
            </p>
          )}

          <ul className="space-y-3">
            {pending.items.map((item, i) => (
              <li key={i} className="space-y-2.5 rounded-2xl border border-ink-900/10 p-3 dark:border-white/10">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={choiceOf(item, fallback)}
                    onChange={(e) => updateItem(i, fromChoice(e.target.value))}
                    aria-label="Bucket"
                    className={cn(
                      'max-w-full cursor-pointer appearance-auto rounded-full border px-3 py-1.5 text-xs font-semibold',
                      'border-ink-900/20 bg-white text-ink-900 dark:border-white/20 dark:bg-ink-800 dark:text-leaf-50',
                    )}
                  >
                    {learningBuckets.map((b) => (
                      <option key={b.id} value={`learning:${b.id}`} className={OPTION_CLASS}>
                        {BUCKETS.learning.emoji} {b.name}
                      </option>
                    ))}
                    <option value="prabhupada" className={OPTION_CLASS}>
                      {BUCKETS.prabhupada.emoji} {BUCKETS.prabhupada.label}
                    </option>
                    <option value="mentorship" className={OPTION_CLASS}>
                      {BUCKETS.mentorship.emoji} {BUCKETS.mentorship.label}
                    </option>
                    <option value="workshop" className={OPTION_CLASS}>
                      {BUCKETS.workshop.emoji} {BUCKETS.workshop.label}
                    </option>
                  </select>
                  {item.bucket !== 'learning' && (
                    <input
                      type="date"
                      value={toDateValue(item.timestamp)}
                      onChange={(e) => {
                        const [y, m, d] = e.target.value.split('-').map(Number);
                        if (y && m && d) updateItem(i, { timestamp: new Date(y, m - 1, d, 12).toISOString() });
                      }}
                      aria-label="Date"
                      className="input w-auto py-1.5 text-xs"
                    />
                  )}
                  <button onClick={() => removeItem(i)} className="muted ml-auto rounded-lg p-1.5 hover:bg-rose-500/10 hover:text-rose-500" aria-label="Remove this entry">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <textarea
                  value={item.title}
                  onChange={(e) => updateItem(i, { title: e.target.value })}
                  rows={item.bucket === 'learning' ? 2 : 1}
                  aria-label={item.bucket === 'learning' ? 'Takeaway' : 'Title'}
                  className="input resize-none py-2.5"
                />
              </li>
            ))}
          </ul>

          {pending.items.length === 0 && <p className="muted text-sm">Nothing left to save.</p>}

          <div className="flex gap-2 pb-1 pt-1">
            <button onClick={onClose} className="btn-ghost flex-1">
              Discard
            </button>
            <button onClick={onSave} disabled={saving || !canSave} className="btn-primary flex-[2]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Save {pending.items.length} {plural(pending.items.length)}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
