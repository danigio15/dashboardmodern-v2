/* Quali entita' finiscono nei widget, entita' per entita'.
 *
 * Le tessere del ponte leggono la configurazione della sezione che
 * raccontano, tutta: le luci sono quelle della scheda Luci, le tapparelle
 * quelle della scheda Tapparelle. Va bene finche' uno le vuole tutte, ma la
 * sezione e il widget non servono la stessa cosa — in Home si guarda di
 * sfuggita — e senza una parola in contrario non c'era modo di dire «questa
 * no».
 *
 * La parola in contrario sta accanto all'entita' stessa, in ogni scheda della
 * configurazione, sulla riga in cui quell'entita' e' gia' scritta: un
 * interruttore che dice se va in Home. Non e' una lista a parte da tenere
 * allineata a mano — e' la riga che c'e' gia', con una decisione in piu'.
 *
 * Le righe le disegna il runtime, ognuna a modo suo, ma tutte scrivono
 * l'entity_id in chiaro dentro `.ed-row-old`: e' quello il gancio. Chi non
 * mostra un entity_id — una stanza senza sensori, una voce di testo — non
 * riceve niente, perche' non c'e' niente da escludere.
 *
 * La scelta si tiene in `cd_widgets.excluded`, insieme all'ordine delle
 * tessere e a quelle nascoste: chi non e' nell'elenco e' dentro, cosi' chi
 * non tocca niente continua a vedere quello che vedeva.
 *
 * ── Di quale tessera si sta parlando ────────────────────────────────────
 *
 * «se la finestra e configurata nella sezione finestre e no nei varchi la
 *  segnalazione resta in finestre non deve scomparire»
 *
 * Lo stesso contatto sta scritto due volte: nelle Finestre, accanto alla
 * tapparella, e nei Varchi, che contano cosa e' aperto. Sono due sezioni e due
 * tessere. L'interruttore spegneva l'entita' e non la riga, e toccarlo nei
 * Varchi la faceva sparire anche dalle Finestre.
 *
 * Adesso la scelta si scrive «tessera|entita'», e la tessera la dice la riga:
 * il marchio della scheda che la contiene se ce l'ha, se no il posto del
 * blocco fra quelli della linguetta, se no la linguetta stessa. Quando
 * nessuna delle tre risponde — gli Avvisi servono tre tessere sulla stessa
 * pagina — la voce si scrive nuda e vale ovunque, come prima: meglio una
 * scelta che vale dappertutto di una che vale nel posto sbagliato. La regola
 * sta in `fuori-dai-widget.js`.
 */
import {
  WIDGETS_CONFIG_KEY,
  renderHomeWidgets,
  widgetPreferences,
} from "./home-widgets-section.js";
import {
  escluseDellaTessera,
  ilGruppoNonHaTessera,
  MARCHIO_TESSERA,
  rimettiNellaTessera,
  tesseraDelBlocco,
  tesseraDelGruppo,
  tesseraDellaScheda,
  togliDallaTessera,
} from "../core/fuori-dai-widget.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_WIDGET_ENTITY_CHOICE__";
const state = (root[KEY] ||= { installed: false });

const ENTITY_RE = /^[a-z_]+\.[a-z0-9_]+$/i;
export const CHOICE_ATTRIBUTE = "data-dm-widget-entities";
/* La tessera per cui parla questo interruttore, scritta addosso al tasto: al
 * tocco non si torna a chiedere alla pagina dov'era la riga, si legge quello
 * che si era gia' capito quando la si e' disegnata. */
export const TESSERA_ATTRIBUTE = "data-dm-widget-tessera";

/* ── la memoria ───────────────────────────────────────────────────────── */

function elencoDelleEscluse() {
  return widgetPreferences().excluded;
}

function salvaEscluse(elenco) {
  const stored = readJson(WIDGETS_CONFIG_KEY, {});
  const base = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  writeJsonIfChanged(WIDGETS_CONFIG_KEY, { ...base, excluded: [...new Set(elenco)].sort() });
  try {
    renderHomeWidgets();
  } catch (_error) {}
}

/* ── di quale tessera parla questa riga ────────────────────────────────── */

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

/* Il posto di un blocco fra quelli che la linguetta ha disegnato.
 *
 * I blocchi delle linguette «sezN» sono figli diretti del corpo dell'editor e
 * li conta il guscio stesso: e' lo stesso numero con cui decide quale lasciare
 * aperto. Chi non e' un figlio diretto — un blocco che un modulo si e' fatto
 * dentro un altro — non ha un posto in quella fila, e non se ne inventa uno. */
function postoDelBlocco(nodo) {
  const body = doc?.getElementById?.("ed-body");
  const blocco = nodo?.closest?.("details.ed-acc");
  if (!body || !blocco || blocco.parentElement !== body) return -1;
  return [...body.querySelectorAll(":scope > details.ed-acc")].indexOf(blocco);
}

/* ── di quale avviso parla questa riga ─────────────────────────────────── */

/* La scheda degli Avvisi non e' fatta come le altre: le sue fisarmoniche non
 * sono sezioni, sono le liste sorvegliate, e stanno tutte sulla stessa
 * pagina. La linguetta non dice la tessera e il posto in fila nemmeno — quei
 * posti li contano le linguette «sezN», e qui i blocchi stanno dentro
 * `.ed-list`, non appesi al corpo.
 *
 * Lo dice il cestino della riga, che e' quello del guscio e porta scritto il
 * gruppo: `edDelAvviso('batt','sensor.x')`. E' struttura, non parole, e vale
 * nelle due lingue.
 *
 * L'avviso personalizzato ha un cestino suo — `edDelAvvisoCustom(3)` — e il
 * numero e' il suo posto nell'elenco, cioe' esattamente la tessera che lo
 * mostra: `custom-3`. Si guarda per primo perche' il suo nome comincia come
 * l'altro. */
const AVVISO_CUSTOM_RE = /edDelAvvisoCustom\(\s*(\d+)\s*\)/;
const AVVISO_GRUPPO_RE = /edDelAvviso\(\s*['"]([a-z_]+)['"]/i;

/* Tutti i comandi scritti sulla riga, non solo il primo: l'avviso
 * personalizzato ha due tasti — la matita e il cestino — e la matita viene
 * prima, cosi' guardare solo il primo voleva dire non trovare mai il
 * cestino. */
function comandiDellaRiga(row) {
  return [...(row?.querySelectorAll?.("[onclick]") || [])]
    .map((nodo) => clean(nodo.getAttribute("onclick")))
    .join(" ");
}

/** Il posto di un avviso personalizzato nel suo elenco, o -1. */
function postoDellAvvisoCustom(row) {
  const trovato = AVVISO_CUSTOM_RE.exec(comandiDellaRiga(row));
  return trovato ? Number(trovato[1]) : -1;
}

/** Il gruppo sorvegliato di questa riga degli Avvisi, o «». */
export function gruppoDellAvviso(row) {
  const comando = comandiDellaRiga(row);
  if (AVVISO_CUSTOM_RE.test(comando)) return "";
  return clean(AVVISO_GRUPPO_RE.exec(comando)?.[1]);
}

/** La tessera di cui parla questa riga, o «» se non si sa. */
export function tesseraDellaRiga(nodo) {
  const marchiata = nodo?.closest?.(`[${MARCHIO_TESSERA}]`);
  if (marchiata) return clean(marchiata.getAttribute(MARCHIO_TESSERA));
  const riga = nodo?.closest?.(".ed-row");
  const posto = postoDellAvvisoCustom(riga);
  if (posto >= 0) return `custom-${posto}`;
  const gruppo = gruppoDellAvviso(riga);
  if (gruppo) return tesseraDelGruppo(gruppo);
  const blocco = postoDelBlocco(nodo);
  if (blocco >= 0) return tesseraDelBlocco(blocco);
  return tesseraDellaScheda(schedaAttiva());
}

/** Se questa riga sta in un gruppo sorvegliato che in Home non ha tessera. */
export function rigaSenzaTessera(row) {
  return ilGruppoNonHaTessera(gruppoDellAvviso(row));
}

/* ── le righe ─────────────────────────────────────────────────────────── */

/** Gli entity_id scritti in chiaro su una riga, senza doppioni. */
export function entitiesOfRow(row) {
  const testo = clean(row?.querySelector?.(".ed-row-old")?.textContent);
  if (!testo) return [];
  const ids = testo
    .split(/[,\s]+/)
    .map(clean)
    .filter((value) => ENTITY_RE.test(value));
  return [...new Set(ids)];
}

/* Cosa c'e' scritto sopra, e cosa promette.
 *
 * Era muto: un'icona e basta, e nessuno capiva a cosa servisse. Poi diceva
 * «In Home», che dice dove ma non cosa. Adesso dice quello che fa davvero —
 * la tessera della Home mostra questa entita', o non la mostra — e lo dice al
 * presente, cambiando parola quando cambia stato: si legge il risultato, non
 * il comando. */
function vestiInterruttore(button, dentro) {
  const parola = dentro ? t("Nel widget", "In the widget") : t("Fuori", "Out");
  const spiega = dentro
    ? t(
        "Questa entità è dentro la tessera della Home: tocca per toglierla.",
        "This entity is inside the Home tile: tap to leave it out.",
      )
    : t(
        "Questa entità non entra nella tessera della Home: tocca per rimetterla.",
        "This entity stays out of the Home tile: tap to put it back.",
      );
  button.setAttribute("aria-label", spiega);
  button.title = spiega;
  const testo = button.querySelector("b");
  if (testo && testo.textContent !== parola) testo.textContent = parola;
}

function interruttore(entities, dentro, tessera) {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "dm-widget-entity";
  button.setAttribute(CHOICE_ATTRIBUTE, entities.join(","));
  button.setAttribute(TESSERA_ATTRIBUTE, tessera);
  button.dataset.on = String(dentro);
  button.innerHTML = `<span aria-hidden="true">🧩</span><b></b><i></i>`;
  vestiInterruttore(button, dentro);
  return button;
}

/* Le sezioni a caselle: EV, solare termico, MiniPC, piscina, antifurto.
 *
 * Le loro entita' non stanno su una riga con l'entity_id scritto sotto: stanno
 * dentro una casella con l'etichetta a sinistra e l'entita' scelta a destra.
 * L'interruttore le saltava tutte — e sono proprio le sezioni dove uno vuole
 * dire «questa in Home si', questa no», perche' sono quelle con dieci sensori
 * di cui in Home ne interessano due. */
/* Che cosa e' un'entita' dentro una riga, comunque quella riga sia scritta.
 *
 * Si guardava solo `.ed-slot-in[data-ref]`, che e' come scrive le sue caselle
 * il guscio storico. Le schede nuove — le Allerte, gli animali, il robot — la
 * loro casella la chiamano a modo proprio (`name="entity"`), e su quelle
 * l'interruttore non compariva: «sezione allerta non compare switch per
 * widget». Non e' un elenco di schede da tenere aggiornato: la guardia delle
 * lenti passa gia' su TUTTE le caselle che chiedono un'entita' e ci scrive
 * sopra `data-entity-input`. Quello e' il segno comune, e chiedere quello vuol
 * dire esserci ovunque, anche nella scheda che verra' scritta domani. */
function entitiesOfSlot(slot) {
  const value = clean(
    slot?.querySelector?.('.ed-slot-in[data-ref],input[data-entity-input="true"]')?.value,
  );
  return ENTITY_RE.test(value) ? [value] : [];
}

function attacca(contenitore, entities, fuori, tessera, dove) {
  const dentro = entities.some((entity) => !fuori.has(entity));
  let button = contenitore.querySelector(`:scope [${CHOICE_ATTRIBUTE}]`);
  if (button) {
    button.setAttribute(CHOICE_ATTRIBUTE, entities.join(","));
    button.setAttribute(TESSERA_ATTRIBUTE, tessera);
    button.dataset.on = String(dentro);
    vestiInterruttore(button, dentro);
    return false;
  }
  button = interruttore(entities, dentro, tessera);
  dove(button);
  return true;
}

/** Mette l'interruttore su ogni riga che nomina un'entita'. */
export function ensureEntityChoices() {
  const body = doc?.getElementById?.("ed-body");
  if (!body) return 0;
  /* L'elenco si legge una volta sola e si ritaglia per tessera: le righe di
   * una pagina parlano quasi sempre della stessa, e rileggere la
   * configurazione a ogni riga vorrebbe dire una lettura per riga. */
  const elenco = elencoDelleEscluse();
  const ritagli = new Map();
  const perTessera = (nodo) => {
    const tessera = tesseraDellaRiga(nodo);
    if (!ritagli.has(tessera)) ritagli.set(tessera, escluseDellaTessera(elenco, tessera));
    return { tessera, fuori: ritagli.get(tessera) };
  };
  let messi = 0;
  for (const slot of body.querySelectorAll(".ed-slot")) {
    // Il modulo delle caselle salta le stesse che salta lui: il form dei
    // carichi riusa la stessa classe per una cosa che casella non e'.
    if (slot.closest("[data-load-form]")) continue;
    const entities = entitiesOfSlot(slot);
    if (!entities.length) {
      slot.querySelector(`:scope [${CHOICE_ATTRIBUTE}]`)?.remove();
      continue;
    }
    const { tessera, fuori } = perTessera(slot);
    if (
      attacca(slot, entities, fuori, tessera, (button) => {
        button.classList.add("dm-widget-entity-slot");
        const etichetta = slot.querySelector(".ed-slot-lbl");
        if (etichetta) {
          /* La stessa riga la divide con la tendina della stanza: chi la
           * impagina e' uno solo — il modulo delle stanze — e qui ci si limita
           * a dichiarare che la riga e' affollata. */
          etichetta.classList.add("dm-slot-lbl-affollata");
          etichetta.append(button);
        } else slot.append(button);
      })
    )
      messi += 1;
  }
  for (const row of body.querySelectorAll(".ed-row")) {
    // Una persona in Home ha la sua card, non una tessera del ponte: un
    // interruttore che promette di toglierla dai widget prometterebbe una cosa
    // che non esiste.
    if (row.matches(".dm-people-row")) continue;
    /* Nemmeno un'azione rapida: quelle hanno la loro sezione in Home, non una
     * tessera. L'interruttore ci finiva sopra perche' la riga scrive
     * l'entity_id come tutte le altre, e prometteva di togliere dai widget una
     * cosa che nei widget non c'e' mai stata — «tutte le azioni rapide non
     * devono comparire nei widget». La riga si riconosce dal suo cestino, che
     * chiama `edDelQA`: e' struttura, non parole, e vale nelle due lingue. */
    if (row.querySelector('[onclick^="edDelQA"]')) {
      row.querySelector(`[${CHOICE_ATTRIBUTE}]`)?.remove();
      continue;
    }
    /* Nemmeno un avviso sorvegliato di un gruppo che in Home non ha tessera.
     * Il Quadro Avvisi dalla Home e' uscito, e di quelle liste sono rimaste
     * tessere solo le batterie, gli allagamenti e il fumo: sulle altre righe
     * l'interruttore non sapeva di quale tessera parlare e scriveva una
     * scelta valida per tutte, cosi' una sonda spenta fra gli Avvisi spariva
     * anche dal Clima (#371). Chi la vuole fuori da una tessera la trova
     * nella scheda di quella tessera, dove la scelta ha un nome. */
    if (rigaSenzaTessera(row)) {
      row.querySelector(`[${CHOICE_ATTRIBUTE}]`)?.remove();
      continue;
    }
    const entities = entitiesOfRow(row);
    if (!entities.length) continue;
    const { tessera, fuori } = perTessera(row);
    const dentro = entities.some((entity) => !fuori.has(entity));
    let button = row.querySelector(`[${CHOICE_ATTRIBUTE}]`);
    if (!button) {
      button = interruttore(entities, dentro, tessera);
      // Dentro il blocco che porta il nome e l'entity_id, non accanto: le
      // righe sono griglie con le loro colonne, e un figlio in piu' le
      // manderebbe a capo. Cosi' l'interruttore scorre col testo che governa.
      const testo = row.querySelector(".ed-row-main");
      // In testa, non in coda: l'interruttore galleggia a destra e il nome gli
      // scorre accanto. Un elemento che galleggia dopo il testo scenderebbe
      // sotto, e ogni riga dell'editor crescerebbe di una riga intera — su un
      // telefono e' la differenza fra un elenco e una torre.
      if (testo) testo.prepend(button);
      else row.append(button);
      messi += 1;
      continue;
    }
    button.setAttribute(CHOICE_ATTRIBUTE, entities.join(","));
    button.setAttribute(TESSERA_ATTRIBUTE, tessera);
    button.dataset.on = String(dentro);
    vestiInterruttore(button, dentro);
  }
  return messi;
}

function onClick(event) {
  const button = event.target?.closest?.(`[${CHOICE_ATTRIBUTE}]`);
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  const entities = clean(button.getAttribute(CHOICE_ATTRIBUTE))
    .split(",")
    .map(clean)
    .filter(Boolean);
  if (!entities.length) return;
  const tessera = clean(button.getAttribute(TESSERA_ATTRIBUTE));
  let elenco = elencoDelleEscluse();
  const fuori = escluseDellaTessera(elenco, tessera);
  const dentro = entities.some((entity) => !fuori.has(entity));
  for (const entity of entities)
    elenco = dentro
      ? togliDallaTessera(elenco, tessera, entity)
      : rimettiNellaTessera(elenco, tessera, entity);
  button.dataset.on = String(!dentro);
  vestiInterruttore(button, !dentro);
  salvaEscluse(elenco);
  root.edToast?.(
    dentro
      ? t("🧩 Fuori dai widget", "🧩 Out of the widgets")
      : t("🧩 Nei widget", "🧩 In the widgets"),
  );
}

function installStyles() {
  installStyle(
    "dm-widget-entity-choice-style",
    `
      #ed-body .dm-widget-entity{
        display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;float:right;
        align-self:flex-start;justify-self:start;width:auto;
        margin:0 0 2px 8px;padding:4px 8px;vertical-align:middle;border:1px solid var(--card-border,#e2e8f0);
        border-radius:999px;background:var(--surface-2,#f8fafc);
        font-size:12px;line-height:1;cursor:pointer;
        transition:border-color .18s ease,background .18s ease,opacity .18s ease}
      #ed-body .dm-widget-entity b{
        font-size:10px;font-weight:900;letter-spacing:.4px;text-transform:uppercase;
        color:var(--text-dim,#64748b)}
      /* Dentro una casella l'etichetta e' gia' a sinistra e l'entita' a
         destra: l'interruttore si mette sotto l'etichetta, in fila con lei,
         invece di galleggiare in un angolo che li' non esiste. */
      #ed-body .ed-slot .dm-widget-entity-slot{
        float:none;display:inline-flex;margin:5px 0 0;align-self:flex-start}
      #ed-body .dm-widget-entity[data-on="true"] b{color:#059669}
      #ed-body .dm-widget-entity i{
        width:26px;height:15px;border-radius:999px;position:relative;
        background:var(--text-dim,#94a3b8);transition:background .2s ease}
      #ed-body .dm-widget-entity i::after{
        content:"";position:absolute;top:2px;left:2px;width:11px;height:11px;border-radius:50%;
        background:#fff;transition:transform .2s ease}
      #ed-body .dm-widget-entity[data-on="true"]{border-color:#0ea5e9}
      #ed-body .dm-widget-entity[data-on="true"] i{background:#0ea5e9}
      #ed-body .dm-widget-entity[data-on="true"] i::after{transform:translateX(11px)}
      #ed-body .dm-widget-entity[data-on="false"] span{opacity:.45;filter:grayscale(1)}
      #ed-body .dm-widget-entity:hover{border-color:#0ea5e9}
      /* Su un telefono la colonna del nome e' larga un dito: l'interruttore
       * resta, il tassello no — il nome vale piu' del suo disegno, e cosa fa
       * la levetta lo dicono il titolo e l'etichetta per chi legge a voce. */
      /* In una riga d'elenco il nome viene prima dell'interruttore.
       *
       * La riga e' una griglia a colonne: simbolo, testo, i tasti. Quello che
       * avanza va al testo, e l'interruttore vive dentro quella colonna. Con
       * la parola «NEL WIDGET» addosso ne occupava novantotto pixel su
       * centosei, e del nome della stanza non restava niente da leggere — in
       * Temperatura la riga diventava un'icona con due tasti e basta.
       *
       * Qui resta la sola levetta, che e' quello che si tocca. Cosa fa lo
       * dicono il titolo del tasto e l'etichetta per chi legge a voce, che ci
       * sono sempre: e' il nome della stanza a non avere nessun altro posto
       * dove farsi leggere. */
      #ed-body .ed-row .dm-widget-entity{max-width:100%;padding:3px 6px;gap:4px}
      #ed-body .ed-row .dm-widget-entity b{display:none}
      @media(max-width:640px){
        #ed-body .dm-widget-entity{padding:3px 6px;gap:4px}
        #ed-body .dm-widget-entity>span{display:none}
        #ed-body .dm-widget-entity b{font-size:9px;letter-spacing:.2px}
        #ed-body .dm-widget-entity i{width:24px;height:14px}
        #ed-body .dm-widget-entity i::after{width:10px;height:10px}
        #ed-body .dm-widget-entity[data-on="true"] i::after{transform:translateX(10px)}
      }
      @media(prefers-reduced-motion:reduce){
        #ed-body .dm-widget-entity,#ed-body .dm-widget-entity i,
        #ed-body .dm-widget-entity i::after{transition:none}
      }
    `,
  );
}

export function installWidgetEntityChoiceSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick, true);
  onEditorRedraw("__dmWidgetEntityChoice", () => {
    root.queueMicrotask?.(ensureEntityChoices);
  });
  for (const event of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(event, () => root.queueMicrotask?.(ensureEntityChoices));
  ensureEntityChoices();
}
