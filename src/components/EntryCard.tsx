import { cn } from '../lib/utils';
import type { Bucket } from '../lib/types';

export const BUCKET_STYLE: Record<Bucket, string> = {
  learning: 'bg-leaf-500/10 text-leaf-700 dark:bg-leaf-400/15 dark:text-leaf-300',
  prabhupada: 'bg-amber-500/15 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300',
  mentorship: 'bg-sky-500/10 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300',
  workshop: 'bg-violet-500/10 text-violet-800 dark:bg-violet-400/15 dark:text-violet-300',
};

export function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-ink-900/10 px-6 py-12 text-center dark:border-white/10">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-leaf-500/10 text-2xl text-leaf-600 dark:text-leaf-300">
        {icon}
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {children && <p className="muted mt-1 max-w-sm text-sm">{children}</p>}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  align = 'left',
  children,
}: {
  eyebrow: string;
  title: string;
  align?: 'left' | 'center';
  children?: React.ReactNode;
}) {
  const centered = align === 'center';
  return (
    <header className={cn('mb-6 sm:mb-8', centered && 'text-center')}>
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      {children && <p className={cn('muted mt-2 max-w-2xl text-[15px]', centered && 'mx-auto')}>{children}</p>}
    </header>
  );
}
