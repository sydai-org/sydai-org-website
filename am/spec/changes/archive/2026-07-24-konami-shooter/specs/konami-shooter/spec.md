## ADDED Requirements

### Requirement: Hidden trigger
id: shooter-hidden-trigger

The system SHALL detect the Konami code (Up, Up, Down, Down, Left, Right,
Left, Right, B, A) via keyboard on the landing page, and SHALL detect a single
three-finger tap on touch screens. When either occurs, the system SHALL fade
the gradient background to black and fade out the headline text (~1.2s) while
the particle-network canvas keeps running uninterrupted, and SHALL then start
the shooter on top of the live particle field. While the game is open, further
trigger inputs SHALL be ignored.

#### Scenario: Konami code on desktop
- **WHEN** a visitor types ↑↑↓↓←→←→BA on the landing page
- **THEN** the gradient fades to black, the headline fades out, the particles
  keep drifting, and the shooter begins

#### Scenario: Three-finger tap on mobile
- **WHEN** a visitor taps the landing page with three fingers simultaneously
- **THEN** the same fade-to-game transition occurs

#### Scenario: Mistyped sequence
- **WHEN** a visitor types a key sequence that deviates from the Konami code
- **THEN** the matcher resets and nothing visible happens

### Requirement: On-demand game loading
id: shooter-lazy-load

The system SHALL load the game engine (LittleJS) and all game code as a
separate lazily-imported chunk fetched only when a trigger fires; the landing
page's initial load SHALL contain no game or engine code beyond the trigger
listener.

#### Scenario: Initial page load stays clean
- **WHEN** the landing page loads normally
- **THEN** no game/engine JavaScript chunk is fetched

#### Scenario: Chunk fetched at trigger time
- **WHEN** a trigger fires for the first time
- **THEN** the game chunk is imported dynamically and the game starts once
  loaded

### Requirement: Arcade entrance choreography
id: shooter-arcade-entrance

The system SHALL render the game on a transparent canvas so the site's
particle network remains visible behind and beside the playfield. After the
fade transition, the player ship SHALL enter from below the bottom edge and
ease up to its anchored position (~0.9s) with input and auto-fire disabled
until it arrives; level 1 SHALL begin only then, with its first enemies
streaming down from above the top edge. Enemies SHALL always enter from
off-screen (top, or sides for the miner), never appearing mid-screen.

#### Scenario: Player rises from the bottom
- **WHEN** the game starts after the fade
- **THEN** the ship glides up from below the screen edge, and firing begins
  only once it reaches its position

#### Scenario: Baddies descend from the top
- **WHEN** level 1 begins
- **THEN** the first wave enters from above the top edge, Galaga-style, over
  the still-drifting particle background

### Requirement: Galaga-style gameplay
id: shooter-gameplay

The system SHALL provide a portrait (540×960 world, letterboxed) vertical
shooter where the player ship moves horizontally at the bottom via arrow/AD
keys or mouse on desktop and touch-drag on mobile, SHALL auto-fire
continuously (no fire button), and SHALL give the player 3 lives. When the
player is hit, the ship SHALL explode (explosion animation + death sound),
enemy bullets SHALL be cleared, and after ~1.2s the ship SHALL re-enter from
below the bottom edge with ~2s of invulnerability blink — or the game-over
screen SHALL show if no lives remain. A double-shot power-up (10s) SHALL drop
from tank and splitter enemies with ~25% probability.

#### Scenario: Player death resets the ship
- **WHEN** the player's ship is hit with lives remaining
- **THEN** it explodes with sound, enemy bullets clear, and after a beat the
  ship rises back in from the bottom, blinking and invulnerable briefly

#### Scenario: Desktop play
- **WHEN** a desktop player moves via keys or mouse
- **THEN** the ship tracks horizontally, firing automatically, in a tall
  centered letterboxed canvas

#### Scenario: Mobile play
- **WHEN** a mobile player drags a finger across the screen
- **THEN** the ship follows the touch x-position and fires automatically

### Requirement: Levels and boss
id: shooter-levels-boss

The system SHALL provide 3 data-driven levels: level 1 with introductory
waves, level 2 with all six enemy types at higher density, and level 3 a boss
fight — a 60 HP mothership with three escalating phases (spread shots, added
aimed bursts, then faster attacks plus drone escorts). Level transitions SHALL
show a "LEVEL n" card; defeat SHALL show a game-over screen and victory a
victory screen, each with score and session-best, returning to the landing
page on tap/key.

#### Scenario: Boss phases escalate
- **WHEN** the level-3 boss drops below ⅔ and ⅓ HP
- **THEN** its attack pattern escalates phase by phase until it explodes in a
  multi-explosion death

#### Scenario: Game over returns home
- **WHEN** the player loses the last life and dismisses the game-over screen
- **THEN** the game fades out and the landing page fades back, animations
  intact

### Requirement: Enemy roster
id: shooter-enemy-roster

The system SHALL include at least six visually and behaviorally distinct
8-bit enemy types: drone (sine descent), darter (fast dive), weaver (zigzag,
fires aimed shots), tank (slow, 3 HP), splitter (splits into two mini-drones
on death), and miner (crosses horizontally laying mines).

#### Scenario: Distinct behaviors observable
- **WHEN** level 2 is played
- **THEN** all six enemy types appear, each with its own sprite and movement
  pattern

### Requirement: 8-bit presentation and audio
id: shooter-presentation-audio

The system SHALL render all game art as runtime-generated pixel sprites (no
image assets, image smoothing off) in a bright neon palette, SHALL NOT display
the engine's debug watermark or version/FPS overlay, and SHALL play
procedural audio: ZzFX sound effects (shoot, hit, explosion, power-up, death,
boss phase) and an upbeat looping ZzFXM chiptune started with the game. A mute
toggle (M key or on-screen icon) SHALL silence all audio; exiting the game
SHALL stop all audio.

#### Scenario: Music starts and stops with the game
- **WHEN** the game starts after a trigger and is later exited
- **THEN** the chiptune loop starts with the game and no game audio remains
  playing after exit

#### Scenario: Mute toggle
- **WHEN** the player presses M or taps the speaker icon
- **THEN** all game audio is silenced until toggled back

### Requirement: Clean exit
id: shooter-clean-exit

The system SHALL provide an exit control (✕ button and Esc key) that stops the
game loop, music, and game input listeners and fades the gradient and headline
back in; the particle canvas SHALL have kept running throughout, and the
landing page SHALL be fully interactive again.

#### Scenario: Mid-game exit
- **WHEN** the player presses Esc during play
- **THEN** the game disappears with a fade and the landing page is fully
  interactive again, including the ability to re-trigger the game
