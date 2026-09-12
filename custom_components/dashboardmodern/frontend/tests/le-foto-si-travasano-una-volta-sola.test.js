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
   * davanti alla stessa stanza, e la 28 col segno progressivo dei gruppi di
   * continuita' (#332, `cd_ups_meta`), che nasce con il secondo UPS: vale la
   * stessa ragione delle auto — se resta a terra, il secondo dispositivo
   * riparte da capo col conteggio e il prossimo gruppo nasce con
   * l'identificativo di uno cancellato, e la 29 con l'ordine dei blocchi della
   * Home (`cd_home_blocchi`): quale viene prima fra persone, widget, azioni
   * rapide e dispositivi e' una scelta della casa, non del vetro da cui la si
   * guarda; e la 30 con la lingua della plancia (#350, `cd_lingua`) e la riga
   * sotto il meteo (#356, #357, `cd_barra_casa`): la lingua stava sotto una
   * chiave del browser, e chi la sceglieva sul computer la sceglieva per quel
   * computer — «su PC avevo settato italiano, da mobile invece e' rimasto
   * inglese» — mentre la riga dice quali pastiglie si vedono e qual e' il
   * contatto della cassetta della posta; e gli animali di casa (#358,
   * `cd_animali`), i cui nomi, foto ed entita' — ciotola, lettiera, collare —
   * sono roba della casa: il gatto configurato sul tablet deve esistere anche
   * sul telefono. Quelle tolte restano fuori dall'elenco, che e' quello che
   * questa prova difende. E la 31 con le quattro trovate ricontando chi scrive
   * cosa — «da smartphone vedo le sezioni configurate da pc invece no»: il
   * radar meteo (`cd_radar_meteo`), l'orologio in testata (`cd_orologio`)
   * e il segno delle caselle riempite a mano
   * (`dm_campi_scelti`), senza il quale una casella svuotata apposta di qua se
   * la ritrova riscritta di la' da chi indovina; e il gemello di
   * `cd_fumo_rilevato` (`cd_allag_rilevato`), senza il quale l'altro
   * dispositivo rifa' il rilevamento e rimette dentro il sensore appena
   * cancellato. E la 32 con la ventilazione meccanica (#371, `cd_vmc`): le
   * quattro temperature, il bypass e i filtri di una VMC sono entita' di casa
   * come tutte le altre, e la macchina e' una sola per tutta la famiglia —
   * configurarla dal computer e non trovarla dal telefono sarebbe l'ennesimo
   * «da smartphone vedo le sezioni configurate da pc invece no»; e la 33 con
   * Assist (#360, `cd_assist`): quale assistente risponde, se legge ad alta
   * voce e se il tasto si vede sono preferenze della casa, non del vetro da
   * cui la si guarda. E la 34 con i varchi (#367, #377, `cd_varchi`): quali
   * contatti non contano, quali aggiungere a mano e come si chiamano sono
   * correzioni al rilevamento di CASA — il sensore del frigorifero etichettato
   * «door» e' sbagliato su ogni dispositivo, e il nome che gli si da' vale per
   * tutti quelli che guardano la stessa porta. E la 35 con le macchine del
   * server e la rete (#382, `cd_macchine`): il server e' uno solo per tutta la
   * casa, e il nome che si da' a «pve_qemu_103» vale su ogni dispositivo che
   * lo guarda. E la 36 con la soglia delle batterie (#398, `cd_batterie`):
   * «sarebbe carino che le batterie stessero nel config come le altre cose».
   * Sotto quanto una batteria e' da cambiare era venti per cento scritto nel
   * codice, uguale per tutti; adesso lo si sceglie, ed e' una scelta sulla
   * casa — chi ha una serratura da cambiare al trenta ce l'ha da cambiare al
   * trenta anche guardando dal telefono. E la 37 con i tasti d'inserimento
   * scritti a mano (#413, `cd_antifurto_su_misura`): «utilizzando un
   * dispositivo tramite esphome non ho il classico control_panel_alarm». Chi
   * l'antifurto se l'e' fatto con gli script la fila dei tasti se la descrive —
   * nome, icona, entita' da premere — ed e' l'antifurto della casa: inserirlo
   * dal tablet e non poterlo inserire dal telefono sarebbe il difetto piu'
   * grave di tutti quelli di questo elenco. La 38 aveva portato il flusso
   * dell'energia in Home (`cd_flusso_home`): quella card e' stata tolta —
   * «non mi piace e non c'entra nulla con il resto» — e la sua chiave con
   * lei, senza alzare la revisione, che e' quello che questa prova difende.
   * E la 39 con chi resta
   * fuori dal grafico delle Temperature (#433, `cd_grafico_stanze`): «poter
   * togliere dal grafico alcune entita'/stanze cliccandoci sopra in modo tale
   * che diventi piu' leggibile la variazione. Nel mio caso il vano tecnico».
   * Una stanza fuori scala schiaccia tutte le altre, e toglierla e' una cosa
   * che si dice della casa, non del vetro da cui la si e' detta. E la 40 con la
   * presenza (#432, `cd_presenza`): «ci vorrebbe una sezione con i sensori
   * presenza o movimento». Sono le stesse tre correzioni dei varchi — quale
   * rilevatore non guarda la casa, quale aggiungere a mano, come si chiama — e
   * sono correzioni al rilevamento di CASA: il sensore del cortile e' fuori
   * posto su ogni dispositivo, e il nome dato a «Motion 3C» vale per tutti. */
  /* E la 41 col verso della batteria (#434, `cd_batteria_verso`): «sembra
   * scaricarsi perche' il flow tratteggiato va dalla batteria verso casa ma non
   * e' esatto». Meta' dei sensori scrive positivo quando la batteria si CARICA,
   * e da un valore solo non si indovina: lo dice la casa. La batteria e' una
   * sola per tutta la casa, e chi ha girato il verso dal computer non deve
   * vedere le frecce al contrario sul telefono. */
  /* E la 42 con le soglie di ricarica (#408, `cd_batterie_ricarica`): «una
   * scheda che mostri la percentuale del tablet che usiamo a muro, e magari
   * schiacciando le impostazioni per attivare la ricarica». Quale batteria è
   * quella di un tablet a muro, e quali due entità dicono sotto quanto riparte
   * e sopra quanto si ferma: è configurazione della casa, e chi la fa dal
   * telefono deve ritrovarla dal tablet stesso. */
  /* E la 43 con le stampanti (#469, `cd_stampanti`): «volevo chiedere se
   * c'era la possibilità del controllo delle tv e stampanti». Quale entità
   * dice se la stampante è pronta, e quali dicono quanto inchiostro resta: la
   * stampante è una sola per la casa, e chi la configura dal computer deve
   * ritrovarla dal telefono. */
  /* E la 44 con gli altri nodi del cluster (#470, `cd_nodi`): «sarebbe utile
   * poter configurare più di un mini pc in modo da monitorare più nodi, comodo
   * per chi ha un cluster proxmox». Un cluster è della casa, non dello schermo
   * da cui lo si è dichiarato. */
  /* E la 45 col citofono e la cassetta della posta (#449, `cd_citofono`):
   * «avendo un intercom ho un button.cancello per aprire, inoltre volevo
   * chiedere una sezione per la cassetta della posta». Il cancello è uno solo,
   * e chi lo configura dal telefono lo ritrova dal computer. */
  /* E la 46 con i rilevamenti delle telecamere (#394, `cd_rilevamenti`): «una
   * volta che io imposto persona, animale, veicolo e movimento — perché
   * reolink ti sgancia questi sensori — che la Dashboard metta l'avviso con il
   * fotogramma». Quali sensori guarda ogni telecamera è una proprietà della
   * casa: chi li sceglie dal computer li ritrova sul tablet appeso al muro. */
  /* E la 47 con le pastiglie di stato (#491, `cd_home_pastiglie`): «enable /
   * disable container for status pills (boiler + burglar alarm)». La riga in
   * cima alla Home che dice la caldaia accesa e l'antifurto inserito si puo'
   * spegnere, e chi la spegne la vuole spenta dovunque: accesa sul tablet
   * appeso al muro e spenta sul telefono sarebbe la stessa casa che dice due
   * cose. Spegnerla non e' come riordinarla — riordinarla vorrebbe dire
   * poterla mandare in fondo, cioe' non vederla mai senza averlo chiesto. */
  /* E la 48 con le stanze in plancia (#493, `cd_home_stanze`): «have the option
   * to display a block on the home screen showing the rooms or areas of the
   * house», e «it should also be possible to choose which rooms or areas
   * appear». Quali stanze uno vuole davanti è una scelta della casa: chi
   * sceglie il giardino e il garage dal computer li ritrova sul telefono. */
  /* E la 49 con la soglia di potenza (#508, `cd_energia_soglia`): «un campo
   * dove inserire un valore massimo di potenza che fa colorare di color ambra
   * o rosso la card per capire un sovraccarico». Il limite del contratto — o
   * il consumo che si vuole tenere d'occhio — è un fatto dell'impianto: chi lo
   * scrive dal computer deve ritrovare la tessera colorata sul telefono. */
  assert.equal(CONFIG_KEYS_REVISION, 49);
  assert.ok(
    CONFIG_KEYS.includes("cd_energia_soglia"),
    "la soglia di potenza è dell'impianto, non del vetro da cui la si è scritta",
  );
  assert.ok(
    CONFIG_KEYS.includes("cd_home_pastiglie"),
    "le pastiglie si spengono per la casa, non per il vetro da cui le si guarda",
  );
  assert.ok(
    CONFIG_KEYS.includes("cd_home_stanze"),
    "le stanze in plancia si scelgono per la casa, non per lo schermo",
  );
  assert.ok(
    CONFIG_KEYS.includes("cd_stampanti"),
    "le stampanti si configurano per la casa, non per lo schermo",
  );
  assert.ok(CONFIG_KEYS.includes("cd_nodi"), "un cluster è della casa, non dello schermo");
  assert.ok(
    CONFIG_KEYS.includes("cd_rilevamenti"),
    "quali sensori guarda una telecamera è della casa, non dello schermo",
  );
  assert.ok(
    CONFIG_KEYS.includes("cd_citofono"),
    "il cancello è uno solo, e la cassetta della posta pure",
  );
  assert.ok(
    CONFIG_KEYS.includes("cd_presenza"),
    "i rilevatori di presenza si correggono per la casa, non per lo schermo",
  );
  assert.ok(
    CONFIG_KEYS.includes("cd_batteria_verso"),
    "il verso della batteria e' dell'impianto, non del vetro",
  );
  assert.ok(
    CONFIG_KEYS.includes("cd_antifurto_su_misura"),
    "l'antifurto scritto a mano deve viaggiare con la casa",
  );
  for (const chiave of ["cd_radar_meteo", "cd_orologio", "dm_campi_scelti", "cd_allag_rilevato"])
    assert.ok(CONFIG_KEYS.includes(chiave), `${chiave} deve viaggiare con la casa`);
  assert.ok(CONFIG_KEYS.includes("cd_vmc"), "la ventilazione deve viaggiare con la casa");
  assert.ok(CONFIG_KEYS.includes("cd_varchi"), "i varchi devono viaggiare con la casa");
  assert.ok(
    CONFIG_KEYS.includes("cd_batterie"),
    "la soglia delle batterie deve viaggiare con la casa",
  );
  assert.ok(CONFIG_KEYS.includes("cd_macchine"), "le macchine devono viaggiare con la casa");
  assert.ok(CONFIG_KEYS.includes("cd_assist"), "Assist deve viaggiare con la casa");
  for (const chiave of ["cd_ev_image", "cd_ev_image_plugged", "cd_flusso_home"])
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
