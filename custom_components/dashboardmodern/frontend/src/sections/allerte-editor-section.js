/* Dove si dichiarano le allerte (#296).
 *
 * «Presenza di allerte varie: terremoti INGV, thermal comfort zona,
 * concentrazione pollini, concentrazione fulmini zona, avvisi protezione
 * civile, Flightradar24 di zona.»
 *
 * Sei fonti, una scheda. Per ognuna si sceglie il sensore che la sua
 * integrazione ha gia' portato dentro Home Assistant — la plancia non chiama
 * nessun servizio: legge quello che c'e'. Nessuna casella e' obbligatoria e
 * ognuna basta da sola: chi ha solo Blitzortung vede i fulmini e basta, e la
 * pagina non gli mostra cinque riquadri vuoti per le fonti che non ha.
 *
 * Sotto ogni casella c'e' scritto da quale integrazione arriva di solito quel
 * sensore: e' la domanda che chi configura si fa davanti alla lente, e la
 * risposta sta li' dove nasce.
 */
import { CATEGORIE, CHIAVE_ALLERTE, normalizzaAllerte } from "../core/allerte-model.js";
import { categoriaDelleAllerte, renderAllerte } from "./allerte-section.js";
import { renderHomeWidgets } from "./home-widgets-section.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ALLERTE_EDITOR__";
const state = (root[KEY] ||= { installed: false });

export const ALLERTE_EDITOR_TAB = "allerte";

/* La chiave con cui la sezione si accende e si spegne: la stessa che legge la
 * pagina delle allerte. */
const CHIAVE_SEZIONE = "allerte";

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

/* Le caselle di ogni fonte: etichetta, esempio, e da dove arriva di solito. */
function caselleDi(chiave) {
  const voci = {
    terremoti: [
      [
        "entity",
        t("Sensore dei terremoti", "Earthquake sensor"),
        "sensor.ingv_terremoti",
        t(
          "L'integrazione INGV Terremoti espone un sensore col conteggio degli eventi e le entità geo_location dei singoli terremoti: vanno bene tutti e due.",
          "The INGV Earthquakes integration exposes a sensor with the event count and the geo_location entities of single quakes: both work.",
        ),
      ],
      ["magnitudo", t("Magnitudo (facoltativa)", "Magnitude (optional)"), "sensor.ultimo_terremoto_magnitudo", ""],
      ["distanza", t("Distanza in km (facoltativa)", "Distance in km (optional)"), "sensor.ultimo_terremoto_distanza", ""],
    ],
    meteo: [
      [
        "entity",
        t("Avviso della protezione civile", "Civil protection warning"),
        "binary_sensor.meteoalarm",
        t(
          "Meteoalarm espone un binary_sensor col colore dell'avviso negli attributi; i bollettini della Protezione Civile un sensore che dice «gialla», «arancione», «rossa».",
          "Meteoalarm exposes a binary_sensor with the warning colour in its attributes; the Civil Protection bulletins a sensor saying yellow, orange, red.",
        ),
      ],
    ],
    fulmini: [
      [
        "entity",
        t("Conteggio dei fulmini", "Lightning count"),
        "sensor.blitzortung_lightning_counter",
        t(
          "Blitzortung espone il conteggio e, a parte, la distanza dell'ultimo fulmine in km.",
          "Blitzortung exposes the count and, separately, the distance of the last strike in km.",
        ),
      ],
      ["distanza", t("Distanza dell'ultimo fulmine (km)", "Distance of the last strike (km)"), "sensor.blitzortung_lightning_distance", ""],
    ],
    pollini: [
      [
        "entity",
        t("Concentrazione dei pollini", "Pollen concentration"),
        "sensor.pollini_graminacee",
        t(
          "Un sensore con l'indice (da 0 a 4), una percentuale, una concentrazione o una parola: basso, medio, alto.",
          "A sensor with the index (0 to 4), a percentage, a concentration or a word: low, moderate, high.",
        ),
      ],
    ],
    comfort: [
      [
        "entity",
        t("Comfort termico", "Thermal comfort"),
        "sensor.thermal_comfort_perception",
        t(
          "Thermal Comfort espone la percezione («comfortable», «quite_uncomfortable»…), il rischio di gelo, o un indice di calore in gradi.",
          "Thermal Comfort exposes the perception (comfortable, quite_uncomfortable…), the frost risk, or a heat index in degrees.",
        ),
      ],
    ],
    voli: [
      [
        "entity",
        t("Voli in zona", "Flights in the area"),
        "sensor.flightradar24_current_in_area",
        t(
          "Flightradar24 espone «current in area»: il conteggio, con l'elenco dei voli negli attributi.",
          "Flightradar24 exposes “current in area”: the count, with the list of flights in the attributes.",
        ),
      ],
    ],
  };
  return voci[chiave] || [];
}

function configurazione() {
  return normalizzaAllerte(readJson(CHIAVE_ALLERTE, {}));
}

function salva(config) {
  writeJsonIfChanged(CHIAVE_ALLERTE, config);
  try {
    renderAllerte();
  } catch (_error) {}
  try {
    renderHomeWidgets();
  } catch (_error) {}
}

function fonteMarkup(chiave, config) {
  const categoria = categoriaDelleAllerte(chiave);
  const caselle = caselleDi(chiave)
    .map(([campo, etichetta, esempio, aiuto]) => {
      const id = `dm-allerte-${chiave}-${campo}`;
      return `<label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${esc(etichetta)}</span>
        <span class="ed-form-row"><input id="${id}" class="ed-input mono" data-dm-allerte-fonte="${esc(chiave)}"
          data-dm-allerte-campo="${esc(campo)}" value="${esc(config[chiave][campo])}" placeholder="${esc(esempio)}"
          autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker"
          data-dm-allerte-pick="${id}" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>${
            aiuto ? `<small>${esc(aiuto)}</small>` : ""
          }</label>`;
    })
    .join("");
  return `<article class="ed-row dm-todo-ed-row dm-allerte-ed-fonte" data-open="true" data-dm-allerte-fonte-riga="${esc(chiave)}">
    <div class="dm-allerte-ed-testa"><span aria-hidden="true">${categoria.icona}</span><strong>${esc(categoria.nome)}</strong></div>
    <div class="dm-todo-ed-body">${caselle}</div>
  </article>`;
}

/* ── l'interruttore della sezione: la fascia del guscio, non una nostra ── */
function fasciaMarkup() {
  try {
    /* La chiave scritta per esteso: e' quella che la prova della barra legge
     * per sapere che questa voce ha il suo interruttore. */
    return root.cdSecToggleHtml?.("allerte") || "";
  } catch (_error) {
    return "";
  }
}

function sezioneNascosta() {
  try {
    return root.cdCfg?.("cd_sections")?.[CHIAVE_SEZIONE] === false;
  } catch (_error) {
    return false;
  }
}

function corpoMarkup() {
  const config = configurazione();
  return `${fasciaMarkup()}<div class="dm-allerte-ed">
  <div class="ed-sec-title">⚠️ ${esc(t("Allerte", "Alerts"))}</div>
  <div class="ed-intro">${esc(
    t(
      "Terremoti, avvisi della protezione civile, fulmini, pollini, comfort termico e voli sopra casa: per ognuno scegli il sensore che la sua integrazione ha già portato in Home Assistant. Nessuna casella è obbligatoria, e ognuna basta da sola: la pagina mostra solo le fonti che hai. La plancia non chiama nessun servizio, legge quello che c'è.",
      "Earthquakes, civil protection warnings, lightning, pollen, thermal comfort and flights overhead: for each one pick the sensor its integration already brought into Home Assistant. No field is required and each one is enough on its own: the page shows only the sources you have. The dashboard calls no service, it reads what is there.",
    ),
  )}</div>
  <div class="ed-list dm-todo-ed-list">
    ${CATEGORIE.map(({ chiave }) => fonteMarkup(chiave, config)).join("")}
    <button type="button" class="ed-save-btn" data-dm-allerte-save>💾 ${esc(t("Salva allerte", "Save alerts"))}</button>
  </div></div>`;
}

export function ensureAllerteEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== ALLERTE_EDITOR_TAB) return false;
  const firma = `${JSON.stringify(configurazione())}|${sezioneNascosta()}`;
  if (body.dataset.dmAllerteEditor === firma && body.querySelector(".dm-allerte-ed")) return true;
  body.dataset.dmAllerteEditor = firma;
  body.innerHTML = corpoMarkup();
  body.dataset.renderer = "allerte";
  return true;
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmAllerteEditor;
  ensureAllerteEditor();
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== ALLERTE_EDITOR_TAB || !body.contains(event.target)) return;
  const pick = event.target.closest("[data-dm-allerte-pick]");
  if (pick) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(pick.dataset.dmAllertePick))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }
  if (event.target.closest("[data-dm-allerte-save]")) {
    event.preventDefault();
    const next = configurazione();
    for (const campo of body.querySelectorAll("[data-dm-allerte-fonte][data-dm-allerte-campo]")) {
      const fonte = clean(campo.dataset.dmAllerteFonte);
      const nome = clean(campo.dataset.dmAllerteCampo);
      if (next[fonte] && nome) next[fonte][nome] = clean(campo.value);
    }
    salva(next);
    ridisegna();
    root.edToast?.(t("💾 Allerte salvate", "💾 Alerts saved"));
  }
}

export function ensureAllerteEditorTab() {
  const linguette = doc?.querySelector(".ed-tab")?.parentElement;
  if (!linguette || linguette.querySelector(`.ed-tab[data-tab="${ALLERTE_EDITOR_TAB}"]`))
    return false;
  const linguetta = doc.createElement("button");
  linguetta.className = "ed-tab";
  linguetta.dataset.tab = ALLERTE_EDITOR_TAB;
  linguetta.textContent = `⚠️ ${t("Allerte", "Alerts")}`;
  linguetta.addEventListener("click", () => root.editorSwitch?.(ALLERTE_EDITOR_TAB));
  const prima = linguette.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(linguetta);
  else linguette.append(linguetta);
  return true;
}

function installStyles() {
  installStyle(
    "dm-allerte-editor-style",
    `
      #ed-body .dm-allerte-ed-fonte{display:block}
      #ed-body .dm-allerte-ed-testa{
        display:flex;align-items:center;gap:8px;margin:0 0 6px;font-size:12px;font-weight:900;
        letter-spacing:.04em;text-transform:uppercase;color:var(--text,#0f172a)}
      #ed-body .dm-allerte-ed-testa span{font-size:16px}
    `,
  );
}

export function installAllerteEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  wrapFunction("apriConfigEntita", "__dmAllerteEditor", () => {
    ensureAllerteEditorTab();
    ensureAllerteEditor();
  });
  ensureAllerteEditorTab();
  onEditorRedraw("__dmAllerteEditor", () => {
    root.queueMicrotask?.(() => {
      ensureAllerteEditorTab();
      ensureAllerteEditor();
    });
  });
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => {
        ensureAllerteEditorTab();
        ensureAllerteEditor();
      });
    });
  ensureAllerteEditor();
  return true;
}

installAllerteEditor();
