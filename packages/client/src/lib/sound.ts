// Lightweight, dependency-free sound engine using the Web Audio API.
// All sounds are synthesized on the fly -- no audio files to host or license.

const STORAGE_KEY = 'colorwin-sound-muted';

let ctx: AudioContext | null = null;
let unlocked = false;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtor) return null;
    ctx = new AudioCtor();
  }
  return ctx;
}

export function isMuted(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function setMuted(muted: boolean) {
  localStorage.setItem(STORAGE_KEY, String(muted));
}

/** Call this on the first user gesture (click/tap) -- browsers block audio until then. */
export function unlockAudio() {
  if (unlocked) return;
  const c = getAudioContext();
  if (!c) return;
  if (c.state === 'suspended') {
    c.resume().catch(() => {});
  }
  unlocked = true;
}

function envelope(gainNode: GainNode, ctx: AudioContext, attack: number, decay: number, peak: number) {
  const now = ctx.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(peak, now + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);
}

function playTone(freq: number, duration: number, type: OscillatorType, peak: number) {
  if (isMuted()) return;
  const c = getAudioContext();
  if (!c) return;

  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(c.destination);

  envelope(gain, c, 0.005, duration, peak);

  osc.start();
  osc.stop(c.currentTime + duration + 0.05);
}

function createNoiseBuffer(c: AudioContext, duration: number): AudioBuffer {
  const bufferSize = c.sampleRate * duration;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // decaying white noise
  }
  return buffer;
}

/** Tight, understated tick -- used repeatedly while the reel is spinning/shuffling. */
export function playReelTick() {
  if (isMuted()) return;
  const c = getAudioContext();
  if (!c) return;

  const now = c.currentTime;
  const buffer = createNoiseBuffer(c, 0.02);
  const source = c.createBufferSource();
  source.buffer = buffer;

  // Bandpass rather than lowpass -- gives a crisp, dry "tick" instead of a
  // dull thump or a bright digital blip.
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2600 + Math.random() * 400;
  filter.Q.value = 4;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.09, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);

  source.start(now);
}

/** Mechanical thud + brief whir -- played when the lever gets pulled. */
export function playLeverClunk() {
  if (isMuted()) return;
  const c = getAudioContext();
  if (!c) return;

  const now = c.currentTime;

  // Low, solid thud -- the lever hitting the bottom of its travel.
  const thud = c.createOscillator();
  const thudGain = c.createGain();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(120, now);
  thud.frequency.exponentialRampToValueAtTime(55, now + 0.12);
  thud.connect(thudGain);
  thudGain.connect(c.destination);

  thudGain.gain.setValueAtTime(0, now);
  thudGain.gain.linearRampToValueAtTime(0.28, now + 0.008);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  thud.start(now);
  thud.stop(now + 0.24);

  // Short mechanical whir right after -- the spring/ratchet settling.
  const whirBuffer = createNoiseBuffer(c, 0.14);
  const whir = c.createBufferSource();
  whir.buffer = whirBuffer;

  const whirFilter = c.createBiquadFilter();
  whirFilter.type = 'bandpass';
  whirFilter.frequency.value = 1100;
  whirFilter.Q.value = 1.2;

  const whirGain = c.createGain();
  const whirStart = now + 0.04;
  whirGain.gain.setValueAtTime(0, whirStart);
  whirGain.gain.linearRampToValueAtTime(0.07, whirStart + 0.02);
  whirGain.gain.exponentialRampToValueAtTime(0.001, whirStart + 0.16);

  whir.connect(whirFilter);
  whirFilter.connect(whirGain);
  whirGain.connect(c.destination);

  whir.start(whirStart);
}

/** Soft click for chip/color selection buttons. */
export function playClick() {
  playTone(700, 0.05, 'triangle', 0.08);
}

/** Cheerful ascending arpeggio for a win. */
export function playWinChime() {
  if (isMuted()) return;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.35, 'sine', 0.18), i * 90);
  });
}

/** Soft descending tone for a lost bet (subtle, not punishing). */
export function playLoseTone() {
  playTone(300, 0.25, 'sine', 0.08);
}