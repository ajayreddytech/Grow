const MINOR_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'nor', 'of', 'on', 'or', 'over', 'the', 'to', 'with']);

/**
 * Title Case for spoken titles: "unfinished business" → "Unfinished Business". Small words stay
 * lower case unless they open the title, and all-caps acronyms such as "SP" are kept as they are.
 */
export function titleCase(input: string): string {
  return input
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word, i) => {
      if (word.length > 1 && word === word.toUpperCase()) return word;
      const lower = word.toLowerCase();
      if (i > 0 && MINOR_WORDS.has(lower)) return lower;
      return lower
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('-');
    })
    .join(' ');
}

/** Epoch milliseconds from either a stored ISO string or a legacy number. */
export const toMs = (ts: string | number): number => (typeof ts === 'number' ? ts : Date.parse(ts));

/** ISO 8601 UTC string for an epoch-millisecond value. */
export const toIso = (ms: number): string => new Date(ms).toISOString();

/** ISO string from a stored value that may be an ISO string or a legacy number. Null when unusable. */
export function toIsoOrNull(v: unknown): string | null {
  const ms = typeof v === 'number' ? v : typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(ms) ? toIso(ms) : null;
}
