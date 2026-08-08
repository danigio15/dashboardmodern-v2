import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test("HACS root brand exposes the canonical square 256px icon", async () => {
  const path = "brand/icon.png";
  const content = await readFile(new URL(path, root));
  assert.deepEqual(pngDimensions(content), { width: 256, height: 256 }, path);
});
