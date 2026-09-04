/* La tapparella sta fuori, l'infisso si vede da dentro.
 *
 * La card mostrava un rettangolo azzurro con delle stecche che scendevano
 * davanti: una tapparella senza finestra. Si guarda invece dalla stanza — che e'
 * da dove uno guarda una tapparella — e allora in primo piano c'e' sempre
 * l'infisso, con il suo telaio, le due ante e la maniglia; dietro il vetro
 * scende la tapparella; dietro ancora c'e' il fuori.
 *
 * E un infisso puo' essere aperto. Un contatto sull'anta lo dice, e quando lo
 * dice le ante rientrano verso i loro cardini e scoprono il vano.
 *
 * Il movimento delle ante e' uno `scaleX`, non un `rotateY`. Sono la stessa
 * cosa sullo schermo — l'anta si stringe verso il cardine e torna — ma la
 * rotazione aprirebbe un contesto tridimensionale su ogni card, ed e'
 * esattamente quello che aveva ucciso WebKit sulle icone degli avvisi.
 *
 * Niente qui scrive dati: la posizione della tapparella resta di chi la
 * disegnava, il contatto si legge e basta.
 */
import {
  CHIAVE_SOGLIA_CHIUSA,
  SOGLIA_CHIUSA_MASSIMA,
  coverClosedThreshold,
  coverEntries,
  coverKindLabel,
} from "../core/cover-kind.js";
import { contactEntity, inferriataEntity, serramentoModel } from "../core/shutter-window.js";
import { CHIAVE_VERSI, insiemeInvertiti } from "../core/verso-aperture.js";
import { renderHomeWidgets } from "./home-widgets-section.js";
import {
  allStates,
  clean,
  dashboardStore,
  doc,
  esc,
  installStyle,
  readJson,
  root,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_SHUTTER_WINDOW__";
const STYLE_ID = "dm-shutter-window-style";
const state = (root[KEY] ||= { installed: false, frame: 0 });

/* Le tapparelle configurate: dal modello canonico, con la copia in
 * localStorage come rete di sicurezza per la plancia ospitata, che puo'
 * disegnare prima che il modello esista. */
function covers() {
  try {
    const stored = dashboardStore()?.getSection?.("covers");
    if (Array.isArray(stored) && stored.length) return stored;
  } catch (_error) {}
  const legacy = readJson("cd_tapparelle", []);
  return Array.isArray(legacy) ? legacy : [];
}

/* La riga di configurazione a cui appartiene una card.
 *
 * Un infisso puo' produrre piu' di una card — tapparella, tenda, tenda da sole
 * — e il contatto della finestra e' uno solo, scritto sulla riga. Cercando
 * soltanto fra le tapparelle, le card in piu' non ritrovavano la loro riga:
 * disegnavano la finestra sempre chiusa e restavano senza la pastiglia
 * «finestra aperta», mentre la card principale dello stesso serramento la
 * mostrava. */
function coverForCard(card) {
  const entity = clean(card.getAttribute("data-tapp"));
  if (!entity) return null;
  return (
    covers().find(
      (item) =>
        coverEntries(item).some((entry) => clean(entry.entity) === entity) ||
        /* Una finestra senza motori si identifica col suo contatto: e' l'unica
         * entita' che ha, e quindi e' quella scritta sulla card. Da quando i
         * contatti possono essere due (#254), quello scritto sulla card puo'
         * essere anche l'inferriata: chi ha le sole grate non aveva modo di
         * ritrovare la propria riga. */
        clean(contactEntity(item)) === entity ||
        clean(inferriataEntity(item)) === entity,
    ) || null
  );
}

/* I pezzi che si aggiungono al vano, una volta sola.
 *
 * Il runtime ridisegna tutta la griglia a ogni cambio di stato, quindi questa
 * passata gira di continuo: costruisce solo dove non ha ancora costruito, e
 * riconosce il proprio lavoro dal segno che lascia. */
function build(windowNode) {
  if (windowNode.dataset.dmInfisso === "true") return false;
  windowNode.dataset.dmInfisso = "true";

  /* Solo cio' che manca.
   *
   * Il vano ha gia' un padrone: cielo, colline, sole, cassonetto e guide sono
   * disegnati dal modulo della scena, e le stecche sono uno sfondo ripetuto
   * sulla tapparella stessa. Rifarli qui vorrebbe dire due padroni sullo stesso
   * pixel, che e' il difetto che questa plancia ha passato mesi a togliersi.
   * Quello che davvero non c'era e' l'infisso: il telaio, le due ante, la
   * maniglia. */
  const spalla = doc.createElement("div");
  spalla.className = "dm-tw-spalla";
  const infisso = doc.createElement("div");
  infisso.className = "dm-tw-infisso";
  infisso.innerHTML =
    '<div class="dm-tw-anta dm-tw-anta-sx"></div>' +
    '<div class="dm-tw-anta dm-tw-anta-dx"><span class="dm-tw-maniglia"></span></div>' +
    '<div class="dm-tw-telaio"></div>';
  /* L'inferriata sta FUORI, quindi davanti a tutto: due mezze grate che si
   * scostano di lato, non ante che rientrano. Il nodo nasce sempre ma resta
   * spento finche' qualcuno non dichiara il suo sensore — costruirlo solo
   * quando serve vorrebbe dire ricostruire la card a ogni cambio di
   * configurazione, e questa passata gira a ogni evento di stato. */
  const grata = doc.createElement("div");
  grata.className = "dm-tw-grata";
  grata.innerHTML =
    '<span class="dm-tw-grata-meta dm-tw-grata-sx"></span>' +
    '<span class="dm-tw-grata-meta dm-tw-grata-dx"></span>';
  windowNode.append(spalla, infisso, grata);
  return true;
}

/** Cosa dicono i contatti di questa card, adesso. */
export function paintCard(card, states = allStates()) {
  const windowNode = card.querySelector(".tapp-win");
  if (!windowNode) return false;
  build(windowNode);
  const cover = coverForCard(card);
  /* Il contatto girato (#244) sta a ON quando l'anta e' chiusa: il disegno e
   * la pastiglia seguono il verso vero, non quello del filo. Il verso lo
   * applica il modello, che ha in mano tutti e due i contatti. */
  const model = serramentoModel(
    cover || {},
    states,
    root.resolveEntity || ((value) => value),
    insiemeInvertiti(readJson(CHIAVE_VERSI, [])),
  );
  // Aperto solo quando il contatto lo dice: un sensore che non risponde non e'
  // una finestra chiusa, ma il disegno di riposo e' quello, e non si inventa
  // un'apertura che nessuno ha misurato.
  const aperto = model.infisso.open === true ? "aperto" : "chiuso";
  if (windowNode.dataset.dmInfissoStato !== aperto) windowNode.dataset.dmInfissoStato = aperto;
  /* La grata si accende solo dove qualcuno l'ha dichiarata: su tutte le altre
   * card il vano resta esattamente quello di prima. */
  const grata = model.inferriata.configured
    ? model.inferriata.open === true
      ? "aperta"
      : "chiusa"
    : "";
  if ((windowNode.dataset.dmGrata || "") !== grata) {
    if (grata) windowNode.dataset.dmGrata = grata;
    else delete windowNode.dataset.dmGrata;
  }
  ensurePill(card, model);
  return true;
}

/* Come si legge un serramento, in due parole.
 *
 * Con la sola finestra resta la frase di sempre. Con la grata le parole
 * diventano quattro, perche' quattro sono gli stati che si volevano
 * distinguere: e' la differenza fra «sto arieggiando» e «e' rimasto aperto». */
export function paroleDelSerramento(model) {
  if (!model?.inferriata?.configured) {
    return model?.infisso?.open === true ? t("Finestra aperta", "Window open") : "";
  }
  switch (model.stato) {
    case "aperto":
      return t("Inferriata e finestra aperte", "Grate and window open");
    case "grata":
      return t("Inferriata aperta", "Grate open");
    case "infisso":
      return t("Finestra aperta", "Window open");
    default:
      return "";
  }
}

/* La pastiglia "Finestra aperta" accanto a quella della tapparella.
 *
 * Sta accanto, non al posto: la tapparella continua a dire a che punto e', e
 * l'infisso aggiunge la sua riga solo quando c'e' qualcosa da aggiungere. */
function ensurePill(card, model) {
  const head = card.querySelector(".tapp-head");
  if (!head) return;
  const label = paroleDelSerramento(model);
  const aperto = Boolean(label);
  /* Su una finestra che si apre a mano la pastiglia della card gia' dice
   * «Aperta», e quella e' proprio la finestra: non c'e' una tapparella accanto
   * da distinguere. Aggiungerne una seconda con «Finestra aperta» sarebbe
   * ripetere la stessa cosa due volte sulla stessa riga.
   *
   * Con l'inferriata pero' c'e' eccome da distinguere (#254): «Aperta» da solo
   * non dice se e' aperta la grata, la finestra o tutte e due, che e' proprio
   * la domanda per cui si sono messi due sensori. */
  if (card.dataset.dmSoloInfisso === "true" && !model?.inferriata?.configured) return;
  let pill = head.querySelector(".dm-tw-pill");
  /* Due pastiglie sulla stessa riga mangiano il nome.
   *
   * Il nome e' il dato che identifica la scheda; lo stato e' un commento. Con
   * due pastiglie accanto — "Aperta" e "Finestra aperta" — a cedere spazio era
   * il nome, che finiva troncato: "Tapparella so…". A cedere deve essere lo
   * stato, che va a capo sotto e resta leggibile per intero. Il segno sta qui
   * perche' e' questo modulo ad aggiungere la seconda pastiglia: chi crea
   * l'affollamento se ne occupa. */
  if (!aperto) {
    if (pill) pill.remove();
    if (head.dataset.dmTwPills) delete head.dataset.dmTwPills;
    return;
  }
  if (head.dataset.dmTwPills !== "due") head.dataset.dmTwPills = "due";
  if (!pill) {
    pill = doc.createElement("span");
    pill.className = "tapp-state dm-tw-pill";
    head.append(pill);
  }
  if (pill.textContent !== label) pill.textContent = label;
}

export function paintShutterWindows(scope = doc?.getElementById("page-tapparelle")) {
  if (!scope?.querySelectorAll) return 0;
  const states = allStates();
  let painted = 0;
  for (const card of scope.querySelectorAll(".tapp-card[data-tapp]")) {
    if (paintCard(card, states)) painted += 1;
  }
  return painted;
}

/* ── il campo in Config ─────────────────────────────────────────────────── */

/* Un infisso, quattro caselle.
 *
 * La scheda chiedeva una entita' sola piu' un menu che diceva di che tipo
 * fosse. Ma sulla stessa finestra ci stanno insieme la tapparella, la tenda e
 * la tenda da sole, e chi le ha tutte non poteva dirlo: ne sceglieva una. Le
 * caselle adesso sono una per funzione — e il menu del tipo non serve piu',
 * perche' il tipo lo dice la casella in cui hai scritto.
 *
 * Il runtime stampa la prima casella e la stanza; queste si aggiungono dopo,
 * con la stessa coppia campo + lente, e il resto — pastiglia, matita, cestino —
 * arriva dal modulo delle righe come su ogni altra scheda. */
/* Le etichette non sono parole nuove: sono quelle che il tipo di copertura ha
 * gia' — «Tenda», «Tenda da sole» — piu' quella del contatto, che la finestra
 * della matita stampa con le stesse parole. Un vocabolario che esiste gia' non
 * si riscrive: si chiama. */
function caselle() {
  return [
    /* Il rele' che manda giu' (#194): uno Shelly lasciato in modalita'
     * interruttore espone due prese, una che alza e una che abbassa, e senza
     * la seconda «Chiudi» non chiude niente. Vale solo quando la casella
     * principale porta anch'essa un rele': su una copertura vera i due versi
     * li ha gia' Home Assistant. */
    ["ed-tp-down", t("Relè di discesa", "Down relay"), "switch.tapparella_giu"],
    ["ed-tp-tenda", coverKindLabel("tenda"), "cover.tenda_salotto"],
    /* Anche la tenda puo' stare su due rele' — «ho due tende su due Shelly
     * 2PM» e' la segnalazione da cui e' nato tutto: ognuna delle tre
     * coperture della riga ha il suo verso di discesa, non solo la
     * tapparella. */
    [
      "ed-tp-down-tenda",
      `${coverKindLabel("tenda")} · ${t("relè di discesa", "down relay")}`,
      "switch.tenda_giu",
    ],
    ["ed-tp-tendasole", coverKindLabel("tenda_sole"), "cover.tenda_da_sole"],
    [
      "ed-tp-down-tendasole",
      `${coverKindLabel("tenda_sole")} · ${t("relè di discesa", "down relay")}`,
      "switch.tenda_sole_giu",
    ],
    [
      "ed-tp-contact",
      t("Sensore apertura infisso", "Window contact sensor"),
      "binary_sensor.finestra_camera",
    ],
    /* Il secondo contatto, quello di fuori (#254): la grata davanti al vetro.
     * Sta dopo l'infisso perche' e' l'ordine in cui si guardano dalla stanza —
     * prima il serramento, poi cio' che ci sta davanti — e perche' chi non ha
     * inferriate la trova in fondo e la salta. */
    [
      "ed-tp-inferriata",
      t("Sensore apertura inferriata", "Grate contact sensor"),
      "binary_sensor.inferriata_camera",
    ],
  ];
}

/* La stanza, in cima e col suo nome scritto sopra.
 *
 * «La stanza la devi spostare in alto dove si sceglie il nome e devi indicare
 * che e' la stanza.» Il guscio la stampa come un `<select>` nudo, senza
 * etichetta, subito dopo la casella dell'entita': con le sei caselle che
 * questo modulo aggiunge in mezzo finiva undici campi piu' giu', fra la
 * posizione preferita e la spunta delle percentuali invertite — una tendina
 * che diceva «Salone» senza dire di cosa.
 *
 * Va dove si decide di che riga si tratta: sotto il nome, prima di tutto il
 * resto. E si porta un'etichetta, come ogni altra casella della scheda.
 */
function vestiLaStanza(body) {
  const room = body?.querySelector?.("#ed-tp-room");
  const nome = body?.querySelector?.("#ed-tp-name");
  if (!room || !nome) return false;
  let riquadro = room.closest("label.ed-slot");
  if (!riquadro) {
    riquadro = doc.createElement("label");
    riquadro.className = "ed-slot dm-tw-slot";
    riquadro.dataset.dmTwSlot = "ed-tp-room";
    const testa = doc.createElement("span");
    testa.className = "ed-slot-lbl";
    testa.textContent = t("Stanza", "Room");
    room.before(riquadro);
    riquadro.append(testa, room);
    /* Il margine se lo prende il riquadro: il `<select>` lo portava addosso, e
     * dentro l'etichetta diventava uno stacco in mezzo alla casella. */
    room.style.marginBottom = "0";
  }
  /* Subito dopo il nome, a ogni giro: il guscio ristampa il modulo da capo
   * quando l'elenco cambia, e la tendina tornerebbe in fondo. */
  if (nome.nextElementSibling !== riquadro) nome.after(riquadro);
  return true;
}

/* La casella della posizione preferita (#200): un numero, non un'entita' —
 * niente lente. 0 = chiusa, 100 = aperta; e' la voce con la stella nella
 * tendina della card, non l'unica percentuale che si puo' scegliere. */
function casellaPreset() {
  const holder = doc.createElement("label");
  holder.className = "ed-slot dm-tw-slot";
  holder.dataset.dmTwSlot = "ed-tp-preset";
  holder.innerHTML =
    `<span class="ed-slot-lbl">${t("Posizione preferita (%)", "Favorite position (%)")}</span>` +
    '<input id="ed-tp-preset" class="ed-input" type="number" min="0" max="100" step="1"' +
    ' placeholder="es. 5" autocomplete="off">';
  return holder;
}

/* La stessa forma della casella del guscio («Entita' tapparella»): la casella
 * nuda con la lente, e il nome glielo scrive la carta delle entita', che lo
 * conosce per id. Con un'etichetta propria la carta trattava il campo da gia'
 * intitolato: la matita finiva su una riga a se' sopra la casella, e sette
 * campi della scheda non stavano in riga con il primo (visto sul campo). */
function casella(id, etichetta, esempio) {
  const holder = doc.createElement("div");
  holder.className = "dm-tw-slot";
  holder.dataset.dmTwSlot = id;
  holder.dataset.dmTwEtichetta = etichetta;
  holder.innerHTML =
    '<div class="dm-tw-campo" style="display:flex; gap:8px; margin-bottom:6px;">' +
    `<input id="${id}" class="ed-input mono" style="flex:1;" autocomplete="off" data-entity-input="true"` +
    ` placeholder="${esempio}">` +
    `<button type="button" class="dm-entity-picker" data-entity-target="${id}"` +
    ` aria-label="${t("Seleziona entità", "Choose entity")}">🔍</button>` +
    "</div>";
  return holder;
}

/* La soglia di chiusura di QUESTA riga (dal campo, dopo la #298): «ognuno puo'
 * avere una percentuale differente». Vuota, vale quella di casa scritta in
 * cima alla scheda. */
function casellaSogliaRiga() {
  const holder = doc.createElement("label");
  holder.className = "ed-slot dm-tw-slot";
  holder.dataset.dmTwSlot = "ed-tp-soglia-riga";
  holder.innerHTML =
    `<span class="ed-slot-lbl">${esc(t("Chiusa sotto il (%)", "Closed below (%)"))}</span>` +
    `<input id="ed-tp-soglia-riga" class="ed-input" type="number" min="0" max="${SOGLIA_CHIUSA_MASSIMA}" step="1"` +
    ` placeholder="${esc(t("come la casa", "as the house"))}" autocomplete="off">` +
    `<small>${esc(
      t(
        "Solo per questa finestra: ferma a questa percentuale o sotto conta come chiusa. Vuota, vale la soglia di casa scritta in cima.",
        "For this window only: resting at this percentage or below counts as closed. Empty, the house threshold at the top applies.",
      ),
    )}</small>`;
  return holder;
}

/* Dove attaccarle: subito sotto la casella della tapparella.
 *
 * Prima ci si ancorava alla stanza, e si cercava il suo contenitore con
 * `closest("label, .ed-slot, div")`. Ma nel markup del runtime la stanza e' un
 * `<select>` nudo: niente `label`, niente `.ed-slot`, e allora quel `div`
 * finale acchiappava il riquadro che avvolge tutto il pannello. Le tre caselle
 * uscivano dopo «Aggiungi tapparella» e dopo «Salva sezione», staccate dalla
 * riga che stanno descrivendo.
 *
 * Adesso si parte dalla casella principale e si sale finche' non si sta nello
 * stesso contenitore della stanza: quello e' il fratello da cui ripartire,
 * qualunque cosa gli abbia messo intorno chi impagina i campi. Non si esce mai
 * dal modulo, perche' non si guarda piu' un elenco di tag ma una parentela. */
function ancoraSottoLaPrincipale(body) {
  const primaria = body?.querySelector?.("#ed-tp-ent");
  const room = body?.querySelector?.("#ed-tp-room");
  if (!primaria || !room) return null;
  const contenitore = (room.closest("label, .ed-slot") || room).parentElement;
  if (!contenitore) return null;
  let nodo = primaria;
  while (nodo && nodo.parentElement !== contenitore) nodo = nodo.parentElement;
  return nodo || null;
}

/* La soglia di chiusura (#298), in cima alla scheda: e' di tutta la casa, non
 * di una riga, quindi sta prima dell'elenco e non dentro il modulo di una
 * tapparella.
 *
 * «Vorrei poter definire un valore percentuale, es. 10%, per considerare le
 * tapparelle chiuse: le imposto cosi' per mantenere un minimo il passaggio
 * d'aria, ma il sistema le rileva aperte.» Si scrive e vale subito: la pagina
 * Finestre e la tessera in Home rileggono la chiave a ogni giro. */
export function ensureSogliaField(body = doc?.getElementById("ed-body")) {
  const intro = body?.querySelector?.(".ed-intro");
  if (!intro || !body.querySelector("#ed-tp-name")) return false;
  let riquadro = body.querySelector("[data-dm-tw-soglia]");
  if (!riquadro) {
    riquadro = doc.createElement("label");
    riquadro.className = "ed-slot dm-tw-slot dm-tw-soglia";
    riquadro.dataset.dmTwSoglia = "true";
    riquadro.innerHTML =
      `<span class="ed-slot-lbl">${esc(t("Chiusa sotto il (%), di serie", "Closed below (%), by default"))}</span>` +
      `<input id="ed-tp-soglia" class="ed-input" type="number" min="0" max="${SOGLIA_CHIUSA_MASSIMA}" step="1"` +
      ' placeholder="0" autocomplete="off">' +
      `<small>${esc(
        t(
          "Una tapparella ferma a questa percentuale o sotto conta come chiusa, in pagina e in Home: chi lascia uno spiraglio del 10% per l'aria non se le sente dire aperte. Vale per tutte le finestre che non hanno una soglia propria nella loro riga. Zero è il comportamento di sempre.",
          "A shutter resting at this percentage or below counts as closed, on the page and on Home: whoever leaves a 10% gap for air is not told they are open. It applies to every window without a threshold of its own in its row. Zero is the behaviour of always.",
        ),
      )}</small>`;
    const campo = riquadro.querySelector("#ed-tp-soglia");
    campo.value = String(coverClosedThreshold(readJson(CHIAVE_SOGLIA_CHIUSA, 0)) || "");
    /* Si salva mentre si scrive: e' un numero solo, e un tasto «Salva» per un
     * numero solo sarebbe un gesto in piu' per niente. */
    campo.addEventListener("change", () => {
      const soglia = coverClosedThreshold(campo.value);
      campo.value = soglia ? String(soglia) : "";
      writeJsonIfChanged(CHIAVE_SOGLIA_CHIUSA, soglia);
      try {
        root.renderTapparelle?.();
      } catch (_error) {}
      try {
        renderHomeWidgets();
      } catch (_error) {}
      schedule();
    });
  }
  if (intro.nextElementSibling !== riquadro) intro.after(riquadro);
  return true;
}

export function ensureContactField(body = doc?.getElementById("ed-body")) {
  /* La soglia di chiusura (#298) sta sopra tutto: e' della casa, non della riga. */
  ensureSogliaField(body);
  /* Prima la stanza: sale in cima, e le sei caselle qui sotto si mettono in
   * fila dopo l'entita' senza trovarsela in mezzo. */
  vestiLaStanza(body);
  const ancora = ancoraSottoLaPrincipale(body);
  if (!ancora) return false;
  let ultimo = ancora;
  let aggiunte = 0;
  for (const [id, etichetta, esempio] of caselle()) {
    let campo = body.querySelector(`#${id}`);
    if (!campo) {
      campo = casella(id, etichetta, esempio);
      aggiunte += 1;
    } else {
      campo = campo.closest("[data-dm-tw-slot], label, .ed-slot") || campo;
    }
    /* Si rimette in fila a ogni giro: una casella stampata al posto sbagliato
     * da una versione precedente torna dove deve stare senza doverla rifare. */
    if (ultimo.nextElementSibling !== campo) ultimo.after?.(campo);
    ultimo = campo;
  }
  {
    let campo = body.querySelector("#ed-tp-preset");
    if (!campo) {
      campo = casellaPreset();
      aggiunte += 1;
    } else {
      campo = campo.closest("label, .ed-slot") || campo;
    }
    if (ultimo.nextElementSibling !== campo) ultimo.after?.(campo);
    ultimo = campo;
  }
  {
    let campo = body.querySelector("#ed-tp-soglia-riga");
    if (!campo) {
      campo = casellaSogliaRiga();
      aggiunte += 1;
    } else {
      campo = campo.closest("label, .ed-slot") || campo;
    }
    if (ultimo.nextElementSibling !== campo) ultimo.after?.(campo);
  }
  /* La prima casella e' quella del runtime: le si da' il nome che adesso le
   * spetta, perche' non e' piu' «l'entita'» ma quella della tapparella. */
  const primaria = body.querySelector("#ed-tp-ent");
  const etichetta = primaria?.closest(".ed-slot")?.querySelector(".ed-slot-lbl");
  if (etichetta) {
    const nome = t("Entità tapparella", "Cover entity");
    if (clean(etichetta.textContent) !== nome) etichetta.textContent = nome;
  }
  /* Il segnaposto diceva soltanto `cover.`, e chi ha una tapparella dietro un
   * rele' cercava una copertura che non esiste — e' esattamente il vicolo
   * cieco della segnalazione #194. La casella un rele' lo accetta da sempre:
   * adesso lo dice. Fuori dal ramo dell'etichetta, perche' la casella del
   * runtime non ha una `.ed-slot-lbl` e li' dentro non ci si arriva mai. */
  if (primaria) {
    const esempio = t(
      "cover.tapparella_x — oppure switch.tapparella_su",
      "cover.shutter_x — or switch.shutter_up",
    );
    if (primaria.placeholder !== esempio) primaria.placeholder = esempio;
  }
  /* E la riga in cima, che diceva «tapparelle (entità cover)»: e' la frase da
   * cui parte il vicolo cieco della #194 — chi ha la tapparella dietro uno
   * Shelly cerca una copertura che il suo impianto non espone, e si ferma li'.
   * La scheda dice invece tutte e tre le strade che conosce. */
  const intro = body.querySelector(".ed-intro");
  if (intro && !intro.dataset.dmTwIntro) {
    intro.dataset.dmTwIntro = "true";
    intro.textContent = t(
      "Le tapparelle e le tende compaiono nella pagina 🪟 Finestre, raggruppate per piano e stanza. Ogni riga accetta un'entità cover.* — con posizione e percentuali — oppure un relè switch.*: uno solo se accendendolo la tapparella sta su, due se ce n'è uno per la salita e uno per la discesa, come uno Shelly in modalità interruttore. Se la finestra si apre a mano — persiane, scuri, una maniglia — lascia vuote le caselle dei comandi e compila solo il sensore di apertura: la card la disegna lo stesso e dice se è aperta.",
      "Shutters and curtains show up on the 🪟 Windows page, grouped by floor and room. Every row accepts a cover.* entity — with position and percentages — or a switch.* relay: one when switching it on keeps the shutter up, two when one relay sends it up and another sends it down, like a Shelly in switch mode. When the window opens by hand — shutters, blinds, a handle — leave the command boxes empty and fill in the contact sensor alone: the card still draws it and says whether it is open.",
    );
  }
  /* Il menu del tipo non ha piu' ragione di esistere: se e' rimasto da una
   * versione precedente se ne va, o direbbe una cosa che nessuno legge. */
  body.querySelector("#ed-tp-kind")?.closest("label, .ed-slot")?.remove();
  return aggiunte > 0;
}

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    paintShutterWindows();
    ensureContactField();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

function installStyles() {
  installStyle(
    STYLE_ID,
    `
    /* L'infisso, sempre in primo piano: sta sopra le guide del vano, che sono
       l'ultimo strato che disegna il modulo della scena. */
    html body #page-tapparelle#page-tapparelle .dm-tw-infisso{
      position:absolute!important;inset:0!important;z-index:7!important;pointer-events:none!important}
    html body #page-tapparelle#page-tapparelle .dm-tw-telaio{
      position:absolute!important;inset:0!important;border:8px solid #e8edf3!important;border-radius:13px!important;
      box-shadow:inset 0 0 0 1px #b6c2d1,inset 0 2px 5px rgba(15,23,42,.16)!important}
    html body #page-tapparelle#page-tapparelle .dm-tw-anta{
      position:absolute!important;top:8px!important;bottom:8px!important;width:calc(50% - 8px)!important;
      border:6px solid #e8edf3!important;border-radius:7px!important;background:transparent!important;
      box-shadow:inset 0 0 0 1px #b6c2d1!important;
      transition:transform 1s cubic-bezier(.3,.7,.2,1),filter 1s ease!important}
    html body #page-tapparelle#page-tapparelle .dm-tw-anta-sx{left:8px!important;transform-origin:left center!important}
    html body #page-tapparelle#page-tapparelle .dm-tw-anta-dx{right:8px!important;transform-origin:right center!important}
    html body #page-tapparelle#page-tapparelle .dm-tw-maniglia{
      position:absolute!important;left:-9px!important;top:50%!important;width:7px!important;height:22px!important;
      border-radius:3px!important;background:linear-gradient(180deg,#cbd5e1,#94a3b8)!important;
      transform:translateY(-50%)!important;box-shadow:0 1px 2px rgba(15,23,42,.3)!important}
    html body #page-tapparelle#page-tapparelle .dm-tw-maniglia::after{
      content:""!important;position:absolute!important;left:-9px!important;top:7px!important;width:12px!important;height:5px!important;
      border-radius:3px!important;background:linear-gradient(180deg,#cbd5e1,#8fa0b3)!important}

    /* Aperta: le ante rientrano verso il cardine e fanno ombra su cio' che
       hanno dietro.
     *
     * Con la tapparella alzata bastava vedere il cielo scoperto. Con la
     * tapparella giu' no: le ante rientravano su un fondo dello stesso colore e
     * non si capiva piu' niente — la card diceva "finestra aperta" e mostrava
     * una tapparella chiusa qualunque.
     *
     * Adesso l'anta aperta resta un'anta: prende corpo, si stacca dal fondo, e
     * getta ombra su quello che ha dietro. E' l'ombra a dire che li' c'e' un
     * buco, e funziona sia sulla tapparella chiara sia sul cielo — senza
     * coprire ne' l'una ne' l'altro. Da chiusa l'anta resta trasparente, se no
     * si perderebbe il vetro. */
    html body #page-tapparelle#page-tapparelle .tapp-win[data-dm-infisso-stato="aperto"] .dm-tw-anta{
      transform:scaleX(.28)!important;
      background:linear-gradient(135deg,#f7fafc,#dbe3ec)!important;
      box-shadow:inset 0 0 0 1px #b6c2d1,6px 0 14px -4px rgba(15,23,42,.55)!important}
    html body #page-tapparelle#page-tapparelle .tapp-win[data-dm-infisso-stato="aperto"] .dm-tw-anta-dx{
      box-shadow:inset 0 0 0 1px #b6c2d1,-6px 0 14px -4px rgba(15,23,42,.55)!important}
    /* Lo spessore del muro attorno al buco. */
    html body #page-tapparelle#page-tapparelle .dm-tw-spalla{
      position:absolute!important;top:8px!important;bottom:8px!important;left:8px!important;right:8px!important;
      border-radius:7px!important;z-index:6!important;opacity:0!important;transition:opacity .9s ease!important;
      pointer-events:none!important;
      background:linear-gradient(90deg,rgba(15,23,42,.62) 0,rgba(15,23,42,.22) 9%,rgba(15,23,42,0) 22%,
                 rgba(15,23,42,0) 78%,rgba(15,23,42,.22) 91%,rgba(15,23,42,.62) 100%),
                 linear-gradient(180deg,rgba(15,23,42,.30),rgba(15,23,42,0) 26%)!important}
    html body #page-tapparelle#page-tapparelle .tapp-win[data-dm-infisso-stato="aperto"] .dm-tw-spalla{opacity:1!important}

    /* ── l'inferriata (#254) ────────────────────────────────────────────
     *
     * Sta FUORI, quindi davanti a tutto: sopra l'infisso, sopra il vano, sopra
     * la tapparella. Due mezze grate che si scostano di lato — non ante che
     * rientrano, perche' una grata scorre e non ruota.
     *
     * Sta DENTRO il telaio, non sopra: una grata copre il vetro, non la
     * cornice, e disegnandola da bordo a bordo si perdeva il serramento che
     * doveva proteggere. Le sbarre sono sottili e rade apposta: attraverso una
     * grata si vede fuori, ed e' l'unica cosa che la distingue da un muro.
     *
     * Il nodo c'e' sempre ma non si vede: senza il sensore dichiarato la card
     * resta quella di prima, pixel per pixel. */
    html body #page-tapparelle#page-tapparelle .dm-tw-grata{
      position:absolute!important;top:8px!important;bottom:8px!important;left:8px!important;
      right:8px!important;z-index:8!important;pointer-events:none!important;display:none!important}
    html body #page-tapparelle#page-tapparelle .tapp-win[data-dm-grata] .dm-tw-grata{display:block!important}
    html body #page-tapparelle#page-tapparelle .dm-tw-grata-meta{
      position:absolute!important;top:0!important;bottom:0!important;width:50%!important;
      transition:transform 1s cubic-bezier(.3,.7,.2,1)!important;
      /* Sbarre verticali rade piu' due traverse: si vede attraverso.
         Il ferro e' grigio chiaro (dal campo: «essendo molto scure, quando
         sono chiuse e la finestra e' aperta visivamente non e' il massimo»):
         una grata si legge dal disegno delle sbarre, non dal nero. */
      background:
        repeating-linear-gradient(90deg,
          rgba(148,163,184,.9) 0 3px,rgba(148,163,184,0) 3px 21px),
        linear-gradient(180deg,rgba(148,163,184,0) 0 21%,rgba(148,163,184,.9) 21% 24%,
          rgba(148,163,184,0) 24% 74%,rgba(148,163,184,.9) 74% 77%,rgba(148,163,184,0) 77%)!important;
      filter:drop-shadow(1px 1px 0 rgba(255,255,255,.55))!important}
    html body #page-tapparelle#page-tapparelle .dm-tw-grata-sx{left:0!important;transform-origin:left center!important}
    html body #page-tapparelle#page-tapparelle .dm-tw-grata-dx{right:0!important;transform-origin:right center!important}
    /* Aperta: le due meta' si ammucchiano contro i loro stipiti e il vetro
       torna sgombro nel mezzo. Restano visibili — una grata aperta non
       sparisce, si impacchetta di lato — e le sbarre schiacciate diventano
       una fascia fitta, che e' esattamente come si vede una grata a soffietto
       tirata da parte. */
    html body #page-tapparelle#page-tapparelle .tapp-win[data-dm-grata="aperta"] .dm-tw-grata-meta{
      transform:scaleX(.16)!important}
    /* Le sbarre trasversali (#297): «sarebbe ottimale vedere l'inferriata che
       si chiude, a barre trasversali sull'immagine». Da chiusa le due meta' si
       incontrano nel mezzo e le traverse corrono da bordo a bordo; e per non
       lasciarle al buio quando la finestra dietro e' chiusa, la grata porta
       un filo di luce sulla sbarra. */
    html body #page-tapparelle#page-tapparelle .tapp-win[data-dm-grata="chiusa"] .dm-tw-grata-meta{
      transform:scaleX(1)!important;
      background:
        repeating-linear-gradient(90deg,
          rgba(148,163,184,.92) 0 3px,rgba(148,163,184,0) 3px 21px),
        repeating-linear-gradient(180deg,
          rgba(148,163,184,0) 0 18px,rgba(148,163,184,.92) 18px 21px)!important}
    /* Il grigio sfumato (dal campo: «secondo me un grigio sfumato sarebbe
       meglio»). Dove il browser sa mascherare, la sbarra non e' una tinta
       piena ma va dal chiaro in alto al pieno in basso, con un filo di luce
       sul bordo: e' il ferro zincato controluce, e si legge tanto sul vetro
       aperto quanto sulle ante chiuse. Il ritaglio a sbarre lo fa la
       maschera, il colore e' un fondo solo; chi non sa mascherare tiene le
       sbarre grigie di sopra, che sono la stessa forma senza la sfumatura. */
    @supports (mask-image:linear-gradient(#000,#000)) or (-webkit-mask-image:linear-gradient(#000,#000)){
      html body #page-tapparelle#page-tapparelle .dm-tw-grata-meta{
        background:
          repeating-linear-gradient(90deg,rgba(255,255,255,.7) 0 1px,rgba(255,255,255,0) 1px 21px),
          linear-gradient(180deg,#e2e8f0 0%,#b4bfcd 55%,#8593a7 100%)!important;
        filter:none!important;
        -webkit-mask-image:
          repeating-linear-gradient(90deg,#000 0 3px,transparent 3px 21px),
          linear-gradient(180deg,transparent 0 21%,#000 21% 24%,transparent 24% 74%,#000 74% 77%,transparent 77%);
        mask-image:
          repeating-linear-gradient(90deg,#000 0 3px,transparent 3px 21px),
          linear-gradient(180deg,transparent 0 21%,#000 21% 24%,transparent 24% 74%,#000 74% 77%,transparent 77%)}
      html body #page-tapparelle#page-tapparelle .tapp-win[data-dm-grata="chiusa"] .dm-tw-grata-meta{
        background:
          repeating-linear-gradient(90deg,rgba(255,255,255,.7) 0 1px,rgba(255,255,255,0) 1px 21px),
          repeating-linear-gradient(180deg,rgba(255,255,255,0) 0 18px,rgba(255,255,255,.7) 18px 19px,rgba(255,255,255,0) 19px 21px),
          linear-gradient(180deg,#e2e8f0 0%,#b4bfcd 55%,#8593a7 100%)!important;
        -webkit-mask-image:
          repeating-linear-gradient(90deg,#000 0 3px,transparent 3px 21px),
          repeating-linear-gradient(180deg,transparent 0 18px,#000 18px 21px);
        mask-image:
          repeating-linear-gradient(90deg,#000 0 3px,transparent 3px 21px),
          repeating-linear-gradient(180deg,transparent 0 18px,#000 18px 21px)}
    }
    /* Prima la grata, poi la finestra (#297).
     *
     * Le due cose si muovono nell'ordine in cui le si tocca davvero: chiudendo,
       si tira la grata e poi si accostano le ante; aprendo, si spingono le ante
       e poi si scosta la grata. Su una card che ha la grata, l'anta che si
       chiude aspetta che la grata abbia finito, e la grata che si apre aspetta
       che le ante siano rientrate. Senza grata non cambia niente: il ritardo
       sta solo sotto «data-dm-grata». */
    html body #page-tapparelle#page-tapparelle .tapp-win[data-dm-grata][data-dm-infisso-stato="chiuso"] .dm-tw-anta{
      transition-delay:.9s!important}
    html body #page-tapparelle#page-tapparelle .tapp-win[data-dm-grata="aperta"] .dm-tw-grata-meta{
      transition-delay:.9s!important}
    html body #page-tapparelle#page-tapparelle .tapp-win[data-dm-grata="aperta"][data-dm-infisso-stato="chiuso"] .dm-tw-grata-meta{
      transition-delay:0s!important}

    /* Con due pastiglie il nome tiene la sua riga e lo stato va a capo. */
    html body #page-tapparelle#page-tapparelle .tapp-head[data-dm-tw-pills="due"]{
      flex-wrap:wrap!important;justify-content:flex-start!important;row-gap:8px!important}
    html body #page-tapparelle#page-tapparelle .tapp-head[data-dm-tw-pills="due"]>.dm-tapp-title{
      flex:1 1 100%!important;min-width:0!important}

    /* La pastiglia dell'infisso vive accanto a quella della tapparella, e la
       forma la da' gia' chi possiede .tapp-state: qui si cambia solo il colore. */
    html body #page-tapparelle#page-tapparelle .dm-tw-pill{
      background:rgba(245,158,11,.18)!important;border-color:rgba(245,158,11,.34)!important;color:#b45309!important}

    #ed-body .dm-tw-contact-slot{display:block!important;margin-top:10px!important}
    /* La soglia (#298): una casella stretta col suo aiuto sotto, e senza la
       matita — non e' un'etichetta da rinominare, e' un numero da scrivere. */
    #ed-body .dm-tw-soglia{display:block;margin:6px 0 12px}
    #ed-body .dm-tw-soglia #ed-tp-soglia{max-width:140px}
    #ed-body .dm-tw-soglia small{
      display:block;margin:4px 2px 0;font-size:11px;line-height:1.45;color:var(--text-dim,#64748b)}
  `,
  );
}

export function installShutterWindowSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:state-changed",
    // Quando arriva una configurazione condivisa il modulo della scena rifa' la
    // griglia da capo con innerHTML, e con lei sparisce ogni infisso: senza
    // questo, le card restavano senza finestra fino al primo cambio di stato.
    "dashboardmodern:persistence-restored",
    /* E ogni volta che il corpo della configurazione viene rifatto.
     *
     * Le tre caselle in piu' — la tenda, la tenda da sole, il contatto — le
     * rimetteva il giro appeso al cambio di linguetta. Ma la scheda la ridisegna
     * anche il modello, a ogni salvataggio, e li' se ne andavano: si aggiungeva
     * una tapparella e le caselle sparivano, come se non fossero mai esistite.
     * Per rivederle bisognava uscire dalla linguetta e rientrarci. */
    "dashboardmodern:editor-rendered",
    "pageshow",
  ]) {
    root.addEventListener?.(eventName, schedule);
  }
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.("[data-tab],[data-page],.ed-tab,.tapp-btn")) {
        root.setTimeout?.(schedule, 0);
      }
    },
    true,
  );
  schedule();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installShutterWindowSection, { once: true });
} else {
  installShutterWindowSection();
}
