/* Dove si dichiara la raccolta differenziata (#293).
 *
 * «Sarebbe carino anche integrare un sistema per la raccolta differenziata
 * rifiuti.»
 *
 * Una riga per materiale: il bidone — plastica, carta, vetro, organico, quel
 * che il comune separa — un nome se si vuole, e il sensore o il calendario che
 * dice quando passa il ritiro. Le integrazioni della raccolta rifiuti
 * espongono di solito un sensore per materiale con la prossima data: quello.
 * Chi ha un calendario solo con un evento per ritiro lo mette nella casella
 * in fondo, e la pagina dice qual e' il prossimo evento.
 *
 * Le righe si compilano qui e si salvano con un tasto solo: aggiungere un
 * bidone non deve scrivere niente finche' non si e' finito.
 */
import {
  CHIAVE_RIFIUTI,
  MASSIMO_RIGHE,
  MATERIALI,
  materialeDiSerie,
  normalizzaRifiuti,
} from "../core/rifiuti-model.js";
import { renderHomeWidgets } from "./home-widgets-section.js";
import { nomeDelMateriale, renderRifiuti } from "./rifiuti-section.js";
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

const KEY = "__DASHBOARDMODERN_RIFIUTI_EDITOR__";
const state = (root[KEY] ||= { installed: false, bozza: null, contatore: 0 });

export const RIFIUTI_EDITOR_TAB = "rifiuti";

/* La chiave con cui la sezione si accende e si spegne: la stessa che legge la
 * pagina dei rifiuti. */
const CHIAVE_SEZIONE = "rifiuti";

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function configurazione() {
  return normalizzaRifiuti(readJson(CHIAVE_RIFIUTI, {}));
}

function salva(config) {
  const pulita = normalizzaRifiuti(config);
  writeJsonIfChanged(CHIAVE_RIFIUTI, pulita);
  try {
    renderRifiuti();
  } catch (_error) {}
  try {
    renderHomeWidgets();
  } catch (_error) {}
  return pulita;
}

/* La bozza: le righe come stanno nella scheda, salvate o no. Si riparte
 * dalla configurazione ogni volta che la scheda si apre. */
function bozza() {
  if (!state.bozza) state.bozza = configurazione();
  return state.bozza;
}

function nuovaRiga(materiale = "plastica") {
  state.contatore += 1;
  const voce = materialeDiSerie(materiale);
  return { id: `nuova-${Date.now()}-${state.contatore}`, materiale: voce.chiave, nome: "", entity: "" };
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function materialiMarkup(scelto) {
  return MATERIALI.map(
    (voce) =>
      `<option value="${esc(voce.chiave)}"${voce.chiave === scelto ? " selected" : ""}>${esc(
        voce.icona,
      )} ${esc(nomeDelMateriale(voce.chiave))}</option>`,
  ).join("");
}

function rigaMarkup(riga, indice) {
  const voce = materialeDiSerie(riga.materiale);
  const id = `dm-rifiuti-entity-${indice}`;
  return `<article class="ed-row dm-todo-ed-row dm-rifiuti-ed-riga" data-open="true" data-dm-rifiuti-riga="${esc(riga.id)}" style="--dm-bidone:${esc(voce.colore)}">
    <div class="dm-rifiuti-ed-testa">
      <span class="dm-rifiuti-ed-ic" aria-hidden="true">${esc(voce.icona)}</span>
      <select class="ed-input dm-rifiuti-ed-materiale" data-dm-rifiuti-campo="materiale" aria-label="${esc(t("Materiale", "Material"))}">${materialiMarkup(voce.chiave)}</select>
      <button type="button" class="ed-del" data-dm-rifiuti-togli="${esc(riga.id)}" title="${esc(t("Togli", "Remove"))}" aria-label="${esc(t("Togli", "Remove"))}">🗑️</button>
    </div>
    <div class="dm-todo-ed-body">
      <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${esc(t("Nome (facoltativo)", "Name (optional)"))}</span>
        <span class="ed-form-row"><input class="ed-input" data-dm-rifiuti-campo="nome" value="${esc(riga.nome)}" placeholder="${esc(nomeDelMateriale(voce.chiave))}"></span></label>
      <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${esc(t("Sensore o calendario del ritiro", "Collection sensor or calendar"))}</span>
        <span class="ed-form-row"><input id="${id}" class="ed-input mono" data-dm-rifiuti-campo="entity" value="${esc(riga.entity)}" placeholder="sensor.raccolta_${esc(voce.chiave)}" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-dm-rifiuti-pick="${id}" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>
        <small>${esc(
          t(
            "Un sensore con la prossima data (nello stato o negli attributi), o un calendar.* con un evento per ritiro.",
            "A sensor with the next date (in its state or attributes), or a calendar.* with one event per collection.",
          ),
        )}</small></label>
    </div>
  </article>`;
}

function fasciaMarkup() {
  try {
    /* La chiave scritta per esteso: e' quella che la prova della barra legge
     * per sapere che questa voce ha il suo interruttore. */
    return root.cdSecToggleHtml?.("rifiuti") || "";
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
  const dato = bozza();
  const piene = dato.righe.length >= MASSIMO_RIGHE;
  return `${fasciaMarkup()}<div class="dm-rifiuti-ed">
  <div class="ed-sec-title">♻️ ${esc(t("Raccolta differenziata", "Recycling collection"))}</div>
  <div class="ed-intro">${esc(
    t(
      "Un bidone per materiale, e per ognuno il sensore che dice quando passa il ritiro: la pagina risponde alla domanda della sera — cosa metto fuori stasera — e la tessera in Home si accende il giorno prima. Chi ha un calendario solo, con un evento per ritiro, lo mette nella casella in fondo.",
      "One bin per material, and for each the sensor that says when the collection comes: the page answers the evening question — what do I put out tonight — and the Home tile lights up the day before. Whoever has a single calendar, with one event per collection, puts it in the box at the bottom.",
    ),
  )}</div>
  <div class="ed-list dm-todo-ed-list">
    ${dato.righe.map(rigaMarkup).join("")}
    <button type="button" class="ed-btn-add dm-rifiuti-ed-aggiungi" data-dm-rifiuti-aggiungi${piene ? " disabled" : ""}>＋ ${esc(
      t("Aggiungi materiale", "Add material"),
    )}</button>
    <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${esc(t("Calendario unico (facoltativo)", "Single calendar (optional)"))}</span>
      <span class="ed-form-row"><input id="dm-rifiuti-calendario" class="ed-input mono" data-dm-rifiuti-calendario value="${esc(dato.calendario)}" placeholder="calendar.raccolta_rifiuti" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-dm-rifiuti-pick="dm-rifiuti-calendario" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>
      <small>${esc(
        t(
          "Se i ritiri stanno in un calendario solo, la pagina mostra il prossimo evento col materiale indovinato dal suo nome.",
          "If the collections live in a single calendar, the page shows the next event with the material guessed from its name.",
        ),
      )}</small></label>
    <button type="button" class="ed-save-btn" data-dm-rifiuti-save>💾 ${esc(t("Salva rifiuti", "Save waste"))}</button>
  </div></div>`;
}

export function ensureRifiutiEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== RIFIUTI_EDITOR_TAB) {
    /* Fuori dalla scheda la bozza si butta: alla prossima apertura si riparte
     * da quello che e' salvato, non da meta' modifica di un'altra volta. */
    if (schedaAttiva() !== RIFIUTI_EDITOR_TAB) state.bozza = null;
    return false;
  }
  const firma = `${JSON.stringify(bozza())}|${sezioneNascosta()}`;
  if (body.dataset.dmRifiutiEditor === firma && body.querySelector(".dm-rifiuti-ed")) return true;
  body.dataset.dmRifiutiEditor = firma;
  body.innerHTML = corpoMarkup();
  body.dataset.renderer = "rifiuti";
  return true;
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmRifiutiEditor;
  ensureRifiutiEditor();
}

/* Le righe come stanno nella scheda adesso, lette dai campi. */
function raccogli(body) {
  const dato = bozza();
  const righe = [...body.querySelectorAll("[data-dm-rifiuti-riga]")].map((nodo, indice) => {
    const id = clean(nodo.dataset.dmRifiutiRiga);
    const prima = dato.righe.find((riga) => riga.id === id) || { id: id || `riga-${indice + 1}` };
    const leggi = (campo) => clean(nodo.querySelector(`[data-dm-rifiuti-campo="${campo}"]`)?.value);
    const materiale = leggi("materiale") || prima.materiale;
    /* Cambiato il materiale, via l'icona e il colore ricavati da quello di
     * prima: la normalizzazione li prenderebbe per scelte fatte apposta, e una
     * riga passata dalla plastica alla carta restava gialla col suo sacchetto.
     * Questa scheda non fa scegliere icona e colore: si ricalcolano. */
    const base =
      materiale === prima.materiale
        ? prima
        : Object.fromEntries(
            Object.entries(prima).filter(([campo]) => campo !== "icona" && campo !== "colore"),
          );
    return { ...base, materiale, nome: leggi("nome"), entity: leggi("entity") };
  });
  return { calendario: clean(body.querySelector("[data-dm-rifiuti-calendario]")?.value), righe };
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== RIFIUTI_EDITOR_TAB || !body.contains(event.target)) return;
  const pick = event.target.closest("[data-dm-rifiuti-pick]");
  if (pick) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(pick.dataset.dmRifiutiPick))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }
  if (event.target.closest("[data-dm-rifiuti-aggiungi]")) {
    event.preventDefault();
    const adesso = raccogli(body);
    if (adesso.righe.length >= MASSIMO_RIGHE) return;
    /* Il materiale di serie e' il primo che manca: chi ha gia' la plastica
     * vuole probabilmente la carta, non una seconda plastica. */
    const presi = new Set(adesso.righe.map((riga) => riga.materiale));
    const libero = MATERIALI.find((voce) => !presi.has(voce.chiave)) || MATERIALI[0];
    state.bozza = { ...adesso, righe: [...adesso.righe, nuovaRiga(libero.chiave)] };
    ridisegna();
    return;
  }
  const togli = event.target.closest("[data-dm-rifiuti-togli]");
  if (togli) {
    event.preventDefault();
    const adesso = raccogli(body);
    const id = clean(togli.dataset.dmRifiutiTogli);
    state.bozza = { ...adesso, righe: adesso.righe.filter((riga) => riga.id !== id) };
    ridisegna();
    return;
  }
  if (event.target.closest("[data-dm-rifiuti-save]")) {
    event.preventDefault();
    state.bozza = salva(raccogli(body));
    ridisegna();
    root.edToast?.(t("💾 Rifiuti salvati", "💾 Waste saved"));
  }
}

/* Cambiare materiale cambia subito colore e simbolo della riga: e' il modo di
 * vedere cosa si e' scelto senza salvare. */
function onChange(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== RIFIUTI_EDITOR_TAB || !body.contains(event.target)) return;
  const select = event.target.closest('[data-dm-rifiuti-campo="materiale"]');
  if (!select) return;
  const riga = select.closest("[data-dm-rifiuti-riga]");
  const voce = materialeDiSerie(select.value);
  if (!riga) return;
  riga.style.setProperty("--dm-bidone", voce.colore);
  const icona = riga.querySelector(".dm-rifiuti-ed-ic");
  if (icona) icona.textContent = voce.icona;
  const nome = riga.querySelector('[data-dm-rifiuti-campo="nome"]');
  if (nome) nome.placeholder = nomeDelMateriale(voce.chiave);
}

export function ensureRifiutiEditorTab() {
  const linguette = doc?.querySelector(".ed-tab")?.parentElement;
  if (!linguette || linguette.querySelector(`.ed-tab[data-tab="${RIFIUTI_EDITOR_TAB}"]`))
    return false;
  const linguetta = doc.createElement("button");
  linguetta.className = "ed-tab";
  linguetta.dataset.tab = RIFIUTI_EDITOR_TAB;
  linguetta.textContent = `♻️ ${t("Rifiuti", "Waste")}`;
  linguetta.addEventListener("click", () => root.editorSwitch?.(RIFIUTI_EDITOR_TAB));
  const prima = linguette.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(linguetta);
  else linguette.append(linguetta);
  return true;
}

function installStyles() {
  installStyle(
    "dm-rifiuti-editor-style",
    `
      #ed-body .dm-rifiuti-ed-riga{display:block;border-left:5px solid var(--dm-bidone,#0ea5e9)}
      #ed-body .dm-rifiuti-ed-testa{display:flex;align-items:center;gap:8px;margin:0 0 6px}
      #ed-body .dm-rifiuti-ed-ic{
        display:grid;place-items:center;width:32px;height:32px;border-radius:10px;font-size:17px;flex:0 0 auto;
        background:color-mix(in srgb,var(--dm-bidone,#0ea5e9) 18%,transparent)}
      #ed-body .dm-rifiuti-ed-materiale{flex:1 1 auto;min-width:0;margin:0}
      #ed-body .dm-rifiuti-ed-aggiungi{width:100%;margin:6px 0 12px}
    `,
  );
}

export function installRifiutiEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  doc.addEventListener("change", onChange);
  wrapFunction("apriConfigEntita", "__dmRifiutiEditor", () => {
    ensureRifiutiEditorTab();
    ensureRifiutiEditor();
  });
  ensureRifiutiEditorTab();
  onEditorRedraw("__dmRifiutiEditor", () => {
    root.queueMicrotask?.(() => {
      ensureRifiutiEditorTab();
      ensureRifiutiEditor();
    });
  });
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => {
        ensureRifiutiEditorTab();
        ensureRifiutiEditor();
      });
    });
  ensureRifiutiEditor();
  return true;
}

installRifiutiEditor();
