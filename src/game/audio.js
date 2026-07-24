/**
 * Konami shooter — procedural audio.
 *
 * All sound is generated at runtime: ZzFX sound effects and one upbeat looping
 * ZzFXM chiptune track, both bundled with `littlejsengine` (no audio assets).
 *
 * Public API (also available as the default export object `audio`):
 *   play(name)     — play a one-shot sound effect by name (no-op when muted)
 *   startMusic()   — start the looping chiptune (idempotent while playing)
 *   stopMusic()    — stop the chiptune (used on exit)
 *   toggleMute()   — flip mute; returns the new muted state
 *   setMuted(bool) — set mute explicitly; returns the new muted state
 *   muted          — current mute state (getter on the object; live binding
 *                    via the named export)
 *
 * Sound-effect names (from the spec's effect list):
 *   'shoot'      — player auto-fire
 *   'enemyHit'   — a shot connects with an enemy (non-fatal / on any hit)
 *   'explosion'  — an enemy (or the boss) is destroyed
 *   'powerUp'    — double-shot power-up collected
 *   'playerDeath'— the player loses a life
 *   'bossPhase'  — the boss escalates to its next phase
 *
 * Mute is session-remembered: this module stays loaded for the page session,
 * so the `muted` flag persists across game open/close. Muting sets the engine
 * master volume to 0 (leaving a running music loop silently looping so unmute
 * is instant) and also gates new effect playback.
 */
import { Sound, ZzFXMusic, setSoundVolume } from './engine.js';

// Engine master volume used while the game is unmuted.
const BASE_VOLUME = 0.4;
// Volume the music loop is played at (on top of the master volume).
const MUSIC_VOLUME = 0.55;

// Session-remembered mute flag (live binding — importers see updates).
export let muted = false;

// ---------------------------------------------------------------------------
// Sound-effect definitions (ZzFX parameter arrays).
// Params: volume, randomness, frequency, attack, sustain, release, shape,
//         shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime,
//         noise, modulation, bitCrush, delay, sustainVolume, decay, ...
// ---------------------------------------------------------------------------
const SFX = {
  // short, bright laser blip with a downward slide
  shoot: [1.1, 0.05, 900, 0, 0.02, 0.08, 1, 2, -8, 0, 0, 0, 0, 0, 0, 0, 0.02],
  // crisp tick when a shot lands
  enemyHit: [1.4, 0.1, 420, 0, 0.01, 0.06, 0, 0, 0, 0, 0, 0, 0, 0.4, 0, 0, 0, 0.7],
  // noisy percussive burst for a kill
  explosion: [1.6, 0.2, 160, 0, 0.05, 0.28, 4, 1, 0, 0, 0, 0, 0, 1.4, 0, 0, 0, 0.6, 0.1],
  // rising happy arpeggio pickup
  powerUp: [1.3, 0, 520, 0.01, 0.08, 0.14, 0, 0, 12, 0, 22, 0.05, 0, 0, 0, 0, 0, 1, 0.1],
  // descending player-hit whomp
  playerDeath: [1.7, 0.1, 300, 0, 0.1, 0.4, 2, 1, -6, -0.4, 0, 0, 0, 0.3, 0, 0, 0, 0.8, 0.2],
  // heavy warning stab for a boss phase change
  bossPhase: [1.8, 0.05, 110, 0.02, 0.2, 0.35, 2, 0.6, 0, 0, 0, 0, 0, 0, 3, 0, 0, 1, 0.1],
};

// ---------------------------------------------------------------------------
// Chiptune music track (ZzFXM: [instruments, patterns, sequence, BPM]).
// Note values are semitone offsets; each instrument's frequency is scaled by
// 2**(note/12 - 1), so note 12 plays the instrument's base frequency.
// ---------------------------------------------------------------------------
const MUSIC = [
  // instruments
  [
    // 0: square lead (base ~220Hz)
    [1.3, 0, 220, 0.01, 0.08, 0.16, 1, 1.5, 0, 0, 0, 0, 0, 0.05],
    // 1: saw bass (base ~110Hz, an octave below the lead)
    [1.6, 0, 110, 0.01, 0.12, 0.12, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0.05],
  ],
  // patterns
  [
    // pattern 0
    [
      // channel 0 — lead (upbeat arpeggio)
      [0, 0,
        12, 19, 24, 19, 15, 22, 27, 22,
        12, 19, 24, 19, 17, 24, 29, 24],
      // channel 1 — bass (driving eighths)
      [1, 0,
        12, 12, 12, 12, 8, 8, 8, 8,
        5, 5, 5, 5, 7, 7, 7, 7],
    ],
    // pattern 1 (variation, lifts up a step)
    [
      // channel 0 — lead
      [0, 0,
        17, 24, 29, 24, 19, 26, 31, 26,
        15, 22, 27, 22, 19, 26, 31, 26],
      // channel 1 — bass
      [1, 0,
        17, 17, 17, 17, 12, 12, 12, 12,
        10, 10, 10, 10, 14, 14, 14, 14],
    ],
  ],
  // sequence — loops via playMusic(loop=true)
  [0, 1, 0, 1],
  // BPM
  132,
];

// Lazily-built sound instances (built on first use, after the engine's audio
// context exists via the launching user gesture; keeps the lazy import fast).
let sounds = null;
let musicTrack = null;
let musicInstance = null;

function ensureSounds() {
  if (sounds) return;
  sounds = {};
  for (const name in SFX) sounds[name] = new Sound(SFX[name]);
}

function ensureMusic() {
  if (!musicTrack) musicTrack = new ZzFXMusic(MUSIC);
}

/**
 * Play a one-shot sound effect by name. No-op when muted or for unknown names.
 * @param {string} name - one of the documented effect names.
 */
export function play(name) {
  if (muted) return;
  ensureSounds();
  const s = sounds[name];
  if (s) s.play();
}

/** Start the looping chiptune. Idempotent while it is already playing. */
export function startMusic() {
  ensureMusic();
  // Apply the current mute state to the engine master before starting so a
  // muted session starts silent.
  setSoundVolume(muted ? 0 : BASE_VOLUME);
  if (musicInstance && musicInstance.isPlaying()) return;
  musicInstance = musicTrack.playMusic(MUSIC_VOLUME, true);
}

/** Stop the chiptune loop (called on game exit). */
export function stopMusic() {
  if (musicInstance) {
    musicInstance.stop();
    musicInstance = null;
  }
}

/**
 * Set mute state explicitly.
 * @param {boolean} value
 * @returns {boolean} the new muted state
 */
export function setMuted(value) {
  muted = !!value;
  // Master volume drives both the running music loop and future effects; a
  // muted loop keeps looping silently so unmute is instant.
  setSoundVolume(muted ? 0 : BASE_VOLUME);
  return muted;
}

/**
 * Toggle mute on/off.
 * @returns {boolean} the new muted state
 */
export function toggleMute() {
  return setMuted(!muted);
}

/** API object form (matches the plan's `{ play, startMusic, ... }` contract). */
export const audio = {
  play,
  startMusic,
  stopMusic,
  toggleMute,
  setMuted,
  get muted() {
    return muted;
  },
};

export default audio;
