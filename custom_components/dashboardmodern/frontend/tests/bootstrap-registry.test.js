import assert from "node:assert/strict";
import test from "node:test";

import { createCardRegistry } from "../src/cards/registry.js";
import { registerBuiltInModules } from "../src/modules/bootstrap.js";
import { createPluginManager } from "../src/plugins/registry.js";
import { createSectionRegistry, registerBuiltInSectionTypes } from "../src/sections/registry.js";
import { createWidgetRegistry } from "../src/widgets/registry.js";

test("production modules replace built-in section placeholders during bootstrap", () => {
  const sectionRegistry = registerBuiltInSectionTypes(createSectionRegistry());
  const placeholderOrder = sectionRegistry.get("lights").registrationOrder;
  assert.equal(sectionRegistry.get("lights").owner, "builtin-placeholder");

  const manager = createPluginManager({
    sectionRegistry,
    cardRegistry: createCardRegistry(),
    widgetRegistry: createWidgetRegistry(),
  });

  assert.doesNotThrow(() => registerBuiltInModules({ pluginManager: manager }));
  assert.equal(sectionRegistry.get("lights").owner, "lights");
  assert.equal(sectionRegistry.get("lights").registrationOrder, placeholderOrder);
  assert.equal(sectionRegistry.get("home").owner, "home");
  assert.equal(sectionRegistry.get("security").owner, "security");
});

test("section registry still rejects genuine duplicate registrations", () => {
  const registry = createSectionRegistry();
  registry.register({ type: "custom-test", displayName: "Custom test", owner: "first" });
  assert.throws(
    () => registry.register({ type: "custom-test", displayName: "Custom test again", owner: "second" }),
    /Section type already registered: custom-test/,
  );
});
