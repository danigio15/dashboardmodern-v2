/* Da che parte scrive la batteria di casa (#434).
 *
 * «Il flow dovrebbe essere dal FV verso casa ed è corretto, ma poi dovrebbe
 *  anche caricare la batteria mentre in questo momento sembra scaricarsi
 *  perché il flow tratteggiato va dalla batteria verso casa ma non è esatto.
 *  Dovrebbe essere il contrario in base a carica/scarica della batteria.»
 *
 * La mappa dei flussi ha una convenzione sola, e non può che essere una:
 * positivo = scarica. I sensori no. Un solo numero col segno lo pubblicano
 * tutti — Huawei, SolarEdge, Victron, Sofar, i template fatti in casa — e metà
 * lo scrivono positivo quando la batteria si CARICA. Da un valore solo non si
 * indovina: 800 W vuol dire «sta caricando» o «sta scaricando» a seconda di chi
 * l'ha scritto, e chi guarda vede le frecce all'incontrario.
 *
 * Quindi lo dice la casa, una volta, con un interruttore — come si dice il
 * verso di una tapparella montata al contrario. Sta sotto la casella della
 * potenza della batteria, che è il posto dove ci si trova quando si accorge
 * che il disegno mente. La regola sta in `core/energy-flow-truth.js`, qui c'è
 * solo il modo di dirla.
 */
import { CHIAVE_VERSO_BATTERIA, batteriaGirata } from "../core/energy-flow-truth.js";
import {
  doc,
  esc,
  installStyle,
  readJson,
  root,
  t,
  tieniIlBloccoNellaScheda,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_VERSO_BATTERIA_EDITOR__";
const STYLE_ID = "dm-verso-batteria-style";
const BLOCK_ID = "dm-verso-batteria";
const RIF = "dm.energy_potenza_batteria";
const state = (root[KEY] ||= { installed: false });

/** La casella della potenza della batteria: è lei a dire che siamo nel posto. */
export function casellaDellaBatteria() {
  const body = doc?.getElementById?.("ed-body");
  if (!body) return null;
  const campo = body.querySelector(`.ed-slot-in[data-ref="${RIF}"]`);
  return campo?.closest?.(".ed-slot") || null;
}

function girata() {
  return batteriaGirata(readJson(CHIAVE_VERSO_BATTERIA, {}));
}

function markup(su) {
  return `<button type="button" class="dm-verso-batt" data-dm-verso-batteria
      data-on="${su}" aria-pressed="${su}">
      <span class="dm-verso-batt-seg">${su ? "🔻" : "🔺"}</span>
      <span class="dm-verso-batt-testo">
        <b>${esc(t("La mia batteria scrive positivo quando si carica", "My battery writes positive while charging"))}</b>
        <small>${esc(
          su
            ? t(
                "Acceso: un numero positivo vuol dire che la batteria si sta caricando.",
                "On: a positive number means the battery is charging.",
              )
            : t(
                "Spento: un numero positivo vuol dire che la batteria sta alimentando casa. Se sulla mappa le frecce della batteria vanno al contrario di quello che fa davvero, accendilo.",
                "Off: a positive number means the battery is feeding the house. If the battery arrows on the map point the opposite way to what it is really doing, turn this on.",
              ),
        )}</small>
      </span>
    </button>`;
}

export function ensureVersoBatteriaBlock() {
  const casella = casellaDellaBatteria();
  let blocco = doc?.getElementById?.(BLOCK_ID);
  if (!casella) {
    blocco?.remove();
    return false;
  }
  const su = girata();
  if (!blocco) {
    blocco = doc.createElement("section");
    blocco.id = BLOCK_ID;
    blocco.className = "dm-verso-batteria";
    casella.after(blocco);
  } else if (blocco.previousElementSibling !== casella) {
    /* La scheda si rifà da capo: il blocco che era rimasto attaccato alla
     * casella di prima va rimesso sotto quella nuova. */
    casella.after(blocco);
  }
  const firma = String(su);
  if (blocco.dataset.firma === firma) return false;
  blocco.dataset.firma = firma;
  blocco.innerHTML = markup(su);
  return true;
}

function onClick(event) {
  const tasto = event.target?.closest?.("[data-dm-verso-batteria]");
  if (!tasto || !doc?.getElementById?.(BLOCK_ID)?.contains(tasto)) return;
  event.preventDefault();
  const prossimo = !girata();
  const salvato = readJson(CHIAVE_VERSO_BATTERIA, {});
  const dato = salvato && typeof salvato === "object" && !Array.isArray(salvato) ? salvato : {};
  writeJsonIfChanged(CHIAVE_VERSO_BATTERIA, { ...dato, girata: prossimo });
  ensureVersoBatteriaBlock();
  /* Il disegno cambia adesso: chi ha acceso l'interruttore sta guardando le
   * frecce, e deve vederle girare senza ricaricare la pagina. */
  try {
    root.renderFlusso?.();
    root.render?.();
  } catch (_errore) {}
  root.edToast?.(
    prossimo
      ? t("🔋 Positivo = in carica", "🔋 Positive = charging")
      : t("🔋 Positivo = in scarica", "🔋 Positive = discharging"),
  );
}

function css() {
  return `
    #ed-body .dm-verso-batteria{display:block;margin:6px 0 0}
    #ed-body .dm-verso-batt{
      display:grid;grid-template-columns:34px minmax(0,1fr);align-items:start;gap:10px;
      width:100%;text-align:left;font-family:inherit;cursor:pointer;
      padding:11px 13px;border-radius:14px;
      border:1.5px solid var(--card-border,#e2e8f0);background:var(--surface-2,#f8fafc)}
    #ed-body .dm-verso-batt[data-on="true"]{
      border-color:#0ea5e9;background:color-mix(in srgb,#0ea5e9 10%,var(--surface-2,#f8fafc))}
    #ed-body .dm-verso-batt-seg{font-size:18px;line-height:1.2}
    #ed-body .dm-verso-batt-testo{display:grid;gap:3px;min-width:0}
    #ed-body .dm-verso-batt-testo b{font-size:12.5px;font-weight:800;color:var(--text,#0f172a)}
    #ed-body .dm-verso-batt-testo small{font-size:11px;font-weight:600;color:var(--text-dim,#64748b)}
    #ed-body .dm-verso-batt:focus-visible{outline:2px solid var(--primary-color,#0ea5e9);outline-offset:2px}
  `;
}

export function installVersoBatteriaEditorSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyle(STYLE_ID, css());
  doc.addEventListener("click", onClick, true);
  tieniIlBloccoNellaScheda("dmVersoBatteria", ensureVersoBatteriaBlock);
  return true;
}

installVersoBatteriaEditorSection();
