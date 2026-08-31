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
  // 141 con la faccia costruita. Il disegno dell'avatar — cataloghi chiusi e
  // SVG deterministico — sta in un modulo puro perche' lo leggono in due, la
  // card e il costruttore dell'editor, e devono disegnare la stessa persona.
  // 142 con la pagina Luci. Il popup sopra la Home resta com'e'; la pagina
  // intera nella barra — conto delle accese, comandi per tutta la casa,
  // gruppi per stanza — e' un modulo suo perche' possiede un'altra superficie
  // dello stesso modello: le capacita' stanno in core/light-model.js e la
  // scheda controlli resta quella del popup, qui non si duplica niente.
  // 148 con le aperture della Sicurezza (#195) e le liste ToDo della Home
  // (#201): ognuna segue lo schema delle persone — un modello puro che si
  // prova da solo, la sezione che disegna, l'editor che scrive la sua chiave.
  // 149 col backup della configurazione: la scheda che raccoglie le chiavi
  // condivise in un file e le rimette al loro posto — funzioni pure per il
  // giro dei dati, provate a tavolino, e nessuna chiave sua.
  // 150 con la scelta delle entità nei widget: le tessere leggono la
  // configurazione della sezione che raccontano, tutta, e questo modulo mette
  // accanto a ogni entità già scritta negli editor l'interruttore che dice se
  // va in Home. Non disegna una scheda sua — decora quelle che ci sono — e la
  // scelta la scrive dove abitano già le preferenze del ponte.
  // 152 col ritratto delle persone rifatto: i render 3D di Fluent Emoji al
  // posto del disegno a mano. Il catalogo generato dallo script di build
  // (core/avatar-catalog.js) porta i nomi dei file e le misure prese una
  // volta sola; il modello (core/avatar-3d.js) dice quali due immagini
  // servono e come incastrarle, e non sa cos'e' una pagina; la sezione
  // (sections/person-avatar-section.js) le incastra su una tela e ci disegna
  // sopra le palpebre. Il motore che disegnava le facce a mano se n'e'
  // andato con tutti i suoi pezzi.
  // 154 con le Stanze: la casa letta per stanza invece che per tipo. Il
  // modello (core/room-overview.js) raccoglie le assegnazioni che le
  // sezioni gia' scrivono e le gira dall'altro lato — senza spostare
  // niente e senza sapere cos'e' una pagina; la sezione
  // (sections/rooms-page-section.js) le disegna, e per le luci non fa una
  // card sua: usa quella della pagina Luci, che e' esportata apposta.
  // 155 con gli impianti dell'energia: sotto lo stesso tetto puo' esserci
  // piu' di un misuratore, e core/energy-plants.js e' il livello che
  // mancava. Tiene la forma — il primo impianto resta al primo livello
  // dell'oggetto salvato, gli altri in un elenco accanto — e le regole
  // dell'id, che nasce una volta, non si ricava dal nome e non torna buono
  // una seconda volta. Non sa cos'e' una pagina.
  // 156 con le linguette degli impianti: la pagina Energia non cambia di una
  // virgola, si aggiunge una riga sopra per scegliere quale casa si sta
  // guardando — e con una casa sola quella riga non compare affatto.
  // 155: se ne sono andati tutti e due gli argini della EV.
  // `vehicle-identity.js` rimetteva a un'auto quello che `edEvCarAdd` del
  // runtime le toglieva; `vehicle-photos.js` decideva di chi fosse una foto
  // quando la stessa foto viveva in due posti. Adesso il salvataggio e' nostro
  // e non toglie niente, e la foto sta nel profilo: non c'e' piu' niente da
  // rimettere ne' da contendersi. `ev-console.js` resta perche' argine non e'
  // mai stato: dice se la console di ricarica evcc e' configurata.
  // 156 con la centrale antifurto che dichiara cosa sa fare: `alarm-panel.js`
  // legge `supported_features` e dice quali inserimenti esistono davvero, quale
  // tasto corrisponde allo stato, e se un codice c'e'. La plancia mostrava
  // sempre gli stessi tre tasti: con Ring il tasto Notte non faceva niente
  // perche' Ring la notte non ce l'ha, e `armed_home` accendeva Fuori. Non sa
  // cos'e' una pagina: risponde su un oggetto di stato e basta.
  // 157 con la stanza che si puo' dire ovunque: `room-assign-section.js` mette
  // una tendina sulla riga in cui l'entita' e' gia' scritta, in qualunque
  // scheda, e su quelle che una stanza ce l'hanno gia' per mestiere non mette
  // niente. Aggiungere il campo a dieci editor voleva dire dieci punti in cui
  // scriverlo e dieci modi di sbagliarlo.
  // 158 con la scelta di quali tasti dell'antifurto vedere:
  // `alarm-modes-editor-section.js` spunta la fila in configurazione. La
  // centrale dice cosa ACCETTA — ed e' gia' la 156 a dirlo — ma quello che uno
  // vuole vedere e' un'altra domanda: una Ring accetta cinque inserimenti, e
  // chi in vacanza non ci va mai si ritrovava due tasti che non premera' mai
  // davanti a quello che usa ogni sera. La regola di cosa si vede resta nel
  // modello puro; qui c'e' solo il modo di dirla.
  // 160 con i parametri del tasto Clima rapido: `core/quick-climate.js` dice
  // cosa vuol dire un'impostazione e in quali chiamate si traduce, e
  // `quick-climate-editor-section.js` la fa scegliere. Il popup della Home
  // accendeva sempre in raffrescamento a ventisei gradi con la ventola
  // automatica, scritti nel codice: chi voleva altro non aveva nessun posto
  // dove dirlo. Il modello e' puro perche' la traduzione in tre chiamate si
  // prova a tavolino — e' l'unico modo di essere sicuri che il tasto faccia
  // quello che la scheda dice.
  // 161 con il meteo nell'intestazione: `weather-in-masthead-section.js`
  // sposta la striscia del meteo accanto al nome della casa e le da' la
  // taglia di una fascia invece che di una card. Non e' un modulo di dati —
  // non legge nessuno stato e non disegna niente: prende il blocco che c'e'
  // gia', lo mette da un'altra parte e lo rimpicciolisce. Sta da solo perche'
  // il posto e la taglia sono una scelta che si cambia in un punto, e perche'
  // chi disegna le tessere della Home non deve sapere dove sta il meteo.
  // 162 con l'ordine delle stanze: `rooms-order-editor-section.js` attacca due
  // frecce a ogni riga della scheda Stanze. L'elenco delle stanze e' l'ordine
  // in cui sono state aggiunte, e quello stesso ordine si ritrova in ogni
  // tendina che chiede «in che stanza sta questa cosa» e nelle linguette della
  // pagina Stanze: chi ha aggiunto il bagnetto per ultimo se lo ritrovava per
  // ultimo dappertutto, e l'unico modo di spostarlo era cancellarlo e
  // riscriverlo, perdendo tutto quello che gli era stato attribuito. La scheda
  // la disegna il documento vendorizzato e non si tocca: sta da solo perche' e'
  // un pezzo appoggiato a una scheda di cui non e' il padrone.
  // 163 con gli oggetti delle tessere: `core/oggetti-widget.js` tiene i disegni
  // che vanno dentro la pastiglia di ogni tessera — la lampadina col bulbo
  // caldo, il termometro col mercurio, l'auto col parabrezza. Prima li' c'era
  // un'emoji, e ogni sistema la disegna a modo suo: sei tessere vicine avevano
  // sei stili diversi. Sta da solo, e senza dipendenze, perche' e' un
  // vocabolario di disegni: lo leggono le tessere della Home e le intestazioni
  // dei popup, e nessuno dei due deve sapere come e' fatto l'altro.
  // 164 con il vassoio delle azioni rapide: `azioni-rapide-vassoio-section.js`
  // mette i tasti dentro un ripiano incavato e ne possiede la geometria. Prima
  // quella misura la scrivevano in due col peso massimo — la guardia del
  // marchio e la sezione delle regressioni — e vinceva l'ordine di
  // caricamento: cambiarla in un punto non bastava mai. Sta da solo perche' il
  // ripiano e' una scelta di forma della Home, e chi disegna le tessere non
  // deve sapere che esiste.
  // 165 con il servizio giusto per le azioni rapide:
  // `azioni-servizio-giusto-section.js` sa quale servizio ogni dominio sa
  // davvero eseguire. Il guscio ne conosce due — `turn_on` per script e scene,
  // `toggle` per tutto il resto — e `toggle` non e' universale: un `button` ha
  // solo `press`, e chiedergli `toggle` non muove niente e non dice niente.
  // Sta da solo perche' e' una sola domanda, e la risposta non serve a chi
  // disegna i tasti: quello e' mestiere del vassoio, che infatti non lo sa.
  // 166 col foglio del guscio: `foglio-del-guscio-section.js` si accorge se il
  // foglio di stile grosso non e' arrivato e lo richiede. Quando si perde, la
  // plancia sembra quasi normale — i moduli portano il proprio stile — ma i
  // cerchi del flusso, che hanno lo stile solo li', restano invisibili: da
  // fuori «i flussi sono scomparsi». Sta da solo perche' guarda il documento,
  // non una sezione, e nessuna sezione deve sapere che esiste.
  // 167 con le strisce di linguette: i periodi, gli impianti e le stanze sono
  // lo stesso nastro che scorre di lato disegnato in tre posti, e ne veniva lo
  // stesso difetto tre volte — la pillola accesa tagliata contro la testata,
  // e le ultime linguette irraggiungibili col mouse. Adesso quella regola ha
  // un padrone solo: `le-strisce-di-linguette-section.js`.
  // 168 col segno progressivo: «un identificativo non si riusa mai, perche'
  // altrimenti chi nasce eredita in silenzio quello che apparteneva a chi e'
  // stato cancellato — i carichi di un impianto, le foto di un'auto». Quella
  // regola era scritta due volte, con lo stesso nome, negli impianti e nelle
  // auto: e' proprio il genere di regola che non deve poter divergere, perche'
  // quando diverge si perdono dati di qualcuno e non si capisce perche'. Sta da
  // sola perche' non appartiene ne' all'energia ne' alle auto: e' una regola
  // sugli identificativi, e domani vale anche per le piscine.
  // 170 col catalogo dei disegni e la sua tavolozza: le stanze, le azioni e i
  // carichi uscivano a emoji — quelle del sistema, che cambiano faccia da un
  // telefono a un altro — accanto alla scocca blu notte degli elettrodomestici.
  // Tre stili nella stessa schermata. I cinquantasei disegni che mancavano
  // stanno in `catalogo-disegni.js`, e i colori e i tratti con cui sono fatti
  // in `tavolozza-disegni.js`, scritti una volta sola: sono due perche' la
  // tavolozza la usa anche chi disegnera' la cinquantasettesima, e senza un
  // posto dove chiederla si ricomincia a occhio.
  // 171 col racconto della tessera: la finestra di una sezione ha smesso di
  // essere un elenco e dice cosa sta succedendo — «2 zone su 5 accese, manca
  // 1,2 gradi all'obiettivo» invece di undici righe da mettere insieme a
  // mente. Il verdetto e la frase si ragionano, quindi stanno in un modulo
  // puro, `racconto-tessera.js`, e si provano senza browser: una frase che
  // dice «da 40 minuti» o «finisce alle 19:20» e' esattamente il genere di
  // cosa che si sbaglia in silenzio, e a occhio non si vede.
  // 172 col motore di analisi delle finestre: la frase sotto il verdetto
  // veniva da un ripiego che sa contare solo cose accese e spente, e dieci
  // sezioni su diciassette non sono fatte cosi'. L'Energia scriveva «4 cose,
  // nessuna in funzione» col fotovoltaico a 2,16 kW; la Sicurezza «Qui non
  // c'e' ancora niente» con l'antifurto elencato sotto. Le letture stanno in
  // un modulo puro, `analisi-sezione.js`, separato da `racconto-tessera.js`
  // perche' fanno due mestieri diversi: quello dice se una tessera e' in moto
  // e come si chiama il suo verdetto, questo legge i numeri di una sezione e
  // ne ricava una frase e i punti che la reggono. Tenerli insieme voleva dire
  // un file dove il conteggio delle righe e il bilancio energetico si
  // guardano, ed e' il genere di vicinanza da cui nascono i due padroni.
  // 173 col modello di una grandezza nel tempo: la finestra sapeva dire «574 W»
  // e nient'altro, e un numero da solo non si sa se e' tanto o poco — 574 watt
  // sono normali per una casa e tantissimi per un frigorifero. Il modulo
  // prende una serie di letture e ne ricava le quattro cose che servono per
  // dire qualcosa di sensato: da che parte sta andando, quando ci arrivera',
  // quale sia il suo valore abituale, e se quello di adesso sia normale. Sta
  // per conto suo perche' non sa niente di sezioni: conta e basta, e va bene
  // anche per una soglia di avviso o per decidere se una scheda si colora.
  //
  // 174 col padrone unico dello storico. Il modello vuole le letture di prima,
  // che il grafico delle temperature gia' chiedeva a Recorder con la sua cache.
  // La strada breve era copiarne il codice nelle finestre: sarebbero stati due
  // padroni dello stesso traffico, due cache che non si parlano, due domande
  // per la stessa entita' e la certezza che prima o poi una scada con una
  // regola diversa dall'altra. E' il difetto che si sta togliendo dappertutto
  // in questi giorni: qui si evitava di crearne uno nuovo.
  // 175 col nome della lettura. Nella finestra del Solare termico si leggeva
  // «Temperatura Pannello solare Temperature»: la parola due volte, una per
  // lingua. Non e' un difetto della plancia — Home Assistant costruisce il nome
  // amichevole incastrando il nome del dispositivo, che scrive chi abita la
  // casa, con quello dell'entita', che scrive l'integrazione — ma stampato
  // com'e' sembra un difetto della plancia. Il modulo toglie dalla coda la
  // parola gia' detta dall'unita' del valore, e non tocca i nomi che senza
  // quella parola direbbero di meno: meta' delle sue prove pretende che il nome
  // resti intero, perche' accorciare troppo e' il difetto peggiore dei due.
  // 176 con le strade per aprire una telecamera. Su Ring e Arlo il video non
  // partiva, e i due motivi erano l'uno il contrario dell'altro: si provava una
  // strada che non poteva funzionare, e si smetteva di provare quella che stava
  // per riuscire. WebRTC si tentava sempre — la condizione era «il browser sa
  // farlo», che oggi e' vero dappertutto — ma quel WebRTC li' e' go2rtc, e vuole
  // il nome del flusso che le si e' dato dentro go2rtc: chi non ce l'ha
  // installata pagava tre secondi a ogni apertura per un flusso inesistente. E
  // l'HLS aveva dieci secondi di tempo, tarati su una telecamera di casa sempre
  // accesa: una in cloud deve prima svegliare l'apparecchio e ci mette di piu',
  // quindi si mollava sul piu' bello e si finiva sulle istantanee a due
  // fotogrammi al secondo — «si vede, ma a scatti», che e' il modo in cui si
  // vive un difetto senza saperlo nominare. La scelta sta in un modulo puro
  // perche' e' l'unico modo di provarla senza avere una Ring in casa: entrano la
  // telecamera e quello che Home Assistant dichiara di lei, esce l'ordine delle
  // strade con le attese e il perche' di quelle saltate.
  // 178 con le prese. «Cosa ne pensi di inserire una sezione dedicata a prese
  // generiche, tipo TV Salotto, TV letto, Presa Firestick?» — si potevano gia'
  // configurare, perche' la scheda Luci accetta anche `switch.`, e una presa
  // messa li' si accende benissimo. Solo che si chiama luce: finisce
  // nell'elenco delle luci, si conta nel «3 accese» del salone, e «spegni tutte
  // le luci» la spegne — cosa che per la TV puo' anche andare e per il modem
  // no. I moduli sono due perche' fanno due mestieri: `prese-model.js` e' puro
  // e sa solo che forma ha una presa e come si raggruppano per stanza;
  // `prese-section.js` mette la pagina, la voce nella barra e la scheda di
  // configurazione. Quello che NON c'e' e' la ragione per cui sono due e non
  // cinque: niente motore per accendere — a comandare una presa e' lo stesso
  // `lightCommand` di tutto il resto, quindi il blocco «si vede ma non si
  // comanda» vale qui senza una riga in piu' — e niente scheda nuova da
  // disegnare, perche' e' la stessa `pageCardMarkup` delle luci.
  // 179 col popup dell'elettrodomestico rivestito da progetto
  // (`appliance-detail-popup-section.js`): «quando clicco su un
  // elettrodomestico si apre questo popup orrendo, crealo piu' bello stile
  // widget che ti fa anche analisi» — il guscio elencava ogni entita' con lo
  // slug, il modulo riveste la stessa finestra con verdetto, frase, caselle,
  // pillole e comandi.
  // 181 con le parole inglesi del guscio: il runtime EN portava ancora
  // etichette italiane cablate, e il modulo che le traduce e' il padrone
  // provvisorio finche' la correzione non arriva a monte.
  // 180 coi rilevatori di fumo (#238): la lista sorvegliata `fumo` che si
  // riempie da sola — e continua a farlo, col registro dei gia' visti — piu'
  // il blocco nella pagina Sicurezza e le aperture nuove che entrano da sole
  // nel gruppo `win`. Un modulo solo, sul calco di flood-alerts.
  // 182 con le voci termiche del popup Caldo: le tre righe cablate nel
  // guscio (una addirittura su switch.caldaia) diventano `cd_termico_caldo`,
  // configurabili dalla scheda Clima — e senza voci il pannello sparisce.
  assert.ok(relative.length <= 182, `production graph unexpectedly grew to ${relative.length} modules`);
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
   * The fourth refreshes the camera thumbnails of the Home widget deck, for
   * the same reason as the Sicurezza wall: a camera frame is a still picture
   * nothing pushes. Ten seconds, and only while the camera tile is expanded
   * on a visible Home; collapsed, the timer dies and the object URLs are
   * returned.
   *
   * The fifth transcribes the alarm stage into English: the vendored EN
   * runtime redraws it every tick with its own Italian words, so no event can
   * win that race. Same discipline: English shell only, alarm nodes only,
   * silent while the page is hidden.
   *
   * These are the intervals production is allowed, and they are named here so
   * another one cannot arrive unnoticed. */
  const intervals = [...graph.entries()].filter(([, source]) =>
    /setInterval\s*(?:\?\.)?\s*\(/.test(source),
  );
  assert.deepEqual(
    intervals.map(([file]) => path.relative(frontendRoot, file).replaceAll("\\", "/")).sort(),
    [
      "src/sections/english-runtime-strings-section.js",
      "src/sections/home-widgets-section.js",
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
  // inside the runtime, so there is no name to wrap. The alarm-mode chooser owns
  // one more, scoped to the children of #ed-body: it has to appear under the
  // panel field the moment the Security tab is drawn, and the only honest signal
  // that the card has been redrawn is the card itself — the tab class is set
  // before the body is mounted, and the legacy `editorSwitch` may not exist yet
  // when modules install, so wrapping it is a hook that can silently fail.
  // The quick-climate settings own the ninth, for the same reason and scoped the
  // same way: the block has to appear under the climate units the moment the
  // Clima tab is drawn, and the card itself is the only honest signal that it
  // has been redrawn.
  // The loop below still rejects observers rooted at document/body/documentElement.
  // Il decimo e' del meteo nell'intestazione, e guarda solo i figli di
  // #page-home: la striscia si sposta una volta sola, ma se qualcuno la
  // rimette dentro la pagina — un ridisegno che riscrive #page-home per
  // intero — va ripresa, e non c'e' nessun nome da avvolgere per saperlo.
  assert.ok(observers.length <= 10, `too many production observers: ${observers.length}`);
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
