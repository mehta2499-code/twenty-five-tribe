/**
 * Game sounds and music, made on the fly with Web Audio (no sound files).
 * One switch for all of it ("tf.sound"), on by default. Browsers only allow
 * sound after a tap, so the audio starts on the first touch.
 */
import { useEffect, useSyncExternalStore } from "react";

const KEY = "tf.sound";
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const subs = new Set<() => void>();

function readOn() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}
let on = typeof window !== "undefined" ? readOn() : true;

export function soundOn() {
  return on;
}
export function setSound(next: boolean) {
  on = next;
  try {
    localStorage.setItem(KEY, next ? "on" : "off");
  } catch {
    // ignore
  }
  if (!next) stopMusic();
  else if (wantMusic) startMusic();
  subs.forEach((f) => f());
}
export function useSound() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => on,
    () => true,
  );
}

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  return ctx;
}

// Unlock on the first touch (iPhone needs a tap before any sound).
if (typeof window !== "undefined") {
  const unlock = () => {
    const c = audio();
    if (c) {
      // A silent blip wakes iOS audio up.
      const b = c.createBuffer(1, 1, 22050);
      const s = c.createBufferSource();
      s.buffer = b;
      s.connect(c.destination);
      s.start(0);
    }
    if (wantMusic && on) startMusic();
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") stopMusic();
    else if (wantMusic && on) startMusic();
  });
}

/** One note with a quick attack and a soft tail. */
function tone(
  freq: number,
  dur: number,
  {
    type = "sine",
    gain = 0.2,
    at = 0,
    slide,
    out,
  }: {
    type?: OscillatorType;
    gain?: number;
    at?: number;
    slide?: number;
    out?: AudioNode;
  } = {},
) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out ?? master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** A short burst of filtered noise (dice clatter, swooshes). */
function noise(dur: number, { at = 0, gain = 0.25, freq = 2400, q = 1.5 } = {}) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + at;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

const play = (fn: () => void) => {
  if (!on) return;
  try {
    fn();
  } catch {
    // Sound is a nice-to-have.
  }
};

export const sfx = {
  /** Dice shaken and thrown: a clatter, then it lands. */
  dice(ms = 600) {
    play(() => {
      const hits = Math.round(ms / 55);
      for (let i = 0; i < hits; i++) {
        const at = (i / hits) * (ms / 1000) + Math.random() * 0.02;
        noise(0.045, {
          at,
          gain: 0.18 + Math.random() * 0.1,
          freq: 1800 + Math.random() * 2600,
          q: 4,
        });
        tone(300 + Math.random() * 500, 0.04, { type: "triangle", gain: 0.05, at });
      }
      const end = ms / 1000;
      noise(0.09, { at: end, gain: 0.35, freq: 900, q: 2 });
      tone(160, 0.12, { type: "sine", gain: 0.2, at: end, slide: 90 });
    });
  },
  /** One hop of the table spotlight (pitch climbs as it slows). */
  tick(step = 0) {
    play(() => tone(520 + (step % 12) * 28, 0.05, { type: "square", gain: 0.035 }));
  },
  /** Spotlight lands on someone. */
  land() {
    play(() => {
      tone(660, 0.12, { type: "triangle", gain: 0.16 });
      tone(990, 0.22, { type: "triangle", gain: 0.14, at: 0.08 });
      tone(1320, 0.35, { type: "sine", gain: 0.1, at: 0.16 });
    });
  },
  /** Tap Rush and other quick taps: a bright pop that climbs with the combo. */
  pop(combo = 0) {
    play(() => {
      const f = 520 * Math.pow(2, (combo % 12) / 12);
      tone(f, 0.09, { type: "triangle", gain: 0.22, slide: f * 1.5 });
      noise(0.03, { gain: 0.08, freq: 5000, q: 1 });
    });
  },
  /** A pawn steps one square. */
  step(i = 0) {
    play(() => tone(700 + (i % 6) * 40, 0.05, { type: "sine", gain: 0.12 }));
  },
  /** Someone got sent home. */
  capture() {
    play(() => {
      tone(880, 0.35, { type: "sawtooth", gain: 0.08, slide: 110 });
      noise(0.3, { gain: 0.15, freq: 700, q: 0.8 });
    });
  },
  /** Right answer / good move. */
  good() {
    play(() => {
      tone(784, 0.1, { type: "triangle", gain: 0.16 });
      tone(1175, 0.18, { type: "triangle", gain: 0.14, at: 0.07 });
    });
  },
  /** Wrong answer / miss. */
  bad() {
    play(() => tone(220, 0.25, { type: "square", gain: 0.06, slide: 140 }));
  },
  /** You won: a little fanfare. */
  win() {
    play(() => {
      [523, 659, 784, 1047].forEach((f, i) =>
        tone(f, 0.22, { type: "triangle", gain: 0.16, at: i * 0.11 }),
      );
      tone(1568, 0.6, { type: "sine", gain: 0.1, at: 0.44 });
    });
  },
};

// ---------- Background music: a light, bouncy loop for games ----------
let wantMusic = 0;
let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicBus: GainNode | null = null;
let nextAt = 0;
let stepNo = 0;
const BPM = 112;
const STEP = 60 / BPM / 2; // eighth notes
// I–V–vi–IV in C, as roots (Hz), with a bright arpeggio over each.
const CHORDS = [
  [130.81, [523.25, 659.25, 783.99]],
  [196.0, [493.88, 587.33, 783.99]],
  [220.0, [523.25, 659.25, 880.0]],
  [174.61, [523.25, 698.46, 880.0]],
] as const;

function startMusic() {
  const c = audio();
  if (!c || !master || musicTimer || !on) return;
  musicBus = c.createGain();
  musicBus.gain.value = 0.0001;
  musicBus.gain.exponentialRampToValueAtTime(0.5, c.currentTime + 1.2);
  musicBus.connect(master);
  nextAt = c.currentTime + 0.1;
  stepNo = 0;
  const schedule = () => {
    if (!ctx || !musicBus) return;
    while (nextAt < ctx.currentTime + 0.25) {
      const bar = Math.floor(stepNo / 8) % CHORDS.length;
      const [root, arp] = CHORDS[bar];
      const s = stepNo % 8;
      const at = nextAt - ctx.currentTime;
      // Bass on the beat, a soft kick on 1 and 5, arpeggio on every eighth.
      if (s % 2 === 0) tone(root, STEP * 1.6, { type: "triangle", gain: 0.12, at, out: musicBus });
      if (s === 0 || s === 4)
        tone(110, 0.12, { type: "sine", gain: 0.18, at, slide: 45, out: musicBus });
      if (s === 2 || s === 6) noiseTo(musicBus, at);
      tone(arp[s % 3] * (s >= 4 ? 2 : 1), STEP * 0.9, {
        type: "square",
        gain: 0.022,
        at,
        out: musicBus,
      });
      nextAt += STEP;
      stepNo++;
    }
  };
  schedule();
  musicTimer = setInterval(schedule, 60);
}

/** A soft hi-hat into the music bus. */
function noiseTo(bus: GainNode, at: number) {
  const c = ctx;
  if (!c) return;
  const t = c.currentTime + at;
  const len = Math.floor(c.sampleRate * 0.04);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 7000;
  const g = c.createGain();
  g.gain.value = 0.05;
  src.connect(f).connect(g).connect(bus);
  src.start(t);
}

function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  if (musicBus && ctx) {
    const b = musicBus;
    b.gain.cancelScheduledValues(ctx.currentTime);
    b.gain.setValueAtTime(Math.max(b.gain.value, 0.0001), ctx.currentTime);
    b.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    setTimeout(() => b.disconnect(), 500);
  }
  musicBus = null;
}

/** Background music while a game screen is open (respects the sound switch). */
export function useGameMusic(active = true) {
  useEffect(() => {
    if (!active) return;
    wantMusic++;
    startMusic();
    return () => {
      wantMusic = Math.max(0, wantMusic - 1);
      if (!wantMusic) stopMusic();
    };
  }, [active]);
}
