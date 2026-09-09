import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const polishUrl = new URL("../src/sections/beta11-real-device-polish-section.js", import.meta.url);
const entityGuardUrl = new URL("../src/sections/entity-picker-guard-section.js", import.meta.url);
const generatorUrl = new URL("../../../../scripts/generate_build_info.py", import.meta.url);
const sentinelUrl = new URL("../legacy/build-info.js", import.meta.url);

test("beta11 is loaded after the existing beta entry in generated and source builds", async () => {
  const [generator, sentinel] = await Promise.all([
    readFile(generatorUrl, "utf8"),
    readFile(sentinelUrl, "utf8"),
  ]);
  for (const source of [generator, sentinel]) {
    const entry = source.indexOf("beta-entry-section.js");
    const beta11 = source.indexOf("beta11-real-device-polish-section.js");
    assert.ok(entry >= 0);
    assert.ok(beta11 > entry);
  }
});

test("del riquadro del marchio resta la misura, non il comando", async () => {
  /* Questo modulo teneva le tendine allineate all'auto che credeva giusta, e
   * ridipingeva il riquadro. Era il terzo padrone dello stesso quadratino: se
   * n'e' andato, e con lui la firma dell'auto e i valori rimessi a forza.
   *
   * Quello che resta e' CSS: quanto e' grande il logo dentro il riquadro, e
   * come e' impaginata la card. Misurare non e' comandare — e per misurare non
   * serve sapere di quale auto si stia parlando. */
  const source = await readFile(polishUrl, "utf8");
  assert.doesNotMatch(source, /dispatchValue\(/);
  assert.doesNotMatch(source, /dmBeta11VehicleSignature/);
  assert.doesNotMatch(source, /cd_ev_car_active/);
  assert.match(source, /\.dm-leapmotor-mark/);
  assert.match(source, /width:108px!important/);
  assert.match(source, /height:48px!important/);
  assert.match(source, /grid-template-columns:112px minmax\(0,1fr\)!important/);
});

test("room rows preserve metadata and delegate icon rendering to the canonical engine", async () => {
  const source = await readFile(polishUrl, "utf8");
  assert.match(source, /function mergedRooms\(\)/);
  assert.match(source, /return \{ \.\.\.fallback, \.\.\.room \}/);
  assert.match(
    source,
    /icon\.dataset\.roomIcon = clean\(room\.icon \|\| icon\.dataset\.roomIcon \|\| "mdi:home"\)/,
  );
  assert.match(source, /DashboardModernIconEngine\?\.syncEditor\?\.\(\)/);
  assert.doesNotMatch(source, /icon\.innerHTML\s*=/);
  assert.doesNotMatch(source, /target\.innerHTML\s*=\s*roomMarkup/);
  assert.doesNotMatch(source, /function roomMarkup\(/);
  assert.match(source, /label\.textContent = name/);
  assert.match(source, /label\.dataset\.dmRoomName = "true"/);
  assert.match(source, /visibility:visible!important;opacity:1!important/);
  assert.match(source, /\.ed-row-new/);
});

test("alerts get an expanded coherent visual picker without polling", async () => {
  const source = await readFile(polishUrl, "utf8");
  const catalogEntries = [...source.matchAll(/^\s*\["[^\"]+",\s*"[^\"]+",\s*"[^\"]+",/gm)];
  assert.ok(
    catalogEntries.length >= 35,
    `expected at least 35 alert icons, got ${catalogEntries.length}`,
  );
  assert.match(source, /dm-beta11-alert-picker/);
  assert.match(source, /dm-beta11-alert-grid/);
  assert.match(source, /data-alert-icon/);
  assert.match(source, /input\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/);
  assert.doesNotMatch(source, /\bnew\s+(?:root\.)?MutationObserver\s*\(/);
  assert.doesNotMatch(source, /setInterval\s*\(/);
});

test("l'icona degli avvisi ha un menu solo: l'anteprima", async () => {
  /* La riga dell'icona era arrivata ad avere due tasti-menu: l'anteprima che
   * apre il catalogo, e accanto la vecchia lente legacy ridipinta 🎨, che
   * apriva un selettore suo. Due menu per la stessa icona sono uno di troppo:
   * il tasto di prima si ritira — resta marcato, cosi' un click arrivato
   * prima della vestizione finisce comunque sul catalogo — e la riga ha due
   * colonne, non tre. */
  const source = await readFile(polishUrl, "utf8");
  assert.match(source, /button\.hidden = true/);
  assert.doesNotMatch(source, /button\.textContent = "🎨"/);
  /* Nascosta per la classe dell'altro modulo quando c'è, e per il nostro segno
   * quando quella classe non è ancora arrivata. */
  assert.match(source, /\.dm-beta11-alert-icon-row>\.dm-beta5-alert-icon-trigger,/);
  assert.match(
    source,
    /\.dm-beta11-alert-icon-row>\[data-dm-beta11-alert-picker="true"\]\{display:none!important\}/,
  );
  assert.match(
    source,
    /dm-beta11-alert-icon-row\{display:grid!important;grid-template-columns:64px minmax\(0,1fr\)!important/,
  );
  assert.match(source, /button\.dataset\.dmBeta11AlertPicker = "true"/);
});

test("plain-text and typed editor fields never receive entity picker buttons", async () => {
  const source = await readFile(entityGuardUrl, "utf8");
  assert.match(source, /id\.startsWith\("ed-avv-"\)\) return id === "ed-avv-ent"/);
  // Alert name/value/icon plus the camera, irrigation and shutter names sit
  // under an entity-shaped prefix but hold plain text.
  for (const id of [
    "ed-avv-name",
    "ed-avv-val",
    "ed-avv-icon",
    "ed-cam-name",
    "ed-cam-stream",
    "ed-irr-name",
    "ed-tp-name",
  ])
    assert.match(source, new RegExp(`NON_ENTITY_IDS = new Set\\(\\[[^\\]]*"${id}"`, "s"), id);
  // Durations, thresholds, times and flags cannot hold an entity_id at all.
  assert.match(source, /PICKABLE_TYPES = new Set\(\["text", "search", "url"\]\)/);
  assert.match(source, /!PICKABLE_TYPES\.has\(input\.type\)\) return false/);
  assert.match(source, /cleanupFalsePicker\(input\)/);
  assert.doesNotMatch(source, /\|avv-\)/);
});
test("l'anteprima dell'icona di un avviso disegna i nomi mdi col motore (dal campo)", async () => {
  /* «Nella sezione widget avvisi non si vedono icone»: con «mdi:door-closed»
   * nel campo, l'anteprima stampava la scritta a caratteri cubitali al posto
   * di una porta. Il nome mdi va al motore delle icone, come nelle righe della
   * Home; l'emoji resta emoji. */
  const { readFile } = await import("node:fs/promises");
  const sezione = await readFile(
    new URL("../src/sections/beta11-real-device-polish-section.js", import.meta.url),
    "utf8",
  );
  assert.match(
    sezione,
    /const disegnata = \/\^mdi:\/i\.test\(valore\)\s*\?\s*root\.DashboardModernIconEngine\?\.markup\?\.\("action", valore, \{ size: 34 \}\) \|\| ""\s*:\s*"";/,
  );
  assert.match(
    sezione,
    /if \(disegnata\) preview\.innerHTML = disegnata;\s*else preview\.textContent = valore;/,
  );
  assert.equal(/preview\.textContent = clean\(input\.value\) \|\| "🔔";/.test(sezione), false);
  /* E il riquadro non lascia piu' uscire un testo lungo. */
  assert.match(
    sezione,
    /\.dm-beta11-alert-preview\{overflow:hidden!important;word-break:break-all!important\}/,
  );
});

/* Le lenti dell'avviso si ritirano tutte, non solo la prima.
 *
 * L'editor storico, dopo un ridisegno parziale, può lasciare in piedi un
 * secondo pannello con la sua copia del campo `#ed-avv-icon`.
 * `getElementById` ne vede una sola: la lente dell'altra restava com'era — non
 * ritirata e non marcata — e chi ci arrivava sopra riapriva il vecchio
 * selettore accanto all'anteprima, cioè i «due menu per inserire icona» che
 * questa vestizione esiste per togliere. Su iPad è successo davvero, e la
 * prova e2e l'ha visto sull'ultima lente della pagina.
 */
test("di caselle avviso ce ne può essere più d'una, e si vestono tutte", async () => {
  const source = await readFile(polishUrl, "utf8");
  /* Non «la prima che si trova»: tutte quelle che ci sono. */
  assert.match(source, /doc\?\.querySelectorAll\?\.\("#ed-avv-icon"\)/);
  assert.doesNotMatch(source, /getElementById\("ed-avv-icon"\)/);
  assert.match(source, /for \(const casella of caselle\) if \(vestiIlCampoAvviso\(casella\)\)/);
  /* E il click si prende ogni lente, marcata o no: la marcatura dice che la
   * vestizione c'è passata, non se quel tasto può aprire il catalogo. Un menu
   * solo vale anche per la lente che la vestizione non ha ancora raggiunto. */
  assert.match(source, /\.dm-beta5-alert-icon-trigger,\[data-dm-beta11-alert-picker="true"\]/);
});

test("la lente si riconosce da sola, senza aspettare un altro modulo", async () => {
  /* La classe `dm-beta5-alert-icon-trigger` non è di questo modulo: gliela mette
   * la rifinitura da telefono, con un classList.add in una sua passata.
   * Cercarla voleva dire dipendere da quale delle due passate arriva prima —
   * che dipende dal carico — e su un iPad con sette prove in parallelo
   * arrivava prima la nostra: qui non c'era ancora nessuna classe da
   * riconoscere, e la lente restava nascosta dal foglio ma non ritirata. È lo
   * stato a intermittenza che ha fermato il rilascio della 1.4.15 due volte.
   *
   * Aspettare l'altro modulo vorrebbe dire un orecchio o un secondo giro, e
   * questo modulo non ne vuole: è la prova qui sopra a dirlo. Ma non serve —
   * nella riga della casella i tasti sono due, l'anteprima e la lente, e
   * l'anteprima è la nostra.
   */
  const source = await readFile(polishUrl, "utf8");
  assert.match(source, /function ritiraLeLenti\(row, preview\)/);
  assert.match(source, /row\.querySelectorAll\(":scope > button"\)/);
  assert.match(source, /if \(button === preview\) continue;/);
  /* E niente sorveglianti: questo modulo non ne ha, e la prova di sopra lo
   * verifica — qui si guarda che non siano rientrati da una porta di servizio,
   * cioè con un altro nome. */
  assert.doesNotMatch(source, /MutationObserver/);
  /* Il foglio nasconde per il NOSTRO segno, non per la classe di un altro. */
  assert.match(source, /\[data-dm-beta11-alert-picker="true"\]\{display:none!important\}/);
  /* E il click si prende la lente anche prima che l'altro modulo la battezzi. */
  assert.match(source, /\.dm-beta5-alert-icon-trigger,\[data-dm-beta11-alert-picker="true"\]/);
  /* L'anteprima si riscrive solo quando cambia: meno lavoro a ogni passata. */
  assert.match(source, /if \(preview\.dataset\.alertIcon !== valore\) \{/);
});
