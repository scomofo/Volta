# VOLTA

A Minimoog-style monophonic analog synthesizer web app. Three VCOs
(triangle/saw/square/pulse, 32′–2′ footage + LO) plus noise run through a Moog
ladder filter implemented as an `AudioWorkletProcessor`, with ADSR envelopes,
glide, a zustand-driven control surface, a live oscilloscope and level meter,
and both an on-screen keyboard and computer-keyboard play. Web MIDI input is
supported: MIDI keyboards play with real velocity, and any knob can be mapped
to a MIDI CC via the MIDI learn button. The Velocity knob (Loudness section)
scales how much note velocity opens the amplitude and the filter cutoff; at
zero the engine behaves exactly as before. The Record button in the header
bounces a take to a 16-bit WAV file (`volta-<patch>-<timestamp>.wav`): it
captures the master output exactly as heard, up to a 5:00 limit.

## Cantabile vocal companion

The [Cantabile vocal companion](https://github.com/scomofo/cantabile) —
included here as a submodule at `tools/cantabile` — adds a separate local choir
and vocal editor: 20 recorded singers, editable voice baselines, solo/ensemble
parts, syllable sequencing, microphone/WAV input and render-first pitch correction.
It runs with Python on your computer; it is not a route in the hosted Volta app.
Volta's browser synth and Cantabile produce separate WAV files for arranging in a
DAW or sampler — and the **live link** connects them in real time: enable
**Choir link** in Volta's header, pick a MIDI output port, and run
`python live.py` in `tools/cantabile` so the recorded singers sing your notes
as you play. See [LIVE_LINK.md](tools/cantabile/LIVE_LINK.md) for setup.

On Windows, open `tools/cantabile`, run `setup-bank-only-windows.bat`, then
`start-windows.bat`. The recorded vowel bank is included. For voices that sing
provided lyrics, run `setup-voices-windows.bat` afterwards (about 1.1 GB download).
The [third-party terms](tools/cantabile/THIRD_PARTY.md) distinguish the attributed
CC BY 4.0 sample bank from the separately downloaded neural dependencies, which
include noncommercial restrictions.

Cantabile has its own [checks and limitations](tools/cantabile/VERIFICATION.md)
and CI workflow. No model weights, microphone imports or render caches are
committed. The sample bank uses 20 compressed singer bundles. Windows setup unpacks them
locally; on other systems run `python prepare_bank.py` in `tools/cantabile`
before starting the app or loading the SFZ files.

## Stack

- [TanStack Start](https://tanstack.com/start) (React 19, Vite 8, file-based routes)
- Tailwind CSS 4, Radix UI, zustand, zod
- better-auth + PGlite/Kysely (auth is currently **off**: `VITE_AUTH_ENABLED=false`)
- Web Audio: `AudioWorkletProcessor` Moog ladder filter (`src/lib/synth/engine.ts`)

## Development

```sh
npm ci
npm run dev
```

The Vite dev server listens on port 8085 on all interfaces: open
<http://localhost:8085/>.

## Checks

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

`npm test` runs the node:test script suite plus the TS unit tests, `npm run lint`
(eslint) must stay at 0 errors / 0 warnings, and `npm run typecheck` is
`tsc --noEmit`. `npm run build` runs `db:migrate` after the production build;
without `DATABASE_URL` the migration step skips cleanly (the PGlite fallback
migrates itself).

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
