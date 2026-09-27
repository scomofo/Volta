import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { runInNewContext } from "node:vm";
import { SynthEngine } from "./engine.ts";

class RecordingSource {
  connections = new Set<unknown>();

  connect(destination: unknown): void {
    this.connections.add(destination);
  }

  disconnect(destination?: unknown): void {
    if (destination === undefined) this.connections.clear();
    else this.connections.delete(destination);
  }
}

class RecordingContext {
  sampleRate = 1000;
  currentTime = 0;
  state = "running";
  registered = new Set<string>();
  nodes: RecordingNode[] = [];
  loadedUrls: string[] = [];
  loadFailures = 0;
  nodeFailures = 0;
  loadGate: Promise<void> | null = null;
  private readonly blobs: Map<string, Blob>;

  constructor(blobs: Map<string, Blob>) {
    this.blobs = blobs;
  }

  audioWorklet = {
    addModule: async (url: string) => {
      this.loadedUrls.push(url);
      if (this.loadGate) await this.loadGate;
      if (this.loadFailures-- > 0) throw new Error("Module loading failed");
      const blob = this.blobs.get(url);
      assert.ok(blob, "module URL must remain valid until loading completes");
      // Each blob is a new module, but registration names share one context.
      // Unlike a permissive Map.set mock, this reproduces the browser failure.
      runInNewContext(await blob.text(), {
        AudioWorkletProcessor: class {},
        registerProcessor: (name: string) => {
          if (this.registered.has(name)) {
            throw new DOMException("Processor already registered", "NotSupportedError");
          }
          this.registered.add(name);
        },
      });
    },
  };
}

class RecordingNode {
  port = {
    onmessage: null as ((event: MessageEvent) => void) | null,
    closed: false,
    close() {
      this.closed = true;
    },
  };
  disconnected = false;

  constructor(ctx: RecordingContext, name: string) {
    assert.ok(ctx.registered.has(name), "processor must be registered before creating a node");
    if (ctx.nodeFailures-- > 0) throw new Error("Node creation failed");
    ctx.nodes.push(this);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  emit(value: number, frames = 300): void {
    this.port.onmessage?.({
      data: { channels: [new Float32Array(frames).fill(value)] },
    } as MessageEvent);
  }
}

function setup(t: TestContext) {
  const blobs = new Map<string, Blob>();
  const revoked: string[] = [];
  let nextUrl = 0;
  t.mock.method(URL, "createObjectURL", (blob: Blob) => {
    const url = `blob:recording-${nextUrl++}`;
    blobs.set(url, blob);
    return url;
  });
  t.mock.method(URL, "revokeObjectURL", (url: string) => {
    revoked.push(url);
    blobs.delete(url);
  });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "AudioWorkletNode");
  Object.defineProperty(globalThis, "AudioWorkletNode", {
    configurable: true,
    value: RecordingNode,
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, "AudioWorkletNode", descriptor);
    else Reflect.deleteProperty(globalThis, "AudioWorkletNode");
  });

  const makeEngine = () => {
    const ctx = new RecordingContext(blobs);
    const source = new RecordingSource();
    const speaker = {};
    source.connect(speaker);
    const engine = new SynthEngine();
    // The audio graph is already armed; tests exercise its recording branch.
    engine.ctx = ctx as unknown as AudioContext;
    engine.analyser = source as unknown as AnalyserNode;
    return { engine, ctx, source, speaker };
  };
  return { ...makeEngine(), makeEngine, revoked, blobs };
}

test("sequential takes register once, retain patch changes, and detach only the recording tap", async (t) => {
  const { engine, ctx, source, speaker, revoked } = setup(t);
  for (let i = 0; i < 4; i++) {
    assert.equal(await engine.startRecording(`Patch ${i}`), true, `take ${i + 1} starts`);
    assert.equal(engine.recording, true);
    const node = ctx.nodes.at(-1)!;
    assert.deepEqual(source.connections, new Set([speaker, node]));
    node.emit(0.25);
    engine.setParams({ cutoff: 0.2 + i * 0.1, osc1Wave: "square" });
    assert.equal(engine.recording, true, "changing patch parameters preserves the take");
    node.emit(-0.5);
    const result = engine.stopRecording();
    assert.ok(result);
    assert.equal(result.patchName, `Patch ${i}`, "filename retains the starting patch");
    assert.equal(result.seconds, 0.6);
    const wav = new DataView(result.wav);
    assert.equal(wav.getUint32(40, true), 1200, "WAV includes both audio blocks");
    assert.equal(wav.getInt16(44, true), 8192);
    assert.equal(wav.getInt16(44 + 300 * 2, true), -16383);
    assert.equal(engine.recording, false);
    assert.equal(engine.stopRecording(), null);
  }
  for (const node of ctx.nodes) {
    assert.equal(node.port.closed, true);
    assert.equal(node.port.onmessage, null);
  }
  assert.deepEqual(source.connections, new Set([speaker]), "audible output stays connected");
  assert.equal(ctx.loadedUrls.length, 1);
  assert.deepEqual(revoked, ctx.loadedUrls);
});

test("overlapping starts share the module load and create only one recording tap", async (t) => {
  const { engine, ctx, revoked } = setup(t);
  let release!: () => void;
  ctx.loadGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = engine.startRecording("First");
  const second = engine.startRecording("Second");
  release();
  assert.deepEqual(await Promise.all([first, second]), [true, false]);
  assert.equal(ctx.nodes.length, 1);
  assert.equal(ctx.loadedUrls.length, 1);
  assert.deepEqual(revoked, ctx.loadedUrls);
  ctx.nodes[0]!.emit(0.5);
  assert.equal(engine.stopRecording()?.patchName, "First");
});

test("a failed module load revokes its URL and can retry without poisoning later takes", async (t) => {
  const { engine, ctx, revoked, blobs } = setup(t);
  ctx.loadFailures = 1;
  assert.equal(await engine.startRecording("Unavailable"), false);
  assert.equal(engine.recording, false);
  assert.deepEqual(revoked, ctx.loadedUrls);
  assert.equal(blobs.size, 0);
  for (let i = 0; i < 2; i++) {
    assert.equal(await engine.startRecording("Retry"), true);
    ctx.nodes.at(-1)!.emit(0.5);
    assert.ok(engine.stopRecording());
  }
  assert.equal(ctx.loadedUrls.length, 2, "only a genuinely failed module load is retried");
  assert.deepEqual(revoked, ctx.loadedUrls);
});

test("node creation failure does not reload an already registered processor", async (t) => {
  const { engine, ctx } = setup(t);
  ctx.nodeFailures = 1;
  assert.equal(await engine.startRecording("Unavailable"), false);
  assert.equal(await engine.startRecording("Retry"), true);
  assert.equal(ctx.loadedUrls.length, 1);
  engine.cancelRecording();
});

test("each AudioContext gets its own processor registration", async (t) => {
  const { engine, ctx, makeEngine } = setup(t);
  const other = makeEngine();
  for (const current of [{ engine, ctx }, other]) {
    assert.equal(await current.engine.startRecording("First"), true);
    current.engine.cancelRecording();
    assert.equal(await current.engine.startRecording("Second"), true);
    current.engine.cancelRecording();
    assert.equal(current.ctx.loadedUrls.length, 1);
    assert.deepEqual(current.ctx.registered, new Set(["volta-tap"]));
  }
});

test("engines sharing an AudioContext reuse its single module registration", async (t) => {
  const { engine, ctx, source, speaker } = setup(t);
  const peer = new SynthEngine();
  peer.ctx = engine.ctx;
  peer.analyser = engine.analyser;
  assert.deepEqual(
    await Promise.all([
      engine.startRecording("First engine"),
      peer.startRecording("Second engine"),
    ]),
    [true, true],
  );
  assert.equal(ctx.loadedUrls.length, 1);
  engine.cancelRecording();
  assert.deepEqual(source.connections, new Set([speaker, ctx.nodes[1]]));
  assert.equal(peer.recording, true);
  peer.cancelRecording();
  assert.deepEqual(source.connections, new Set([speaker]));
});

test("stop or cancel during module loading invalidates that start but permits immediate restart", async (t) => {
  const { makeEngine } = setup(t);
  for (const stop of ["stopRecording", "cancelRecording"] as const) {
    const { engine, ctx } = makeEngine();
    let release!: () => void;
    ctx.loadGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = engine.startRecording("Stopped");
    engine[stop]();
    const restarted = engine.startRecording("Restarted");
    release();
    assert.equal(await pending, false);
    assert.equal(await restarted, true);
    assert.equal(ctx.nodes.length, 1);
    assert.equal(ctx.loadedUrls.length, 1);
    ctx.nodes[0]!.emit(0.25);
    assert.equal(engine.stopRecording()?.patchName, "Restarted");
  }
});

test("cancel and short takes permit restart without keeping old taps or stale audio", async (t) => {
  const { engine, ctx, source, speaker } = setup(t);
  assert.equal(await engine.startRecording("Cancelled"), true);
  const cancelledNode = ctx.nodes[0]!;
  const queuedMessage = cancelledNode.port.onmessage!;
  cancelledNode.emit(0.5);
  engine.cancelRecording();
  assert.equal(engine.stopRecording(), null);
  assert.deepEqual(source.connections, new Set([speaker]));

  assert.equal(await engine.startRecording("Too short"), true);
  ctx.nodes.at(-1)!.emit(0.25, 10);
  assert.equal(engine.stopRecording(), null);
  assert.equal(await engine.startRecording("New take"), true);
  queuedMessage({ data: { channels: [new Float32Array(300).fill(1)] } } as MessageEvent);
  ctx.nodes.at(-1)!.emit(0.25);
  assert.equal(
    engine.stopRecording()?.seconds,
    0.3,
    "stale queued chunks do not enter the new take",
  );
  assert.equal(ctx.loadedUrls.length, 1);
  assert.deepEqual(source.connections, new Set([speaker]));
});
