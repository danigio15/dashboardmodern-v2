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

test("HACS root brand and installed local brand stay complete and byte-identical", async () => {
  const pairs = [
    ["brand/icon.png", "custom_components/dashboardmodern/brand/icon.png"],
    ["brand/dark_icon.png", "custom_components/dashboardmodern/brand/dark_icon.png"],
    ["brand/icon@2x.png", "custom_components/dashboardmodern/brand/icon@2x.png"],
    ["brand/dark_icon@2x.png", "custom_components/dashboardmodern/brand/dark_icon@2x.png"],
    ["brand/logo.png", "custom_components/dashboardmodern/brand/logo.png"],
    ["brand/logo@2x.png", "custom_components/dashboardmodern/brand/logo@2x.png"],
  ];
  for (const pair of pairs) {
    for (const path of pair) await access(new URL(path, root));
    await assertSame(pair);
  }
  await assertSame([
    "brand/icon@2x.png",
    "custom_components/dashboardmodern/frontend/legacy/logo.png",
  ]);
  await assert.rejects(
    access(new URL("custom_components/dashboardmodern/frontend/legacy/icon.png", root)),
  );
});
