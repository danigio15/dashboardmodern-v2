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

test("root HACS brand stays canonical without a duplicated installed copy", async () => {
  for (const path of [
    "brand/icon.png",
    "brand/icon@2x.png",
    "brand/logo.png",
    "brand/logo@2x.png",
  ]) {
    await access(new URL(path, root));
  }
  await assertSame([
    "brand/icon@2x.png",
    "custom_components/dashboardmodern/frontend/legacy/logo.png",
  ]);
  await assert.rejects(access(new URL("custom_components/dashboardmodern/brand/icon.png", root)));
  await assert.rejects(
    access(new URL("custom_components/dashboardmodern/frontend/legacy/icon.png", root)),
  );
});
