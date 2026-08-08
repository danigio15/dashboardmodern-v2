import {
  clean,
  doc,
  english,
  installStyle,
  root,
  t,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_EDITOR_POLISH_SECTION__";
const state = (root[KEY] ||= { installed: false, frame: 0 });

function selectedOptionGlyph(select) {
  const option = select?.selectedOptions?.[0] || select?.options?.[select?.selectedIndex];
  const text = clean(option?.textContent || option?.label);
  if (!text) return "🔌";
  return text.split(/\s+/)[0] || "🔌";
}

export function syncApplianceEditorPreview(modal = doc?.getElementById("dm-appliance-editor-modal")) {
  const select = modal?.querySelector('select[name="icon"]');
  const preview = modal?.querySelector("[data-icon-preview]");
  if (!select || !preview) return false;
  const glyph = selectedOptionGlyph(select);
  let icon = preview.querySelector(".dm-appliance-menu-glyph");
  if (!icon) {
    icon = doc.createElement("span");
    icon.className = "dm-appliance-menu-glyph";
  }
  if (icon.textContent !== glyph) icon.textContent = glyph;
  preview.replaceChildren(icon);
  preview.dataset.dmPreviewSource = "dropdown";
  preview.setAttribute("aria-label", clean(select.selectedOptions?.[0]?.textContent) || glyph);

  const field = select.closest(".dm-appliance-icon-field");
  const help = field?.querySelector("small");
  if (help) {
    help.textContent = t(
      "L’icona nel riquadro segue esattamente il menu. La card usa l’illustrazione coordinata dello stesso tipo.",
      "The icon in the preview follows the menu exactly. The card uses the matching illustration for the same type.",
    );
  }
  return true;
}

function normalizeEnergyGuide() {
  const guide = doc?.querySelector("#editor-modal .dm-energy-source-guide");
  if (!guide) return false;
  const intro = guide.querySelector(".dm-energy-source-guide-intro");
  if (intro && intro.dataset.dmPolished !== "true") {
    intro.dataset.dmPolished = "true";
    intro.innerHTML = `<strong>⚡ ${t("Come leggere la configurazione Energia", "How to read the Energy configuration")}</strong>
      <div class="dm-energy-guide-steps">
        <span><b>1 · ${t("Storico e mesi precedenti", "History and previous months")}</b><small>${t("usa il contatore totale kWh tramite Recorder", "use the total kWh meter through Recorder")}</small></span>
        <span><b>2 · ${t("Giorno / Mese / Anno", "Day / Month / Year")}</b><small>${t("sono override facoltativi del singolo periodo", "are optional overrides for that period")}</small></span>
        <span><b>3 · ${t("Consumo Casa", "Home consumption")}</b><small>${t("usa il bilancio Home Assistant quando Fotovoltaico e Rete sono completi; Casa resta fallback", "uses the Home Assistant balance when Solar and Grid are complete; Home remains the fallback")}</small></span>
      </div>`;
  }

  guide.querySelectorAll(".dm-energy-source-contract").forEach((card) => {
    const group = clean(card.dataset.energySourceGroup);
    card.dataset.dmPolished = "true";
    const header = card.querySelector("header");
    let note = header?.querySelector(".dm-energy-contract-note");
    if (!note && header) {
      note = doc.createElement("small");
      note.className = "dm-energy-contract-note";
      header.append(note);
    }
    if (note) {
      note.textContent = group === "house"
        ? t("Fallback", "Fallback")
        : t("Storico + periodo", "History + period");
    }
  });
  return true;
}

function temperatureEditMode(form) {
  const cancel = form?.querySelector("[data-temperature-cancel]");
  if (cancel && !cancel.hidden) return true;
  const title = clean(form?.querySelector("[data-temperature-form-title]")?.textContent).toLowerCase();
  return /^(modifica|edit)\b/.test(title);
}

export function normalizeTemperatureEditorPolish() {
  const form = doc?.querySelector("#editor-modal [data-temperature-form]");
  if (!form) return false;
  const editing = temperatureEditMode(form);
  form.dataset.dmTemperatureMode = editing ? "edit" : "add";
  const submit = form.querySelector("[data-temperature-submit]");
  if (submit) {
    submit.classList.add("dm-temperature-submit");
    submit.textContent = editing
      ? english()
        ? "SAVE CHANGES"
        : "SALVA MODIFICHE"
      : english()
        ? "ASSOCIATE SENSORS"
        : "ASSOCIA SENSORI";
  }
  const title = form.querySelector("[data-temperature-form-title]");
  if (title) title.dataset.dmTemperatureMode = editing ? "edit" : "add";
  return true;
}

function normalizeLightsEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || clean(doc.querySelector(".ed-tab.active")?.dataset?.tab) !== "luci") return false;
  body.querySelectorAll(".dm-light-group").forEach((group) => {
    group.dataset.dmCompactEditor = "true";
  });
  body.querySelectorAll(".dm-light-row").forEach((row) => {
    row.dataset.dmCompactEditor = "true";
    const deleteButton = [...row.children].find(
      (node) => node.matches?.("button.ed-del:not(.dm-light-edit)"),
    );
    if (deleteButton) deleteButton.classList.add("dm-light-delete");
  });
  return true;
}

export function applyEditorPolish() {
  if (!doc) return false;
  normalizeEnergyGuide();
  syncApplianceEditorPreview();
  normalizeLightsEditor();
  normalizeTemperatureEditorPolish();
  return true;
}

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    applyEditorPolish();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
}

function installWrappers() {
  wrapFunction("editorSwitch", "__dmEditorPolishSection", schedule);
  wrapFunction("apriConfigEntita", "__dmEditorPolishOpen", schedule);
}

function installStyles() {
  installStyle(
    "dm-editor-polish-section-style",
    `
      /* Energy: translate the source contract into a readable visual hierarchy. */
      #editor-modal .dm-energy-source-guide{gap:14px!important}
      #editor-modal .dm-energy-source-guide-intro{padding:16px!important;gap:10px!important}
      #editor-modal .dm-energy-source-guide-intro>strong{font-size:15px!important}
      #editor-modal .dm-energy-guide-steps{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}
      #editor-modal .dm-energy-guide-steps>span{display:grid!important;align-content:start!important;gap:4px!important;padding:10px 11px!important;border-radius:12px!important;background:color-mix(in srgb,var(--ha-card-background,var(--card-bg,#fff)) 78%,transparent)!important;border:1px solid color-mix(in srgb,var(--info-color,#0ea5e9) 14%,transparent)!important}
      #editor-modal .dm-energy-guide-steps b{font-size:11px!important;color:var(--primary-text-color,var(--text,#0f172a))!important}
      #editor-modal .dm-energy-guide-steps small{font-size:10.5px!important;line-height:1.4!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important}
      #editor-modal .dm-energy-source-guide-grid{gap:12px!important}
      #editor-modal .dm-energy-source-contract{padding:14px!important;border-radius:16px!important}
      #editor-modal .dm-energy-source-contract header{display:grid!important;grid-template-columns:auto minmax(0,1fr) auto!important;gap:8px!important;align-items:center!important;margin-bottom:10px!important}
      #editor-modal .dm-energy-source-contract header>strong{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      #editor-modal .dm-energy-contract-note{padding:4px 7px!important;border-radius:999px!important;background:var(--secondary-background-color,#f1f5f9)!important;color:var(--secondary-text-color,#64748b)!important;font-size:9px!important;font-weight:900!important;white-space:nowrap!important}
      #editor-modal .dm-energy-source-contract dl{gap:0!important;border:1px solid var(--divider-color,#e2e8f0)!important;border-radius:12px!important;overflow:hidden!important}
      #editor-modal .dm-energy-source-contract dl>div{display:grid!important;grid-template-columns:96px minmax(0,1fr)!important;align-items:start!important;gap:10px!important;padding:9px 10px!important;border-bottom:1px solid var(--divider-color,#e2e8f0)!important}
      #editor-modal .dm-energy-source-contract dl>div:last-child{border-bottom:0!important}
      #editor-modal .dm-energy-source-contract dt{padding-top:1px!important;font-size:9.5px!important;line-height:1.3!important}
      #editor-modal .dm-energy-source-contract dd{overflow:visible!important;text-overflow:clip!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important;font-size:10.5px!important;line-height:1.45!important}

      /* Appliance editor: preview mirrors the native select glyph exactly. */
      #dm-appliance-editor-modal .dm-appliance-icon-preview[data-dm-preview-source="dropdown"]{background:linear-gradient(145deg,color-mix(in srgb,var(--info-color,#0ea5e9) 10%,var(--ha-card-background,#fff)),var(--ha-card-background,var(--card-bg,#fff)))!important}
      #dm-appliance-editor-modal .dm-appliance-menu-glyph{display:grid!important;place-items:center!important;width:100%!important;height:100%!important;font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;font-size:38px!important;line-height:1!important}
      #dm-appliance-editor-modal .dm-appliance-icon-field>small{font-size:11px!important;line-height:1.4!important;color:var(--secondary-text-color,#64748b)!important}

      /* Lights: compact card geometry instead of the legacy floating controls. */
      #editor-modal .dm-light-group{display:grid!important;gap:10px!important;margin:0 0 12px!important;padding:12px!important;border:1px solid var(--divider-color,#e2e8f0)!important;border-radius:16px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important}
      #editor-modal .dm-light-group>.ed-acc-head{min-height:40px!important;margin:0!important;padding:2px 4px 8px!important;border-bottom:1px solid var(--divider-color,#e2e8f0)!important}
      #editor-modal .dm-light-group>.ed-list{display:grid!important;gap:8px!important}
      #editor-modal .dm-light-row{box-sizing:border-box!important;width:100%!important;margin:0!important;padding:10px!important;border:1px solid color-mix(in srgb,var(--divider-color,#e2e8f0) 84%,transparent)!important;border-radius:13px!important;background:var(--secondary-background-color,#f8fafc)!important}
      #editor-modal .dm-light-add-form{box-sizing:border-box!important;margin-top:14px!important;padding:14px!important;border:1px dashed color-mix(in srgb,var(--info-color,#0ea5e9) 42%,var(--divider-color,#dbe4ee))!important;border-radius:16px!important;background:color-mix(in srgb,var(--info-color,#0ea5e9) 5%,transparent)!important}
      #editor-modal .dm-light-row>.ed-row-main{min-width:0!important}
      #editor-modal .dm-light-row>.ed-row-main .ed-row-new,#editor-modal .dm-light-row>.ed-row-main .ed-row-old{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      #editor-modal .dm-light-row>.dm-light-edit,#editor-modal .dm-light-row>.dm-light-delete{width:40px!important;height:40px!important;min-width:40px!important;margin:0!important;padding:0!important;border-radius:12px!important}

      /* Temperature: same card/form language as the other canonical editors. */
      #editor-modal [data-temperature-editor]{box-sizing:border-box!important;margin:0!important;padding:12px 14px!important;border:1px solid color-mix(in srgb,var(--info-color,#0ea5e9) 22%,var(--divider-color,#dbe4ee))!important;border-radius:14px!important;background:color-mix(in srgb,var(--info-color,#0ea5e9) 6%,transparent)!important;font-size:12px!important;line-height:1.45!important}
      #editor-modal [data-temperature-list]{display:grid!important;gap:8px!important;margin:0!important}
      #editor-modal .dm-temperature-card{display:grid!important;grid-template-columns:44px minmax(0,1fr) 40px 40px!important;align-items:center!important;gap:10px!important;box-sizing:border-box!important;width:100%!important;margin:0!important;padding:10px 11px!important;border:1px solid var(--divider-color,#e2e8f0)!important;border-radius:14px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important}
      #editor-modal .dm-temperature-card-icon{display:grid!important;place-items:center!important;width:40px!important;height:40px!important;border-radius:12px!important;background:color-mix(in srgb,var(--info-color,#0ea5e9) 10%,transparent)!important;font-size:21px!important}
      #editor-modal .dm-temperature-card .ed-row-main{min-width:0!important}
      #editor-modal .dm-temperature-card .ed-row-new{font-weight:900!important}
      #editor-modal .dm-temperature-card .ed-row-old{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      #editor-modal .dm-temperature-card>.ed-del{width:40px!important;height:40px!important;margin:0!important;padding:0!important;border-radius:12px!important}
      #editor-modal .dm-temperature-form{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;box-sizing:border-box!important;margin-top:4px!important;padding:14px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:17px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important}
      #editor-modal .dm-temperature-form>.ed-sec-title{grid-column:1/-1!important;margin:0!important;padding:0 0 9px!important;border-bottom:1px solid var(--divider-color,#e2e8f0)!important;font-size:15px!important;font-weight:900!important}
      #editor-modal .dm-temperature-form>.ed-slot{margin:0!important;min-width:0!important}
      #editor-modal .dm-temperature-form>.dm-temperature-floor{grid-column:1/-1!important;min-height:0!important;margin:-3px 0 0!important}
      #editor-modal .dm-temperature-form>.dm-entity-field{min-width:0!important}
      #editor-modal .dm-temperature-actions{grid-column:1/-1!important;display:flex!important;justify-content:flex-end!important;gap:9px!important;padding-top:2px!important}
      #editor-modal .dm-temperature-actions>button{min-height:42px!important;margin:0!important;padding:9px 14px!important;border-radius:12px!important;font-weight:900!important}
      #editor-modal .dm-temperature-form[data-dm-temperature-mode="edit"]{border-color:color-mix(in srgb,var(--info-color,#0ea5e9) 58%,var(--divider-color,#dbe4ee))!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--info-color,#0ea5e9) 7%,transparent)!important}
      #editor-modal .dm-temperature-form[data-dm-temperature-mode="edit"]>[data-temperature-form-title]{color:var(--info-color,#0369a1)!important}
      #editor-modal .dm-temperature-submit{background:linear-gradient(135deg,#0ea5e9,#0369a1)!important;color:#fff!important;border:0!important}

      #editor-modal[data-dm-editor-theme="dark"] .dm-energy-guide-steps>span,
      #editor-modal[data-dm-editor-theme="dark"] .dm-light-group,
      #editor-modal[data-dm-editor-theme="dark"] .dm-temperature-card,
      #editor-modal[data-dm-editor-theme="dark"] .dm-temperature-form{background:var(--dm-editor-panel,#1b2540)!important;border-color:var(--dm-editor-border,#31405f)!important}
      #editor-modal[data-dm-editor-theme="dark"] .dm-light-row{background:var(--surface-3,#212d4c)!important;border-color:var(--dm-editor-border,#31405f)!important}

      @media(max-width:820px){
        #editor-modal .dm-energy-guide-steps{grid-template-columns:1fr!important}
        #editor-modal .dm-energy-source-contract dl>div{grid-template-columns:112px minmax(0,1fr)!important}
      }
      @media(max-width:720px){
        #editor-modal .dm-light-row{display:grid!important;grid-template-columns:minmax(0,1fr) 40px 40px!important;grid-template-areas:"main edit delete" "room room room" "order order order"!important;gap:9px!important;min-height:0!important}
        #editor-modal .dm-light-row>.ed-row-main{grid-area:main!important;align-self:center!important}
        #editor-modal .dm-light-row>.dm-light-edit{grid-area:edit!important}
        #editor-modal .dm-light-row>.dm-light-delete{grid-area:delete!important}
        #editor-modal .dm-light-row>.dm-light-room{grid-area:room!important;width:100%!important;min-width:0!important;grid-column:auto!important;grid-row:auto!important}
        #editor-modal .dm-light-row>.dm-light-order{grid-area:order!important;display:flex!important;justify-content:flex-end!important;gap:6px!important}
        #editor-modal .dm-light-row>.dm-light-order>.ed-del{width:36px!important;height:32px!important;margin:0!important;padding:0!important;border-radius:10px!important}
        #editor-modal .dm-temperature-form{grid-template-columns:1fr!important;padding:12px!important}
        #editor-modal .dm-temperature-form>*{grid-column:1!important}
        #editor-modal .dm-temperature-actions{grid-column:1!important;justify-content:stretch!important}
        #editor-modal .dm-temperature-actions>button{flex:1 1 0!important}
      }
      @media(max-width:520px){
        #editor-modal .dm-energy-source-contract dl>div{grid-template-columns:1fr!important;gap:4px!important}
        #editor-modal .dm-energy-contract-note{display:none!important}
        #editor-modal .dm-temperature-card{grid-template-columns:40px minmax(0,1fr) 38px 38px!important;gap:8px!important;padding:9px!important}
        #editor-modal .dm-temperature-card-icon{width:36px!important;height:36px!important}
        #editor-modal .dm-temperature-card>.ed-del{width:38px!important;height:38px!important}
      }
    `,
  );
}

function bindEvents() {
  if (state.installed) return;
  state.installed = true;
  doc.addEventListener(
    "input",
    (event) => {
      if (event.target?.matches?.('#dm-appliance-editor-modal select[name="icon"]'))
        syncApplianceEditorPreview();
    },
    false,
  );
  doc.addEventListener(
    "change",
    (event) => {
      if (event.target?.matches?.('#dm-appliance-editor-modal select[name="icon"]'))
        root.queueMicrotask?.(syncApplianceEditorPreview);
      schedule();
    },
    false,
  );
  doc.addEventListener("click", () => root.setTimeout?.(schedule, 0), false);
  for (const event of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready", "pageshow"])
    root.addEventListener?.(event, schedule);
}

export function installEditorPolishSection() {
  if (!doc) return;
  installStyles();
  installWrappers();
  bindEvents();
  schedule();
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEditorPolishSection, { once: true });
else installEditorPolishSection();
