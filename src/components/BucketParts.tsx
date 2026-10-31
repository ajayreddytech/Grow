import { motion } from 'framer-motion';
import { ChevronDown, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useApp } from '../context/AppContext';

/** Bottom row of a bucket card: the stats on the left and the expand chevron on the right. */
export function BucketFooter({ label, open, onToggle }: { label: ReactNode; open: boolean; onToggle: () => void }) {
  return (
    <div className="relative px-5 pb-5 sm:px-6 sm:pb-6">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full min-w-0 items-center justify-between gap-2 text-left">
        <span className="muted flex min-w-0 items-center gap-1.5 text-xs font-medium">{label}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="muted shrink-0">
          <ChevronDown className="h-5 w-5" />
        </motion.span>
      </button>
    </div>
  );
}

/**
 * Add-by-hand row at the top of an expanded bucket. The timestamp is logged automatically (the moment
 * of adding); the user only types the content. Adds through `onAdd`, then clears itself.
 */
export function AddEntryForm({ placeholder, onAdd }: { placeholder: string; onAdd: (title: string, timestamp: string) => Promise<void> }) {
  const { notify } = useApp();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const clean = title.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      await onAdd(clean, new Date().toISOString());
      setTitle('');
      notify(`Added “${clean}”`);
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="mb-3 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        maxLength={160}
        aria-label={placeholder}
        className="input min-w-0 flex-1 py-2 text-sm"
      />
      <button type="submit" disabled={!title.trim() || busy} className="btn-primary shrink-0 px-3 py-2 text-xs">
        <Plus className="h-3.5 w-3.5" /> Add
      </button>
    </form>
  );
}
