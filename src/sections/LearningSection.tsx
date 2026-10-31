import { useMemo } from 'react';
import { SectionHeader } from '../components/EntryCard';
import { LearningBuckets } from '../components/LearningBuckets';
import { useApp } from '../context/AppContext';

export function LearningSection() {
  const { entries } = useApp();
  const learnings = useMemo(() => entries.filter((e) => e.bucket === 'learning'), [entries]);

  return (
    <div>
      <SectionHeader eyebrow="Learnings" title="Learnt About" />

      <div className="mt-8">
        <LearningBuckets learnings={learnings} />
      </div>
    </div>
  );
}
