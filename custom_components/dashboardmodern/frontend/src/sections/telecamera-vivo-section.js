/* «Dal vivo» nella scheda delle telecamere.
 *
 * «Le telecamere che configura sono delle Arlo, ma dalla sezione Sicurezza vede
 * solo un'istantanea: il video non si muove, né dalla card né quando apre il
 * popup. Con una card YAML — `camera_view: live` — riesce a vederlo sempre in
 * trasmissione.»
 *
 * Il popup un video ce l'ha, e lo cerca su quattro strade. La tessera del muro
 * no: ha sempre chiesto fotogrammi, uno ogni quattro secondi. Questa è la
 * casella che le dice di chiedere invece il flusso continuo — la stessa cosa
 * che fa `camera_view: live`, che non è una card diversa ma una riga di
 * configurazione della stessa card.
 *
 * Perché una casella e non il comportamento di serie: un flusso continuo tiene
 * aperta una connessione per telecamera finché si guarda il muro. Su otto
 * telecamere, al telefono e fuori casa, è un conto ben diverso da uno scatto
 * ogni quattro secondi — e nessuno l'ha chiesto per la propria. Chi lo vuole lo
 * accende sulla telecamera che gli interessa; il muro resta acceso solo mentre
 * lo si guarda, come già faceva.
 *
 * La casella vive accanto a quella dell'indirizzo RTSP, dentro la fisarmonica
 * delle telecamere del guscio vendorizzato, e il valore entra nel record
 * passando da `dmSaveCameras` — l'unica porta da cui l'elenco finisce su disco.
 */
import { vuoleIlVivo } from "../core/telecamera-dal-vivo.js";
import { clean, doc, esc, installStyle, onEditorRedraw, root, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_TELECAMERA_VIVO__";
const state = (root[KEY] ||= { installed: false });

const CAMPO = "dm-cam-vivo";

const valoreDi = (id) => clean(doc?.getElementById?.(id)?.value);

/* Dove si posa: sotto la casella dell'RTSP quando c'è, altrimenti sotto il
 * campo del flusso. Le tre righe parlano della stessa cosa — da dove arriva il
 * video — e stare insieme è quello che le rende leggibili. */
function ancora() {
  return (
    doc?.getElementById?.("dm-cam-rtsp")?.closest?.(".dm-rtsp-casella") ||
    doc?.getElementById?.("ed-cam-stream") ||
    null
  );
}

/* La telecamera che il form sta mostrando, riconosciuta come la riconosce il
 * salvataggio: per nome ed entità insieme. */
function telecameraDelForm() {
  const nome = valoreDi("ed-cam-name");
  const entita = valoreDi("ed-cam-ent");
  if (!nome && !entita) return null;
  return (
    (root.getCameras?.() || []).find(
      (cam) => clean(cam?.name) === nome && clean(cam?.entity) === entita,
    ) || null
  );
}

function campoMarkup(acceso) {
  return `<label class="dm-vivo-riga">
    <input type="checkbox" id="${CAMPO}"${acceso ? " checked" : ""}>
    <span class="dm-vivo-testo">
      <b>${esc(t("Video dal vivo nella tessera", "Live video on the tile"))}</b>
      <small>${esc(
        t(
          "La tessera del muro mostra il flusso continuo invece di un'istantanea ogni quattro secondi — è quello che fa «camera_view: live». Tiene aperta una connessione mentre guardi la sezione Sicurezza: accendilo sulle telecamere che vuoi vedere muoversi.",
          "The wall tile shows the continuous stream instead of a still every four seconds — this is what “camera_view: live” does. It holds a connection open while you are looking at the Security section: turn it on for the cameras you want to see moving.",
        ),
      )}</small>
    </span>
  </label>`;
}

function metti() {
  const dove = ancora();
  if (!dove) return false;
  if (doc?.getElementById?.(CAMPO)) return false;
  const casella = doc.createElement("div");
  casella.className = "dm-vivo-casella";
  casella.innerHTML = campoMarkup(vuoleIlVivo(telecameraDelForm() || {}));
  dove.after(casella);
  return true;
}

/* Quando si apre un'altra telecamera con la matita, la casella deve dire di
 * lei. Il guscio riempie i suoi campi e non ridisegna niente: senza questo, la
 * spunta restava quella della telecamera di prima — e la si sarebbe salvata
 * sulla nuova senza averla toccata. */
function rileggi() {
  const casella = doc?.getElementById?.(CAMPO);
  if (!casella) return false;
  casella.checked = vuoleIlVivo(telecameraDelForm() || {});
  return true;
}

/* Davanti al salvataggio, come per l'RTSP: il campo entra nel record prima che
 * parta, e non c'è una seconda scrittura da inseguire. */
function arricchisci(cams) {
  const casella = doc?.getElementById?.(CAMPO);
  if (!Array.isArray(cams) || !casella) return cams;
  const acceso = casella.checked === true;
  const nome = valoreDi("ed-cam-name");
  const entita = valoreDi("ed-cam-ent");
  return cams.map((cam) => {
    if (clean(cam?.name) !== nome || clean(cam?.entity) !== entita) return cam;
    if (vuoleIlVivo(cam) === acceso) return cam;
    /* Spento vuol dire spento, non «campo assente»: una telecamera che era dal
     * vivo e non lo è più deve smettere di esserlo anche dopo un ricarico. */
    return { ...cam, vivo: acceso };
  });
}

function intercettaIlSalvataggio() {
  const originale = root.dmSaveCameras;
  if (typeof originale !== "function" || originale.__dmVivo) return false;
  function nostro(cams, ...resto) {
    return originale.call(this, arricchisci(cams), ...resto);
  }
  Object.assign(nostro, originale);
  nostro.__dmVivo = true;
  nostro.__dmPrevious = originale;
  root.dmSaveCameras = nostro;
  return true;
}

function installStyles() {
  installStyle(
    "dm-telecamera-vivo",
    `
      #ed-body .dm-vivo-casella{margin:8px 0 4px}
      #ed-body .dm-vivo-riga{
        display:flex;gap:9px;align-items:flex-start;padding:9px 11px;border-radius:12px;
        background:var(--bg-sculpted,#f0f4f8);border:1px solid var(--card-border,#e2e8f0);
        cursor:pointer}
      #ed-body .dm-vivo-riga input{flex:0 0 auto;width:18px;height:18px;margin:1px 0 0;cursor:pointer}
      #ed-body .dm-vivo-testo{display:block;min-width:0}
      #ed-body .dm-vivo-testo b{
        display:block;font-size:12.5px;font-weight:800;color:var(--text,#0f172a)}
      #ed-body .dm-vivo-testo small{
        display:block;margin-top:3px;font-size:11px;line-height:1.45;
        color:var(--text-dim,#64748b)}
    `,
  );
}

export function installTelecameraVivo() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  onEditorRedraw("__dmTelecameraVivo", () => {
    metti();
    intercettaIlSalvataggio();
    wrapFunction("edEditCamera", "__dmVivoRilegge", rileggi);
  });
  metti();
  intercettaIlSalvataggio();
  wrapFunction("edEditCamera", "__dmVivoRilegge", rileggi);
  return true;
}

export { arricchisci, metti, rileggi };
