import { motion } from 'framer-motion';
import { HeartHandshake, ScrollText, Settings, Sprout, TrendingUp, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

export type SectionId = 'grow' | 'learning' | 'mentors' | 'curve' | 'settings';

export const NAV: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: 'grow', label: 'Grow', icon: Sprout },
  { id: 'learning', label: 'Learnings', icon: ScrollText },
  { id: 'mentors', label: 'Mentors', icon: HeartHandshake },
  { id: 'curve', label: 'Learning Curve', icon: TrendingUp },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface Props {
  active: SectionId;
  onChange: (id: SectionId) => void;
}

export function Sidebar({ active, onChange }: Props) {
  return (
    <>
      {/* Desktop / tablet: compact floating rail, vertically centred on the left */}
      <nav
        aria-label="Primary"
        className="glass fixed left-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-1.5 rounded-2xl p-2 backdrop-blur-md md:flex lg:left-6"
      >
        {NAV.map((item) => (
          <RailButton key={item.id} item={item} active={active === item.id} onClick={() => onChange(item.id)} />
        ))}
      </nav>

      {/* Mobile: bottom floating pill, lifted above the iPhone home indicator */}
      <nav
        aria-label="Primary"
        className="glass fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md items-center justify-between rounded-full p-1.5 backdrop-blur-md md:hidden"
        style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative grid h-11 flex-1 place-items-center rounded-full transition',
                isActive ? 'text-white dark:text-ink-900' : 'text-ink-900/60 dark:text-leaf-50/60',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="mobile-nav-pill"
                  className="absolute inset-0 rounded-full bg-leaf-600 shadow-glow dark:bg-leaf-400"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <Icon className="relative h-5 w-5" />
            </button>
          );
        })}
      </nav>
    </>
  );
}

function RailButton({ item, active, onClick }: { item: (typeof NAV)[number]; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative grid h-11 w-11 place-items-center rounded-xl transition',
        active
          ? 'text-white dark:text-ink-900'
          : 'text-ink-900/60 hover:bg-ink-900/5 hover:text-ink-900 dark:text-leaf-50/60 dark:hover:bg-white/5 dark:hover:text-leaf-50',
      )}
    >
      {active && (
        <motion.span
          layoutId="rail-pill"
          className="absolute inset-0 rounded-xl bg-leaf-600 shadow-glow dark:bg-leaf-400"
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      )}
      <Icon className="relative h-5 w-5" />
      <Tooltip>{item.label}</Tooltip>
    </button>
  );
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-ink-900 px-2.5 py-1 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-leaf-50 dark:text-ink-900">
      {children}
    </span>
  );
}
