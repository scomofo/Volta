#!/usr/bin/env node
/**
 * Run a command with `.grok/app-env.json` merged into its environment.
 *
 * `dev`, `build` and `preview` all route through this wrapper, so the dev
 * server, the built bundle and the preview server can never disagree about
 * `VITE_AUTH_ENABLED` — a divergence that only shows up as a built-output
 * mismatch long after the fact. Anything that starts Vite directly bypasses it.
 *
 * Only `VITE_`-prefixed keys are honored: the file is a build flag carrier, not
 * a secret store, and only `VITE_` vars reach the browser anyway. A real
 * `process.env` entry always wins, so an explicit override still works.
 *
 * That precedence also means the file governs this workspace only. A deployed
 * build runs with the provider's project env, where the deployer sets
 * `VITE_AUTH_ENABLED` itself (today unconditionally `"true"`), so the deployed
 * flag is the platform's, not this file's.
 *
 * Vite picks the values up because `loadEnv` prefix-matches entries already in
 * `process.env`, which is why the merge has to happen before Vite starts.
 */
import { spawn } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { constants as osConstants } from "node:os";
import { dirname, join, posix, win32 } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_ENV_REL_PATH = ".grok/app-env.json";

const VITE_PREFIX = "VITE_";

/**
 * Parse an app-env document, keeping only `VITE_`-prefixed string entries.
 * Anything unparseable is an empty environment — a workspace without the file
 * must behave exactly like today (auth on, no overrides).
 */
export function parseAppEnv(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {};
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const env = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!key.startsWith(VITE_PREFIX)) continue;
    if (typeof value !== "string") continue;
    env[key] = value;
  }
  return env;
}

/** The app env recorded under `root`, or `{}` when the file is absent. */
export function readAppEnv(root) {
  try {
    return parseAppEnv(readFileSync(join(root, APP_ENV_REL_PATH), "utf8"));
  } catch {
    return {};
  }
}

/** File values under the process environment: an explicit override wins. */
export function mergeAppEnv(appEnv, processEnv) {
  return { ...appEnv, ...processEnv };
}

/**
 * The JavaScript file behind the bin `name` of the project's own
 * `node_modules/<name>` package, or `null` when there is none to run with node.
 *
 * `npm run` finds `vite` as a `node_modules/.bin` shim on PATH, but on Windows
 * that shim is `vite.cmd`, which `spawn` cannot launch without a shell
 * (`spawn vite ENOENT`) — and a shell would re-parse every argument. Running
 * the package's bin file with node skips the shim, so Vite starts the same way
 * on every platform. Only a package that shares its bin's name is looked up
 * (`vite` provides `vite`), and a bin that is not a JavaScript file — a native
 * executable — is left to `spawn`.
 */
export function findPackageBin(root, name) {
  // A bare package name only, so a path-like command never escapes node_modules.
  if (!/^[a-z0-9][\w.-]*$/i.test(name)) return null;
  const pkgDir = join(root, "node_modules", name);
  let bin;
  try {
    ({ bin } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")));
  } catch {
    return null;
  }
  const entry = typeof bin === "string" ? bin : bin?.[name];
  if (typeof entry !== "string" || !/\.[cm]?js$/.test(entry)) return null;
  return join(pkgDir, entry);
}

/**
 * What to spawn for `command args`: a project bin runs as a script under this
 * node (see `findPackageBin`); anything else — an absolute path, a system
 * tool — is spawned as given.
 */
export function resolveCommand(root, command, args) {
  const bin = findPackageBin(root, command);
  return bin ? { file: process.execPath, args: [bin, ...args] } : { file: command, args };
}

/**
 * Whether `file` must be spawned through a shell on `platform`.
 *
 * On Windows a bare command (`vite`, `npm`) needs cmd.exe to resolve the
 * `.cmd` shims that `spawn` cannot launch directly (`spawn vite ENOENT`).
 * An absolute executable path must NEVER go through the shell: with
 * `shell: true` Node concatenates file and args without escaping (DEP0190),
 * so a space in the path — the default `C:\Program Files\nodejs\node.exe` —
 * makes cmd.exe try to run `C:\Program`. Absolute paths in either platform's
 * spelling always bypass the shell.
 */
export function needsShellFor(file, platform = process.platform) {
  if (platform !== "win32") return false;
  return !win32.isAbsolute(file) && !posix.isAbsolute(file);
}

/**
 * Translate a child's `exit` `(code, signal)` into this process's exit status.
 *
 * Do not re-raise the signal with `process.kill(process.pid, signal)`: under
 * qemu-user (amd64 image builds on an arm host) a self-directed signal is
 * routinely delivered as SIGSEGV to the wrong process, which takes down the
 * test worker and fails the image build. `128 + signo` is what a shell reports
 * for a signal-killed command, so a cancelled `vite build` is still a failure.
 */
export function exitStatusFromChild(code, signal) {
  if (signal) {
    const signo = osConstants.signals[signal];
    return 128 + (typeof signo === "number" ? signo : 1);
  }
  return code ?? 1;
}

/** The workspace root (this file lives in `<root>/scripts/`). */
export function projectRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

/**
 * Whether `moduleUrl` is the script node was asked to run.
 *
 * Both sides are resolved through symlinks: node realpaths `import.meta.url`
 * but leaves `process.argv[1]` as typed, so comparing them raw makes a CLI
 * launched through a symlinked path (`/tmp` on macOS) a silent no-op.
 */
export function isMainModule(moduleUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === fileURLToPath(moduleUrl);
  } catch {
    return false;
  }
}

function main(argv) {
  const [command, ...args] = argv;
  if (!command) {
    console.error("usage: node scripts/with-app-env.mjs <command> [args…]");
    process.exit(2);
  }
  const root = projectRoot();
  const env = mergeAppEnv(readAppEnv(root), process.env);
  const target = resolveCommand(root, command, args);
  const child = spawn(target.file, target.args, { stdio: "inherit", env, shell: needsShellFor(target.file) });
  // The dev server is long-running and is stopped by signalling this wrapper.
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => child.kill(signal));
  }
  child.on("error", (err) => {
    // Neither a project bin nor on PATH: usually `npm install` has not run yet.
    const hint = err?.code === "ENOENT" ? " — is it installed? Run `npm install` first." : "";
    console.error(`[with-app-env] failed to run ${command}: ${err?.message || err}${hint}`);
    process.exit(127);
  });
  child.on("exit", (code, signal) => {
    process.exit(exitStatusFromChild(code, signal));
  });
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2));
}
