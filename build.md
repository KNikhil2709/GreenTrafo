# Build

Use Node 24 and `npm ci` for the pinned production toolchain.

```bash
npm run build
npm test
npm run preview
```

`npm run build` runs two stages:

1. `build.js` preserves the legacy concatenated `index.html` / `greentrafo.html` preview.
   It combines `src/head.html`, the engine and optimiser (stripping module syntax and
   renaming the optimiser RNG helper), and the JSX UI. This legacy preview still uses CDN
   React/Babel and is the source of the engine regression harness.
2. `scripts/build-production.cjs` creates the deployable `dist/`. It embeds that exact
   tested engine, bundles React 18 and precompiles/minifies JSX with esbuild, embeds local
   Inter fonts, removes CDN scripts/font links, and adds a script-hash CSP. Each HTML file
   is self-contained so a release switch cannot strand clients with missing JS chunks.
   The artifact also includes health/revision/build identity, a 404 page and font licence.

The production output is ignored by Git and built from the lockfile in CI. Never deploy
repository source as the public document root. Docker and Vercel serve only `dist/`.
`npm run vercel:package` packages an already-tested artifact as Build Output API v3;
CI downloads the verified artifact instead of rebuilding before promotion.

All engine/feature regressions run with `npm test`. The production test checks exact
engine parity, script CSP hashes, output-file allowlisting and absence of runtime CDNs.
Release-gate tests ensure failed checks and stale commits cannot promote.

See [deployment instructions](docs/DEPLOYMENT.md) for Docker, browser verification,
Vercel linking, CI/CD and rollback. The TDD's Python/FastAPI backend is future work.
