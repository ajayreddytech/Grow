/**
 * How a learning bucket looks: an emoji, a colour tone, a one-line blurb and the empty-state example.
 * Starter buckets have curated text. A custom bucket gets an icon and a colour picked from its name,
 * so every new bucket looks finished without any input from the user.
 */
import { THEME_ICONS } from './bucketIcons';

export interface BucketLook {
  emoji: string;
  accent: string;
  ring: string;
  blurb: string;
  example: string;
}

interface Tone {
  accent: string;
  ring: string;
}

const TONE: Record<string, Tone> = {
  amber: {
    accent: 'from-amber-300/50 via-amber-200/20 dark:from-amber-500/25 dark:via-amber-500/5',
    ring: 'bg-amber-500 text-white dark:bg-amber-400 dark:text-ink-900',
  },
  leaf: {
    accent: 'from-leaf-300/50 via-leaf-200/20 dark:from-leaf-500/25 dark:via-leaf-500/5',
    ring: 'bg-leaf-600 text-white dark:bg-leaf-400 dark:text-ink-900',
  },
  cyan: {
    accent: 'from-cyan-300/50 via-cyan-200/20 dark:from-cyan-500/25 dark:via-cyan-500/5',
    ring: 'bg-cyan-600 text-white dark:bg-cyan-400 dark:text-ink-900',
  },
  rose: {
    accent: 'from-rose-300/50 via-rose-200/20 dark:from-rose-500/25 dark:via-rose-500/5',
    ring: 'bg-rose-500 text-white dark:bg-rose-400 dark:text-ink-900',
  },
  indigo: {
    accent: 'from-indigo-300/50 via-indigo-200/20 dark:from-indigo-500/25 dark:via-indigo-500/5',
    ring: 'bg-indigo-500 text-white dark:bg-indigo-400 dark:text-ink-900',
  },
  fuchsia: {
    accent: 'from-fuchsia-300/50 via-fuchsia-200/20 dark:from-fuchsia-500/25 dark:via-fuchsia-500/5',
    ring: 'bg-fuchsia-500 text-white dark:bg-fuchsia-400 dark:text-ink-900',
  },
  teal: {
    accent: 'from-teal-300/50 via-teal-200/20 dark:from-teal-500/25 dark:via-teal-500/5',
    ring: 'bg-teal-600 text-white dark:bg-teal-400 dark:text-ink-900',
  },
  sky: {
    accent: 'from-sky-300/50 via-sky-200/20 dark:from-sky-500/25 dark:via-sky-500/5',
    ring: 'bg-sky-500 text-white dark:bg-sky-400 dark:text-ink-900',
  },
  violet: {
    accent: 'from-violet-300/50 via-violet-200/20 dark:from-violet-500/25 dark:via-violet-500/5',
    ring: 'bg-violet-500 text-white dark:bg-violet-400 dark:text-ink-900',
  },
  orange: {
    accent: 'from-orange-300/50 via-orange-200/20 dark:from-orange-500/25 dark:via-orange-500/5',
    ring: 'bg-orange-500 text-white dark:bg-orange-400 dark:text-ink-900',
  },
};

/** Curated text for the starter buckets, keyed by lower-cased name. */
const STARTERS: Record<string, { emoji: string; tone: string; blurb: string; example: string }> = {
  'life lessons': {
    emoji: '🧭',
    tone: 'amber',
    blurb: 'Lessons from everyday living that stick.',
    example: 'e.g. “Patience compounds faster than talent.”',
  },
  nature: {
    emoji: '🌿',
    tone: 'leaf',
    blurb: 'What the natural world keeps teaching you.',
    example: 'e.g. “Banyan trees drop roots from their branches to hold themselves up.”',
  },
  technology: {
    emoji: '💻',
    tone: 'cyan',
    blurb: 'Tools, systems and ideas from the tech world.',
    example: 'e.g. “Caching stores results so the same work is not repeated.”',
  },
  culinary: {
    emoji: '🍳',
    tone: 'rose',
    blurb: 'Recipes, techniques and kitchen wisdom.',
    example: 'e.g. “Salt the pasta water well, it is the only seasoning the pasta gets.”',
  },
  'it career': {
    emoji: '💼',
    tone: 'indigo',
    blurb: 'Skills and insights for growing in IT.',
    example: 'e.g. “A one-page summary beats a long status update.”',
  },
  'event management': {
    emoji: '🎪',
    tone: 'fuchsia',
    blurb: 'Planning, logistics and running memorable events.',
    example: 'e.g. “Always keep a backup vendor for the venue.”',
  },
  others: {
    emoji: '✨',
    tone: 'teal',
    blurb: 'Everything else worth remembering.',
    example: 'e.g. “Write the thing down the same day, or lose it.”',
  },
};

/** Icon and colour for custom buckets, matched on the name in order. The first match wins. */
const KEYWORDS: [RegExp, string, string][] = [
  [/\b(finance|money|invest\w*|stocks?|budget|bank\w*|tax\w*|crypto\w*|saving\w*)\b/, '💰', 'amber'],
  [/\b(health\w*|fitness|gym|workouts?|exercise|yoga|diet|sleep|nutrition)\b/, '💪', 'leaf'],
  [/\b(music|guitar|piano|songs?|sing\w*|instruments?)\b/, '🎵', 'violet'],
  [/\b(art|draw\w*|paint\w*|design\w*|sketch\w*|creative)\b/, '🎨', 'rose'],
  [/\b(science|physics|chemistry|biology|research|labs?)\b/, '🔬', 'sky'],
  [/\b(math\w*|algebra|calculus|statistics|geometry)\b/, '📐', 'indigo'],
  [/\b(languages?|spanish|french|german|english|hindi|sanskrit|grammar|vocab\w*)\b/, '🗣️', 'teal'],
  [/\b(books?|reading|literature|novels?|poetry|stories|story)\b/, '📚', 'amber'],
  [/\b(travel\w*|trips?|journey|countr\w*|cities|flights?)\b/, '✈️', 'sky'],
  [/\b(sports?|football|cricket|tennis|running|cycling|swimming)\b/, '⚽', 'leaf'],
  [/\b(writ\w*|blogs?|essays?|journal\w*|poems?)\b/, '✍️', 'fuchsia'],
  [/\b(photo\w*|camera|film\w*|video\w*)\b/, '📷', 'orange'],
  [/\b(marketing|sales|brand\w*|social media|advertis\w*)\b/, '📣', 'orange'],
  [/\b(business|startups?|entrepreneur\w*|strategy|management|leadership|leaders?)\b/, '📈', 'teal'],
  [/\b(psycholog\w*|mind\w*|brain|memory|habits?|emotions?)\b/, '🧠', 'violet'],
  [/\b(history|heritage|ancient|culture|philosoph\w*)\b/, '🏛️', 'amber'],
  [/\b(law|legal|contracts?|rights)\b/, '⚖️', 'indigo'],
  [/\b(medic\w*|doctors?|anatomy|first aid|nursing)\b/, '🩺', 'rose'],
  [/\b(spiritual\w*|scriptures?|gita|devotion\w*|meditat\w*|prayers?|temples?)\b/, '🕉️', 'amber'],
  [/\b(garden\w*|plants?|soil|farm\w*|compost)\b/, '🌱', 'leaf'],
  [/\b(parent\w*|child\w*|kids?|family|babies|baby)\b/, '👪', 'sky'],
  [/\b(home|cleaning|repairs?|diy|carpentry|tools?)\b/, '🔧', 'orange'],
  [/\b(code|coding|programming|software|data|computers?|developers?)\b/, '💻', 'cyan'],
  [/\b(cooking|recipes?|food|baking|kitchen|cuisines?)\b/, '🍳', 'rose'],
  [/\b(careers?|jobs?|resumes?|interviews?)\b/, '💼', 'indigo'],
  [/\b(events?|weddings?|parties|party|conferences?|festivals?)\b/, '🎪', 'fuchsia'],
  [/\b(people|relationships?|friends?|friendship|communication|speaking)\b/, '🤝', 'sky'],
  [/\b(games?|chess|puzzles?)\b/, '🎲', 'violet'],
];

const FALLBACK_EMOJI = ['🌟', '🔖', '🧩', '📌', '🪴', '🗂️', '💡', '🌀', '🔭', '🧶'];
const TONE_ORDER = Object.keys(TONE);

/** A small, stable hash so the same name always gets the same fallback icon and colour. */
const hash = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};

/**
 * The look of a bucket. A chosen icon replaces the automatic emoji; everything else (colour, blurb,
 * example) still comes from the name.
 */
export function bucketLook(name: string, icon?: string | null): BucketLook {
  const look = automaticLook(name);
  return icon ? { ...look, emoji: icon } : look;
}

/** The icon a bucket gets when the user has not picked one. */
export const automaticIcon = (name: string) => automaticLook(name).emoji;

/** Extra icons that suit this bucket's theme, offered first in the icon picker. */
export const suggestedIcons = (name: string): string[] => THEME_ICONS[automaticIcon(name)] ?? [];

function automaticLook(name: string): BucketLook {
  const key = name.trim().toLowerCase();
  const starter = STARTERS[key];
  if (starter) return { emoji: starter.emoji, ...TONE[starter.tone], blurb: starter.blurb, example: starter.example };

  const match = KEYWORDS.find(([re]) => re.test(key));
  const h = hash(key);
  return {
    emoji: match?.[1] ?? FALLBACK_EMOJI[h % FALLBACK_EMOJI.length],
    ...TONE[match?.[2] ?? TONE_ORDER[h % TONE_ORDER.length]],
    blurb: `Everything you learnt about ${key}.`,
    example: `Nothing in ${key} yet. Add what you learnt below.`,
  };
}
