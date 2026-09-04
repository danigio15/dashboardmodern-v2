// DM-FIX-20260813H
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

test("la finestra di conferma la disegna il motore, e nessuno la aggira", async () => {
  /* «Azioni rapide: quando si utilizza la domanda nella schermata non e'
   * visibile l'icona impostata, ma solo il testo di configurazione» (#320).
   * `confermaAzione` scrive l'icona con `setTxt`, cioe' come testo: un nome
   * mdi li' si legge scritto. Il padrone e' lo stesso di tutte le altre
   * superfici, e si mette dietro alla finestra con lo stesso `wrapAfter` che
   * usa per la griglia delle azioni. */
  const motore = await readFile(path.join(sections, "icon-engine-section.js"), "utf8");
  assert.match(motore, /wrapAfter\("confermaAzione", "__dmIconEngineConferma"/);
  assert.match(motore, /getElementById\?\.\("confirm-icon"\)/);
  assert.match(motore, /renderIconGlyph\(bersaglio, "action", token/);
  /* Vince il testo appena scritto: il ricordo serve solo dove c'e' gia' un
   * disegno nostro, che di testo non ne ha. Al contrario, la seconda domanda
   * mostrerebbe l'icona della prima. */
  assert.match(motore, /const scritto = clean\(bersaglio\.textContent\);\s*\n\s*const token = scritto \|\| clean\(bersaglio\.dataset\.dmToken\);/);

  /* E nessuna sezione se la cava sostituendo il nome mdi con un'emoji prima
   * di chiamare la finestra: era la pezza delle porte, e adesso che la
   * finestra disegna non serve piu' a nessuno. */
  for (const { name, source } of await sectionSources()) {
    const chiamate = source.split("confermaAzione(").slice(1);
    for (const pezzo of chiamate) {
      const testa = pezzo.slice(0, 400);
      assert.doesNotMatch(
        testa,
        /\/\^mdi:\/i\.test|startsWith\("mdi:"\)/,
        `${name} aggira la finestra invece di lasciarle disegnare l'icona`,
      );
    }
  }
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

test("final owner guard is scoped and microtask-driven inside the existing beta entry", async () => {
  const betaEntry = await readFile(path.join(sections, "beta-entry-section.js"), "utf8");
  assert.match(betaEntry, /__DASHBOARDMODERN_ICON_ENGINE_OWNER_GUARD__/);
  assert.match(betaEntry, /new MutationObserver\(queueOwnedIconSync\)/);
  assert.match(betaEntry, /\["ed-body", "qa-grid", "temp-grid"\]/);
  assert.match(betaEntry, /queueMicrotask\(syncOwnedIconSurfaces\)/);
  assert.match(betaEntry, /engine\.syncQuickActions\?\.\(\)/);
  assert.match(betaEntry, /engine\.syncEditor\?\.\(\)/);
  assert.doesNotMatch(
    betaEntry,
    /\.observe\s*\(\s*(?:document|document\.body|document\.documentElement)\b|setInterval\s*\(/,
  );
});
