// Original, fully-synthesized ambient background loop for the Game page.
// A slow, cozy four-chord progression (Am7 - Fmaj7 - Cmaj7 - G) with a soft
// bass note under each chord and occasional sparkle notes for texture.
// Nothing here is sampled or copied from any existing track -- generated
// live via the Web Audio API, same engine as sound.ts.

import { getAudioContext, isMuted } from './sound';

const CHORD_DURATION = 3.6; // seconds per chord
const TARGET_VOLUME = 0.1;

const CHORDS: { bass: number; notes: number[] }[] = [
  { bass: 110, notes: [220, 261.63, 329.63, 392] }, // Am7
  { bass: 87.31, notes: [174.61, 220, 261.63, 329.63] }, // Fmaj7
  { bass: 130.81, notes: [261.63, 329.63, 392, 493.88] }, // Cmaj7
  { bass: 98, notes: [196, 246.94, 293.66, 392] }, // G
];

let masterGain: GainNode | null = null;
let playing = false;
let stepIndex = 0;
let timeoutId: ReturnType<typeof setTimeout> | null = null;

function ensureMasterGain(): GainNode | null {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (!masterGain) {
    masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(ctx.destination);
  }
  return masterGain;
}

function playPad(freq: number, duration: number, volume: number) {
  const ctx = getAudioContext();
  const gain = ensureMasterGain();
  if (!ctx || !gain) return;

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1400;

  const noteGain = ctx.createGain();
  const now = ctx.currentTime;
  noteGain.gain.setValueAtTime(0, now);
  noteGain.gain.linearRampToValueAtTime(volume, now + 0.8);
  noteGain.gain.setValueAtTime(volume, now + duration - 1.0);
  noteGain.gain.linearRampToValueAtTime(0, now + duration);

  osc.connect(filter);
  filter.connect(noteGain);
  noteGain.connect(gain);

  osc.start(now);
  osc.stop(now + duration + 0.1);
}

function playBass(freq: number, duration: number) {
  const ctx = getAudioContext();
  const gain = ensureMasterGain();
  if (!ctx || !gain) return;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;

  const noteGain = ctx.createGain();
  const now = ctx.currentTime;
  noteGain.gain.setValueAtTime(0, now);
  noteGain.gain.linearRampToValueAtTime(0.35, now + 0.5);
  noteGain.gain.setValueAtTime(0.35, now + duration - 0.6);
  noteGain.gain.linearRampToValueAtTime(0, now + duration);

  osc.connect(noteGain);
  noteGain.connect(gain);

  osc.start(now);
  osc.stop(now + duration + 0.1);
}

function playSparkle(freq: number, delay: number) {
  const ctx = getAudioContext();
  const gain = ensureMasterGain();
  if (!ctx || !gain) return;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;

  const noteGain = ctx.createGain();
  const now = ctx.currentTime + delay;
  noteGain.gain.setValueAtTime(0, now);
  noteGain.gain.linearRampToValueAtTime(0.06, now + 0.05);
  noteGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

  osc.connect(noteGain);
  noteGain.connect(gain);

  osc.start(now);
  osc.stop(now + 1.3);
}

function scheduleChord() {
  if (!playing) return;
  const chord = CHORDS[stepIndex % CHORDS.length];

  playBass(chord.bass, CHORD_DURATION);
  chord.notes.forEach((f) => playPad(f, CHORD_DURATION, 0.05));

  // Sparse sparkle notes for a bit of movement -- not every chord.
  if (Math.random() > 0.4) {
    const note = chord.notes[Math.floor(Math.random() * chord.notes.length)] * 2;
    playSparkle(note, CHORD_DURATION * (0.3 + Math.random() * 0.4));
  }

  stepIndex++;
  timeoutId = setTimeout(scheduleChord, (CHORD_DURATION - 0.3) * 1000);
}

/** Start the loop. Safe to call multiple times -- no-ops if already playing. */
export function startBgm() {
  if (playing) return;
  const gain = ensureMasterGain();
  const ctx = getAudioContext();
  if (!gain || !ctx) return;

  playing = true;
  gain.gain.cancelScheduledValues(ctx.currentTime);
  gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(isMuted() ? 0 : TARGET_VOLUME, ctx.currentTime + 1.5);

  scheduleChord();
}

/** Stop the loop with a short fade-out. */
export function stopBgm() {
  playing = false;
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  const ctx = getAudioContext();
  if (ctx && masterGain) {
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
  }
}

/** Call after toggling mute so the currently-playing loop reflects it immediately. */
export function updateBgmMuteState() {
  if (!playing) return;
  const ctx = getAudioContext();
  if (!ctx || !masterGain) return;
  masterGain.gain.cancelScheduledValues(ctx.currentTime);
  masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(isMuted() ? 0 : TARGET_VOLUME, ctx.currentTime + 0.4);
}