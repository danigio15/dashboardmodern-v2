// DM-FIX-20260813F
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { actionVisual, roomVisual } from "../src/core/personalization-catalog.js";

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sections = path.join(frontend, "src", "sections");

async function sectionSources() {
  const files = (await readdir(sections)).filter((name) => name.endsWith(".js"));
  return Promise.all(
    files.map(async (name) => ({ name, source: await readFile(path.join(sections, name), "utf8") })),
  );
}

test("canonical room/action visuals never create blue SVG first frames", () => {
  assert.match(roomVisual("mdi:bed-king-outline", 40), /🛏️/);
  assert.match(actionVisual("mdi:lightbulb", 40), /💡/);
  assert.doesNotMatch(roomVisual("mdi:bed-king-outline", 40), /<svg|ha-icon/);
  assert.doesNotMatch(actionVisual("mdi:lightbulb", 40), /<svg|ha-icon/);
});

test("only icon-engine creates the shared visual picker", async () => {
  const sources = await sectionSources();
  const creators = sources
    .filter(({ source }) => /modal\.id\s*=\s*["']dm-visual-picker["']/.test(source))
    .map(({ name }) => name);
  assert.deepEqual(creators, ["icon-engine-section.js"]);
});

test("legacy icon owners delegate and no delayed public repaint loop remains", async () => {
  const betaEntry = await readFile(path.join(sections, "beta-entry-section.js"), "utf8");
  const beta12Lock = await readFile(path.join(sections, "beta12-room-color-lock-section.js"), "utf8");
  const beta17 = await readFile(path.join(sections, "beta17-final-icon-polish-section.js"), "utf8");
  const engine = await readFile(path.join(sections, "icon-engine-section.js"), "utf8");
  assert.doesNotMatch(betaEntry, /scheduleV01525QuickActionRepair|\[0, 90, 320, 900\]/);
  assert.doesNotMatch(beta12Lock, /MutationObserver|repairVisualPicker|repairQuickActionNode/);
  assert.doesNotMatch(beta17, /openStableRoomPicker|openStableActionPicker|queuePreviewRepair/);
  assert.match(engine, /addEventListener\?\.\("click", handleActivation, true\)/);
  assert.match(engine, /canonicalRoomGlyph/);
  assert.match(engine, /ROOM_CATALOG\.find\(\(item\) => clean\(item\.mdi\)\.toLowerCase\(\) === lower\)/);
  assert.match(engine, /pointer:fine/);
  assert.doesNotMatch(engine, /setTimeout\?\.\([^)]*focus|setTimeout\([^)]*focus/);
});

test("single owner survives legacy listeners without pseudo duplicates", async () => {
  const engine = await readFile(path.join(sections, "icon-engine-section.js"), "utf8");
  assert.match(engine, /scheduleEditorIconSurfaces/);
  assert.match(engine, /queueMicrotask/);
  assert.match(engine, /dmBeta12DisplayGlyph = glyph/);
  assert.doesNotMatch(
    engine,
    /data-dm-icon-engine-glyph-value[^\n]*::before\s*\{[^}]*content\s*:\s*attr\(/s,
  );
});

test("single owner escapes custom glyph markup and preserves builtin action colors", async () => {
  const engine = await readFile(path.join(sections, "icon-engine-section.js"), "utf8");
  assert.match(engine, /\$\{esc\(glyph\)\}/);
  assert.match(engine, /luci: "#f59e0b"/);
  assert.match(engine, /antifurto: "#7c3aed"/);
  assert.match(engine, /ACTION_BUILTIN_COLORS\[actionBuiltinKey\(action\)\]/);
});
