import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut, type User } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { auth, firebaseEnabled, googleProvider } from '../lib/firebase';
import {
  firestoreBucketStore,
  firestoreStore,
  localBucketStore,
  localStore,
  readLocalBuckets,
  readLocalEntries,
  type BucketStore,
  type EntryStore,
} from '../lib/store';
import { titleCase } from '../lib/text';
import { SEED_LEARNING_BUCKETS, type Entry, type LearningBucket, type NewEntry } from '../lib/types';
import { uid } from '../lib/utils';

type Theme = 'light' | 'dark';

export interface Toast {
  id: string;
  message: string;
  tone: 'success' | 'error' | 'info';
}

interface AppState {
  theme: Theme;
  toggleTheme: () => void;
  guestMode: boolean;
  setGuestMode: (v: boolean) => void;
  user: User | null;
  authReady: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  storeKind: 'local' | 'cloud';
  entries: Entry[];
  loading: boolean;
  updateEntry: (id: string, patch: Partial<NewEntry>) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  bulkAdd: (e: NewEntry[]) => Promise<void>;
  clearAll: () => Promise<void>;
  importGuestEntries: () => Promise<number>;
  learningBuckets: LearningBucket[];
  /** Throws a readable Error when the name is empty, too long or already used. */
  addLearningBucket: (name: string, icon?: string | null) => Promise<void>;
  /** Changes the name and icon together. icon null goes back to the automatic icon. */
  renameLearningBucket: (id: string, name: string, icon?: string | null) => Promise<void>;
  /** Deletes the bucket and moves its learnings to `moveTo`. Resolves with how many moved. */
  removeLearningBucket: (id: string, moveTo: string) => Promise<number>;
  toasts: Toast[];
  notify: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
}

const Ctx = createContext<AppState | null>(null);

const readPref = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const writePref = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );
  const [guestMode, setGuestModeState] = useState<boolean>(() => {
    if (!firebaseEnabled) return true;
    return readPref('grow:guest') !== 'false';
  });
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!auth);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [learningBuckets, setLearningBuckets] = useState<LearningBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimers = useRef(new Map<string, number>());

  // ---- Theme -------------------------------------------------------------
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#06110c' : '#f5f2e8');
    writePref('grow:theme', theme);
  }, [theme]);
  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  // ---- Toasts ------------------------------------------------------------
  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    window.clearTimeout(toastTimers.current.get(id));
    toastTimers.current.delete(id);
  }, []);
  const notify = useCallback(
    (message: string, tone: Toast['tone'] = 'success') => {
      const id = uid();
      setToasts((t) => [...t.slice(-2), { id, message, tone }]);
      toastTimers.current.set(id, window.setTimeout(() => dismissToast(id), 3800));
    },
    [dismissToast],
  );

  // ---- Auth --------------------------------------------------------------
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  const setGuestMode = useCallback((v: boolean) => {
    setGuestModeState(v);
    writePref('grow:guest', String(v));
  }, []);

  const signIn = useCallback(async () => {
    if (!auth) {
      notify('Firebase is not configured — add your keys to .env first.', 'error');
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
      setGuestMode(false);
      notify('Signed in — your entries now sync to the cloud.');
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request')
        notify(`Sign-in failed: ${code || (err as Error).message}`, 'error');
    }
  }, [notify, setGuestMode]);

  const signOut = useCallback(async () => {
    if (auth) await fbSignOut(auth);
    setGuestMode(true);
    notify('Signed out — using local storage.', 'info');
  }, [notify, setGuestMode]);

  // ---- Store selection ---------------------------------------------------
  const store: EntryStore = useMemo(() => {
    if (!guestMode && user && firebaseEnabled) {
      try {
        return firestoreStore(user.uid);
      } catch {
        return localStore;
      }
    }
    return localStore;
  }, [guestMode, user]);

  useEffect(() => {
    if (store.kind === 'cloud' || authReady) {
      setLoading(true);
      return store.subscribe(
        (e) => {
          setEntries(e);
          setLoading(false);
        },
        (err) => {
          setLoading(false);
          notify(`Cloud sync error: ${err.message}`, 'error');
        },
      );
    }
  }, [store, authReady, notify]);

  const bucketStore: BucketStore = useMemo(
    () => (store.kind === 'cloud' && user ? firestoreBucketStore(user.uid) : localBucketStore),
    [store, user],
  );

  // Starter buckets are added once per account (or once per device in guest mode). The v2 key
  // tops up accounts seeded before the current starter list: any missing default is added, and
  // buckets the user already has (or deleted on purpose) are left alone. Fixed ids make a repeated
  // write harmless.
  const seedKey = `grow:learning-seeded:v2:${store.kind === 'cloud' && user ? user.uid : 'guest'}`;
  useEffect(
    () =>
      bucketStore.subscribe(
        (list) => {
          setLearningBuckets(list);
          if (readPref(seedKey) === 'yes') return;
          writePref(seedKey, 'yes');
          const have = new Set(list.map((b) => b.name.toLowerCase()));
          const missing = SEED_LEARNING_BUCKETS.filter((name) => !have.has(name.toLowerCase()));
          missing.forEach((name, i) => {
            const id = `seed-${name.toLowerCase().replace(/\s+/g, '-')}`;
            bucketStore
              .add({ id, name, createdAt: list.length ? Date.now() + i : i + 1 })
              .catch((err: Error) => notify(`Couldn’t add starter buckets: ${err.message}`, 'error'));
          });
        },
        (err) => notify(`Cloud sync error: ${err.message}`, 'error'),
      ),
    [bucketStore, notify, seedKey],
  );

  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const bucketsRef = useRef(learningBuckets);
  bucketsRef.current = learningBuckets;

  /** Title Cases, trims, collapses spaces and rejects empty, overlong or duplicate names (case-insensitive). */
  const checkBucketName = (name: string, id?: string) => {
    const clean = titleCase(name);
    if (!clean) throw new Error('Give the bucket a name.');
    if (clean.length > 40) throw new Error('Keep bucket names under 40 characters.');
    if (bucketsRef.current.some((b) => b.id !== id && b.name.toLowerCase() === clean.toLowerCase()))
      throw new Error(`You already have a bucket called “${clean}”.`);
    return clean;
  };

  const value: AppState = {
    theme,
    toggleTheme,
    guestMode,
    setGuestMode,
    user,
    authReady,
    signIn,
    signOut,
    storeKind: store.kind,
    entries,
    loading,
    updateEntry: (id, p) => store.update(id, p),
    removeEntry: (id) => store.remove(id),
    bulkAdd: (e) => store.bulkAdd(e),
    clearAll: () => store.clear(entriesRef.current.map((e) => e.id)),
    importGuestEntries: async () => {
      if (store.kind !== 'cloud') return 0;
      const local = readLocalEntries();
      const key = (e: Entry) => `${e.timestamp}|${e.bucket}|${e.title}`;
      const existing = new Set(entriesRef.current.map(key));
      const fresh = local.filter((e) => !existing.has(key(e))).map(({ id: _id, ...rest }) => rest);
      // Buckets keep their ids, so imported learnings stay filed under the same buckets.
      const haveIds = new Set(bucketsRef.current.map((b) => b.id));
      for (const b of readLocalBuckets()) if (!haveIds.has(b.id)) await bucketStore.add(b);
      await store.bulkAdd(fresh);
      return fresh.length;
    },
    learningBuckets,
    addLearningBucket: async (name, icon) => {
      await bucketStore.add({ id: uid(), name: checkBucketName(name), createdAt: Date.now(), icon: icon ?? null });
    },
    renameLearningBucket: async (id, name, icon) => {
      await bucketStore.update(id, { name: checkBucketName(name, id), icon });
    },
    removeLearningBucket: async (id, moveTo) => {
      if (!moveTo || moveTo === id) throw new Error('Pick a different bucket to move the learnings to.');
      const moved = entriesRef.current.filter((e) => e.group === id);
      await Promise.all(moved.map((e) => store.update(e.id, { group: moveTo })));
      await bucketStore.remove(id);
      return moved.length;
    },
    toasts,
    notify,
    dismissToast,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside <AppProvider>');
  return v;
}
