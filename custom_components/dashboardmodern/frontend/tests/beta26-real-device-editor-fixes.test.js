import assert from "node:assert/strict";
import test from "node:test";

import { applianceEditorVisualMarkup } from "../src/sections/beta25-compatibility-section.js";

test("beta26 appliance editor uses the canonical dishwasher artwork", () => {
  const markup = applianceEditorVisualMarkup(
    {
      name: "Lavastoviglie",
      visual_type: "asset",
      visual_key: "lavastoviglie",
      device_type: "lavastoviglie",
      icon: "lavastoviglie",
      image: "/local/stale-washer.png",
    },
    48,
  );

  assert.match(markup, /data-dm-art="dishwasher"/);
  assert.doesNotMatch(markup, /data-dm-art="washer"/);
});

test("beta26 appliance editor preserves an explicit custom image", () => {
  const markup = applianceEditorVisualMarkup(
    {
      name: "Lavatrice garage",
      visual_type: "image",
      visual_key: "lavatrice",
      image: "/local/lavatrice-garage.png",
    },
    48,
  );

  assert.match(markup, /data-dm-media-kind="image"/);
  assert.match(markup, /\/local\/lavatrice-garage\.png/);
});
