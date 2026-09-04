/* Due contatti su un serramento solo (#254).
 *
 * «Non ho le tapparelle. Sarebbe possibile una card che consideri due sensori
 * di contatto, uno per le inferriate esterne e uno per gli infissi interni?
 * Un'immagine che consideri i vari stati.» Gli stati sono quattro, e queste
 * prove li tengono fermi tutti — compreso quello che non si puo' evitare: un
 * sensore che non risponde.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  INFERRIATA_KEYS,
  STATI_SERRAMENTO,
  contactEntity,
  inferriataEntity,
  isWindowOnly,
  serramentoModel,
  shutterWindowModel,
  statoDelSerramento,
} from "../src/core/shutter-window.js";

const acceso = (nome) => ({ [nome]: { state: "on" } });
const spento = (nome) => ({ [nome]: { state: "off" } });

test("i quattro stati che si volevano distinguere", () => {
  assert.equal(statoDelSerramento(false, false), "chiuso");
  assert.equal(statoDelSerramento(true, false), "grata");
  assert.equal(statoDelSerramento(false, true), "infisso");
  assert.equal(statoDelSerramento(true, true), "aperto");
  // Tutti e quattro sono nomi dichiarati: chi disegna non deve indovinarli.
  for (const stato of ["chiuso", "grata", "infisso", "aperto"]) {
    assert.ok(STATI_SERRAMENTO.includes(stato));
  }
});

test("un sensore muto non diventa una finestra chiusa", () => {
  // Se non risponde nessuno dei due non si sa niente, e si dice cosi'.
  assert.equal(statoDelSerramento(null, null), "ignoto");
  // Se ne risponde uno solo, quello parla: la grata muta non zittisce la
  // finestra aperta, che e' proprio la cosa che si vuole sapere.
  assert.equal(statoDelSerramento(null, true), "infisso");
  assert.equal(statoDelSerramento(null, false), "chiuso");
  assert.equal(statoDelSerramento(true, null), "grata");
  assert.equal(statoDelSerramento(false, null), "chiuso");
});

test("la casella dell'inferriata si legge coi nomi che la gente usa", () => {
  assert.equal(inferriataEntity({ inferriata: "binary_sensor.grata" }), "binary_sensor.grata");
  assert.equal(inferriataEntity({ grate_entity: "binary_sensor.g" }), "binary_sensor.g");
  assert.equal(inferriataEntity({ outer_contact: "binary_sensor.o" }), "binary_sensor.o");
  assert.equal(inferriataEntity({}), "");
  // E non si confonde con quella dell'infisso: sono due caselle diverse.
  assert.equal(inferriataEntity({ contact: "binary_sensor.finestra" }), "");
  assert.equal(contactEntity({ inferriata: "binary_sensor.grata" }), "");
  for (const chiave of INFERRIATA_KEYS) {
    assert.equal(inferriataEntity({ [chiave]: "binary_sensor.x" }), "binary_sensor.x");
  }
});

test("il serramento intero: grata davanti, infisso dietro", () => {
  const riga = { inferriata: "binary_sensor.grata", contact: "binary_sensor.finestra" };
  const tuttoChiuso = serramentoModel(riga, {
    ...spento("binary_sensor.grata"),
    ...spento("binary_sensor.finestra"),
  });
  assert.equal(tuttoChiuso.stato, "chiuso");
  assert.equal(tuttoChiuso.inferriata.configured, true);
  assert.equal(tuttoChiuso.infisso.configured, true);

  assert.equal(
    serramentoModel(riga, { ...acceso("binary_sensor.grata"), ...spento("binary_sensor.finestra") })
      .stato,
    "grata",
  );
  assert.equal(
    serramentoModel(riga, { ...spento("binary_sensor.grata"), ...acceso("binary_sensor.finestra") })
      .stato,
    "infisso",
  );
  assert.equal(
    serramentoModel(riga, { ...acceso("binary_sensor.grata"), ...acceso("binary_sensor.finestra") })
      .stato,
    "aperto",
  );
});

test("chi ha una casella sola non ne vede due", () => {
  const soloFinestra = serramentoModel(
    { contact: "binary_sensor.finestra" },
    acceso("binary_sensor.finestra"),
  );
  assert.equal(soloFinestra.inferriata.configured, false);
  assert.equal(soloFinestra.stato, "infisso");

  const soloGrata = serramentoModel(
    { inferriata: "binary_sensor.grata" },
    acceso("binary_sensor.grata"),
  );
  assert.equal(soloGrata.infisso.configured, false);
  assert.equal(soloGrata.stato, "grata");
});

test("il verso girato vale per tutti e due i contatti", () => {
  /* Il #244: certi contatti stanno a ON quando l'infisso e' CHIUSO. Il verso
   * e' un fatto del filo, non del tipo di apertura: se vale per la finestra
   * deve valere per la grata. */
  const riga = { inferriata: "binary_sensor.grata", contact: "binary_sensor.finestra" };
  const stati = { ...acceso("binary_sensor.grata"), ...acceso("binary_sensor.finestra") };
  const dritto = serramentoModel(riga, stati, (v) => v, new Set());
  assert.equal(dritto.stato, "aperto");

  const grataGirata = serramentoModel(riga, stati, (v) => v, new Set(["binary_sensor.grata"]));
  assert.equal(grataGirata.stato, "infisso");

  const entrambeGirate = serramentoModel(
    riga,
    stati,
    (v) => v,
    new Set(["binary_sensor.grata", "binary_sensor.finestra"]),
  );
  assert.equal(entrambeGirate.stato, "chiuso");
});

test("una riga con le sole grate si puo' salvare", () => {
  /* Era gia' vero per il solo contatto dell'infisso — «ho le persiane manuali,
   * pero' ho i sensori di apertura» — e vale per lo stesso motivo: la riga non
   * comanda niente ma ha qualcosa da dire. */
  assert.equal(isWindowOnly({ inferriata: "binary_sensor.grata" }), true);
  assert.equal(isWindowOnly({ contact: "binary_sensor.finestra" }), true);
  assert.equal(isWindowOnly({}), false);
  // Con un motore non e' piu' una finestra sola: e' una copertura.
  assert.equal(isWindowOnly({ entity: "cover.a", inferriata: "binary_sensor.g" }), false);
});

test("la lettura del solo infisso resta quella di prima", () => {
  /* `shutterWindowModel` la usa ancora chi legge un contatto solo: il modello
   * nuovo non deve averla cambiata sotto i piedi. */
  const model = shutterWindowModel({ contact: "binary_sensor.a" }, acceso("binary_sensor.a"));
  assert.deepEqual(model, { entity: "binary_sensor.a", open: true, configured: true });
  assert.deepEqual(shutterWindowModel({}, {}), { entity: "", open: null, configured: false });
});

test("la pagina disegna la grata, e solo dove qualcuno l'ha dichiarata", async () => {
  const source = await readFile(
    new URL("../src/sections/shutter-window-section.js", import.meta.url),
    "utf8",
  );
  // Il nodo della grata esiste sempre ma resta spento senza il sensore: la
  // card di chi non ha inferriate non deve cambiare di un pixel.
  assert.match(source, /dm-tw-grata/);
  assert.match(source, /\.dm-tw-grata\{[^}]*display:none!important\}/);
  assert.match(source, /tapp-win\[data-dm-grata\] \.dm-tw-grata\{display:block!important\}/);
  // Sta davanti all'infisso, perche' l'inferriata sta fuori.
  assert.match(source, /\.dm-tw-grata\{[^}]*z-index:8!important/);
  // E la casella per dichiararla c'e'.
  assert.match(source, /ed-tp-inferriata/);
});

test("le quattro parole della pastiglia", async () => {
  const { paroleDelSerramento } = await import(
    `../src/sections/shutter-window-section.js?fix=${Date.now()}`
  );
  const con = (stato, grata = true) => ({
    stato,
    inferriata: { configured: grata },
    infisso: { open: stato === "infisso" || stato === "aperto" },
  });
  assert.equal(paroleDelSerramento(con("chiuso")), "");
  assert.ok(paroleDelSerramento(con("grata")).length > 0);
  assert.ok(paroleDelSerramento(con("infisso")).length > 0);
  assert.notEqual(paroleDelSerramento(con("grata")), paroleDelSerramento(con("infisso")));
  assert.notEqual(paroleDelSerramento(con("aperto")), paroleDelSerramento(con("grata")));
  // Senza inferriata dichiarata resta la frase di sempre, e a card chiusa
  // nessuna pastiglia.
  assert.equal(paroleDelSerramento({ stato: "chiuso", inferriata: {}, infisso: {} }), "");
  assert.ok(
    paroleDelSerramento({ stato: "infisso", inferriata: {}, infisso: { open: true } }).length > 0,
  );
});

test("l'inferriata sopravvive alla normalizzazione della riga (#297)", async () => {
  /* «Nella configurazione mi permette di inserire le due entita', ma se vado
   * poi in modifica vedo solamente l'infisso, e nell'animazione vedo solo
   * quando chiudo la finestra.» I due sintomi sono lo stesso campo perso nello
   * stesso punto: la scheda salvava `inferriata`, il modello canonico tiene
   * solo i campi che conosce, e questo non lo conosceva. La riga tornava
   * senza grata alla prima normalizzazione — cioe' subito. */
  const { normalizeDevice } = await import("../src/core/device-model.js");
  const riga = normalizeDevice(
    {
      name: "Camera",
      entity: "cover.camera",
      contact: "binary_sensor.finestra_camera",
      inferriata: "binary_sensor.inferriata_camera",
    },
    "covers",
    { rooms: [], index: 0 },
  );
  assert.equal(riga.contact, "binary_sensor.finestra_camera");
  assert.equal(riga.inferriata, "binary_sensor.inferriata_camera");
  assert.equal(inferriataEntity(riga), "binary_sensor.inferriata_camera");
  /* E chi non ha la grata non si ritrova una casella vuota addosso. */
  const senza = normalizeDevice({ entity: "cover.salone" }, "covers", { rooms: [], index: 0 });
  assert.equal("inferriata" in senza, false);
});

test("la grata si chiude a sbarre trasversali, e prima della finestra (#297)", async () => {
  /* «Sarebbe ottimale vedere l'inferriata che si chiude, a barre trasversali
   * sull'immagine, e poi la finestra.» Da chiusa le due meta' si incontrano e
   * le traverse corrono da bordo a bordo; e l'ordine e' quello delle mani:
   * chiudendo si tira la grata e poi si accostano le ante, aprendo si spingono
   * le ante e poi si scosta la grata. Senza grata dichiarata niente ritardo. */
  const sezione = await readFile(
    new URL("../src/sections/shutter-window-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sezione, /\.tapp-win\[data-dm-grata="chiusa"\] \.dm-tw-grata-meta\{\s*transform:scaleX\(1\)/);
  assert.match(
    sezione,
    /repeating-linear-gradient\(180deg,\s*rgba\(148,163,184,0\) 0 18px,rgba\(148,163,184,\.92\) 18px 21px\)/,
  );
  assert.match(
    sezione,
    /\.tapp-win\[data-dm-grata\]\[data-dm-infisso-stato="chiuso"\] \.dm-tw-anta\{\s*transition-delay:\.9s/,
  );
  assert.match(sezione, /\.tapp-win\[data-dm-grata="aperta"\] \.dm-tw-grata-meta\{\s*transition-delay:\.9s/);
});

test("le sbarre sono di un grigio chiaro e sfumato, non scure (dal campo)", async () => {
  /* «Le grate vanno benissimo ma essendo molto scure quando sono chiuse e la
   * finestra e' aperta visivamente non e' il massimo: un grigio sfumato
   * sarebbe meglio.» Il ferro e' grigio chiaro dappertutto, e dove il browser
   * sa mascherare la sbarra e' una tinta che va dal chiaro in alto al pieno in
   * basso: il ritaglio a sbarre lo fa la maschera, il colore e' un fondo solo.
   * Chi non sa mascherare tiene la stessa forma senza la sfumatura. */
  const sezione = await readFile(
    new URL("../src/sections/shutter-window-section.js", import.meta.url),
    "utf8",
  );
  assert.equal(/51,65,85/.test(sezione), false, "il grigio scuro di prima non c'e' piu'");
  assert.match(sezione, /\.dm-tw-grata-meta\{[^}]*rgba\(148,163,184,\.9\) 0 3px/);
  assert.match(sezione, /@supports \(mask-image:linear-gradient\(#000,#000\)\) or \(-webkit-mask-image:linear-gradient\(#000,#000\)\)\{/);
  /* Dentro il ramo con la maschera: il fondo e' la sfumatura, la maschera le sbarre. */
  const ramo = sezione.slice(sezione.indexOf("@supports (mask-image"));
  assert.match(ramo, /linear-gradient\(180deg,#e2e8f0 0%,#b4bfcd 55%,#8593a7 100%\)!important/);
  assert.match(ramo, /-webkit-mask-image:\s*repeating-linear-gradient\(90deg,#000 0 3px,transparent 3px 21px\)/);
  assert.match(ramo, /mask-image:\s*repeating-linear-gradient\(90deg,#000 0 3px,transparent 3px 21px\)/);
  /* Da chiusa, anche le traverse sono nella maschera, ogni ventuno pixel. */
  assert.match(
    ramo,
    /\[data-dm-grata="chiusa"\] \.dm-tw-grata-meta\{[\s\S]*?repeating-linear-gradient\(180deg,transparent 0 18px,#000 18px 21px\)/,
  );
  /* E la sfumatura non porta piu' l'ombra pensata per il colore pieno. */
  assert.match(ramo, /filter:none!important/);
});

test("la finestra di modifica ha la casella della grata e la soglia della riga (dal campo)", async () => {
  /* «Se entro poi in modifica della finestra (dopo averla definita) non ho
   * piu' la possibilita' di modificare l'entita' dell'inferriata.» La finestra
   * di modifica nasceva prima della grata e non l'aveva mai avuta: la riga la
   * portava con se' da `...item`, ma cambiarla o toglierla voleva dire
   * cancellare la riga e rifarla. Adesso la casella c'e', col suo cercatore,
   * e con lei la soglia di questa finestra — «ognuno puo' avere una
   * percentuale differente» — che in modifica mancava allo stesso modo. */
  const editor = await readFile(
    new URL("../src/sections/unified-editors-section.js", import.meta.url),
    "utf8",
  );
  const modale = editor.slice(editor.indexOf("function openShutterEditor("));
  assert.match(modale, /name="inferriata" value="\$\{esc\(inferriataEntity\(item\)\)\}"/);
  assert.match(modale, /data-pick-inferriata/);
  assert.match(modale, /\["\[data-pick-inferriata\]", "inferriata"\]/);
  assert.match(modale, /inferriata: clean\(form\.elements\.inferriata\?\.value\)/);
  /* Vuota, la grata non resta come casella vuota sulla riga. */
  assert.match(modale, /if \(!list\[index\]\.inferriata\) delete list\[index\]\.inferriata;/);
  /* E la grata e' un contatto: vale la regola del contatto. */
  assert.match(modale, /const grata = clean\(list\[index\]\.inferriata\);/);
  assert.match(modale, /\(contatto && !contattoValido\) \|\| !grataValida/);
  /* La soglia della riga: stessa etichetta, stesso segnaposto e stesso tetto
   * della casella che si compila quando la riga nasce. */
  assert.match(modale, /name="soglia" value="\$\{esc\(sogliaRiga\)\}"/);
  assert.match(modale, /max="\$\{SOGLIA_CHIUSA_MASSIMA\}"/);
  assert.match(modale, /t\("Chiusa sotto il \(%\)", "Closed below \(%\)"\)/);
  assert.match(modale, /t\("come la casa", "as the house"\)/);
  assert.match(modale, /list\[index\]\.soglia = coverClosedThreshold\(testoSoglia\);/);
  assert.match(modale, /else delete list\[index\]\.soglia;/);
});
