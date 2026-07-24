## 1. Trigger, overlay, and lazy skeleton

- [ ] 1.1 Add `littlejsengine` (^1) to `package.json` devDependencies and run
      `npm install`. In `src/pages/index.astro`, add: a `body.game-active`
      CSS state that fades `.gradient` and `.stage` to opacity 0 over 1.2s
      (body background black; the `#network` particle canvas is NOT faded and
      keeps running); the `div#game-overlay` host (fixed, inset 0, z-index 3,
      **transparent** background, `visibility: hidden` when closed); a
      Konami-code keydown matcher (↑↑↓↓←→←→ba, case-insensitive, resets on
      mismatch) and a `touchstart` three-finger detector
      (`touches.length === 3`); a `launchGame()` that ignores repeat triggers
      while open, adds `game-active`, shows the overlay, dynamically imports
      `../game/index.js` (import started in parallel with the fade), and calls
      `startGame(overlayEl, onExit)` where `onExit` hides the overlay and
      removes `game-active` so gradient/headline fade back. Create
      `src/game/index.js` as a working skeleton: export
      `startGame(container, onExit)` that boots LittleJS in 2D-canvas mode
      (`setGlEnable(false)`) with a fully transparent clear color, canvas
      fixed size 540×960 centered in the container (image smoothing off,
      site particles visible behind/beside it), shows placeholder text
      "SHOOTER OK", and wires Esc + a top-left ✕ button to stop the engine
      loop and call `onExit`. Verify `npm run build` exits 0 and the game code
      is a separate chunk not referenced by the initial page JS.

## 2. Assets (parallel)

- [ ] 2.1 [P2] Create `src/game/sprites.js`: palette-indexed pixel arrays and a
      builder that draws them onto an offscreen canvas sprite sheet (16×16
      tiles, smoothing off) per plan.md — player ship, the 6 enemies (drone,
      darter, weaver, tank, splitter, miner), boss mothership (multi-tile),
      player/enemy bullets, mine, double-shot power-up, 4-frame explosion, and
      2-frame idle variants where specified. Neon palette (cyan/magenta/lime/
      amber on near-black). Export the sheet plus named tile indices/sizes.
- [ ] 2.2 [P2] Create `src/game/audio.js`: ZzFX effect definitions (shoot,
      enemy hit, explosion, power-up, player death, boss phase change), one
      upbeat looping ZzFXM chiptune track, and an API
      `{ play(name), startMusic(), stopMusic(), toggleMute(), muted }` with
      mute silencing everything (session-remembered module variable). Use the
      ZzFX/ZzFXM support bundled with `littlejsengine`.

## 3. Core gameplay

- [ ] 3.1 In `src/game/index.js` (replacing the placeholder scene), implement
      the core loop per plan.md: entrance choreography (player ship enters
      from below the bottom edge easing up to its anchor over ~0.9s, input and
      auto-fire disabled until arrival), bottom-anchored ship with
      horizontal-only movement (←/→ and A/D, mouse-x follow, touch-drag), 5/s
      auto-fire, player/enemy bullet and collision handling, 3 lives with
      respawn invulnerability blink, double-shot power-up pickup (10s timer),
      explosion animations, HUD (score top-left, ship-icon lives top-right,
      mute speaker icon, ✕ exit button), and the audio module wired to all
      events (music starts with game, stops on exit).

## 4. Enemies, levels, boss

- [ ] 4.1 Create `src/game/levels.js` with data-driven wave tables and
      implement the six enemy behaviors from the spec (drone sine descent;
      darter dive at player column; weaver zigzag + aimed shots; tank 3 HP
      slow; splitter → two mini-drones on death; miner horizontal crossing
      laying stationary mines). All spawns enter from off-screen (above the
      top edge; sides for the miner), never mid-screen; level 1 begins only
      after the player's entrance completes, its first wave streaming down
      from the top. Wire levels 1 (intro: drones/darters) and 2 (all six,
      denser), with "LEVEL n" transition cards, tank/splitter ~25% power-up
      drops, and per-enemy scores.
- [ ] 4.2 Implement the level-3 boss per plan.md: 60 HP multi-tile mothership,
      three HP-third phases (sweep spread → + aimed bursts → faster + drone
      escorts), hit-flash, multi-explosion death; then the game-over and
      victory screens showing score + session-best, dismissing back to the
      landing page via tap/key (calling the same exit path).

## 5. Verification

- [ ] 5.1 Run `npm run build`; confirm it exits 0, `dist/index.html` exists,
      the game/engine code is emitted as a separate chunk under `dist/_astro/`
      that is NOT loaded by the initial page (inspect the built index.html and
      chunk imports), and the landing page's own markup/animations are
      unchanged.
