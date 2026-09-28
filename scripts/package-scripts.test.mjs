import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { projectRoot } from "./with-app-env.mjs";

const { scripts } = JSON.parse(readFileSync(join(projectRoot(), "package.json"), "utf8"));

test("no npm script single-quotes an argument", () => {
  // npm runs scripts through cmd.exe on Windows, which keeps single quotes as
  // literal characters: `node --test 'scripts/**/*.test.mjs'` there matches no
  // file and passes with zero tests. Double quotes work in sh and cmd.exe alike.
  for (const [name, body] of Object.entries(scripts)) {
    assert.doesNotMatch(body, /(^|[\s=])'/, `${name}: ${body}`);
  }
});
