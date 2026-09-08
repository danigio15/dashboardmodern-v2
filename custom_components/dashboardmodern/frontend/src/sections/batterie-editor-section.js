/* La scheda delle batterie in configurazione (#398).
 *
 * «Sarebbe carino che le batterie stessero nel config come le altre cose
 *  configurazioni.»
 *
 * Non c'è niente da compilare per cominciare: una batteria la dichiara Home
 * Assistant col suo `device_class`, e la pagina Batterie compare da sola.
 * Questa scheda serve alle tre cose che il rilevamento non può sapere:
 *
 *   · sotto quanto una batteria è da cambiare. Venti per cento stava scritto
 *     nel codice, uguale per tutti: chi ha una serratura da cambiare al trenta
 *     e un telecomando che dura fino al cinque aveva un numero solo per due
 *     cose diverse;
 *   · quali non contare — la batteria del telefono, quella dell'auto, che
 *     percentuali sono ma non sono pile da comprare;
 *   · un nome. «Sensore Porta/finestra Camera matrimoniale Batteria» è il nome
 *     di fabbrica, e in un elenco di quindici righe non dice quale sia.
 *
 * Le ultime due non scrivono chiavi nuove: le strade esistono già — sono
 * quelle con cui si aggiungono e si tolgono le entità sorvegliate, e quella
 * con cui si dà un nome a un avviso — ed erano solo senza una porta da cui
 * entrare per le batterie. Un nome dato qui vale anche nel Quadro Avvisi,
 * perché è lo stesso nome.
 *
 * Ogni gesto si salva subito: chi tocca queste caselle sta rispondendo a una
 * domanda, e aspettare un tasto vorrebbe dire perdere la risposta chiudendo
 * la scheda.
 */
import {
  CHIAVE_BATTERIE,
  SOGLIA_MASSIMA,
  batterieLette,
  sogliaDelleBatterie,
} from "../core/batterie-di-casa.js";
import { BATTERIE_TAB, renderBatterie } from "./batterie-section.js";
import { batterieSorvegliate } from "./batterie-elenco-section.js";
import {
  allStates,
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
import { nomeDaHomeAssistant } from "./editor-slots-section.js";

const KEY = "__DASHBOARDMODERN_BATTERIE_EDITOR__";
const state = (root[KEY] ||= { installed: false });

export const BATTERIE_EDITOR_TAB = BATTERIE_TAB;

/* Le chiavi con cui la plancia sorveglia un gruppo di entità: non sono di
 * questa scheda, sono di tutti. Il gruppo delle batterie si chiama «batt». */
const GRUPPO = "batt";
const CHIAVE_AGGIUNTE = "cd_gruppi_extra";
const CHIAVE_TOLTE = "cd_gruppi_removed";
const CHIAVE_NOMI = "cd_avvisi_names_extra";

const elenco = (valore) => (Array.isArray(valore) ? valore.map(clean).filter(Boolean) : []);

function activeTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmBatterieEditor;
  ensureBatterieEditor();
}

function dopoIlSalvataggio() {
  renderBatterie();
  try {
    root.renderHomeWidgets?.();
  } catch (_error) {}
  ridisegna();
}

/* ── quello che si scrive ─────────────────────────────────────────────── */

function salvaSoglia(valore) {
  const soglia = sogliaDelleBatterie({ soglia: valore });
  writeJsonIfChanged(CHIAVE_BATTERIE, { ...readJson(CHIAVE_BATTERIE, {}), soglia });
  dopoIlSalvataggio();
}

/* Aggiungere e togliere sono la stessa coppia di elenchi che usa tutta la
 * plancia: si tocca solo il gruppo delle batterie, e le altre voci di quelle
 * chiavi restano dove sono. */
function scriviGruppo(chiave, valori) {
  const dentro = readJson(chiave, {}) || {};
  writeJsonIfChanged(chiave, { ...dentro, [GRUPPO]: [...new Set(valori)] });
}

function aggiungi(entity) {
  const id = clean(entity);
  if (!id.includes(".")) return false;
  scriviGruppo(CHIAVE_AGGIUNTE, [...elenco(readJson(CHIAVE_AGGIUNTE, {})?.[GRUPPO]), id]);
  scriviGruppo(
    CHIAVE_TOLTE,
    elenco(readJson(CHIAVE_TOLTE, {})?.[GRUPPO]).filter((voce) => voce !== id),
  );
  dopoIlSalvataggio();
  return true;
}

function togli(entity) {
  const id = clean(entity);
  if (!id) return false;
  scriviGruppo(CHIAVE_TOLTE, [...elenco(readJson(CHIAVE_TOLTE, {})?.[GRUPPO]), id]);
  scriviGruppo(
    CHIAVE_AGGIUNTE,
    elenco(readJson(CHIAVE_AGGIUNTE, {})?.[GRUPPO]).filter((voce) => voce !== id),
  );
  dopoIlSalvataggio();
  return true;
}

function rimetti(entity) {
  const id = clean(entity);
  if (!id) return false;
  scriviGruppo(
    CHIAVE_TOLTE,
    elenco(readJson(CHIAVE_TOLTE, {})?.[GRUPPO]).filter((voce) => voce !== id),
  );
  dopoIlSalvataggio();
  return true;
}

/* Il nome sta dove stanno già i nomi degli avvisi: uno dato qui si legge anche
 * nel Quadro Avvisi, perché è lo stesso nome della stessa entità. */
function battezza(entity, nome) {
  const id = clean(entity);
  if (!id) return false;
  const nomi = { ...(readJson(CHIAVE_NOMI, {}) || {}) };
  const scritto = clean(nome);
  if (scritto) nomi[id] = scritto;
  else delete nomi[id];
  writeJsonIfChanged(CHIAVE_NOMI, nomi);
  renderBatterie();
  try {
    root.renderHomeWidgets?.();
  } catch (_error) {}
  return true;
}

/* ── il disegno della scheda ──────────────────────────────────────────── */

function rigaMarkup(riga, aggiunte) {
  const stato = riga.muta ? "muta" : riga.scarica ? "scarica" : "carica";
  return `<article class="ed-row dm-batt-ed-riga" data-batt="${esc(stato)}">
    <span class="dm-batt-ed-ic" aria-hidden="true">${esc(riga.muta ? "❔" : riga.scarica ? "🪫" : "🔋")}</span>
    <div class="ed-row-main dm-batt-ed-testo">
      <input class="ed-input dm-batt-ed-nome" value="${esc(riga.name)}"
        data-dm-batt-nome="${esc(riga.entity)}" aria-label="${esc(t("Nome", "Name"))}">
      <small class="ed-row-old mono">${esc(riga.entity)}${aggiunte.includes(riga.entity) ? ` · ${esc(t("aggiunta a mano", "added by hand"))}` : ""}</small>
    </div>
    <b class="dm-batt-ed-livello">${esc(riga.muta ? "—" : `${Math.round(riga.level)}%`)}</b>
    <button type="button" class="ed-del dm-batt-ed-togli" data-dm-batt-escludi="${esc(riga.entity)}"
      title="${esc(t("Non contare questa batteria", "Do not count this battery"))}"
      aria-label="${esc(t("Non contare questa batteria", "Do not count this battery"))}">🚫</button>
  </article>`;
}

function fuoriMarkup(tolte) {
  if (!tolte.length) return "";
  return `<div class="dm-batt-ed-elenco">${tolte
    .map(
      (entity) =>
        `<span class="dm-batt-ed-fuori">${esc(entity)}<button type="button" class="ed-del" data-dm-batt-riprendi="${esc(entity)}" aria-label="${esc(t("Rimetti", "Put back"))}">✕</button></span>`,
    )
    .join("")}</div>`;
}

function schedaMarkup() {
  const states = allStates();
  const soglia = sogliaDelleBatterie(readJson(CHIAVE_BATTERIE, {}));
  const aggiunte = elenco(readJson(CHIAVE_AGGIUNTE, {})?.[GRUPPO]);
  const tolte = elenco(readJson(CHIAVE_TOLTE, {})?.[GRUPPO]);
  const righe = batterieLette(batterieSorvegliate(), states, {
    soglia,
    nome: (entity) => nomeDaHomeAssistant(entity, states),
  });
  return `${root.cdSecToggleHtml?.(BATTERIE_EDITOR_TAB) || ""}
  <div class="ed-intro">${esc(
    t(
      "Le batterie le dichiara Home Assistant da sé — un sensore in percentuale — e la pagina Batterie compare da sola: dalla più scarica alla più piena, con in cima quante sono da cambiare. Qui si decide sotto quanto una batteria è da cambiare, si toglie quello che una pila non è, e si dà un nome a chi si chiama «Sensore Porta/finestra Camera Batteria».",
      "Home Assistant declares batteries itself — a sensor in percent — and the Batteries page appears on its own: from the flattest to the fullest, with how many need replacing on top. Here you set how low counts as flat, drop whatever is not a replaceable cell, and name whatever is called “Door/window sensor Bedroom Battery”.",
    ),
  )}</div>

  <label class="ed-slot dm-batt-ed-campo"><span class="ed-slot-lbl">${esc(t("Da cambiare sotto il (%)", "To replace below (%)"))}</span>
    <input class="ed-input" type="number" min="1" max="${esc(String(SOGLIA_MASSIMA))}" step="1"
      value="${esc(String(soglia))}" data-dm-batt-soglia>
    <small>${esc(
      t(
        "Sotto questa percentuale la batteria conta come da cambiare: si colora nella pagina e finisce nel conto della tessera in Home. Vale per tutta la casa.",
        "Below this percentage a battery counts as needing replacement: it turns colour on the page and enters the count on the Home tile. It applies to the whole house.",
      ),
    )}</small>
  </label>

  <label class="ed-slot dm-batt-ed-campo"><span class="ed-slot-lbl">${esc(t("Aggiungi una batteria che non viene trovata", "Add a battery that is not found"))}</span>
    <span class="ed-form-row"><input id="dm-batt-aggiungi" class="ed-input mono" placeholder="sensor.serratura_batteria"
      autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker"
      data-dm-batt-pick="dm-batt-aggiungi" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button>
      <button type="button" class="ed-btn-add" data-dm-batt-aggiungi>${esc(t("Aggiungi", "Add"))}</button></span>
    <small>${esc(t("Una batteria che Home Assistant non ha etichettato — un template fatto in casa — non viene trovata: qui le si dice che è una batteria.", "A battery Home Assistant has not labelled — a template of your own — is not found: here you say it is a battery."))}</small>
  </label>

  <div class="ed-slot-lbl dm-batt-ed-titolo">${esc(t("Le batterie di casa", "The batteries at home"))}</div>
  ${
    righe.length
      ? `<div class="ed-list dm-batt-ed-lista">${righe.map((riga) => rigaMarkup(riga, aggiunte)).join("")}</div>`
      : `<div class="ed-empty">${esc(t("Nessuna batteria trovata", "No battery found"))}</div>`
  }
  ${tolte.length ? `<div class="ed-slot-lbl dm-batt-ed-titolo">${esc(t("Tolte dai conti", "Dropped from the count"))}</div>` : ""}
  ${fuoriMarkup(tolte)}`;
}

export function ensureBatterieEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== BATTERIE_EDITOR_TAB) return false;
  if (body.dataset.dmBatterieEditor === "true") return false;
  body.dataset.dmBatterieEditor = "true";
  body.innerHTML = `<div class="dm-batterie-ed">${schedaMarkup()}</div>`;
  return true;
}

export function ensureBatterieEditorTab() {
  const tabs = doc?.querySelector(".ed-tab")?.parentElement;
  if (!tabs || tabs.querySelector(`.ed-tab[data-tab="${BATTERIE_EDITOR_TAB}"]`)) return false;
  const tab = doc.createElement("button");
  tab.className = "ed-tab";
  tab.dataset.tab = BATTERIE_EDITOR_TAB;
  tab.textContent = `🔋 ${t("Batterie", "Batteries")}`;
  tab.addEventListener("click", () => root.editorSwitch?.(BATTERIE_EDITOR_TAB));
  const prima = tabs.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(tab);
  else tabs.append(tab);
  return true;
}

/* ── i gesti ──────────────────────────────────────────────────────────── */

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== BATTERIE_EDITOR_TAB || !body.contains(event.target)) return;

  const lente = event.target.closest("[data-dm-batt-pick]");
  if (lente) {
    event.preventDefault();
    const campo = body.querySelector(`#${CSS.escape(clean(lente.dataset.dmBattPick))}`);
    if (campo) root.wzPickEntity?.(campo);
    return;
  }

  if (event.target.closest("[data-dm-batt-aggiungi]")) {
    event.preventDefault();
    if (aggiungi(body.querySelector("#dm-batt-aggiungi")?.value))
      root.edToast?.(t("🔋 Batteria aggiunta", "🔋 Battery added"));
    return;
  }

  const fuori = event.target.closest("[data-dm-batt-escludi]");
  if (fuori) {
    event.preventDefault();
    togli(fuori.dataset.dmBattEscludi);
    return;
  }

  const dentro = event.target.closest("[data-dm-batt-riprendi]");
  if (dentro) {
    event.preventDefault();
    rimetti(dentro.dataset.dmBattRiprendi);
  }
}

function onChange(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== BATTERIE_EDITOR_TAB || !body.contains(event.target)) return;
  if (event.target.matches?.("[data-dm-batt-soglia]")) {
    salvaSoglia(event.target.value);
    root.edToast?.(t("🔋 Soglia salvata", "🔋 Threshold saved"));
    return;
  }
  const nome = event.target.closest?.("[data-dm-batt-nome]");
  if (nome) battezza(nome.dataset.dmBattNome, nome.value);
}

function installStyles() {
  installStyle(
    "dm-batterie-editor-style",
    `
    #ed-body .dm-batt-ed-titolo{margin:16px 0 6px}
    #ed-body .dm-batt-ed-riga{
      --dm-batt:#10b981;
      display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:10px}
    #ed-body .dm-batt-ed-riga[data-batt="scarica"]{--dm-batt:#f59e0b}
    #ed-body .dm-batt-ed-riga[data-batt="muta"]{--dm-batt:#94a3b8;opacity:.75}
    #ed-body .dm-batt-ed-ic{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;
      font-size:16px;background:color-mix(in srgb,var(--dm-batt) 20%,transparent)}
    #ed-body .dm-batt-ed-testo{display:grid;gap:2px;min-width:0}
    #ed-body .dm-batt-ed-livello{font-size:13px;font-weight:900;font-variant-numeric:tabular-nums;
      color:color-mix(in srgb,var(--dm-batt) 78%,var(--text,#0f172a))}
    #ed-body .dm-batt-ed-elenco{display:flex;flex-wrap:wrap;gap:6px}
    #ed-body .dm-batt-ed-fuori{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;
      border-radius:999px;font-size:11px;font-weight:750;font-family:ui-monospace,monospace;
      border:1px dashed var(--card-border,rgba(0,0,0,.16));color:var(--text-dim,#64748b)}
    @media(max-width:520px){
      #ed-body .dm-batt-ed-riga{grid-template-columns:auto minmax(0,1fr) auto;row-gap:6px}
      #ed-body .dm-batt-ed-livello{grid-column:2}
    }
    `,
  );
}

export function installBatterieEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  ensureBatterieEditorTab();
  doc.addEventListener("click", onClick);
  doc.addEventListener("change", onChange);
  onEditorRedraw("__dmBatterieEditor", () => {
    ensureBatterieEditorTab();
    root.queueMicrotask?.(ensureBatterieEditor);
  });
  ensureBatterieEditorTab();
  ensureBatterieEditor();
  return true;
}

installBatterieEditor();
