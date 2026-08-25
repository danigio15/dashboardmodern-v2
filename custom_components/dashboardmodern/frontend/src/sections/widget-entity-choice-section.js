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
 */
import {
  WIDGETS_CONFIG_KEY,
  renderHomeWidgets,
  widgetPreferences,
} from "./home-widgets-section.js";
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

/* ── la memoria ───────────────────────────────────────────────────────── */

function escluse() {
  return new Set(widgetPreferences().excluded);
}

function salvaEscluse(insieme) {
  const stored = readJson(WIDGETS_CONFIG_KEY, {});
  const base = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  writeJsonIfChanged(WIDGETS_CONFIG_KEY, { ...base, excluded: [...insieme].sort() });
  try {
    renderHomeWidgets();
  } catch (_error) {}
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

function interruttore(entities, dentro) {
  const label = dentro
    ? t("In Home: sì", "On Home: yes")
    : t("In Home: no", "On Home: no");
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "dm-widget-entity";
  button.setAttribute(CHOICE_ATTRIBUTE, entities.join(","));
  button.dataset.on = String(dentro);
  button.setAttribute("aria-label", label);
  button.title = t(
    "Mostra questa entità nei widget della Home",
    "Show this entity in the Home widgets",
  );
  button.innerHTML = `<span aria-hidden="true">🧩</span><i></i>`;
  return button;
}

/** Mette l'interruttore su ogni riga che nomina un'entita'. */
export function ensureEntityChoices() {
  const body = doc?.getElementById?.("ed-body");
  if (!body) return 0;
  const fuori = escluse();
  let messi = 0;
  for (const row of body.querySelectorAll(".ed-row")) {
    // Una persona in Home ha la sua card, non una tessera del ponte: un
    // interruttore che promette di toglierla dai widget prometterebbe una cosa
    // che non esiste.
    if (row.matches(".dm-people-row")) continue;
    const entities = entitiesOfRow(row);
    if (!entities.length) continue;
    const dentro = entities.some((entity) => !fuori.has(entity));
    let button = row.querySelector(`[${CHOICE_ATTRIBUTE}]`);
    if (!button) {
      button = interruttore(entities, dentro);
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
    button.dataset.on = String(dentro);
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
  const fuori = escluse();
  const dentro = entities.some((entity) => !fuori.has(entity));
  for (const entity of entities) {
    if (dentro) fuori.add(entity);
    else fuori.delete(entity);
  }
  button.dataset.on = String(!dentro);
  salvaEscluse(fuori);
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
      @media(max-width:640px){
        #ed-body .dm-widget-entity{padding:3px 6px;gap:0}
        #ed-body .dm-widget-entity>span{display:none}
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

/* Il nome della scelta, per chi la cerca da fuori. */
export const widgetEntityChoiceLabel = () => esc(t("In Home", "On Home"));
