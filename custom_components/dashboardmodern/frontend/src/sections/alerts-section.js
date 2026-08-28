import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  lexicalGlobal,
  onEditorRedraw,
  readJson,
  root,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ALERTS_SECTION__";
const state = (root[KEY] ||= { installed: false, listeners: false });

/* I gruppi del Quadro Avvisi, chiamati come li chiama la plancia.
 *
 * Questa finestra offriva un elenco suo — Sicurezza, Elettrodomestici, Altro —
 * che nel Quadro Avvisi non esiste: le liste sorvegliate sono Aperture,
 * Batterie, Luci, Clima e Riscaldamento. Un avviso delle Aperture non trovava
 * quindi il proprio gruppo nell'elenco, veniva salvato sotto "Altro" e al
 * riavvio spariva, perche' al caricamento nessuno legge un gruppo che non
 * esiste. Le chiavi qui sotto sono le stesse del runtime, e le etichette sono
 * quelle stampate sulle intestazioni, cosi' una riga si riconosce da dove si
 * trova. */
const GROUPS = Object.freeze([
  ["win", "🚪", "Aperture", "Openings"],
  ["batt", "🔋", "Batterie", "Batteries"],
  ["luci", "💡", "Luci", "Lights"],
  ["clima", "❄️", "Clima", "Climate"],
  ["risc", "🔥", "Riscaldamento", "Heating"],
  /* Una perdita d'acqua non e' il caso particolare di qualcun altro: e' una
   * delle cose per cui si guarda il Quadro Avvisi. La lista la tiene
   * `flood-alerts-section.js`, che le da' la card e il popup; qui c'e' la voce
   * che la fa scegliere quando si configura un avviso. */
  ["allag", "💧", "Allagamenti", "Floods"],
]);

/** Le chiavi che il Quadro Avvisi sorveglia davvero. */
const GROUP_KEYS = new Set(GROUPS.map(([key]) => key));

function groupIcon(group) {
  return GROUPS.find(([key]) => key === clean(group))?.[1] || "🔔";
}

/* Dove sta scritta l'icona di un avviso, quando non e' quella del gruppo.
 *
 * Prima l'icona la decideva il gruppo e basta: tutte le aperture erano una
 * porta, comprese le finestre. Chi ha undici aperture si ritrovava undici
 * volte lo stesso disegno, e la finestra del bagno non si distingueva dalla
 * portafinestra del salotto. Una casella sola, `entita' -> icona`: chi non la
 * scrive continua a vedere quella del gruppo, come prima. */
const ICONS_KEY = "cd_avvisi_icone";

/** L'icona di un avviso: la sua se ce l'ha, quella del gruppo altrimenti. */
export function alertIcon(entity, group) {
  const scelte = readJson(ICONS_KEY, {}) || {};
  return clean(scelte[clean(entity)]) || groupIcon(group);
}

/* Chi si e' aggiunto non puo' essere anche uno che si e' tolto.
 *
 * Le due liste sono `cd_gruppi_extra` — quello che l'utente ha aggiunto — e
 * `cd_gruppi_removed` — quello che ha tolto, anche fra le voci di serie. Il
 * guscio le legge in quest'ordine: prima somma le aggiunte, poi toglie le
 * rimozioni. Ma chi aggiunge non ripulisce mai la seconda lista: un'apertura
 * tolta una volta e rimessa dopo finiva in tutte e due, e la sottrazione
 * arrivava per ultima. In quel giro si vedeva — l'aggiunta entra anche in
 * memoria — e al riavvio spariva. E' il «non riesco piu' ad aggiungerne
 * altre»: si aggiungevano davvero, e non tornavano piu' su.
 *
 * Le due liste non possono dire il contrario l'una dell'altra. Se un'entita'
 * sta in tutt'e due, ha ragione l'aggiunta: e' l'ultimo gesto che l'utente ha
 * fatto apposta. Qui si ripulisce, e si rimette la voce anche nella lista viva
 * cosi' non si deve ricaricare la pagina per vederla. */
export function riparaAggiunteTolte() {
  const extras = readJson("cd_gruppi_extra", {}) || {};
  const removed = readJson("cd_gruppi_removed", {}) || {};
  const rimesse = [];
  let cambiato = false;
  for (const [gruppo, tolti] of Object.entries(removed)) {
    if (!Array.isArray(tolti) || !tolti.length) continue;
    const aggiunti = Array.isArray(extras[gruppo]) ? extras[gruppo] : [];
    if (!aggiunti.length) continue;
    const restano = tolti.filter((entity) => !aggiunti.includes(entity));
    if (restano.length === tolti.length) continue;
    for (const entity of tolti) if (aggiunti.includes(entity)) rimesse.push([gruppo, entity]);
    removed[gruppo] = restano;
    cambiato = true;
  }
  if (!cambiato) return false;
  writeJsonIfChanged("cd_gruppi_removed", removed);
  try {
    const gruppi = lexicalGlobal("GRUPPI_MONITORAGGIO");
    for (const [gruppo, entity] of rimesse) {
      const lista = gruppi?.[gruppo];
      if (Array.isArray(lista) && !lista.includes(entity)) lista.push(entity);
    }
  } catch (_error) {}
  return true;
}

function configuredGroups() {
  const extras = readJson("cd_gruppi_extra", {});
  const removed = readJson("cd_gruppi_removed", {});
  const lights = Object.keys(readJson("cd_luci", {})).filter((id) => id.includes("."));
  extras.luci = [...new Set([...(extras.luci || []), ...lights])].filter(
    (id) => !(removed.luci || []).includes(id),
  );
  writeJsonIfChanged("cd_gruppi_extra", extras, { sync: false });
  return { extras, removed, names: readJson("cd_avvisi_names_extra", {}) };
}

/* Il gruppo di una riga si legge dall'intestazione sotto cui sta; se
 * l'intestazione non dice niente, si guarda dove l'entita' e' gia' registrata.
 * Un gruppo inventato per riempire il vuoto era il modo in cui l'avviso si
 * perdeva, quindi quando non si sa si risponde "non si sa". */
function groupFromRow(row) {
  const stored = clean(row.dataset.alertGroup);
  if (GROUP_KEYS.has(stored)) return stored;
  const summary = clean(row.closest("details")?.querySelector("summary")?.textContent).toLowerCase();
  const found = GROUPS.find(([, , it, en]) =>
    [it, en].some((label) => summary.includes(label.toLowerCase())),
  );
  if (found) return found[0];
  const entity = rowEntity(row);
  return entity ? groupOfEntity(entity) : "";
}

/** Il gruppo in cui l'entita' e' gia' registrata, "" se non ce n'e' nessuno. */
function groupOfEntity(entity) {
  const extras = readJson("cd_gruppi_extra", {}) || {};
  const found = GROUPS.map(([key]) => key).find((key) =>
    (Array.isArray(extras[key]) ? extras[key] : []).includes(entity),
  );
  return found || "";
}

function extractEntityId(value) {
  const matches = clean(value).match(/\b[a-z_]+\.[a-z0-9_]+\b/gi);
  return matches?.at(-1) || "";
}

function rowEntity(row) {
  return (
    extractEntityId(row.dataset.alertEntity) ||
    extractEntityId(row.querySelector(".ed-row-old")?.textContent) ||
    extractEntityId(row.textContent)
  );
}

function rowName(row, entity) {
  return (
    clean(row.querySelector(".ed-row-new")?.textContent).replace(/^[^\p{L}\p{N}]+/u, "") ||
    clean(readJson("cd_avvisi_names_extra", {})[entity]) ||
    clean(allStates()[entity]?.attributes?.friendly_name) ||
    entity
  );
}

function groupOptions(selected) {
  return GROUPS.map(
    ([key, icon, it, en]) =>
      `<option value="${key}" ${key === selected ? "selected" : ""}>${icon} ${t(it, en)}</option>`,
  ).join("");
}

function persistAlert({ oldEntity, oldGroup, entity, group, name, icon }) {
  const { extras, removed, names } = configuredGroups();
  /* Senza un gruppo valido non si sposta niente: prima si finiva in una lista
   * che nessuno sorveglia, e l'avviso spariva al riavvio. */
  if (!GROUP_KEYS.has(group)) group = GROUP_KEYS.has(oldGroup) ? oldGroup : "";
  if (!group) return;
  for (const key of Object.keys(extras))
    extras[key] = (Array.isArray(extras[key]) ? extras[key] : []).filter(
      (item) => item !== oldEntity && item !== entity,
    );
  for (const key of Object.keys(removed))
    removed[key] = (Array.isArray(removed[key]) ? removed[key] : []).filter(
      (item) => item !== entity,
    );
  extras[group] = [...new Set([...(extras[group] || []), entity])];
  if (oldGroup && oldGroup !== group)
    removed[oldGroup] = [...new Set([...(removed[oldGroup] || []), oldEntity])];
  if (oldEntity !== entity) delete names[oldEntity];
  names[entity] = name;
  /* L'icona si scrive solo se e' diversa da quella del gruppo: cosi' chi non
   * la tocca continua a seguire il gruppo anche se il gruppo cambia idea. */
  const icone = readJson(ICONS_KEY, {}) || {};
  if (oldEntity !== entity) delete icone[oldEntity];
  const scelta = clean(icon);
  if (scelta && scelta !== groupIcon(group)) icone[entity] = scelta;
  else delete icone[entity];
  let changed = false;
  changed = writeJsonIfChanged(ICONS_KEY, icone, { sync: false }) || changed;
  changed = writeJsonIfChanged("cd_gruppi_extra", extras, { sync: false }) || changed;
  changed = writeJsonIfChanged("cd_gruppi_removed", removed, { sync: false }) || changed;
  changed = writeJsonIfChanged("cd_avvisi_names_extra", names, { sync: false }) || changed;
  if (changed) {
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  }
}

function syncAlertVisual(form) {
  const icon = clean(form.elements.icon?.value) || groupIcon(form.elements.group.value);
  const preview = form.querySelector("[data-alert-group-preview]");
  if (preview) preview.textContent = icon;
  const header = form.closest(".dm-section-dialog")?.querySelector("[data-alert-header-icon]");
  if (header) header.textContent = icon;
}

export function openAlertEditor(row) {
  const oldEntity = rowEntity(row);
  if (!oldEntity) return;
  const oldGroup = groupFromRow(row);
  doc?.getElementById("dm-alert-editor-modal")?.remove();
  const modal = doc.createElement("div");
  modal.id = "dm-alert-editor-modal";
  modal.className = "dm-section-modal";
  modal.innerHTML = `<section class="dm-section-dialog" role="dialog" aria-modal="true" aria-labelledby="dm-alert-editor-title">
    <header><strong id="dm-alert-editor-title"><span data-alert-header-icon aria-hidden="true">${groupIcon(oldGroup)}</span> ${t("Modifica avviso", "Edit alert")}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></header>
    <form data-form>
      <label class="ed-slot"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><input class="ed-input" name="name" value="${esc(rowName(row, oldEntity))}" required></label>
      <label class="ed-slot"><span class="ed-slot-lbl">${t("Entità Home Assistant", "Home Assistant entity")}</span><span class="ed-form-row"><input class="ed-input mono" name="entity" value="${esc(oldEntity)}" required><button type="button" class="dm-entity-picker" data-pick>🔍</button></span></label>
      <label class="ed-slot"><span class="ed-slot-lbl">${t("Gruppo avviso", "Alert group")}</span><span class="dm-alert-group-row"><span class="dm-alert-group-preview" data-alert-group-preview aria-hidden="true">${esc(alertIcon(oldEntity, oldGroup))}</span><select class="ed-input" name="group">${groupOptions(oldGroup)}</select></span><small>${t("Il gruppo decide dove l’avviso viene sorvegliato.", "The group decides where the alert is watched.")}</small></label>
      <label class="ed-slot"><span class="ed-slot-lbl">${t("Icona", "Icon")}</span><span class="ed-form-row"><input class="ed-input" id="dm-alert-icon" name="icon" value="${esc(alertIcon(oldEntity, oldGroup))}" maxlength="8" autocomplete="off"><button type="button" class="dm-entity-picker" data-pick-icon aria-label="${t("Scegli l’icona", "Pick the icon")}">🔍</button></span><small>${t("Lasciala uguale a quella del gruppo per seguirlo; cambiala per distinguere questa apertura dalle altre.", "Leave it as the group icon to follow it; change it to tell this opening from the others.")}</small></label>
      <output data-error></output>
      <footer><button type="button" class="ed-btn-add" data-cancel>${t("Annulla", "Cancel")}</button><button type="submit" class="ed-save-btn">💾 ${t("Salva modifiche", "Save changes")}</button></footer>
    </form>
  </section>`;
  doc.body.append(modal);
  const form = modal.querySelector("[data-form]");
  const close = () => modal.remove();
  modal.querySelectorAll("[data-close],[data-cancel]").forEach((button) => button.addEventListener("click", close));
  modal.querySelector("[data-pick]").addEventListener("click", () => root.wzPickEntity?.(form.elements.entity));
  form.elements.group.addEventListener("change", () => {
    /* Chi non ha scelto un'icona sua continua a seguire il gruppo: cambiando
     * gruppo si aggiorna anche il campo. Chi una scelta l'ha fatta se la
     * tiene — cambiare gruppo non e' un modo per dire «ridammi la porta». */
    const campo = form.elements.icon;
    if (campo && clean(campo.value) === groupIcon(oldGroup))
      campo.value = groupIcon(form.elements.group.value);
    syncAlertVisual(form);
  });
  form.elements.icon?.addEventListener("input", () => syncAlertVisual(form));
  modal.querySelector("[data-pick-icon]")?.addEventListener("click", () => {
    root.dmIconPicker?.("#dm-alert-icon");
    /* Il selettore del guscio scrive nel campo e non avvisa nessuno: si
     * ricontrolla per un attimo, cosi' l'anteprima segue la scelta. */
    for (const attesa of [120, 400, 900, 1600])
      root.setTimeout?.(() => syncAlertVisual(form), attesa);
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = clean(form.elements.name.value);
    const entity = extractEntityId(form.elements.entity.value);
    const group = clean(form.elements.group.value) || oldGroup;
    const error = form.querySelector("[data-error]");
    if (!name || !/^[a-z_]+\.[a-z0-9_]+$/i.test(entity)) {
      error.textContent = t("Inserisci un nome e un'entità valida.", "Enter a name and a valid entity.");
      return;
    }
    persistAlert({
      oldEntity,
      oldGroup,
      entity,
      group,
      name,
      icon: clean(form.elements.icon?.value),
    });
    close();
    root.editorSwitch?.("avvisi");
    root.queueMicrotask?.(normalizeAlertsEditor);
  });
}

export function normalizeAlertsEditor() {
  // La scheda degli avvisi non ha piu' una linguetta sua: vive in fondo a
  // quella dei widget. Chiedere «quale linguetta e' attiva» non dice piu'
  // niente; chiedere se la scheda e' in scena, si'.
  if (!doc?.getElementById("ed-avv-grp")) return false;
  const body = doc.getElementById("ed-body");
  if (!body) return false;
  riparaAggiunteTolte();
  body.querySelectorAll(".ed-row").forEach((row) => {
    const entity = rowEntity(row);
    if (!entity) {
      const label = clean(row.querySelector(".ed-row-new")?.textContent);
      if (!label) row.remove();
      return;
    }
    row.dataset.alertEntity = entity;
    row.dataset.alertGroup = groupFromRow(row);
    if (row.querySelector("[data-dm-alert-edit]")) return;
    const edit = doc.createElement("button");
    edit.type = "button";
    edit.className = "ed-del dm-alert-edit";
    edit.dataset.dmAlertEdit = "true";
    edit.textContent = "✏️";
    edit.setAttribute("aria-label", t("Modifica avviso", "Edit alert"));
    const remove = [...row.querySelectorAll(".ed-del")].at(-1);
    remove?.before(edit);
  });
  return true;
}

function clearAlertsAfterReset() {
  doc?.getElementById("dm-alert-editor-modal")?.remove();
  if (doc?.getElementById("ed-avv-grp")) {
    const body = doc.getElementById("ed-body");
    if (body) body.replaceChildren();
  }
}

function installStyles() {
  installStyle(
    "dm-alerts-section-style",
    `
      #editor-modal .dm-alert-edit{background:color-mix(in srgb,var(--info-color,#0ea5e9) 14%,transparent)!important;color:var(--info-color,#0369a1)!important}
      #editor-modal .dm-alert-row,#editor-modal .ed-tab[data-tab="todo"]~#ed-body .ed-row{min-width:0!important}
      .dm-alert-group-row{display:grid!important;grid-template-columns:72px minmax(0,1fr)!important;gap:12px!important;align-items:center!important}
      .dm-alert-group-preview{display:grid!important;place-items:center!important;width:72px!important;height:72px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:18px!important;background:var(--secondary-background-color,#eef3f8)!important;font-size:34px!important}
    `,
  );
}

export function installAlertsSection() {
  if (!doc) return;
  installStyles();
  /* Le due liste si rimettono d'accordo appena la plancia si apre, non solo
   * quando si va in configurazione: chi l'apertura l'aveva rimessa deve
   * ritrovarla in Home senza passare da nessuna scheda. */
  riparaAggiunteTolte();
  for (const attesa of [400, 1500]) root.setTimeout?.(riparaAggiunteTolte, attesa);
  onEditorRedraw("__dmAlertsSection", normalizeAlertsEditor);
  normalizeAlertsEditor();
  if (!state.listeners) {
    state.listeners = true;
    doc.addEventListener(
      "click",
      (event) => {
        const edit = event.target?.closest?.("[data-dm-alert-edit]");
        if (edit) {
          event.preventDefault();
          event.stopPropagation();
          openAlertEditor(edit.closest(".ed-row"));
          return;
        }
        if (event.target?.closest?.(".ed-tab[data-tab='todo']"))
          root.queueMicrotask?.(normalizeAlertsEditor);
      },
      true,
    );
    root.addEventListener?.("dashboardmodern:legacy-ready", normalizeAlertsEditor);
    root.addEventListener?.("dashboardmodern:config-reset", clearAlertsAfterReset);
  }
  state.installed = true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installAlertsSection, { once: true });
else installAlertsSection();
