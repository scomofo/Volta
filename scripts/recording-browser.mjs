import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { checkedOutputPath, checkedUrl } from "./browser-guard.mjs";

const url = checkedUrl(process.argv[2] || "http://127.0.0.1:8081/");
const evidenceDir = checkedOutputPath(
  process.env.BROWSER_EVIDENCE_DIR || `${process.cwd()}/screenshots/recording`,
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
const downloads = [];
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
});
page.setDefaultTimeout(10_000);
page.on("download", (download) => downloads.push(download));
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error")
    errors.push({ text: message.text(), location: message.location() });
});
page.on("requestfailed", (request) =>
  failedRequests.push({ url: request.url(), failure: request.failure()?.errorText }),
);
// Observe the existing analyser and context without replacing DSP or output.
await page.addInitScript(() => {
  window.__voltaAudio = [];
  const createAnalyser = AudioContext.prototype.createAnalyser;
  AudioContext.prototype.createAnalyser = function (...args) {
    const analyser = createAnalyser.apply(this, args);
    const observation = { context: this, analyser, moduleLoads: 0 };
    const addModule = this.audioWorklet.addModule.bind(this.audioWorklet);
    this.audioWorklet.addModule = (...moduleArgs) => {
      observation.moduleLoads++;
      return addModule(...moduleArgs);
    };
    window.__voltaAudio.push(observation);
    return analyser;
  };
});
const startButton = () => page.getByRole("button", { name: "Record a take as WAV", exact: true });
const stopButton = () => page.getByRole("button", { name: /^Stop recording and save take/ });
const patchButton = (name) => page.getByRole("button", { name: `Load ${name} patch`, exact: true });

async function start() {
  // Keyboard activation also checks the Record/Stop control's native semantics.
  await startButton().focus();
  await page.keyboard.press("Enter");
  await stopButton().waitFor();
  assert.equal(await stopButton().getAttribute("aria-pressed"), "true");
}
async function soundingNote(key, milliseconds = 700) {
  await page.keyboard.down(key);
  try {
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
    // Real audio must elapse: this is PCM capture, not a mocked recorder.
    await page.waitForTimeout(milliseconds);
  } finally {
    await page.keyboard.up(key);
  }
}
function inspectWav(bytes) {
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
  assert.equal(bytes.toString("ascii", 12, 16), "fmt ");
  assert.equal(bytes.readUInt32LE(16), 16);
  assert.equal(bytes.readUInt16LE(20), 1, "download must contain PCM audio");
  const channels = bytes.readUInt16LE(22);
  const sampleRate = bytes.readUInt32LE(24);
  assert.ok(channels === 1 || channels === 2);
  assert.ok(sampleRate >= 8000 && sampleRate <= 192000);
  assert.equal(bytes.readUInt16LE(34), 16);
  assert.equal(bytes.readUInt16LE(32), channels * 2);
  assert.equal(bytes.readUInt32LE(28), sampleRate * channels * 2);
  assert.equal(bytes.toString("ascii", 36, 40), "data");
  assert.equal(bytes.readUInt32LE(40), bytes.length - 44);
  assert.equal(bytes.readUInt32LE(4), bytes.length - 8);
  const sampleCount = (bytes.length - 44) / 2;
  assert.equal(sampleCount % channels, 0);
  const rms = (first, last) => {
    let sum = 0;
    for (let i = first; i < last; i++) sum += (bytes.readInt16LE(44 + i * 2) / 32768) ** 2;
    return Math.sqrt(sum / (last - first));
  };
  const edgeSamples = Math.min(sampleCount, Math.floor(sampleRate * channels * 0.3));
  const analysis = {
    bytes: bytes.length,
    channels,
    sampleRate,
    seconds: sampleCount / channels / sampleRate,
    rms: rms(0, sampleCount),
    firstRms: rms(0, edgeSamples),
    lastRms: rms(sampleCount - edgeSamples, sampleCount),
  };
  assert.ok(analysis.seconds >= 0.5, "take must contain actual elapsed audio");
  assert.ok(analysis.rms > 0.001, "take must contain nonzero PCM");
  return analysis;
}
async function finish(patchName, label) {
  const pendingDownload = page.waitForEvent("download");
  await stopButton().focus();
  await page.keyboard.press("Space");
  const download = await pendingDownload;
  assert.equal(await download.failure(), null);
  const filename = download.suggestedFilename();
  assert.match(filename, new RegExp(`^volta-${patchName}-\\d{8}-\\d{6}\\.wav$`));
  const path = `${evidenceDir}/${label}.wav`;
  await download.saveAs(path);
  const analysis = inspectWav(await readFile(path));
  await startButton().waitFor();
  assert.equal(await startButton().getAttribute("aria-pressed"), "false");
  return { filename, ...analysis };
}

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Arm audio engine" }).click();
  await patchButton("Classic Saw").click();

  // No reload between takes: the old bug re-registers volta-tap in this same
  // AudioWorkletGlobalScope and fails on the second Start.
  let moduleLoadsAfterFirstTake;
  const moduleLoads = () =>
    page.evaluate(() => window.__voltaAudio.map((entry) => entry.moduleLoads));
  for (let take = 1; take <= 3; take++) {
    await start();
    if (take === 1) {
      moduleLoadsAfterFirstTake = await moduleLoads();
      assert.ok(
        moduleLoadsAfterFirstTake.some((count) => count > 0),
        "must observe a real worklet module load",
      );
    } else {
      assert.deepEqual(
        await moduleLoads(),
        moduleLoadsAfterFirstTake,
        "later takes must reuse the already loaded worklet module",
      );
    }
    await soundingNote(take % 2 ? "z" : "x");
    results.push({
      check: `Sequential recording ${take}`,
      ...(await finish("Classic-Saw", `take-${take}`)),
    });
  }

  const countBeforeShortTake = downloads.length;
  await start();
  // Stop in the next browser task, before the recorder's 250 ms minimum.
  await stopButton().evaluate((button) => button.click());
  await page.getByRole("status").filter({ hasText: "Nothing recorded" }).waitFor();
  await startButton().waitFor();
  await page.waitForTimeout(300);
  assert.equal(downloads.length, countBeforeShortTake, "a short take must not download a file");
  results.push({ check: "Immediate stop discards the short take without a download" });

  await start();
  await soundingNote("z", 500);
  // Patch loading resets voices/parameters but must leave the live tap intact.
  await patchButton("Sub Bass").click();
  assert.equal(await patchButton("Sub Bass").getAttribute("aria-pressed"), "true");
  assert.equal(await stopButton().getAttribute("aria-pressed"), "true");
  await page.screenshot({ path: `${evidenceDir}/patch-change-recording.png`, fullPage: true });
  await soundingNote("x", 800);
  const patchChange = await finish("Classic-Saw", "patch-change");
  assert.ok(patchChange.seconds >= 1.1, "capture must continue after the patch change");
  assert.ok(patchChange.firstRms > 0.001, "original patch must be present at the start");
  assert.ok(patchChange.lastRms > 0.001, "new patch must be present at the end");
  results.push({
    check: "Restart after discarded take survives patch change and keeps original filename",
    ...patchChange,
  });

  await start();
  await soundingNote("c");
  results.push({
    check: "Restart after patch-changing take captures the newly selected patch",
    ...(await finish("Sub-Bass", "after-patch-change")),
  });
  assert.equal(downloads.length, 5);
  assert.deepEqual(
    await moduleLoads(),
    moduleLoadsAfterFirstTake,
    "stop/restart and patch changes must not reload worklet modules",
  );
  results.push({
    check: "Worklet module load count stays fixed after the first take",
    moduleLoads: await moduleLoads(),
  });
  const contextCount = await page.evaluate(
    () => new Set(window.__voltaAudio.map(({ context }) => context)).size,
  );
  assert.equal(contextCount, 1, "all takes must exercise the same AudioContext");
  results.push({ check: "All six starts use one AudioContext", contextCount });
  await page.screenshot({ path: `${evidenceDir}/finished.png`, fullPage: true });

  // Fonts and hosting chrome can be offline in QA. App assets and blob
  // worklets must always succeed; never excuse their errors.
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
    "application resources and worklet modules must load",
  );
  console.log(
    JSON.stringify(
      { ok: true, browser: browser.version(), url, results, externalWarnings },
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
      { url, browser: browser.version(), results, errors, failedRequests, ok: !process.exitCode },
      null,
      2,
    ),
  );
  await browser.close();
}
