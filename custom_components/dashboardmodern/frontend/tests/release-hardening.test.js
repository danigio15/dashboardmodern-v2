import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

/* Le librerie e i caratteri stanno in casa, e sono ancora quei byte li'.
 *
 * La testata apriva quattro connessioni verso l'esterno prima di disegnare
 * qualsiasi cosa, e nessuna delle quattro era rimandata: il foglio dei
 * caratteri di Google e tre script di jsdelivr fermavano la lettura della
 * pagina finche' non arrivavano. Home Assistant sta in casa, e molte case sul
 * quadro non hanno internet: li' la plancia non era lenta, era ferma, e
 * ripartiva soltanto quando il browser si arrendeva da solo.
 *
 * Adesso quei quattro pezzi li serve l'integrazione. L'impronta che stava
 * negli attributi `integrity` non e' andata persa: si controlla qui, sui byte
 * committati, a ogni giro di prove. */
const VENDOR = "custom_components/dashboardmodern/frontend/legacy/vendor/";
const IMPRONTE = Object.freeze({
  "chart.umd.min.js": "sha384-jb8JQMbMoBUzgWatfe6COACi2ljcDdZQ2OxczGA3bGNeWe+6DChMTBJemed7ZnvJ",
  "hls.min.js": "sha384-A+DTEBcAPU1Pk7Lby1xo6mi1AwflNlm+ojz8+BPFLErHgB1ZIgxfykSGIG+sPtC5",
});

test("the dashboard head asks the internet for nothing", async () => {
  for (const file of [
    "custom_components/dashboardmodern/frontend/legacy/dashboard.html",
    "custom_components/dashboardmodern/frontend/legacy/dashboard-en.html",
  ]) {
    const source = await read(file);
    const testata = source.slice(0, source.indexOf("</head>"));
    assert.doesNotMatch(testata, /(?:src|href)="https?:\/\//, `${file}: la testata scarica ancora da fuori`);
    assert.match(source, /<script src="\.\/vendor\/chart\.umd\.min\.js"><\/script>/);
    // panzoom non l'ha mai chiamato nessuno: la mappa del robot si sposta con
    // le sue trasformazioni. hls.js pesa mezzo mega e serve solo quando si
    // apre una telecamera, quindi non deve fermare la lettura della pagina.
    assert.doesNotMatch(source, /panzoom/);
    assert.match(source, /<script defer src="\.\/vendor\/hls\.min\.js"><\/script>/);
    /* Il foglio dei caratteri si carica senza bloccare la prima dipintura:
     * media="print" finche' non e' arrivato, poi torna per tutti. E' sicuro
     * perche' il velo d'avvio copre la pagina finche' il runtime non e'
     * pronto. */
    assert.match(
      source,
      /<link rel="stylesheet" href="\.\/vendor\/caratteri\.css" media="print" onload="this\.media='all'">/,
    );
  }
});

test("the vendored libraries are byte for byte the ones that were pinned", async () => {
  for (const [nome, attesa] of Object.entries(IMPRONTE)) {
    const bytes = await readFile(new URL(VENDOR + nome, root));
    const vista = `sha384-${createHash("sha384").update(bytes).digest("base64")}`;
    assert.equal(vista, attesa, `${nome}: impronta diversa da quella firmata`);
  }
});

test("the vendored stylesheet only points at fonts that are actually there", async () => {
  const foglio = await read(`${VENDOR}caratteri.css`);
  const chiesti = [...foglio.matchAll(/url\(\.\/fonts\/([^)]+)\)/g)].map((m) => m[1]);
  assert.equal(chiesti.length >= 30, true, "il foglio dei caratteri e' quasi vuoto");
  for (const file of new Set(chiesti)) {
    await access(new URL(`${VENDOR}fonts/${file}`, root));
  }
  // Senza questi due suffissi Home Assistant non servirebbe i caratteri.
  const frontend = await read("custom_components/dashboardmodern/frontend.py");
  assert.match(frontend, /"\.woff2"/);
  assert.match(frontend, /"\.woff"/);
});

test("future re-vendoring keeps serving those assets from the integration", async () => {
  const source = await read("scripts/vendor_legacy.py");
  assert.match(source, /_pin_cdn_dependencies/);
  assert.match(source, /CHART_LOCAL/);
  assert.match(source, /HLS_LOCAL/);
  assert.match(source, /PANZOOM_LOCAL = ""|PANZOOM_LOCAL = ''/);
  assert.match(source, /FONTS_LOCAL/);
  const giro = await read("scripts/porta-in-casa-le-librerie.mjs");
  for (const attesa of Object.values(IMPRONTE)) assert.match(giro, new RegExp(attesa.replace(/[+/]/g, "\\$&")));
});

test("frontend registration hashes off-loop once and exposes only explicit runtime assets", async () => {
  const source = await read("custom_components/dashboardmodern/frontend.py");
  assert.match(source, /async_add_executor_job\(_frontend_asset_version\)/);
  assert.match(source, /relative_to\(FRONTEND_DIR\)\.as_posix\(\)/);
  assert.match(source, /IGNORED_RUNTIME_FILES/);
  assert.match(source, /add_extra_js_url/);
  assert.doesNotMatch(source, /DATA_EXTRA_MODULE_URL/);
});

test("build provenance is canonical and bridge message types are unique", async () => {
  const energy = await read("custom_components/dashboardmodern/frontend/src/sections/energy-section.js");
  assert.match(energy, /BUILD_INFO/);
  assert.doesNotMatch(energy, /const VERSION = ["']0\.15\.12["']/);
  const { ALLOWED_MESSAGE_TYPES } = await import("../src/legacy/bridge-socket.js");
  assert.equal(ALLOWED_MESSAGE_TYPES.length, new Set(ALLOWED_MESSAGE_TYPES).size);
});

test("Home Assistant strings use English source and the required HACS icon stays installed", async () => {
  const strings = JSON.parse(await read("custom_components/dashboardmodern/strings.json"));
  assert.equal(strings.config.step.user.title, "New DashboardModern panel");
  assert.match(strings.options.step.init.data_description.allowed_users, /UI visibility filter/);
  await access(new URL("custom_components/dashboardmodern/brand/icon.png", root));
});
