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
import { misureDellAria, normalizzaAria } from "../core/aria-model.js";
import { categoriaDelleAllerte, renderAllerte } from "./allerte-section.js";
import { renderHomeWidgets } from "./home-widgets-section.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  locale,
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
    scioperi: [
      [
        "entity",
        t("Sensore degli scioperi", "Strike sensor"),
        "sensor.scioperi_italia",
        t(
          "Un sensore col numero degli scioperi e l'elenco negli attributi — settore, regione, data d'inizio: le integrazioni italiane degli scioperi lo pubblicano cosi'.",
          "A sensor with the number of strikes and the list in its attributes — sector, region, start date: the Italian strike integrations publish it that way.",
        ),
      ],
    ],
    treni: [
      [
        "entity",
        t("Treno seguito", "Followed train"),
        "sensor.treno_selezionato",
        t(
          "Un sensore col ritardo in minuti nello stato o negli attributi, e accanto il numero del treno, la destinazione e il binario. Un treno soppresso diventa un allarme.",
          "A sensor with the delay in minutes in its state or attributes, and next to it the train number, the destination and the platform. A cancelled train becomes an alarm.",
        ),
      ],
      [
        "stazione",
        t("Stazione preferita (facoltativa)", "Favourite station (optional)"),
        "sensor.stazione_termini",
        t(
          "Il sensore della stazione, se l'integrazione ne espone uno: da' il nome da scrivere accanto al treno.",
          "The station sensor, when the integration exposes one: it gives the name written next to the train.",
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

/* La qualita' dell'aria, che si comporta diversamente dalle altre.
 *
 * «Sulla qualita' aria mi devi creare da qualche parte la possibilita' di
 * inserire entita' e i parametri, non solo nei widget. Inseriscilo in allerte.»
 *
 * Le altre sei fonti hanno una casella per uno: si sceglie il sensore e finisce
 * li'. L'aria no — i suoi sensori li dichiara Home Assistant col `device_class`
 * e la tessera nasce da sola — quindi qui non si sceglie il sensore: si corregge
 * il rilevamento. Tre cose, e sono quelle che dal campo mancavano:
 *
 * - togliere un sensore che c'e' ma non deve contare. Con due centraline il
 *   verdetto lo detta la peggiore, e quella e' quasi sempre la strada davanti a
 *   casa (#340: «Outdoor Environment CO … la peggiore delle 15 misure»);
 * - aggiungerne uno che il rilevamento non trova — un template senza
 *   `device_class` — dicendo a mano che misura e';
 * - spostare i confini di una misura. Di serie sono le norme (le fasce
 *   dell'indice europeo, la EN 16798-1 per la CO2, l'OMS per il monossido), e
 *   restano quelle finche' nessuno scrive: chi non tocca niente non cambia
 *   niente.
 */
const CHIAVE_ARIA = "aria";

function ariaMarkup(config) {
  const scelte = normalizzaAria(config[CHIAVE_ARIA]);
  const misure = misureDellAria(locale());
  const righeSoglie = misure
    .map((misura) => {
      const scelta = scelte.soglie[misura.classe] || misura.soglie;
      const suo = Boolean(scelte.soglie[misura.classe]);
      return `<div class="dm-aria-ed-misura"${suo ? ' data-dm-aria-mia="true"' : ""}>
        <span class="dm-aria-ed-nome"><span aria-hidden="true">${misura.glifo}</span> ${esc(misura.nome)}<small>${esc(misura.unita)}</small></span>
        ${scelta
          .map(
            (valore, indice) =>
              `<input class="ed-input dm-aria-ed-soglia" type="number" min="0" step="any" inputmode="decimal"
                data-dm-aria-soglia="${esc(misura.classe)}" data-dm-aria-gradino="${indice}"
                value="${esc(String(valore))}" aria-label="${esc(GRADINI()[indice])} · ${esc(misura.nome)}">`,
          )
          .join("")}
      </div>`;
    })
    .join("");
  const escluse = scelte.escluse
    .map(
      (entity) =>
        `<span class="dm-aria-ed-fuori" data-dm-aria-esclusa="${esc(entity)}">${esc(entity)}<button type="button" class="ed-del" data-dm-aria-riprendi="${esc(entity)}" aria-label="${esc(t("Rimetti", "Put back"))}">✕</button></span>`,
    )
    .join("");
  const aggiunte = Object.entries(scelte.aggiunte)
    .map(
      ([entity, classe]) =>
        `<span class="dm-aria-ed-fuori" data-dm-aria-aggiunta="${esc(entity)}">${esc(entity)} · ${esc(
          misure.find((misura) => misura.classe === classe)?.nome || classe,
        )}<button type="button" class="ed-del" data-dm-aria-togli="${esc(entity)}" aria-label="${esc(t("Elimina", "Remove"))}">✕</button></span>`,
    )
    .join("");
  return `<article class="ed-row dm-todo-ed-row dm-allerte-ed-fonte dm-aria-ed" data-open="true" data-dm-allerte-fonte-riga="${CHIAVE_ARIA}">
    <div class="dm-allerte-ed-testa"><span aria-hidden="true">🍃</span><strong>${esc(t("Qualità dell'aria", "Air quality"))}</strong></div>
    <div class="dm-todo-ed-body">
      <div class="ed-intro">${esc(
        t(
          "I sensori dell'aria li dichiara Home Assistant da sé — polveri, CO₂, monossido, composti volatili — e la tessera compare da sola. Qui si corregge quel rilevamento: si toglie un sensore che non deve contare, si aggiunge uno che non viene trovato, e si spostano i confini fra buona, discreta, scarsa e cattiva.",
          "Home Assistant declares the air sensors itself — particulates, CO₂, monoxide, volatile compounds — and the tile appears on its own. Here you correct that: drop a sensor that should not count, add one that is not found, and move the boundaries between good, fair, poor and bad.",
        ),
      )}</div>

      <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${esc(t("Non contare questo sensore", "Do not count this sensor"))}</span>
        <span class="ed-form-row"><input id="dm-aria-escludi" class="ed-input mono" placeholder="sensor.outdoor_co"
          autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker"
          data-dm-allerte-pick="dm-aria-escludi" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button>
          <button type="button" class="ed-btn-add dm-aria-ed-piu" data-dm-aria-escludi>${esc(t("Togli", "Drop"))}</button></span>
        <small>${esc(t("La centralina esterna detta il verdetto di tutta la casa: da qui si toglie di mezzo senza spegnere la tessera.", "The outdoor station dictates the verdict for the whole house: this drops it without turning the tile off."))}</small>
      </label>
      ${escluse ? `<div class="dm-aria-ed-elenco">${escluse}</div>` : ""}

      <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${esc(t("Aggiungi un sensore che non viene trovato", "Add a sensor that is not found"))}</span>
        <span class="ed-form-row"><input id="dm-aria-aggiungi" class="ed-input mono" placeholder="sensor.mio_pm25"
          autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker"
          data-dm-allerte-pick="dm-aria-aggiungi" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>
        <span class="ed-form-row"><select id="dm-aria-classe" class="ed-input">${misure
          .map((misura) => `<option value="${esc(misura.classe)}">${misura.glifo} ${esc(misura.nome)}</option>`)
          .join("")}</select>
          <button type="button" class="ed-btn-add dm-aria-ed-piu" data-dm-aria-aggiungi>${esc(t("Aggiungi", "Add"))}</button></span>
        <small>${esc(t("Un sensore che Home Assistant non ha etichettato — un template fatto in casa — non viene trovato: qui gli si dice che misura è.", "A sensor Home Assistant has not labelled — a template of your own — is not found: here you say which measure it is."))}</small>
      </label>
      ${aggiunte ? `<div class="dm-aria-ed-elenco">${aggiunte}</div>` : ""}

      <div class="ed-slot-lbl dm-aria-ed-titolo">${esc(t("I confini di ogni misura", "The boundaries of each measure"))}</div>
      <div class="ed-intro">${esc(
        t(
          "Buona fino al primo, discreta fino al secondo, scarsa fino al terzo, cattiva oltre. Di serie sono le norme: le fasce dell'indice europeo per polveri e gas, la EN 16798-1 per la CO₂, le linee guida OMS per il monossido. Cambiale solo se sai perché.",
          "Good up to the first, fair up to the second, poor up to the third, bad beyond. The defaults are the norms: the European index bands for particulates and gases, EN 16798-1 for CO₂, the WHO guidelines for monoxide. Change them only if you know why.",
        ),
      )}</div>
      <div class="dm-aria-ed-misure">${righeSoglie}</div>
      <button type="button" class="ed-del dm-aria-ed-norme" data-dm-aria-norme>${esc(t("Rimetti le norme", "Restore the norms"))}</button>
    </div>
  </article>`;
}

/** I quattro gradini, per l'etichetta di ogni casella. */
function GRADINI() {
  return [
    t("Fino a: buona", "Up to: good"),
    t("Fino a: discreta", "Up to: fair"),
    t("Fino a: scarsa", "Up to: poor"),
  ];
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
    ${ariaMarkup(config)}
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

/* I gesti della scheda dell'aria.
 *
 * Le altre fonti hanno un tasto Salva perche' sono caselle che si compilano
 * insieme. Qui ogni gesto e' gia' una decisione compiuta — «questo sensore non
 * lo voglio», «questa soglia e' questa» — e aspettare un tasto vorrebbe solo
 * dire perderla chiudendo la scheda. Si salva subito, e la scheda si ridisegna
 * con quello che adesso c'e'.
 */
function salvaAria(prossima) {
  const tutto = configurazione();
  tutto[CHIAVE_ARIA] = prossima;
  salva(tutto);
  ridisegna();
}

function ariaClick(event, body) {
  const config = configurazione();
  const scelte = normalizzaAria(config[CHIAVE_ARIA]);

  const togliDaiConti = event.target.closest("[data-dm-aria-escludi]");
  if (togliDaiConti) {
    event.preventDefault();
    const entity = clean(body.querySelector("#dm-aria-escludi")?.value);
    if (!entity.includes(".")) return true;
    salvaAria({ ...scelte, escluse: [...new Set([...scelte.escluse, entity])] });
    root.edToast?.(t("🍃 Sensore tolto dai conti dell'aria", "🍃 Sensor dropped from the air"));
    return true;
  }

  const rimetti = event.target.closest("[data-dm-aria-riprendi]");
  if (rimetti) {
    event.preventDefault();
    const entity = clean(rimetti.dataset.dmAriaRiprendi);
    salvaAria({ ...scelte, escluse: scelte.escluse.filter((voce) => voce !== entity) });
    return true;
  }

  const aggiungi = event.target.closest("[data-dm-aria-aggiungi]");
  if (aggiungi) {
    event.preventDefault();
    const entity = clean(body.querySelector("#dm-aria-aggiungi")?.value);
    const classe = clean(body.querySelector("#dm-aria-classe")?.value);
    if (!entity.includes(".") || !classe) return true;
    salvaAria({ ...scelte, aggiunte: { ...scelte.aggiunte, [entity]: classe } });
    root.edToast?.(t("🍃 Sensore dell'aria aggiunto", "🍃 Air sensor added"));
    return true;
  }

  const togli = event.target.closest("[data-dm-aria-togli]");
  if (togli) {
    event.preventDefault();
    const entity = clean(togli.dataset.dmAriaTogli);
    const aggiunte = { ...scelte.aggiunte };
    delete aggiunte[entity];
    salvaAria({ ...scelte, aggiunte });
    return true;
  }

  if (event.target.closest("[data-dm-aria-norme]")) {
    event.preventDefault();
    /* Rimettere le norme vuol dire cancellare le proprie, non riscriverle: cosi'
     * chi aggiorna la plancia si ritrova i confini nuovi se le norme cambiano. */
    salvaAria({ ...scelte, soglie: {} });
    root.edToast?.(t("🍃 Confini rimessi alle norme", "🍃 Boundaries back to the norms"));
    return true;
  }
  return false;
}

/* Un confine scritto vale appena si stacca dalla casella: e' un numero, non una
 * frase da comporre. I tre si leggono insieme — non hanno senso da soli — e se
 * non salgono si lascia com'era, che e' quello che fa anche il modello. */
function ariaCambio(event) {
  const casella = event.target?.closest?.("[data-dm-aria-soglia]");
  const body = doc?.getElementById("ed-body");
  if (!casella || !body || !body.contains(casella)) return;
  const classe = clean(casella.dataset.dmAriaSoglia);
  const caselle = [...body.querySelectorAll(`[data-dm-aria-soglia="${CSS.escape(classe)}"]`)].sort(
    (sinistra, destra) =>
      Number(sinistra.dataset.dmAriaGradino) - Number(destra.dataset.dmAriaGradino),
  );
  const valori = caselle.map((voce) => Number(voce.value));
  const config = configurazione();
  const scelte = normalizzaAria(config[CHIAVE_ARIA]);
  const prossime = { ...scelte.soglie, [classe]: valori };
  const config2 = { ...config, [CHIAVE_ARIA]: { ...scelte, soglie: prossime } };
  /* Il modello butta i confini scritti male: se li ha buttati, qui non si
   * scrive niente e la casella resta rossa finche' non tornano. */
  const accettati = normalizzaAria(config2[CHIAVE_ARIA]).soglie[classe];
  for (const voce of caselle) voce.dataset.dmAriaRotta = accettati ? "no" : "si";
  if (!accettati) return;
  const tutto = configurazione();
  tutto[CHIAVE_ARIA] = { ...scelte, soglie: prossime };
  salva(tutto);
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
  if (ariaClick(event, body)) return;
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
          #ed-body .dm-aria-ed-elenco{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 10px}
      #ed-body .dm-aria-ed-fuori{display:inline-flex;align-items:center;gap:6px;padding:5px 6px 5px 10px;border:1px solid var(--divider-color,#e2e8f0);border-radius:999px;background:var(--secondary-background-color,#f8fafc);font-size:12px;font-weight:750;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
      #ed-body .dm-aria-ed-fuori .ed-del{min-width:22px;min-height:22px;padding:0;border-radius:999px;font-size:11px}
      #ed-body .dm-aria-ed-piu{margin-left:6px;white-space:nowrap}
      #ed-body .dm-aria-ed-titolo{margin-top:14px}
      #ed-body .dm-aria-ed-misure{display:grid;gap:6px;margin:6px 0 10px}
      #ed-body .dm-aria-ed-misura{display:grid;grid-template-columns:minmax(0,1fr) repeat(3,minmax(56px,68px));gap:6px;align-items:center}
      #ed-body .dm-aria-ed-misura[data-dm-aria-mia="true"] .dm-aria-ed-nome{color:#0ea5e9}
      #ed-body .dm-aria-ed-nome{display:flex;align-items:baseline;gap:6px;min-width:0;font-size:12.5px;font-weight:750;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #ed-body .dm-aria-ed-nome small{font-weight:600;color:var(--secondary-text-color,#64748b)}
      #ed-body .dm-aria-ed-soglia{min-height:38px;padding:6px 8px;text-align:center;font-size:12.5px}
      /* Tre confini che non salgono non sono confini: la casella lo dice. */
      #ed-body .dm-aria-ed-soglia[data-dm-aria-rotta="si"]{border-color:#dc2626;background:rgba(220,38,38,.08)}
      #ed-body .dm-aria-ed-norme{margin-bottom:4px}
      @media(max-width:520px){#ed-body .dm-aria-ed-misura{grid-template-columns:minmax(0,1fr);gap:4px}
        #ed-body .dm-aria-ed-misura .dm-aria-ed-soglia{text-align:left}}
`,
  );
}

export function installAllerteEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  /* I confini si scrivono nelle caselle: si ascolta il loro `change`, non il
   * click, o un numero battuto e lasciato li' non arriverebbe mai. */
  doc.addEventListener("change", ariaCambio);
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
