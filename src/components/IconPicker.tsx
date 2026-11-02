import type { ReactNode } from 'react';
import { BUCKET_ICONS } from '../lib/bucketIcons';
import { automaticIcon } from '../lib/bucketLook';
import { cn } from '../lib/utils';

/**
 * Grid of the 50 bucket icons, plus an "Auto" choice that goes back to the icon worked out from the name.
 * `value` null means Auto. `name` is the bucket name, so the Auto button can show what it would be.
 */
export function IconPicker({ value, onChange, name }: { value: string | null; onChange: (icon: string | null) => void; name: string }) {
  const option = (icon: string | null, label: string, content: ReactNode) => {
    const selected = value === icon;
    return (
      <button
        key={label}
        type="button"
        onClick={() => onChange(icon)}
        aria-pressed={selected}
        aria-label={label}
        title={label}
        className={cn(
          'grid h-9 min-w-[2.25rem] place-items-center rounded-xl px-1.5 text-lg transition hover:bg-ink-900/5 dark:hover:bg-white/5',
          selected ? 'bg-leaf-600/15 ring-2 ring-leaf-500 dark:bg-leaf-400/15' : 'bg-white/50 dark:bg-white/[0.04]',
        )}
      >
        {content}
      </button>
    );
  };

  return (
    <div role="group" aria-label="Bucket icon" className="flex flex-wrap gap-1.5">
      {option(null, `Automatic icon (${automaticIcon(name)})`, <span className="text-xs font-semibold">Auto {automaticIcon(name)}</span>)}
      {BUCKET_ICONS.map((icon) => option(icon, `Icon ${icon}`, icon))}
    </div>
  );
}
