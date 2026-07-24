# sydai-landing-page
Status: verified

## Idea

The sydai-org-website repo is empty (README only). SydAI needs a public web
presence at https://sydai.org while the full site is being designed. This change
ships a polished single-page "coming soon" landing page and the automation to
host it on GitHub Pages under the custom domain.

- Scaffold a minimal Astro 5 static site in the repo root.
- One landing page: the word **"SydAI"** in a large, distinctive display font,
  crossfading to **"Coming soon"** and back in an infinite loop — hold each text
  10 seconds, crossfade over 3 seconds.
- Background: a dark gradient with a subtle, cybernetic-looking animation
  (drifting node/line network) that respects `prefers-reduced-motion`.
- GitHub Actions workflow deploying to GitHub Pages on push to `main`, with a
  `CNAME` file for `sydai.org`.

Affected capabilities: `landing-page` (added), `github-pages-deploy` (added).
Impact: new files only — `package.json`, `astro.config.mjs`, `tsconfig.json`,
`src/pages/index.astro`, `public/` (favicon, CNAME), `.github/workflows/deploy.yml`.
Dependencies: `astro` (dev). No client-side framework.

## Implementation

Binding decisions — executors must not re-decide these:

- **Astro 5, zero integrations.** The page is one `.astro` file with inline
  `<style>` and one inline `<script>`. Rejected: React/UI framework — needless
  weight for two text layers and a canvas.
- **Crossfade is pure CSS.** Two absolutely-positioned, stacked text layers
  centered in the viewport share one 26s infinite `@keyframes` cycle
  (10s hold + 3s fade + 10s hold + 3s fade). Layer "SydAI" keyframes:
  opacity 1 at 0%–38.46%, fades to 0 by 50%, stays 0 until 88.46%, back to 1 at
  100%. Layer "Coming soon" uses the inverse keyframes (visible 50%–88.46%).
  Use `ease-in-out` between stops. Rejected: JS timers — CSS is
  frame-accurate, cheaper, and keeps working if JS fails.
- **Font: "Orbitron" (weight 500–700) from Google Fonts** via a `<link>` in the
  page head, with `font-display: swap` and fallback stack
  `"Orbitron", "Avenir Next", "Segoe UI", sans-serif`. "SydAI" renders at
  `clamp(4rem, 14vw, 11rem)`; "Coming soon" at roughly half that, letter-spaced.
  Text color near-white with a faint cyan text-shadow glow.
- **Background = layered CSS gradient + canvas network.** Base: a richer
  multi-layer composition — `linear-gradient(160deg, #04050e 0%, #0c0f2e 35%,
  #1c1148 62%, #05283a 100%)` with, above it, two large soft `radial-gradient`
  color glows (violet centered upper-left, cyan/teal centered lower-right, each
  alpha ≤ 0.25, sized ~80vmax) that drift slowly on alternating ~40s keyframe
  loops so the field feels alive without drawing attention. Rejected: single
  flat 3-stop linear gradient — too static/cheap-looking.
  On top: a full-viewport `<canvas>` (z-index between background and text)
  running a vanilla-JS particle network — ~60 slow-drifting points, faint
  cyan/teal lines drawn between points closer than ~140px, global alpha ≤ 0.35
  so it reads as subtle. Roughly 1 in 4 points is a **glow point**: rendered as
  a radial-gradient sprite ~6× the core dot radius fading to transparent, with
  its intensity pulsing slowly (~6s sine, per-point phase offset) between ~40%
  and 100% of a low base alpha. Implemented with canvas radial gradients — never
  `shadowBlur` (too slow per-frame). Canvas resizes with the window. Rejected:
  WebGL/three.js — overkill; CSS-only — cannot get the connected-network
  "cybernetic" look.
- **Reduced motion:** under `prefers-reduced-motion: reduce`, the crossfade
  animation is disabled ("SydAI" stays visible) and the canvas script exits
  before starting its loop.
- **Deploy: official Astro Pages action.** `.github/workflows/deploy.yml` uses
  `withastro/action@v3` + `actions/deploy-pages@v4`, triggered on push to
  `main`, with the standard `pages: write` / `id-token: write` permissions.
  Rejected: committing `dist/` to a branch — the action flow is the maintained
  path.
- **Custom domain:** `public/CNAME` containing exactly `sydai.org` (Astro copies
  `public/` into `dist/`), and `astro.config.mjs` sets
  `site: 'https://sydai.org'`. DNS (four apex A records to GitHub Pages IPs) and
  enabling Pages with source "GitHub Actions" happen at verify time via
  `gh api` / user instruction — they are repo settings, not code.

Risk: repo-level Pages settings may need admin rights the local token lacks;
mitigation — surface exact manual steps during verification. Risk: Google Fonts
outage degrades the font; mitigation — fallback stack keeps layout sane.
