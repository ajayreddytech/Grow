import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { titleCase, toIsoOrNull, toMs } from './text';
import { BUCKETS, type Bucket, type Entry, type LearningBucket, type NewEntry } from './types';
import { uid } from './utils';

export interface EntryStore {
  kind: 'local' | 'cloud';
  subscribe(cb: (entries: Entry[]) => void, onError?: (e: Error) => void): () => void;
  add(entry: NewEntry): Promise<void>;
  update(id: string, patch: Partial<NewEntry>): Promise<void>;
  remove(id: string): Promise<void>;
  bulkAdd(entries: NewEntry[]): Promise<void>;
  /** Removes the given entries (all of the user's entries when called from Settings). */
  clear(ids: string[]): Promise<void>;
}

/** Learning buckets: the user's own groups in the Learnings section. */
export interface BucketStore {
  subscribe(cb: (buckets: LearningBucket[]) => void, onError?: (e: Error) => void): () => void;
  add(bucket: LearningBucket): Promise<void>;
  /** Changes the name and/or icon. A field left undefined is not touched; icon null means "automatic". */
  update(id: string, patch: { name?: string; icon?: string | null }): Promise<void>;
  remove(id: string): Promise<void>;
}

const sortDesc = (a: Entry, b: Entry) => toMs(b.timestamp) - toMs(a.timestamp);
const byCreated = (a: LearningBucket, b: LearningBucket) => a.createdAt - b.createdAt;

/** The only fields that are ever written. Titles are Title Cased on the way in. */
const toRecord = (e: Partial<NewEntry>): Partial<NewEntry> => ({
  ...(e.title !== undefined && { title: titleCase(e.title) }),
  ...(e.bucket !== undefined && { bucket: e.bucket }),
  ...(e.timestamp !== undefined && { timestamp: e.timestamp }),
  ...(e.source !== undefined && { source: e.source }),
  ...(e.group !== undefined && { group: e.group }),
  ...(e.order !== undefined && { order: e.order }),
  ...(e.ref !== undefined && { ref: e.ref }),
});

const withId = (e: NewEntry, id: string): Entry => ({
  id,
  bucket: e.bucket,
  title: titleCase(e.title),
  timestamp: e.timestamp,
  source: e.source,
  group: e.group ?? null,
  ...(e.ref && { ref: e.ref }),
});

/**
 * Maps a stored document onto the current schema. Older records kept a numeric timestamp (or
 * `createdAt`), a full `text` body, `audio`, `tag`, `category` and no `source`. Those are converted
 * or ignored here, and learnings keep their takeaway from `text`.
 */
export function normaliseEntry(raw: Record<string, unknown>, id: string): Entry | null {
  const bucket = typeof raw.bucket === 'string' && raw.bucket in BUCKETS ? (raw.bucket as Bucket) : null;
  const timestamp = toIsoOrNull(raw.timestamp) ?? toIsoOrNull(raw.createdAt);
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const title = bucket === 'learning' ? str(raw.text) || str(raw.title) : str(raw.title);
  if (!bucket || timestamp === null || !title) return null;
  const group = bucket === 'learning' && typeof raw.group === 'string' && raw.group ? raw.group : null;
  const source = raw.source === 'manual' ? 'manual' : 'voice';
  const ref = typeof raw.ref === 'string' && raw.ref ? raw.ref : undefined;
  const order = typeof raw.order === 'number' ? raw.order : undefined;
  return { id, bucket, title, timestamp, source, group, ...(order !== undefined && { order }), ...(ref && { ref }) };
}

const normaliseAll = (rows: { raw: Record<string, unknown>; id: string }[]) =>
  rows
    .map(({ raw, id }) => normaliseEntry(raw, id))
    .filter((e): e is Entry => e !== null)
    .sort(sortDesc);

/** Keeps only well-formed bucket records and orders them by creation time. */
function normaliseBuckets(rows: { raw: Record<string, unknown>; id: string }[]): LearningBucket[] {
  return rows
    .map(({ raw, id }) => ({
      id,
      name: typeof raw.name === 'string' ? titleCase(raw.name) : '',
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
      icon: typeof raw.icon === 'string' && raw.icon ? raw.icon : null,
    }))
    .filter((b) => b.name)
    .sort(byCreated);
}

// ---------------------------------------------------------------------------
// Guest mode — Local Storage
// ---------------------------------------------------------------------------

const LS_KEY = 'grow:entries:v1';
const listeners = new Set<(e: Entry[]) => void>();

function readLocal(): Entry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? normaliseAll(parsed.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object').map((raw) => ({ raw, id: String(raw.id ?? uid()) })))
      : [];
  } catch {
    return [];
  }
}

function writeLocal(entries: Entry[]) {
  localStorage.setItem(LS_KEY, JSON.stringify([...entries].sort(sortDesc)));
  const fresh = readLocal();
  listeners.forEach((l) => l(fresh));
}

// Keep multiple tabs in sync.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LS_KEY) listeners.forEach((l) => l(readLocal()));
    if (e.key === BUCKET_LS_KEY) bucketListeners.forEach((l) => l(readLocalBuckets()));
  });
}

export const localStore: EntryStore = {
  kind: 'local',
  subscribe(cb) {
    listeners.add(cb);
    cb(readLocal());
    return () => listeners.delete(cb);
  },
  async add(entry) {
    writeLocal([withId(entry, uid()), ...readLocal()]);
  },
  async update(id, patch) {
    writeLocal(readLocal().map((e) => (e.id === id ? { ...e, ...toRecord(patch) } : e)));
  },
  async remove(id) {
    writeLocal(readLocal().filter((e) => e.id !== id));
  },
  async bulkAdd(entries) {
    writeLocal([...entries.map((e) => withId(e, uid())), ...readLocal()]);
  },
  async clear(ids) {
    const drop = new Set(ids);
    writeLocal(readLocal().filter((e) => !drop.has(e.id)));
  },
};

export const readLocalEntries = readLocal;

// Storage key keeps its original name so buckets made before the Learning rename still load.
const BUCKET_LS_KEY = 'grow:knowledge-buckets:v1';
const bucketListeners = new Set<(b: LearningBucket[]) => void>();

export function readLocalBuckets(): LearningBucket[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(BUCKET_LS_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? normaliseBuckets(parsed.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object').map((raw) => ({ raw, id: String(raw.id ?? uid()) })))
      : [];
  } catch {
    return [];
  }
}

function writeLocalBuckets(buckets: LearningBucket[]) {
  localStorage.setItem(BUCKET_LS_KEY, JSON.stringify([...buckets].sort(byCreated)));
  const fresh = readLocalBuckets();
  bucketListeners.forEach((l) => l(fresh));
}

export const localBucketStore: BucketStore = {
  subscribe(cb) {
    bucketListeners.add(cb);
    cb(readLocalBuckets());
    return () => bucketListeners.delete(cb);
  },
  async add(bucket) {
    writeLocalBuckets([...readLocalBuckets(), bucket]);
  },
  async update(id, patch) {
    writeLocalBuckets(readLocalBuckets().map((b) => (b.id === id ? { ...b, ...patch } : b)));
  },
  async remove(id) {
    writeLocalBuckets(readLocalBuckets().filter((b) => b.id !== id));
  },
};

// ---------------------------------------------------------------------------
// Cloud mode — Firestore at users/{uid}/entries and users/{uid}/knowledgeBuckets
// (the collection keeps its original name so existing cloud data still loads)
// ---------------------------------------------------------------------------

export function firestoreStore(userId: string): EntryStore {
  if (!db) throw new Error('Firestore is not configured');
  const firestore = db;
  const col = collection(firestore, 'users', userId, 'entries');

  return {
    kind: 'cloud',
    subscribe(cb, onError) {
      // No server-side orderBy: documents saved before the `timestamp` field existed would be
      // filtered out by it. Ordering happens in normaliseAll instead.
      return onSnapshot(
        query(col),
        (snap) => cb(normaliseAll(snap.docs.map((d) => ({ raw: d.data(), id: d.id })))),
        (err) => onError?.(err),
      );
    },
    async add(entry) {
      await addDoc(col, toRecord(entry));
    },
    async update(id, patch) {
      await updateDoc(doc(col, id), toRecord(patch));
    },
    async remove(id) {
      await deleteDoc(doc(col, id));
    },
    async bulkAdd(entries) {
      for (let i = 0; i < entries.length; i += 400) {
        const batch = writeBatch(firestore);
        entries.slice(i, i + 400).forEach((e) => batch.set(doc(col), toRecord(e)));
        await batch.commit();
      }
    },
    async clear(ids) {
      for (let i = 0; i < ids.length; i += 400) {
        const batch = writeBatch(firestore);
        ids.slice(i, i + 400).forEach((id) => batch.delete(doc(col, id)));
        await batch.commit();
      }
    },
  };
}

export function firestoreBucketStore(userId: string): BucketStore {
  if (!db) throw new Error('Firestore is not configured');
  const firestore = db;
  const col = collection(firestore, 'users', userId, 'knowledgeBuckets');

  return {
    subscribe(cb, onError) {
      return onSnapshot(
        query(col),
        (snap) => cb(normaliseBuckets(snap.docs.map((d) => ({ raw: d.data(), id: d.id })))),
        (err) => onError?.(err),
      );
    },
    // Explicit ids: guest buckets keep theirs when imported, so filed learnings still point at them.
    async add(bucket) {
      await setDoc(doc(col, bucket.id), {
        name: titleCase(bucket.name),
        createdAt: bucket.createdAt,
        ...(bucket.icon ? { icon: bucket.icon } : {}),
      });
    },
    async update(id, patch) {
      // Firestore rejects undefined values, so only the fields that were given are written.
      await updateDoc(doc(col, id), {
        ...(patch.name !== undefined && { name: titleCase(patch.name) }),
        ...(patch.icon !== undefined && { icon: patch.icon }),
      });
    },
    async remove(id) {
      await deleteDoc(doc(col, id));
    },
  };
}
