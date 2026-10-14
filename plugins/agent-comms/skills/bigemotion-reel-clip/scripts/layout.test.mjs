import { test } from "node:test";
import assert from "node:assert/strict";
import { WIDTH, HEIGHT, sourceRect } from "./layout.mjs";

test("the canvas is LinkedIn's 4:5 feed format", () => {
  assert.deepEqual([WIDTH, HEIGHT], [1080, 1350]);
});

test("a 16:9 source fills the frame width with even sides", () => {
  const rect = sourceRect(1280, 720);
  assert.equal(rect.w, 1000);
  assert.equal(rect.h % 2, 0);
  assert.equal(rect.x, 40);
});

test("a tall source is centred in the frame without overflowing it", () => {
  const wide = sourceRect(1280, 720);
  const tall = sourceRect(720, 1280);
  assert.ok(tall.h <= wide.h);
  assert.equal(tall.x + tall.w / 2, WIDTH / 2);
});
