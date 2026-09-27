import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { checkedOutputPath, checkedUrl } from "./browser-guard.mjs";

const url = checkedUrl(process.argv[2] || "http://127.0.0.1:8081/");
const evidenceDir = checkedOutputPath(
  process.env.BROWSER_EVIDENCE_DIR || `${process.cwd()}/screenshots/patch-bank`,
  [process.cwd(), "/workspace"],
);
await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const results = [];
const errors = [];
const failedRequests = [];
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
});
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error")
    errors.push({ text: message.text(), location: message.location() });
});
page.on("requestfailed", (request) =>
  failedRequests.push({ url: request.url(), failure: request.failure()?.errorText }),
);

// Observe the real graph. Do not replace DSP, synth state, or audio output.
await page.addInitScript(() => {
  window.__voltaAudio = [];
  const createAnalyser = AudioContext.prototype.createAnalyser;
  AudioContext.prototype.createAnalyser = function (...args) {
    const analyser = createAnalyser.apply(this, args);
    window.__voltaAudio.push({ context: this, analyser });
    return analyser;
  };
});
const shelf = page.getByRole("region", { name: "Sound presets" });
const status = shelf.getByRole("status");
const savedBank = () => page.evaluate(() => localStorage.getItem("volta.user-patches.v1"));
async function notice(text) {
  await page.waitForFunction(
    (expected) =>
      document.querySelector('[aria-label="Sound presets"] [role="status"]')?.textContent ===
      expected,
    text,
  );
  assert.equal(await status.getAttribute("aria-live"), "polite");
}
async function tabTo(control) {
  for (let i = 0; i < 150; i++) {
    if (await control.evaluate((element) => element === document.activeElement)) {
      assert.ok(
        await control.evaluate((element) => element.matches(":focus-visible")),
        "keyboard focus must be visible",
      );
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error(`Control not reachable by Tab: ${await control.getAttribute("aria-label")}`);
}
async function activate(control, key = "Enter") {
  await tabTo(control);
  await page.keyboard.press(key);
}
async function importFile(content, decision, expectedNotice) {
  const before = await savedBank();
  // Reset an identical previous status through a read-only UI action so the
  // assertion below cannot pass before the next asynchronous file read ends.
  if ((await status.textContent()) === expectedNotice) {
    await tabTo(shelf.getByRole("button", { name: "Export bank", exact: true }));
    const download = page.waitForEvent("download");
    await page.keyboard.press("Enter");
    await download;
    await notice("Patch bank exported.");
  }
  const dialogs = [];
  const handle = async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    if (decision === "accept") await dialog.accept();
    else await dialog.dismiss();
  };
  page.on("dialog", handle);
  try {
    await tabTo(shelf.getByRole("button", { name: "Import bank", exact: true }));
    const chooser = page.waitForEvent("filechooser");
    await page.keyboard.press("Space");
    await (
      await chooser
    ).setFiles({
      name: "acceptance-bank.json",
      mimeType: "application/json",
      buffer: Buffer.from(content),
    });
    await notice(expectedNotice);
    assert.equal(
      await page.evaluate(() => document.activeElement?.tagName === "INPUT"),
      false,
      "file input must not trap note keys after choosing a file",
    );
  } finally {
    page.off("dialog", handle);
  }
  if (decision) {
    assert.equal(dialogs.length, 1, "valid banks must ask exactly once");
    assert.equal(dialogs[0].type, "confirm");
    assert.match(dialogs[0].message, /replace all four saved slots on this device\?/);
  } else assert.equal(dialogs.length, 0, "invalid banks must never ask to replace slots");
  if (decision !== "accept" || expectedNotice.includes("could not save"))
    assert.equal(
      await savedBank(),
      before,
      "rejected/cancelled/failed input must not change saved bytes",
    );
  return dialogs;
}
async function outputLevel() {
  return page.evaluate(() =>
    window.__voltaAudio.map(({ context, analyser }) => {
      const samples = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(samples);
      return {
        state: context.state,
        finite: samples.every(Number.isFinite),
        rms: Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length),
      };
    }),
  );
}
try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Arm audio engine" }).waitFor();
  await activate(page.getByRole("button", { name: "Arm audio engine" }));
  assert.equal(
    await shelf.getByRole("button", { name: "Export bank", exact: true }).isDisabled(),
    true,
  );
  for (const [index, name] of ["Classic Saw", "Sub Bass", "Soft Keys", "Swarm Lead"].entries()) {
    await activate(shelf.getByRole("button", { name: `Load ${name} patch`, exact: true }));
    await activate(
      shelf.getByRole("button", {
        name: `Save current sound to user slot ${index + 1}`,
        exact: true,
      }),
      index % 2 ? "Space" : "Enter",
    );
    await notice(`Saved as USER ${index + 1} on this device.`);
  }
  const original = await savedBank();
  await tabTo(shelf.getByRole("button", { name: "Export bank", exact: true }));
  const downloadPromise = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "volta-user-patches.json");
  assert.equal(await download.failure(), null);
  const exported = JSON.parse(await readFile(await download.path(), "utf8"));
  assert.deepEqual(exported, {
    format: "volta-user-patches",
    version: 1,
    slots: JSON.parse(original).slots,
  });
  await notice("Patch bank exported.");
  results.push(
    "Keyboard save/export downloads volta-user-patches.json with all four exact saved slots",
  );

  const replacement = {
    ...exported,
    slots: exported.slots.map((patch, i) => ({
      ...patch,
      cutoff: 0.45 + i * 0.1,
      volume: 0.55,
      ampAttack: 0.01,
      ampDecay: 0.1,
      ampSustain: 0.8,
    })),
  };
  const valid = JSON.stringify(replacement);
  for (const content of [
    "{broken",
    JSON.stringify({ ...replacement, version: 2 }),
    JSON.stringify({ ...replacement, slots: replacement.slots.slice(0, 3) }),
    JSON.stringify({
      ...replacement,
      slots: [...replacement.slots.slice(0, 3), { ...replacement.slots[3], cutoff: 2 }],
    }),
  ]) {
    await importFile(content, null, "That file is not a valid Volta patch bank.");
  }
  await importFile(
    valid.padEnd(65_537, " "),
    null,
    "That file is too large to be a Volta patch bank.",
  );
  results.push(
    "Malformed, wrong-version, incomplete, invalid-slot and oversized valid JSON leave saved bytes untouched",
  );
  await importFile(valid, "cancel", "Patch import cancelled.");
  assert.equal(await savedBank(), original);
  assert.equal(
    await shelf
      .getByRole("button", { name: "Load user patch 4", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  results.push("Cancelling native confirmation preserves saved bank and active selection");
  // Exercise the browser UI's write-failure path without modifying its bank.
  await page.evaluate(() => {
    window.__restoreSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "volta.user-patches.v1")
        throw new DOMException("Acceptance quota failure", "QuotaExceededError");
      return window.__restoreSetItem.call(this, key, value);
    };
  });
  await importFile(valid, "accept", "This browser could not save the imported patch bank.");
  assert.equal(
    await shelf
      .getByRole("button", { name: "Load user patch 4", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.evaluate(() => {
    Storage.prototype.setItem = window.__restoreSetItem;
  });
  results.push("Simulated storage quota failure preserves saved bytes and active selection");
  const previousControls = await page
    .getByRole("slider")
    .evaluateAll((controls) => controls.map((control) => control.getAttribute("aria-valuenow")));
  await importFile(valid, "accept", "Imported 4 user patches.");
  assert.deepEqual(JSON.parse(await savedBank()), { version: 1, slots: replacement.slots });
  assert.deepEqual(
    await page
      .getByRole("slider")
      .evaluateAll((controls) => controls.map((control) => control.getAttribute("aria-valuenow"))),
    previousControls,
    "import must not change the currently playing sound",
  );
  assert.equal(
    await shelf
      .getByRole("button", { name: "Load user patch 4", exact: true })
      .getAttribute("aria-pressed"),
    "false",
  );
  results.push(
    "Reselecting same file after cancellation replaces all four slots only after confirmation",
  );

  const audio = [];
  for (let slot = 1; slot <= 4; slot++) {
    await activate(
      shelf.getByRole("button", { name: `Load user patch ${slot}`, exact: true }),
      slot % 2 ? "Enter" : "Space",
    );
    assert.equal(
      await page.getByRole("slider", { name: /^Cutoff / }).getAttribute("aria-valuenow"),
      String(Math.round(replacement.slots[slot - 1].cutoff * 100)),
    );
    await page.keyboard.down("z");
    await page.waitForFunction(() =>
      window.__voltaAudio.some(({ context, analyser }) => {
        const samples = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(samples);
        return (
          context.state === "running" &&
          samples.every(Number.isFinite) &&
          samples.some((value) => Math.abs(value) > 0.001)
        );
      }),
    );
    audio.push({ slot, output: await outputLevel() });
    await page.keyboard.up("z");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() =>
      window.__voltaAudio.every(({ analyser }) => {
        const samples = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(samples);
        return samples.every((value) => Math.abs(value) < 0.0001);
      }),
    );
  }
  assert.ok(
    audio.every(
      (item) =>
        item.output.length && item.output.every((out) => out.finite && out.state === "running"),
    ),
  );
  results.push({
    check:
      "Each imported slot loads with keyboard and produces finite nonzero real Web Audio output",
    audio,
  });
  await page.screenshot({ path: `${evidenceDir}/desktop.png`, fullPage: true });

  // A bank replacement must not claim that the previously loaded USER sound
  // is the newly imported sound (or an empty slot).
  const mixed = { ...replacement, slots: [replacement.slots[0], null, replacement.slots[2], null] };
  await importFile(JSON.stringify(mixed), "accept", "Imported 2 user patches.");
  assert.deepEqual(JSON.parse(await savedBank()).slots, mixed.slots);
  assert.equal(
    await shelf.getByRole("button", { name: "Load user patch 2", exact: true }).isDisabled(),
    true,
  );
  assert.equal(
    await shelf.getByRole("button", { name: "Load user patch 4", exact: true }).isDisabled(),
    true,
  );
  assert.equal(
    await shelf
      .getByRole("button", { name: "Load user patch 4", exact: true })
      .getAttribute("aria-pressed"),
    "false",
    "bank replacement must invalidate the old active user-slot label",
  );
  results.push("Mixed bank clears old slots and invalidates stale active USER selection");
  await activate(shelf.getByRole("button", { name: "Load Classic Saw patch", exact: true }));
  await importFile(JSON.stringify(mixed), "accept", "Imported 2 user patches.");
  assert.equal(
    await shelf
      .getByRole("button", { name: "Load Classic Saw patch", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  results.push("Import preserves an active factory preset");
  await page.reload({ waitUntil: "networkidle" });
  assert.deepEqual(JSON.parse(await savedBank()).slots, mixed.slots);
  await page.setViewportSize({ width: 390, height: 844 });
  await activate(page.getByRole("button", { name: "Arm audio engine" }));
  await shelf.scrollIntoViewIfNeeded();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    ),
    false,
  );
  await page.screenshot({ path: `${evidenceDir}/mobile.png`, fullPage: true });
  results.push("Imported bank survives reload; mobile layout has no horizontal overflow");
  // External fonts/host chrome can be unavailable in offline QA. Report these
  // separately; never exempt app JS errors, same-origin failures or worklets.
  const externalWarnings = errors.filter((error) => {
    if (typeof error === "string" || !error.text.startsWith("Failed to load resource:"))
      return false;
    const resource = error.location.url;
    return (
      (resource.startsWith("https://fonts.googleapis.com/") ||
        resource.startsWith("https://fonts.gstatic.com/") ||
        resource === "https://grok.com/grok-app-builder/extensions.js") &&
      failedRequests.some((request) => request.url === resource)
    );
  });
  assert.deepEqual(
    errors.filter((error) => !externalWarnings.includes(error)),
    [],
  );
  assert.deepEqual(
    failedRequests.filter((request) => {
      const resource = new URL(request.url);
      return resource.origin === new URL(url).origin || resource.protocol === "blob:";
    }),
    [],
    "application resource and worklet requests must succeed",
  );
  console.log(
    JSON.stringify(
      { ok: true, browser: browser.version(), url, results, externalWarnings, failedRequests },
      null,
      2,
    ),
  );
} catch (error) {
  await page.screenshot({ path: `${evidenceDir}/failure.png`, fullPage: true });
  console.error(
    JSON.stringify(
      {
        ok: false,
        browser: browser.version(),
        url,
        results,
        errors,
        failedRequests,
        failure: String(error),
        stack: error.stack,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await writeFile(
    `${evidenceDir}/results.json`,
    JSON.stringify(
      { url, browser: browser.version(), results, errors, ok: !process.exitCode },
      null,
      2,
    ),
  );
  await browser.close();
}
