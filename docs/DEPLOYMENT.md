# Deploy GreenTrafo

This deploys the **current browser-only prototype**. There is no FastAPI service,
database, charger integration or server-side optimiser yet. Vercel serves static files;
it does not run this Docker container. Docker is an alternative local/self-hosted runtime.

## Production build

Use Node **24** (also recorded in `.nvmrc`):

```bash
npm ci
npm run build
npm test
npm run preview
```

Open `http://127.0.0.1:3000`. `dist/` contains two identical HTML entry points, a 404
page, font licence and `health.json`. React, compiled UI and Inter fonts are embedded;
there are no runtime CDN requests, Babel compilation, separate chunk downloads or secrets.
The engine is byte-identical to the engine exercised by the existing regressions.
HTML is revalidated on every visit. The CSP permits only the exact built script hashes;
inline styles remain allowed for React's dynamic SVG/chart styles.

`health.json` reports status, commit revision (when built in CI) and a content-derived
build ID. It establishes which static release is being served, not power-grid health.
Open browser tabs continue their current in-memory simulation after a deployment;
refresh loads the new release and resets unsaved simulation state.

## Docker

```bash
docker compose up -d --build --wait
docker compose ps
curl --fail http://127.0.0.1:8080/health.json
docker compose logs -f
```

Open `http://127.0.0.1:8080`. Stop with `docker compose down`.
Optional overrides: `PORT=8081 IMAGE_TAG=my-release REVISION=my-commit docker compose up -d --build --wait`.
Compose binds to localhost deliberately; a public self-hosted installation needs a TLS
reverse proxy. The multi-stage image pins base-image digests, runs Nginx as UID 101,
uses a read-only filesystem with bounded temporary storage, drops capabilities, disables
privilege escalation and provides a health check, graceful shutdown and JSON access logs.
Node and build dependencies are absent from the runtime image. Dependabot proposes image
and dependency updates; merge them only after CI passes.

**A single Compose container does not provide zero-downtime replacement.** Use Vercel's
staged promotion below for this project. A Docker production host would additionally need
multiple healthy replicas and a load balancer/rolling or blue-green rollout; this repository
does not configure or claim to have tested such a host.

## Connect Vercel once

The recommended path creates/links a project without publishing an untested release:

1. Push this change and merge it to `main` after the **Production checks** job passes.
   The deploy job initially skips because `VERCEL_DEPLOY_ENABLED` is unset.
2. With Node 24 installed, run:

   ```bash
   npx vercel@62.2.0 login
   npx vercel@62.2.0 link
   ```

   Select your account/team, link an existing project or create `greentrafo`, and use
   the repository root. Linking alone does not deploy. Do not commit `.vercel/`.
3. In Vercel Project Settings set framework **Other**, Node **24.x**, root directory `.`.
   `vercel.json` defines install `npm ci`, build `npm run build`, output `dist`.
   No application environment variables are needed. Leave Vercel Git auto-deployment
   disabled (`git.deploymentEnabled: false`); GitHub Actions owns the gated release.
   You may connect the GitHub repo in Vercel Settings → Git, but do not remove that flag.
4. Create a Vercel access token for the selected account/team. In GitHub repository
   Settings → Secrets and variables → Actions, add these **secrets**:

   | Secret | Value |
   | --- | --- |
   | `VERCEL_TOKEN` | Your Vercel access token |
   | `VERCEL_ORG_ID` | `orgId` from local `.vercel/project.json` |
   | `VERCEL_PROJECT_ID` | `projectId` from that file |
   | `VERCEL_AUTOMATION_BYPASS_SECRET` | Protection Bypass for Automation secret, if staged URLs are protected |

   Never put these in application source, `dist/`, or `NEXT_PUBLIC_*` variables.
   Vercel's Deployment Protection settings provide the bypass secret. If protection is
   enabled without a bypass, staged checks fail and production is **not** promoted.
   Disable the Vercel Toolbar for this project so the tested page remains self-contained.
5. Create the GitHub **production** environment, restrict it to `main`, and optionally
   require a reviewer. Protect `main` with pull requests and the **Production checks**
   required status. Add the repository **variable** `VERCEL_DEPLOY_ENABLED` = `true`.
6. GitHub Actions → **Verify and deploy** → **Run workflow** → branch `main`.
   Subsequent pushes/merges to `main` use the same pipeline. If you use another production
   branch, update the workflow trigger/condition and both `main` checks in the release
   script/environment policy together. PRs run checks without deployment credentials.

## Release sequence and availability

1. Clean locked install; production build; engine, artifact and release-gate tests.
2. Build/start Docker and wait for health. Check release identity, cache/security headers,
   missing/private paths, and a real Plan → Protect → Validate flow with external requests blocked.
3. Run all five browser suites against the container, including full-site desktop/mobile
   coverage. Save screenshots and the tested static artifact.
4. Download that exact artifact in the separate production job; package it as Vercel
   Build Output API v3. No rebuild occurs between testing and release.
5. `vercel deploy --prebuilt --prod --skip-domain` creates a staged production deployment.
   Production domains still serve the existing release. Check the staged URL's exact build
   identity, files, headers and browser flow; only then call `vercel promote`.

Release jobs are serialised without cancelling a promotion halfway through. Stale commits
are checked before staging and again before promotion. Failed builds or staged checks
leave the previous release in place. Embedded scripts/fonts avoid missing old chunks
during a release switch. The **first** release has no previous site to preserve.

This is a deployment-time availability strategy, not a guarantee against provider/DNS
outages or application bugs. No live Vercel promotion or rollback can be verified until
the project and credentials are configured. GitHub-hosted workflow execution is also
verified only once the committed workflow runs there.

## Rollback and observation

If a released version causes a problem, use Vercel → Deployments → the previous known-good
production deployment → **Instant Rollback**, or from your linked checkout:

```bash
npx vercel@62.2.0 rollback https://YOUR-PREVIOUS-DEPLOYMENT.vercel.app --yes
```

Retain the previous successful deployments in Vercel; rollback needs them. Temporarily set
`VERCEL_DEPLOY_ENABLED=false` while investigating, then revert/fix the commit and re-enable.
Test `/health.json`, Plan, Protect and Validate on the public domain after the first
promotion and rollback. Configure an external uptime monitor for that domain's health URL
and check its revision/build ID. CI logs and its run summary record staging/promotion;
Vercel provides deployment history and request monitoring. No uptime alert service is
provisioned by this repository.

## Repeat browser verification locally

```bash
npx playwright install chromium
npm run test:deployment                         # running Docker on port 8080
BASE_URL=http://127.0.0.1:8080 npm run test:browser
```

For a visible demonstration, open Chrome with a separate profile and a debugging port:

```bash
google-chrome --user-data-dir=/tmp/greentrafo-demo --remote-debugging-port=9222 http://127.0.0.1:8080
BASE_URL=http://127.0.0.1:8080 CDP_URL=http://127.0.0.1:9222 npm run test:browser
```

Without `CDP_URL`, the runner starts its own headless Chromium and stops it afterward.
The suite writes screenshots to `/tmp/greentrafo-*.png`. Keep remote debugging bound to
localhost. To test a protected Vercel URL, set `BASE_URL` and the bypass secret when
running `npm run test:deployment`; do not paste secrets into shell history.

## References

- [Vercel staged production and promotion](https://vercel.com/docs/deployments/promoting-a-deployment)
- [Vercel deploy flags](https://vercel.com/docs/cli/deploy)
- [Vercel Build Output API](https://vercel.com/docs/build-output-api)
- [Disable competing Git deployments](https://vercel.com/docs/project-configuration/git-configuration)
- [Vercel automation protection bypass](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)
- [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
