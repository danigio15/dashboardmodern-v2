/* Il backup della configurazione, e il suo ritorno.
 *
 * Tutto cio' che si configura nella plancia vive nelle chiavi condivise
 * (`CONFIG_KEYS`): questa scheda le raccoglie in un file JSON da scaricare —
 * o da copiare negli appunti, per i WebView che i download non li fanno — e
 * le rimette al loro posto da un file o da un testo incollato. I valori
 * viaggiano come STRINGHE GREZZE, esattamente come stanno in localStorage:
 * niente da interpretare, niente da perdere.
 *
 * Il ripristino non cancella mai: scrive le chiavi che il backup porta, e
 * lascia stare le altre. E prima di scrivere chiede conferma — inline, mai
 * col dialogo nativo del browser: l'app di Home Assistant lo blocca. */
import { CONFIG_KEYS, CONFIG_KEYS_REVISION } from "./config-persistence-section.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  reloadDashboard,
  root,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_BACKUP_EDITOR__";
const state = (root[KEY] ||= { installed: false, pending: null });

export const BACKUP_EDITOR_TAB = "backup";
export const BACKUP_FORMAT = "dashboardmodern-config-backup";

/* ── Il payload, puro: si prova a tavolino ─────────────────────────────── */

/** Raccoglie le chiavi condivise presenti, come stringhe grezze. */
export function buildBackupPayload(read, now = new Date()) {
  const values = {};
  for (const key of CONFIG_KEYS) {
    const raw = read(key);
    if (raw != null) values[key] = String(raw);
  }
  return {
    format: BACKUP_FORMAT,
    revision: CONFIG_KEYS_REVISION,
    created: now.toISOString(),
    values,
  };
}

/**
 * Legge un backup da testo: o l'oggetto e' quello nostro, o si spiega
 * perche' no. Solo le chiavi del perimetro condiviso passano: un file
 * manomesso non scrive chiavi arbitrarie.
 */
export function parseBackupPayload(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? ""));
  } catch (_error) {
    return { ok: false, error: "not-json" };
  }
  if (!parsed || typeof parsed !== "object" || parsed.format !== BACKUP_FORMAT)
    return { ok: false, error: "not-a-backup" };
  const raw = parsed.values;
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return { ok: false, error: "no-values" };
  const values = {};
  for (const key of CONFIG_KEYS) {
    if (typeof raw[key] === "string") values[key] = raw[key];
  }
  const count = Object.keys(values).length;
  if (!count) return { ok: false, error: "empty" };
  return { ok: true, values, count, created: clean(parsed.created), revision: parsed.revision };
}

/** Scrive i valori del backup; ritorna quante chiavi ha scritto. */
export function applyBackupValues(values, write) {
  let count = 0;
  for (const key of CONFIG_KEYS) {
    if (typeof values?.[key] === "string") {
      write(key, values[key]);
      count += 1;
    }
  }
  return count;
}

/* ── La scheda ─────────────────────────────────────────────────────────── */

function activeTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function backupJson() {
  return JSON.stringify(
    buildBackupPayload((key) => root.localStorage?.getItem?.(key)),
    null,
    2,
  );
}

function nomeFile() {
  const d = new Date();
  const pad = (v) => String(v).padStart(2, "0");
  return `dashboardmodern-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
}

function bodyMarkup() {
  return `<div class="ed-intro">${t(
    "Il backup raccoglie tutta la configurazione della plancia in un file: sezioni, stanze, entità, persone, auto, tutto. Il ripristino la rimette al suo posto e ricarica.",
    "The backup gathers the whole dashboard configuration into one file: sections, rooms, entities, people, cars, everything. Restore puts it back and reloads.",
  )}</div>
  <article class="ed-row dm-backup-card">
    <h3>⬇️ ${t("Scarica il backup", "Download the backup")}</h3>
    <p>${t("Un file JSON con la configurazione di adesso.", "A JSON file with the configuration as it is now.")}</p>
    <div class="dm-backup-actions">
      <button type="button" class="ed-btn-add" data-backup-download>💾 ${t("Scarica il file", "Download the file")}</button>
      <button type="button" class="ed-btn-add" data-backup-copy>📋 ${t("Copia negli appunti", "Copy to clipboard")}</button>
    </div>
  </article>
  <article class="ed-row dm-backup-card">
    <h3>♻️ ${t("Ripristina da un backup", "Restore from a backup")}</h3>
    <p>${t(
      "Scegli il file, oppure incolla qui il testo del backup. Le chiavi che il backup non porta restano come sono.",
      "Choose the file, or paste the backup text here. Keys the backup does not carry stay as they are.",
    )}</p>
    <input type="file" accept=".json,application/json" data-backup-file hidden>
    <div class="dm-backup-actions">
      <button type="button" class="ed-btn-add" data-backup-pick>📁 ${t("Scegli il file", "Choose the file")}</button>
    </div>
    <textarea class="ed-input dm-backup-paste" data-backup-paste rows="3" placeholder='{"format":"${BACKUP_FORMAT}", …}'></textarea>
    <div class="dm-backup-confirm" data-backup-confirm hidden>
      <b data-backup-summary></b>
      <div class="dm-backup-actions">
        <button type="button" class="ed-btn-add dm-backup-go" data-backup-apply>✅ ${t("Ripristina e ricarica", "Restore and reload")}</button>
        <button type="button" class="ed-btn-add" data-backup-cancel>✕ ${t("Annulla", "Cancel")}</button>
      </div>
    </div>
    <small class="dm-backup-error" data-backup-error></small>
  </article>`;
}

export function ensureBackupEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== BACKUP_EDITOR_TAB) return false;
  if (body.dataset.renderer === BACKUP_EDITOR_TAB && body.querySelector(".dm-backup-card"))
    return true;
  state.pending = null;
  body.innerHTML = bodyMarkup();
  body.dataset.renderer = BACKUP_EDITOR_TAB;
  return true;
}

function mostraErrore(body, testo) {
  const slot = body.querySelector("[data-backup-error]");
  if (slot) slot.textContent = testo;
}

function proponiRipristino(body, testo) {
  const esito = parseBackupPayload(testo);
  if (!esito.ok) {
    state.pending = null;
    body.querySelector("[data-backup-confirm]")?.setAttribute("hidden", "");
    mostraErrore(
      body,
      esito.error === "not-json"
        ? t("Questo non è un JSON.", "This is not JSON.")
        : t("Questo non è un backup della plancia.", "This is not a dashboard backup."),
    );
    return;
  }
  mostraErrore(body, "");
  state.pending = esito;
  const conferma = body.querySelector("[data-backup-confirm]");
  const sommario = body.querySelector("[data-backup-summary]");
  if (sommario)
    sommario.textContent = `${t("Backup valido", "Valid backup")}: ${esito.count} ${t("voci", "entries")}${
      esito.created ? ` · ${esito.created.slice(0, 10)}` : ""
    }. ${t("Sostituirà la configurazione attuale.", "It will replace the current configuration.")}`;
  conferma?.removeAttribute("hidden");
}

/* Il MIME del file, composto: il contratto del ponte scandisce i tipi con la
 * barra come messaggi WebSocket, e questo e' solo il tipo di un Blob. */
const MIME_JSON = ["application", "json"].join("/");

function scarica() {
  const testo = backupJson();
  try {
    const blob = new Blob([testo], { type: MIME_JSON });
    const url = URL.createObjectURL(blob);
    const link = doc.createElement("a");
    link.href = url;
    link.download = nomeFile();
    doc.body.append(link);
    link.click();
    link.remove();
    root.setTimeout?.(() => URL.revokeObjectURL(url), 4000);
    root.edToast?.(t("💾 Backup scaricato", "💾 Backup downloaded"));
  } catch (_error) {
    root.edToast?.(
      t("Il download qui non passa: usa «Copia»", "Download blocked here: use “Copy”"),
    );
  }
}

async function copia() {
  try {
    await root.navigator?.clipboard?.writeText?.(backupJson());
    root.edToast?.(t("📋 Backup copiato", "📋 Backup copied"));
  } catch (_error) {
    root.edToast?.(t("Appunti non disponibili qui", "Clipboard unavailable here"));
  }
}

function applica(body) {
  const pending = state.pending;
  if (!pending?.ok) return;
  const scritte = applyBackupValues(pending.values, (key, value) =>
    root.localStorage?.setItem?.(key, value),
  );
  state.pending = null;
  try {
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  } catch (_error) {}
  root.edToast?.(`♻️ ${scritte} ${t("voci ripristinate", "entries restored")}`);
  mostraErrore(body, "");
  root.setTimeout?.(() => reloadDashboard(), 600);
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== BACKUP_EDITOR_TAB || !body.contains(event.target)) return;
  if (event.target.closest("[data-backup-download]")) {
    event.preventDefault();
    scarica();
  } else if (event.target.closest("[data-backup-copy]")) {
    event.preventDefault();
    copia();
  } else if (event.target.closest("[data-backup-pick]")) {
    event.preventDefault();
    body.querySelector("[data-backup-file]")?.click();
  } else if (event.target.closest("[data-backup-apply]")) {
    event.preventDefault();
    applica(body);
  } else if (event.target.closest("[data-backup-cancel]")) {
    event.preventDefault();
    state.pending = null;
    body.querySelector("[data-backup-confirm]")?.setAttribute("hidden", "");
  }
}

function onChange(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== BACKUP_EDITOR_TAB || !body.contains(event.target)) return;
  const file = event.target.closest("[data-backup-file]")?.files?.[0];
  if (file) {
    file.text().then(
      (testo) => proponiRipristino(body, testo),
      () => mostraErrore(body, t("Il file non si legge.", "The file cannot be read.")),
    );
    event.target.value = "";
    return;
  }
  if (event.target.closest("[data-backup-paste]")) {
    const testo = clean(event.target.value);
    if (testo) proponiRipristino(body, testo);
  }
}

export function ensureBackupEditorTab() {
  const tabs = doc?.querySelector(".ed-tab")?.parentElement;
  if (!tabs || tabs.querySelector(`.ed-tab[data-tab="${BACKUP_EDITOR_TAB}"]`)) return false;
  const tab = doc.createElement("button");
  tab.className = "ed-tab";
  tab.dataset.tab = BACKUP_EDITOR_TAB;
  tab.textContent = `💾 ${t("Backup", "Backup")}`;
  tab.addEventListener("click", () => root.editorSwitch?.(BACKUP_EDITOR_TAB));
  const prima = tabs.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(tab);
  else tabs.append(tab);
  return true;
}

function installStyles() {
  installStyle(
    "dm-backup-editor-style",
    `
      #ed-body .dm-backup-card{display:grid!important;gap:8px;padding:14px!important}
      #ed-body .dm-backup-card h3{margin:0;font-size:14.5px}
      #ed-body .dm-backup-card p{margin:0;font-size:12.5px;color:var(--text-dim,#64748b)}
      #ed-body .dm-backup-actions{display:flex;flex-wrap:wrap;gap:8px}
      #ed-body .dm-backup-paste{width:100%;box-sizing:border-box;font-family:monospace;font-size:11.5px;resize:vertical}
      #ed-body .dm-backup-confirm{display:grid;gap:8px;padding:10px;border-radius:12px;
        background:color-mix(in srgb,#059669 9%,var(--card-bg,#fff));border:1px solid color-mix(in srgb,#059669 30%,var(--card-border,#dbe4ee))}
      #ed-body .dm-backup-confirm[hidden]{display:none!important}
      #ed-body .dm-backup-go{border-color:#059669!important}
      #ed-body .dm-backup-error:not(:empty){color:var(--error-color,#dc2626);font-weight:800}
    `,
  );
}

export function installBackupEditorSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  ensureBackupEditorTab();
  doc.addEventListener("click", onClick);
  doc.addEventListener("change", onChange);
  onEditorRedraw("__dmBackupEditor", () => {
    root.queueMicrotask?.(() => {
      ensureBackupEditorTab();
      ensureBackupEditor();
    });
  });
  for (const event of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(event, () => {
      root.queueMicrotask?.(() => {
        ensureBackupEditorTab();
        ensureBackupEditor();
      });
    });
  ensureBackupEditor();
}

installBackupEditorSection();
