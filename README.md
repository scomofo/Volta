# VOLTA

A Minimoog-style monophonic analog synthesizer web app. Three VCOs
(triangle/saw/square/pulse, 32′–2′ footage + LO) plus noise run through a Moog
ladder filter implemented as an `AudioWorkletProcessor`, with ADSR envelopes,
glide, a zustand-driven control surface, a live oscilloscope and level meter,
and both an on-screen keyboard and computer-keyboard play. Web MIDI input is
supported: MIDI keyboards play with real velocity, and any knob can be mapped
to a MIDI CC via the MIDI learn button. The Velocity knob (Loudness section)
scales how much note velocity opens the amplitude and the filter cutoff; at
zero the engine behaves exactly as before.

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

It also runs the patch-bank acceptance suite against the production build in
Chromium and retains screenshots and a JSON verdict as the `patch-bank-browser`
Actions artifact. To run the same check locally:

```sh
npx playwright install chromium
npm run build
npm run preview:restart
npm run test:browser
```

The suite drives keyboard save/export/import/load controls, validates the actual
download and saved slot contents, checks rejection/cancellation and simulated
storage failure, reloads the bank, and measures the real Web Audio analyser after
loading each imported sound. It also covers the stale USER selection regression:
replacing a bank leaves a previously loaded USER sound playing as Manual until
another patch is loaded; factory preset identity is preserved. Native confirmation responses are supplied through Playwright's
dialog API. This is automated browser acceptance, not a listening or screen-reader
audition.

Use `npm run test:browser -- http://127.0.0.1:8085/` for the dev server.
`BROWSER_EXECUTABLE_PATH` selects an existing Chromium executable, and
`BROWSER_EVIDENCE_DIR` selects the evidence folder (default `screenshots/patch-bank`).
Unavailable external fonts/host chrome are reported separately; application
errors and same-origin failures still fail the check.
