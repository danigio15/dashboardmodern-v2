import { doc, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENERGY_REFRESH_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  refreshQueued: false,
});

export function initializeEnergyPeriodControls(now = new Date(), documentRef = doc) {
  const month = documentRef?.getElementById("ed-sel-month");
  const year = documentRef?.getElementById("ed-sel-year");
  if (!month || !year) return false;

  // The legacy HTML starts with January selected and only changes it later in
  // renderEnergyDashboard(). The canonical runtime can schedule its first
  // Recorder request before that legacy initialization, leaving January data
  // behind an August label until the user manually changes month.
  if (!month.dataset.init) {
    month.value = String(now.getMonth() + 1);
    year.value = String(now.getFullYear());
    month.dataset.init = "1";
    year.dataset.dmPeriodInit = "current";
  }
  return true;
}

/* Qui c'era una pellicola sopra `broker.statistics` che riscriveva a cinque
 * minuti OGNI domanda a ore del giorno in corso.
 *
 * Nasceva da un problema vero — le statistiche dell'ora si compilano a ora
 * finita, quindi dentro l'ora aperta non c'e' nessuna riga e la Giornaliera
 * restava indietro fino a sessanta minuti — ma la pagava tutta la giornata:
 * 288 righe per ogni entita' a ogni giro invece di 26, per ogni fonte, ogni
 * dispositivo e ogni carico. Su un Recorder che sta su un disco lento e'
 * proprio il conto che lo fa scadere.
 *
 * Adesso il giorno si chiede in due archi — le ore chiuse a ore, l'ora aperta
 * a cinque minuti — e lo fa chi costruisce gli archi
 * (`archiDelPeriodo` in period-service.js), cioe' un posto solo per tutti
 * quelli che chiedono: l'Energia, gli elettrodomestici, i carichi. Una
 * pellicola che riscrive di nascosto le domande altrui era anche un secondo
 * padrone su cosa si chiede al Recorder. */

/* Si chiede al servizio, che decide: con un pacchetto fresco in mano non parte
 * nessuna domanda al Recorder, si ridisegna quello che c'e'. La regola di cosa
 * sia fresco vive nell'Energia, che e' anche l'unica a sapere quando ha letto
 * l'ultima volta: qui non se ne tiene una copia. */
function queueRefresh() {
  initializeEnergyPeriodControls();
  if (state.refreshQueued) return;
  state.refreshQueued = true;
  root.queueMicrotask?.(() => {
    state.refreshQueued = false;
    root.DashboardModernEnergyService?.refresh?.();
  });
}

export function installEnergyRefreshSection() {
  if (!doc || state.installed) return;
  state.installed = true;

  // Synchronous on purpose: this runs in the same module turn as Energy and
  // therefore beats the setTimeout(0) used by its first scheduled refresh.
  initializeEnergyPeriodControls();

  root.addEventListener?.("dashboardmodern:states-ready", () => queueRefresh());
  root.addEventListener?.("dashboardmodern:legacy-ready", () => queueRefresh());
  root.addEventListener?.("pageshow", () => queueRefresh());

  /* Cambiare linguetta non cambia i numeri: cambia quali si guardano.
   *
   * Qui QUALUNQUE clic dentro la Panoramica, il Mese, una sotto-linguetta o
   * una scheda dell'Energia faceva partire un aggiornamento intero — sette
   * letture del Recorder, oggi tre — anche a mezzo secondo dal precedente:
   * chi guarda i tre riquadri uno dopo l'altro ne pagava uno per tocco, e sul
   * mini PC quello e' proprio il momento in cui il Recorder arranca. Il
   * pacchetto che c'e' contiene gia' giorno, mese, anno e dispositivi: si
   * proietta (lo fa `energy-section` sullo stesso clic) e si chiede soltanto
   * se e' piu' vecchio della cadenza. */
  doc.addEventListener(
    "click",
    (event) => {
      const target = event.target?.closest?.(
        "[data-tab='energy'],.sub-tab-btn,[data-energy-tab],#view-panoramica,#view-month",
      );
      if (!target) return;
      // Let the legacy click handler finish selecting the view first.
      root.setTimeout?.(() => queueRefresh(), 0);
    },
    true,
  );

  doc.addEventListener("change", (event) => {
    if (!event.target?.matches?.("#ed-sel-month,#ed-sel-year")) return;
    const month = doc.getElementById("ed-sel-month");
    const year = doc.getElementById("ed-sel-year");
    if (month) month.dataset.init = "1";
    if (year) year.dataset.dmPeriodInit = "user";
  });
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEnergyRefreshSection, { once: true });
else installEnergyRefreshSection();
