/* La soglia di potenza: dove si scrive, e dove si vede (#508).
 *
 * «Possibilità di avere un campo dove inserire un valore massimo di potenza che
 * fa colorare di color ambra o rosso la card per capire un sovraccarico.»
 *
 * Il campo sta nelle IMPOSTAZIONI dell'Energia, accanto al costo del kWh: e'
 * li' che vivono le cose che valgono per tutta la casa e non per una entita'.
 * La regola di quando si colora — e su quale dei due carichi si misura — sta
 * in `core/la-soglia-della-potenza.js`, che e' puro; qui c'e' solo il modo di
 * scriverla e la striscia che la ripete sulla pagina Energia.
 *
 * Due posti, non tre: la tessera in Home la colora `home-widgets-section`, che
 * quelle letture ce l'ha gia' in mano e le sta gia' scrivendo. Farne una
 * seconda copia qui sarebbe il modo di far dire due cose diverse alla stessa
 * corrente — che in questa plancia e' gia' successo, e si e' visto (#435).
 */
import {
  LIVELLO_AMBRA,
  LIVELLO_QUIETE,
  SOGLIA_POTENZA_KEY,
  SORGENTE_CASA,
  SORGENTE_RETE,
  livelloDellaPotenza,
  sogliaDellaPotenza,
} from "../core/la-soglia-della-potenza.js";
import { intlLocale } from "../core/i18n.js";
import { formatWatts as wattScritti } from "../core/subload-popup-model.js";
import { lettureDiCasa, renderHomeWidgets } from "./home-widgets-section.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  paginaVisibile,
  readJson,
  root,
  t,
} from "./shared.js";

/* I watt come li scrive il resto della plancia, nella lingua di chi guarda.
 *
 * Il formato viene da `core/subload-popup-model.js` — quello che la plancia usa
 * da sempre per la potenza — e la lingua gliela si passa: lasciata al valore di
 * serie sarebbe l'italiano anche su una plancia in inglese, e la striscia
 * avrebbe detto «6,20 kW» sotto una tessera che dice «6.20 kW». */
const formatWatts = (valore) => wattScritti(valore, intlLocale());

const KEY = "__DASHBOARDMODERN_SOGLIA_POTENZA__";
const state = (root[KEY] ||= { installed: false, frame: 0 });

/** La soglia salvata, gia' in forma. */
export function sogliaDiCasa() {
  return sogliaDellaPotenza(readJson(SOGLIA_POTENZA_KEY, {}));
}

/** Il verdetto di adesso, sulle letture che la plancia sta gia' facendo. */
export function sovraccaricoDiAdesso() {
  return livelloDellaPotenza(sogliaDiCasa(), lettureDiCasa());
}

function salva(soglia) {
  try {
    root.localStorage?.setItem?.(SOGLIA_POTENZA_KEY, JSON.stringify(soglia));
  } catch (_errore) {}
  root.cdMarkDirty?.();
  root.cdSyncPush?.();
  /* La Home si rifa' subito: chi ha appena scritto la soglia vuole vedere se
   * ci siamo dentro, non scoprirlo al prossimo cambio di stato. */
  try {
    renderHomeWidgets();
  } catch (_errore) {}
  schedule();
}

/* ─────────────────────────── la scheda in config ────────────────────────── */

/* Come si chiama, per esteso, il carico che si sta sorvegliando. */
function nomeDellaSorgente(sorgente) {
  return sorgente === SORGENTE_RETE
    ? t("Carico di rete", "Grid load")
    : t("Carico di casa", "Home load");
}

/* Perche' si sceglie l'uno o l'altro. Sono due domande diverse, e chi ha un
 * fotovoltaico se ne accorge subito: la casa puo' tirare sei chilowatt col
 * contatore fermo, perche' li sta facendo il sole. */
function spiegaLaSorgente(sorgente) {
  return sorgente === SORGENTE_RETE
    ? t(
        "Quanto sta passando dal contatore. È la soglia di chi teme il distacco: il limite del contratto sta qui. L'energia immessa in rete non conta mai come sovraccarico.",
        "How much is going through the meter. This is the threshold for those worried about a cut-off: the contract limit lives here. Energy exported to the grid never counts as an overload.",
      )
    : t(
        "Quanto stanno consumando gli apparecchi, da qualunque parte arrivi la corrente. È la soglia di chi ha il fotovoltaico e vuole sapere quanto tira la casa.",
        "How much the appliances are drawing, wherever the power comes from. This is the threshold for those with solar who want to know what the house is pulling.",
      );
}

/* Il numero di adesso, sotto ai campi.
 *
 * Una soglia si sceglie guardando quanto si consuma davvero: senza questa riga
 * si tira a indovinare, e si scopre di aver messo il numero sbagliato solo
 * quando la tessera resta rossa per due giorni. */
function rigaDiAdesso(sorgente) {
  const letture = lettureDiCasa();
  const verdetto = livelloDellaPotenza({ sorgente }, letture);
  if (verdetto.watt === null)
    return t("Adesso non c'è una lettura per questo carico.", "There is no reading for this load right now.");
  return `${t("Adesso", "Right now")}: ${formatWatts(verdetto.watt)}`;
}

function schedaMarkup(soglia) {
  const voce = (valore, etichetta) =>
    `<button type="button" class="dm-soglia-scelta" data-dm-soglia-sorgente="${esc(valore)}"
      aria-pressed="${soglia.sorgente === valore}"${soglia.sorgente === valore ? ' data-on="true"' : ""}>${esc(etichetta)}</button>`;
  const campo = (nome, etichetta, valore, esempio) =>
    `<label class="dm-soglia-campo">
      <span>${esc(etichetta)} <small>W</small></span>
      <input class="ed-input" type="number" inputmode="numeric" min="0" step="100"
        data-dm-soglia="${esc(nome)}" value="${valore == null ? "" : esc(String(valore))}"
        placeholder="${esc(esempio)}">
    </label>`;
  return `
    <div class="ed-sec-title">⚠️ ${esc(t("Soglia di potenza", "Power threshold"))}</div>
    <div class="ed-hint">${esc(
      t(
        "Sopra la soglia la tessera Energia in Home cambia colore: ambra per tenerla d'occhio, rossa per il sovraccarico. Lascia vuoto un campo per non usarlo.",
        "Above the threshold the Energy tile on Home changes colour: amber to keep an eye on it, red for an overload. Leave a field empty to skip it.",
      ),
    )}</div>
    <div class="dm-soglia-scelte" role="group" aria-label="${esc(t("Carico da sorvegliare", "Load to watch"))}">
      ${voce(SORGENTE_CASA, nomeDellaSorgente(SORGENTE_CASA))}
      ${voce(SORGENTE_RETE, nomeDellaSorgente(SORGENTE_RETE))}
    </div>
    <small class="dm-soglia-spiega">${esc(spiegaLaSorgente(soglia.sorgente))}</small>
    <div class="dm-soglia-grid">
      ${campo("ambra", t("Ambra da", "Amber from"), soglia.ambra, "3000")}
      ${campo("rossa", t("Rossa da", "Red from"), soglia.rossa, "3300")}
    </div>
    <small class="dm-soglia-ora" data-dm-soglia-ora>${esc(rigaDiAdesso(soglia.sorgente))}</small>
    <button type="button" class="ed-save-btn" data-dm-soglia-salva>💾 ${esc(
      t("Salva soglia", "Save threshold"),
    )}</button>`;
}

function ensureScheda() {
  const editor = doc?.querySelector?.(
    '#ed-body[data-editor="energy"],#editor-modal [data-editor="energy"]',
  );
  const impostazioni = editor?.querySelector?.('[data-energy-panel="settings"]');
  if (!impostazioni) return;
  let scheda = impostazioni.querySelector("#dm-energia-soglia");
  if (!scheda) {
    scheda = doc.createElement("div");
    scheda.id = "dm-energia-soglia";
    scheda.className = "ed-form dm-soglia-card";
    impostazioni.append(scheda);
  }
  const soglia = sogliaDiCasa();
  const firma = `${soglia.sorgente}§${soglia.ambra ?? ""}§${soglia.rossa ?? ""}`;
  if (scheda.dataset.firma === firma) {
    /* La struttura e' la stessa, ma il numero di adesso no: quello si muove da
     * solo mentre la scheda sta aperta, ed e' l'unica cosa da riscrivere.
     * Rifare tutto il markup a ogni cambio di stato vorrebbe dire strappare il
     * campo da sotto le dita di chi ci sta scrivendo dentro.
     *
     * E lo si riscrive solo se la linguetta e' quella aperta: le letture di
     * casa costano, e chi sta compilando i flussi non deve pagarle a ogni
     * cambio di stato per una riga che non ha davanti. */
    if (impostazioni.hidden) return;
    const ora = scheda.querySelector("[data-dm-soglia-ora]");
    const testo = rigaDiAdesso(soglia.sorgente);
    if (ora && ora.textContent !== testo) ora.textContent = testo;
    return;
  }
  scheda.dataset.firma = firma;
  scheda.innerHTML = schedaMarkup(soglia);
}

/* ───────────────────────── la striscia sulla pagina ─────────────────────── */

/* La stessa verita', dove si guarda l'istantanea.
 *
 * La tessera in Home si colora, e chi entra nell'Energia per capire cosa sta
 * succedendo troverebbe la stessa casa senza una parola: la striscia dice cosa
 * e' scattato e oltre quale numero. Quando si e' in quiete non c'e': una riga
 * che dice «tutto bene» e' una riga in piu' da leggere per sempre. */
function ensureStriscia() {
  const vista = doc?.getElementById?.("view-ist");
  if (!vista) return;
  /* Le letture di casa costano: sono quattro impianti per quattro gruppi, e
   * questa funzione passa a ogni cambio di stato — in una casa vera piu' volte
   * al secondo. Farle per una pagina che nessuno sta guardando e' il genere di
   * lavoro che scalda il mini PC senza cambiare un pixel. */
  if (!paginaVisibile("page-energy")) return;
  const verdetto = sovraccaricoDiAdesso();
  let striscia = vista.querySelector("#dm-soglia-striscia");
  if (verdetto.livello === LIVELLO_QUIETE) {
    striscia?.remove();
    return;
  }
  if (!striscia) {
    striscia = doc.createElement("div");
    striscia.id = "dm-soglia-striscia";
    striscia.className = "dm-soglia-striscia";
    vista.prepend(striscia);
  }
  const livello = verdetto.livello === LIVELLO_AMBRA ? "ambra" : "rossa";
  if (striscia.dataset.livello !== livello) striscia.dataset.livello = livello;
  const testo = `⚠️ ${t("Sovraccarico", "Overload")} · ${nomeDellaSorgente(verdetto.sorgente)} ${formatWatts(
    verdetto.watt,
  )} ${t("oltre", "over")} ${formatWatts(verdetto.limite)}`;
  if (striscia.textContent !== testo) striscia.textContent = testo;
}

/* ─────────────────────────────────── giro ───────────────────────────────── */

function repaint() {
  state.frame = 0;
  ensureScheda();
  ensureStriscia();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(repaint) || root.setTimeout?.(repaint, 0) || 0;
}

/* I due numeri come stanno nei campi adesso.
 *
 * La sorgente non si legge da qui: e' una pillola, e la pillola scrive subito.
 * Rileggerla dal markup vorrebbe dire due posti in cui e' scritta la stessa
 * scelta, e sarebbero due finche' non divergono. */
function numeriDellaScheda(scheda) {
  const preso = (nome) => clean(scheda.querySelector(`[data-dm-soglia="${nome}"]`)?.value);
  const { ambra, rossa } = sogliaDellaPotenza({ ambra: preso("ambra"), rossa: preso("rossa") });
  return { ambra, rossa };
}

export function installLaSogliaDellaPotenza() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", (event) => {
    const scelta = event.target?.closest?.("[data-dm-soglia-sorgente]");
    if (scelta) {
      /* La sorgente si applica subito: e' una risposta a una domanda, non un
       * numero da rileggere: e cambiandola cambia anche la riga «adesso», che
       * e' quello che serve per scegliere il numero giusto. */
      const scheda = scelta.closest("#dm-energia-soglia");
      const numeri = scheda ? numeriDellaScheda(scheda) : sogliaDiCasa();
      salva({ ...numeri, sorgente: clean(scelta.getAttribute("data-dm-soglia-sorgente")) });
      return;
    }
    const salvataggio = event.target?.closest?.("[data-dm-soglia-salva]");
    if (!salvataggio) return;
    const scheda = salvataggio.closest("#dm-energia-soglia");
    if (!scheda) return;
    /* I numeri si salvano quando lo si chiede, come il costo del kWh nella
     * scheda accanto: un tasto premuto per sbaglio non deve poter cambiare il
     * colore di una tessera senza che nessuno l'abbia voluto. */
    salva({ ...numeriDellaScheda(scheda), sorgente: sogliaDiCasa().sorgente });
  });
  onEditorRedraw("__dmSogliaPotenzaSection", schedule);
  for (const evento of [
    "dashboardmodern:editor-rendered",
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:config-reset",
  ])
    root.addEventListener?.(evento, schedule);
  schedule();
}

function installStyles() {
  installStyle(
    "dm-soglia-potenza-style",
    `
      .dm-soglia-card{display:grid;gap:9px}
      .dm-soglia-scelte{display:flex;gap:8px;flex-wrap:wrap}
      .dm-soglia-scelta{
        flex:1 1 150px;padding:9px 13px;border-radius:14px;font:inherit;font-size:12.5px;
        font-weight:800;cursor:pointer;text-align:center;
        border:1px solid var(--card-border,#e2e8f0);background:var(--card-background-color,#fff);
        color:inherit}
      .dm-soglia-scelta[data-on="true"]{
        border-color:var(--primary-color,#0ea5e9);
        box-shadow:0 0 0 1px var(--primary-color,#0ea5e9) inset}
      .dm-soglia-spiega{color:var(--secondary-text-color,#94a3b8);font-size:11px;font-weight:700;line-height:1.45}
      .dm-soglia-grid{display:flex;gap:10px;flex-wrap:wrap}
      .dm-soglia-campo{flex:1 1 140px;display:grid;gap:5px}
      .dm-soglia-campo span{font-size:11.5px;font-weight:800;letter-spacing:.4px}
      .dm-soglia-campo small{font-weight:700;opacity:.6}
      .dm-soglia-ora{color:var(--secondary-text-color,#94a3b8);font-size:11.5px;font-weight:800}

      /* La striscia sulla pagina Energia: larga quanto la vista, sopra il
         flusso, e coi due colori della segnalazione. */
      .dm-soglia-striscia{
        display:block;margin:0 0 12px;padding:10px 14px;border-radius:14px;
        font-size:12.5px;font-weight:800;letter-spacing:.3px;line-height:1.35}
      .dm-soglia-striscia[data-livello="ambra"]{
        background:color-mix(in srgb,#f59e0b 16%,var(--card-bg,#fff));
        color:#b45309;box-shadow:inset 0 0 0 1px color-mix(in srgb,#f59e0b 45%,transparent)}
      .dm-soglia-striscia[data-livello="rossa"]{
        background:color-mix(in srgb,#dc2626 16%,var(--card-bg,#fff));
        color:#b91c1c;box-shadow:inset 0 0 0 1px color-mix(in srgb,#dc2626 45%,transparent)}
    `,
  );
}
