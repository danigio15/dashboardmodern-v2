import assert from "node:assert/strict";
import test from "node:test";

globalThis.addEventListener = () => {};
const { integrationUserDataKey, migrateLegacyUserData } = await import(
  "../src/sections/config-persistence-section.js"
);

test("primary persistence uses the legacy runtime key", () => {
  assert.equal(integrationUserDataKey(), "dashboardmodern_integration_config");
});

test("secondary persistence uses the runtime instance slug", () => {
  assert.equal(
    integrationUserDataKey({ primary: false, instance: "Casa / mare! 123456789" }),
    "dashboardmodern_integration_config__Casamare12345678",
  );
});

test("empty unified storage migrates the previous payload exactly once", async () => {
  globalThis.__DASHBOARDMODERN_PRIMARY__ = true;
  globalThis.__DASHBOARDMODERN_INSTANCE__ = "integration";
  const legacy = { version: 1, values: { cd_sections: '{"home":true}' } };
  const values = new Map([["dashboardmodern_v2_config:integration", legacy]]);
  const pushes = [];
  const fetchValue = async (key) => values.get(key) || null;
  const pushValue = async (key, value) => {
    pushes.push([key, value]);
    values.set(key, value);
  };

  assert.equal(await migrateLegacyUserData(fetchValue, pushValue), legacy);
  assert.equal(await migrateLegacyUserData(fetchValue, pushValue), legacy);
  assert.deepEqual(pushes, [["dashboardmodern_integration_config", legacy]]);
});
