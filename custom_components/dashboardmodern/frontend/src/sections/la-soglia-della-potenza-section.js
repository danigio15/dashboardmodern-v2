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
  LIVELLO_ROSSA,
  SOGLIA_POTENZA_KEY,
  SORGENTE_CASA,
  SORGENTE_RETE,
  livelloDellaPotenza,
  sogliaDellaPotenza,
  sogliaScritta,
} from "../core/la-soglia-della-potenza.js";
import { intlLocale } from "../core/i18n.js";
import { disegnoDelCatalogo } from "../core/catalogo-disegni.js";
import { corsiaDegliAvvisi } from "./come-sta-la-casa-section.js";
import { durataDellaDeriva, spazioDaPercorrere } from "../core/la-fascia-deriva.js";
import { formatWatts as wattScritti } from "../core/subload-popup-model.js";
import { lettureDiCasa, renderHomeWidgets } from "./home-widgets-section.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  paginaVisibile,
  quandoSiCambiaPagina,
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
    return t(
      "Adesso non c'è una lettura per questo carico.",
      "There is no reading for this load right now.",
    );
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
  /* Chi non ha scritto la soglia non paga niente.
   *
   * Questa funzione passa a ogni cambio di stato — in una casa vera piu' volte
   * al secondo — e le letture di casa costano: quattro gruppi per ogni
   * impianto, piu' il giro delle sorgenti del giorno. Senza soglia scritta non
   * c'e' niente da disegnare, quindi non c'e' niente da leggere: la domanda da
   * fare per prima e' la sola che non costa. Farla dopo voleva dire misurare
   * l'intera casa settanta volte per scoprire ogni volta che non si colora
   * nulla — e sulla pagina Energia, dove l'Energia sta gia' lavorando, quel
   * lavoro in piu' si sente. */
  const soglia = sogliaDiCasa();
  const disegnata = vista.querySelector("#dm-soglia-striscia");
  if (!sogliaScritta(soglia)) {
    disegnata?.remove();
    return;
  }
  /* E nemmeno per una pagina che nessuno sta guardando. */
  if (!paginaVisibile("page-energy")) return;
  const verdetto = livelloDellaPotenza(soglia, lettureDiCasa());
  let striscia = disegnata;
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

/* ── l'allerta in Home, quando il rosso e' rosso davvero ──────────────── */

/* Il numero che salta non e' una didascalia.
 *
 * La soglia colorava la tessera dell'energia e scriveva una striscia nella
 * pagina Energia. Ma chi apre la plancia guarda la Home, e in Home il
 * sovraccarico era una tessera arancione fra le altre e una riga di testo che
 * scorre: si vede se la si cerca. Un contatore che sta per saltare non e' una
 * cosa da cercare.
 *
 * Quindi in Home, e SOLO sul rosso — l'ambra e' un «occhio», il rosso e'
 * «adesso salta» — sopra ogni altra cosa compare un riquadro che si vede da
 * lontano: il disegno del nostro catalogo, la parola, i due numeri grandi, e
 * un alone che respira. Si tocca e porta all'Energia, dove c'e' il resto.
 *
 * Non ha un tasto per chiuderla, ed e' voluto: se ne va da sola quando il
 * carico rientra, che e' l'unico momento in cui non serve piu'. Una chiusura a
 * mano su una cosa che dura pochi minuti vorrebbe dire nasconderla e
 * dimenticarsene.
 */
const ID_ALLERTA = "dm-soglia-allerta";

function laHome() {
  const pagina = doc?.getElementById?.("page-home");
  return pagina?.classList?.contains("active") ? pagina : null;
}

/* Il disegno dice DI CHE sovraccarico si tratta.
 *
 * «In questo caso il sovraccarico e' casa, devi mettere quell'icona; se
 * sovraccarico rete la cambi.» Sono due allarmi diversi: il carico di casa e'
 * quanto stanno tirando gli apparecchi, il carico di rete e' quanto passa dal
 * contatore — chi ha il fotovoltaico puo' avere il primo alto e il secondo
 * fermo. Il disegno lo dice prima delle parole. */
function disegnoDellaSorgente(sorgente) {
  /* «rete» nel catalogo e' il router: la rete di CASA, quella dei cavi e del
   * wi-fi. Qui si parla della rete ELETTRICA, e un router sopra un allarme di
   * sovraccarico dice una cosa falsa. Il disegno della potenza e' quello
   * giusto — e' la stessa grandezza che la card misura — e la parola sotto
   * distingue i due allarmi senza bisogno di due disegni. */
  return disegnoDelCatalogo(sorgente === SORGENTE_RETE ? "potenza" : "casa", 40);
}

function ensureAllertaInHome() {
  const pagina = laHome();
  const gia = doc?.getElementById?.(ID_ALLERTA);
  if (!pagina) {
    /* Fuori dalla Home non si tiene in piedi: la si rifa' rientrando, e
       intanto non resta appesa a una pagina che nessuno guarda. */
    gia?.remove();
    return;
  }
  const soglia = sogliaDiCasa();
  if (!sogliaScritta(soglia)) {
    gia?.remove();
    return;
  }
  const verdetto = livelloDellaPotenza(soglia, lettureDiCasa());
  if (verdetto.livello !== LIVELLO_ROSSA) {
    gia?.remove();
    return;
  }
  const allerta = gia || doc.createElement("button");
  if (!gia) {
    allerta.id = ID_ALLERTA;
    allerta.type = "button";
    allerta.className = "dm-soglia-allerta";
    allerta.addEventListener("click", () => {
      try {
        root.cdGoTo?.("energy") || doc.querySelector('.tab[data-tab="energy"]')?.click();
      } catch (_errore) {}
    });
  }
  const dove = nomeDellaSorgente(verdetto.sorgente);
  const misura = `${formatWatts(verdetto.watt)} / ${formatWatts(verdetto.limite)}`;
  const firma = `${verdetto.sorgente}|${dove}|${misura}`;
  if (allerta.dataset.firma !== firma) {
    allerta.dataset.firma = firma;
    /* La stessa anatomia delle pastiglie che le stanno accanto — il disegno
     * nel riquadro tinto, il numero grosso, la parolina maiuscola sotto —
     * perche' stanno sulla stessa riga e due grammatiche diverse a dieci pixel
     * di distanza si vedono. Quello che cambia e' il tono, ed e' giusto che
     * cambi solo quello: e' l'unica differenza che conta. */
    allerta.innerHTML = `<span class="dm-casa-chip" aria-hidden="true">${disegnoDellaSorgente(
      verdetto.sorgente,
    )}</span>
      <span class="dm-casa-testo">
        <b class="dm-casa-testa">${esc(misura)}</b>
        <small class="dm-casa-coda"><span class="dm-soglia-nastro">${esc(
          t("Sovraccarico", "Overload"),
        )} · ${esc(dove)}</span></small>
      </span>`;
    allerta.title = t("Tocca per aprire l'Energia", "Tap to open Energy");
  }
  /* La parolina deriva se non ci sta, con la stessa animazione della fascia
   * accanto e le stesse due funzioni che ne misurano strada e durata: due
   * derive scritte due volte sarebbero due velocita' diverse a dieci pixel di
   * distanza. Quanto e' larga la scritta lo sa solo chi ha il documento in
   * mano, e lo si chiede a disegno finito — non a ogni fotogramma. */
  tieniLaParolaInMovimento(allerta.querySelector(".dm-casa-coda"));
  /* Nella corsia, e sempre per prima: quello che chiede attenzione si legge
     prima di quello che descrive come sta la casa. */
  const corsia = corsiaDegliAvvisi() || pagina;
  if (allerta.parentElement !== corsia || corsia.firstElementChild !== allerta)
    corsia.prepend(allerta);
}

/* La strada della parolina, detta al foglio una volta per disegno.
 *
 * Riusa `spazioDaPercorrere` e `durataDellaDeriva` della fascia: la velocita'
 * di lettura e' una proprieta' di chi legge, non del pezzo che si muove, e
 * venticinque pixel al secondo qui e trenta di la' si vedrebbero. Senza strada
 * non si accende niente: una scritta che ci sta tutta e che ballonzolasse
 * direbbe che c'e' dell'altro quando non c'e'.
 */
function tieniLaParolaInMovimento(coda) {
  const nastro = coda?.querySelector(":scope > .dm-soglia-nastro");
  if (!coda || !nastro) return false;
  /* La misura si chiede alla CODA, non al nastro che ci sta dentro.
   *
   * Il nastro nasce `inline` e diventa `inline-block` solo quando la deriva e'
   * gia' accesa: su un elemento inline `scrollWidth` non dice quanto e' larga
   * la scritta, e misurando li' la strada risultava sempre zero — la parolina
   * non si muoveva mai, e il difetto non si vedeva perche' «ferma» e' anche
   * l'aspetto giusto di una scritta che ci sta. La coda invece e' un blocco
   * che taglia quello che esce: il suo `scrollWidth` E' la scritta intera. */
  const strada = spazioDaPercorrere({
    scrollWidth: coda.scrollWidth,
    clientWidth: coda.clientWidth,
  });
  if (!strada) {
    delete coda.dataset.dmDeriva;
    coda.style.removeProperty("--dm-casa-strada");
    coda.style.removeProperty("--dm-casa-durata");
    return false;
  }
  coda.style.setProperty("--dm-casa-strada", `${strada}px`);
  coda.style.setProperty("--dm-casa-durata", `${durataDellaDeriva(strada)}s`);
  coda.dataset.dmDeriva = "true";
  return true;
}

/* ─────────────────────────────────── giro ───────────────────────────────── */

function repaint() {
  state.frame = 0;
  ensureScheda();
  ensureStriscia();
  ensureAllertaInHome();
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
  /* E al cambio di pagina.
   *
   * L'allerta vive solo in Home e fuori si toglie da se'. Il sovraccarico
   * pero' comincia quando comincia: se comincia mentre si sta in Energia, il
   * disegno di quel momento la toglie (giustamente), e tornando in Home non
   * c'e' niente che la rimetta finche' non passa un'altra notizia della casa.
   * Su un contatore che sta per saltare «finche' non passa» e' troppo. */
  quandoSiCambiaPagina(schedule);
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

      /* L'allerta accanto alla fascia di cosa e' acceso: stesso vestito —
         stesso raggio, stesso bordo, stesso fondo, stessa ombra — piu' il filo
         rosso e un alone che respira. Omogenea si', confondibile no: e' la
         sola cosa della riga che chiede di fare qualcosa adesso.

         Non si stringe e non scorre: la fascia accanto deriva da se', questa
         resta ferma dove la si e' letta. */
      .dm-soglia-allerta{
        flex:0 0 auto;display:inline-flex;align-items:center;gap:10px;
        margin:0;padding:6px 14px 6px 6px;border-radius:20px;
        border:1px solid color-mix(in srgb,#dc2626 42%,transparent);
        background:var(--card-bg,#fff);
        text-align:left;cursor:pointer;font:inherit;color:var(--text,#0f172a);
        box-shadow:0 6px 18px -12px rgba(15,23,42,.28);
        animation:dm-soglia-respiro 2.4s ease-in-out infinite}
      .dm-soglia-allerta:active{transform:scale(.98)}
      /* Il riquadro del disegno e le due righe sono quelli delle pastiglie —
         le classi sono le loro, non una seconda copia scritta di qua — e qui
         si tinge soltanto. */
      .dm-soglia-allerta .dm-casa-chip{
        background:color-mix(in srgb,#dc2626 14%,transparent);color:#dc2626}
      .dm-soglia-allerta .dm-casa-testa{color:#b91c1c}
      .dm-soglia-allerta .dm-casa-coda{color:#dc2626}
      @keyframes dm-soglia-respiro{
        0%,100%{box-shadow:0 6px 18px -12px rgba(15,23,42,.28)}
        50%{box-shadow:0 6px 18px -12px rgba(15,23,42,.28),
          0 0 0 6px color-mix(in srgb,#dc2626 12%,transparent)}}
      @media(prefers-reduced-motion:reduce){
        .dm-soglia-allerta{animation:none}}
      /* La parolina scorre invece di essere tagliata.
         La card si e' stretta — sta accanto alla fascia, e piu' prende lei
         meno ne resta all'altra — quindi «Sovraccarico · Carico di casa» non
         ci sta piu'. Troncarla con i puntini perde meta' della frase per
         sempre; farla derivare la fa leggere tutta, un pezzo per volta.
         L'animazione e le due misure sono quelle della fascia accanto, non una
         seconda copia: due derive scritte due volte sarebbero due velocita'
         diverse a dieci pixel di distanza.
         Il numero invece non si muove e non si taglia MAI: e' il motivo per
         cui l'avviso esiste, e uno che scorre non si legge a colpo d'occhio. */
      .dm-soglia-allerta .dm-casa-testo{min-width:0}
      .dm-soglia-allerta .dm-casa-testa{
        display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dm-soglia-allerta .dm-casa-coda{
        display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
      .dm-soglia-allerta .dm-casa-coda[data-dm-deriva="true"]{text-overflow:clip}
      .dm-soglia-allerta .dm-casa-coda[data-dm-deriva="true"] > .dm-soglia-nastro{
        display:inline-block;
        animation:dm-casa-deriva var(--dm-casa-durata,12s) ease-in-out infinite alternate}
      /* Chi ci mette il dito sopra comanda lui, come sulla fascia. */
      .dm-soglia-allerta:hover .dm-soglia-nastro,
      .dm-soglia-allerta:active .dm-soglia-nastro{animation-play-state:paused}
      /* Chi ha chiesto meno animazioni non vede muovere niente, e allora la
         frase torna a essere tagliata dai puntini: meglio mezza scritta ferma
         che una scritta che si muove contro la sua volonta'. */
      @media(prefers-reduced-motion:reduce){
        .dm-soglia-allerta .dm-casa-coda[data-dm-deriva="true"]{text-overflow:ellipsis}
        .dm-soglia-allerta .dm-casa-coda[data-dm-deriva="true"] > .dm-soglia-nastro{
          display:inline;animation:none}}
      /* Sul telefono la card e' piu' piccola: il disegno, le due scritte e i
         bordi interni scendono tutti insieme, se no si stringe il contenuto
         dentro una scatola che resta grande. Il tetto passa dal 56% al 46%,
         cosi' alla fascia accanto resta piu' di una pastiglia.
         Il tetto pero' non arriva a toccare il numero. Su uno schermo da 360
         pixel il 46% sono 165, e tolti il disegno, lo spazio fra i due e i
         bordi ne restano 116 per «9,50 kW / 7,00 kW», che ne vuole 135: la
         misura finiva nei puntini, cioe' spariva proprio la cosa per cui
         l'avviso esiste. Il pavimento della pastiglia e' la misura — quando
         il tetto scenderebbe sotto, vince il pavimento, che e' quello che il
         foglio di stile fa da se' — e a stringersi resta la fascia accanto,
         che scorre apposta. Perche' il pavimento sia la MISURA e non l'intera
         pastiglia, la parolina si fa dettare la larghezza dalla colonna
         invece di dettarla: «width:0» la toglie dal conto della larghezza
         naturale, «min-width:100%» le ridA' la colonna intera per disegnarsi.
         Senza, il pavimento verrebbe «Sovraccarico · Carico di casa» e la
         pastiglia si prenderebbe tutta la riga. Sul telefono la pastiglia e'
         quindi larga quanto il numero, e la parolina deriva: e' esattamente
         quello che deve fare quando non ci sta, ed e' scritto qui sopra. */
      @media(max-width:560px){
        .dm-soglia-allerta{
          flex:0 1 auto;min-width:min-content;max-width:46%;padding:4px 9px 4px 4px;gap:6px}
        .dm-soglia-allerta .dm-casa-coda{width:0;min-width:100%}
        .dm-soglia-allerta .dm-casa-chip{width:30px;height:30px;border-radius:10px}
        .dm-soglia-allerta .dm-casa-chip svg{width:16px;height:16px}
        .dm-soglia-allerta .dm-casa-testa{font-size:13.5px}
        .dm-soglia-allerta .dm-casa-coda{font-size:8px;letter-spacing:.8px}}
    `,
  );
}
