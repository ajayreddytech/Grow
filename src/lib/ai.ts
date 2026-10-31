import { titleCase, toIso } from './text';
import { defaultBucketId, type Bucket, type LearningBucket, type NewEntry } from './types';

/**
 * AI helper — extracts the saved records from a spoken or typed note.
 *
 * With VITE_AI_PROVIDER set to "anthropic" or "openai" (and a key or proxy URL) it calls the
 * real model. Otherwise it runs an on-device simulation that is good enough for everyday notes,
 * so the app is fully usable offline and without any keys.
 */

const env = import.meta.env;
const provider = (env.VITE_AI_PROVIDER as string | undefined)?.trim().toLowerCase();
const proxyUrl = env.VITE_AI_PROXY_URL as string | undefined;
const anthropicKey = env.VITE_ANTHROPIC_API_KEY as string | undefined;
const openaiKey = env.VITE_OPENAI_API_KEY as string | undefined;

export const aiMode: 'anthropic' | 'openai' | 'proxy' | 'simulation' = proxyUrl
  ? 'proxy'
  : provider === 'anthropic' && anthropicKey
    ? 'anthropic'
    : provider === 'openai' && openaiKey
      ? 'openai'
      : 'simulation';

const systemPrompt = (bucketNames: string[]) => `You are the assistant inside "Grow", a personal learning journal.
Given a raw note (often a voice transcript), return ONLY a JSON object with keys:
- "bucket": one of "learning" | "prabhupada" | "mentorship" | "workshop". Use "prabhupada" for anything read from books by Srila Prabhupada (Bhagavad-gita As It Is, Srimad-Bhagavatam, Nectar of Devotion, etc.), "mentorship" for mentor/coach/1:1 sessions, "workshop" for workshops, bootcamps, seminars or classes attended. Otherwise "learning".
- "learnings": only for "learning". An array with one string per distinct takeaway (e.g. from "I learned X, I learned Y"). Each string is the core takeaway only, with corrected grammar and no boilerplate such as "today I learned that". Empty array otherwise.
- "group": only for "learning". The learning bucket the speaker asked for (e.g. "add it to Finance"), or the one the subject belongs to (metal detectors → "Technology", banyan trees → "Nature", a wedding or event → "Event Management"). It must be exactly one of these names: ${bucketNames.length ? bucketNames.map((n) => `"${n}"`).join(', ') : 'none yet'}. Empty string if none fits.
- "title": only for the other buckets. The book name (plus chapter if mentioned), or the session/workshop name. Max 60 chars. Empty string for "learning".
- "date": only for the other buckets. The date spoken in the note as "YYYY-MM-DD", or "YYYY-MM" if only a month and year were given, or "" if none was mentioned. Empty string for "learning".
Other rules: a sentence that begins "I can" is a capability. Return it as one learning, verbatim, with group "Event Management". Books the speaker read that are not by Srila Prabhupada are "learning" with group "Life Lessons" and the book name as the learning.
Do not include any other keys or commentary.`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Turns a raw transcript into the records to save. `buckets` are the user's learning buckets, so
 * "add it to Finance" can file the learning there. Returns [] when nothing usable was said.
 * Fixed commands ("Add X to SP books", "I learned about X in Finance") are routed locally first,
 * so they never need a network call.
 */
export async function extractEntries(raw: string, buckets: LearningBucket[] = []): Promise<NewEntry[]> {
  const input = raw.trim();
  if (!input) return [];
  const routed = routeCommand(input, Date.now(), buckets);
  if (routed) return [routed];
  if (aiMode !== 'simulation') {
    try {
      const remote = await callModel(input, buckets);
      if (remote?.length) return remote;
    } catch (err) {
      console.warn('[Grow] AI provider failed, using on-device helper.', err);
    }
  }
  // Small delay so the UI can show its "thinking" state consistently.
  await new Promise((r) => setTimeout(r, 450));
  return simulate(input, Date.now(), buckets);
}

export function simulate(raw: string, at = Date.now(), buckets: LearningBucket[] = []): NewEntry[] {
  const routed = routeCommand(raw, at, buckets);
  if (routed) return [routed];
  const corrected = correctGrammar(raw);
  const { text, group } = findPlacement(corrected, buckets);
  const bucket = detectBucket(text);
  if (bucket === 'learning')
    return splitLearnings(text).map((takeaway): NewEntry => {
      const title = titleCase(takeaway);
      return { bucket, title, timestamp: toIso(at), source: 'voice', group: group?.id ?? filingFor(title, buckets) };
    });
  return [{ bucket, title: titleCase(detectTitle(text, bucket)), timestamp: toIso(detectTimestamp(text) ?? at), source: 'voice' }];
}

/**
 * Spoken commands with a fixed target. Each pattern captures the entity name in group 1.
 *   "Add [BOOK] to SP books"         → prabhupada (Srila Prabhupada books)
 *   "Add [NAME] to mentors"          → mentorship
 *   "Add [NAME] to workshops" / "I attended [NAME] workshop" → workshop
 *   "I learned about [TOPIC]"        → learning, filed by subject (else Others)
 *   "I learned about [TOPIC] in [BUCKET]" → learning, filed in BUCKET when it matches one of yours
 */
const COMMANDS = {
  spBooks: /^(?:please\s+)?add\s+(.+?)\s+to\s+(?:the\s+)?(?:sp|s\.\s?p\.?|srila\s+prabhupada(?:'s)?|prabhupada(?:'s)?)\s+books?[.!?]?$/i,
  mentors: /^(?:please\s+)?add\s+(.+?)\s+to\s+(?:the\s+)?mentors?[.!?]?$/i,
  workshops: /^(?:please\s+)?add\s+(.+?)\s+to\s+(?:the\s+)?workshops?[.!?]?$/i,
  // "[I attended] The Forgiveness Workshop", "… Ultimate Health Challenge". The name ends at the
  // keyword, and anything after it is kept so a spoken date ("… workshop in March 2025") still counts.
  workshopName: /^(?:(?:i\s+)?(?:just\s+)?(?:attended|completed|did|finished|joined)\s+)?(?!i\s+learn)(.+?\s+(?:workshop|bootcamp|challenge))\b(.*)$/i,
  // "I read Life Comes from Life", "I'm reading The 5:00 AM Club". "I read about…" is a learning.
  book: /^(?:i\s+)?(?:just\s+)?(?:(?:have\s+)?read|finished\s+reading|(?:am|i'm)\s+reading)\s+(?!(?:about|more|up|this|that|it)\b)(?:the\s+book\s+|book\s+)?(.+?)(?:\s+book)?[.!?]?$/i,
  learnedAbout: /^(?:today\s+)?i\s+learn(?:ed|t)\s+about\s+(.+?)[.!?]?$/i,
  capability: /^i\s+can\b.+$/i,
};

/**
 * Default-bucket keywords. A learning that names none of the user's buckets is filed by its
 * subject, e.g. "Working of metal detectors" → Technology. Order matters: the first match wins.
 */
const TOPIC_HINTS: [string, RegExp][] = [
  ['Technology', /\b(metal detectors?|technolog\w*|computers?|software|hardware|apps?|internet|code|coding|programming|algorithms?|circuits?|batter(?:y|ies)|electronics?|engines?|robots?|artificial intelligence|machine learning|cloud|databases?|networks?|smartphones?|sensors?|radars?|satellites?|gadgets?|java|javascript|typescript|python|kotlin|golang|rust|sql|html|css|react|linux|docker|kubernetes|git|api|frameworks?|libraries|compilers?)\b/i],
  ['Nature', /\b(trees?|banyans?|plants?|flowers?|birds?|rivers?|oceans?|forests?|mountains?|soils?|weather|animals?|ecosystems?|leaves|insects?|bees?|rain|monsoons?|seeds?|clouds?)\b/i],
  ['Culinary', /\b(recipes?|cook(?:ing|s)?|spices?|dish(?:es)?|bak(?:e|ing)|food|flavou?rs?|ingredients?|sauces?|curry|rice|bread|cuisines?|nutrition)\b/i],
  ['IT Career', /\b(career|resumes?|interviews?|jobs?|salar(?:y|ies)|linkedin|certifications?|promotions?|colleagues?|workplace|agile|scrum)\b/i],
  ['Event Management', /\b(events?|weddings?|venues?|catering|guests?|ceremon(?:y|ies)|itinerar(?:y|ies)|decor|banquets?|conferences?)\b/i],
  ['Life Lessons', /\b(habits?|mindset|patience|forgiv\w*|gratitude|relationships?|discipline|kindness|happiness|character|values?|purpose|life)\b/i],
];

const groupNamed = (buckets: LearningBucket[], name: string) =>
  buckets.find((b) => b.name.trim().toLowerCase() === name.toLowerCase());

/** The learning bucket a learning belongs in, by its subject. Falls back to the default bucket (Others). */
export function filingFor(text: string, buckets: LearningBucket[]): string | null {
  for (const [name, re] of TOPIC_HINTS) {
    if (!re.test(text)) continue;
    const match = groupNamed(buckets, name);
    if (match) return match.id;
  }
  return defaultBucketId(buckets);
}

/** Returns the record for a fixed-target command, or null when the utterance is not one. */
export function routeCommand(raw: string, at: number, buckets: LearningBucket[] = []): NewEntry | null {
  const text = raw.replace(/\s+/g, ' ').trim();
  const sp = text.match(COMMANDS.spBooks)?.[1];
  const mentor = text.match(COMMANDS.mentors)?.[1];
  const workshopMatch = text.match(COMMANDS.workshopName);
  // Short phrases only: a long sentence that happens to contain "challenge" is a learning.
  const workshop =
    text.match(COMMANDS.workshops)?.[1] ??
    (workshopMatch && (!/\bchallenge\b/i.test(workshopMatch[1]) || text.split(' ').length <= 8)
      ? `${workshopMatch[1]} ${workshopMatch[2]}`
      : undefined);
  const book = text.match(COMMANDS.book)?.[1];
  const topic = text.match(COMMANDS.learnedAbout)?.[1];

  const named = (sp ?? mentor ?? workshop)?.replace(/[.!?]+$/, '');
  if (named) {
    const bucket: Bucket = sp ? 'prabhupada' : mentor ? 'mentorship' : 'workshop';
    // A spoken date ("… in March 2025") sets the timestamp and is not part of the title.
    const title = titleCase(named.replace(MONTH_DATE, '').replace(/\s+(?:in|on|from)\s*$/i, ''));
    if (!title) return null;
    return { bucket, title, timestamp: toIso(detectTimestamp(named) ?? at), source: 'voice' };
  }

  if (book) {
    const name = titleCase(book.replace(/[.!?]+$/, ''));
    if (!name) return null;
    const timestamp = toIso(at);
    // Srila Prabhupada's books go to their own bucket, under their canonical title.
    const prabhupada = PRABHUPADA_BOOKS.find(([re]) => re.test(name));
    if (prabhupada) return { bucket: 'prabhupada', title: prabhupada[1], timestamp, source: 'voice' };
    // Other books are learnings, filed under Life Lessons, with the book title as the learning.
    return { bucket: 'learning', title: name, timestamp, source: 'voice', group: groupNamed(buckets, 'Life Lessons')?.id ?? groupNamed(buckets, 'Others')?.id ?? null };
  }

  // "I can organize a Vedic wedding of up to 100 guests" is a capability: kept whole, under Event Management.
  if (COMMANDS.capability.test(text)) {
    const title = titleCase(text.replace(/[.!?]+$/, ''));
    const group = groupNamed(buckets, 'Event Management') ?? groupNamed(buckets, 'Others');
    return { bucket: 'learning', title, timestamp: toIso(at), source: 'voice', group: group?.id ?? null };
  }

  if (topic) {
    const title = titleCase(topic);
    if (!title) return null;
    const timestamp = toIso(at);
    for (const b of buckets) {
      const tail = new RegExp(`\\s+in\\s+(?:the\\s+)?${escapeRe(b.name.trim()).replace(/\s+/g, '\\s+')}(?:\\s+bucket)?$`, 'i');
      const m = topic.match(tail);
      if (m?.index) {
        const filed = titleCase(topic.slice(0, m.index));
        return filed ? { bucket: 'learning', title: filed, timestamp, source: 'voice', group: b.id } : null;
      }
    }
    return { bucket: 'learning', title, timestamp, source: 'voice', group: filingFor(title, buckets) };
  }
  return null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Spots "add it to Finance" or "… in the Finance bucket" and removes that phrase, so only the
 * takeaway is kept. A bucket name said in passing, without "add to" or "bucket", is left alone.
 */
export function findPlacement(text: string, buckets: LearningBucket[]): { text: string; group?: LearningBucket } {
  for (const b of buckets) {
    const name = escapeRe(b.name.trim()).replace(/\s+/g, '\\s+');
    const byVerb = new RegExp(`\\b(?:add|put|file|save|store|keep)\\s+(?:it\\s+|this\\s+|that\\s+)?(?:to|in|under|into)\\s+(?:the\\s+)?${name}(?:\\s+(?:bucket|box|folder|section|category))?\\b[.!,]?`, 'i');
    const byKeyword = new RegExp(`\\b(?:(?:to|in|under|into)\\s+)?(?:the\\s+)?${name}\\s+(?:bucket|box|folder|section|category)\\b[.!,]?`, 'i');
    const m = text.match(byVerb) ?? text.match(byKeyword);
    if (m) return { text: text.replace(m[0], ' ').replace(/\s{2,}/g, ' ').trim(), group: b };
  }
  return { text };
}

/** Matches a bucket name the model returned, ignoring case and extra spaces. */
const findByName = (name: unknown, buckets: LearningBucket[]) => {
  if (typeof name !== 'string' || !name.trim()) return undefined;
  const wanted = name.trim().toLowerCase();
  return buckets.find((b) => b.name.trim().toLowerCase() === wanted);
};

// ---------------------------------------------------------------------------
// Remote providers
// ---------------------------------------------------------------------------

async function callModel(input: string, buckets: LearningBucket[]): Promise<NewEntry[] | null> {
  let content = '';
  const system = systemPrompt(buckets.map((b) => b.name));
  if (aiMode === 'proxy') {
    const res = await fetch(proxyUrl!, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ system, input }),
    });
    if (!res.ok) throw new Error(`Proxy ${res.status}`);
    const data = await res.json();
    content = typeof data === 'string' ? data : (data.text ?? JSON.stringify(data));
  } else if (aiMode === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicKey!,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-5-5',
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: input }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    const data = await res.json();
    content = data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? '';
  } else if (aiMode === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: input },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    content = data.choices?.[0]?.message?.content ?? '';
  }
  return parseExtraction(content, input, buckets);
}

const BUCKET_VALUES: Bucket[] = ['learning', 'prabhupada', 'mentorship', 'workshop'];

function parseExtraction(content: string, input: string, buckets: LearningBucket[]): NewEntry[] | null {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  const obj = JSON.parse(match[0]);
  if (!BUCKET_VALUES.includes(obj.bucket)) return null;
  const now = Date.now();

  if (obj.bucket === 'learning') {
    const learnings: string[] = Array.isArray(obj.learnings) ? obj.learnings : [];
    const titles = learnings
      .filter((s): s is string => typeof s === 'string')
      .map((s) => cleanTakeaway(s))
      .filter(Boolean);
    return titles.map((takeaway): NewEntry => {
      const title = titleCase(takeaway);
      const group = findByName(obj.group, buckets)?.id ?? filingFor(title, buckets);
      return { bucket: 'learning', title, timestamp: toIso(now), source: 'voice', group };
    });
  }

  const title = typeof obj.title === 'string' ? titleCase(obj.title.trim().slice(0, 80)) : '';
  if (!title) return null;
  return [{ bucket: obj.bucket, title, timestamp: toIso(parseIsoDate(obj.date) ?? detectTimestamp(input) ?? now), source: 'voice' }];
}

const parseIsoDate = (v: unknown) => {
  const m = typeof v === 'string' ? v.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/) : null;
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, m[3] ? Number(m[3]) : 1, 12).getTime();
};

// ---------------------------------------------------------------------------
// On-device simulation
// ---------------------------------------------------------------------------

const CONTRACTIONS: Record<string, string> = {
  im: "I'm", ive: "I've", id: "I'd", ill: "I'll", dont: "don't", doesnt: "doesn't", didnt: "didn't",
  cant: "can't", wont: "won't", isnt: "isn't", arent: "aren't", wasnt: "wasn't", werent: "weren't",
  couldnt: "couldn't", shouldnt: "shouldn't", wouldnt: "wouldn't", havent: "haven't", hasnt: "hasn't",
  thats: "that's", whats: "what's", theres: "there's", lets: "let's", youre: "you're", theyre: "they're",
};

const COMMON_FIXES: [RegExp, string][] = [
  [/\bteh\b/gi, 'the'],
  [/\brecieve/gi, 'receive'],
  [/\bbeleive/gi, 'believe'],
  [/\bseperate/gi, 'separate'],
  [/\bdefinately\b/gi, 'definitely'],
  [/\buntill\b/gi, 'until'],
  [/\bwich\b/gi, 'which'],
  [/\bgonna\b/gi, 'going to'],
  [/\bwanna\b/gi, 'want to'],
  [/\bkinda\b/gi, 'kind of'],
  [/\bcould of\b/gi, 'could have'],
  [/\bshould of\b/gi, 'should have'],
  [/\bwould of\b/gi, 'would have'],
  [/\balot\b/gi, 'a lot'],
  [/\bu\b/g, 'you'],
  [/\bbhagavad[\s-]?g[ie]e?ta\b/gi, 'Bhagavad-gita'],
  [/\b(srimad|shrimad)[\s-]?bhagavatam\b/gi, 'Srimad-Bhagavatam'],
  [/\bprabhupada\b/gi, 'Prabhupada'],
  [/\bkrishna\b/gi, 'Krishna'],
  [/\bur\b/g, 'your'],
];

const FILLERS = /\b(um+|uh+|er+|hmm+|you know,?|like,(?= ))\s*/gi;

export function correctGrammar(raw: string): string {
  let t = raw.replace(/\s+/g, ' ').trim();
  t = t.replace(FILLERS, '');
  // Remove accidental repeated words: "the the" -> "the"
  t = t.replace(/\b(\w+)(\s+\1\b)+/gi, '$1');
  for (const [re, rep] of COMMON_FIXES) t = t.replace(re, rep);
  t = t.replace(/\b([a-z]+)\b/gi, (w) => {
    const fix = CONTRACTIONS[w.toLowerCase()];
    // "ill"/"id"/"lets" are real words — only fix the very common lowercase spoken forms
    if (!fix || ['ill', 'id', 'lets'].includes(w.toLowerCase())) return w;
    return w[0] === w[0].toUpperCase() && fix[0] !== 'I' ? fix[0].toUpperCase() + fix.slice(1) : fix;
  });
  t = t.replace(/\bi\b/g, 'I').replace(/\bi'(m|ve|d|ll)\b/g, "I'$1");
  // Spacing around punctuation
  t = t.replace(/\s+([,.!?;:])/g, '$1').replace(/([,.!?;:])(?=[A-Za-z])/g, '$1 ');
  // Spoken punctuation from dictation
  t = t.replace(/\s*\b(full stop|period)\b\s*/gi, '. ').replace(/\s*\bcomma\b\s*/gi, ', ');
  t = t.replace(/\s*\bnew line\b\s*/gi, '. ');
  // Capitalise sentence starts
  t = t.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, p, c: string) => p + c.toUpperCase());
  t = t.replace(/\s{2,}/g, ' ').trim();
  if (t && !/[.!?…"')]$/.test(t)) t += '.';
  return t;
}

const PRABHUPADA_BOOKS: [RegExp, string][] = [
  [/bhagavad[\s-]?g[ie]e?ta|\bgita\b/i, 'Bhagavad-gītā As It Is'],
  [/(srimad|shrimad)?[\s-]?bhagavat(am|a)\b|\bsb\s?\d/i, 'Śrīmad-Bhāgavatam'],
  [/chaitanya[\s-]?charitamrita|caitanya[\s-]?caritamrta|charitamrta/i, 'Śrī Caitanya-caritāmṛta'],
  [/nectar of devotion/i, 'The Nectar of Devotion'],
  [/nectar of instruction/i, 'The Nectar of Instruction'],
  [/[iī]s[oō]pani[sṣ]ad/i, 'Śrī Īśopaniṣad'],
  [/krishna book|kṛṣṇa book|krsna book|krishna,? the supreme personality/i, 'Kṛṣṇa, the Supreme Personality of Godhead'],
  [/teachings of lord (chaitanya|caitanya)/i, 'Teachings of Lord Caitanya'],
  [/science of self[\s-]?reali[sz]ation/i, 'The Science of Self-Realization'],
  [/perfection of yoga/i, 'The Perfection of Yoga'],
  [/beyond birth and death/i, 'Beyond Birth and Death'],
  [/easy journey to other planets/i, 'Easy Journey to Other Planets'],
  [/raja[\s-]?vidya/i, 'Rāja-vidyā: The King of Knowledge'],
  [/journey of self[\s-]?discovery/i, 'A Journey of Self-Discovery'],
  [/on the way to (krishna|kṛṣṇa|krsna)/i, 'On the Way to Kṛṣṇa'],
  [/life comes from life/i, 'Life Comes from Life'],
  [/perfect questions,? perfect answers/i, 'Perfect Questions, Perfect Answers'],
  [/elevation to (krishna|kṛṣṇa|krsna) consciousness/i, 'Elevation to Kṛṣṇa Consciousness'],
];

function detectBucket(t: string): Bucket {
  if (/prabhupada|prabhupāda/i.test(t) || PRABHUPADA_BOOKS.some(([re]) => re.test(t))) return 'prabhupada';
  if (/\b(workshop|bootcamp|seminar|masterclass|hackathon|webinar|training session|conference talk)\b/i.test(t))
    return 'workshop';
  if (/\b(mentor|mentorship|mentoring|coach(ing)?|1[:-]1|one[\s-]on[\s-]one|guru|counsel(l)?or|advisor)\b/i.test(t))
    return 'mentorship';
  return 'learning';
}

// Each "I learned …" / "learned that …" marks the start of a takeaway.
const LEARNING_MARKER = /(?:\b(?:today\s+)?i\s+(?:have\s+|just\s+|also\s+)?)?\b(?:learned|learnt|realized|realised|discovered|understood)\b(?:\s+(?:that|how))?/gi;
const BOILERPLATE_ONLY = /^(today|so|and|also|then|yeah|well|okay|ok)$/i;
const SINGLE_WORD_FILLER = /^(it|this|that|them|these|those|there|here|something|stuff|things?|more|some|one|yes|no|nothing)$/i;

/** Pulls each distinct takeaway out of a learning note, dropping the spoken framing around it. */
export function splitLearnings(text: string): string[] {
  const marks = [...text.matchAll(LEARNING_MARKER)];
  const segments = marks.map((m, i) => text.slice((m.index ?? 0) + m[0].length, marks[i + 1]?.index ?? text.length));
  // Content said before the first marker ("Compound interest works on habits. I learned…") is its own takeaway.
  if (marks.length && (marks[0].index ?? 0) > 0) segments.unshift(text.slice(0, marks[0].index));
  if (!marks.length) segments.push(text);
  return [...new Set(segments.map(cleanTakeaway).filter((s): s is string => !!s))];
}

/** Strips leftover framing words from a takeaway and returns '' when nothing substantive remains. */
function cleanTakeaway(raw: string): string {
  const t = raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,;:\-–—]+\s*/, '')
    .replace(/^(today|and|also|so|that|then|to|how)\b[\s,]*/i, '')
    .replace(/[\s,;:]+(and|also|so|then)$/i, '')
    .replace(/[\s,;:]+$/, '');
  // A single word is a valid takeaway when it names something ("Java", "Metal detectors"); filler words are not.
  const bare = t.replace(/[.!?]$/, '');
  if (!t || BOILERPLATE_ONLY.test(bare) || (t.split(' ').length < 2 && (bare.length < 2 || SINGLE_WORD_FILLER.test(bare)))) return '';
  const sentence = t[0].toUpperCase() + t.slice(1);
  return (/[.!?…"')]$/.test(sentence) ? sentence : sentence + '.').slice(0, 280);
}

function detectTitle(t: string, bucket: Bucket): string {
  if (bucket === 'prabhupada') {
    const book = PRABHUPADA_BOOKS.find(([re]) => re.test(t));
    const chapter = t.match(/\b(chapter|canto|verse|text)\s+(\d+[\d.]*)/i);
    if (book) return chapter ? `${book[1]} · ${cap(chapter[1])} ${chapter[2]}` : book[1];
    return 'Srila Prabhupada reading';
  }
  const named =
    t.match(/["“]([^"”]{3,60})["”]/)?.[1] ??
    t.match(/\b(?:workshop|session|seminar|masterclass|bootcamp|webinar)\s+(?:on|about|called|titled)\s+([^.,;!?]{3,50})/i)?.[1] ??
    t.match(/\b(?:with|from)\s+((?:[A-Z][\w.-]*\s?){1,3})/)?.[1];
  if (named) {
    const prefix = bucket === 'workshop' && !/workshop/i.test(named) ? 'Workshop: ' : bucket === 'mentorship' && /^[A-Z]/.test(named) && !/session/i.test(named) ? 'Session with ' : '';
    return (prefix + named.trim()).slice(0, 60);
  }
  return bucket === 'workshop' ? 'Workshop' : 'Mentor session';
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_DATE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:(\d{1,2})(?:st|nd|rd|th)?,?\s+)?(\d{4})\b/i;

/**
 * Finds a spoken "March 2025" or "March 14, 2025" and returns it as local noon on that date.
 * A month without a day resolves to the 1st.
 */
export function detectTimestamp(t: string): number | undefined {
  const m = t.match(MONTH_DATE);
  if (!m) return undefined;
  return new Date(Number(m[3]), MONTHS.indexOf(m[1].toLowerCase()), m[2] ? Number(m[2]) : 1, 12).getTime();
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
