import { motion } from 'framer-motion';
import { Check, Cloud, Database, HardDrive, LogIn, LogOut, Moon, Sun, Upload } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { SectionHeader } from '../components/EntryCard';
import { useApp } from '../context/AppContext';
import { firebaseEnabled } from '../lib/firebase';
import { readLocalEntries } from '../lib/store';
import { cn } from '../lib/utils';

export function SettingsSection() {
  const app = useApp();
  const { theme, toggleTheme, guestMode, setGuestMode, user, signIn, signOut, storeKind, entries, notify } = app;
  const [busy, setBusy] = useState(false);
  const localCount = storeKind === 'cloud' ? readLocalEntries().length : 0;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <SectionHeader eyebrow="Settings" title="Make Grow yours" />
      <div className="mx-auto flex max-w-xl flex-col gap-5">
        {/* Account */}
        <Card icon={<Cloud className="h-5 w-5" />} title="Cloud sync" desc="Sign in with Google to sync entries and buckets across devices.">
          {user ? (
            <div className="flex items-center gap-3 rounded-2xl bg-leaf-500/10 p-3">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-full" />
              ) : (
                <span className="grid h-10 w-10 place-items-center rounded-full bg-leaf-600 font-semibold text-white">{user.displayName?.[0] ?? '?'}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user.displayName ?? 'Signed in'}</p>
                <p className="muted truncate text-xs">{user.email}</p>
              </div>
              <button onClick={() => void signOut()} className="btn-ghost px-3 py-2 text-xs">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          ) : (
            <button onClick={() => void signIn()} disabled={!firebaseEnabled} className="btn-primary w-full">
              <LogIn className="h-4 w-4" /> Continue with Google
            </button>
          )}
          {!firebaseEnabled && <p className="muted mt-3 text-xs">Cloud sync is unavailable on this build. Guest mode keeps your data in this browser.</p>}
        </Card>

        {/* Storage mode */}
        <Card icon={<HardDrive className="h-5 w-5" />} title="Guest mode" desc="Keep everything in this browser’s Local Storage — no account needed.">
          <Toggle
            checked={guestMode}
            disabled={!firebaseEnabled}
            onChange={(v) => {
              setGuestMode(v);
              if (!v && !user) notify('Sign in with Google to start syncing.', 'info');
            }}
            label={guestMode ? 'Using Local Storage' : user ? 'Syncing to Firestore' : 'Cloud mode — sign in to sync'}
            hint={!firebaseEnabled ? 'Firebase isn’t configured, so guest mode is always on.' : undefined}
          />
          <div className="muted mt-3 flex items-center gap-2 text-xs">
            <Database className="h-3.5 w-3.5" />
            Active store: <b className="text-ink-900 dark:text-leaf-50">{storeKind === 'cloud' ? 'Firestore' : 'Local Storage'}</b> · {entries.length} entries
          </div>
          {storeKind === 'cloud' && localCount > 0 && (
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const n = await app.importGuestEntries();
                  notify(n ? `Imported ${n} guest entries to the cloud` : 'Guest entries are already synced', 'info');
                })
              }
              className="btn-ghost mt-3 w-full text-xs"
            >
              <Upload className="h-4 w-4" /> Import {localCount} guest entries into your account
            </button>
          )}
        </Card>

        {/* Appearance */}
        <Card icon={theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />} title="Appearance" desc="Switch between light and dark themes.">
          <div className="grid grid-cols-2 gap-2">
            {(['light', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => theme !== t && toggleTheme()}
                className={cn(
                  'relative overflow-hidden rounded-2xl border p-3 text-left text-sm font-semibold transition',
                  theme === t ? 'border-leaf-500 ring-2 ring-leaf-500/30' : 'border-ink-900/10 hover:border-leaf-500/40 dark:border-white/10',
                )}
              >
                <div className={cn('mb-2 h-12 rounded-xl', t === 'light' ? 'bg-gradient-to-br from-cream-50 via-leaf-100 to-amber-100' : 'bg-gradient-to-br from-ink-900 via-leaf-950 to-ink-800')} />
                {t === 'light' ? 'Light' : 'Dark'}
                {theme === t && <Check className="absolute right-3 top-3 h-4 w-4 text-leaf-600" />}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Card({ icon, title, desc, children }: { icon: ReactNode; title: string; desc: string; children: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-leaf-500/10 text-leaf-700 dark:text-leaf-300">{icon}</span>
        <div>
          <h2 className="font-display text-lg font-semibold leading-tight">{title}</h2>
          <p className="muted text-xs">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-3', disabled && 'cursor-not-allowed opacity-70')}>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-leaf-600 dark:bg-leaf-400' : 'bg-ink-900/15 dark:bg-white/15')}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 34 }}
          className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow', checked ? 'right-1' : 'left-1')}
        />
      </button>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="muted block text-xs">{hint}</span>}
      </span>
    </label>
  );
}
