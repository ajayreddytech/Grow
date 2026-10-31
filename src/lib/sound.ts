/**
 * Short chest sounds synthesised with the Web Audio API, so no audio file is shipped.
 * Opening rises into a bright chime; closing drops into a soft thud. Fails silently when audio
 * is unavailable.
 */
let ctx: AudioContext | null = null;

const getContext = (): AudioContext | null => {
  if (ctx) return ctx;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
};

function tone(c: AudioContext, from: number, to: number, type: OscillatorType, start: number, dur: number, peak: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + dur);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

export function playChestSound(opening: boolean) {
  try {
    const c = getContext();
    if (!c) return;
    if (c.state === 'suspended') void c.resume();
    const t = c.currentTime;
    if (opening) {
      tone(c, 520, 980, 'triangle', t, 0.22, 0.09);
      tone(c, 1320, 1760, 'sine', t + 0.09, 0.32, 0.05);
    } else {
      tone(c, 260, 120, 'triangle', t, 0.2, 0.1);
      tone(c, 740, 520, 'sine', t + 0.04, 0.18, 0.03);
    }
  } catch {
    /* audio is optional */
  }
}
