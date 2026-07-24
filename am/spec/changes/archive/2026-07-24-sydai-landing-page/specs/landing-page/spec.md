## ADDED Requirements

### Requirement: Crossfading headline
id: landing-text-crossfade

The system SHALL display the text "SydAI" in a large display font (Orbitron,
`clamp(4rem, 14vw, 11rem)`), and SHALL crossfade between "SydAI" and
"Coming soon" in an infinite loop: each text held fully visible for 10 seconds,
each crossfade lasting 3 seconds, implemented with pure CSS keyframes on two
stacked layers.

#### Scenario: Loop timing
- **WHEN** the page has been open for one full cycle (26 seconds)
- **THEN** "SydAI" was fully visible for 10s, faded out over 3s, "Coming soon"
  was fully visible for 10s, and faded back over 3s, and the cycle repeats

#### Scenario: JavaScript disabled
- **WHEN** the page loads with JavaScript disabled
- **THEN** the crossfade still runs, because it is CSS-only

### Requirement: Cybernetic animated background
id: landing-background

The system SHALL render a fixed dark layered gradient background — a deep
navy→indigo→violet→petrol linear base with two large soft radial color glows
(violet and cyan/teal, alpha ≤ 0.25) drifting on slow (~40s) loops — and SHALL
overlay a subtle canvas-based particle network (~60 drifting points with faint
cyan lines between nearby points, overall opacity ≤ 0.35) behind the headline
text. Approximately one in four points SHALL render as a glow point: a soft
radial-gradient halo ~6× the core dot radius whose intensity pulses slowly
(~6s, per-point phase offset), implemented without canvas `shadowBlur`.

#### Scenario: Background layering
- **WHEN** the page renders
- **THEN** the gradient is the bottom layer, the canvas network sits above it,
  and the headline text sits above both and remains fully legible

#### Scenario: Window resize
- **WHEN** the browser window is resized
- **THEN** the canvas resizes to fill the viewport without distortion, and the
  existing particle field is preserved (positions rescaled proportionally, never
  re-randomized), so the background never visibly resets

#### Scenario: Glow points pulse subtly
- **WHEN** the particle network is running
- **THEN** roughly a quarter of the points show a soft pulsing halo, each on
  its own phase, while the headline text remains fully legible

### Requirement: Reduced motion support
id: landing-reduced-motion

If the visitor's system sets `prefers-reduced-motion: reduce`, then the system
SHALL disable the crossfade (leaving "SydAI" visible) and SHALL NOT start the
canvas animation loop.

#### Scenario: Reduced motion visitor
- **WHEN** a visitor with `prefers-reduced-motion: reduce` opens the page
- **THEN** the page shows the static gradient and a static "SydAI" headline
  with no running animations

### Requirement: Static Astro build
id: landing-static-build

The system SHALL be an Astro 5 project with no UI-framework integrations, where
`npm run build` produces a fully static site in `dist/` containing the landing
page as `index.html`.

#### Scenario: Production build
- **WHEN** `npm install` and `npm run build` are run at the repo root
- **THEN** the build exits 0 and `dist/index.html` exists and contains the
  "SydAI" headline markup
