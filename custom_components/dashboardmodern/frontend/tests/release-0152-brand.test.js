import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import test from "node:test";

const brand = (name) => new URL(`../../brand/${name}`, import.meta.url);

test("Home Assistant and HACS branding assets remain packaged", async () => {
  for (const name of ["icon.png", "logo.png"]) {
    const details = await stat(brand(name));
    assert.ok(details.size > 1024, `${name} must contain a real packaged image`);
  }
});
