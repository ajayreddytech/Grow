import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

export function Logo({ className, size = 'lg' }: { className?: string; size?: 'sm' | 'lg' }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <motion.span
        initial={{ scale: 0, rotate: -30, y: 12 }}
        animate={{ scale: 1, rotate: 0, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
        className={cn(
          'relative grid place-items-center rounded-2xl bg-gradient-to-br from-leaf-200 to-leaf-400/70 shadow-glow dark:from-leaf-700/60 dark:to-leaf-900',
          size === 'lg' ? 'h-12 w-12 text-2xl' : 'h-9 w-9 text-lg',
        )}
      >
        <span className="inline-block origin-bottom animate-sway">🌱</span>
      </motion.span>
      <span className={cn('font-display font-semibold tracking-tight', size === 'lg' ? 'text-3xl sm:text-4xl' : 'text-xl')}>
        Grow
      </span>
    </div>
  );
}
