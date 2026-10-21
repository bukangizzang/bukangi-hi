// Synthesised chiptune SFX + BGM (Web Audio, no audio files) and haptics.

export type Sfx = "shutter" | "hit" | "bigHit" | "miss" | "whistle" | "splash" | "siren" | "dex" | "lowBattery" | "tick" | "end" | "gull";

export interface AudioSettings {
  sfx: boolean;
  bgm: boolean;
  haptics: boolean;
}

const KEY = "bukangi-audio-v1";

export function loadAudioSettings(): AudioSettings {
  try {
    const p = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Partial<AudioSettings>;
    return { sfx: p.sfx !== false, bgm: p.bgm !== false, haptics: p.haptics !== false };
  } catch {
    return { sfx: true, bgm: true, haptics: true };
  }
}

export function saveAudioSettings(s: AudioSettings) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* settings last for this session */
  }
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

/** Call from a user gesture (e.g. the start button) so browsers allow sound. */
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.22;
      musicBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, vol: number, dest?: AudioNode, slideTo?: number) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(dest ?? master);
  o.start(start);
  o.stop(start + dur + 0.02);
}

function noise(start: number, dur: number, vol: number, filterFreq: number, type: BiquadFilterType = "highpass") {
  if (!ctx || !master || !noiseBuf) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(master);
  src.start(start);
  src.stop(start + dur + 0.02);
}

export function playSfx(s: Sfx) {
  if (!ctx) return;
  const t = ctx.currentTime;
  switch (s) {
    case "shutter":
      noise(t, 0.05, 0.5, 3000);
      noise(t + 0.07, 0.04, 0.35, 2500);
      break;
    case "hit":
      tone(988, t, 0.09, "square", 0.12);
      tone(1319, t + 0.07, 0.14, "square", 0.12);
      break;
    case "bigHit":
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.06, 0.16, "square", 0.12));
      break;
    case "miss":
      tone(220, t, 0.18, "triangle", 0.2, undefined, 150);
      break;
    case "whistle":
      for (let i = 0; i < 6; i++) tone(2800, t + i * 0.09, 0.08, "square", 0.06);
      break;
    case "splash":
      noise(t, 0.45, 0.4, 900, "lowpass");
      break;
    case "siren":
      for (let i = 0; i < 4; i++) tone(i % 2 ? 660 : 880, t + i * 0.25, 0.24, "sawtooth", 0.05);
      break;
    case "dex":
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.07, 0.2, "triangle", 0.18));
      break;
    case "lowBattery":
      tone(440, t, 0.1, "square", 0.08);
      tone(330, t + 0.14, 0.14, "square", 0.08);
      break;
    case "gull":
      for (let i = 0; i < 3; i++) tone(1500, t + i * 0.16, 0.13, "sawtooth", 0.07, undefined, 850);
      break;
    case "tick":
      tone(1200, t, 0.05, "square", 0.07);
      break;
    case "end":
      [784, 659, 523, 392].forEach((f, i) => tone(f, t + i * 0.12, 0.22, "square", 0.1));
      break;
  }
}

// ---------- BGM: a looping 8-bar seaside chiptune, scheduled ahead ----------
const BPM = 132;
const STEP = 60 / BPM / 2; // eighth notes
// prettier-ignore
const MELODY = [76, 0, 79, 81, 79, 0, 76, 74, 72, 0, 74, 76, 0, 0, 72, 0, 74, 0, 76, 79, 81, 0, 84, 81, 79, 0, 76, 74, 76, 0, 0, 0,
                76, 0, 79, 81, 79, 0, 76, 74, 72, 0, 74, 76, 0, 72, 69, 0, 71, 0, 72, 74, 76, 0, 74, 72, 71, 0, 67, 0, 72, 0, 0, 0];
// prettier-ignore
const BASS = [48, 48, 55, 55, 45, 45, 52, 52, 41, 41, 48, 48, 43, 43, 50, 50];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

let bgmTimer = 0;
let nextTime = 0;
let stepIdx = 0;

export function startBgm() {
  if (!ctx || !musicBus || bgmTimer) return;
  nextTime = ctx.currentTime + 0.1;
  stepIdx = 0;
  const schedule = () => {
    if (!ctx || !musicBus) return;
    while (nextTime < ctx.currentTime + 0.25) {
      const m = MELODY[stepIdx % MELODY.length];
      if (m) tone(midi(m), nextTime, STEP * 0.9, "square", 0.25, musicBus);
      if (stepIdx % 2 === 0) {
        const b = BASS[Math.floor(stepIdx / 4) % BASS.length];
        tone(midi(b), nextTime, STEP * 1.6, "triangle", 0.45, musicBus);
      }
      if (stepIdx % 4 === 2) noiseHat(nextTime);
      nextTime += STEP;
      stepIdx++;
    }
  };
  schedule();
  bgmTimer = window.setInterval(schedule, 80);
}

function noiseHat(t: number) {
  if (!ctx || !musicBus || !noiseBuf) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  src.connect(f).connect(g).connect(musicBus);
  src.start(t);
  src.stop(t + 0.06);
}

export function stopBgm() {
  if (bgmTimer) window.clearInterval(bgmTimer);
  bgmTimer = 0;
}

export function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* haptics unsupported */
  }
}
