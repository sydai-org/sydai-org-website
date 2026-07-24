# konami-shooter
Status: ready

## Idea

The SydAI landing page gets a hidden arcade easter egg. Entering the Konami
code (↑↑↓↓←→←→BA) on desktop — or a single three-finger tap on touch screens —
fades the landing page out and fades in a Galaga-style vertical shooter:
8-bit pixel graphics, exciting chiptune music, auto-firing ship, 3 levels, a
boss on level 3, at least 6 distinct enemy types, playable on desktop and
mobile. The game code and engine load **on demand** at trigger time — zero
game bytes in the initial page load.

Affected capabilities: `konami-shooter` (added). `landing-page` is touched in
code (trigger listener + overlay host in `src/pages/index.astro`) but its
existing requirements are unchanged.
Impact: `src/pages/index.astro` (small trigger/overlay addition),
new `src/game/` module (entry + sprites + audio + gameplay), `package.json`
(add `littlejsengine`). No server, no persistence.

## Implementation

Binding decisions — executors must not re-make these:

- **Engine: LittleJS (`littlejsengine` npm package), pinned ^1.x.** Tiny
  (<100KB, zero dependencies), ESM build, hybrid WebGL/canvas renderer, built-in
  keyboard/mouse/touch input, and built-in **ZzFX** (SFX) + **ZzFXM** (music).
  Rejected: Phaser (megabyte-class), Kontra (no music system), Kaplay (heavier,
  no tracker music). Import **only** via dynamic `import('../game/index.js')`
  so Vite emits it as a separate lazy chunk — the landing page's initial JS must
  contain nothing but the trigger listener.
- **Trigger module is inline and tiny.** In `index.astro`'s existing script:
  a keydown sequence matcher for `↑↑↓↓←→←→ba` (case-insensitive, resets on
  mismatch) and a `touchstart` handler firing when `event.touches.length === 3`.
  Either trigger calls one `launchGame()` that (1) adds class `game-active` to
  `<body>`, whose CSS fades `.gradient` to opacity 0 (over the body's black
  background) and `.stage` (headline) to opacity 0, both over 1.2s — the
  particle canvas `#network` is NOT faded and keeps running; (2) shows the
  fixed `div#game-overlay` host (inset 0, z-index 3, **transparent**
  background); (3) awaits the dynamic import (started in parallel with the
  fade), then calls `startGame(overlayEl, onExit)`. `onExit` hides the overlay
  and removes `game-active` so gradient and headline fade back in. Repeat
  triggers while open are ignored.
- **Transparent game canvas over the live particle field.** Run LittleJS in
  2D-canvas mode (`setGlEnable(false)` — ample performance for this game) with
  a fully transparent clear color (`setCanvasClearColor` with alpha 0, or
  equivalent transparent-clear override), so the site's drifting particle
  network stays visible behind and beside the gameplay. On desktop the
  letterbox areas therefore show the live particle field, not black bars.
- **Galaga-style entrance choreography.** After the 1.2s gradient/text fade:
  the player ship enters from below the bottom edge and eases up to its
  anchored position over ~0.9s (input and auto-fire disabled until it
  arrives); only then does level 1 begin, its first enemies streaming down
  from above the top edge. All enemy spawns throughout the game enter from
  above the top edge (or the sides for the miner), never popping in
  mid-screen. Game-over/victory dismissal and ✕/Esc all route through the same
  exit path (fade-back).
- **Game entry contract:** `src/game/index.js` exports
  `startGame(container, onExit)`. All LittleJS usage lives under `src/game/`.
- **Playfield: fixed portrait world, letterboxed.** LittleJS
  `setCanvasFixedSize` at **540×960** (9:16). Mobile portrait: fills the
  screen. Desktop: tall centered canvas, the flanks showing the live particle
  background — the "tall on desktop" consistency the request asks for.
- **Controls:** ship is bottom-anchored, moves horizontally only (Galaga).
  Desktop: ←/→ or A/D, and mouse-x follows. Touch: drag anywhere to steer
  (ship follows touch x). **Auto-fire** at 5 shots/sec, no fire button. One
  power-up type: **double-shot** (10s), dropped by tank and splitter enemies
  (~25% chance). Player has 3 lives, brief invulnerability blink on respawn.
- **Sprites: runtime-generated pixel art, no image assets.** Each sprite is a
  small palette-indexed 2D array in `src/game/sprites.js`, drawn once onto an
  offscreen canvas assembled into a sprite sheet (16×16 tiles), passed to the
  engine as its texture; image smoothing off so pixels stay crisp. Bright
  neon palette (cyan/magenta/lime/amber on near-black) matching the site's
  cyan/violet identity. Explosion = 4-frame animation. 2-frame idle animation
  per enemy where it reads well.
- **Enemy roster (6 types + boss), each with distinct sprite and behavior:**
  1. *Drone* — sine-wave descent, 1 HP;
  2. *Darter* — fast straight dive at player's column, 1 HP;
  3. *Weaver* — zigzag descent, fires single aimed shots, 1 HP;
  4. *Tank* — slow descent, 3 HP, may drop power-up;
  5. *Splitter* — on death splits into two fast mini-drones, 1 HP;
  6. *Miner* — crosses horizontally laying stationary mines, 1 HP.
  **Boss (level 3):** screen-wide 8-bit mothership, 60 HP, three phases by HP
  thirds — (a) sweeping spread shots, (b) adds aimed bursts, (c) faster + spawns
  drone escorts. Flashes on hit; big multi-explosion death.
- **Levels are data-driven wave tables** in `src/game/levels.js`: level 1 =
  drones/darters (intro pacing); level 2 = all six types, denser; level 3 =
  boss + occasional escorts. Between levels: 2s "LEVEL n" card. Game over and
  victory screens show score + "best this session" (module-scope variable, no
  storage) and return to the landing page on tap/key/Esc.
- **Audio: all procedural.** ZzFX effects (shoot, enemy hit, explosion,
  power-up, player death, boss phase); one upbeat ZzFXM chiptune loop composed
  in `src/game/audio.js`, started on game start (safe — the trigger is a user
  gesture), stopped on exit. Mute toggle (M key / speaker icon top-right),
  session-remembered in a module variable.
- **HUD:** LittleJS text rendering — score top-left, lives as ship icons
  top-right under the mute icon, level indicator during cards. Exit via ✕
  button (top-left) or Esc — both call `onExit`.
- **Cleanup contract:** exiting must stop the engine loop, music, and input
  listeners, hide the overlay, and remove `game-active` so the gradient and
  headline fade back. The landing page is never unloaded and its particle
  canvas never stops — it runs continuously beneath the whole session.

Risk: LittleJS engine lifecycle (start/stop per overlay session) — mitigated by
keeping the overlay and engine instance alive after first launch and
show/hide + pause on subsequent triggers. Risk: 3-finger tap collides with OS
gestures on some devices — acceptable for an easter egg; the code path is a
plain `touchstart` check, nothing preventing default elsewhere.
