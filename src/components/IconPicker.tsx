import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { BUCKET_ICONS } from '../lib/bucketIcons';
import { automaticIcon, suggestedIcons } from '../lib/bucketLook';
import { cn } from '../lib/utils';

/**
 * Icon picker for a bucket. Shows the current choice in a dropdown button; opening it reveals a
 * scrollable grid of icons in rows and columns: an "Auto" choice (the icon worked out from the name),
 * icons suited to this bucket's theme, then every bucket icon. `value` null means Auto. `name` is the bucket name.
 */
export function IconPicker({ value, onChange, name }: { value: string | null; onChange: (icon: string | null) => void; name: string }) {
  const [open, setOpen] = useState(false);
  const auto = automaticIcon(name);
  const suggested = [...new Set(suggestedIcons(name))];

  const cell = (icon: string | null, label: string, content: ReactNode) => {
    const selected = value === icon;
    return (
      <button
        key={label}
        type="button"
        onClick={() => {
          onChange(icon);
          setOpen(false);
        }}
        aria-pressed={selected}
        aria-label={label}
        title={label}
        className={cn(
          'grid aspect-square place-items-center rounded-lg text-lg transition hover:bg-ink-900/5 dark:hover:bg-white/5',
          selected ? 'bg-leaf-600/15 ring-2 ring-leaf-500 dark:bg-leaf-400/15' : 'bg-white/50 dark:bg-white/[0.04]',
        )}
      >
        {content}
      </button>
    );
  };

  const section = (title: string, icons: string[]) => (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-ink-900/60 dark:text-white/60">{title}</p>
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">{icons.map((icon) => cell(icon, `Icon ${icon}`, icon))}</div>
    </div>
  );

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Choose icon"
        className="input flex w-full items-center justify-between gap-2 py-2 text-left"
      >
        <span className="flex items-center gap-2 text-sm">
          <span className="text-lg leading-none">{value ?? auto}</span>
          <span className="muted text-xs">{value ? 'Custom icon' : `Auto (${auto})`}</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div role="group" aria-label="Bucket icon" className="card mt-2 max-h-72 space-y-4 overflow-y-auto p-3">
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {cell(null, `Automatic icon (${auto})`, <span className="text-xs font-semibold">Auto</span>)}
          </div>
          {suggested.length > 0 && section('Suggested for this bucket', suggested)}
          {section('All icons', BUCKET_ICONS)}
        </div>
      )}
    </div>
  );
}
