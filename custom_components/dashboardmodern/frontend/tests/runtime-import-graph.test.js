// DM-FIX-20260813A
import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticImportPattern = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
const dynamicImportPattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const productionEntries = Object.freeze([
  "legacy/config.js",
  "legacy/modules-entry.js",
  "panel.js",
  "dashboard-card.js",
]);
const obsoleteFacades = Object.freeze([
  "src/sections/home-section.js",
  "src/sections/climate-section.js",
  "src/sections/security-section.js",
  "src/sections/solar-thermal-section.js",
  "src/sections/pool-section.js",
  "src/sections/irrigation-section.js",
  "src/sections/minipc-section.js",
  "src/sections/legacy-section-adapter.js",
  "legacy/report-mobile-fixes.js",
]);

async function filesBelow(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await filesBelow(absolute)));
    else output.push(absolute);
  }
  return output;
}

function importSpecifiers(source) {
  return [
    ...[...source.matchAll(staticImportPattern)].map((match) => match[1]),
    ...[...source.matchAll(dynamicImportPattern)].map((match) => match[1]),
  ];
}

async function productionGraph(entries = productionEntries) {
  const seen = new Map();
  const edges = new Map();

  async function visit(file) {
    const normalized = path.normalize(file);
    if (seen.has(normalized)) return;
    const source = await readFile(normalized, "utf8");
    seen.set(normalized, source);
    const dependencies = [];
    edges.set(normalized, dependencies);
    for (const specifier of importSpecifiers(source)) {
      if (!specifier.startsWith(".")) continue;
      let next = path.resolve(path.dirname(normalized), specifier);
      if (!path.extname(next)) next += ".js";
      next = path.normalize(next);
      dependencies.push(next);
      await visit(next);
    }
  }

  for (const entry of entries) await visit(path.resolve(frontendRoot, entry));
  return { seen, edges };
}

function assertAcyclic(edges) {
  const active = new Set();
  const complete = new Set();
  function visit(file, chain = []) {
    if (complete.has(file)) return;
    if (active.has(file)) {
      const cycle = [...chain, file]
        .map((item) => path.relative(frontendRoot, item).replaceAll("\\", "/"))
        .join(" -> ");
      assert.fail(`production import cycle: ${cycle}`);
    }
    active.add(file);
    for (const dependency of edges.get(file) || []) visit(dependency, [...chain, file]);
    active.delete(file);
    complete.add(file);
  }
  for (const file of edges.keys()) visit(file);
}

test("production graph is single-owner, acyclic and contains no facade pass-throughs", async () => {
  const { seen: graph, edges } = await productionGraph();
  const relative = [...graph.keys()].map((file) =>
    path.relative(frontendRoot, file).replaceAll("\\", "/"),
  );
  const combined = [...graph.values()].join("\n");

  assert.equal(relative.filter((file) => file.endsWith("section-runtime.js")).length, 1);
  assert.equal(relative.filter((file) => file.endsWith("legacy-sections-registry.js")).length, 1);
  assert.deepEqual(relative.filter((file) => /legacy\/release-\d+/.test(file)), []);
  assert.deepEqual(
    relative.filter((file) =>
      /runtime-real-ha|runtime-residual|runtime-release-owner|runtime-regression-guard|runtime-consolidated/.test(file),
    ),
    [],
  );
  assert.deepEqual(
    relative.filter((file) =>
      /mobile-ui-fixes|alerts-runtime|vehicle-image-runtime|runtime-startup-coordinator|report-mobile-fixes/.test(file),
    ),
    [],
  );
  // v1 beta adds the persistence owner plus substantive UI owners. Beta4/Beta5
  // keep one scoped mobile-polish owner; Beta6 adds one event-driven feedback
  // owner. Beta7 adds exactly two scoped, event-driven guards for real WebView
  // failures: brand-image fallback and the final mobile regression polish.
  // Beta9 adds one final scoped event-driven real-device reconciler for the
  // screenshot-proven EV/editor/shutter conflicts, with no polling or observer.
  // Beta11 intentionally adds one final, scoped and event-driven owner for the
  // screenshot-proven EV logo, alert picker and room-label regressions.
  // Beta12 keeps its final action/room first-paint contract inside the existing
  // room-color lock; reset, temperature, shutters and energy flows were
  // consolidated into their existing production owners rather than new modules.
  // Beta16 intentionally adds one scoped owner for the screenshot-proven room
  // label, Temperature tab, compact Climate and Pool responsive contracts.
  // Beta17 keeps the scoped Temperature progress-copy guard. Beta18 adds one
  // canonical icon-engine owner while historical beta modules delegate instead
  // of repainting the same icon DOM. Beta20.2 adds exactly one canonical save
  // owner to close the legacy editor -> store -> visibility -> HA persistence
  // transaction. Beta22 adds one final scoped, event-driven corrective owner
  // that binds canonical Loads to the existing Energy flow slots, restores SOC,
  // Temperature room labels and Energy cost fields, without polling or a global
  // observer. Beta24 adds one boot-time recovery module for schema-v4 snapshots
  // that crossed the persistence rewrite; its only observer is scoped to the
  // single Battery SOC text node so competing legacy writes cannot visibly win.
  // Beta25 adds one event-driven owner for the three screenshot-proven real-device
  // regressions plus one compatibility owner that restores stable DOM/runtime
  // contracts after those targeted renders. Neither adds polling or observers.
  // Beta26 adds exactly one real-device stability owner; its only observer is
  // scoped to #temp-grid so saved primary labels win over delayed legacy repaints.
  // Beta27 adds one final event-driven real-device owner for compact appliance
  // geometry/theme/media contracts and single-owner Temperature room tabs. It
  // adds no polling or document-wide observer.
  // The appliance showcase redesign adds exactly four owners: the pure card
  // view-model, the cycle tracker, the photorealistic hero artwork and the
  // showcase section renderer. All four are event-driven (state-changed +
  // legacy render loop), with no polling and no observers.
  // The dynamic energy-flow stage adds exactly one owner: the pure topology and
  // view-model. The renderer itself lives in the existing energy-flow section,
  // which stays the single owner of the Flows stage; the Beta 22 corrective
  // stands down instead of a second module arriving to arbitrate between them.
  // The rebuilt Loads config adds two: the pure config model and the panel that
  // edits it. The Beta 26/27 hierarchy editor stands down in the same way, so
  // the Loads panel keeps exactly one renderer. The circle popup adds two more,
  // the same split: a pure model and the owner that renders it over the legacy
  // list, which is what makes the circle total and the popup total one number.
  // The Pool/Irrigation redesign adds exactly one owner: the scene section that
  // replaces both legacy paint functions. Beta11's stylesheet block and the
  // Beta12/14/16 pool correctives stood down into it, so the two pages have one
  // renderer and one stylesheet instead of five competing layers.
  // The Tapparelle redesign adds exactly one owner: the scene section that
  // replaces the legacy paint function so the page can carry a summary header,
  // per-room headings and a position track. It renders per structural
  // signature rather than per tick, keeps commands on the legacy cdTappCmd
  // handler, and adds no polling and no observer. The window skin stays in the
  // existing shutter section, which is still the single owner of the
  // first-paint geometry, so the two modules split structure from paint rather
  // than competing over the same declarations.
  // All facade/cycle/orphan/polling/global-observer checks stay active.
  // The Solar Thermal redesign adds exactly one owner: a style-and-labels module
  // for #page-boiler. It installs one stylesheet, fills the decorative labels the
  // legacy markup left empty and reads no Home Assistant state, so the page keeps
  // the legacy runtime as its single behavioural owner. It adds no polling, and
  // its only listener is a media query that swaps the portrait scene in.
  // The Security redesign adds exactly one owner: the section renderer that
  // repaints the alarm console and the camera grid. It is event-driven
  // (state-changed + legacy render loop), adds no polling and no observer, and
  // keeps the camera engine — apriCamera, the streaming strategies and
  // toggleFullScreenCam — in the legacy runtime instead of forking it.
  // The EV redesign adds exactly one owner: the skin for #page-ev. It moves the
  // battery block into a charge ring, mirrors the active EVCC mode onto the page
  // as an attribute and restyles the picker that ev-section.js keeps building.
  // It reads no Home Assistant state — the ring reads #ev-mod-batt-fill, the
  // rows carry legacy value classes — and adds no polling and no observer.
  // The fast entity search adds exactly two: the pure search index (folding,
  // ranking and field auto-detection) and the section that installs it over the
  // vendored `cdEpFilter`. No new picker is introduced — the canonical dialog
  // stays the only one — and the section is event-driven, with no polling and
  // no observer.
  // The Climate redesign adds exactly one owner: the section renderer for
  // #page-clima. It replaces buildClimaCards/updateClimaCards instead of adding
  // a layer on top, so the Beta 4 / Beta 7 / Beta 16 / personalization
  // corrections for the old .cp-card markup stop matching and the page keeps one
  // renderer and one stylesheet. It is event-driven (state-changed + the legacy
  // render loop) and leaves every service call — setTemp, toggleClima and the
  // HVAC/fan popup — in the legacy runtime.
  // The editor slot rows add exactly one owner: it decorates the rows the legacy
  // editor prints, hides the raw entity field behind "Modifica manuale" and
  // routes the tap to the legacy wzPickEntity(), which the fast search above
  // owns. No polling, no observer.
  // The Temperature trend panel adds exactly one owner: it draws the history
  // chart under the cards from the same history/history_during_period the card
  // popup already uses, follows the room tabs by reading the active tab, and
  // watches #temp-grid so any renderer rebuild redraws it. No polling.
  // The Luci redesign adds exactly two: the pure light model — capabilities,
  // colour maths and the service call for one requested change — and the scene
  // that owns the Gestione Luci popup and the control sheet of a single light.
  // The scene decorates `apriGestioneLuci` rather than replacing it, because
  // that function is the only writer of the runtime's lexical
  // `currentPopupType` and no module can reach a lexical binding; it repaints
  // the list in the same task, so the legacy markup is never shown. It renders
  // per structural signature rather than per tick, writes values into the
  // existing cards while the tick runs, and adds no polling and no observer.
  // The Luci editor keeps its own owner and now reads the same model, so the
  // capability badges in the tab and the controls in the popup cannot disagree.
  // The Config auto-detection adds two more of the same shape: the pure matcher
  // and the section that installs it over the vendored `edAutoRileva`, reusing
  // that index instead of building a second one.
  // The MiniPC redesign adds exactly one owner: the skin for #page-server. It
  // turns the three load bars into ring gauges that read those same bars, moves
  // the value nodes into the rings instead of copying them, mirrors the status
  // wording the legacy loop writes and follows #waw-net-badge for connectivity.
  // It reads no Home Assistant state, adds no polling and no observer, and never
  // forces a display the auto-hide writes inline on an unmapped card.
  // Beta 31 adds exactly one owner: the Configuration answers the same three
  // questions the same way on every tab — one section per tab, one visibility
  // switch, one save at the end — by reconciling what the tab renderers leave
  // behind. It renders no section content and saves nothing itself.
  // All facade/cycle/orphan/polling/global-observer checks stay active.
  // Beta 31.1 adds one more owner: every section of the dashboard opens with
  // the same heading — icon, name, and the line that says what the page is for
  // — instead of six different ideas of a title. It renders no data.
  // E uno ancora: il rientro nell'app. Il runtime apre la presa verso Home
  // Assistant una volta sola e, se quel tentativo salta, non ne prova altri —
  // su iPhone, dove il sistema butta via la pagina quando passi ad altra app,
  // la plancia restava ferma a "CONNECTING…". Quel modulo non apre nessuna
  // presa e non legge nessuno stato: richiama connect(), quello del runtime.
  // E due, insieme: la finestra dietro la tapparella. La card mostrava una
  // tapparella senza infisso; adesso in primo piano c'e' il telaio con le sue
  // ante, e un contatto sull'anta dice se sono aperte. La lettura del contatto
  // sta in un modulo puro perche' si possa provare senza browser, il disegno in
  // un modulo di sezione che non scrive dati: la posizione della tapparella
  // resta di chi la disegnava.
  // 110 con il cielo della sezione Tapparelle: la fascia del giorno sta in un
  // modulo puro — si prova senza browser — e chi la usa scrive solo un attributo
  // sulla pagina, perche' il disegno del cielo era gia' tutto in variabili.
  // 128 con le sezioni della 1.1.0.
  // 132 con la lingua. La plancia parlava due lingue perche' ne esistevano due
  // copie: il ternario `t(it, en)` in ogni sezione e due build separate del
  // runtime. I quattro moduli qui sono quello che rende la lingua un dato
  // invece di una biforcazione: il motore che risolve locale e cataloghi, la
  // passata che traduce il testo che il runtime vendorizzato stampa da solo,
  // l'indice che porta quel testo italiano alla sua chiave inglese, e la
  // sezione che accende il tutto prima che qualcuno disegni. I cataloghi delle
  // singole lingue non sono qui: si caricano su richiesta, uno solo per utente.
  // 134 con l'allagamento e col promemoria del chiosco. Il primo e' una lista
  // sorvegliata come le altre — la sua card nel Quadro Avvisi, il suo popup, la
  // sua voce in configurazione — e sta in un modulo perche' non e' una variante
  // di nessuna delle altre cinque. Il secondo e' il piccolo modulo puro che
  // dice come si disfa quello che il chiosco scrive nel documento di Home
  // Assistant: lo leggono in due, la plancia dentro la cornice e chi la ospita,
  // e sono due programmi diversi — un posto solo dove sta scritto e' l'unico
  // modo perche' chi smonta possa pulire anche quando la cornice non c'e' piu'.
  // 135 con l'identita' delle auto. Un profilo si e' sempre indicato con la sua
  // posizione nell'elenco, e una posizione cambia sotto i piedi: cancellata la
  // prima auto la seconda diventa la prima, e il numero salvato — anche quello
  // arrivato dalla configurazione condivisa di un altro dispositivo — indica
  // un'altra vettura. Il modulo dice chi e' un'auto, e lo dicono in quattro
  // posti diversi: la sezione Auto, la Personalizzazione, e le due passate che
  // riempiono la scheda. Una sola definizione, o tornano a divergere.
  // 136 con le fondamenta del tema scuro. «Scuro» scuriva le card una per una
  // ma le variabili di base — il fondo della pagina, il colore del testo —
  // non avevano mai avuto una versione notturna: card scure su pagina bianca.
  // Le ridefinizioni stanno in un modulo loro perche' sono la base che ogni
  // altra regola eredita, non il ritocco di una sezione.
  // 139 con le persone. Il modello puro dice chi abita la casa e cosa se ne
  // mostra — zona, batteria, ritratto — e lo leggono in due: la sezione che
  // disegna le card in cima alla Home e l'editor che scrive `cd_people`. Sono
  // due moduli perche' uno vive a ogni cambio di stato e l'altro solo dentro
  // la scheda di configurazione, come per il robot.
  // 140 con la verita' dei flussi. La mappa accendeva le linee un numero alla
  // volta — qualunque solare accendeva «solare → casa» anche quando finiva
  // tutto in batteria, e «rete → batteria» non esisteva. L'aritmetica della
  // spartizione sta in un modulo puro, provabile a tavolino; la legge la
  // sezione dei flussi che gia' possiede la scena.
  assert.ok(relative.length <= 140, `production graph unexpectedly grew to ${relative.length} modules`);
  assertAcyclic(edges);

  /* No polling, with two declared exceptions.
   *
   * A camera thumbnail is a still picture: nothing in Home Assistant pushes a
   * new one and the entity state does not change when the view does, so the
   * only way to keep the wall live is to ask again. That timer is armed by the
   * Sicurezza page being on screen and disarmed the moment it is not.
   *
   * The second counts the filtration seconds of the pools beyond the first —
   * the ones the vendored runtime does not know exist, and whose pump would
   * otherwise start and never stop. It follows the same discipline: armed when
   * one of those pumps starts running, disarmed the moment none is.
   *
   * The third ages the "16 h ago" of the person cards: nothing in Home
   * Assistant pushes an event when time merely passes, and on a wall-mounted
   * dashboard nobody touches the page. Same discipline again: armed only while
   * the Home page is on a visible screen with people configured, disarmed the
   * moment it is not.
   *
   * These are the intervals production is allowed, and they are named here so
   * another one cannot arrive unnoticed. */
  const intervals = [...graph.entries()].filter(([, source]) =>
    /setInterval\s*(?:\?\.)?\s*\(/.test(source),
  );
  assert.deepEqual(
    intervals.map(([file]) => path.relative(frontendRoot, file).replaceAll("\\", "/")).sort(),
    [
      "src/sections/live-ui-section.js",
      "src/sections/people-section.js",
      "src/sections/pool-extra-section.js",
    ],
  );

  const observers = [...graph.entries()].filter(([, source]) => /new\s+(?:root\.)?MutationObserver\s*\(/.test(source));
  // Beta17 contributes one page-scoped observer so delayed legacy writes on
  // #page-temp cannot resurrect the progress placeholder. Beta24 may add one
  // node-scoped SOC observer. Beta26 adds one #temp-grid-scoped observer. The
  // configuration uniformity owns one more, scoped to the children of #ed-body,
  // so the section switch and the save stay in place when a tab's own panels
  // arrive late. The MiniPC page owns one scoped to #page-server, so a heading
  // follows the block the auto-hide empties — the auto-hide is called from
  // inside the runtime, so there is no name to wrap. The loop below still
  // rejects observers rooted at document/body/documentElement.
  assert.ok(observers.length <= 7, `too many production observers: ${observers.length}`);
  for (const [file, source] of observers) {
    assert.doesNotMatch(
      source,
      /\.observe\s*\(\s*(?:document|doc|document\.body|doc\.body|document\.documentElement|doc\.documentElement)\b/,
      `${path.relative(frontendRoot, file)} must not observe the whole document`,
    );
  }

  const srcRoot = path.join(frontendRoot, "src");
  const srcFiles = (await filesBelow(srcRoot)).filter((file) => file.endsWith(".js"));
  const srcOrphans = srcFiles
    .filter((file) => !graph.has(path.normalize(file)))
    .map((file) => path.relative(frontendRoot, file).replaceAll("\\", "/"))
    .sort();

  /* The language catalogs are the one thing production reaches that a static
   * walk cannot see: `loadCatalog` imports `../i18n/<locale>.js` by computed
   * name, so exactly one of them is ever fetched and none of them appears as
   * an edge. Exempting them is only honest if the loader really does read that
   * directory, so that is asserted here rather than assumed — and the exemption
   * is narrow: a catalog must be named after a locale the registry declares,
   * which the i18n-catalogs contract checks in turn. */
  const engine = await readFile(path.join(srcRoot, "core/i18n.js"), "utf8");
  assert.match(
    engine,
    /import\(`\.\.\/i18n\/\$\{[^}]+\}\.js`\)/,
    "src/core/i18n.js no longer loads catalogs from src/i18n; the exemption below is stale",
  );
  const catalogs = srcOrphans.filter((file) => /^src\/i18n\/[A-Za-z-]+\.js$/.test(file));
  assert.ok(catalogs.length > 0, "no language catalogs found under src/i18n");

  const unreachable = srcOrphans.filter((file) => !catalogs.includes(file));
  assert.deepEqual(unreachable, [], `orphan src modules:\n${unreachable.join("\n")}`);
});

for (const relative of obsoleteFacades) {
  test(`${relative} is physically absent`, async () => {
    await assert.rejects(access(path.join(frontendRoot, relative)));
  });
}
