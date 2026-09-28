import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import {
  APP_ENV_REL_PATH,
  findPackageBin,
  mergeAppEnv,
  parseAppEnv,
  projectRoot,
  readAppEnv,
  resolveCommand,
} from "./with-app-env.mjs";

const execFileAsync = promisify(execFile);
const WRAPPER = join(projectRoot(), "scripts/with-app-env.mjs");
const PRINT_FLAG = "process.stdout.write(String(process.env.VITE_AUTH_ENABLED));";

function makeWorkspace(appEnvJson) {
  const root = mkdtempSync(join(tmpdir(), "app-env-"));
  if (appEnvJson !== undefined) {
    mkdirSync(join(root, ".grok"), { recursive: true });
    writeFileSync(join(root, APP_ENV_REL_PATH), appEnvJson);
  }
  return root;
}

/** Install a fake `node_modules/<name>` package under `root`. */
function makePackage(root, name, manifest, files = {}) {
  const dir = join(root, "node_modules", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name, ...manifest }));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  return dir;
}

test("keeps VITE_-prefixed string entries", () => {
  assert.deepEqual(parseAppEnv('{"VITE_AUTH_ENABLED":"false"}'), {
    VITE_AUTH_ENABLED: "false",
  });
});

test("drops non-VITE keys, non-string values and malformed documents", () => {
  assert.deepEqual(parseAppEnv('{"DATABASE_URL":"postgres://x","VITE_N":1,"VITE_OK":"y"}'), {
    VITE_OK: "y",
  });
  assert.deepEqual(parseAppEnv("not json"), {});
  assert.deepEqual(parseAppEnv('["VITE_AUTH_ENABLED"]'), {});
  assert.deepEqual(parseAppEnv("null"), {});
});

test("a missing app-env.json is a clean no-op", () => {
  assert.deepEqual(readAppEnv(makeWorkspace()), {});
});

test("reads the app env from a workspace", () => {
  const root = makeWorkspace('{"VITE_AUTH_ENABLED":"false"}');
  assert.deepEqual(readAppEnv(root), { VITE_AUTH_ENABLED: "false" });
});

test("an explicit process-env override wins over the file", () => {
  const merged = mergeAppEnv(
    { VITE_AUTH_ENABLED: "false" },
    { VITE_AUTH_ENABLED: "true", PATH: "/usr/bin" },
  );
  assert.equal(merged.VITE_AUTH_ENABLED, "true");
  assert.equal(merged.PATH, "/usr/bin");
});

test("the template ships auth off", () => {
  assert.deepEqual(readAppEnv(projectRoot()), { VITE_AUTH_ENABLED: "false" });
});

test("vite loadEnv resolves the wrapped value", () => {
  // What `import.meta.env.VITE_AUTH_ENABLED` becomes: loadEnv prefix-matches
  // process.env, so the wrapper's merge has to land before Vite starts.
  // Do not `import { loadEnv } from "vite"` here — Vite 8 loads rolldown
  // native bindings that SIGSEGV the test worker under qemu-user.
  const root = makeWorkspace('{"VITE_AUTH_ENABLED":"false"}');
  const merged = mergeAppEnv(readAppEnv(root), { PATH: "/usr/bin" });
  assert.equal(merged.VITE_AUTH_ENABLED, "false");
});

test("a package's JavaScript bin resolves to its file", () => {
  const root = makeWorkspace();
  const tool = makePackage(root, "tool", { bin: { tool: "bin/tool.js" } });
  assert.equal(findPackageBin(root, "tool"), join(tool, "bin/tool.js"));
  const solo = makePackage(root, "solo", { bin: "./cli.mjs" });
  assert.equal(findPackageBin(root, "solo"), join(solo, "cli.mjs"));
});

test("no bin to run with node: absent, bin-less, misnamed, native or path-like", () => {
  const root = makeWorkspace();
  makePackage(root, "lib", {});
  makePackage(root, "other", { bin: { different: "cli.js" } });
  makePackage(root, "native", { bin: { native: "bin/native" } });
  const names = [
    "absent",
    "lib",
    "other",
    "native",
    "..",
    "../lib",
    "/usr/bin/node",
    "C:\\node.exe",
  ];
  for (const name of names) assert.equal(findPackageBin(root, name), null, name);
});

test("vite runs as its JavaScript bin, never through the .bin shim", () => {
  // On Windows node_modules/.bin/vite is a .cmd shim that spawn cannot launch.
  const root = projectRoot();
  const { file, args } = resolveCommand(root, "vite", ["dev", "--port", "8085"]);
  assert.equal(file, process.execPath);
  assert.ok(args[0].startsWith(join(root, "node_modules", "vite")), args[0]);
  assert.match(args[0], /\.[cm]?js$/);
  assert.ok(existsSync(args[0]), args[0]);
  assert.deepEqual(args.slice(1), ["dev", "--port", "8085"]);
});

test("any other command is spawned as given", () => {
  assert.deepEqual(resolveCommand(projectRoot(), process.execPath, ["-v"]), {
    file: process.execPath,
    args: ["-v"],
  });
});

test("the wrapper runs a project bin that has no .bin shim, arguments verbatim", async () => {
  // Stands in for Windows, where the .bin entry is a .cmd shim spawn cannot
  // launch: this tool is reachable only through its package's bin field.
  const root = makeWorkspace('{"VITE_AUTH_ENABLED":"false"}');
  mkdirSync(join(root, "scripts"));
  const wrapper = join(root, "scripts/with-app-env.mjs");
  copyFileSync(WRAPPER, wrapper);
  makePackage(
    root,
    "echo-tool",
    { bin: { "echo-tool": "cli.js" } },
    {
      "cli.js":
        "process.stdout.write(JSON.stringify([process.env.VITE_AUTH_ENABLED, ...process.argv.slice(2)]));",
    },
  );
  const args = ["--port", "8085", "a b", "&", "$HOME", "(0.0.0.0:8080)"];
  const { stdout } = await execFileAsync(process.execPath, [wrapper, "echo-tool", ...args]);
  assert.deepEqual(JSON.parse(stdout), ["false", ...args]);
});

test("a command that is not installed fails with an npm install hint", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [WRAPPER, "not-an-installed-tool"]),
    (err) => err.code === 127 && /npm install/.test(err.stderr),
  );
});

test("the wrapped command runs with the app env applied", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    WRAPPER,
    process.execPath,
    "-e",
    PRINT_FLAG,
  ]);
  assert.equal(stdout, "false");
});

test("the wrapped command sees an explicit override, not the file value", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [WRAPPER, process.execPath, "-e", PRINT_FLAG],
    { env: { ...process.env, VITE_AUTH_ENABLED: "true" } },
  );
  assert.equal(stdout, "true");
});

test("the wrapper propagates the command's exit code", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [WRAPPER, process.execPath, "-e", "process.exit(3)"]),
    (err) => err.code === 3,
  );
});

test("a signal-killed command is never reported as success", async () => {
  // The wrapper's own SIGTERM handler must not swallow the re-raised signal:
  // a cancelled build reporting exit 0 is a silently passing gate.
  await assert.rejects(
    execFileAsync(process.execPath, [
      WRAPPER,
      process.execPath,
      "-e",
      "process.kill(process.pid, 'SIGTERM');setTimeout(() => {}, 1000);",
    ]),
    (err) => err.signal === "SIGTERM" || err.code !== 0,
  );
});

test("the CLI still runs when invoked through a symlinked path", async () => {
  // node realpaths import.meta.url but not process.argv[1], so a raw comparison
  // turns the wrapper into a no-op that exits 0 without starting anything.
  const link = join(mkdtempSync(join(tmpdir(), "app-env-link-")), "scripts");
  symlinkSync(join(projectRoot(), "scripts"), link);
  const { stdout } = await execFileAsync(process.execPath, [
    join(link, "with-app-env.mjs"),
    process.execPath,
    "-e",
    PRINT_FLAG,
  ]);
  assert.equal(stdout, "false");
});
