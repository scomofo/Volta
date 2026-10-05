import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { checkedOutputPath, checkedUrl } from "./browser-guard.mjs";

const url = checkedUrl(process.argv[2] || "http://127.0.0.1:8081/");
const evidenceDir = checkedOutputPath(
  process.env.BROWSER_EVIDENCE_DIR || `${process.cwd()}/screenshots/effects`,
  [process.cwd(), "/workspace"],
);
await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(10_000);
const results = [],
  errors = [],
  failedRequests = [];
let failure;
page.on("pageerror", (error) => errors.push({ text: error.message }));
page.on("console", (message) => {
  if (message.type() === "error")
    errors.push({ text: message.text(), location: message.location() });
});
page.on("requestfailed", (request) =>
  failedRequests.push({ url: request.url(), failure: request.failure()?.errorText }),
);
await page.addInitScript(() => {
  // Supply only a hardware boundary. App MIDI parsing, learning, state and DSP stay real.
  window.__voltaMidi = { id: "acceptance-input", name: "Acceptance input", onmidimessage: null };
  Object.defineProperty(navigator, "requestMIDIAccess", {
    configurable: true,
    value: async () => ({
      inputs: new Map([[window.__voltaMidi.id, window.__voltaMidi]]),
      outputs: new Map(),
      onstatechange: null,
    }),
  });
  window.__voltaAudio = [];
  const createAnalyser = AudioContext.prototype.createAnalyser;
  AudioContext.prototype.createAnalyser = function (...args) {
    const analyser = createAnalyser.apply(this, args);
    window.__voltaAudio.push({ context: this, analyser });
    return analyser;
  };
});
const effects = page.getByRole("heading", { name: "Effects", exact: true }).locator("..");
const column = (name) => effects.getByRole("switch", { name, exact: true }).locator("..");
const values = () =>
  page
    .getByRole("slider")
    .evaluateAll((sliders) => sliders.map((slider) => slider.getAttribute("aria-valuenow")));
const sendCc = (cc, value) =>
  page.evaluate(
    ([number, amount]) => {
      if (typeof window.__voltaMidi.onmidimessage !== "function")
        throw Error("MIDI input not attached");
      window.__voltaMidi.onmidimessage({ data: new Uint8Array([0xb0, number, amount]) });
    },
    [cc, value],
  );

async function checkLayout(width, height) {
  await page.setViewportSize({ width, height });
  const layout = await effects.evaluate((fx) => {
    const loudness = [...document.querySelectorAll("h2")].find(
      (heading) => heading.textContent === "Loudness",
    )?.parentElement;
    const strip = loudness?.parentElement;
    const scroller = strip?.parentElement;
    const style = strip && getComputedStyle(strip);
    return {
      sameParent: fx.parentElement === strip,
      lastSection: strip?.lastElementChild === fx,
      separator: fx.previousElementSibling?.classList.contains("silk-rule"),
      followsLoudness: fx.previousElementSibling?.previousElementSibling === loudness,
      display: style?.display,
      direction: style?.flexDirection,
      wrap: style?.flexWrap,
      overflow: scroller && getComputedStyle(scroller).overflowX,
      fx: fx.getBoundingClientRect().toJSON(),
      loudness: loudness?.getBoundingClientRect().toJSON(),
      scrollWidth: scroller?.scrollWidth,
      clientWidth: scroller?.clientWidth,
      documentOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
  assert.equal(
    layout.sameParent,
    true,
    "Effects and Loudness must be direct children of the same strip",
  );
  assert.equal(
    layout.lastSection && layout.separator && layout.followsLoudness,
    true,
    "Effects must end the strip immediately after Loudness and its separator",
  );
  assert.deepEqual([layout.display, layout.direction, layout.wrap], ["flex", "row", "nowrap"]);
  assert.equal(layout.overflow, "auto");
  assert.ok(
    layout.scrollWidth > layout.clientWidth,
    "controls must overflow inside the scrollport",
  );
  assert.ok(
    Math.abs(layout.fx.top - layout.loudness.top) <= 1,
    "Effects must share Loudness's row",
  );
  assert.ok(layout.fx.left >= layout.loudness.right, "Effects must sit to the right of Loudness");
  assert.equal(layout.documentOverflow, false, "controls must not widen the page");
  for (const title of ["Drive", "Chorus", "Delay"]) {
    const section = column(title);
    await section.scrollIntoViewIfNeeded();
    const reachable = await section.evaluate((element) => {
      const scroller = element.parentElement.parentElement.parentElement.parentElement;
      const viewport = scroller.getBoundingClientRect();
      const bounds = element.getBoundingClientRect();
      return bounds.left >= viewport.left - 1 && bounds.right <= viewport.right + 1;
    });
    assert.ok(reachable, `${title} must scroll fully into the ${width}px control viewport`);
    await page.screenshot({
      path: `${evidenceDir}/${width}-${title.toLowerCase()}.png`,
      fullPage: true,
    });
  }
  results.push({ check: `Effects row and horizontal reachability at ${width}x${height}`, layout });
}

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Arm audio engine", exact: true }).click();
  await checkLayout(1280, 900);
  await checkLayout(390, 844);
  await page.setViewportSize({ width: 1280, height: 900 });
  const knobs = [
    ["Drive", "Drive", "fxDriveAmount"],
    ["Drive", "Tone", "fxDriveTone"],
    ["Drive", "Level", "fxDriveLevel"],
    ["Chorus", "Rate", "fxChorusRate"],
    ["Chorus", "Depth", "fxChorusDepth"],
    ["Chorus", "Mix", "fxChorusMix"],
    ["Delay", "Time", "fxDelayTime"],
    ["Delay", "Fdbk", "fxDelayFeedback"],
    ["Delay", "Mix", "fxDelayMix"],
  ];
  for (const [index, [title, label, param]] of knobs.entries()) {
    const knob = column(title).getByRole("slider", { name: new RegExp(`^${label} `) });
    await knob.focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowUp");
    assert.equal(
      await knob.getAttribute("aria-valuenow"),
      "4",
      `${param} responds to keyboard adjustment`,
    );
    const before = await values();
    await page.getByRole("button", { name: "MIDI · 1", exact: true }).click();
    await knob.click();
    assert.match(await knob.getAttribute("aria-label"), /waiting for MIDI CC/);
    assert.deepEqual(await values(), before, "selecting a learn target must not change any knob");
    const cc = 20 + index;
    await sendCc(cc, 127);
    await page.getByRole("button", { name: "MIDI · 1", exact: true }).waitFor();
    assert.deepEqual(await values(), before, "the binding gesture must not change knob values");
    assert.match(await knob.getAttribute("aria-label"), new RegExp(`MIDI CC ${cc}$`));
    assert.equal(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem("volta.midi-bindings.v1"))[key],
        param,
      ),
      cc,
    );
    const sliderIndex = await knob.evaluate((element) =>
      [...document.querySelectorAll('[role="slider"]')].indexOf(element),
    );
    await sendCc(cc, 64);
    await page.waitForFunction(
      ([i, expected]) =>
        document.querySelectorAll('[role="slider"]')[i]?.getAttribute("aria-valuenow") === expected,
      [sliderIndex, String(Math.round((64 / 127) * 100))],
    );
    const expected = [...before];
    expected[sliderIndex] = String(Math.round((64 / 127) * 100));
    assert.deepEqual(await values(), expected, "learned CC must adjust only its intended knob");
  }
  results.push(
    "All nine FX knobs support keyboard changes and MIDI learn without changing values during binding",
  );
  for (const title of ["Drive", "Chorus", "Delay"]) {
    const rocker = effects.getByRole("switch", { name: title, exact: true });
    assert.equal(await rocker.getAttribute("aria-checked"), "false");
    await rocker.focus();
    for (const [key, state] of [
      ["Space", "true"],
      ["Enter", "false"],
      ["Space", "true"],
    ]) {
      await page.keyboard.press(key);
      assert.equal(await rocker.getAttribute("aria-checked"), state);
    }
  }
  await page.keyboard.down("z");
  try {
    await page.waitForFunction(() =>
      window.__voltaAudio.some(({ context, analyser }) => {
        const samples = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(samples);
        return (
          context.state === "running" &&
          samples.every(Number.isFinite) &&
          samples.some((sample) => Math.abs(sample) > 0.001)
        );
      }),
    );
  } finally {
    await page.keyboard.up("z");
    await page.keyboard.press("Escape");
  }
  results.push(
    "Keyboard rockers toggle each effect; real Web Audio remains finite and audible with all FX enabled and nonzero mixes",
  );
  await page.screenshot({ path: `${evidenceDir}/enabled.png`, fullPage: true });
  const externalWarnings = errors.filter((error) => {
    const resource = error.location?.url || "";
    return (
      error.text.startsWith("Failed to load resource:") &&
      /^(https:\/\/fonts\.(googleapis|gstatic)\.com\/|https:\/\/grok\.com\/grok-app-builder\/extensions\.js$)/.test(
        resource,
      ) &&
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
    "application resources and worklets must load",
  );
} catch (error) {
  failure = { message: String(error), stack: error.stack };
  process.exitCode = 1;
  await page.screenshot({ path: `${evidenceDir}/failure.png`, fullPage: true });
} finally {
  const verdict = {
    ok: !failure,
    url,
    browser: browser.version(),
    results,
    errors,
    failedRequests,
    failure,
  };
  await writeFile(`${evidenceDir}/results.json`, JSON.stringify(verdict, null, 2));
  console.log(JSON.stringify(verdict, null, 2));
  await browser.close();
}
