import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
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

test("the only brand duplication is the packaging-required HACS/install pair", async () => {
  await assertSame([
    "brand/icon.png",
    "custom_components/dashboardmodern/brand/icon.png",
  ]);
  await assertSame([
    "brand/icon@2x.png",
    "custom_components/dashboardmodern/brand/icon@2x.png",
  ]);
  await assertSame([
    "brand/logo.png",
    "custom_components/dashboardmodern/brand/logo.png",
  ]);
  await assertSame([
    "brand/logo@2x.png",
    "custom_components/dashboardmodern/brand/logo@2x.png",
  ]);

  for (const obsolete of [
    "custom_components/dashboardmodern/frontend/legacy/icon.png",
    "custom_components/dashboardmodern/frontend/legacy/logo.png",
  ]) {
    await assert.rejects(access(new URL(obsolete, root)));
  }
});
