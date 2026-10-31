import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** "center" = dialog; "drawer" = slides up on mobile, in from the right on desktop */
  variant?: 'center' | 'drawer';
  className?: string;
}

export function Modal({ open, onClose, title, subtitle, children, variant = 'center', className }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const drawer = variant === 'drawer';

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className={cn(
            'fixed inset-0 z-50 flex',
            drawer ? 'items-end justify-end sm:items-stretch' : 'items-end justify-center sm:items-center sm:p-6',
          )}
        >
          <motion.div
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm dark:bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn(
              'glass-strong relative flex max-h-[92dvh] w-full flex-col overflow-hidden',
              drawer
                ? 'rounded-t-[2rem] sm:h-full sm:max-h-none sm:w-[min(38rem,92vw)] sm:rounded-none sm:rounded-l-[2rem]'
                : 'rounded-t-[2rem] sm:max-w-lg sm:rounded-[2rem]',
              className,
            )}
            initial={drawer ? { y: '100%' } : { y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={drawer ? { y: '100%' } : { y: 30, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            {(title || subtitle) && (
              <div className="flex items-start justify-between gap-4 border-b border-ink-900/5 px-6 pb-4 pt-6 dark:border-white/5">
                <div className="min-w-0">
                  {title && <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>}
                  {subtitle && <p className="muted mt-1 text-sm">{subtitle}</p>}
                </div>
                <button onClick={onClose} className="btn-ghost h-9 w-9 shrink-0 rounded-full p-0" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="scrollbar-thin pb-safe flex-1 overflow-y-auto px-6 pt-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
