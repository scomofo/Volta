# VOLTA

A Minimoog-style monophonic analog synthesizer web app. Three VCOs
(triangle/saw/square/pulse, 32′–2′ footage + LO) plus noise run through a Moog
ladder filter implemented as an `AudioWorkletProcessor`, with ADSR envelopes,
glide, a zustand-driven control surface, a live oscilloscope and level meter,
and both an on-screen keyboard and computer-keyboard play.

## Stack

- [TanStack Start](https://tanstack.com/start) (React 19, Vite 8, file-based routes)
- Tailwind CSS 4, Radix UI, zustand, zod
- better-auth + PGlite/Kysely (auth is currently **off**: `VITE_AUTH_ENABLED=false`)
- Web Audio: `AudioWorkletProcessor` Moog ladder filter (`src/lib/synth/engine.ts`)

## Development

```sh
npm ci
npm run dev        # Vite dev server (0.0.0.0:8080)
```

## Checks

```sh
npm test           # node:test script suite + TS unit tests
npm run lint       # eslint (must stay at 0 errors / 0 warnings)
npm run typecheck  # tsc --noEmit
npm run build      # production build, then db:migrate
```

`npm run build` runs `db:migrate` afterwards; without `DATABASE_URL` the
migration step skips cleanly (the PGlite fallback migrates itself).

## Project structure

- `src/routes/` — TanStack Start routes (`/` is the synth UI)
- `src/components/` — UI components
- `src/lib/synth/` — DSP core: worklet engine, note/footage math, parameter store
- `src/lib/og/site.json` — baked share-card identity (title, card art flags)
- `src/lib/auth/`, `src/lib/app-data/` — auth gate + connector-data helpers
- `scripts/` — build/test tooling (PWA head injector, migrations, preview helpers)
- `migrations/` — SQL migrations (PGlite/Postgres via Kysely)
- `server/` — server middleware (PWA injection, auth popup)

## CI

`.github/workflows/ci.yml` runs install, tests, lint, typecheck, and the
production build on pushes to `main`/`scout/**` and on pull requests.
