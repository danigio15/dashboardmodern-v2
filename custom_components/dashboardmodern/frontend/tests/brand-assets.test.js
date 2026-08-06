import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);

async function digest(path) {
  const content = await readFile(new URL(path, root));
  return createHash("sha256").update(content).digest("hex");
}

async function assertSame(paths) {
  const digests = await Promise.all(paths.map(digest));
  assert.equal(new Set(digests).size, 1, `brand assets differ: ${paths.join(", ")}`);
}

test("HACS and Home Assistant brand assets use canonical 1x and 2x files", async () => {
  await assertSame([
    "assets/icon.png",
    "brand/icon.png",
    "custom_components/dashboardmodern/brand/icon.png",
  ]);
  await assertSame([
    "assets/icon@2x.png",
    "brand/icon@2x.png",
    "custom_components/dashboardmodern/brand/icon@2x.png",
  ]);
  await assertSame([
    "assets/logo.png",
    "brand/logo.png",
    "custom_components/dashboardmodern/brand/logo.png",
  ]);
  await assertSame([
    "assets/logo@2x.png",
    "brand/logo@2x.png",
    "custom_components/dashboardmodern/brand/logo@2x.png",
  ]);
});
