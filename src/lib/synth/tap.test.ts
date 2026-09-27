import test from "node:test";
import assert from "node:assert/strict";
import { TAP_WORKLET } from "./tap-worklet.ts";

// --- Minimal AudioWorklet shims so the tap source runs under Node ---
const registered = new Map<string, any>();
const posted: any[] = [];
(globalThis as any).AudioWorkletProcessor = class {
  port = {
    postMessage(msg: any) {
      posted.push(msg);
    },
  };
};
(globalThis as any).registerProcessor = (name: string, ctor: any) => {
  registered.set(name, ctor);
};

test("tap worklet registers and posts copied channel data", () => {
  eval(TAP_WORKLET);
  const Ctor = registered.get("volta-tap");
  assert.ok(Ctor, "processor registered as volta-tap");
  const node = new Ctor();

  const left = new Float32Array([0.1, 0.2, 0.3]);
  const right = new Float32Array([-0.1, -0.2, -0.3]);
  const keepGoing = node.process([[left, right]], [], {});
  assert.equal(keepGoing, true);
  assert.equal(posted.length, 1);
  const msg = posted[0];
  assert.equal(msg.channels.length, 2);
  // Posted buffers are copies: mutating the source must not affect them.
  // (Float32Array stores float32 approximations — compare against those.)
  assert.deepEqual(Array.from(msg.channels[0]), Array.from(new Float32Array([0.1, 0.2, 0.3])));
  assert.deepEqual(Array.from(msg.channels[1]), Array.from(new Float32Array([-0.1, -0.2, -0.3])));
  left[0] = 9;
  assert.notEqual(msg.channels[0][0], 9);
});

test("tap worklet ignores empty input without posting", () => {
  eval(TAP_WORKLET);
  const Ctor = registered.get("volta-tap");
  const node = new Ctor();
  posted.length = 0;
  assert.equal(node.process([[]], [], {}), true);
  assert.equal(node.process([], [], {}), true);
  assert.equal(posted.length, 0);
});
