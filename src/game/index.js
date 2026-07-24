/**
 * Konami shooter — game entry point and core gameplay (tasks 1.1 + 3.1).
 *
 * Exports `startGame(container, onExit)`. All LittleJS usage lives under
 * `src/game/`. This module is imported dynamically by the landing page so Vite
 * emits it (and the engine) as a separate lazy chunk — nothing here is in the
 * initial page load.
 *
 * The engine runs in 2D-canvas mode with a transparent clear color so the
 * site's drifting particle network stays visible behind and beside the
 * letterboxed 540×960 playfield.
 *
 * World coordinates: cameraScale is 1, so one world unit == one canvas pixel.
 * The camera is centered on the field, and the y-axis points UP — so the top of
 * the screen is y = WORLD_H and the bottom is y = 0. The player is anchored near
 * the bottom (small y); enemies enter from the top (large y) and descend.
 *
 * This module owns the reusable framework: the object classes, collision,
 * lives/score, power-ups, the HUD, audio wiring, and a data-driven wave runner
 * fed by the `ENEMY_TYPES` and `LEVELS` registries. Task 4.1 replaces the
 * placeholder registries below with the full six-enemy roster + level tables
 * (levels.js), and task 4.2 adds the level-3 boss and victory screen. The
 * exported hooks (`registerEnemyTypes`, `setLevels`, `spawnEnemy`, etc.) are the
 * seams those tasks build on.
 */
import {
  engineInit,
  setGLEnable,
  setShowSplashScreen,
  setCanvasFixedSize,
  setCanvasClearColor,
  setCanvasPixelated,
  setCameraScale,
  setCameraPos,
  setGravity,
  setPaused,
  vec2,
  rgb,
  hsl,
  clamp,
  rand,
  mousePos,
  mouseIsDown,
  mouseWasPressed,
  keyIsDown,
  keyWasPressed,
  drawTile,
  drawTextScreen,
  EngineObject,
  TileInfo,
  TextureInfo,
  setDebugWatermark,
} from './engine.js';
import { buildSpriteSheet } from './sprites.js';
import audio from './audio.js';
import { installLevels } from './levels.js';

// --- World constants ---------------------------------------------------------
const WORLD_W = 540;
const WORLD_H = 960;
const CENTER = vec2(WORLD_W / 2, WORLD_H / 2);

// Player
const PLAYER_SIZE = 46;
const PLAYER_ANCHOR_Y = 120; // resting height above the bottom edge
const PLAYER_START_Y = -60; // enters from below the bottom edge
const ENTRANCE_FRAMES = 54; // ~0.9s at 60fps
const MOVE_SPEED = 9; // max horizontal world units / frame
const PLAYER_MARGIN = 30; // keep the ship on-screen
const FIRE_INTERVAL = 12; // frames between shots (~5/sec)
const RESPAWN_INVULN = 120; // ~2s of invulnerability blink after a respawn
const DEATH_RESPAWN_DELAY = 72; // ~1.2s between explosion and re-entry
const DOUBLE_SHOT_FRAMES = 600; // 10s power-up
const START_LIVES = 3;

// Projectiles
const PLAYER_BULLET_SPEED = 15;
const PLAYER_BULLET_SIZE = vec2(12, 26);
const ENEMY_BULLET_SPEED = 7;
const ENEMY_BULLET_SIZE = vec2(18, 18);

// Power-up
const POWERUP_SIZE = 34;
const POWERUP_FALL = 3;
const POWERUP_DROP_CHANCE = 0.25;

// Explosion
const EXPLOSION_FRAME_TIME = 5; // frames per explosion frame (4 frames total)

// Colors
const CYAN = rgb(0.17, 0.91, 1);
const WHITE = rgb(1, 1, 1);
const AMBER = rgb(1, 0.69, 0.13);
const RED = rgb(1, 0.2, 0.27);

// --- Sprite tiles ------------------------------------------------------------
// Built once in gameInit from the runtime sprite sheet; name -> TileInfo whose
// .frame(n) selects animation frame n (frames are laid out horizontally).
const tiles = {};
const flashTiles = {}; // name -> white-silhouette TileInfo (hit flash)
let spriteFrames = {}; // name -> frame count

function tileFor(name, frame = 0) {
  const t = tiles[name];
  return t ? t.frame(frame) : undefined;
}

function initTiles() {
  const sheet = buildSpriteSheet();
  const tex = new TextureInfo(sheet.canvas);
  for (const [name, s] of Object.entries(sheet.sprites)) {
    tiles[name] = new TileInfo(vec2(s.x, s.y), vec2(s.w, s.h), tex).setColumns(0);
    spriteFrames[name] = s.frames;
    if (s.flash)
      flashTiles[name] = new TileInfo(vec2(s.flash.x, s.flash.y), vec2(s.w, s.h), tex);
  }
}

// --- Game state --------------------------------------------------------------
const STATE = {
  ENTERING: 'entering',
  LEVEL_CARD: 'levelCard',
  PLAYING: 'playing',
  ENDED: 'ended',
};

let sessionBest = 0; // module-scope "best this session", no persistence

const game = {
  state: STATE.ENTERING,
  frame: 0,
  score: 0,
  lives: START_LIVES,
  level: 0, // 1-based once playing
  cardTimer: 0,
  cardText: '',
  endWin: false,
  running: false,
};

// Live object lists for collision.
let player = null;
const enemies = [];
const playerBullets = [];
const enemyBullets = [];
const mines = [];
const powerups = [];

// Data-driven registries (placeholders here; task 4.1 supplies the real ones).
let ENEMY_TYPES = {};
let LEVELS = [];

// The active level's spawn cursor.
let wave = null;

// --- Registry hooks (used by task 4.1 / 4.2) ---------------------------------
/** Register or extend the enemy type table. */
export function registerEnemyTypes(types) {
  Object.assign(ENEMY_TYPES, types);
}
/** Replace the level wave tables. */
export function setLevels(levels) {
  LEVELS = levels;
}

// --- Helpers -----------------------------------------------------------------
function overlaps(a, b) {
  const dx = Math.abs(a.pos.x - b.pos.x);
  const dy = Math.abs(a.pos.y - b.pos.y);
  return (
    dx < (a.size.x + b.size.x) / 2 && dy < (a.size.y + b.size.y) / 2
  );
}

function removeFrom(list, obj) {
  const i = list.indexOf(obj);
  if (i >= 0) list.splice(i, 1);
}

/** Add to the score (and keep the session best in sync). */
export function addScore(points) {
  game.score += points;
  if (game.score > sessionBest) sessionBest = game.score;
}

/** Spawn a one-shot explosion animation. Exported for the boss's multi-blast. */
export function spawnExplosion(pos, size) {
  new Explosion(pos, size);
}

/** Route both game-over and victory through one exit-able end screen. */
export function endGame(win) {
  if (game.state === STATE.ENDED) return;
  game.state = STATE.ENDED;
  game.endWin = win;
  if (game.score > sessionBest) sessionBest = game.score;
  audio.stopMusic();
}

// --- Object classes ----------------------------------------------------------
class Player extends EngineObject {
  constructor() {
    super(vec2(WORLD_W / 2, PLAYER_START_Y), vec2(PLAYER_SIZE), tileFor('player'));
    this.gravityScale = 0;
    this.fireTimer = 0;
    this.invuln = ENTRANCE_FRAMES; // safe during the entrance
    this.doubleShot = 0;
    this.targetX = WORLD_W / 2;
    this.pointerTimer = 0;
    this.deadTimer = 0; // >0: ship destroyed, waiting to re-enter
    this.entranceT = -1; // >=0: re-entering from below after a death
  }

  /** True while the ship is exploded or riding back in — untouchable, no fire. */
  isInactive() {
    return this.deadTimer > 0 || this.entranceT >= 0;
  }

  update() {
    // 2-frame engine idle
    this.tileInfo = tileFor('player', (game.frame / 10 | 0) % 2);

    if (game.state === STATE.ENTERING) {
      const t = clamp(game.frame / ENTRANCE_FRAMES, 0, 1);
      const eased = 1 - (1 - t) * (1 - t); // ease-out
      this.pos.y = PLAYER_START_Y + (PLAYER_ANCHOR_Y - PLAYER_START_Y) * eased;
      if (t >= 1) beginLevel(1);
      return;
    }

    if (game.state !== STATE.PLAYING) return;

    // --- Death sequence: hidden beat, then re-entry from below ---
    if (this.deadTimer > 0) {
      if (--this.deadTimer === 0) {
        // start the re-entry: same rise as the game-start entrance
        this.pos = vec2(WORLD_W / 2, PLAYER_START_Y);
        this.targetX = WORLD_W / 2;
        this.entranceT = 0;
        this.invuln = RESPAWN_INVULN;
      }
      return;
    }
    if (this.entranceT >= 0) {
      const t = clamp(++this.entranceT / ENTRANCE_FRAMES, 0, 1);
      const eased = 1 - (1 - t) * (1 - t); // same ease-out as the entrance
      this.pos.y = PLAYER_START_Y + (PLAYER_ANCHOR_Y - PLAYER_START_Y) * eased;
      if (this.invuln > 0) this.invuln--; // blink spans rise + settle (~2s)
      if (t >= 1) this.entranceT = -1; // arrived: controls and fire resume
      return;
    }

    // --- Steering: keyboard, else pointer (mouse follow / touch drag) ---
    const left = keyIsDown('ArrowLeft') || keyIsDown('KeyA');
    const right = keyIsDown('ArrowRight') || keyIsDown('KeyD');

    // Track pointer activity: a press, or mouse movement, steers the ship.
    if (mouseIsDown(0)) this.pointerTimer = 20;
    else if (this.lastMouseX !== undefined && Math.abs(mousePos.x - this.lastMouseX) > 0.5)
      this.pointerTimer = 20;
    this.lastMouseX = mousePos.x;

    if (left || right) {
      this.targetX += (right ? MOVE_SPEED : 0) - (left ? MOVE_SPEED : 0);
      this.pointerTimer = 0; // keyboard overrides pointer
    } else if (this.pointerTimer > 0) {
      this.pointerTimer--;
      this.targetX = mousePos.x;
    }
    this.targetX = clamp(this.targetX, PLAYER_MARGIN, WORLD_W - PLAYER_MARGIN);

    // ease toward target
    const dx = clamp(this.targetX - this.pos.x, -MOVE_SPEED, MOVE_SPEED);
    this.pos.x = clamp(this.pos.x + dx, PLAYER_MARGIN, WORLD_W - PLAYER_MARGIN);

    // --- Auto-fire ---
    if (this.invuln > 0) this.invuln--;
    if (this.doubleShot > 0) this.doubleShot--;
    if (this.fireTimer > 0) this.fireTimer--;
    else {
      this.fire();
      this.fireTimer = FIRE_INTERVAL;
    }
  }

  fire() {
    const noseY = this.pos.y + PLAYER_SIZE / 2;
    if (this.doubleShot > 0) {
      new PlayerBullet(vec2(this.pos.x - 10, noseY));
      new PlayerBullet(vec2(this.pos.x + 10, noseY));
    } else {
      new PlayerBullet(vec2(this.pos.x, noseY));
    }
    audio.play('shoot');
  }

  render() {
    // Hidden while exploded, waiting to re-enter.
    if (this.deadTimer > 0) return;
    // Blink while invulnerable.
    if (this.invuln > 0 && (game.frame % 8) < 4) return;
    super.render();
  }

  hit() {
    if (this.invuln > 0 || this.isInactive() || game.state !== STATE.PLAYING)
      return;
    // Explode at the ship and hide it.
    spawnExplosion(this.pos.copy(), vec2(PLAYER_SIZE * 1.6));
    audio.play('playerDeath');
    game.lives--;
    this.doubleShot = 0;
    // Clear all enemy bullets — mines remain. (Iterate a copy: destroy mutates.)
    for (const b of [...enemyBullets]) b.destroy();
    if (game.lives <= 0) {
      this.destroy();
      player = null;
      endGame(false);
      return;
    }
    // Hidden beat below the screen, then re-entry (see update()). Waves keep
    // running throughout.
    this.deadTimer = DEATH_RESPAWN_DELAY;
    this.pos = vec2(WORLD_W / 2, PLAYER_START_Y);
  }
}

class PlayerBullet extends EngineObject {
  constructor(pos) {
    super(pos, PLAYER_BULLET_SIZE, tileFor('bulletPlayer'));
    this.gravityScale = 0;
    playerBullets.push(this);
  }
  update() {
    this.tileInfo = tileFor('bulletPlayer', (game.frame / 4 | 0) % 2);
    this.pos.y += PLAYER_BULLET_SPEED;
    if (this.pos.y > WORLD_H + 40) this.destroy();
  }
  destroy() {
    removeFrom(playerBullets, this);
    super.destroy();
  }
}

class EnemyBullet extends EngineObject {
  constructor(pos, velocity) {
    super(pos, ENEMY_BULLET_SIZE, tileFor('bulletEnemy'));
    this.gravityScale = 0;
    this.velocity = velocity;
    enemyBullets.push(this);
  }
  update() {
    this.tileInfo = tileFor('bulletEnemy', (game.frame / 6 | 0) % 2);
    this.pos = this.pos.add(this.velocity);
    if (
      this.pos.y < -40 || this.pos.y > WORLD_H + 40 ||
      this.pos.x < -40 || this.pos.x > WORLD_W + 40
    )
      this.destroy();
  }
  destroy() {
    removeFrom(enemyBullets, this);
    super.destroy();
  }
}

class Mine extends EngineObject {
  constructor(pos) {
    super(pos, vec2(28), tileFor('mine'));
    this.gravityScale = 0;
    this.life = 600; // despawn after ~10s
    mines.push(this);
  }
  update() {
    this.tileInfo = tileFor('mine', (game.frame / 8 | 0) % 2);
    this.angle += 0.02;
    if (--this.life <= 0) this.destroy();
  }
  destroy() {
    removeFrom(mines, this);
    super.destroy();
  }
}

class PowerUp extends EngineObject {
  constructor(pos) {
    super(pos, vec2(POWERUP_SIZE), tileFor('powerup'));
    this.gravityScale = 0;
    powerups.push(this);
  }
  update() {
    this.tileInfo = tileFor('powerup', (game.frame / 10 | 0) % 2);
    this.pos.y -= POWERUP_FALL; // drifts down toward the player
    if (this.pos.y < -40) this.destroy();
  }
  destroy() {
    removeFrom(powerups, this);
    super.destroy();
  }
}

class Explosion extends EngineObject {
  constructor(pos, size) {
    super(pos, size, tileFor('explosion'));
    this.gravityScale = 0;
    this.timer = 0;
  }
  update() {
    this.timer++;
    const f = (this.timer / EXPLOSION_FRAME_TIME) | 0;
    if (f >= (spriteFrames.explosion || 4)) {
      this.destroy();
      return;
    }
    this.tileInfo = tileFor('explosion', f);
  }
}

/**
 * Generic data-driven enemy. `def` comes from ENEMY_TYPES:
 *   { sprite, size, hp, score, drop?, update(e), onDeath?(e) }
 * `def.update(e)` drives movement/behavior each frame (sets e.velocity / e.pos
 * and may fire via spawnEnemyBullet). Exported so task 4.1/4.2 can subclass or
 * instantiate it for the full roster and boss.
 */
export class Enemy extends EngineObject {
  constructor(def, pos) {
    const size = Array.isArray(def.size)
      ? vec2(def.size[0], def.size[1])
      : vec2(def.size || 40);
    super(pos, size, tileFor(def.sprite));
    this.gravityScale = 0;
    this.def = def;
    this.hp = def.hp || 1;
    this.maxHp = this.hp;
    this.t = 0;
    this.flash = 0;
    this.spawnX = pos.x; // remembered for path-based behaviors (sine, zigzag)
    this.spawnY = pos.y;
    enemies.push(this);
  }
  update() {
    this.t++;
    if (this.flash > 0) this.flash--;
    const frames = spriteFrames[this.def.sprite] || 1;
    this.tileInfo = tileFor(this.def.sprite, frames > 1 ? (this.t / 12 | 0) % frames : 0);
    if (this.def.update) this.def.update(this);
    // Despawn once fully off-screen (escaped — no score, no explosion).
    if (
      !this.def.boss &&
      (this.pos.y < -120 || this.pos.x < -160 || this.pos.x > WORLD_W + 160)
    )
      this.destroy();
  }
  render() {
    const flashTile = flashTiles[this.def.sprite];
    if (this.flash > 0 && flashTile) {
      // White silhouette of the sprite (same outline, not a rectangle).
      drawTile(this.pos, this.size, flashTile, WHITE, this.angle, this.mirror);
    } else {
      super.render();
    }
  }
  takeDamage(dmg) {
    this.hp -= dmg;
    this.flash = 3;
    audio.play('enemyHit');
    if (this.hp <= 0) this.die();
  }
  die() {
    addScore(this.def.score || 100);
    spawnExplosion(this.pos.copy(), this.size.scale(1.2));
    audio.play('explosion');
    if (this.def.onDeath) this.def.onDeath(this);
    if ((this.def.drop || 0) > 0 && rand() < this.def.drop) dropPowerUp(this.pos.copy());
    this.destroy();
  }
  destroy() {
    removeFrom(enemies, this);
    super.destroy();
  }
}

// --- Spawning helpers (exported seams for the roster/levels tasks) -----------
/** Spawn an enemy of `type` at `pos` (defaults to just above the top edge). */
export function spawnEnemy(type, pos) {
  const def = ENEMY_TYPES[type];
  if (!def) return null;
  return new Enemy(def, pos || vec2(WORLD_W / 2, WORLD_H + 60));
}
/** Fire an enemy bullet from `pos` with `velocity`. */
export function spawnEnemyBullet(pos, velocity) {
  return new EnemyBullet(pos, velocity);
}
/** Lay a stationary mine at `pos`. */
export function spawnMine(pos) {
  return new Mine(pos);
}
function dropPowerUp(pos) {
  new PowerUp(pos);
}
/** Read-only access to the current player object (may be null between deaths). */
export function getPlayer() {
  return player;
}
export { WORLD_W, WORLD_H, POWERUP_DROP_CHANCE };

// --- Level / wave flow -------------------------------------------------------
function beginLevel(n) {
  game.level = n;
  game.state = STATE.LEVEL_CARD;
  game.cardText = 'LEVEL ' + n;
  game.cardTimer = 120; // 2s card
}

function startWaves(levelIndex) {
  const level = LEVELS[levelIndex - 1];
  wave = level ? { level, cursor: 0, timer: 0, done: false } : null;
}

/**
 * Advance the active level's spawn schedule and detect completion. The schedule
 * format (an array of { at, type, x } spawn entries plus an optional
 * `onClear`) is intentionally simple; task 4.1 supplies the real tables.
 */
function updateWaves() {
  if (!wave) return;
  wave.timer++;
  const spawns = wave.level.spawns || [];
  while (wave.cursor < spawns.length && spawns[wave.cursor].at <= wave.timer) {
    const s = spawns[wave.cursor++];
    let pos;
    if (s.from === 'left') {
      pos = vec2(-50, s.y != null ? s.y : rand(WORLD_H * 0.65, WORLD_H * 0.85));
    } else if (s.from === 'right') {
      pos = vec2(WORLD_W + 50, s.y != null ? s.y : rand(WORLD_H * 0.65, WORLD_H * 0.85));
    } else {
      const x = s.x != null ? s.x : rand(60, WORLD_W - 60);
      pos = vec2(x, WORLD_H + (s.y || 60));
    }
    spawnEnemy(s.type, pos);
  }
  const spawnsDone = wave.cursor >= spawns.length;
  if (spawnsDone && enemies.length === 0 && !wave.done) {
    wave.done = true;
    advanceLevel();
  }
}

function advanceLevel() {
  if (game.level < LEVELS.length) beginLevel(game.level + 1);
  else endGame(true); // cleared all levels (task 4.2 owns the boss/victory)
}

// --- Collision pass ----------------------------------------------------------
function collisions() {
  // player bullets vs enemies (+ mines)
  for (let i = playerBullets.length - 1; i >= 0; i--) {
    const b = playerBullets[i];
    let hit = false;
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (overlaps(b, e)) {
        e.takeDamage(1);
        hit = true;
        break;
      }
    }
    if (!hit) {
      for (let j = mines.length - 1; j >= 0; j--) {
        if (overlaps(b, mines[j])) {
          spawnExplosion(mines[j].pos.copy(), vec2(34));
          audio.play('explosion');
          mines[j].destroy();
          hit = true;
          break;
        }
      }
    }
    if (hit) b.destroy();
  }

  if (!player || player.isInactive()) return; // exploded/re-entering: untouchable
  if (player.invuln > 0 || game.state !== STATE.PLAYING) {
    // still let power-ups be collected during invulnerability
    collectPowerups();
    return;
  }

  // enemy bullets vs player
  for (const b of enemyBullets) {
    if (overlaps(b, player)) {
      b.destroy();
      player.hit();
      return;
    }
  }
  // mines vs player
  for (const m of mines) {
    if (overlaps(m, player)) {
      spawnExplosion(m.pos.copy(), vec2(34));
      m.destroy();
      player.hit();
      return;
    }
  }
  // enemy bodies vs player
  for (const e of enemies) {
    if (overlaps(e, player)) {
      player.hit();
      return;
    }
  }
  collectPowerups();
}

function collectPowerups() {
  if (!player) return;
  for (let i = powerups.length - 1; i >= 0; i--) {
    if (overlaps(powerups[i], player)) {
      player.doubleShot = DOUBLE_SHOT_FRAMES;
      audio.play('powerUp');
      powerups[i].destroy();
    }
  }
}

// --- HUD ---------------------------------------------------------------------
function drawHUD() {
  // score (top-left)
  drawTextScreen('SCORE ' + game.score, vec2(90, 26), 22, CYAN, 4, rgb(0, 0, 0, 0.6), 'left');

  // lives as small ship icons (top-right, under the mute icon)
  const icon = tileFor('player');
  if (icon) {
    for (let i = 0; i < game.lives; i++) {
      drawTile(
        vec2(WORLD_W - 24 - i * 30, 66),
        vec2(24),
        icon,
        WHITE,
        0,
        false,
        undefined,
        false,
        true // screen space
      );
    }
  }

  // double-shot indicator
  if (player && player.doubleShot > 0) {
    drawTextScreen('DOUBLE ' + Math.ceil(player.doubleShot / 60) + 's', vec2(90, 52), 16, hsl(0.28, 1, 0.6), 3, rgb(0, 0, 0, 0.6), 'left');
  }
}

function drawCenterText(lines, baseSize) {
  let y = WORLD_H / 2 - (lines.length - 1) * baseSize * 0.7;
  for (const line of lines) {
    drawTextScreen(line.text, vec2(WORLD_W / 2, y), line.size || baseSize, line.color || WHITE, 5, rgb(0, 0, 0, 0.7));
    y += (line.size || baseSize) * 1.3;
  }
}

// --- Engine callbacks --------------------------------------------------------
function gameInit() {
  setCanvasClearColor(rgb(0, 0, 0, 0));
  setGravity(vec2(0, 0));
  setCameraScale(1);
  setCameraPos(CENTER);
  initTiles();
  installLevels();
  resetRun();
  audio.startMusic();
}

function resetRun() {
  // clear any lingering objects (e.g., re-trigger after a previous run)
  for (const o of [...enemies, ...playerBullets, ...enemyBullets, ...mines, ...powerups])
    o.destroy();
  if (player) player.destroy();

  game.state = STATE.ENTERING;
  game.frame = 0;
  game.score = 0;
  game.lives = START_LIVES;
  game.level = 0;
  wave = null;
  player = new Player();
}

function gameUpdate() {
  game.frame++;
  if (game.state === STATE.PLAYING) {
    updateWaves();
    collisions();
  } else if (game.state === STATE.LEVEL_CARD) {
    if (--game.cardTimer <= 0) {
      game.state = STATE.PLAYING;
      startWaves(game.level);
    }
    collisions();
  } else if (game.state === STATE.ENDED) {
    // any key / tap / Esc dismisses back to the landing page
    if (mouseWasPressed(0) || keyWasPressed('Escape') || anyKeyPressed())
      requestExit();
    return;
  }

  if (keyWasPressed('Escape')) requestExit();
  if (keyWasPressed('KeyM')) updateMuteButton(audio.toggleMute());
}

function gameUpdatePost() {}

function gameRender() {}

function gameRenderPost() {
  if (game.state !== STATE.ENTERING) drawHUD();

  if (game.state === STATE.LEVEL_CARD) {
    drawCenterText([{ text: game.cardText, size: 54, color: CYAN }], 54);
  } else if (game.state === STATE.ENDED) {
    drawCenterText(
      [
        { text: game.endWin ? 'VICTORY' : 'GAME OVER', size: 56, color: game.endWin ? AMBER : RED },
        { text: 'SCORE  ' + game.score, size: 28, color: WHITE },
        { text: 'BEST  ' + sessionBest, size: 22, color: CYAN },
        { text: 'tap / key to return', size: 18, color: rgb(0.7, 0.8, 0.95) },
      ],
      28
    );
  }
}

function anyKeyPressed() {
  // small allow-list so any obvious dismiss key works on the end screen
  return (
    keyWasPressed('Enter') || keyWasPressed('Space') || keyWasPressed('KeyA') ||
    keyWasPressed('KeyB') || keyWasPressed('ArrowUp') || keyWasPressed('ArrowDown')
  );
}

// --- DOM controls + lifecycle ------------------------------------------------
let booted = false;
let onExitCallback = null;
let exitButton = null;
let muteButton = null;

function styleControl(el, right) {
  el.type = 'button';
  el.style.cssText = [
    'position:absolute',
    'top:12px',
    right ? 'right:12px' : 'left:12px',
    'z-index:10',
    'width:40px',
    'height:40px',
    'padding:0',
    'font:700 20px/40px monospace',
    'color:#0ff',
    'background:rgba(0,0,0,0.4)',
    'border:2px solid #0ff',
    'border-radius:4px',
    'cursor:pointer',
    'pointer-events:auto',
  ].join(';');
}

function updateMuteButton(muted) {
  if (muteButton) muteButton.textContent = muted ? '\u{1F507}' : '\u{1F50A}';
}

function requestExit() {
  const cb = onExitCallback;
  onExitCallback = null;
  audio.stopMusic();
  setPaused(true);
  if (exitButton) exitButton.style.display = 'none';
  if (muteButton) muteButton.style.display = 'none';
  if (cb) cb();
}

/**
 * Start (or re-show) the shooter inside `container`.
 * @param {HTMLElement} container - transparent overlay host (fixed, inset 0).
 * @param {() => void} onExit - called when the player exits.
 */
export function startGame(container, onExit) {
  onExitCallback = onExit;

  if (booted) {
    if (exitButton) exitButton.style.display = '';
    if (muteButton) muteButton.style.display = '';
    resetRun();
    audio.startMusic();
    setPaused(false);
    return;
  }
  booted = true;

  exitButton = document.createElement('button');
  exitButton.setAttribute('aria-label', 'Exit game');
  exitButton.textContent = '✕'; // ✕
  styleControl(exitButton, false);
  exitButton.addEventListener('click', requestExit);
  container.appendChild(exitButton);

  muteButton = document.createElement('button');
  muteButton.setAttribute('aria-label', 'Toggle sound');
  styleControl(muteButton, true);
  updateMuteButton(audio.muted);
  muteButton.addEventListener('click', () => updateMuteButton(audio.toggleMute()));
  container.appendChild(muteButton);

  const mount = document.createElement('div');
  container.appendChild(mount);

  // No engine watermark (plan.md: "No engine watermark"). In LittleJS 1.18 the
  // setter is named setDebugWatermark (formerly setShowWatermark). We also use
  // the release engine build via ./engine.js — the debug build additionally
  // binds Escape as its debug-overlay toggle, which would collide with our
  // exit key and bring the version/FPS overlay back.
  setDebugWatermark(false);
  setGLEnable(false);
  setShowSplashScreen(false);
  setCanvasFixedSize(vec2(WORLD_W, WORLD_H));
  setCanvasPixelated(true);

  engineInit(
    gameInit,
    gameUpdate,
    gameUpdatePost,
    gameRender,
    gameRenderPost,
    [],
    mount
  );

  // engineInit synchronously applies `background:#000` to the mount; override
  // so the particle field remains visible through the overlay.
  mount.style.background = 'transparent';
}
