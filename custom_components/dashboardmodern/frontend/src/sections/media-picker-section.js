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
  normalizeWwwResult,
  resolveMessage,
  wwwListMessage,
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

const listWww = (path) => askHomeAssistant(wwwListMessage(0, path)).then(normalizeWwwResult);

/** Il contenuto del file, come stringa base64 senza intestazione. */
async function blobBase64(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binario = "";
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo)
    binario += String.fromCharCode.apply(null, bytes.subarray(i, i + passo));
  return btoa(binario);
}

/**
 * Salva la foto e ne restituisce l'indirizzo stabile.
 *
 * La strada maestra e' il WebSocket dell'integrazione: la plancia servita da
 * Home Assistant non possiede nessun token — il suo socket si autentica lato
 * server — e qualsiasi chiamata REST del browser risponde 401. Era l'errore
 * che usciva premendo «Dal dispositivo». Il backend scrive la foto sotto
 * config/www e risponde con un /local, lo stesso tipo di percorso che si
 * scriverebbe a mano. L'archivio immagini REST resta come ripiego per chi un
 * token vero ce l'ha (installazioni standalone col long-lived token).
 */
export async function storeImage(blob, name) {
  try {
    const result = await askHomeAssistant(
      {
        type: "dashboardmodern/www/upload",
        filename: clean(name) || "foto.png",
        data: await blobBase64(blob),
      },
      30000,
    );
    const path = clean(result?.path);
    if (path) return path;
  } catch (errore) {
    /* Un backend vecchio non conosce il comando: si tenta la strada REST.
     * Un rifiuto parlante del backend (file non valido) invece si riporta. */
    if (/invalid_upload|invalid_data/.test(clean(errore?.message))) throw errore;
  }
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

/* Una finestra di sezione ha due righe: la testata e il corpo.
 *
 * Il foglio di stile delle finestre dell'editor lo dice chiaro —
 * `grid-template-rows:auto minmax(0,1fr)` su un riquadro alto quanto lo
 * schermo. Questa ne aveva cinque di figli: la testata prendeva la prima riga,
 * le briciole di pane si prendevano tutto il resto come seconda, ed elenco,
 * messaggio e pulsanti finivano schiacciati in fondo con una voragine bianca
 * in mezzo. Non era un problema di margini: era un figlio di troppo.
 *
 * Il corpo e' un `form` perche' e' quello che quel foglio di stile sa far
 * scorrere, e il suo `footer` e' quello che sa tenere in basso. Non si invia
 * niente: l'invio si annulla appena la finestra e' montata. */
function dialogMarkup() {
  return `<section class="dm-section-dialog dm-media-dialog" role="dialog" aria-modal="true" aria-labelledby="dm-media-title">
    <header>
      <strong id="dm-media-title">📁 ${t("Scegli la foto", "Choose the photo")}</strong>
      <button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button>
    </header>
    <form class="dm-media-body" data-body novalidate>
      <nav class="dm-media-trail" data-trail></nav>
      <div class="dm-media-list" data-list></div>
      <output class="dm-media-status" data-status></output>
      <footer>
        <label class="ed-btn-add dm-media-upload">⬆️ ${t("Dal dispositivo", "From this device")}
          <input type="file" accept="image/*" data-upload hidden>
        </label>
        <button type="button" class="ed-btn-add" data-cancel>${t("Annulla", "Cancel")}</button>
      </footer>
    </form>
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
  modal
    .querySelector("[data-body]")
    ?.addEventListener("submit", (evento) => evento.preventDefault());
  doc.body.append(modal);

  const list = modal.querySelector("[data-list]");
  const trailNode = modal.querySelector("[data-trail]");
  const status = modal.querySelector("[data-status]");
  /* Due sorgenti, una accanto all'altra.
   *
   * "/local" e' la cartella config/www, quella che Home Assistant serve senza
   * chiedere niente a nessuno: una foto che sta li' ha gia' il suo indirizzo
   * definitivo e non c'e' niente da copiare. Le cartelle media sono quelle che
   * Home Assistant elenca da se': di li' la foto va copiata, perche'
   * l'indirizzo con cui si legge un file media e' firmato e scade. */
  const RADICE = { fonte: "root", id: "", title: t("Scegli dove cercare", "Choose where to look") };
  const trail = [RADICE];

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
          open(step);
        });
        trailNode.append(button);
      });
    };

    const riga = (kind, testo, apri) => {
      const row = doc.createElement("button");
      row.type = "button";
      row.className = "dm-media-row";
      row.dataset.mediaKind = kind;
      const icona = kind === "image" ? "🖼️" : kind === "source" ? "🗂️" : "📁";
      row.innerHTML = `<span class="dm-media-icon">${icona}</span><span class="dm-media-name">${esc(testo)}</span>${kind === "image" ? "" : '<span class="dm-media-go" aria-hidden="true">›</span>'}`;
      row.addEventListener("click", apri);
      list.append(row);
      return row;
    };

    /* Una foto delle cartelle media va copiata: l'indirizzo con cui la si
     * legge e' firmato e scade da solo dopo qualche ora. */
    const copiaDaiMedia = async (entry) => {
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

    const mostraRadice = () => {
      list.replaceChildren();
      say("");
      riga("source", t("File in /local (config/www)", "Files in /local (config/www)"), () => {
        const passo = { fonte: "www", id: "", title: "/local" };
        trail.push(passo);
        open(passo);
      });
      riga("source", t("Cartelle media di Home Assistant", "Home Assistant media folders"), () => {
        const passo = { fonte: "media", id: "", title: t("Media", "Media") };
        trail.push(passo);
        open(passo);
      });
    };

    const mostraCartella = (folder, fonte) => {
      list.replaceChildren();
      const righe = [
        ...folder.folders.map((entry) => ({ entry, cartella: true })),
        ...folder.images.map((entry) => ({ entry, cartella: false })),
      ];
      if (!righe.length) {
        list.innerHTML = `<div class="ed-empty">${t("Cartella vuota", "Empty folder")}</div>`;
        return;
      }
      for (const { entry, cartella } of righe)
        riga(cartella ? "folder" : "image", entry.title, () => {
          if (cartella) {
            const passo = { fonte, id: entry.id, title: entry.title };
            trail.push(passo);
            open(passo);
            return;
          }
          /* Una foto di /local e' gia' al suo posto: si prende l'indirizzo e
           * si chiude, senza copiare niente da nessuna parte. */
          if (fonte === "www") finish(entry.url);
          else copiaDaiMedia(entry);
        });
      const avanzi = folder.skipped > 0 || folder.truncated;
      if (avanzi) {
        const note = doc.createElement("small");
        note.className = "dm-media-skipped";
        note.textContent = folder.truncated
          ? t(
              "La cartella ha troppi file: ne sono elencati solo i primi.",
              "The folder has too many files: only the first ones are listed.",
            )
          : t(
              `${folder.skipped} elementi che non sono foto non sono elencati.`,
              `${folder.skipped} entries that are not photos are not listed.`,
            );
        list.append(note);
      }
    };

    const open = async (step) => {
      paintTrail();
      if (step.fonte === "root") {
        mostraRadice();
        return;
      }
      say(t("Leggo…", "Reading…"));
      list.replaceChildren();
      try {
        if (step.fonte === "www") {
          const folder = await listWww(step.id);
          if (!folder.available) {
            say(
              t(
                "La cartella config/www non esiste ancora: creala e mettici dentro le foto.",
                "The config/www folder does not exist yet: create it and put the photos in there.",
              ),
              "error",
            );
            return;
          }
          say("");
          mostraCartella(folder, "www");
          return;
        }
        const folder = await browse(step.id);
        say("");
        mostraCartella(folder, "media");
      } catch (error) {
        say(clean(error?.message) || t("Non riesco a leggere", "Cannot read"), "error");
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
    open(RADICE);
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
      .dm-media-body{display:grid!important;align-content:start!important;gap:10px!important}
      .dm-media-list{display:grid;gap:6px;min-height:0;padding:2px}
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
