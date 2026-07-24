/**
 * Konami shooter — runtime-generated pixel art (task 2.1).
 *
 * There are NO image assets. Every sprite is a small palette-indexed pixel
 * grid (an array of equal-ish-length strings, one char per pixel). The builder
 * paints each grid onto an offscreen canvas laid out as a sprite sheet, with
 * image smoothing OFF so the pixels stay crisp when the engine scales them up.
 *
 * The gameplay module (task 3.1) registers this canvas as the engine's texture
 * and builds a `TileInfo` per sprite/frame from the exported pixel rectangles.
 *
 * Palette: bright neon (cyan / magenta / lime / amber / violet) on near-black,
 * matching the site's cyan/violet identity.
 *
 * Animation: a char of `E` marks "engine/glow" pixels whose color cycles per
 * frame, giving a cheap 2-frame idle pulse. Explosions are 4 authored frames.
 */

// --- Palette -----------------------------------------------------------------
// key -> css color, '.' / ' ' are transparent. `E` is resolved per-frame below.
const PALETTE = {
  k: '#0a0a16', // dark outline / near-black
  W: '#f2fbff', // white highlight
  C: '#2ce8ff', // cyan
  c: '#0f7f96', // cyan (dim / shadow)
  M: '#ff46ef', // magenta
  m: '#9c1f93', // magenta (dim)
  L: '#a6ff33', // lime
  l: '#4f8f16', // lime (dim)
  A: '#ffb020', // amber
  a: '#9a6a0c', // amber (dim)
  V: '#8a5cff', // violet
  v: '#4a2fb0', // violet (dim)
  S: '#6076a0', // steel hull
  s: '#34405e', // steel (dim)
  R: '#ff3344', // red
  O: '#ff7a18', // orange
};

// Engine/glow color per animation frame (index cycles 0,1,...).
const ENGINE_FRAMES = ['#ffe45a', '#ff6a1a'];

// --- Sprite bitmaps ----------------------------------------------------------
// Each entry: { grid: string[], frames: number, idle?: boolean }
// `frames` frames are laid out horizontally; unless a per-frame `grids` array is
// given, every frame reuses `grid` and only the `E` pixels change color.

// Player fighter, points up, cyan hull + white cockpit, violet wing tips,
// twin animated engines.
const PLAYER = [
  '.......kk.......',
  '......kCCk......',
  '......kCCk......',
  '.....kCWWCk.....',
  '.....kCWWCk.....',
  '....kCCWWCCk....',
  '...kVCCWWCCVk...',
  '..kVVCCWWCCVVk..',
  '..kVVCCWWCCVVk..',
  '.kVVCkCWWCkCVVk.',
  '.kVCk.CWWC.kCVk.',
  '.kk...CCCC...kk.',
  '......CEEC......',
  '.....kCEECk.....',
  '......EEEE......',
  '.......EE.......',
];

// Drone — small cyan diamond with a single glowing eye. Sine descent.
const DRONE = [
  '................',
  '................',
  '.......kk.......',
  '......kCCk......',
  '.....kCCCCk.....',
  '....kCCWWCCk....',
  '...kCCWEEWCCk...',
  '...kCCWEEWCCk...',
  '...kCCCWWCCCk...',
  '....kCCCCCCk....',
  '.....kcCCck.....',
  '......kcck......',
  '.......kk.......',
  '................',
  '................',
  '................',
];

// Darter — sleek magenta arrow pointing DOWN, fast dive.
const DARTER = [
  '................',
  '.....kMMMMk.....',
  '.....MMWWMM.....',
  '.....MMWWMM.....',
  '....kMMWWMMk....',
  '....MMMMMMMM....',
  '...kMMMmmMMMk...',
  '...MMMmEEmMMM...',
  '...kMMmEEmMMk...',
  '....kMMmmMMk....',
  '.....kMMMMk.....',
  '......kMMk......',
  '......kMMk......',
  '.......MM.......',
  '.......kk.......',
  '................',
];

// Weaver — wide lime flyer with swept wings, fires aimed shots. Zigzag.
const WEAVER = [
  '................',
  '................',
  '..kk......kk....',
  '.kLLk....kLLk...',
  '.kLLLk..kLLLk...',
  '..kLLLkkLLLk....',
  '...kLLLWWLLLk...',
  '..kLLLWEEWLLLk..',
  '.kLLLLWEEWLLLLk.',
  '.kLllLWWWWLllLk.',
  '..kllkLLLLkllk..',
  '...kk.kLLk.kk...',
  '......kLLk......',
  '.......ll.......',
  '................',
  '................',
];

// Tank — chunky armored steel/amber hex, 3 HP.
const TANK = [
  '................',
  '....kSSSSSSk....',
  '...kSSSSSSSSk...',
  '..kSSAAaaAASSk..',
  '.kSSAAWWWWAASSk.',
  '.kSAAWWEEWWAASk.',
  '.kSAAWEEEEWAASk.',
  '.kSAAWWEEWWAASk.',
  '.kSSAAWWWWAASSk.',
  '..kSSAAaaAASSk..',
  '..kSSSSSSSSSSk..',
  '...ksSSSSSSsk...',
  '...kS.kssk.Sk...',
  '..kk..kss k..kk.',
  '......EE.EE.....',
  '................',
];

// Splitter — bulbous violet twin-lobe pod; splits into two mini-drones.
const SPLITTER = [
  '................',
  '................',
  '...kVVk.kVVk....',
  '..kVVVVkVVVVk...',
  '..kVWVVVVVWVk...',
  '..kVVVVVVVVVk...',
  '..kvVVVVVVVvk...',
  '..kvVVWEWVVvk...',
  '...kvVWEEWVvk...',
  '...kvvVEEVvvk...',
  '....kvvVVvvk....',
  '.....kvvvvk.....',
  '......kvvk......',
  '.......kk.......',
  '................',
  '................',
];

// Miner — flat amber saucer that crosses horizontally laying mines.
const MINER = [
  '................',
  '................',
  '................',
  '......kAAk......',
  '.....kAWWAk.....',
  '....kAAWWAAk....',
  '..kkAAAAAAAAkk..',
  '.kAAaaAWWAaaAAk.',
  '.kAaOaAEEAaOaAk.',
  '.kAAaaAAAAaaAAk.',
  '..kkAAAAAAAAkk..',
  '....kOa..aOk....',
  '.....EE..EE.....',
  '................',
  '................',
  '................',
];

// Boss mothership — wide 8-bit hull (multi-tile, 56x24). Level-3 boss.
const BOSS = [
  '..........kSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSk..........',
  '........kkSSSSSSssSSSSSSSSSSSSSSSSSSSSSSSSssSSSSSSkk........',
  '......kkSSSSSssMMMMssSSSSSSSSSSSSSSSSSSssMMMMssSSSSSkk......',
  '....kkSSSSSssMMWWMMssSSSSSSSSSSSSSSSSSSssMMWWMMssSSSSSkk....',
  '..kkSSSSSSSssMMWWMMssSSSSSVVVVVVVVVVSSSSSssMMWWMMssSSSSSSSkk',
  '.kSSSSSSSSSSssMMMMssSSSSVVVWWWWWWVVVSSSSssMMMMssSSSSSSSSSSk.',
  '.kSSAASSSSSSSSssssSSSSVVVWWEEEEWWVVVSSSSssssSSSSSSSSAASSk...',
  'kSSAAAASSSSSSSSSSSSSSVVVWWEEEEEEWWVVVSSSSSSSSSSSSSSAAAA SSk.',
  'kSAAWWAASSSSSSSSSSSSSVVVWWEEEEEEWWVVVSSSSSSSSSSSSSAAWWAASk.',
  'kSAAWWAASSSSSSSSSSSSSSVVVWWEEEEWWVVVSSSSSSSSSSSSSSAAWWAASk.',
  'kSSAAAASSSSSSSSSSSSSSSSVVVWWWWWWVVVSSSSSSSSSSSSSSSSAAAASSk.',
  '.kSSAASSSSSssRRssSSSSSSSVVVVVVVVSSSSSSSssRRssSSSSSSAASSk...',
  '.kSSSSSSSSSsRRRRsSSSSSSSSSSSSSSSSSSSSSSsRRRRsSSSSSSSSSSSk..',
  '..kSSSSSSSSsRRRRsSSSSSSSSSSSSSSSSSSSSSSsRRRRsSSSSSSSSSk....',
  '...kkSSSSSSssRRssSSSSSSSSSSSSSSSSSSSSSSssRRssSSSSSSkk......',
  '.....kkSSSSSSssSSSSSSSSSSSSSSSSSSSSSSSSssSSSSSSkk.........',
  '.......kkSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSkk............',
  '.........kkkSSSSSSSSSSSSSSSSSSSSSSSSSSSSkkk..............',
  '...........kEkkkkEkkkkEkkkkEkkkkEkkkkEk.................',
  '............E....E....E....E....E....E..................',
];

// Player bullet — bright cyan bolt (4x8).
const BULLET_PLAYER = [
  '.CC.',
  '.CC.',
  'CWWC',
  'CWWC',
  'CWWC',
  'CWWC',
  '.CC.',
  '.EE.',
];

// Enemy bullet — magenta orb (6x6).
const BULLET_ENEMY = [
  '.kMMk.',
  'kMWWMk',
  'MWWWWM',
  'MWWWWM',
  'kMMMMk',
  '.kMMk.',
];

// Mine — spiky red ball (12x12), stationary hazard.
const MINE = [
  '.....RR.....',
  '..R..RR..R..',
  '..RRkRRkRR..',
  '...RRRRRR...',
  'RRRRWEEWRRRR',
  'RR.RWEEWR.RR',
  'RR.RWEEWR.RR',
  'RRRRWEEWRRRR',
  '...RRRRRR...',
  '..RRkRRkRR..',
  '..R..RR..R..',
  '.....RR.....',
];

// Double-shot power-up — lime capsule marked with two bolts (14x14).
const POWERUP = [
  '..kLLLLLLLLk..',
  '.kLLLLLLLLLLk.',
  'kLLlLLLLLLlLLk',
  'kLLLWLLLLWLLLk',
  'kLLLWLLLLWLLLk',
  'kLLWWWLLWWWLLk',
  'kLLWEWLLWEWLLk',
  'kLLWEWLLWEWLLk',
  'kLLLWLLLLWLLLk',
  'kLLLWLLLLWLLLk',
  'kLLlLLLLLLlLLk',
  '.kLLLLLLLLLLk.',
  '..kLLLLLLLLk..',
  '....kLLLLk....',
];

// Explosion — 4 authored frames (16x16 each): flash -> bloom -> ring -> fade.
const EXPLO_1 = [
  '................',
  '................',
  '................',
  '................',
  '.......WW.......',
  '......WOOW......',
  '......WOOW......',
  '.....WOAAOW.....',
  '.....WOAAOW.....',
  '......WOOW......',
  '......WOOW......',
  '.......WW.......',
  '................',
  '................',
  '................',
  '................',
];
const EXPLO_2 = [
  '................',
  '................',
  '......WWWW......',
  '.....WOOOOW.....',
  '....WOAAAAOW....',
  '...WOAAWWAAOW...',
  '..WOAAWRRWAAOW..',
  '..WOAWRRRRWAOW..',
  '..WOAWRRRRWAOW..',
  '..WOAAWRRWAAOW..',
  '...WOAAWWAAOW...',
  '....WOAAAAOW....',
  '.....WOOOOW.....',
  '......WWWW......',
  '................',
  '................',
];
const EXPLO_3 = [
  '................',
  '....O......O....',
  '..O..AWWWWA..O..',
  '....AOaRRaOA....',
  '..AWaR.  .RaWA..',
  '.OWR.      .RWO.',
  '.WA.        .AW.',
  'OR.          .RO',
  'OR.          .RO',
  '.WA.        .AW.',
  '.OWR.      .RWO.',
  '..AWaR.  .RaWA..',
  '....AOaRRaOA....',
  '..O..AWWWWA..O..',
  '....O......O....',
  '................',
];
const EXPLO_4 = [
  '..O..........O..',
  '................',
  '.....a....a.....',
  '...a...RR...a...',
  '.......  .......',
  '..a...    ...a..',
  '.....      .....',
  '...R.      .R...',
  '...R.      .R...',
  '.....      .....',
  '..a...    ...a..',
  '.......  .......',
  '...a...RR...a...',
  '.....a....a.....',
  '................',
  '..O..........O..',
];

// --- Sprite table ------------------------------------------------------------
// order here is also the sheet packing order. `frames` says how many horizontal
// frames to emit; multi-grid entries (explosion) supply per-frame grids.
const SPRITE_DEFS = {
  player: { grid: PLAYER, frames: 2 },
  drone: { grid: DRONE, frames: 2 },
  darter: { grid: DARTER, frames: 2 },
  weaver: { grid: WEAVER, frames: 2 },
  tank: { grid: TANK, frames: 2 },
  splitter: { grid: SPLITTER, frames: 2 },
  miner: { grid: MINER, frames: 2 },
  boss: { grid: BOSS, frames: 2 },
  bulletPlayer: { grid: BULLET_PLAYER, frames: 2 },
  bulletEnemy: { grid: BULLET_ENEMY, frames: 2 },
  mine: { grid: MINE, frames: 2 },
  powerup: { grid: POWERUP, frames: 2 },
  explosion: { grids: [EXPLO_1, EXPLO_2, EXPLO_3, EXPLO_4], frames: 4 },
};

// --- Builder -----------------------------------------------------------------
const SHEET_WIDTH = 512;
const GAP = 2; // transparent gap between packed blocks

function gridDims(grid) {
  const h = grid.length;
  let w = 0;
  for (const row of grid) w = Math.max(w, row.length);
  return { w, h };
}

function paintGrid(ctx, grid, ox, oy, frameIndex, white) {
  const engineColor = ENGINE_FRAMES[frameIndex % ENGINE_FRAMES.length];
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const color = ch === 'E' ? engineColor : PALETTE[ch];
      if (!color) continue; // unknown char -> transparent
      // white: paint the sprite's silhouette (same outline, all-white pixels)
      ctx.fillStyle = white ? '#ffffff' : color;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

function createCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function build() {
  // Flatten defs into paint blocks: each sprite's animation frames, plus a
  // one-frame all-white silhouette ("flash") variant drawn during hit-flash so
  // the flash matches the sprite's outline instead of its bounding rectangle.
  const blocks = [];
  for (const [name, def] of Object.entries(SPRITE_DEFS)) {
    const grids = def.grids || [def.grid];
    blocks.push({ key: name, name, grids, frames: def.frames, white: false });
    blocks.push({ key: name + '@flash', name, grids: [grids[0]], frames: 1, white: true });
  }

  // First pass: lay blocks out to compute total height.
  const layout = {};
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  for (const block of blocks) {
    const { w, h } = gridDims(block.grids[0]);
    const blockW = w * block.frames + GAP;
    if (cursorX + blockW > SHEET_WIDTH) {
      cursorX = 0;
      cursorY += rowHeight + GAP;
      rowHeight = 0;
    }
    layout[block.key] = { x: cursorX, y: cursorY, w, h, frames: block.frames };
    cursorX += blockW;
    rowHeight = Math.max(rowHeight, h);
  }
  const sheetHeight = cursorY + rowHeight + GAP;

  const canvas = createCanvas(SHEET_WIDTH, sheetHeight);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Second pass: paint each frame.
  const sprites = {};
  for (const block of blocks) {
    const info = layout[block.key];
    for (let f = 0; f < block.frames; f++) {
      const grid = block.grids[f] || block.grids[0];
      paintGrid(ctx, grid, info.x + f * info.w, info.y, f, block.white);
    }
    if (block.white) {
      // Attach the silhouette's sheet origin to its sprite's metadata.
      sprites[block.name].flash = { x: info.x, y: info.y };
    } else {
      // Exported metadata: sheet origin, per-frame size, frame count, and the
      // horizontal stride between frames (== w). Consumers build a TileInfo per
      // frame at { x: info.x + frame * info.w, y: info.y, w: info.w, h: info.h }.
      sprites[block.name] = {
        x: info.x,
        y: info.y,
        w: info.w,
        h: info.h,
        frames: info.frames,
      };
    }
  }

  return { canvas, sprites, width: SHEET_WIDTH, height: sheetHeight };
}

// Built once and cached; the sheet is deterministic.
let cached = null;

/**
 * Build (once) and return the runtime sprite sheet.
 * @returns {{ canvas: OffscreenCanvas|HTMLCanvasElement,
 *   sprites: Record<string, {x:number,y:number,w:number,h:number,frames:number}>,
 *   width: number, height: number }}
 */
export function buildSpriteSheet() {
  if (!cached) cached = build();
  return cached;
}

export { PALETTE };
