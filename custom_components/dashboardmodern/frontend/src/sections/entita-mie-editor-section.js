/* Dove si aggiungono le proprie entità a una scheda qualsiasi (#271).
 *
 * «In alcune schede non è possibile inserire entità o sensori personalizzati.
 * Sarebbe carino avere la possibilità d'aggiungere le entità o sensori
 * personalizzati in ogni scheda del progetto, modificando il nome, icona,
 * stanza di destinazione.»
 *
 * Una scheda sola per tutte le pagine, e non una casella in fondo a ognuna:
 * chi ha tre sensori sparsi fra Energia, Sicurezza e MiniPC li vede e li
 * sposta da qui, invece di cercarsi tre schede diverse per ricordarsi cosa
 * aveva messo dove. La pagina è un campo della voce — la tendina in cima —
 * e cambiarla sposta l'entità di sezione.
 *
 * L'elenco delle pagine si legge dalla barra in basso, non da una tabella
 * scritta qui: così porta i nomi che l'utente ha dato alle sue sezioni, le
 * pagine spente non compaiono, e una sezione nuova entra il giorno in cui
 * nasce senza che nessuno se ne ricordi.
 */
import { MASSIMO_PER_SEZIONE } from "../core/entita-mie.js";
import { CHIAVE_ENTITA_MIE, ridisegnaEntitaMie } from "./entita-mie-section.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  righeDelDocumento,
  roomOptionsMarkup,
  root,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENTITA_MIE_EDITOR__";
const state = (root[KEY] ||= { installed: false, aperta: -1 });

export const ENTITA_MIE_EDITOR_TAB = "entita";

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

/* L'editor lavora sulle righe grezze: una voce appena aggiunta non ha ancora
 * un'entità, e la normalizzazione — che le righe senza entità le scarta — la
 * farebbe sparire prima di poterla compilare. */
function voci() {
  const grezzo = readJson(CHIAVE_ENTITA_MIE, []);
  return Array.isArray(grezzo) ? grezzo : [];
}

function salva(lista) {
  writeJsonIfChanged(CHIAVE_ENTITA_MIE, lista);
  ridisegnaEntitaMie();
}

/* ── quali pagine ci sono ─────────────────────────────────────────────── */

/* Le sezioni che si possono scegliere: quelle che hanno una voce nella barra
 * e una pagina dietro. La configurazione non è fra queste — è il posto da cui
 * si sta guardando, e un sensore lì dentro non lo vedrebbe nessuno. */
export function sezioniDisponibili(scope = doc) {
  const viste = new Set();
  const elenco = [];
  for (const scheda of scope?.querySelectorAll?.("nav.tabs .tab[data-tab]") || []) {
    const tab = clean(scheda.dataset.tab);
    if (!tab || tab === "config" || viste.has(tab)) continue;
    if (!scope.getElementById?.(`page-${tab}`)) continue;
    viste.add(tab);
    elenco.push({ tab, nome: clean(scheda.querySelector(".text")?.textContent) || tab });
  }
  return elenco;
}

function sezioniMarkup(scelta, sezioni) {
  const quale = clean(scelta);
  const righe = sezioni.map(
    (sezione) =>
      `<option value="${esc(sezione.tab)}"${sezione.tab === quale ? " selected" : ""}>${esc(
        sezione.nome,
      )}</option>`,
  );
  /* Una pagina scelta e poi sparita — una sezione propria cancellata, una
   * voce della barra spenta — resta nella tendina: toglierla in silenzio
   * riscriverebbe la scelta dell'utente al primo salvataggio. */
  if (quale && !sezioni.some((sezione) => sezione.tab === quale))
    righe.push(`<option value="${esc(quale)}" selected>${esc(quale)}</option>`);
  return [
    `<option value="">— ${esc(t("Scegli la scheda", "Choose the page"))} —</option>`,
    ...righe,
  ].join("");
}

function nomeDellaSezione(tab, sezioni) {
  const quale = clean(tab);
  if (!quale) return t("nessuna scheda", "no page");
  return sezioni.find((sezione) => sezione.tab === quale)?.nome || quale;
}

/* ── il disegno della scheda ──────────────────────────────────────────── */

function rigaMarkup(voce, indice, sezioni, troppe) {
  const aperta = state.aperta === indice;
  const id = `dm-mia-ent-${indice}`;
  const nome = clean(voce?.nome) || clean(voce?.entity) || t("Entità nuova", "New entity");
  return `<article class="ed-row dm-todo-ed-row dm-mia-ent-riga" data-mia-ent="${indice}" data-open="${aperta}">
    <div class="dm-todo-ed-head">
      <span class="dm-todo-ed-icon" aria-hidden="true">${esc(clean(voce?.icona) || "⭐")}</span>
      <span class="ed-row-main">
        <strong class="ed-row-new">${esc(nome)}</strong>
        <small class="ed-row-old">${esc(nomeDellaSezione(voce?.sezione, sezioni))}${
          troppe ? ` · ${esc(t("oltre il limite", "over the limit"))}` : ""
        }</small>
      </span>
      <button type="button" class="ed-del dm-todo-ed-edit" data-mia-ent-edit
        aria-label="${esc(t("Modifica", "Edit"))}">✏️</button>
      <button type="button" class="ed-del dm-todo-ed-del" data-mia-ent-del
        aria-label="${esc(t("Elimina", "Remove"))}">🗑️</button>
    </div>
    <div class="dm-todo-ed-body"${aperta ? "" : " hidden"}>
      <label class="ed-slot dm-mia-ent-campo"><span class="ed-slot-lbl">${esc(
        t("In quale scheda", "On which page"),
      )}</span><span class="ed-form-row"><select id="${id}-sez" class="ed-input"
        data-mia-ent-campo="sezione">${sezioniMarkup(voce?.sezione, sezioni)}</select></span></label>
      <div class="dm-mia-ent-testa">
        <input class="ed-input dm-mia-ent-icona" data-mia-ent-campo="icona"
          value="${esc(clean(voce?.icona))}" placeholder="⭐"
          aria-label="${esc(t("Icona", "Icon"))}" maxlength="4">
        <input class="ed-input" data-mia-ent-campo="nome" value="${esc(clean(voce?.nome))}"
          placeholder="${esc(t("Nome (facoltativo)", "Name (optional)"))}">
      </div>
      <label class="ed-slot dm-mia-ent-campo"><span class="ed-slot-lbl">${esc(
        t("Entità", "Entity"),
      )}</span><span class="ed-form-row"><input id="${id}" class="ed-input mono"
        data-mia-ent-campo="entity" value="${esc(clean(voce?.entity))}" placeholder="sensor.qualcosa"
        autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker"
        data-mia-ent-pick="${id}" aria-label="${esc(
          t("Scegli entità", "Choose entity"),
        )}">🔍</button></span></label>
      <label class="ed-slot dm-mia-ent-campo"><span class="ed-slot-lbl">${esc(
        t("Stanza", "Room"),
      )}</span><span class="ed-form-row"><select id="${id}-room" class="ed-input"
        data-mia-ent-campo="room_id">${roomOptionsMarkup(
          clean(voce?.room_id),
          t("Nessuna stanza", "No room"),
        )}</select></span></label>
      <button type="button" class="ed-save-btn" data-mia-ent-save>💾 ${esc(
        t("Salva entità", "Save entity"),
      )}</button>
    </div>
  </article>`;
}

/* Quante voci ha già ogni scheda: serve a dire quali sono oltre il tetto, e a
 * dirlo sulla riga che ci finisce sopra invece che in fondo alla scheda. */
function oltreIlTetto(lista) {
  const conto = new Map();
  const troppe = new Set();
  lista.forEach((voce, indice) => {
    const sezione = clean(voce?.sezione);
    if (!sezione || !clean(voce?.entity)) return;
    const quante = (conto.get(sezione) || 0) + 1;
    conto.set(sezione, quante);
    if (quante > MASSIMO_PER_SEZIONE) troppe.add(indice);
  });
  return troppe;
}

function corpoMarkup() {
  const lista = voci();
  const sezioni = sezioniDisponibili();
  const troppe = oltreIlTetto(lista);
  return `<div class="dm-mia-ent-ed">
  <div class="ed-sec-title">⭐ ${esc(t("Le tue entità", "Your own entities"))}</div>
  <div class="ed-intro">${esc(
    t(
      "Alcune schede sono elenchi — Luci, Prese, Telecamere — e lì un'entità in più si è sempre potuta aggiungere. Altre sono fatte di caselle con un ruolo preciso: l'Energia ha una rete e un fotovoltaico, la Sicurezza una centrale, e per un sensore in più non c'era posto. Qui c'è: scegli l'entità, in quale scheda farla comparire, come chiamarla e con che icona. Compare in fondo alla pagina che scegli, e quelle che si accendono si accendono.",
      "Some pages are lists — Lights, Sockets, Cameras — and there you could always add one more entity. Others are made of boxes with a set role: Energy has a grid and a solar array, Security an alarm panel, and there was no place for one more sensor. Here there is: pick the entity, which page it should appear on, what to call it and with which icon. It shows up at the bottom of the page you choose, and the ones that switch, switch.",
    ),
  )}</div>
  <div class="ed-list dm-todo-ed-list">${
    lista.length
      ? lista.map((voce, indice) => rigaMarkup(voce, indice, sezioni, troppe.has(indice))).join("")
      : `<div class="ed-empty">${esc(
          t("Nessuna entità aggiunta.", "No entities added yet."),
        )}</div>`
  }</div>
  ${
    troppe.size
      ? `<div class="dm-mia-ent-pieno">${esc(
          t(
            "Su una scheda ne compaiono al massimo dodici: oltre non è più «qualcosa in più», è un elenco — e per quello c'è «Le tue sezioni».",
            "At most twelve show up on one page: past that it is not «one more thing» any more, it is a list — and for that there is «Your sections».",
          ),
        )}</div>`
      : ""
  }
  <button type="button" class="ed-btn-add" data-mia-ent-add>＋ ${esc(
    t("Aggiungi entità", "Add entity"),
  )}</button>
  </div>`;
}

export function ensureEntitaMieEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== ENTITA_MIE_EDITOR_TAB) return false;
  const firma = `${JSON.stringify(voci())}|${state.aperta}|${sezioniDisponibili()
    .map((sezione) => sezione.tab)
    .join(",")}`;
  if (body.dataset.dmEntitaMie === firma && body.querySelector(".dm-mia-ent-ed")) return true;
  body.dataset.dmEntitaMie = firma;
  body.innerHTML = corpoMarkup();
  body.dataset.renderer = ENTITA_MIE_EDITOR_TAB;
  return true;
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmEntitaMie;
  ensureEntitaMieEditor();
}

/* Quello che c'è scritto adesso nella riga, letto dal documento: si salva
 * quello che si vede, non quello che era scritto quando la scheda è stata
 * disegnata. */
function leggiLaRiga(riga) {
  const letto = { ...(voci()[Number(riga.dataset.miaEnt)] || {}) };
  for (const campo of riga.querySelectorAll("[data-mia-ent-campo]"))
    letto[clean(campo.dataset.miaEntCampo)] = clean(campo.value);
  if (!clean(letto.id)) letto.id = `mia-${Date.now().toString(36)}`;
  return letto;
}

/* Tutte le righe della scheda come sono adesso nel documento.
 *
 * Il tasto «Salva sezione» in fondo alla configurazione preme il salvataggio
 * di ogni riga una dopo l'altra: il primo scrive e ridisegna, e il ridisegno
 * stacca gli altri bottoni dal documento. Chi scrive per primo, quindi, scrive
 * per tutti — vedi `righeDelDocumento`. */
function righeDalDocumento(body) {
  return righeDelDocumento(body, "data-mia-ent", voci(), (riga) => leggiLaRiga(riga));
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== ENTITA_MIE_EDITOR_TAB || !body.contains(event.target)) return;

  if (event.target.closest("[data-mia-ent-add]")) {
    event.preventDefault();
    const lista = voci().slice();
    /* La scheda che si sta guardando è quella più probabile: chi apre la
     * configurazione dalla Sicurezza sta aggiungendo un sensore alla
     * Sicurezza. Resta una tendina, e si cambia. */
    const dove = clean(doc?.querySelector?.(".page.active")?.id).replace(/^page-/, "");
    lista.push({
      id: `mia-${Date.now().toString(36)}`,
      entity: "",
      nome: "",
      icona: "⭐",
      sezione: dove && dove !== "config" ? dove : "",
      room_id: "",
    });
    state.aperta = lista.length - 1;
    salva(lista);
    ridisegna();
    return;
  }

  const riga = event.target.closest("[data-mia-ent]");
  if (!riga) return;
  const indice = Number(riga.dataset.miaEnt);

  const pick = event.target.closest("[data-mia-ent-pick]");
  if (pick) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(pick.dataset.miaEntPick))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }

  if (event.target.closest("[data-mia-ent-edit]")) {
    event.preventDefault();
    state.aperta = state.aperta === indice ? -1 : indice;
    ridisegna();
    return;
  }

  if (event.target.closest("[data-mia-ent-del]")) {
    event.preventDefault();
    const lista = voci().slice();
    lista.splice(indice, 1);
    state.aperta = -1;
    salva(lista);
    ridisegna();
    return;
  }

  if (event.target.closest("[data-mia-ent-save]")) {
    event.preventDefault();
    const lista = righeDalDocumento(body);
    lista[indice] = leggiLaRiga(riga);
    salva(lista);
    ridisegna();
    root.edToast?.(t("💾 Entità salvata", "💾 Entity saved"));
  }
}

export function ensureEntitaMieTab() {
  const linguette = doc?.querySelector(".ed-tab")?.parentElement;
  if (!linguette || linguette.querySelector(`.ed-tab[data-tab="${ENTITA_MIE_EDITOR_TAB}"]`))
    return false;
  const linguetta = doc.createElement("button");
  linguetta.className = "ed-tab";
  linguetta.dataset.tab = ENTITA_MIE_EDITOR_TAB;
  linguetta.textContent = `⭐ ${t("Le tue entità", "Your own entities")}`;
  linguetta.addEventListener("click", () => root.editorSwitch?.(ENTITA_MIE_EDITOR_TAB));
  /* Accanto a «Le tue sezioni», che è la sua parente stretta: una è
   * un'entità in più su una pagina che c'è, l'altra è una pagina nuova. */
  const vicina =
    linguette.querySelector('.ed-tab[data-tab="mie"]')?.nextSibling ||
    linguette.querySelector('.ed-tab[data-tab="runtime"]');
  if (vicina) linguette.insertBefore(linguetta, vicina);
  else linguette.append(linguetta);
  return true;
}

function installStyles() {
  installStyle(
    "dm-entita-mie-editor",
    `
      #ed-body .dm-mia-ent-testa{display:grid;grid-template-columns:64px minmax(0,1fr);gap:8px;margin:10px 0}
      #ed-body .dm-mia-ent-icona{text-align:center;font-size:18px}
      #ed-body .dm-mia-ent-campo{margin:0 0 10px}
      #ed-body .dm-mia-ent-pieno{margin:10px 2px 0;opacity:.75}
      /* Nome e scheda incolonnati, come nelle altre liste della
         configurazione: affiancati, il nome di una pagina lunga finiva
         sempre coi puntini. */
      #ed-body .dm-mia-ent-riga .ed-row-main{display:block;min-width:0}
      #ed-body .dm-mia-ent-riga .ed-row-new,
      #ed-body .dm-mia-ent-riga .ed-row-old{display:block;overflow:hidden;text-overflow:ellipsis}
      #ed-body .dm-mia-ent-riga .ed-row-old{margin-top:3px;color:var(--text-dim,#64748b)}
      @media(max-width:560px){
        #ed-body .dm-mia-ent-testa{grid-template-columns:52px minmax(0,1fr);gap:6px}
      }
    `,
  );
}

export function installEntitaMieEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  /* La linguetta si mette appena il pannello nasce, non al primo ridisegno:
   * chi apre la configurazione e chiede subito questa scheda la troverebbe
   * altrimenti assente. */
  wrapFunction("apriConfigEntita", "__dmEntitaMieEditor", () => {
    ensureEntitaMieTab();
    ensureEntitaMieEditor();
  });
  ensureEntitaMieTab();
  onEditorRedraw("__dmEntitaMieEditor", () => {
    root.queueMicrotask?.(() => {
      ensureEntitaMieTab();
      ensureEntitaMieEditor();
    });
  });
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => {
        ensureEntitaMieTab();
        ensureEntitaMieEditor();
      });
    });
  ensureEntitaMieEditor();
  return true;
}
