/* L'indirizzo RTSP nella configurazione delle telecamere (#284).
 *
 * «Ho una telecamera con flusso video su rtsp://192.168.5.30:8556/Salone, non
 * c'e' possibilita' di configurazione.» Vero: la scheda chiede un'entita'
 * `camera.…` e un nome di flusso go2rtc, e chi ha in mano solo l'indirizzo
 * della telecamera non ha una casella dove metterlo — nemmeno per ritrovarlo
 * la volta dopo.
 *
 * Questa e' la casella. Non e' un lettore: nessun browser apre rtsp://, e
 * scrivere qui che lo fa sarebbe la bugia piu' facile da raccontare e la piu'
 * cara da scoprire. E' il pezzo che mancava per *arrivarci*:
 *
 *   · l'indirizzo si scrive, si salva e resta li' — e' il dato della
 *     telecamera, come il nome e la stanza;
 *   · da quell'indirizzo si legge il nome che go2rtc dà a quel flusso, e lo si
 *     propone nel campo che accende WebRTC — chi ha go2rtc o Frigate ha finito;
 *   · a chi non ce l'ha, la scheda dice l'unica cosa che serve sapere, con il
 *     collegamento che la fa: aggiungi una telecamera Generica in Home
 *     Assistant con questo indirizzo, e incolla qui l'entita' che ne esce.
 *
 * Il campo compare accanto a quello del flusso, dentro la fisarmonica delle
 * telecamere del guscio vendorizzato: si aggiunge a ogni ridisegno, e il
 * salvataggio passa da `dmSaveCameras`, l'unica porta da cui l'elenco delle
 * telecamere finisce su disco.
 */
import { analizzaRtsp, cosaManca, rigaGo2rtc, sembraRtsp } from "../core/telecamera-rtsp.js";
import { clean, doc, esc, installStyle, onEditorRedraw, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_TELECAMERA_RTSP__";
const state = (root[KEY] ||= { installed: false });

const CAMPO = "dm-cam-rtsp";
const NOTA = "dm-cam-rtsp-nota";

/* Dove Home Assistant apre la procedura della telecamera Generica. E' la
 * stessa che si raggiunge da Impostazioni → Dispositivi e servizi → Aggiungi
 * integrazione → Generic Camera, e ci si arriva in un tocco invece che in
 * cinque. `_top` perche' la plancia sta dentro un pannello. */
const STRADA_GENERICA = "/config/integrations/dashboard/add?domain=generic";

const valoreDi = (id) => clean(doc?.getElementById?.(id)?.value);

/* Il campo del flusso go2rtc: e' quello che questa casella aiuta a riempire. */
const campoDelFlusso = () => doc?.getElementById?.("ed-cam-stream") || null;

function notaMarkup(indirizzo) {
  const letto = analizzaRtsp(indirizzo);
  if (!letto) {
    return `<span class="dm-rtsp-nota-riga">${esc(
      t(
        "L'indirizzo del flusso della telecamera, se ce l'hai. Serve a ritrovarlo e a compilare il campo qui sopra.",
        "The camera's stream address, if you have one. It is here to keep it and to fill in the field above.",
      ),
    )}</span>`;
  }

  const manca = cosaManca({
    rtsp: indirizzo,
    entity: valoreDi("ed-cam-ent"),
    stream: valoreDi("ed-cam-stream"),
  });
  const riga = rigaGo2rtc(indirizzo);
  const pronta = manca === "pronta";

  /* Non si ripete l'indirizzo — sta nel campo, due righe sopra — si dice cosa
   * se n'e' capito: la telecamera a cui si va a bussare e il nome che il flusso
   * prende. Se e' sbagliato si vede da qui, senza rileggere l'indirizzo. */
  const capito = [
    letto.porta ? `${letto.host}:${letto.porta}` : letto.host,
    letto.nome ? `${t("flusso", "stream")} «${letto.nome}»` : "",
    letto.conCredenziali ? t("con credenziali", "with credentials") : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `<span class="dm-rtsp-nota-riga dm-rtsp-letto">${esc(capito)}</span>
    <span class="dm-rtsp-nota-riga">${esc(
      t(
        "Il browser non apre rtsp:// da solo: qualcuno deve riconfezionare il flusso. Due strade, e ne basta una.",
        "A browser cannot open rtsp:// on its own: something has to repackage the stream. Two ways, and one is enough.",
      ),
    )}</span>
    <span class="dm-rtsp-strada${pronta ? " dm-rtsp-fatta" : ""}">
      <b>1.</b> ${esc(
        t(
          "Aggiungi una telecamera Generica in Home Assistant con questo indirizzo, poi incolla nel campo dell'entità quella che ne esce.",
          "Add a Generic camera in Home Assistant with this address, then paste the entity it creates into the entity field.",
        ),
      )}
      <a class="dm-rtsp-link" href="${STRADA_GENERICA}" target="_top" rel="noopener">${esc(
        t("Aprila", "Open it"),
      )}</a>
    </span>
    <span class="dm-rtsp-strada">
      <b>2.</b> ${esc(
        t(
          "Se usi go2rtc o Frigate, metti questa riga sotto «streams:» nel loro file:",
          "If you run go2rtc or Frigate, put this line under “streams:” in their file:",
        ),
      )}
      <code class="dm-rtsp-riga">${esc(riga.trim())}</code>
      <button type="button" class="dm-rtsp-copia" data-dm-rtsp-copia>${esc(
        t("Copia", "Copy"),
      )}</button>
    </span>`;
}

function aggiornaNota() {
  const nota = doc?.getElementById?.(NOTA);
  if (!nota) return;
  const indirizzo = valoreDi(CAMPO);
  nota.innerHTML = notaMarkup(indirizzo);
  nota.dataset.rtsp = sembraRtsp(indirizzo) ? "true" : "false";
}

/* Il nome del flusso si propone, non si impone: si scrive solo nel campo
 * vuoto, e resta modificabile. Indovinarlo sopra a quello che uno ha gia'
 * scritto vorrebbe dire cancellargli la configurazione di Frigate per una
 * convenzione. */
function proponiIlNome() {
  const campo = campoDelFlusso();
  const letto = analizzaRtsp(valoreDi(CAMPO));
  if (!campo || !letto?.nome || clean(campo.value)) return;
  campo.value = letto.nome;
  campo.dispatchEvent?.(new Event("input", { bubbles: true }));
}

function campoMarkup(valore) {
  return `<label class="dm-rtsp-etichetta" for="${CAMPO}">${esc(
    t("Indirizzo RTSP della telecamera", "Camera RTSP address"),
  )}</label>
  <input id="${CAMPO}" class="ed-input mono dm-rtsp-input" value="${esc(valore)}"
    placeholder="rtsp://192.168.1.50:554/stream1" spellcheck="false" autocomplete="off">
  <small id="${NOTA}" class="dm-rtsp-nota"></small>`;
}

/* L'indirizzo della telecamera che si sta modificando. Il guscio riempie i suoi
 * campi dentro `edEditCamera`, e questo e' il campo che lui non conosce: si
 * cerca la telecamera da nome ed entita', che sono quello che il modulo ha
 * appena scritto nel form. */
function indirizzoDelForm() {
  const nome = valoreDi("ed-cam-name");
  const entita = valoreDi("ed-cam-ent");
  if (!nome && !entita) return "";
  const trovata = (root.getCameras?.() || []).find(
    (cam) => clean(cam?.name) === nome && clean(cam?.entity) === entita,
  );
  return clean(trovata?.rtsp);
}

function metti() {
  const flusso = campoDelFlusso();
  if (!flusso) return false;
  if (doc?.getElementById?.(CAMPO)) {
    aggiornaNota();
    return false;
  }
  const casella = doc.createElement("div");
  casella.className = "dm-rtsp-casella";
  casella.innerHTML = campoMarkup(indirizzoDelForm());
  /* Sotto il campo del flusso, non sopra: si legge dall'alto in basso — prima
   * l'entita', poi il flusso, poi da dove arriva il video. */
  (flusso.nextElementSibling || flusso).after(casella);
  aggiornaNota();
  return true;
}

/* L'unica porta da cui l'elenco delle telecamere finisce su disco. Ci si mette
 * davanti invece di rincorrere il salvataggio: il campo entra nel record
 * *prima* che parta, e non c'e' un secondo salvataggio da inseguire ne' una
 * corsa con la scrittura del guscio. */
function arricchisci(cams) {
  const indirizzo = valoreDi(CAMPO);
  if (!Array.isArray(cams) || !sembraRtsp(indirizzo)) return cams;
  const nome = valoreDi("ed-cam-name");
  const entita = valoreDi("ed-cam-ent");
  return cams.map((cam) =>
    clean(cam?.name) === nome && clean(cam?.entity) === entita && clean(cam?.rtsp) !== indirizzo
      ? { ...cam, rtsp: indirizzo }
      : cam,
  );
}

function intercettaIlSalvataggio() {
  const originale = root.dmSaveCameras;
  if (typeof originale !== "function" || originale.__dmRtsp) return false;
  function nostro(cams, ...resto) {
    return originale.call(this, arricchisci(cams), ...resto);
  }
  Object.assign(nostro, originale);
  nostro.__dmRtsp = true;
  nostro.__dmPrevious = originale;
  root.dmSaveCameras = nostro;
  return true;
}

function onInput(event) {
  if (event.target?.id !== CAMPO) return;
  proponiIlNome();
  aggiornaNota();
}

function onClick(event) {
  const copia = event.target?.closest?.("[data-dm-rtsp-copia]");
  if (!copia) return;
  event.preventDefault();
  const riga = rigaGo2rtc(valoreDi(CAMPO));
  if (!riga) return;
  root.navigator?.clipboard?.writeText?.(riga.trim());
  copia.textContent = t("Copiata", "Copied");
  root.setTimeout?.(() => {
    copia.textContent = t("Copia", "Copy");
  }, 1600);
}

function installStyles() {
  installStyle(
    "dm-telecamera-rtsp",
    `
      #ed-body .dm-rtsp-casella{margin:8px 0 4px}
      #ed-body .dm-rtsp-etichetta{
        display:block;margin:0 2px 4px;font-size:11px;font-weight:800;letter-spacing:.04em;
        text-transform:uppercase;color:var(--text-dim,#64748b)}
      #ed-body .dm-rtsp-nota{
        display:block;margin:4px 2px 0;font-size:11px;line-height:1.45;
        color:var(--text-dim,#64748b)}
      #ed-body .dm-rtsp-nota-riga{display:block}
      #ed-body .dm-rtsp-letto{
        font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;
        color:var(--text,#0f172a);word-break:break-all}
      #ed-body .dm-rtsp-nota[data-rtsp="false"] .dm-rtsp-strada{display:none}
      #ed-body .dm-rtsp-strada{display:block;margin-top:5px}
      #ed-body .dm-rtsp-strada b{color:var(--text,#0f172a)}
      /* La strada gia' percorsa resta scritta ma smette di chiamare: chi ha
         gia' l'entita' non deve rileggere ogni volta come si ottiene. */
      #ed-body .dm-rtsp-fatta{opacity:.5}
      #ed-body .dm-rtsp-link{color:var(--primary-color,#0ea5e9);font-weight:700}
      #ed-body .dm-rtsp-riga{
        display:inline-block;margin:3px 0 0;padding:2px 6px;border-radius:7px;
        background:var(--bg-sculpted,#f0f4f8);border:1px solid var(--card-border,#e2e8f0);
        font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;
        color:var(--text,#0f172a);word-break:break-all}
      #ed-body .dm-rtsp-copia{
        margin-left:6px;padding:2px 8px;border:1px solid var(--card-border,#e2e8f0);
        border-radius:7px;background:var(--card-background-color,#fff);cursor:pointer;
        font:inherit;font-size:10.5px;font-weight:700;color:var(--primary-color,#0ea5e9)}
    `,
  );
}

export function installTelecameraRtsp() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("input", onInput);
  doc.addEventListener("click", onClick);
  onEditorRedraw("__dmTelecameraRtsp", () => {
    metti();
    intercettaIlSalvataggio();
  });
  metti();
  intercettaIlSalvataggio();
  return true;
}

export { arricchisci, metti };
