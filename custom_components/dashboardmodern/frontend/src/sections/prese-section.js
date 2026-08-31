/* Le prese, con una sezione loro.
 *
 * «Cosa ne pensi di inserire una sezione dedicata a prese generiche, tipo TV
 * Salotto, TV letto, Presa Firestick?»
 *
 * Si potevano gia' configurare: la scheda Luci accetta anche `switch.`, e una
 * presa messa li' si accende e si spegne benissimo. Solo che si chiama luce.
 * Finisce nell'elenco delle luci, si conta nel «3 accese» del salone, e «spegni
 * tutte le luci» la spegne — cosa che per la TV puo' anche andare, e per il
 * modem no. Il difetto non era che non si potesse fare: era doverla chiamare
 * col nome di un'altra cosa.
 *
 * Cosa NON c'e' qui dentro, ed e' la parte che conta. Niente motore nuovo per
 * accendere: una presa e' un interruttore, e a comandarla e' lo stesso
 * `lightCommand` che comanda tutto il resto — quindi il blocco «si vede ma non
 * si comanda» vale anche qui, senza una riga in piu'. Niente scheda nuova da
 * disegnare: e' la stessa `pageCardMarkup` delle luci, quindi il tocco lo
 * raccoglie chi lo raccoglie gia' e lo stato si aggiorna insieme al resto. Qui
 * c'e' soltanto la pagina, la sua voce nella barra e la scheda che tiene
 * l'elenco: cioe' esattamente la cosa che mancava, e nient'altro.
 */
import { lightSummary, lightView } from "../core/light-model.js";
import { directEmoji } from "../core/personalization-catalog.js";
import { eEntitaDiPresa, normalizzaPrese, presePerStanza } from "../core/prese-model.js";
import { iconGlyphMarkup, openIconPicker } from "./icon-engine-section.js";
import { pageCardMarkup, pageSummaryMarkup } from "./lights-page-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  section,
  segnaSoloLettura,
  siComanda,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_PRESE_SECTION__";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "" });

export const PRESE_PAGE_ID = "page-prese";
export const PRESE_TAB = "prese";
const CHIAVE = "cd_prese";

/* L'icona di una presa esce dal catalogo di casa, non dalla tastiera.
 *
 * «Nella sezione prese non si puo' scegliere icona: richiama sempre il
 * catalogo creato da noi con lo stile elettrodomestici.» Il campo era una
 * casella di testo libero col 🔌 dentro: le emoji cambiano faccia da un
 * telefono all'altro, e nella stessa pagina stavano accanto ai disegni in
 * scocca blu notte. Il selettore e' quello dei carichi — stesso catalogo,
 * stessa tavolozza — e il token mdi scelto si disegna col motore delle icone.
 * L'emoji resta il ripiego per le prese configurate prima. */
export const ICONA_PRESA_PREDEFINITA = "mdi:power-plug";

export function iconaPresaMarkup(icon, size = 24) {
  const token = clean(icon);
  const emoji = directEmoji(token);
  if (emoji) return esc(emoji);
  return iconGlyphMarkup("load", token || ICONA_PRESA_PREDEFINITA, { size });
}

/** L'elenco delle prese: dal modello canonico, o dalla chiave di sempre. */
export function presiConfigurate() {
  const canonico = section("sockets", null);
  if (Array.isArray(canonico) && canonico.length) return normalizzaPrese(canonico);
  return normalizzaPrese(readJson(CHIAVE, []));
}

function salvaPrese(elenco) {
  const pulite = normalizzaPrese(elenco);
  const cambiato = writeJsonIfChanged(CHIAVE, pulite, { sync: false });
  try {
    root.DashboardModernModules?.store?.replaceSection?.("sockets", pulite)?.catch?.(() => {});
  } catch (_error) {}
  if (cambiato) {
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  }
  return pulite;
}

/* Le stanze, nell'ordine in cui chi abita la casa ci gira dentro: e' l'ordine
 * della sezione Stanze, ed e' lo stesso ovunque. */
function stanze() {
  const canoniche = section("rooms", null);
  const elenco =
    Array.isArray(canoniche) && canoniche.length ? canoniche : readJson("cd_stanze", []);
  return Array.isArray(elenco) ? elenco : [];
}

function vistaDi(presa, states = allStates()) {
  return lightView(presa.entity, {
    name: presa.name,
    state: states?.[presa.entity],
    room: presa.room_id,
    comandabile: siComanda(presa.entity),
  });
}

/* ── la pagina e la sua voce nella barra ─────────────────────────────────── */

function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

export function ensurePresePage() {
  if (!doc) return null;
  let pagina = doc.getElementById(PRESE_PAGE_ID);
  if (pagina) return pagina;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = PRESE_PAGE_ID;
  pagina.innerHTML = `<div class="dm-lucip-wrap" id="prese-wrap"></div>`;
  sorella.after(pagina);
  return pagina;
}

export function ensurePreseTab() {
  if (!doc) return null;
  let voce = doc.querySelector(`.tab[data-tab="${PRESE_TAB}"]`);
  if (voce) return voce;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  /* Accanto alle Luci, che e' la sezione da cui le prese sono uscite: chi le
   * cerca le cerca li' vicino. */
  const dopo = barra.querySelector('.tab[data-tab="luci"]');
  voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = PRESE_TAB;
  voce.id = `tab-${PRESE_TAB}`;
  voce.innerHTML = `<span class="icon">🔌</span><span class="text">${esc(t("Prese", "Sockets"))}</span>`;
  /* Il gestore che il runtime lega alle voci lo lega una volta sola, al
   * caricamento: questa arriva dopo, e il suo tocco se lo deve gestire da se'.
   * Fa la stessa identica cosa, perche' due modi di cambiare pagina sarebbero
   * due pagine attive quando non tornano. */
  voce.addEventListener("click", () => {
    for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
    for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
    voce.classList.add("active");
    ensurePresePage()?.classList.add("active");
    if (root.navigator?.vibrate) root.navigator.vibrate(5);
    schedule();
  });
  if (dopo) dopo.after(voce);
  else barra.append(voce);
  return voce;
}

/* La voce si nasconde come tutte le altre: `cdApplyNavVis` sa quali voci
 * esistono da una mappa sua, e una che non c'e' resta sempre accesa qualunque
 * cosa dica la configurazione. */
function insegnaLaVisibilita() {
  const precedente = root.cdNavVisMap;
  if (typeof precedente !== "function" || precedente.__dmPrese) return;
  const avvolta = function cdNavVisMap(...args) {
    const mappa = precedente.apply(this, args) || {};
    return { ...mappa, [PRESE_TAB]: PRESE_TAB };
  };
  avvolta.__dmPrese = true;
  avvolta.__dmPrevious = precedente;
  root.cdNavVisMap = avvolta;
}

/* ── il disegno ──────────────────────────────────────────────────────────── */

function gruppoMarkup(gruppo, states) {
  const viste = gruppo.prese.map((presa) => vistaDi(presa, states));
  const riepilogo = lightSummary(viste);
  return `<div class="dm-lucip-room" data-dm-prese-group="${esc(gruppo.room)}" role="heading" aria-level="3">
      <span>${esc(gruppo.room)}</span>
      <span class="dm-lucip-room-count">${pageSummaryMarkup(riepilogo)}</span>
    </div>
    ${viste.map((vista) => pageCardMarkup(vista)).join("")}`;
}

function vuotoMarkup() {
  return `<div class="dm-lucip-empty">
      <strong>${esc(t("Nessuna presa configurata", "No socket configured"))}</strong>
      <span>${esc(
        t(
          "Aggiungi le prese dalla scheda Prese della configurazione: la TV del salotto, il Firestick, il modem.",
          "Add sockets from the Sockets tab in the settings: the living-room TV, the Firestick, the modem.",
        ),
      )}</span>
    </div>`;
}

function firma(gruppi, states) {
  return gruppi
    .flatMap((gruppo) =>
      gruppo.prese.map(
        (presa) =>
          `${gruppo.room}~${presa.entity}~${presa.name}~${clean(states?.[presa.entity]?.state)}~${siComanda(presa.entity)}`,
      ),
    )
    .join("|");
}

function dipingi() {
  const pagina = ensurePresePage();
  const contenitore = pagina?.querySelector?.("#prese-wrap");
  if (!contenitore) return;
  const states = allStates();
  const gruppi = presePerStanza(presiConfigurate(), stanze(), t("Altre zone", "Other areas"));
  const attuale = firma(gruppi, states);
  /* Si ridisegna quando cambia cio' che si vede, e mai a vuoto: ridisegnare a
   * ogni giro vuol dire una pagina che tremola sotto le dita. */
  if (contenitore.dataset.firma === attuale && contenitore.firstElementChild) return;
  contenitore.dataset.firma = attuale;
  contenitore.innerHTML = gruppi.length
    ? gruppi.map((gruppo) => gruppoMarkup(gruppo, states)).join("")
    : vuotoMarkup();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(() => {
    state.frame = 0;
    ensurePreseTab();
    insegnaLaVisibilita();
    dipingi();
  });
  if (!state.frame) {
    ensurePreseTab();
    insegnaLaVisibilita();
    dipingi();
  }
}

/* ── la scheda in configurazione ─────────────────────────────────────────── */

function opzioniStanza(scelta) {
  const elenco = stanze();
  const attuale = clean(scelta);
  return [
    `<option value="">— ${esc(t("Altre zone", "Other areas"))} —</option>`,
    ...elenco.map((stanza) => {
      const id = clean(stanza?.id) || clean(stanza?.name);
      const nome = clean(stanza?.name) || id;
      return `<option value="${esc(id)}"${id === attuale ? " selected" : ""}>${esc(nome)}</option>`;
    }),
  ].join("");
}

function rigaMarkup(presa, indice) {
  const stanza = stanze().find((voce) => clean(voce?.id) === presa.room_id);
  return `<article class="ed-row dm-presa-row" data-presa-index="${indice}">
    <div class="dm-presa-icon" aria-hidden="true">${iconaPresaMarkup(presa.icon, 22)}</div>
    <div class="ed-row-main">
      <div class="ed-row-new">${esc(presa.name)}</div>
      <div class="ed-row-old mono">${esc(presa.entity)}${stanza ? ` · 🏠 ${esc(clean(stanza.name))}` : ""}</div>
    </div>
    <button type="button" class="ed-del" data-presa-edit title="${esc(t("Modifica", "Edit"))}">✏️</button>
    <button type="button" class="ed-del" data-presa-del title="${esc(t("Elimina", "Delete"))}">🗑️</button>
  </article>`;
}

export function renderPreseEditor(target) {
  if (!target) return false;
  const prese = presiConfigurate();
  const modifica = state.modifica ?? null;
  const corrente = modifica === null ? null : prese[modifica];
  target.innerHTML = `<section class="ed-form dm-prese-editor" data-dm-prese-editor>
    ${root.cdSecToggleHtml?.("prese") || ""}
    <div class="ed-intro">${esc(
      t(
        "Le prese di casa: la TV del salotto, quella della camera, il Firestick, il modem. Si accendono e si spengono come le luci, ma stanno per conto loro — cosi' «spegni tutte le luci» non spegne il modem.",
        "The sockets around the house: the living-room TV, the bedroom one, the Firestick, the modem. They switch on and off like lights, but they live on their own — so «turn all lights off» does not turn off the modem.",
      ),
    )}</div>
    <div class="ed-list">${
      prese.length
        ? prese.map((presa, indice) => rigaMarkup(presa, indice)).join("")
        : `<div class="ed-empty">${esc(t("Nessuna presa", "No socket"))}</div>`
    }</div>
    <div class="ed-sec-title">${corrente ? `✏️ ${esc(t("Modifica presa", "Edit socket"))}` : `＋ ${esc(t("Aggiungi presa", "Add socket"))}`}</div>
    <label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Nome", "Name"))}</span><input id="ed-presa-name" class="ed-input" value="${esc(corrente?.name || "")}" placeholder="${esc(t("TV Salotto", "Living-room TV"))}"></label>
    <label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Entità Home Assistant", "Home Assistant entity"))}</span><span class="ed-form-row"><input id="ed-presa-ent" class="ed-input mono" value="${esc(corrente?.entity || "")}" placeholder="switch.tv_salotto" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-presa-pick aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span></label>
    <div class="ed-form-row">
      <label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Icona", "Icon"))}</span><span class="ed-form-row dm-presa-icon-row"><input id="ed-presa-icon" class="ed-input" value="${esc(corrente?.icon || ICONA_PRESA_PREDEFINITA)}" hidden><button type="button" class="dm-presa-icon-btn" data-presa-icon-pick aria-label="${esc(t("Scegli icona dal catalogo", "Choose icon from the catalog"))}" title="${esc(t("Scegli icona dal catalogo", "Choose icon from the catalog"))}">${iconaPresaMarkup(corrente?.icon, 26)}</button></span></label>
      <label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Stanza", "Room"))}</span><select id="ed-presa-room" class="ed-input">${opzioniStanza(corrente?.room_id)}</select></label>
    </div>
    <label class="ed-slot dm-presa-lock"><span class="ed-slot-lbl">${esc(t("Si vede ma non si comanda", "Shown but not controllable"))}</span><span class="ed-form-row dm-solo-lettura-riga"><input type="checkbox" id="ed-presa-lock" ${corrente && !siComanda(corrente.entity) ? "checked" : ""}><small>${esc(
      t(
        "Per le prese che non vanno spente: il frigo, il modem, il congelatore. La riga resta dov'è, il tasto smette di rispondere.",
        "For sockets that must not be switched off: the fridge, the modem, the freezer. The row stays where it is, the button stops responding.",
      ),
    )}</small></span></label>
    <output data-presa-error class="dm-presa-error"></output>
    <button type="button" class="ed-btn-add" data-presa-save>${corrente ? `💾 ${esc(t("Salva modifiche", "Save changes"))}` : `＋ ${esc(t("Aggiungi presa", "Add socket"))}`}</button>
    ${corrente ? `<button type="button" class="ed-btn-add" data-presa-cancel>${esc(t("Annulla modifica", "Cancel edit"))}</button>` : ""}
  </section>`;
  /* Il selettore scrive il token nel campo e avvisa con `change`: il bottone
   * si ridipinge da li', cosi' la scelta si vede subito senza rifare la
   * scheda. */
  const campoIcona = target.querySelector("#ed-presa-icon");
  const bottoneIcona = target.querySelector("[data-presa-icon-pick]");
  if (campoIcona && bottoneIcona) {
    const dipingiIcona = () => {
      bottoneIcona.innerHTML = iconaPresaMarkup(campoIcona.value, 26);
    };
    campoIcona.addEventListener("input", dipingiIcona);
    campoIcona.addEventListener("change", dipingiIcona);
  }
  return true;
}

function leggiModulo() {
  return {
    name: clean(doc?.getElementById("ed-presa-name")?.value),
    entity: clean(doc?.getElementById("ed-presa-ent")?.value),
    icon: clean(doc?.getElementById("ed-presa-icon")?.value) || ICONA_PRESA_PREDEFINITA,
    room_id: clean(doc?.getElementById("ed-presa-room")?.value),
    bloccata: Boolean(doc?.getElementById("ed-presa-lock")?.checked),
  };
}

function ridisegnaScheda() {
  const corpo = doc?.getElementById("ed-body");
  if (corpo?.querySelector("[data-dm-prese-editor]")) renderPreseEditor(corpo);
}

function onEditorClick(event) {
  const pannello = event.target?.closest?.("[data-dm-prese-editor]");
  if (!pannello) return;
  const prese = presiConfigurate();

  if (event.target.closest("[data-presa-pick]")) {
    event.preventDefault();
    root.wzPickEntity?.(doc.getElementById("ed-presa-ent"));
    return;
  }
  if (event.target.closest("[data-presa-icon-pick]")) {
    event.preventDefault();
    // Il catalogo dei carichi: lo stesso stile degli elettrodomestici.
    openIconPicker(doc.getElementById("ed-presa-icon"), "load");
    return;
  }
  if (event.target.closest("[data-presa-cancel]")) {
    event.preventDefault();
    state.modifica = null;
    ridisegnaScheda();
    return;
  }
  if (event.target.closest("[data-presa-save]")) {
    event.preventDefault();
    const modulo = leggiModulo();
    const errore = pannello.querySelector("[data-presa-error]");
    if (!eEntitaDiPresa(modulo.entity)) {
      if (errore)
        errore.textContent = t(
          "Inserisci un'entità valida (switch, input_boolean, light o fan).",
          "Enter a valid entity (switch, input_boolean, light or fan).",
        );
      return;
    }
    const indice = state.modifica ?? null;
    const gia = prese.findIndex((presa) => presa.entity === modulo.entity);
    if (gia >= 0 && gia !== indice) {
      if (errore)
        errore.textContent = t(
          "Questa entità è già configurata.",
          "This entity is already configured.",
        );
      return;
    }
    if (errore) errore.textContent = "";
    const elenco = prese.slice();
    const voce = {
      ...(indice === null ? {} : elenco[indice]),
      name: modulo.name,
      entity: modulo.entity,
      icon: modulo.icon,
      room_id: modulo.room_id,
    };
    /* Se la riga cambia entita', il blocco non resta appeso alla vecchia:
     * cd_solo_lettura e' la guardia condivisa coi comandi di tutta la
     * plancia, e un marcatore orfano lasciava non comandabile un'entita'
     * che nessuno protegge piu'. */
    const entitaPrima = indice === null ? "" : clean(elenco[indice]?.entity);
    if (entitaPrima && entitaPrima !== clean(voce.entity)) segnaSoloLettura(entitaPrima, false);
    if (indice === null) elenco.push(voce);
    else elenco[indice] = voce;
    salvaPrese(elenco);
    /* Il blocco non vive qui: sta nell'elenco delle cose che si guardano e
     * basta, che e' lo stesso delle luci. Un secondo elenco vorrebbe dire una
     * presa protetta nella sua sezione e comandabile dalla pagina Stanze.
     * La chiamata e' DIRETTA: passava da `root.dmSegnaSoloLettura?.()`, un
     * nome che nessuno ha mai messo su root, e l'optional chaining faceva
     * no-op in silenzio — «se lo salvo non prende l'opzione e la presa
     * continua ad essere comandata». */
    segnaSoloLettura(modulo.entity, modulo.bloccata);
    state.modifica = null;
    ridisegnaScheda();
    schedule();
    return;
  }
  const riga = event.target.closest("[data-presa-index]");
  if (!riga) return;
  const indice = Number(riga.dataset.presaIndex);
  if (!Number.isFinite(indice) || !prese[indice]) return;
  if (event.target.closest("[data-presa-edit]")) {
    event.preventDefault();
    state.modifica = state.modifica === indice ? null : indice;
    ridisegnaScheda();
    return;
  }
  if (event.target.closest("[data-presa-del]")) {
    event.preventDefault();
    /* Il nome in una variabile e non dentro la frase: la frase e' una chiave di
     * traduzione, e una chiave che porta dentro un'espressione e' una chiave
     * diversa da tutte le altre uguali. Con `nome` questa e' la stessa domanda
     * che fanno le stanze, le auto e le vasche, gia' tradotta ovunque. */
    const nome = prese[indice].name;
    const domanda = t(`Elimino "${nome}"?`, `Remove "${nome}"?`);
    if (root.confirm && !root.confirm(domanda)) return;
    state.modifica = null;
    /* La presa se ne va col suo eventuale blocco: il marcatore orfano in
     * cd_solo_lettura teneva non comandabile un'entita' non piu' protetta. */
    const entitaVia = clean(prese[indice]?.entity);
    if (entitaVia) segnaSoloLettura(entitaVia, false);
    salvaPrese(prese.filter((_presa, posizione) => posizione !== indice));
    ridisegnaScheda();
    schedule();
  }
}

function installStyles() {
  installStyle(
    "dm-prese-section-style",
    `
      #page-prese .dm-lucip-empty{display:grid;gap:6px;padding:22px 18px;border:1px dashed var(--divider-color,#dbe4ee);border-radius:18px;background:var(--card-bg,#fff);text-align:center}
      #page-prese .dm-lucip-empty strong{font-size:14px;font-weight:900}
      #page-prese .dm-lucip-empty span{font-size:12px;color:var(--secondary-text-color,#64748b);font-weight:700}
      .dm-prese-editor .dm-presa-row{align-items:center}
      .dm-prese-editor .dm-presa-icon{flex:0 0 auto;font-size:20px;width:30px;text-align:center}
      .dm-prese-editor .dm-presa-icon svg{display:block;margin:0 auto}
      .dm-prese-editor .dm-presa-icon-row{align-items:center}
      .dm-prese-editor .dm-presa-icon-btn{display:grid;place-items:center;width:52px;height:44px;padding:6px;
        border:1px solid var(--divider-color,#dbe4ee);border-radius:12px;cursor:pointer;
        background:linear-gradient(145deg,color-mix(in srgb,var(--primary-color,#0ea5e9) 10%,var(--card-background-color,#fff)),var(--card-background-color,#fff))}
      .dm-prese-editor .dm-presa-icon-btn:hover{filter:brightness(1.04)}
      .dm-prese-editor .dm-presa-icon-btn svg{display:block}
      .dm-prese-editor .dm-presa-error:empty{display:none}
      .dm-prese-editor .dm-presa-error{display:block;margin:6px 0 0;color:#b91c1c;font-size:12px;font-weight:800}
      .dm-prese-editor .dm-presa-lock small{display:block;margin-top:3px;color:var(--secondary-text-color,#64748b);font-size:11px;font-weight:700;line-height:1.35}
    `,
  );
}

export function installPreseSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  ensurePresePage();
  ensurePreseTab();
  insegnaLaVisibilita();
  doc.addEventListener("click", onEditorClick);
  onEditorRedraw("__dmPreseEditor", ridisegnaScheda);
  for (const nome of ["render", "cdApplyNavVis"]) wrapFunction(nome, "__dmPreseSection", schedule);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  schedule();
}
