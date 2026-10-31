import { motion } from 'framer-motion';
import { Library } from 'lucide-react';
import { useMemo } from 'react';
import { EmptyState, SectionHeader } from '../components/EntryCard';
import { useApp } from '../context/AppContext';
import { bucketLook } from '../lib/bucketLook';
import { defaultBucketId, type Entry, type LearningBucket } from '../lib/types';
import { fmtDate } from '../lib/utils';

const plural = (n: number) => (n === 1 ? 'learning' : 'learnings');

/** The bucket a learning is shown under: its own bucket if it still exists, otherwise the default one. */
const bucketOf = (e: Entry, buckets: LearningBucket[], home: string | null) =>
  buckets.find((b) => b.id === e.group) ?? buckets.find((b) => b.id === home) ?? null;

/**
 * Every learning you have logged, in one numbered list, oldest first. Mentors, books and workshops are
 * left out: this page is only the learnings.
 */
export function CompendiumSection() {
  const { entries, learningBuckets } = useApp();

  const learnings = useMemo(
    () => entries.filter((e) => e.bucket === 'learning').sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [entries],
  );

  const home = defaultBucketId(learningBuckets);

  return (
    <div>
      <SectionHeader eyebrow="Compendium" title="Everything you learnt">
        {learnings.length > 0 ? `${learnings.length} ${plural(learnings.length)} in the order you logged them, oldest first.` : undefined}
      </SectionHeader>

      {learnings.length === 0 ? (
        <EmptyState icon={<Library className="h-7 w-7" />} title="Nothing compiled yet">
          Log a learning in the Grow section and it will appear here, in order.
        </EmptyState>
      ) : (
        <ol className="card divide-y divide-ink-900/5 overflow-hidden rounded-3xl dark:divide-white/5">
          {learnings.map((e, i) => {
            const bucket = bucketOf(e, learningBuckets, home);
            const look = bucket ? bucketLook(bucket.name) : null;
            return (
              <motion.li
                key={e.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 20) * 0.02 }}
                className="flex gap-4 px-5 py-4 sm:px-6"
              >
                <span className="font-display mt-0.5 w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-leaf-700 dark:text-leaf-300">
                  {i + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] leading-relaxed">{e.title}</p>
                  <p className="muted mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <time dateTime={e.timestamp}>{fmtDate(e.timestamp)}</time>
                    {bucket && look && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="font-semibold">
                          {look.emoji} {bucket.name}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
