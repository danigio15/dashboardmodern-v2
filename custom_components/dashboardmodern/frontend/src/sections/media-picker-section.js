/* Sfoglia le cartelle di Home Assistant, invece di scrivere il percorso.
 *
 * La foto dell'auto si impostava digitando "/local/qualcosa.png": bisognava
 * sapere che /config/www si chiama /local, come si chiama il file e come si
 * scrive, e un carattere sbagliato dava un riquadro rotto senza spiegazioni.
 * Qui si apre l'elenco che Home Assistant tiene delle proprie cartelle, si
 * entra dentro e si sceglie la foto; oppure la si prende dal telefono o dal
 * computer.
 *
 * Cio' che finisce in configurazione e' sempre un indirizzo stabile: la foto
 * scelta viene copiata nell'archivio immagini di Home Assistant, che la serve
 * a un indirizzo che non scade. L'indirizzo firmato che Home Assistant
 * restituisce per leggere un file serve solo qui, per il tempo di copiarlo:
 * conservato in configurazione smetterebbe di funzionare da solo dopo qualche
 * ora, e la foto sparirebbe senza che nessuno abbia toccato niente.
 */
import {
  browseMessage,
  fileNameFor,
  imageServeUrl,
  normalizeBrowseResult,
  resolveMessage,
} from "../core/media-picker.js";
import { clean, doc, esc, installStyle, lexicalGlobal, readJson, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_MEDIA_PICKER__";
const state = (root[KEY] ||= { installed: false });

function authToken() {
  const values = [
    root.DASHBOARDMODERN_AUTH_TOKEN,
    root.__DASHBOARDMODERN_REAL_TOKEN__,
    root.LONG_LIVED_TOKEN,
    root.HA_TOKEN,
  ];
  try {
    const connection = readJson("cd_connection", {});
    values.push(connection.token, connection.access_token);
  } catch (_error) {}
  return values.map(clean).find((value) => value && value !== "__dashboardmodern_hosted__") || "";
}

/* La richiesta passa dal collegamento gia' aperto.
 *
 * La plancia ha una sola presa verso Home Assistant e la tiene aperta; aprirne
 * una seconda per sfogliare due cartelle vorrebbe dire una seconda
 * autenticazione, un secondo motivo per fallire e una connessione in piu' da
 * chiudere. */
function askHomeAssistant(payload, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const socket = lexicalGlobal("ws");
    const pending = lexicalGlobal("pendingWsCallbacks");
    if (!socket || socket.readyState !== 1 || !pending) {
      reject(new Error(t("Home Assistant non è collegata", "Home Assistant is not connected")));
      return;
    }
    let id = 0;
    try {
      id = root.eval("msgId++");
    } catch (_error) {
      reject(new Error("msgId"));
      return;
    }
    const timer = root.setTimeout?.(() => {
      delete pending[id];
      reject(new Error(t("Home Assistant non risponde", "Home Assistant is not answering")));
    }, timeout);
    pending[id] = (message) => {
      root.clearTimeout?.(timer);
      if (message?.success === false)
        reject(new Error(clean(message?.error?.message) || "media_source"));
      else resolve(message?.result);
    };
    try {
      socket.send(JSON.stringify({ ...payload, id }));
    } catch (error) {
      root.clearTimeout?.(timer);
      delete pending[id];
      reject(error);
    }
  });
}

const browse = (mediaContentId) =>
  askHomeAssistant(browseMessage(0, mediaContentId)).then(normalizeBrowseResult);

const resolve = (mediaContentId) => askHomeAssistant(resolveMessage(0, mediaContentId));

/**
 * Copia una foto nell'archivio immagini di Home Assistant e ne restituisce
 * l'indirizzo stabile. Restituisce "" quando l'archivio non risponde.
 */
export async function storeImage(blob, name) {
  const body = new FormData();
  body.append("file", blob, name);
  const token = authToken();
  const response = await fetch("/api/image/upload", {
    method: "POST",
    body,
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const url = imageServeUrl(await response.json());
  if (!url) throw new Error("upload");
  return url;
}

async function fetchSigned(url) {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.blob();
}

function dialogMarkup() {
  return `<section class="dm-section-dialog dm-media-dialog" role="dialog" aria-modal="true" aria-labelledby="dm-media-title">
    <header>
      <strong id="dm-media-title">📁 ${t("Scegli la foto", "Choose the photo")}</strong>
      <button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button>
    </header>
    <nav class="dm-media-trail" data-trail></nav>
    <div class="dm-media-list" data-list></div>
    <output class="dm-media-status" data-status></output>
    <footer>
      <label class="ed-btn-add dm-media-upload">⬆️ ${t("Dal dispositivo", "From this device")}
        <input type="file" accept="image/*" data-upload hidden>
      </label>
      <button type="button" class="ed-btn-add" data-cancel>${t("Annulla", "Cancel")}</button>
    </footer>
  </section>`;
}

/**
 * Apre la finestra e restituisce l'indirizzo scelto, "" se si annulla.
 */
export function pickMediaImage() {
  if (!doc) return Promise.resolve("");
  doc.getElementById("dm-media-picker-modal")?.remove();
  const modal = doc.createElement("div");
  modal.id = "dm-media-picker-modal";
  modal.className = "dm-section-modal";
  modal.innerHTML = dialogMarkup();
  doc.body.append(modal);

  const list = modal.querySelector("[data-list]");
  const trailNode = modal.querySelector("[data-trail]");
  const status = modal.querySelector("[data-status]");
  const trail = [{ id: "", title: t("Cartelle di Home Assistant", "Home Assistant folders") }];

  return new Promise((done) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      modal.remove();
      done(value);
    };
    const say = (message, kind = "info") => {
      status.dataset.kind = kind;
      status.textContent = message;
    };

    const paintTrail = () => {
      trailNode.replaceChildren();
      trail.forEach((step, index) => {
        const button = doc.createElement("button");
        button.type = "button";
        button.className = "dm-media-crumb";
        button.textContent = step.title;
        button.disabled = index === trail.length - 1;
        button.addEventListener("click", () => {
          trail.splice(index + 1);
          open(step.id);
        });
        trailNode.append(button);
      });
    };

    const chooseImage = async (entry) => {
      say(t("Copio la foto…", "Copying the photo…"));
      try {
        const resolved = await resolve(entry.id);
        const url = clean(resolved?.url);
        if (!url) throw new Error("resolve");
        finish(await storeImage(await fetchSigned(url), fileNameFor(url, `${entry.title}`)));
      } catch (error) {
        /* Detto com'e': l'indirizzo firmato scadrebbe, quindi non lo si salva
         * fingendo che vada bene. */
        say(
          t(
            `Non riesco a copiare la foto in Home Assistant (${clean(error?.message)}). Mettila in /config/www e scrivi /local/nomefile.`,
            `Cannot copy the photo into Home Assistant (${clean(error?.message)}). Put it in /config/www and type /local/filename.`,
          ),
          "error",
        );
      }
    };

    const open = async (mediaContentId) => {
      say(t("Leggo…", "Reading…"));
      list.replaceChildren();
      paintTrail();
      let folder;
      try {
        folder = await browse(mediaContentId);
      } catch (error) {
        say(clean(error?.message) || t("Non riesco a leggere", "Cannot read"), "error");
        return;
      }
      say("");
      const rows = [
        ...folder.folders.map((entry) => ({ entry, folder: true })),
        ...folder.images.map((entry) => ({ entry, folder: false })),
      ];
      if (!rows.length) {
        list.innerHTML = `<div class="ed-empty">${t("Cartella vuota", "Empty folder")}</div>`;
        return;
      }
      for (const { entry, folder: isFolder } of rows) {
        const row = doc.createElement("button");
        row.type = "button";
        row.className = "dm-media-row";
        row.dataset.mediaKind = isFolder ? "folder" : "image";
        row.innerHTML = `<span class="dm-media-icon">${isFolder ? "📁" : "🖼️"}</span><span class="dm-media-name">${esc(entry.title)}</span>${isFolder ? '<span class="dm-media-go" aria-hidden="true">›</span>' : ""}`;
        row.addEventListener("click", () => {
          if (isFolder) {
            trail.push({ id: entry.id, title: entry.title });
            open(entry.id);
          } else chooseImage(entry);
        });
        list.append(row);
      }
      if (folder.skipped > 0) {
        const note = doc.createElement("small");
        note.className = "dm-media-skipped";
        note.textContent = t(
          `${folder.skipped} elementi che non sono foto non sono elencati.`,
          `${folder.skipped} entries that are not photos are not listed.`,
        );
        list.append(note);
      }
    };

    modal.querySelector("[data-upload]").addEventListener("change", async (event) => {
      const file = event.target?.files?.[0];
      if (!file) return;
      say(t("Carico la foto…", "Uploading the photo…"));
      try {
        finish(await storeImage(file, file.name || "foto.png"));
      } catch (error) {
        say(
          t(
            `Caricamento non riuscito (${clean(error?.message)}).`,
            `Upload failed (${clean(error?.message)}).`,
          ),
          "error",
        );
      }
    });
    modal
      .querySelectorAll("[data-close],[data-cancel]")
      .forEach((button) => button.addEventListener("click", () => finish("")));
    modal.addEventListener("click", (event) => {
      if (event.target === modal) finish("");
    });
    open("");
  });
}

export function installMediaPickerSection() {
  if (state.installed || !doc) return;
  state.installed = true;
  installStyle(
    "dm-media-picker-style",
    `
      .dm-media-dialog{max-width:520px!important}
      .dm-media-trail{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 8px}
      .dm-media-crumb{border:none;background:none;padding:2px 6px;border-radius:8px;font:inherit;font-size:12px;font-weight:800;color:var(--info-color,#0369a1);cursor:pointer}
      .dm-media-crumb:disabled{color:var(--secondary-text-color,#64748b);cursor:default}
      .dm-media-crumb+.dm-media-crumb::before{content:"›";margin-right:6px;color:var(--secondary-text-color,#94a3b8)}
      .dm-media-list{display:grid;gap:6px;max-height:46vh;overflow-y:auto;padding:2px}
      .dm-media-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;padding:10px 12px;border:1px solid var(--divider-color,#dbe4ee);border-radius:14px;background:var(--card-background-color,#fff);font:inherit;text-align:left;cursor:pointer}
      .dm-media-row:hover{border-color:var(--info-color,#0ea5e9)}
      .dm-media-icon{font-size:18px}
      .dm-media-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:700}
      .dm-media-go{color:var(--secondary-text-color,#94a3b8)}
      .dm-media-skipped,.dm-media-status{display:block;margin-top:6px;font-size:11.5px;color:var(--secondary-text-color,#64748b)}
      .dm-media-status[data-kind="error"]{color:var(--error-color,#dc2626);font-weight:700}
      .dm-media-upload{cursor:pointer}
    `,
  );
}
