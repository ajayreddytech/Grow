export type Bucket = 'learning' | 'prabhupada' | 'mentorship' | 'workshop' | 'recall';

/**
 * A single saved record. Learnings store the core takeaway as `title`; books, mentor sessions and
 * workshops store their name. Learnings can also be filed into a user-made learning bucket.
 * Titles are always Title Case.
 */
export interface Entry {
  id: string;
  bucket: Bucket;
  title: string;
  /** ISO 8601 UTC, e.g. "2026-10-30T12:00:00.000Z". The exact moment, or the date spoken for dated sources. */
  timestamp: string;
  /** Captured by voice, or added by hand in the Learning section. */
  source: 'voice' | 'manual';
  /** Learnings only: id of the learning bucket they are filed in. null = not filed yet, shown under the default bucket. */
  group?: string | null;
  /** Learnings only: position chosen by hand inside their bucket (0, 1, 2 …). null or missing = not placed yet. */
  order?: number | null;
  /** Recall only: id of the Prabhupada, mentor or workshop entry this checklist item was copied from. */
  ref?: string | null;
}

export type NewEntry = Omit<Entry, 'id'>;

/**
 * A user-created bucket in the Learnings section. `icon` is an emoji the user picked; null or missing
 * means the icon is worked out from the name (see bucketLook).
 */
export interface LearningBucket {
  id: string;
  name: string;
  createdAt: number;
  icon?: string | null;
}

/** Created the first time the Learning page is opened on a device or account. Keep "Others" last. */
export const SEED_LEARNING_BUCKETS = [
  'Life Lessons',
  'Nature',
  'Technology',
  'Culinary',
  'IT Career',
  'Event Management',
  'Others',
];

/** The bucket that unfiled learnings belong to: "Others" if there is one, otherwise the first bucket. */
export const defaultBucketId = (buckets: LearningBucket[]) =>
  buckets.find((b) => b.name.trim().toLowerCase() === 'others')?.id ?? buckets[0]?.id ?? null;

export const BUCKETS: Record<Bucket, { label: string; short: string; emoji: string }> = {
  learning: { label: 'Learning', short: 'Learning', emoji: '🌿' },
  prabhupada: { label: 'Srila Prabhupada', short: 'Srila Prabhupada', emoji: '📘' },
  mentorship: { label: 'Mentors', short: 'Mentors', emoji: '🤝' },
  workshop: { label: 'Workshops', short: 'Workshops', emoji: '🛠️' },
  recall: { label: 'Recall & Strengthen', short: 'Recall', emoji: '💪' },
};
