import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);

async function bytes(path) {
  return readFile(new URL(path, root));
}

test("Home Assistant local brand assets match the repository brand", async () => {
  const [assetIcon, assetIcon2x, localIcon, localIcon2x] = await Promise.all([
    bytes("assets/icon@2x.png"),
    bytes("assets/icon@2x.png"),
    bytes("custom_components/dashboardmodern/brand/icon.png"),
    bytes("custom_components/dashboardmodern/brand/icon@2x.png"),
  ]);
  const [assetLogo, assetLogo2x, localLogo, localLogo2x] = await Promise.all([
    bytes("assets/logo@2x.png"),
    bytes("assets/logo@2x.png"),
    bytes("custom_components/dashboardmodern/brand/logo.png"),
    bytes("custom_components/dashboardmodern/brand/logo@2x.png"),
  ]);

  assert.deepEqual(localIcon, assetIcon);
  assert.deepEqual(localIcon2x, assetIcon2x);
  assert.deepEqual(localLogo, assetLogo);
  assert.deepEqual(localLogo2x, assetLogo2x);
});
