import { useCallback, useEffect, useRef, useState } from 'react';

/* Minimal typings for the (still prefixed) Web Speech API. */
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

const getRecognition = (): RecognitionCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export const speechSupported = typeof window !== 'undefined' && !!getRecognition();

const MAX_CAPTURE_MS = 90_000;

/** Joins text pieces with single spaces, skipping empty ones. */
const joinText = (...parts: string[]) =>
  parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ');

const words = (s: string) => s.split(/\s+/).filter(Boolean);
const wordKey = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

/** How far back into the transcript a restarted session's words are looked for. */
const LOOKBACK_WORDS = 200;

/**
 * Appends `next` to `base` without repeating words already there. A restarted recognition session re-sends
 * words the transcript already has, and they can sit anywhere in its recent end, not just at the very end:
 *  1. if `next` is already inside the recent part of `base`, nothing is added;
 *  2. otherwise, if the start of `next` matches the end of `base`, only the words after that overlap are added.
 */
const appendTranscript = (base: string, next: string) => {
  const b = words(base);
  const n = words(next);
  if (!n.length) return joinText(base);
  if (!b.length) return joinText(next);
  const from = Math.max(0, b.length - LOOKBACK_WORDS);

  // 1. Whole new text already present (only for phrases of 3+ words, so a short "yes" is never dropped).
  if (n.length >= 3) {
    for (let s = from; s + n.length <= b.length; s++) {
      if (n.every((w, i) => wordKey(b[s + i]) === wordKey(w))) return joinText(base);
    }
  }

  // 2. Longest overlap: the earliest start in the lookback whose tail of `base` opens `next`.
  for (let s = from; s < b.length; s++) {
    const tail = b.length - s;
    if (tail > n.length) continue;
    let same = true;
    for (let i = 0; i < tail && same; i++) same = wordKey(b[s + i]) === wordKey(n[i]);
    if (same) return joinText(base, n.slice(tail).join(' '));
  }
  return joinText(base, next);
};

export interface VoiceResult {
  transcript: string;
}

/**
 * Captures speech with the Web Speech API. Only the transcript is kept — no audio is recorded.
 *
 * Mobile browsers (Android Chrome, iOS Safari home-screen apps) end a recognition session on their own
 * after a pause and re-send results, so this hook keeps the whole transcript itself: each event rebuilds
 * the current session from every result, and a session that ends early is restarted until the user stops.
 */
export function useVoiceCapture(onDone: (r: VoiceResult) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const stopTimer = useRef<number>();
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  /** True from start until the transcript has been handed over (or dropped). */
  const activeRef = useRef(false);
  /** False once the user taps stop or the time limit is reached. */
  const wantRef = useRef(false);
  /** Final text from sessions the browser has already ended. */
  const committedRef = useRef('');

  const finish = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    window.clearTimeout(stopTimer.current);
    setListening(false);
    const transcript = committedRef.current.trim();
    setInterim('');
    committedRef.current = '';
    if (transcript) onDoneRef.current({ transcript });
    else setError((e) => e ?? 'I didn’t catch that — try again a little closer to the mic.');
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognition();
    if (!Ctor) {
      setError('Voice input isn’t supported in this browser. Try Chrome or Edge.');
      return;
    }
    setError(null);
    committedRef.current = '';
    setInterim('');
    activeRef.current = true;
    wantRef.current = true;

    let fatal = false;
    /** Text of the current browser session. Rebuilt from all of its results on every event. */
    let sessionFinal = '';
    let sessionLive = '';

    const launch = () => {
      const rec = new Ctor();
      rec.lang = navigator.language || 'en-US';
      rec.continuous = true;
      rec.interimResults = true;
      sessionFinal = '';
      sessionLive = '';

      rec.onresult = (e) => {
        // Rebuild from index 0: mobile browsers re-send results, so adding only the new indices repeats words.
        let final = '';
        let live = '';
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) final = joinText(final, r[0].transcript);
          else live = joinText(live, r[0].transcript);
        }
        sessionFinal = final;
        sessionLive = live;
        setInterim(appendTranscript(committedRef.current, joinText(sessionFinal, sessionLive)));
      };
      rec.onerror = (e) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        fatal = true;
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed')
          setError('Microphone permission was blocked. Allow it in the address bar and try again.');
        else if (e.error === 'network') setError('Speech recognition needs a network connection.');
        else setError(`Voice error: ${e.error}`);
      };
      rec.onend = () => {
        // Only final text is kept: unfinished live text is re-recognised by the next session, so keeping it repeats it.
        committedRef.current = appendTranscript(committedRef.current, sessionFinal);
        // The browser ended the session on its own (a pause, or a mobile timeout): keep listening.
        if (wantRef.current && !fatal && activeRef.current) {
          try {
            launch();
            return;
          } catch {
            /* fall through and finish */
          }
        }
        finish();
      };
      recRef.current = rec;
      rec.start();
    };

    try {
      launch();
    } catch {
      activeRef.current = false;
      return;
    }
    setListening(true);
    stopTimer.current = window.setTimeout(() => {
      wantRef.current = false;
      recRef.current?.stop();
    }, MAX_CAPTURE_MS);
  }, [finish]);

  const stop = useCallback(() => {
    wantRef.current = false;
    recRef.current?.stop();
  }, []);

  useEffect(
    () => () => {
      activeRef.current = false;
      wantRef.current = false;
      recRef.current?.abort();
    },
    [],
  );

  return { listening, interim, error, start, stop, clearError: () => setError(null), supported: speechSupported };
}
