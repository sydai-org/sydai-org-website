## 1. Scaffold

- [x] 1.1 Create the Astro project skeleton at the repo root: `package.json`
      (name `sydai-org-website`, private, scripts `dev`/`build`/`preview`,
      devDependency `astro` ^5), `astro.config.mjs` with
      `site: 'https://sydai.org'`, `tsconfig.json` extending
      `astro/tsconfigs/base`, and an empty `src/pages/` directory. Ensure the
      existing `.gitignore` covers `node_modules/`, `dist/`, and `.astro/` —
      append them if missing.

## 2. Page and deploy (parallel)

- [x] 2.1 [P2] Create `src/pages/index.astro` implementing the landing page
      exactly per `am/spec/changes/sydai-landing-page/plan.md` ## Implementation:
      Orbitron Google Fonts link; two stacked centered text layers "SydAI" and
      "Coming soon" with the 26s CSS crossfade keyframes (10s hold, 3s fade);
      layered gradient background with slow drift; full-viewport canvas particle
      network (~60 points, faint cyan connecting lines, alpha ≤ 0.35) via an
      inline vanilla-JS script; `prefers-reduced-motion` handling for both the
      crossfade and the canvas; page `<title>` "SydAI" and a meta description.
- [x] 2.2 [P2] Create `public/CNAME` containing exactly `sydai.org` (single
      line), `public/favicon.svg` (simple dark-background "S" mark in cyan),
      and `.github/workflows/deploy.yml` deploying to GitHub Pages on push to
      `main` using `withastro/action@v3` then `actions/deploy-pages@v4`, with
      an environment `github-pages` and permissions `contents: read`,
      `pages: write`, `id-token: write`.

## 3. Build verification

- [x] 3.1 Run `npm install` then `npm run build` at the repo root; fix any
      build errors in the files above until the build exits 0 and
      `dist/index.html` and `dist/CNAME` both exist.

## 4. Background polish

- [x] 4.1 In `src/pages/index.astro`, rework the background per the revised
      `plan.md` ## Implementation: replace the base gradient with the layered
      `linear-gradient(160deg, #04050e 0%, #0c0f2e 35%, #1c1148 62%, #05283a
      100%)` plus two large soft radial-gradient glow layers (violet upper-left,
      cyan/teal lower-right, alpha ≤ 0.25, ~80vmax) drifting on alternating
      ~40s keyframe loops; and in the canvas script make ~1 in 4 points glow
      points — a radial-gradient halo sprite ~6× the core dot radius pulsing on
      a ~6s sine with per-point phase offset (no `shadowBlur`). Keep line alpha
      ≤ 0.35, keep text legible, and keep `prefers-reduced-motion` behavior
      (no canvas loop, no drift) intact.
- [x] 4.2 Run `npm run build` at the repo root and confirm it exits 0 with
      `dist/index.html` present.

## 5. Steady background across resize

- [x] 5.1 In `src/pages/index.astro`, make the canvas resize handler preserve
      the particle field instead of reseeding: capture the old width/height in
      `resize()`, scale every existing point's `x`/`y` by the new/old dimension
      ratios, and call `seed()` only once at startup (remove `seed()` from the
      resize listener; guard the rescale against zero/unset old dimensions on
      first run). Change nothing else.
- [x] 5.2 Run `npm run build` at the repo root and confirm it exits 0 with
      `dist/index.html` present.
