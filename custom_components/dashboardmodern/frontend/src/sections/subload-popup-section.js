// DM-FIX-20260817C
/* The popup a flow circle opens, rendered from the same loads the stage uses.
 *
 * The legacy renderer built its cards from a parallel runtime object and gave
 * every idle appliance the same alert red it used for problems, so a quiet
 * kitchen looked like a fault and the group total was nowhere on screen. This
 * owner re-renders the list after the legacy one runs: same modal, same open
 * and close, same click-through to history — a card that says what the
 * appliance is doing, how much of the group it is drawing, and a header
 * carrying the total the bubble shows.
 *
 * Event driven: it wraps the popup opener, with no polling and no observer.
 */
import { subloadPopupModel } from "../core/subload-popup-model.js";
import { flowStageModel, subloadsOf } from "../core/energy-flow-topology.js";
import { onRunHoldExpiry } from "../core/appliance-view-model.js";
import {
  allStates,
  clean,
  doc,
  english,
  installStyle,
  locale,
  readJson,
  root,
  section,
  t,
  writeIconGlyph,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_SUBLOAD_POPUP__";
const state = (root[KEY] ||= { installed: false, group: "" });
const LIST = "subloads-list";
const TITLE = "subloads-title";

function configuredLoads() {
  const value = section("loads", null);
  if (Array.isArray(value)) return value;
  const stored = readJson("cd_loads", []);
  return Array.isArray(stored) ? stored : [];
}

/* The circle the popup was opened from. Legacy passes the group id, which for
 * a migrated load is still "cucina" and for a new one is the load id; period
 * views append the period, exactly as the stage's click target builds it. */
function loadForGroup(groupId) {
  const group = clean(groupId).replace(/_(day|month)$/, "");
  if (!group) return null;
  const loads = configuredLoads();
  return (
    loads.find(
      (item) =>
        !clean(item?.metadata?.beta27_subload_group) &&
        (clean(item?.id) === group ||
          clean(item?.metadata?.beta27_subload_group) === group ||
          clean(item?.name).toLowerCase() === group.toLowerCase()),
    ) || null
  );
}

/* Which period the circle was clicked in, so the title reads like the rest of
 * the dashboard: "CUCINA · ISTANTANEO". */
function periodLabel(groupId) {
  const match = /_(day|month)$/.exec(clean(groupId));
  if (match?.[1] === "day") return t("GIORNO", "DAY");
  if (match?.[1] === "month") return t("MESE", "MONTH");
  return t("ISTANTANEO", "INSTANT");
}

/* The modal keeps its static "CARICHI" heading otherwise, which says nothing
 * about which circle was opened. */
function writeTitle(model, groupId) {
  const title = doc?.getElementById?.(TITLE);
  if (!title) return false;
  title.replaceChildren();
  const icon = iconSpan("dm-subload-title-icon", model.icon);
  const name = element("span", "dm-subload-title-name", model.name.toUpperCase());
  const period = element("small", "dm-subload-title-period", periodLabel(groupId));
  title.append(icon, name, period);
  title.dataset.dmSubloadTitle = model.id || model.name;
  return true;
}

function element(tag, className = "", text = "") {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/* An icon may be an emoji or an `mdi:` token — the canonical picker writes
 * either. A token printed as text would show "mdi:stove" where the circle
 * shows the glyph.
 *
 * Il segno del disegno gia' fatto serve: per un `mdi:` il motore scrive
 * `innerHTML`, e riscriverlo a ogni giro di stati rifarebbe quel pezzetto di
 * albero venti volte al minuto senza che nulla sia cambiato. */
function iconInto(target, icon) {
  if (!target) return target;
  const token = clean(icon);
  if (target.dataset.dmSubloadIcon === token) return target;
  target.dataset.dmSubloadIcon = token;
  writeIconGlyph(target, icon, { size: 24, kind: "load" });
  return target;
}

function iconSpan(className, icon) {
  return iconInto(element("span", className), icon);
}

/* La carta si costruisce vuota e la riempie `aggiornaCarta`: cosi' quello che
 * si vede appena stampata e quello che si vede al giro dopo lo scrive la stessa
 * mano, e non possono divergere. */
function card(item, model) {
  const node = element("article", "dm-subload-card hist-clickable");
  node.dataset.dmSubloadCard = item.id;
  /* Il bersaglio dello storico si legge dal nodo, non da quello che l'item
   * era il giorno in cui la carta e' stata stampata.
   *
   * L'ascoltatore si mette una volta e resta; se si tenesse stretto l'`item`
   * di allora, un apparecchio a cui cambia il sensore o il nome — un
   * salvataggio nell'editor, una configurazione che arriva da un altro
   * dispositivo — mostrerebbe il valore nuovo e aprirebbe lo storico del
   * sensore vecchio. E una carta stampata quando il sensore non c'era ancora
   * non diventerebbe cliccabile nemmeno quando arriva. */
  node.addEventListener("click", (event) => {
    const entita = clean(node.dataset.dmSubloadEntity);
    if (entita) root.apriStorico?.(event, entita, node.dataset.dmSubloadName || "");
  });

  const head = element("div", "dm-subload-head");
  head.append(element("span", "dm-subload-icon"));
  const title = element("div", "dm-subload-title");
  title.append(element("b", "dm-subload-name"), element("small", "dm-subload-state"));
  head.append(title);
  node.append(head);

  const value = element("div", "dm-subload-value");
  value.append(element("span", "dm-subload-power"));
  node.append(value);

  const meter = element("div", "dm-subload-meter");
  meter.append(element("span", "dm-subload-meter-fill"));
  node.append(meter);

  aggiornaCarta(node, item, model);
  return node;
}

/* Si scrive solo quello che cambia.
 *
 * Il lampo del secondo filmato — beta.4 installata, carte che restano al loro
 * posto — non era piu' la lista che si svuota: era la lista che si RISCRIVE
 * anche quando non e' cambiato niente. Al banco, dieci giri di stati identici
 * facevano cento scritture sul DOM: sessanta spostamenti di nodi e quaranta
 * attributi riscritti col valore che avevano gia'.
 *
 * Dentro un velo sfocato ogni scrittura e' un livello da ridipingere, e finche'
 * il livello non e' pronto resta il bianco del foglio. Ecco perche' i due
 * fotogrammi ai lati del lampo erano IDENTICI: non stava cambiando niente, si
 * stava solo riscrivendo.
 *
 * Assegnare lo stesso valore a `textContent`, a un `data-` o a una proprieta'
 * CSS non e' gratis: il browser non confronta, invalida. Confrontare qui costa
 * un `===`. */
const poniTesto = (nodo, testo) => {
  if (nodo && nodo.textContent !== testo) nodo.textContent = testo;
};
const poniDato = (nodo, chiave, valore) => {
  if (nodo && nodo.dataset[chiave] !== valore) nodo.dataset[chiave] = valore;
};
const poniStile = (nodo, nome, valore) => {
  if (nodo && nodo.style.getPropertyValue(nome) !== valore) nodo.style.setProperty(nome, valore);
};
const poniNascosto = (nodo, nascosto) => {
  if (nodo && nodo.hidden !== nascosto) nodo.hidden = nascosto;
};

/* I valori nuovi dentro la carta che c'e' gia'. */
function aggiornaCarta(node, item, model) {
  if (!node) return false;
  poniDato(node, "dmSubloadState", item.state);
  poniDato(node, "dmSubloadEntity", clean(item.entity));
  poniDato(node, "dmSubloadName", clean(item.name));
  poniStile(node, "--dm-subload-color", item.color);
  poniStile(node, "--dm-subload-tint", item.tint);
  iconInto(node.querySelector(".dm-subload-icon"), item.icon);
  poniTesto(node.querySelector(".dm-subload-name"), item.name);
  poniTesto(node.querySelector(".dm-subload-state"), ETICHETTE()[item.state]);
  poniTesto(node.querySelector(".dm-subload-power"), item.powerText);
  scriviIlGiorno(node, item);
  poniStile(
    node.querySelector(".dm-subload-meter-fill"),
    "width",
    `${Math.round(item.share * 100)}%`,
  );
  // The share is only meaningful when something in the group is drawing.
  poniNascosto(node.querySelector(".dm-subload-meter"), !model.total);
  return true;
}

/* La riga dei kWh di oggi va e viene, ed e' l'unica cosa che cambia la FORMA
 * della carta mentre la finestra e' aperta: basta che il contatore giornaliero
 * risponda «non disponibile» per un giro e la riga sparisce, al ritorno del
 * dato si rimette. Prima quel cambio di forma faceva rifare l'intera lista —
 * otto carte buttate via per una riga sola. Adesso si aggiunge o si toglie
 * quella riga, e le carte restano dove sono. */
function scriviIlGiorno(node, item) {
  const riga = node.querySelector(".dm-subload-daily");
  if (!item.dailyText) {
    riga?.remove?.();
    return;
  }
  const testo = `${item.dailyText} ${t("oggi", "today")}`;
  if (riga) {
    if (riga.textContent !== testo) riga.textContent = testo;
    return;
  }
  node.querySelector(".dm-subload-value")?.append(element("small", "dm-subload-daily", testo));
}

/* La lista si aggiorna, non si rifa'. Mai.
 *
 * «mi devi risolvere questo continuo fleak sulla sezione energia nei popup»:
 * nel filmato, a finestra aperta e ferma, la griglia delle carte sparisce per
 * un fotogramma solo — un lampo bianco — e torna. Sei volte in dieci secondi,
 * a intervalli irregolari: il passo degli aggiornamenti che arrivano da casa.
 *
 * Il lampo non e' un difetto di disegno, e' quello che si vede in mezzo a un
 * `replaceChildren` sulla lista. La finestra sta dentro un velo sfocato
 * (`backdrop-filter` sul `.modal-wrapper`), che sul telefono e' un livello a
 * se': tolte le carte, il livello va ridipinto, e finche' non e' pronto resta
 * il bianco del foglio. Il computer non lo mostra — ridipinge in tempo — ed e'
 * per questo che il difetto e' sempre stato «solo sul telefono».
 *
 * A far rifare la lista bastava, sopra ogni altra cosa, la riga dei kWh di
 * oggi che appariva o spariva: un contatore giornaliero che risponde «non
 * disponibile» per un giro, e otto carte venivano buttate via e ristampate.
 *
 * Qui non si butta via niente: la testata e la griglia si fanno una volta e
 * restano, le carte si riconoscono dall'identificativo e si aggiornano dove
 * sono, se ne aggiunge una solo quando l'apparecchio e' nuovo e se ne toglie
 * una solo quando l'apparecchio non c'e' piu'. Senza strappo non c'e' lampo. */
function riconcilia(list, model) {
  let testata = list.querySelector(".dm-subload-summary");
  let griglia = list.querySelector(".dm-subload-grid");
  if (!testata || !griglia) {
    /* Qui non c'e' niente di nostro da salvare: o e' la prima apertura, o ha
     * scritto il guscio. Rifare adesso non si vede, perche' quello che si
     * butta non e' quello che si sta guardando. */
    testata = header(model);
    griglia = element("div", "dm-subload-grid");
    list.replaceChildren(testata, griglia);
  } else {
    aggiornaTestata(testata, model);
  }

  const vuoto = griglia.querySelector(".dm-subload-empty");
  if (!model.count && !vuoto)
    griglia.append(
      element(
        "div",
        "dm-subload-empty",
        t(
          "Nessun dispositivo in questo carico. Aggiungili dall'editor Carichi.",
          "No appliance in this load yet. Add them from the Loads editor.",
        ),
      ),
    );
  else if (model.count && vuoto) vuoto.remove?.();

  /* Le carte si cercano per dataset, non per selettore: un identificativo puo'
   * contenere qualunque cosa e non tutti i motori hanno CSS.escape. */
  const carte = new Map(
    [...griglia.querySelectorAll("[data-dm-subload-card]")].map((nodo) => [
      nodo.dataset.dmSubloadCard,
      nodo,
    ]),
  );
  const vivi = new Set();
  const inFila = [];
  for (const item of model.items) {
    vivi.add(item.id);
    const nodo = carte.get(item.id);
    if (nodo) aggiornaCarta(nodo, item, model);
    inFila.push(nodo || card(item, model));
  }
  for (const [id, nodo] of carte) if (!vivi.has(id)) nodo.remove?.();

  /* La classifica cambia coi watt, e rimettere in fila costa: ogni `append` e'
   * un nodo che si sposta davvero, anche quando lo si rimette dov'era gia'.
   * Otto carte, otto spostamenti, a ogni giro di stati — e ogni spostamento
   * dentro il velo sfocato e' un livello da ridipingere. Adesso si guarda chi
   * NON e' al suo posto, e si sposta solo quello: a classifica ferma non si
   * tocca niente. */
  const gia = vuotoInScena(griglia) ? 1 : 0;
  for (let posto = 0; posto < inFila.length; posto++) {
    const atteso = inFila[posto];
    const attuale = griglia.children[posto + gia];
    if (attuale === atteso) continue;
    if (attuale) griglia.insertBefore(atteso, attuale);
    else griglia.append(atteso);
  }
  return true;
}

const vuotoInScena = (griglia) => Boolean(griglia.querySelector(".dm-subload-empty"));

const ETICHETTE = () => ({
  running: t("IN FUNZIONE", "RUNNING"),
  standby: t("STANDBY", "STANDBY"),
  off: t("SPENTO", "OFF"),
  unknown: t("NON DISPONIBILE", "UNAVAILABLE"),
});

function header(model) {
  const node = element("div", "dm-subload-summary");
  const total = element("div", "dm-subload-total");
  total.append(
    element("span", "dm-subload-total-value"),
    element("small", "dm-subload-total-count"),
  );
  node.append(element("span", "dm-subload-summary-icon"), total);
  aggiornaTestata(node, model);
  return node;
}

/* La fascia del totale si scrive addosso a se stessa: e' la stessa mano che la
 * riempie appena fatta e che la aggiorna a ogni giro, cosi' non ci sono due
 * versioni della stessa riga che possono divergere. */
function aggiornaTestata(node, model) {
  if (!node) return false;
  poniStile(node, "--dm-subload-color", model.color);
  iconInto(node.querySelector(".dm-subload-summary-icon"), model.icon);
  poniTesto(node.querySelector(".dm-subload-total-value"), model.totalText);
  poniTesto(
    node.querySelector(".dm-subload-total-count"),
    model.count
      ? `${model.running}/${model.count} ${t("in funzione", "running")}`
      : t("nessun dispositivo", "no appliance"),
  );
  return true;
}

/* The circle's name, icon and colour as the stage resolved them.
 *
 * A saved `cd_flow_nodes` customization renames a circle on the stage before
 * that customization has been folded into the load, so reading the canonical
 * load here would head the popup with a different name from the circle that
 * was clicked. Asking the same model the stage asks keeps the two identical by
 * construction rather than by agreement. */
function stageIdentity(load, loads, appliances) {
  const fallback = {
    id: clean(load.id),
    name: clean(load.name),
    icon: clean(load.emoji_icon || load.icon),
    color: clean(load.color || load.metadata?.flow_color),
  };
  /* Nome, icona e colore non cambiano coi watt: il palco intero si calcolava
   * a ogni giro di stati solo per rileggerli — ed e' il conto piu' caro di
   * tutta la finestra. Si tiene da parte, con una chiave che comprende quello
   * che potrebbe cambiarli: la personalizzazione del cerchio e i campi del
   * carico. Cosi' un cerchio rinominato si vede subito lo stesso. */
  const flowNodes = readJson("cd_flow_nodes", null);
  let chiave = "";
  try {
    /* La personalizzazione puo' stare sotto lo slot storico («boiler») e non
     * sotto l'identificativo del carico: nella chiave ci va tutta. */
    chiave = `${fallback.id}§${fallback.name}§${fallback.icon}§${fallback.color}§${JSON.stringify(
      flowNodes ?? null,
    )}`;
  } catch (_errore) {
    chiave = "";
  }
  if (chiave && state.identita?.chiave === chiave) return state.identita.valore;
  try {
    const stage = flowStageModel({
      loads,
      appliances,
      flowNodes,
      states: allStates(),
    });
    const node = stage.nodes.find((item) => clean(item.id) === fallback.id);
    const valore = node
      ? { id: node.id, name: node.name, icon: node.icon, color: node.color }
      : fallback;
    if (chiave) state.identita = { chiave, valore };
    return valore;
  } catch (_error) {
    return fallback;
  }
}

export function renderSubloadPopup(groupId = state.group) {
  const list = doc?.getElementById?.(LIST);
  if (!list) return false;
  const load = loadForGroup(groupId);
  if (!load) return false;
  const loads = configuredLoads();
  const stored = section("appliances", null);
  const appliances = Array.isArray(stored) ? stored : readJson("cd_appliances", []);
  const model = subloadPopupModel({
    load: stageIdentity(load, loads, appliances),
    children: subloadsOf(load, loads, Array.isArray(appliances) ? appliances : []),
    states: allStates(),
    locale: locale(),
  });

  /* La testata del modale — nome, icona, periodo — si riscrive solo quando c'e'
   * qualcosa di diverso da dire. La firma sono gli apparecchi, piu' l'identita'
   * del cerchio: se un cerchio del flusso viene rinominato, ricolorato o cambia
   * icona mentre il popup e' aperto, gli apparecchi restano gli stessi e la
   * finestra continuerebbe a portare il nome vecchio finche' non la si
   * richiude.
   *
   * E c'e' dentro anche il gruppo, non solo il carico: le viste per periodo
   * sono lo stesso cerchio con un suffisso (`cucina`, `cucina_month`) e hanno
   * gli stessi apparecchi, quindi passando da ISTANTANEO a MESE la testata
   * sarebbe rimasta a dire ISTANTANEO.
   *
   * L'altra ragione per riscriverla e' che il guscio ci sia passato sopra col
   * suo `innerHTML`: allora il nostro nome non c'e' piu', e la firma da sola
   * non se ne accorgerebbe. */
  const firma = `${groupId}§${model.id}§${model.items
    .map((item) => item.id)
    .sort()
    .join(",")}§${model.name}§${model.icon}§${model.color}`;
  const titolo = doc?.getElementById?.(TITLE);
  if (list.dataset.dmSubloadFirma !== firma || !titolo?.querySelector?.(".dm-subload-title-name"))
    writeTitle(model, groupId);

  poniDato(list, "dmSubloadOwner", "beta30");
  poniDato(list, "dmSubloadCount", String(model.count));
  poniDato(list, "dmSubloadFirma", firma);
  riconcilia(list, model);
  return true;
}

function installStyles() {
  installStyle(
    "dm-subload-popup-style",
    `
    #subloads-list[data-dm-subload-owner="beta30"]{display:block!important}
    #subloads-title[data-dm-subload-title]{display:flex!important;align-items:center;gap:10px;flex-wrap:wrap}
    .dm-subload-title-icon{font-size:26px;line-height:1}
    .dm-subload-title-icon .dm-icon-engine-glyph,.dm-subload-summary-icon .dm-icon-engine-glyph,.dm-subload-icon .dm-icon-engine-glyph{font-size:inherit!important;height:auto!important}
    .dm-subload-title-name{color:var(--text,#0f172a);font-weight:900;letter-spacing:.5px}
    .dm-subload-title-period{color:var(--muted,#64748b);font-size:11px;font-weight:800;letter-spacing:1.4px}
    .dm-subload-summary{display:flex;align-items:center;gap:14px;margin:0 0 16px;padding:14px 18px;border-radius:22px;border:1px solid color-mix(in srgb,var(--dm-subload-color,#0ea5e9) 24%,transparent);background:color-mix(in srgb,var(--dm-subload-color,#0ea5e9) 10%,var(--card-bg,#fff))}
    .dm-subload-summary-icon{font-size:30px;line-height:1}
    .dm-subload-total{display:flex;flex-direction:column;min-width:0}
    .dm-subload-total-value{font-family:'Oswald',sans-serif;font-size:30px;font-weight:700;line-height:1.05;color:var(--text,#0f172a)}
    .dm-subload-total small{color:var(--muted,#64748b);font-size:12px;font-weight:700;letter-spacing:.4px;text-transform:uppercase}
    .dm-subload-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:14px}
    .dm-subload-empty{grid-column:1/-1;padding:26px;text-align:center;color:var(--muted,#64748b);font-weight:700}
    .dm-subload-card{display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:22px;border:1px solid var(--card-border,rgba(15,23,42,.10));background:var(--card-bg,#fff);box-shadow:var(--shadow-glass,0 10px 30px rgba(15,23,42,.06));cursor:pointer;transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease}
    .dm-subload-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-hover,0 18px 44px rgba(15,23,42,.12));border-color:color-mix(in srgb,var(--dm-subload-color,#64748b) 42%,transparent)}
    .dm-subload-card[data-dm-subload-state="running"]{border-color:color-mix(in srgb,var(--dm-subload-color) 46%,transparent);background:linear-gradient(180deg,color-mix(in srgb,var(--dm-subload-tint) 60%,var(--card-bg,#fff)),var(--card-bg,#fff))}
    .dm-subload-card[data-dm-subload-state="off"],.dm-subload-card[data-dm-subload-state="unknown"]{opacity:.86}
    .dm-subload-head{display:flex;align-items:center;gap:11px;min-width:0}
    .dm-subload-icon{display:grid;place-items:center;flex:none;width:42px;height:42px;border-radius:14px;background:color-mix(in srgb,var(--dm-subload-tint) 70%,transparent);font-size:23px}
    .dm-subload-title{display:flex;flex-direction:column;min-width:0}
    /* Il nome va a capo invece dei puntini: «Condizio…» non diceva quale.
     * Due righe bastano a ogni nome vero. */
    .dm-subload-title b{color:var(--text,#0f172a);font-size:14px;font-weight:800;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .dm-subload-title small{color:var(--dm-subload-color,#64748b);font-size:10px;font-weight:900;letter-spacing:1.1px}
    /* I watt sopra, i kWh di oggi sotto: affiancati («0 W 0,2 kWh oggi») si
     * leggevano come un numero solo. */
    .dm-subload-value{display:flex;flex-direction:column;align-items:flex-start;gap:3px}
    .dm-subload-power{font-family:'Oswald',sans-serif;font-size:26px;font-weight:700;line-height:1;color:var(--text,#0f172a)}
    .dm-subload-daily{color:var(--muted,#64748b);font-size:12px;font-weight:700}
    .dm-subload-meter{height:6px;border-radius:999px;background:color-mix(in srgb,var(--divider-color,#e2e8f0) 80%,transparent);overflow:hidden}
    .dm-subload-meter[hidden]{display:none}
    .dm-subload-meter-fill{display:block;height:100%;border-radius:999px;background:var(--dm-subload-color,#0ea5e9);transition:width .3s ease}
    @media(max-width:520px){.dm-subload-grid{grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:11px}.dm-subload-power{font-size:23px}}
    @media(prefers-reduced-motion:reduce){.dm-subload-card,.dm-subload-meter-fill{transition:none}}
  `,
  );
}

/* Il disegnatore del guscio, quello che non deve piu' toccare la lista.
 *
 * `renderSubLoads` fa una cosa sola: `subloads-list.innerHTML = html`. E il
 * battito degli stati lo richiama a popup aperto, ogni volta:
 *
 *     if (currentPopupType.startsWith('subloads_')) renderSubLoads(...)
 *
 * Cosi' a ogni giro le carte moderne venivano spazzate via e rimesse subito
 * dopo. E' il «fleak»: nel video la griglia sparisce e torna, e in mezzo resta
 * la sola fascia del totale sul bianco. Rimetterle dopo non basta — fra lo
 * strappo e il rimedio ci sta un fotogramma, e quel fotogramma si vede.
 * L'unico modo per non farlo vedere e' non strappare. */
const SOLO_NOSTRO = new Set(["renderSubLoads"]);

function wrapOpener(name) {
  const current = root[name];
  const marker = `__dmSubloadPopup_${name}`;
  if (typeof current !== "function" || current[marker]) return false;
  const wrapped = function (group, ...rest) {
    state.group = clean(group);
    /* Se questa finestra la sappiamo disegnare noi, la disegniamo e basta: il
     * guscio non scrive, quindi non c'e' niente da rimettere a posto. Se non
     * la sappiamo disegnare — un tipo di sotto-carichi che il modulo non
     * conosce — `renderSubloadPopup` dice di no e il guscio lavora come
     * prima. */
    if (SOLO_NOSTRO.has(name) && renderSubloadPopup(state.group)) return undefined;
    const result = current.call(this, group, ...rest);
    /* Qui il guscio ha appena scritto: si rimpiazza SUBITO, nello stesso giro,
     * cosi' la sua versione non arriva mai allo schermo. I due ripensamenti
     * restano per quando il primo colpo non riesce, che e' all'apertura:
     * la finestra non e' ancora in scena. */
    if (renderSubloadPopup(state.group)) return result;
    root.queueMicrotask?.(() => renderSubloadPopup(state.group));
    root.setTimeout?.(() => renderSubloadPopup(state.group), 60);
    return result;
  };
  wrapped[marker] = true;
  wrapped.__dmWrappedOriginal = current;
  root[name] = wrapped;
  return true;
}

function bindOpeners() {
  for (const name of ["apriSubLoads", "openSubLoads", "renderSubLoads"]) wrapOpener(name);
}

/* La finestra e' aperta e in scena? Il ridisegno di una finestra chiusa e'
 * lavoro buttato, e la sveglia del ritardo suona anche a popup chiuso. */
function finestraAperta() {
  const modale = doc?.getElementById?.("subloads-modal");
  return Boolean(state.group) && Boolean(modale?.classList?.contains?.("show"));
}

export function installSubloadPopupSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  bindOpeners();
  root.dmRenderSubloadPopup = renderSubloadPopup;
  /* Il ritardo di fine ciclo scade da solo, e quando scade nessuno manda
   * niente: la lavastoviglie che ha finito di asciugare non cambia stato in
   * Home Assistant, e' il tempo che passa. Senza questa sveglia una finestra
   * lasciata aperta continuerebbe a dire IN FUNZIONE — e a contarlo nella
   * fascia del totale — finche' non arriva un aggiornamento per altri motivi.
   * E' la stessa sveglia a cui e' iscritta la sezione Elettrodomestici. */
  onRunHoldExpiry(() => {
    if (finestraAperta()) renderSubloadPopup(state.group);
  });
  for (const name of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
  ])
    root.addEventListener?.(name, () => {
      bindOpeners();
      if (state.group) renderSubloadPopup(state.group);
    });
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installSubloadPopupSection, { once: true });
else installSubloadPopupSection();
