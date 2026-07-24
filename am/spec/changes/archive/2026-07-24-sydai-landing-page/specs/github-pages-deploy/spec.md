## ADDED Requirements

### Requirement: Pages deploy workflow
id: pages-deploy-workflow

When a commit is pushed to `main`, the system SHALL build the site and deploy
it to GitHub Pages via a GitHub Actions workflow at
`.github/workflows/deploy.yml` using `withastro/action@v3` and
`actions/deploy-pages@v4`, with `pages: write` and `id-token: write`
permissions.

#### Scenario: Push to main deploys
- **WHEN** a commit lands on `main`
- **THEN** the workflow builds the Astro site and publishes the result to the
  repository's GitHub Pages environment

#### Scenario: Other branches do not deploy
- **WHEN** a commit is pushed to a non-`main` branch
- **THEN** no Pages deployment is triggered

### Requirement: Custom domain configuration
id: pages-custom-domain

The system SHALL include a `public/CNAME` file containing exactly `sydai.org`
so the deployed artifact carries the custom domain, and `astro.config.mjs`
SHALL set `site: 'https://sydai.org'`.

#### Scenario: CNAME survives the build
- **WHEN** `npm run build` completes
- **THEN** `dist/CNAME` exists and contains `sydai.org`
