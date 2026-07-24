/**
 * Konami shooter — enemy roster and data-driven level tables (task 4.1).
 *
 * The six enemy behaviors from the spec plus the mini-drone that splitters
 * spawn. Movement runs in the game's world coordinates: the y-axis points UP, so
 * "descend" means decreasing y. Enemies enter from off-screen — above the top
 * edge (y > WORLD_H) for most, or from the left/right for the miner — and are
 * despawned by the framework once fully off-screen.
 *
 * `installLevels()` registers the roster and levels with the core module at game
 * start. It is called from index.js's gameInit so every reference to the core
 * spawn/query functions happens at runtime, sidestepping circular-import order.
 *
 * Levels 1 and 2 are defined here; the level-3 boss fight is task 4.2.
 */
import { clamp, vec2 } from './engine.js';
import {
  spawnEnemy,
  spawnEnemyBullet,
  spawnMine,
  spawnExplosion,
  getPlayer,
  registerEnemyTypes,
  setLevels,
} from './index.js';
import audio from './audio.js';

// Local copies of the world dimensions (kept local to avoid reading the core
// module's const exports during this module's evaluation).
const WORLD_W = 540;
const WORLD_H = 960;
const DROP_CHANCE = 0.25; // tank / splitter power-up drop probability
const ENEMY_BULLET_SPEED = 7;

// Boss tuning
const BOSS_ANCHOR_Y = 830; // resting height near the top edge
const BOSS_HALF_W = 210; // keeps the wide hull on-screen while sweeping
const BOSS_BULLET_SPEED = 6;

// --- Behaviors ---------------------------------------------------------------
function aimedShotAt(e) {
  const p = getPlayer();
  if (!p) return;
  const dir = p.pos.subtract(e.pos).normalize();
  spawnEnemyBullet(e.pos.copy(), dir.scale(ENEMY_BULLET_SPEED));
}

// --- Boss attack patterns ----------------------------------------------------
// World y points up, so "down" (toward the player) is negative y.
function bossSpread(e, phase) {
  const n = phase >= 3 ? 7 : 5;
  const spread = 0.6; // radians either side of straight down
  const muzzle = vec2(e.pos.x, e.pos.y - 60);
  for (let i = 0; i < n; i++) {
    const a = -spread + (2 * spread * i) / (n - 1);
    const vx = Math.sin(a) * BOSS_BULLET_SPEED;
    const vy = -Math.cos(a) * BOSS_BULLET_SPEED;
    spawnEnemyBullet(muzzle.copy(), vec2(vx, vy));
  }
}

function bossAimedBurst(e) {
  const p = getPlayer();
  if (!p) return;
  const base = p.pos.subtract(e.pos).normalize();
  for (const off of [-0.16, 0, 0.16]) {
    const ca = Math.cos(off);
    const sa = Math.sin(off);
    const dx = base.x * ca - base.y * sa;
    const dy = base.x * sa + base.y * ca;
    spawnEnemyBullet(e.pos.copy(), vec2(dx, dy).scale(BOSS_BULLET_SPEED + 1));
  }
}

const ENEMY_TYPES = {
  // 1. Drone — gentle sine-wave descent.
  drone: {
    sprite: 'drone',
    size: 40,
    hp: 1,
    score: 100,
    update(e) {
      e.pos.y -= 2.0;
      e.pos.x = e.spawnX + Math.sin(e.t * 0.05) * 60;
    },
  },

  // 2. Darter — locks onto the player's column, then dives fast and straight.
  darter: {
    sprite: 'darter',
    size: 38,
    hp: 1,
    score: 150,
    update(e) {
      if (e.aimX === undefined) {
        const p = getPlayer();
        e.aimX = p ? p.pos.x : e.spawnX;
      }
      e.pos.x += clamp(e.aimX - e.pos.x, -6, 6);
      e.pos.y -= 6.0;
    },
  },

  // 3. Weaver — wide zigzag descent, fires single aimed shots.
  weaver: {
    sprite: 'weaver',
    size: 46,
    hp: 1,
    score: 200,
    update(e) {
      e.pos.y -= 1.8;
      e.pos.x = e.spawnX + Math.sin(e.t * 0.08) * 90;
      if (e.t % 90 === 45) aimedShotAt(e);
    },
  },

  // 4. Tank — slow, armored (3 HP), may drop a power-up.
  tank: {
    sprite: 'tank',
    size: 52,
    hp: 3,
    score: 300,
    drop: DROP_CHANCE,
    update(e) {
      e.pos.y -= 1.0;
      e.pos.x = e.spawnX + Math.sin(e.t * 0.03) * 30;
    },
  },

  // 5. Splitter — on death splits into two fast mini-drones. May drop power-up.
  splitter: {
    sprite: 'splitter',
    size: 44,
    hp: 1,
    score: 150,
    drop: DROP_CHANCE,
    update(e) {
      e.pos.y -= 1.5;
      e.pos.x = e.spawnX + Math.sin(e.t * 0.04) * 40;
    },
    onDeath(e) {
      const a = spawnEnemy('miniDrone', e.pos.copy());
      const b = spawnEnemy('miniDrone', e.pos.copy());
      if (a) a.mvx = -3;
      if (b) b.mvx = 3;
    },
  },

  // Mini-drone — the splitter's offspring; fast, diverging, cheap.
  miniDrone: {
    sprite: 'drone',
    size: 26,
    hp: 1,
    score: 50,
    update(e) {
      e.pos.y -= 3.5;
      e.pos.x += e.mvx || 0;
    },
  },

  // 6. Miner — crosses horizontally, laying stationary mines. Enters from a side.
  miner: {
    sprite: 'miner',
    size: 50,
    hp: 1,
    score: 200,
    update(e) {
      const dir = e.spawnX < WORLD_W / 2 ? 1 : -1; // came from the near side
      e.pos.x += dir * 2.2;
      e.pos.y = e.spawnY + Math.sin(e.t * 0.05) * 18; // gentle bob
      if (e.t % 45 === 0) spawnMine(e.pos.copy());
    },
  },

  // Boss (level 3) — screen-wide mothership, 60 HP, three HP-third phases:
  //   phase 1: sweeping spread shots
  //   phase 2: + aimed bursts
  //   phase 3: faster sweep + spawns drone escorts
  // Hit-flash comes from the base Enemy; death is a multi-explosion.
  boss: {
    sprite: 'boss',
    size: [420, 150],
    hp: 60,
    score: 5000,
    boss: true, // never auto-despawned; drives the boss HUD / phase logic
    update(e) {
      // Entrance: descend from above to the anchored height before attacking.
      if (e.pos.y > BOSS_ANCHOR_Y) {
        e.pos.y -= 3;
        return;
      }
      e.pos.y = BOSS_ANCHOR_Y;

      // Phase by HP thirds.
      const frac = e.hp / e.maxHp;
      const phase = frac > 2 / 3 ? 1 : frac > 1 / 3 ? 2 : 3;
      if (e.phase === undefined) e.phase = phase;
      else if (phase > e.phase) {
        e.phase = phase;
        audio.play('bossPhase');
      }

      // Horizontal sweep (faster in phase 3).
      if (!e.sweepDir) e.sweepDir = 1;
      e.pos.x += (phase >= 3 ? 2.6 : 1.5) * e.sweepDir;
      const minX = BOSS_HALF_W;
      const maxX = WORLD_W - BOSS_HALF_W;
      if (e.pos.x < minX) {
        e.pos.x = minX;
        e.sweepDir = 1;
      } else if (e.pos.x > maxX) {
        e.pos.x = maxX;
        e.sweepDir = -1;
      }

      // Attacks.
      const spreadGap = phase >= 3 ? 40 : 60;
      if (e.t % spreadGap === 0) bossSpread(e, phase);
      if (phase >= 2 && e.t % 90 === 30) bossAimedBurst(e);
      if (phase >= 3 && e.t % 150 === 0) {
        const x = 60 + Math.random() * (WORLD_W - 120);
        spawnEnemy('drone', vec2(x, WORLD_H + 40)); // escort from the top
      }
    },
    onDeath(e) {
      // Big multi-explosion across the hull (die() already spawns one).
      for (let i = 0; i < 9; i++) {
        const ox = (Math.random() - 0.5) * e.size.x * 0.9;
        const oy = (Math.random() - 0.5) * e.size.y * 0.8;
        const s = 40 + Math.random() * 60;
        spawnExplosion(vec2(e.pos.x + ox, e.pos.y + oy), vec2(s));
      }
      audio.play('explosion');
    },
  },
};

// --- Wave-table builders -----------------------------------------------------
// A spawn entry is { at, type, x?, y?, from? }:
//  - default: enters from the top at world x (random if omitted).
//  - from:'left'/'right': enters from that side at world y (near the top).
function drones(startAt, count, gap = 34) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({ at: startAt + i * gap, type: 'drone', x: 70 + (i % 7) * 60 });
  }
  return out;
}

function darters(startAt, count, gap = 40) {
  const out = [];
  for (let i = 0; i < count; i++) out.push({ at: startAt + i * gap, type: 'darter' });
  return out;
}

// Level 1 — introductory pacing: drones and darters only.
const LEVEL_1 = [
  ...drones(60, 6),
  ...darters(340, 3),
  ...drones(560, 7, 30),
  ...darters(840, 4, 34),
  ...drones(1080, 6, 28),
];

// Level 2 — denser, all six enemy types.
const LEVEL_2 = [
  ...drones(40, 6, 26),
  { at: 120, type: 'miner', from: 'left', y: 840 },
  ...darters(260, 4, 30),
  { at: 360, type: 'tank', x: 180 },
  { at: 380, type: 'tank', x: 360 },
  { at: 460, type: 'weaver', x: 140 },
  { at: 500, type: 'weaver', x: 400 },
  { at: 560, type: 'splitter', x: 200 },
  { at: 600, type: 'splitter', x: 340 },
  { at: 680, type: 'miner', from: 'right', y: 800 },
  ...drones(760, 8, 22),
  ...darters(1000, 5, 26),
  { at: 1140, type: 'tank', x: 270 },
  { at: 1180, type: 'weaver', x: 120 },
  { at: 1200, type: 'weaver', x: 420 },
  { at: 1260, type: 'splitter', x: 160 },
  { at: 1280, type: 'splitter', x: 380 },
  { at: 1340, type: 'miner', from: 'left', y: 780 },
];

// Level 3 — the boss fight. A couple of intro drones, then the mothership
// (which spawns its own escorts once it reaches phase 3). Clearing the boss and
// any remaining escorts completes the game and shows the victory screen.
const LEVEL_3 = [
  { at: 40, type: 'drone', x: 150 },
  { at: 70, type: 'drone', x: 390 },
  { at: 120, type: 'boss', x: WORLD_W / 2 },
];

const LEVELS = [{ spawns: LEVEL_1 }, { spawns: LEVEL_2 }, { spawns: LEVEL_3 }];

/** Register the roster and level tables with the core game module. */
export function installLevels() {
  registerEnemyTypes(ENEMY_TYPES);
  setLevels(LEVELS);
}

export { ENEMY_TYPES, LEVELS };
