/* Il travaso delle foto sciolte si fa una volta, e poi mai piu'.
 *
 * Le due caselle `cd_ev_image` e `cd_ev_image_plugged` restano — sono il
 * disegno di adesso — ma non sono piu' il posto dove la foto abita: quello e'
 * il profilo dell'auto, che viaggia dentro `cd_ev_cars`. Il passaggio da un
 * mondo all'altro e' un travaso, e un travaso e' una migrazione.
 *
 * Finche' poteva ripartire, pero', cancellare una foto non bastava: la si
 * toglieva dal profilo su un dispositivo, la configurazione condivisa arrivava
 * qui, e il giro successivo ritrovava la vecchia casella ancora piena e la
 * rimetteva dentro al profilo vuoto. La cancellazione veniva annullata, e
 * magari rispedita agli altri.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("il travaso si segna, e segnato non riparte", () => {
  const sezione = leggi("sections/ev-section.js");
  assert.match(sezione, /const PHOTO_MIGRATION_KEY = "cd_ev_photos_moved"/);
  assert.match(
    sezione,
    /if \(root\.localStorage\?\.getItem\(PHOTO_MIGRATION_KEY\) === "1"\) return false;/,
    "senza questo una foto cancellata altrove torna indietro",
  );
});

test("«ho travasato» si puo' dire solo se c'era qualcosa da travasare", () => {
  /* Lo stesso difetto degli allagamenti: il segno messo prima che le auto
   * siano arrivate vuol dire non travasare mai piu' niente, su nessuna casa. */
  const sezione = leggi("sections/ev-section.js");
  const corpo = sezione.slice(sezione.indexOf("function adoptExistingPhotos()"));
  const senzaAuto = corpo.indexOf("if (!cars.length) return false;");
  const segno = corpo.indexOf('setItem(PHOTO_MIGRATION_KEY, "1")');
  assert.ok(senzaAuto > -1 && segno > -1);
  assert.ok(senzaAuto < segno, "il segno si mette anche senza auto");
});

test("la casella del travaso resta di questo dispositivo", async () => {
  const { CONFIG_KEYS } = await import("../src/sections/config-persistence-section.js");
  assert.equal(CONFIG_KEYS.includes("cd_ev_photos_moved"), false, "non e' configurazione");
});

/* La revisione delle chiavi non si alza per una chiave tolta.
 *
 * `mergeLegacyMissingConfig` riempie un salvataggio piu' vecchio della
 * revisione corrente con quello che c'e' su questo dispositivo: serve perche'
 * un salvataggio scritto prima che una chiave esistesse non puo' dire «questa
 * e' stata cancellata». Ma alzare la revisione per delle chiavi *tolte* manda
 * dentro a quel travaso ogni salvataggio della revisione precedente — e li'
 * dentro torna su anche quello che qualcun altro aveva cancellato apposta.
 * Una chiave tolta, per giunta, non si potrebbe riempire da qui: non e' piu'
 * nell'elenco.
 */
test("togliere una chiave non alza la revisione", async () => {
  const { CONFIG_KEYS, CONFIG_KEYS_REVISION, mergeLegacyMissingConfig } = await import(
    "../src/sections/config-persistence-section.js"
  );
  /* La 5 non smentisce questa prova: aggiunge una chiave (`cd_people`), e per
   * una chiave aggiunta la revisione si alza apposta. La 6 fa lo stesso con
   * le aperture (`cd_security_doors`) e le liste ToDo (`cd_todo`), la 7 con
   * le preferenze del ponte dei widget (`cd_widgets`), la 8 con le modalita'
   * scelte dell'antifurto (`cd_antifurto_modi`) e il tasto Clima rapido
   * (`cd_clima_rapido`), la 9 con le icone degli avvisi (`cd_avvisi_icone`),
   * le entita' assegnate a mano a una stanza (`cd_stanze_entita`) e il segno
   * progressivo delle auto (`cd_ev_meta`), la 10 con le cose che si guardano e
   * basta (`cd_solo_lettura`), la 11 con le prese (`cd_prese`), la 12 coi
   * passi del Clima rapido per unita' (`cd_clima_rapido_unita`), la 13 con le
   * entita' in evidenza e il fumo gia' visto, la 14 col verso girato dei
   * sensori (#244, `cd_stati_invertiti`), la 15 con lo scaldabagno elettrico
   * (#253, `cd_scaldabagni`), la 16 con le altre due macchine del locale
   * caldaia (#253, `cd_impianti_termici` e `cd_caldaia`), la 17 col gruppo di
   * continuita' (#256, `cd_ups`), la 18 coi calendari (#259,
   * `cd_calendari`), la 19 con le sezioni che si fa l'utente (#262,
   * `cd_sezioni_mie`), la 20 con gli impianti solari (`cd_solari` e
   * `cd_solare_scelto`), che adesso possono essere piu' d'uno, la 21 con le
   * aree d'allarme (#285, `cd_centrali` e `cd_centrale_scelta`), la 22 con
   * come si vede l'energia in Home (#286, `cd_energia_tessere`), la 23 con la
   * doppia conferma delle aperture (#275, `cd_porte_conferma`), la 27 con la
   * soglia dell'umidita' che fa dire «apri la finestra» (#330,
   * `cd_umidita_soglia`): e' una quota di casa, e se restasse sul dispositivo
   * che l'ha scritta il telefono direbbe di aprire la finestra e il tablet no,
   * davanti alla stessa stanza. Quelle tolte restano fuori dall'elenco, che e'
   * quello che questa prova difende. */
  assert.equal(CONFIG_KEYS_REVISION, 27);
  for (const chiave of ["cd_ev_image", "cd_ev_image_plugged"])
    assert.equal(CONFIG_KEYS.includes(chiave), false);

  // Un salvataggio alla revisione corrente e' completo: quello che non c'e'
  // dentro e' stato cancellato, e non si rimette.
  const remote = { keys_revision: CONFIG_KEYS_REVISION, values: { cd_ev_cars: "[]" } };
  const merged = mergeLegacyMissingConfig(remote, { cd_robot: '[{"name":"Rosetta"}]' });
  assert.equal(merged, remote, "un salvataggio completo non si tocca");
});

test("un salvataggio davvero piu' vecchio si riempie ancora, ma solo di chiavi vive", async () => {
  const { mergeLegacyMissingConfig } = await import(
    "../src/sections/config-persistence-section.js"
  );
  const merged = mergeLegacyMissingConfig(
    { keys_revision: 2, values: { cd_ev_cars: "[]" } },
    { cd_robot: '[{"name":"Rosetta"}]', cd_ev_image: '"/local/vecchia.png"' },
  );
  assert.equal(merged.values.cd_robot, '[{"name":"Rosetta"}]');
  assert.equal(
    "cd_ev_image" in merged.values,
    false,
    "una chiave ritirata non rientra dalla finestra",
  );
});

/* La memoria ombra non riporta in vita le foto tolte.
 *
 * Il profilo normalizzato porta anche `image` e `image_url`: componendo
 * `img || image` una foto svuotata apposta risorgeva dall'alias rimasto pieno
 * al giro prima, a ogni risalvataggio della sezione. */
import { normalizeDevice } from "../src/core/device-model.js";

test("la foto svuotata non risorge dagli alias", () => {
  const auto = normalizeDevice(
    { name: "T03", img: "", image: "/local/vecchia.png", image_url: "/local/vecchia.png" },
    "ev",
  );
  assert.equal(auto.img, "", "la foto tolta e' risorta");
  assert.equal(auto.image, "", "l'alias image la tiene in vita");
  assert.equal(auto.image_url, "", "l'alias image_url la tiene in vita");
});

test("chi arriva dal formato vecchio con la sola image la conserva", () => {
  const auto = normalizeDevice({ name: "B10", image: "/local/b10.png" }, "ev");
  assert.equal(auto.img, "/local/b10.png");
  assert.equal(auto.image, "/local/b10.png");
});

test("senza `img`, un'image vuota non spegne la image_url piena", () => {
  /* La riga legacy: `img` mai esistita, `image` vuota, `image_url` piena.
   * L'autorita' del campo vuoto vale solo per `img` presente davvero. */
  const auto = normalizeDevice(
    { name: "B10", image: "", image_url: "/local/b10.png" },
    "ev",
  );
  assert.equal(auto.img, "/local/b10.png", "l'unica foto rimasta e' stata scartata");
});

/* Il travaso pieno resta pieno, e la ragione e' il ripristino.
 *
 * Travasare ogni chiave mancante puo' riportare in vita quello che qualcun
 * altro aveva cancellato: e' un difetto vero, segnalato in revisione. Ma
 * `applyRestoredValues` cancella dal dispositivo ogni chiave che il
 * salvataggio non porta, quindi smettere di travasarle non fa tornare
 * indietro dei dati: li butta via. Finche' il ripristino non sa distinguere
 * «non c'e' perche' cancellata» da «non c'e' perche' allora non esisteva»,
 * qui si tiene il male che si puo' disfare a mano.
 */
test("uno scatto piu' vecchio riceve tutto quello che questo dispositivo ha", async () => {
  const { mergeLegacyMissingConfig } = await import(
    "../src/sections/config-persistence-section.js"
  );
  const locale = {
    cd_widgets: '{"hidden":["luci"]}',
    cd_tapparelle: '[{"entity":"cover.salone"}]',
    cd_ev_cars: '[{"name":"B10"}]',
  };
  const merged = mergeLegacyMissingConfig({ keys_revision: 5, values: {} }, locale);
  // La chiave nuova, che lo scatto non poteva conoscere.
  assert.equal(merged.values.cd_widgets, locale.cd_widgets);
  // E anche quelle vecchie: senza, il ripristino le cancellerebbe da qui.
  assert.equal(merged.values.cd_tapparelle, locale.cd_tapparelle);
  assert.equal(merged.values.cd_ev_cars, locale.cd_ev_cars);
});
