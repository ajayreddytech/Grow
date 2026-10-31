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

export interface VoiceResult {
  transcript: string;
}

/** Captures speech with the Web Speech API. Only the transcript is kept — no audio is recorded. */
export function useVoiceCapture(onDone: (r: VoiceResult) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef('');
  const stopTimer = useRef<number>();
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const activeRef = useRef(false);

  const finish = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    window.clearTimeout(stopTimer.current);
    setListening(false);
    const transcript = finalRef.current.trim();
    setInterim('');
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
    finalRef.current = '';
    setInterim('');
    const rec = new Ctor();
    rec.lang = navigator.language || 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += ' ' + r[0].transcript;
        else live += r[0].transcript;
      }
      setInterim((finalRef.current + ' ' + live).trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed')
        setError('Microphone permission was blocked. Allow it in the address bar and try again.');
      else if (e.error === 'network') setError('Speech recognition needs a network connection.');
      else if (e.error !== 'no-speech' && e.error !== 'aborted') setError(`Voice error: ${e.error}`);
    };
    rec.onend = finish;
    recRef.current = rec;
    activeRef.current = true;
    try {
      rec.start();
    } catch {
      activeRef.current = false;
      return;
    }
    setListening(true);
    stopTimer.current = window.setTimeout(() => recRef.current?.stop(), MAX_CAPTURE_MS);
  }, [finish]);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  useEffect(
    () => () => {
      activeRef.current = false;
      recRef.current?.abort();
    },
    [],
  );

  return { listening, interim, error, start, stop, clearError: () => setError(null), supported: speechSupported };
}
