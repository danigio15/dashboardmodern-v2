// DM-FIX-20260812B
import { contactEntity } from "../core/shutter-window.js";
import { canonicalClimateType } from "../core/device-model.js";
import { clean, dashboardStore, doc, english, installStyle, onEditorRedraw, readClimateUnits, readJson, root, t, wrapFunction, writeJsonIfChanged } from "./shared.js";

globalThis.__DM_20260815C__ = true;
const KEY = "__DASHBOARDMODERN_EDITOR_CRUD_SECTION__";
const state = (root[KEY] ||= { installed: false, listeners: false, editing: null });

function syncEditorTheme() {
  const modal = doc?.getElementById("editor-modal");
  if (!modal) return;
  const explicit = clean(doc.documentElement?.dataset?.theme || doc.body?.dataset?.theme).toLowerCase();
  let dark = explicit === "dark";
  if (!explicit) {
    const scheme = clean(root.getComputedStyle?.(doc.documentElement)?.colorScheme).toLowerCase();
    dark = scheme.includes("dark") && !scheme.includes("light");
  }
  modal.dataset.dmEditorTheme = dark ? "dark" : "light";
}

function cumulativeEntity(entity) {
  const id = clean(entity);
  if (!id) return false;
  const current = root.STATES?.[id] || root._RAW_STATES?.[id] || null;
  const stateClass = clean(current?.attributes?.state_class).toLowerCase();
  return (
    stateClass === "total" ||
    stateClass === "total_increasing" ||
    /(?:^|[._-])(total|totale|lifetime|meter|contatore)(?:[._-]|$)/i.test(id)
  );
}

function normalizeReportEditor() {
  const panel = doc?.querySelector("#editor-modal [data-energy-panel='report']");
  if (!panel) return false;
  panel.dataset.dmReportEditor = "canonical";
  panel.querySelectorAll(".dm-report-row").forEach((row) => {
    const primary = row.querySelector("[data-entity-field]");
    if (!primary) return;
    const label = primary.querySelector(".ed-slot-lbl");
    if (label?.childNodes?.[0])
      label.childNodes[0].nodeValue = t("Entità totale per lo storico ", "Lifetime total entity ");
    const input = primary.querySelector("input");
    let helper = row.querySelector(".dm-report-history-help");
    if (!helper) {
      helper = doc.createElement("div");
      helper.className = "dm-report-history-help";
      row.append(helper);
    }
    const valid = !input?.value || cumulativeEntity(input.value);
    row.dataset.historyValid = String(valid);
    helper.textContent = valid
      ? t(
          "Contatore cumulativo kWh: abilita mese selezionato, mesi precedenti e anno.",
          "Cumulative kWh meter: enables selected month, previous months and year.",
        )
      : t(
          "L’entità non sembra cumulativa: seleziona il contatore totale lifetime del dispositivo.",
          "This entity does not look cumulative: select the device lifetime total meter.",
        );
  });
  return true;
}

function listFor(kind) {
  if (kind === "action") return root.getQuickActions?.().slice?.() || readJson("cd_quick_actions", []);
  if (kind === "climate") {
    return readClimateUnits();
  }
  if (kind === "shutter") return root.getTapparelle?.().slice?.() || readJson("cd_tapparelle", []);
  if (kind === "room") return root.getStanze?.().slice?.() || readJson("cd_stanze", []);
  return [];
}

function editButton(kind, index) {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "ed-del dm-edit-existing";
  button.dataset.dmEditKind = kind;
  button.dataset.dmEditIndex = String(index);
  button.textContent = "✏️";
  button.title = t("Modifica", "Edit");
  button.setAttribute("aria-label", button.title);
  return button;
}

/* Tutte le righe dell'elenco, comprese quelle gia' sistemate.
 *
 * Qui si escludevano le righe che avevano gia' il pulsante di modifica. Il
 * seguito pero' numera le righe contando da capo su cio' che riceve: se una
 * passata ne trova alcune gia' sistemate e altre no — cosa che accade ogni
 * volta che il runtime ridisegna una parte dell'elenco — le nuove ripartono da
 * zero e finiscono con lo stesso numero di righe che stanno piu' in alto. Chi
 * dipinge le righe legge quel numero per sapere quale unita' mostrare, e due
 * righe con lo stesso numero mostrano la stessa unita'. */
function rowsBeforeForm(container, selector) {
  const field = container?.querySelector(selector);
  if (!container || !field) return [];
  return [...container.querySelectorAll(".ed-row")].filter((row) => {
    if (row.contains(field)) return false;
    return Boolean(row.querySelector(".ed-del")) && Boolean(row.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
}

/* Che fare di ogni riga, e con quale numero.
 *
 * Il numero di una riga e' la sua posizione nell'elenco, non il suo turno di
 * arrivo: una riga gia' sistemata ma numerata male va corretta, non lasciata
 * com'e'. Separato dal documento perche' e' l'unica parte che decide. */
export function editButtonPlan(rows = []) {
  return rows.map((row, index) => ({
    index,
    action: !row?.hasButton ? "create" : row.index === index ? "keep" : "renumber",
  }));
}

function ensureEditButtons() {
  const body = doc?.getElementById("ed-body");
  if (!body) return false;
  const definitions = [
    ["action", body.querySelector("#ed-qa-type")?.closest("details") || body, "#ed-qa-type"],
    ["climate", body.querySelector("#ed-cl-type")?.closest("details") || body, "#ed-cl-type"],
    ["shutter", body, "#ed-tp-name"],
    ["room", body, "#ed-room-name"],
  ];
  definitions.forEach(([kind, container, selector]) => {
    if (!container?.querySelector(selector)) return;
    const rows = rowsBeforeForm(container, selector);
    const existing = rows.map((row) => row.querySelector(`[data-dm-edit-kind="${kind}"]`));
    const plan = editButtonPlan(
      existing.map((button) => ({
        hasButton: Boolean(button),
        index: button ? Number.parseInt(button.dataset.dmEditIndex ?? "-1", 10) : -1,
      })),
    );
    plan.forEach((step, position) => {
      const row = rows[position];
      if (step.action === "create") {
        const remove = [...row.querySelectorAll(".ed-del")].at(-1);
        remove?.before(editButton(kind, step.index));
        return;
      }
      if (step.action === "renumber") existing[position].dataset.dmEditIndex = String(step.index);
    });
  });
  return Boolean(body.querySelector("[data-dm-edit-kind]"));
}

function formFor(kind) {
  const selectors = {
    action: "#ed-qa-type",
    climate: "#ed-cl-type",
    shutter: "#ed-tp-name",
    room: "#ed-room-name",
  };
  const field = doc?.querySelector(selectors[kind]);
  return field?.closest(".ed-form") || field?.parentElement || null;
}

function setField(id, value) {
  const field = doc?.getElementById(id);
  if (!field) return;
  field.value = value ?? "";
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function addCancel(kind) {
  const form = formFor(kind);
  if (!form || form.querySelector(".dm-edit-cancel")) return;
  const cancel = doc.createElement("button");
  cancel.type = "button";
  cancel.className = "ed-btn-add dm-edit-cancel";
  cancel.textContent = t("Annulla modifica", "Cancel edit");
  cancel.addEventListener("click", () => {
    state.editing = null;
    root.editorSwitch?.(doc.querySelector(".ed-tab.active")?.dataset?.tab || "sezioni");
  });
  form.append(cancel);
}

function beginEdit(kind, index) {
  const item = listFor(kind)[index];
  if (!item) return;
  if (kind === "action" && item.type === "luci_group" && typeof root.edEditLightGroup === "function") {
    root.edEditLightGroup(index);
    return;
  }
  state.editing = { kind, index };
  formFor(kind)?.setAttribute("data-dm-editing", "true");
  if (kind === "action") {
    setField("ed-qa-type", item.type === "builtin" ? `builtin_${item.builtin}` : item.type || "toggle");
    setField("ed-qa-icon", item.icon || "");
    setField("ed-qa-name", item.name || "");
    setField("ed-qa-ent", item.entity || "");
    setField("ed-qa-confirm", item.confirm || item.confirmation || "");
    root.edQaTypeChanged?.();
  } else if (kind === "climate") {
    setField("ed-cl-type", canonicalClimateType(item.type));
    setField("ed-cl-name", item.name || "");
    setField("ed-cl-ent", item.entity || "");
    setField("ed-cl-room", item.room || item.room_id || "");
  } else if (kind === "shutter") {
    setField("ed-tp-name", item.name || "");
    setField("ed-tp-ent", item.entity || "");
    setField("ed-tp-room", item.room || item.room_id || "");
    setField("ed-tp-contact", contactEntity(item));
    setField("ed-tp-tenda", item.tenda || "");
    setField("ed-tp-tendasole", item.tendaSole || "");
  } else if (kind === "room") {
    setField("ed-room-name", item.name || "");
    setField("ed-room-icon", item.icon || "🏠");
    setField("ed-room-floor", item.floor || "");
    const preview = doc.getElementById("ed-room-icon-preview");
    if (preview) preview.innerHTML = root.cdIconMarkup?.(item.icon || "🏠", 26) || item.icon || "🏠";
  }
  const add = formFor(kind)?.querySelector(".ed-btn-add:not(.dm-edit-cancel)");
  if (add) add.textContent = t("💾 Salva modifiche", "💾 Save changes");
  addCancel(kind);
}

function finishEdit(kind) {
  state.editing = null;
  root.editorSwitch?.({ action: "sezioni", climate: "sezioni", shutter: "tapp", room: "stanze" }[kind]);
}

function installAddWrappers() {
  /* `suAggiunta` serve a posare accanto a una voce nuova i campi che il runtime
   * non conosce.
   *
   * Si chiama PRIMA e restituisce cosa fare DOPO, perche' aggiungendo una voce
   * il runtime ridisegna la scheda: un campo letto dopo e' un campo gia'
   * svuotato. Sta dentro a questo involucro e non in un secondo perche'
   * l'involucro e' uno solo — un secondo si impilerebbe a ogni apertura
   * dell'editor, visto che la guardia riconosce solo il proprio. */
  const wrap = (name, kind, saveEdit, suAggiunta) => {
    const current = root[name];
    if (typeof current !== "function" || current.__dmEditableSection) return;
    function editableOwner(...args) {
      if (state.editing?.kind !== kind) {
        let poi = null;
        try {
          poi = suAggiunta?.() || null;
        } catch (_error) {}
        const result = current.apply(this, args);
        try {
          poi?.();
        } catch (_error) {}
        return result;
      }
      saveEdit(state.editing.index);
      finishEdit(kind);
    }
    editableOwner.__dmEditableSection = true;
    editableOwner.__dmPrevious = current;
    root[name] = editableOwner;
  };

  wrap("edAddQA", "action", (index) => {
    const list = listFor("action");
    const previous = list[index] || {};
    const selected = clean(doc.getElementById("ed-qa-type")?.value);
    const next = {
      ...previous,
      icon: clean(doc.getElementById("ed-qa-icon")?.value),
      name: clean(doc.getElementById("ed-qa-name")?.value),
      confirm: clean(doc.getElementById("ed-qa-confirm")?.value),
    };
    if (selected.startsWith("builtin_")) {
      next.type = "builtin";
      next.builtin = selected.slice(8);
      delete next.entity;
      delete next.lights;
    } else {
      next.type = selected;
      next.entity = clean(doc.getElementById("ed-qa-ent")?.value);
      delete next.builtin;
    }
    list[index] = next;
    writeJsonIfChanged("cd_quick_actions", list);
    root.buildQuickActions?.();
  });

  wrap("edAddClima", "climate", (index) => {
    const list = listFor("climate");
    list[index] = {
      ...(list[index] || {}),
      type: canonicalClimateType(doc.getElementById("ed-cl-type")?.value),
      name: clean(doc.getElementById("ed-cl-name")?.value),
      entity: clean(doc.getElementById("ed-cl-ent")?.value),
      room: clean(doc.getElementById("ed-cl-room")?.value),
    };
    writeJsonIfChanged("cd_clima_units", list);
    root.buildClimaCards?.();
    root.buildDeviceCards?.();
  });

  /* La copia in localStorage e il modello canonico devono dire la stessa cosa.
   *
   * Il runtime scrive solo la copia; il modello la rilegge per conto suo, con i
   * suoi tempi. Fra le due cose c'e' una finestra in cui il disegno legge il
   * modello e trova una versione vecchia — e con il contatto dell'infisso quella
   * finestra si vedeva: la tapparella appena aggiunta restava senza. Scrivendo
   * in tutte e due nello stesso momento la finestra non c'e' piu'. */
  const salvaTapparelle = (list) => {
    writeJsonIfChanged("cd_tapparelle", list);
    try {
      dashboardStore()?.replaceSection?.("covers", list)?.catch?.(() => {});
    } catch (_error) {}
    root.renderTapparelle?.();
  };

  wrap("edTappAdd", "shutter", (index) => {
    const list = listFor("shutter");
    list[index] = {
      ...(list[index] || {}),
      name: clean(doc.getElementById("ed-tp-name")?.value),
      entity: clean(doc.getElementById("ed-tp-ent")?.value),
      room: clean(doc.getElementById("ed-tp-room")?.value),
      // Il contatto dell'infisso: la card lo legge per sapere se la finestra
      // dietro la tapparella e' aperta.
      contact: clean(doc.getElementById("ed-tp-contact")?.value),
      /* Un infisso puo' averle tutte: una casella per funzione, e il tipo non
       * si dichiara piu' perche' lo dice la casella. */
      tenda: clean(doc.getElementById("ed-tp-tenda")?.value),
      tendaSole: clean(doc.getElementById("ed-tp-tendasole")?.value),
    };
    salvaTapparelle(list);
  },
  /* Il contatto sopravvive anche a una tapparella appena aggiunta: l'elenco lo
   * scrive il runtime, che di questo campo non sa niente, e la voce nasce senza.
   * Qui la si ritrova dalla sua entita' e le si posa accanto il contatto. */
  /* I campi in piu' sopravvivono anche a una tapparella appena aggiunta:
   * l'elenco lo scrive il runtime, che di queste caselle non sa niente, e la
   * voce nasce senza. Qui la si ritrova dalla sua entita' e glieli si posa
   * accanto. */
  () => {
    const extra = {
      contact: clean(doc.getElementById("ed-tp-contact")?.value),
      tenda: clean(doc.getElementById("ed-tp-tenda")?.value),
      tendaSole: clean(doc.getElementById("ed-tp-tendasole")?.value),
    };
    const entity = clean(doc.getElementById("ed-tp-ent")?.value);
    /* Un infisso puo' avere la sola tenda: pretendere la tapparella qui
     * significava non poterlo aggiungere affatto. */
    const qualcosa = entity || Object.values(extra).some(Boolean);
    if (!qualcosa) return null;
    /* Un infisso senza tapparella non e' un errore.
     *
     * La scheda dice «su una finestra ci stanno tutte e tre: compila le caselle
     * che hai», e poi il runtime — che di quelle caselle non sa niente — si
     * ferma su «Inserisci una entita' cover valida» perche' la sua e' vuota.
     * La riga la scrivevamo comunque noi un istante dopo, quindi si finiva con
     * un errore in faccia e la riga creata lo stesso: il modo peggiore di dire
     * che ha funzionato.
     *
     * Il rifiuto si zittisce solo quando sappiamo di poterlo smentire, cioe'
     * quando un'altra casella e' compilata, e solo per la durata di quella
     * chiamata. */
    const zittire = !entity;
    const avviso = zittire ? root.alert : null;
    if (zittire) {
      try {
        root.alert = () => {};
      } catch (_error) {}
    }
    return () => {
      if (zittire) {
        try {
          root.alert = avviso;
        } catch (_error) {}
      }
      const list = listFor("shutter");
      let index = -1;
      list.forEach((item, position) => {
        if (entity && clean(item?.entity) === entity) index = position;
      });
      /* Senza tapparella il runtime la riga non la scrive: la scriviamo noi,
       * in coda, con il nome e la stanza che erano nel modulo. */
      if (index < 0 && !entity) {
        list.push({
          name: clean(doc.getElementById("ed-tp-name")?.value),
          entity: "",
          room: clean(doc.getElementById("ed-tp-room")?.value),
        });
        index = list.length - 1;
      }
      if (index < 0) return;
      const uguale = Object.entries(extra).every(
        ([campo, valore]) => clean(list[index][campo]) === valore,
      );
      if (uguale) return;
      list[index] = { ...list[index], ...extra };
      salvaTapparelle(list);
    };
  });

  wrap("edStanzaRoomAdd", "room", (index) => {
    const list = listFor("room");
    list[index] = {
      ...(list[index] || {}),
      name: clean(doc.getElementById("ed-room-name")?.value),
      icon: clean(doc.getElementById("ed-room-icon")?.value) || "🏠",
      floor: clean(doc.getElementById("ed-room-floor")?.value),
    };
    if (!list[index].floor) delete list[index].floor;
    writeJsonIfChanged("cd_stanze", list);
    root.buildTempCards?.();
  });
}

function runContracts() {
  syncEditorTheme();
  normalizeReportEditor();
  ensureEditButtons();
  installAddWrappers();
}

function installStyles() {
  installStyle(
    "dm-editor-crud-section-style",
    `
      #editor-modal[data-dm-editor-theme="dark"]{--dm-editor-shell:#161f36;--dm-editor-panel:#1b2540;--dm-editor-control:#212d4c;--dm-editor-border:#31405f;--dm-editor-text:#edf4ff;--dm-editor-muted:#a8b7cf;background:rgba(3,7,18,.76)!important;color-scheme:dark}
      #editor-modal[data-dm-editor-theme="dark"] .ed-shell,#editor-modal[data-dm-editor-theme="dark"] .ed-head,#editor-modal[data-dm-editor-theme="dark"] .ed-body{background:var(--dm-editor-shell)!important;color:var(--dm-editor-text)!important;border-color:var(--dm-editor-border)!important}
      #editor-modal[data-dm-editor-theme="dark"] .ed-tabs,#editor-modal[data-dm-editor-theme="dark"] .ed-inner-tabs,#editor-modal[data-dm-editor-theme="dark"] .sub-tabs-energy,#editor-modal[data-dm-editor-theme="dark"] .ed-row,#editor-modal[data-dm-editor-theme="dark"] .dm-report-row,#editor-modal[data-dm-editor-theme="dark"] .ed-acc,#editor-modal[data-dm-editor-theme="dark"] .ed-acc-body{background:var(--dm-editor-panel)!important;color:var(--dm-editor-text)!important;border-color:var(--dm-editor-border)!important}
      #editor-modal[data-dm-editor-theme="dark"] input,#editor-modal[data-dm-editor-theme="dark"] select,#editor-modal[data-dm-editor-theme="dark"] textarea,#editor-modal[data-dm-editor-theme="dark"] .ed-input{background:var(--dm-editor-control)!important;color:var(--dm-editor-text)!important;border-color:var(--dm-editor-border)!important}
      #editor-modal[data-dm-editor-theme="dark"] .ed-row-old,#editor-modal[data-dm-editor-theme="dark"] .ed-intro,#editor-modal[data-dm-editor-theme="dark"] .ed-hint,#editor-modal[data-dm-editor-theme="dark"] .ed-empty{color:var(--dm-editor-muted)!important}

      /* Legacy configuration forms combine width:100% controls with flex rows
         and fixed icon/picker buttons. Every flex/grid boundary must be allowed
         to shrink, otherwise one long entity id expands the whole mobile modal. */
      #editor-modal .ed-shell,#editor-modal .ed-body,#editor-modal .ed-form,#editor-modal .ed-list,#editor-modal .ed-row,#editor-modal .ed-form-row{box-sizing:border-box!important;min-width:0!important;max-width:100%!important;width:100%!important}
      #editor-modal .ed-body{overflow-x:clip!important;overflow-y:visible!important}
      /* The body of every editor tab is a vertical stack of full-width controls.
         The entity-picker guard used to hand .dm-entity-picker-row — flex, with
         min-width:0 children — to the parent of any field it decorated, and on
         Tapparelle, Telecamere and Irrigazione that parent is this element, so
         the whole editor laid out as a row of narrow columns with words broken
         mid-syllable. The guard no longer flexes a container, and this pins the
         outcome: block with no columns is what the correct rendering already
         computes, so it changes nothing where the editor is right and makes
         that failure unreachable for any other owner. */
      #editor-modal .ed-body{display:block!important;columns:auto!important;column-count:auto!important}
      #editor-modal .ed-body>*{float:none!important}
      #editor-modal .ed-body>*,#editor-modal .ed-form>*,#editor-modal .ed-list>*,#editor-modal .ed-row>*,#editor-modal .ed-form-row>*,#editor-modal .ed-form [style*="display:flex"]>*{box-sizing:border-box!important;min-width:0!important;max-width:100%!important}
      #editor-modal .ed-form>[style*="display:flex"],#editor-modal .ed-form-row{box-sizing:border-box!important;min-width:0!important;max-width:100%!important;width:100%!important}
      #editor-modal .ed-form-row>.ed-input,#editor-modal .ed-form>[style*="display:flex"]>.ed-input{width:0!important;min-width:0!important;max-width:100%!important;flex:1 1 0!important}
      #editor-modal .ed-form input.ed-input,#editor-modal .ed-form select.ed-input,#editor-modal .ed-form textarea.ed-input{box-sizing:border-box!important;min-width:0!important;max-width:100%!important}
      #editor-modal #appl-name,#editor-modal #appl-ent{width:0!important;min-width:0!important;max-width:100%!important;flex:1 1 0!important}
      #editor-modal #appl-room{width:100%!important;min-width:0!important;max-width:100%!important}
      #editor-modal .ed-btn-add,#editor-modal .ed-btn,#editor-modal .ed-save-btn,#editor-modal .ed-form button{box-sizing:border-box!important;max-width:100%!important}
      #editor-modal .ed-intro,#editor-modal .ed-row-old,#editor-modal .ed-row-new{min-width:0!important;max-width:100%!important;overflow-wrap:anywhere!important;word-break:break-word!important}
      /* The label box only needs to be allowed to shrink. In a flex row that is
         already covered by flex-basis:0, and a hard width:0 would collapse the
         very same box on the grid rows other owners build (quick actions,
         rooms, temperature), hiding name and detail behind overflow:hidden. */
      #editor-modal .ed-row-main{min-width:0!important;max-width:100%!important;flex:1 1 0!important;overflow:hidden!important}
      #editor-modal .ed-list .ed-row{width:100%!important}

      /* Irrigation is legacy markup without an .ed-form wrapper. Force the
         whole editor back to a one-column mobile flow instead of inheriting an
         old grid/flex width that turns every sentence into vertical letters. */
      #editor-modal #ed-body:has(#ed-irr-ent){display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;overflow-x:hidden!important}
      #editor-modal #ed-body:has(#ed-irr-ent)>*{box-sizing:border-box!important;width:100%!important;max-width:100%!important;min-width:0!important;margin-left:0!important;margin-right:0!important;white-space:normal!important;overflow-wrap:normal!important;word-break:normal!important}
      #editor-modal #ed-body:has(#ed-irr-ent) .ed-intro,#editor-modal #ed-body:has(#ed-irr-ent) .ed-hint{display:block!important;width:100%!important;max-width:100%!important;white-space:normal!important;overflow-wrap:break-word!important;word-break:normal!important;line-height:1.45!important}
      #editor-modal #ed-body:has(#ed-irr-ent) div:has(>#ed-irr-ent),#editor-modal #ed-body:has(#ed-irr-ent) div:has(>#ed-irr-rain),#editor-modal #ed-body:has(#ed-irr-ent) div:has(>#ed-irr-weather){display:grid!important;grid-template-columns:minmax(0,1fr) 48px!important;gap:8px!important;align-items:center!important;width:100%!important;max-width:100%!important;min-width:0!important}
      #editor-modal #ed-body:has(#ed-irr-ent) div:has(>#ed-irr-room),#editor-modal #ed-body:has(#ed-irr-ent) div:has(>#ed-irr-min),#editor-modal #ed-body:has(#ed-irr-ent) div:has(>#ed-irr-thr),#editor-modal #ed-body:has(#ed-irr-ent) div:has(>#ed-irr-time){display:grid!important;grid-template-columns:minmax(0,1fr) minmax(84px,.42fr)!important;gap:8px!important;align-items:center!important;width:100%!important;max-width:100%!important;min-width:0!important}
      #editor-modal #ed-body:has(#ed-irr-ent) input,#editor-modal #ed-body:has(#ed-irr-ent) select,#editor-modal #ed-body:has(#ed-irr-ent) textarea,#editor-modal #ed-body:has(#ed-irr-ent) .ed-input{box-sizing:border-box!important;width:100%!important;max-width:100%!important;min-width:0!important;min-height:44px!important}
      #editor-modal #ed-body:has(#ed-irr-ent) button{box-sizing:border-box!important;min-width:44px!important;min-height:44px!important;max-width:100%!important;white-space:normal!important}
      #editor-modal #ed-body:has(#ed-irr-ent) .ed-btn-add,#editor-modal #ed-body:has(#ed-irr-ent) .ed-save-btn{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;max-width:100%!important;min-height:48px!important;margin:10px 0 0!important;padding:10px 12px!important}

      /* La riga del Report la impagina report-editor-section, che e' quella che
         le da' anche le aree: due griglie diverse sullo stesso elemento
         lasciavano le colonne di una e le aree dell'altra, ed era quello che si
         vedeva sballato. Qui resta solo cio' che non e' impaginazione. */
      #editor-modal [data-energy-panel="report"] .dm-report-row .dm-entity-field{min-width:0!important;margin:0!important}
      #editor-modal .dm-report-history-help{grid-column:1/-1;color:var(--secondary-text-color,#64748b);font-size:11px;line-height:1.4}
      #editor-modal .dm-report-row[data-history-valid="false"] .dm-report-history-help{color:var(--warning-color,#b45309);font-weight:800}
      #editor-modal .dm-edit-existing{background:color-mix(in srgb,var(--info-color,#0ea5e9) 14%,transparent)!important;color:var(--info-color,#0369a1)!important}
      #editor-modal .dm-edit-cancel{width:100%;margin-top:7px;background:var(--secondary-background-color,#e8eef5)!important;color:var(--text,#0f172a)!important}
      #editor-modal [data-dm-editing="true"]{outline:2px solid color-mix(in srgb,var(--info-color,#0ea5e9) 45%,transparent);outline-offset:2px}
      @media(max-width:900px){#editor-modal [data-energy-panel="report"] .dm-report-row{grid-template-columns:1fr 1fr!important}#editor-modal [data-energy-panel="report"] .dm-report-row .dm-entity-field,#editor-modal .dm-report-history-help{grid-column:1/-1!important}}
      @media(max-width:560px){
        #editor-modal .ed-shell{box-sizing:border-box!important;width:min(560px,calc(100% - 12px))!important;max-width:calc(100% - 12px)!important;margin-inline:auto!important}
        #editor-modal .ed-body{box-sizing:border-box!important;width:100%!important;padding-left:12px!important;padding-right:12px!important}
        #editor-modal .ed-form>[style*="display:flex"]{width:100%!important}
        #editor-modal [data-energy-panel="report"] .dm-report-row{grid-template-columns:1fr!important}
        #editor-modal [data-energy-panel="report"] .dm-report-row>*{grid-column:1!important}
        #editor-modal #ed-body:has(#ed-irr-ent) div:has(>#ed-irr-room),#editor-modal #ed-body:has(#ed-irr-ent) div:has(>#ed-irr-min),#editor-modal #ed-body:has(#ed-irr-ent) div:has(>#ed-irr-thr),#editor-modal #ed-body:has(#ed-irr-ent) div:has(>#ed-irr-time){grid-template-columns:1fr!important}
      }
    `,
  );
}

/* "sezioni" non e' piu' una scheda.
 *
 * L'editor aveva una sola scheda Sezioni; adesso ce n'e' una per sezione, da
 * sez0 a sez9, e il nome "sezioni" non corrisponde piu' a niente: editorSwitch
 * lo riconosce come nome vecchio e non ridisegna nulla, mentre la barra in alto
 * perde anche la scheda evidenziata.
 *
 * Ventiquattro punti del runtime lo chiamano ancora dopo aver aggiunto o
 * eliminato qualcosa. Premendo il cestino su un'unita' clima l'elenco restava
 * quello di prima, e il ridisegno parziale che segue lo lasciava sfasato: la
 * riga eliminata spariva, l'ultima compariva due volte, e il contatore in alto
 * diceva un numero che non tornava con nulla.
 *
 * Il nome vecchio viene tradotto nella scheda davvero aperta, cosi' l'elenco si
 * ridisegna dove si sta guardando. */
function retiredTabTarget() {
  const active = clean(doc?.querySelector("#editor-modal .ed-tab.active")?.dataset?.tab);
  if (active && active !== "sezioni") return active;
  const first = clean(
    doc?.querySelector('#editor-modal .ed-tab[data-tab^="sez"]')?.dataset?.tab,
  );
  return first && first !== "sezioni" ? first : "";
}

function installRetiredTabRepair() {
  const current = root.editorSwitch;
  if (typeof current !== "function" || current.__dmRetiredTabRepair) return false;
  function editorSwitchOwner(tab, ...rest) {
    if (clean(tab) === "sezioni") {
      const target = retiredTabTarget();
      if (target) return current.call(this, target, ...rest);
    }
    return current.call(this, tab, ...rest);
  }
  editorSwitchOwner.__dmRetiredTabRepair = true;
  editorSwitchOwner.__dmRetiredTabOriginal = current;
  root.editorSwitch = editorSwitchOwner;
  return true;
}

function installWrappers() {
  installRetiredTabRepair();
  onEditorRedraw("__dmCrudEditorSection", runContracts);
}

export function installEditorCrudSection() {
  if (!doc) return;
  installStyles();
  installWrappers();
  runContracts();
  if (!state.listeners) {
    state.listeners = true;
    doc.addEventListener(
      "click",
      (event) => {
        const edit = event.target?.closest?.("[data-dm-edit-kind]");
        if (edit) {
          event.preventDefault();
          event.stopPropagation();
          beginEdit(edit.dataset.dmEditKind, Number(edit.dataset.dmEditIndex));
          return;
        }
        if (event.target?.closest?.(".ed-tab,.sub-tab-btn,[data-energy-tab],[data-report-add]"))
          root.queueMicrotask?.(runContracts);
      },
      true,
    );
    root.addEventListener?.("dashboardmodern:legacy-ready", () => {
      installWrappers();
      runContracts();
    });
    root.addEventListener?.("pageshow", runContracts);
  }
  state.installed = true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEditorCrudSection, { once: true });
else installEditorCrudSection();
