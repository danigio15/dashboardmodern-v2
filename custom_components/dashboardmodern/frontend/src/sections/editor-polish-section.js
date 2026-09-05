import {
  clean,
  doc,
  esc,
  installStyle,
  readJson,
  restyleOnLocaleChange,
  root,
  t,
  writeJsonIfChanged,
  wrapFunction,
} from "./shared.js";
import { CASELLA_DI_RETE, CASELLE_VECCHIE } from "./minipc-showcase-section.js";

globalThis.__DM_20260815C__ = true;
const KEY = "__DASHBOARDMODERN_EDITOR_POLISH__";
const state = (root[KEY] ||= { installed: false, frame: 0, subscribed: false });

function activeTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function sync() {
  try {
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  } catch (_error) {}
}

function polishCanonicalLights() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== "luci") return false;
  body.dataset.dmLightsEditor = "canonical-polished";
  body.querySelectorAll(".dm-light-row").forEach((row) => {
    const entity = clean(row.dataset.lightEntity);
    const main = row.querySelector(".ed-row-main");
    const idNode = main?.querySelector(".ed-row-old");
    if (idNode && entity) {
      idNode.textContent = entity;
      idNode.classList.add("dm-light-entity-id");
      idNode.setAttribute("title", entity);
    }
    const edit = row.querySelector(".dm-light-edit");
    if (edit) edit.title = t("Modifica tutti i dati della luce", "Edit all light data");
    const deleteButton = [...row.querySelectorAll("button.ed-del")].find((button) =>
      /elimina luce|delete light/i.test(button.getAttribute("aria-label") || ""),
    );
    if (deleteButton) deleteButton.classList.add("dm-light-delete");
  });
  const add = body.querySelector("[data-light-add-form]");
  if (add) {
    add.classList.add("dm-light-add-polished");
    const input = add.querySelector("[data-light-add-entity]");
    if (input)
      input.setAttribute(
        "aria-label",
        t("Entità Home Assistant della nuova luce", "Home Assistant entity for the new light"),
      );
  }
  return true;
}

function polishLoadsEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || (!["load", "loads"].includes(activeTab()) && body.dataset.renderer !== "loads"))
    return false;
  const form = body.querySelector("[data-load-form]");
  if (!form) return false;
  form.dataset.dmLoadForm = "clarified";

  const firstRow = form.querySelector(":scope > .ed-form-row");
  if (firstRow) firstRow.dataset.loadGroup = "identity";
  const room =
    form.querySelector("#dm-load-room")?.closest(".ed-form-row") ||
    form.querySelector("#dm-load-room")?.parentElement;
  if (room) room.dataset.loadGroup = "identity";

  const groups = {
    "dm-load-power": "energy-primary",
    "dm-load-day": "energy",
    "dm-load-month": "energy",
    "dm-load-total": "energy",
    "dm-load-history": "energy",
    "dm-load-state": "control-primary",
    "dm-load-control": "control",
  };
  Object.entries(groups).forEach(([id, group]) => {
    const input = form.querySelector(`#${id}`);
    const field = input?.closest(".ed-slot,[data-entity-field]");
    if (field) field.dataset.loadGroup = group;
  });
  form.querySelectorAll(":scope > label.ed-intro").forEach((label) => {
    label.dataset.loadGroup = "visibility";
  });
  const save = form.querySelector("[data-save-load]");
  if (save) save.dataset.loadGroup = "save";
  return true;
}

/* Il nome del parametro NON e' il textContent dell'etichetta.
 *
 * Dentro `.ed-slot-lbl` il nome vero sta nel value di un campo rinominabile
 * (`input.wz-lbl-edit`), che nel textContent non compare. E nell'etichetta
 * altri moduli appendono i loro comandi — la tendina delle stanze,
 * l'interruttore «Nel widget» — cosi' il textContent era SOLO la loro
 * spazzatura: le card del MiniPC si intitolavano
 * «— Nessuna stanza — Casa Ingresso… Nel widget» al posto di «CPU (%)».
 * Si legge il campo; se un runtime vecchio scrive l'etichetta come testo, si
 * legge quel testo dopo aver tolto i controlli degli altri. */
function labelDelloSlot(slot) {
  const etichetta = slot?.querySelector?.(".ed-slot-lbl");
  const campo = clean(etichetta?.querySelector?.("input.wz-lbl-edit")?.value);
  if (campo) return campo;
  if (!etichetta) return "";
  const copia = etichetta.cloneNode(true);
  copia.querySelectorAll("select,button,input,textarea").forEach((controllo) => controllo.remove());
  return clean(copia.textContent).replace(/✏️/g, "");
}

/* Il menu dei parametri offriva quattro voci per una domanda sola: Stato
 * Internet, Ping Internet, Raggiungibilita' Google, Internet lavanderia.
 * «Non ne mettere 4 che dicono la stessa cosa, mettine 1 solo»: ne resta una,
 * si chiama Internet, ed e' quella che il guscio legge dappertutto — la
 * pastiglia in cima, la card «Connettivita'» e il popup dei sette giorni.
 * Quello che stava nelle altre tre ci si e' gia' spostato dentro: lo fa il
 * modulo del MiniPC, e le tre spariscono anche dalla configurazione. */
function serverSlots(body) {
  return [...body.querySelectorAll('input.ed-slot-in[data-ref^="dm.server_"]')]
    .map((input) => {
      const slot = input.closest(".ed-slot") || input.parentElement;
      const ref = clean(input.dataset.ref);
      const label =
        ref === CASELLA_DI_RETE
          ? t("Internet", "Internet")
          : labelDelloSlot(slot) || ref.replace(/^dm\.server_/, "").replace(/_/g, " ");
      return { ref, label, value: clean(input.value), input };
    })
    .filter((item) => item.ref && !CASELLE_VECCHIE.includes(item.ref));
}

function storeServerValue(item, value) {
  item.input.value = value;
  try {
    if (typeof root.edSetSlot === "function") {
      root.edSetSlot(item.input);
      return;
    }
  } catch (_error) {}
  const overrides = readJson("cd_entity_overrides", {});
  if (value) overrides[item.ref] = value;
  else delete overrides[item.ref];
  writeJsonIfChanged("cd_entity_overrides", overrides);
  if (root.ENTITY_OVERRIDES) {
    if (value) root.ENTITY_OVERRIDES[item.ref] = value;
    else delete root.ENTITY_OVERRIDES[item.ref];
  }
  sync();
}

/* Quello che c'e' scritto ADESSO nelle righe, dentro `slots`.
 *
 * Il ridisegno riparte da `slot.value`, che nasceva alla costruzione del
 * pannello e si aggiornava solo al Salva: premere «Aggiungi» — o un cestino —
 * ributtava l'innerHTML dai valori vecchi, e tutte le entita' digitate e non
 * ancora salvate sparivano insieme. Prima di ridisegnare si raccoglie. */
function raccogliValoriCorrenti(panel, slots) {
  panel.querySelectorAll("[data-ref]").forEach((row) => {
    const slot = slots.find((item) => item.ref === row.dataset.ref);
    const input = row.querySelector("[data-server-value]");
    if (slot && input) slot.value = clean(input.value);
  });
}

function renderServerCards(panel, slots, visibleRefs) {
  const list = panel.querySelector("[data-server-list]");
  if (!list) return;
  const visible = slots.filter((slot) => visibleRefs.has(slot.ref));
  list.innerHTML = visible.length
    ? visible
        .map(
          (slot) =>
            `<article class="ed-row dm-server-row" data-ref="${esc(slot.ref)}"><span class="dm-server-icon">🖥️</span><div class="dm-server-copy"><strong>${esc(slot.label)}</strong><small class="mono">${esc(slot.ref)}</small><span class="dm-server-entity-row"><input class="ed-input mono" data-server-value data-entity-input="true" value="${esc(slot.value)}" placeholder="sensor.entity"><button type="button" class="dm-entity-picker" data-entity-target="" aria-label="${t("Seleziona entità", "Choose entity")}">🔍</button></span></div><button type="button" class="ed-del" data-remove aria-label="${t("Rimuovi", "Remove")}">🗑️</button></article>`,
        )
        .join("")
    : `<div class="ed-empty">${t("Nessun parametro aggiunto. Scegline uno dal menu.", "No parameters added. Choose one from the menu.")}</div>`;
  list.querySelectorAll(".dm-server-row").forEach((row, index) => {
    const input = row.querySelector("[data-server-value]");
    const pick = row.querySelector(".dm-entity-picker");
    if (input && pick) {
      const id = `dm-server-entity-${index}-${Math.random().toString(36).slice(2, 7)}`;
      input.id = id;
      pick.dataset.entityTarget = id;
    }
  });
  list.querySelectorAll("[data-remove]").forEach((button) =>
    button.addEventListener("click", () => {
      raccogliValoriCorrenti(panel, slots);
      const ref = button.closest("[data-ref]")?.dataset.ref;
      const slot = slots.find((item) => item.ref === ref);
      if (slot) {
        slot.value = "";
        storeServerValue(slot, "");
      }
      visibleRefs.delete(ref);
      renderServerCards(panel, slots, visibleRefs);
      root.setTimeout?.(() => root.DashboardModernModules?.render?.mountEntityPickers?.(panel), 0);
    }),
  );
}

function ensureServerEditor() {
  const body = doc?.getElementById("ed-body");
  if (
    !body ||
    !["sez6", "server"].includes(activeTab()) ||
    body.querySelector("[data-server-compact]")
  )
    return false;
  const slots = serverSlots(body);
  if (!slots.length) return false;
  body.querySelectorAll("details.ed-acc").forEach((details) => {
    details.hidden = true;
    details.dataset.dmServerLegacy = "true";
  });
  const visibleRefs = new Set(slots.filter((slot) => slot.value).map((slot) => slot.ref));
  const panel = doc.createElement("section");
  panel.className = "ed-form dm-server-compact";
  panel.dataset.serverCompact = "true";
  panel.innerHTML = `<div class="ed-sec-title">🖥️ ${t("Monitoraggio server", "Server monitoring")}</div><div class="ed-intro">${t("Aggiungi solo i parametri che vuoi mostrare: ogni voce configurata popola automaticamente la card.", "Add only the parameters you want to show: each configured item automatically populates the card.")}</div><div class="dm-server-add"><select class="ed-input" data-slot-select><option value="">— ${t("Scegli parametro", "Choose parameter")} —</option>${slots.map((slot) => `<option value="${esc(slot.ref)}">${esc(slot.label)}</option>`).join("")}</select><button type="button" class="ed-btn-add" data-add>＋ ${t("Aggiungi", "Add")}</button></div><div class="ed-list dm-server-list" data-server-list></div><button type="button" class="ed-save-btn" data-save>💾 ${t("Salva server", "Save server")}</button>`;
  body.prepend(panel);
  renderServerCards(panel, slots, visibleRefs);
  panel.querySelector("[data-add]")?.addEventListener("click", () => {
    const ref = clean(panel.querySelector("[data-slot-select]")?.value);
    if (!ref) return;
    raccogliValoriCorrenti(panel, slots);
    visibleRefs.add(ref);
    renderServerCards(panel, slots, visibleRefs);
    root.setTimeout?.(() => root.DashboardModernModules?.render?.mountEntityPickers?.(panel), 0);
  });
  panel.querySelector("[data-save]")?.addEventListener("click", () => {
    panel.querySelectorAll("[data-ref]").forEach((row) => {
      const slot = slots.find((item) => item.ref === row.dataset.ref);
      if (!slot) return;
      const value = clean(row.querySelector("[data-server-value]")?.value);
      slot.value = value;
      storeServerValue(slot, value);
    });
    sync();
    root.render?.();
    panel.dataset.saved = "true";
  });
  root.setTimeout?.(() => root.DashboardModernModules?.render?.mountEntityPickers?.(panel), 0);
  return true;
}

function ensureActionPolish() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== "sez8") return false;
  body.classList.add("dm-actions-editor");
  return true;
}

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    polishCanonicalLights();
    polishLoadsEditor();
    ensureServerEditor();
    ensureActionPolish();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
}

function subscribeStore() {
  if (state.subscribed) return;
  const store = root.DashboardModernModules?.store;
  if (typeof store?.subscribe !== "function") return;
  state.subscribed = true;
  store.subscribe((change) => {
    if (["lights", "loads", "rooms", "entityOverrides", "snapshot"].includes(change?.section))
      schedule();
  });
}

function installStyles() {
  installStyle(POLISH_STYLE_ID, polishCss());
  restyleOnLocaleChange(POLISH_STYLE_ID, polishCss);
}

const POLISH_STYLE_ID = "dm-editor-polish-style";

function polishCss() {
  return `
    /* I tasti dell'editor si devono leggere.
       «.ed-btn-add» nasce celeste con la scritta blu. Chi ne vuole uno che
       spicchi gli riscrive il fondo — un gradiente scuro, un grigio — e la
       scritta resta quella di prima: blu su blu, o bianco su verde chiaro.
       Sono tasti larghi quanto la finestra e non si capisce cosa fanno.
       Qui i fondi che il runtime storico si scrive nell'attributo «style»
       (gli unici riconoscibili da un foglio di stile) si portano dietro la
       loro scritta bianca, e i due colori troppo chiari scendono di un tono
       fino a stare sopra il 4,5:1 del WCAG. */
    /* Il celeste di serie con il blu di serie sta a 4,47:1, sotto la soglia per
       un soffio. Il blu scende di mezzo tono e ci passa sopra senza che il
       tasto cambi aspetto. Solo di giorno: la notte il tasto e' gia' scuro con
       la scritta chiara, e questa regola lo rovinerebbe. */
    html:not([data-theme="dark"]) #ed-body .ed-btn-add{color:#075985}
    /* Il tasto secondario non aveva una forma.
       Tre moduli lo chiedono — «Annulla», «Chiudi», il salvataggio di un
       gruppo — e nessun foglio di stile gliela dava: usciva il rettangolo
       grigio del browser in mezzo a tasti tondi, e si vedeva che era finito
       li' per sbaglio. Prende la forma degli altri, in tono minore: e' un
       «ho finito», non un «salva». */
    #ed-body .ed-btn-secondary{
      padding:11px 14px;border:1px solid var(--divider-color,#dbe4ee);border-radius:12px;
      background:var(--secondary-background-color,#f1f5f9);color:var(--text,#0f172a);
      font-family:inherit;font-weight:800;font-size:12px;letter-spacing:.5px;
      text-transform:uppercase;cursor:pointer;transition:.2s}
    #ed-body .ed-btn-secondary:hover{filter:brightness(.97)}
    html[data-theme="dark"] #ed-body .ed-btn-secondary{
      border-color:rgba(148,163,184,.25);background:rgba(148,163,184,.14);color:#e2e8f0}
    #ed-body .ed-btn-add[style*="linear-gradient"],
    #ed-body .ed-btn-add[style*="#94a3b8"]{color:#fff!important}
    #ed-body .ed-btn-add[style*="#0ea5e9"]{background:linear-gradient(135deg,#0369a1,#075985)!important}
    #ed-body .ed-btn-add[style*="#10b981"]{background:linear-gradient(135deg,#047857,#065f46)!important}
    #ed-body .ed-btn-add[style*="#94a3b8"]{background:linear-gradient(135deg,#64748b,#475569)!important}
    #ed-body[data-dm-lights-editor="canonical-polished"]{display:grid!important;gap:16px!important}
    #ed-body[data-dm-lights-editor="canonical-polished"]>.ed-intro{margin:0!important;padding:14px 16px!important;border:1px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 35%,var(--divider-color,#dbe4ee))!important;border-radius:16px!important;background:color-mix(in srgb,var(--primary-color,#0ea5e9) 5%,var(--card-background-color,#fff))!important}
    .dm-light-group{border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:20px!important;background:var(--card-background-color,#fff)!important;padding:12px!important;overflow:hidden!important}
    .dm-light-group>.ed-acc-head{border-radius:14px!important;margin-bottom:10px!important}.dm-light-group>.ed-list{display:grid!important;gap:10px!important}
    .dm-light-row{display:grid!important;grid-template-areas:"order main room edit delete"!important;align-items:center!important;min-width:0!important;min-height:82px!important;padding:12px!important;background:var(--secondary-background-color,#f6f8fb)!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:15px!important;overflow:visible!important}
    .dm-light-row .dm-light-order{grid-area:order!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:5px!important;align-self:center!important}.dm-light-row .dm-light-order>.ed-del{width:30px!important;height:30px!important;min-width:30px!important;padding:0!important}
    .dm-light-row .ed-row-main{grid-area:main!important;display:block!important;visibility:visible!important;opacity:1!important;min-width:0!important;max-width:none!important;overflow:visible!important}.dm-light-row .ed-row-new{display:block!important;visibility:visible!important;opacity:1!important;font-weight:800!important;color:var(--text,#0f172a)!important;white-space:normal!important;overflow-wrap:anywhere!important}.dm-light-entity-id{display:block!important;visibility:visible!important;opacity:1!important;margin-top:4px!important;color:var(--secondary-text-color,#64748b)!important;font-size:12px!important;overflow-wrap:anywhere!important;white-space:normal!important}
    .dm-light-room{grid-area:room!important;display:block!important;visibility:visible!important;opacity:1!important;width:100%!important;min-width:0!important;color:var(--text,#0f172a)!important;background:var(--card-background-color,#fff)!important}.dm-light-edit{grid-area:edit!important}.dm-light-delete{grid-area:delete!important}.dm-light-edit,.dm-light-delete{display:grid!important;place-items:center!important;visibility:visible!important;opacity:1!important;width:48px!important;height:48px!important;min-width:48px!important;padding:0!important}
    .dm-light-add-form{border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:20px!important;padding:16px!important;background:var(--card-background-color,#fff)!important;display:grid!important;gap:12px!important}.dm-light-add-form>.ed-form-row{display:flex!important;gap:8px!important;min-width:0!important}.dm-light-add-form>.ed-form-row>.ed-input{flex:1 1 auto!important;min-width:0!important}

    /* Energy > Loads: turn the flat technical form into visually separated
       blocks without moving or replacing its functional inputs/listeners. */
    [data-load-form][data-dm-load-form="clarified"]{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;padding:18px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:22px!important;background:var(--card-background-color,#fff)!important}
    [data-load-form][data-dm-load-form="clarified"]>.ed-sec-title{grid-column:1/-1!important;margin:0 0 2px!important;font-size:18px!important}
    [data-load-form][data-dm-load-form="clarified"]>[data-load-group="identity"]{grid-column:1/-1!important;display:flex!important;gap:10px!important;padding:12px!important;border:1px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 20%,var(--divider-color,#dbe4ee))!important;border-radius:16px!important;background:color-mix(in srgb,var(--primary-color,#0ea5e9) 5%,var(--card-background-color,#fff))!important}
    [data-load-form][data-dm-load-form="clarified"]>[data-load-group="identity"]>*{min-width:0!important;flex:1 1 0!important}
    [data-load-form][data-dm-load-form="clarified"]>.ed-slot[data-load-group^="energy"]{position:relative!important;display:grid!important;gap:7px!important;min-width:0!important;margin:0!important;padding:14px!important;border:1px solid color-mix(in srgb,#0ea5e9 18%,var(--divider-color,#dbe4ee))!important;border-radius:16px!important;background:color-mix(in srgb,#0ea5e9 4%,var(--card-background-color,#fff))!important}
    [data-load-form][data-dm-load-form="clarified"]>.ed-slot[data-load-group="energy-primary"]{grid-column:1/-1!important;padding-top:42px!important}
    [data-load-form][data-dm-load-form="clarified"]>.ed-slot[data-load-group="energy-primary"]::before{content:"${t("⚡ MISURE ENERGETICHE", "⚡ ENERGY READINGS")}";position:absolute;left:14px;top:12px;font-size:11px;font-weight:900;letter-spacing:.08em;color:#0284c7}
    [data-load-form][data-dm-load-form="clarified"]>.ed-slot[data-load-group^="control"]{position:relative!important;display:grid!important;gap:7px!important;min-width:0!important;margin:0!important;padding:14px!important;border:1px solid color-mix(in srgb,#16a34a 18%,var(--divider-color,#dbe4ee))!important;border-radius:16px!important;background:color-mix(in srgb,#16a34a 4%,var(--card-background-color,#fff))!important}
    [data-load-form][data-dm-load-form="clarified"]>.ed-slot[data-load-group="control-primary"]{padding-top:42px!important}
    [data-load-form][data-dm-load-form="clarified"]>.ed-slot[data-load-group="control-primary"]::before{content:"${t("🎛️ STATO E CONTROLLO", "🎛️ STATE AND CONTROL")}";position:absolute;left:14px;top:12px;font-size:11px;font-weight:900;letter-spacing:.08em;color:#15803d}
    [data-load-form][data-dm-load-form="clarified"]>label[data-load-group="visibility"]{display:flex!important;align-items:center!important;gap:9px!important;margin:0!important;padding:12px 14px!important;border-radius:14px!important;background:var(--secondary-background-color,#f6f8fb)!important;border:1px solid var(--divider-color,#dbe4ee)!important;font-weight:750!important}
    [data-load-form][data-dm-load-form="clarified"]>[data-load-group="save"]{grid-column:1/-1!important;min-height:50px!important;margin-top:2px!important}

    .dm-server-compact{margin-bottom:18px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:20px!important;background:var(--card-background-color,#fff)!important;padding:18px!important}.dm-server-add{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;margin:12px 0 16px}.dm-server-list{display:grid!important;gap:10px!important}.dm-server-row{display:grid!important;grid-template-columns:48px minmax(0,1fr) 48px!important;gap:12px!important;align-items:start!important;min-height:0!important;padding:14px!important}.dm-server-icon{display:grid!important;place-items:center!important;width:44px!important;height:44px!important;border-radius:14px!important;background:color-mix(in srgb,#0ea5e9 12%,transparent)!important;font-size:20px!important}.dm-server-copy{display:grid!important;gap:6px!important;min-width:0!important;color:var(--text,#0f172a)!important;visibility:visible!important;opacity:1!important}.dm-server-copy>strong{display:block!important;font-size:14px!important;font-weight:900!important;color:var(--text,#0f172a)!important}.dm-server-copy>small{display:block!important;font-size:10px!important;color:var(--secondary-text-color,#64748b)!important;overflow-wrap:anywhere!important}.dm-server-entity-row{display:grid!important;grid-template-columns:minmax(0,1fr) 46px!important;gap:8px!important;margin-top:3px!important}.dm-server-entity-row .ed-input{display:block!important;visibility:visible!important;opacity:1!important;min-width:0!important;width:100%!important;color:var(--text,#0f172a)!important;background:var(--card-background-color,#fff)!important}
    .dm-actions-editor{display:grid!important;gap:16px!important}.dm-actions-editor .ed-acc,.dm-actions-editor>.ed-form,.dm-actions-editor>.ed-list{border-radius:20px!important}.dm-actions-editor .ed-row{border-radius:14px!important}
    /* La riga delle luci si impila sotto i 760, non sotto i 900.
       *
       * Qui c'era 900, e in mezzo — fra 761 e 900, la finestra a meta' schermo
       * o il tablet in verticale — usciva una riga rotta: queste quattro aree
       * si applicavano, ma le colonne le decideva un foglio che carica dopo, e
       * ne dava cinque. Il nome della luce finiva schiacciato in 140 pixel con
       * un buco da 257 accanto, e la tendina della stanza sbordava sotto per
       * tutta la larghezza. Da 760 in giu' comanda comunque il foglio del
       * telefono, con la sua riga impilata; sopra, la riga a cinque colonne. */
    @media(max-width:760px){.dm-light-row{grid-template-areas:"order main edit delete" "room room room room"!important}.dm-light-row .dm-light-room{width:100%!important}}
    @media(max-width:720px){.dm-light-row .dm-light-order{grid-template-columns:1fr!important}.dm-server-add{grid-template-columns:1fr!important}[data-load-form][data-dm-load-form="clarified"]{grid-template-columns:1fr!important;padding:14px!important}[data-load-form][data-dm-load-form="clarified"]>*{grid-column:1!important}[data-load-form][data-dm-load-form="clarified"]>[data-load-group="identity"]{display:grid!important;grid-template-columns:1fr!important}}
  `;
}

export function installEditorPolishSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  root.addEventListener?.("dashboardmodern:legacy-ready", () => {
    for (const name of ["editorSwitch", "editorRenderLuci", "editorRenderServer"])
      wrapFunction(name, `__dmEditorPolish_${name}`, schedule);
    subscribeStore();
    schedule();
  });
  root.addEventListener?.("dashboardmodern:runtime-ready", () => {
    subscribeStore();
    schedule();
  });
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.(".ed-tab,[data-tab],.ed-btn-add,.ed-save-btn,.ed-del"))
        root.setTimeout?.(schedule, 0);
    },
    true,
  );
  schedule();
}

installEditorPolishSection();
