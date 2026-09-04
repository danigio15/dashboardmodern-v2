/* Il periodo nella cronologia della connettivita' e dell'inverter (#302).
 *
 * «La modifica eseguita su tutti i popup dove si vede lo storico.» La
 * cronologia dei cambi di stato — connettivita', inverter — e' l'altro popup
 * dello storico, e il guscio la apre sempre sugli ultimi sette giorni, con il
 * sottotitolo scritto a mano. Il guscio resta com'e' per quell'apertura; da
 * qui in poi una barra dei periodi sotto il titolo rilegge lo stesso sensore
 * per il periodo scelto — di serie o da quando a quando — e ridisegna la
 * cronologia con le stesse righe, dallo stesso Recorder.
 */
import {
  PERIODI,
  daInputLocale,
  intervalloDa,
  intervalloPersonalizzato,
  nomeDelPeriodo,
  perInputLocale,
} from "../core/periodo-storico.js";
import { normalizeHistoryRows, parolaDelPeriodo } from "./history-section.js";
import {
  clean,
  doc,
  esc,
  gettoneDiAccesso,
  installStyle,
  locale,
  root,
  t,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_STORICO_CONNETTIVITA__";
const state = (root[KEY] ||= { installed: false, tipo: "", generazione: 0, intervallo: null });

/* I periodi che hanno senso su una cronologia di cambi di stato: un'ora di
 * connettivita' dice poco, due mesi dicono molto. */
const PERIODI_CRONOLOGIA = PERIODI.filter((periodo) => periodo.ore >= 24);

/* Le stesse parole del guscio, nella lingua giusta. */
function statiDi(tipo) {
  if (tipo === "inverter")
    return {
      sensore: "dm.energy_stato_rete",
      mappa: {
        on: { label: t("🟢 Connesso alla rete", "🟢 On grid"), cls: "ongrid", col: "#10b981" },
        "on-grid": { label: t("🟢 Connesso alla rete", "🟢 On grid"), cls: "ongrid", col: "#10b981" },
        on_grid: { label: t("🟢 Connesso alla rete", "🟢 On grid"), cls: "ongrid", col: "#10b981" },
        off: { label: t("🟡 Isolato dalla rete", "🟡 Off grid"), cls: "offgrid", col: "#f59e0b" },
        "off-grid": { label: t("🟡 Isolato dalla rete", "🟡 Off grid"), cls: "offgrid", col: "#f59e0b" },
        off_grid: { label: t("🟡 Isolato dalla rete", "🟡 Off grid"), cls: "offgrid", col: "#f59e0b" },
        unavailable: { label: t("⚫ Non disp.", "⚫ Unavailable"), cls: "unknown", col: "#94a3b8" },
      },
    };
  return {
    sensore: "dm.server_raggiungibilita_google",
    mappa: {
      on: { label: t("🟢 Online", "🟢 Online"), cls: "connected", col: "#10b981" },
      off: { label: t("🔴 Offline", "🔴 Offline"), cls: "disconnected", col: "#ef4444" },
      unavailable: { label: t("⚫ Non disp.", "⚫ Unavailable"), cls: "unknown", col: "#94a3b8" },
    },
  };
}

function entitaDi(riferimento) {
  try {
    const risolta = clean(root.resolveEntity?.(riferimento));
    if (risolta && risolta !== riferimento) return risolta;
  } catch (_error) {}
  return riferimento;
}

/** I cambi di stato, dal piu' recente, come li mostra il guscio. */
export function cambiDiStato(righe, massimo = 30) {
  const cambi = [];
  let ultimo = null;
  for (const riga of righe || []) {
    const stato = clean(riga?.state).toLowerCase();
    const quando = Number(riga?.time);
    if (!stato || !Number.isFinite(quando)) continue;
    if (stato !== ultimo) {
      cambi.push({ stato, quando });
      ultimo = stato;
    }
  }
  return cambi.reverse().slice(0, massimo);
}

export function durata(da, a) {
  const ms = Math.max(0, a - da);
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const g = Math.floor(h / 24);
  if (g > 0) return `${g}g ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

function cronologiaMarkup(cambi, mappa) {
  if (!cambi.length)
    return `<div style="text-align:center;padding:24px;color:var(--text-dim)">${esc(t("Nessun cambio di stato", "No state change"))}</div>`;
  const scrivi = (ms) =>
    new Date(ms).toLocaleDateString(locale(), {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  return cambi
    .map((voce, i) => {
      const info = mappa[voce.stato] || { label: voce.stato, cls: "unknown", col: "#94a3b8" };
      const seguente = cambi[i - 1];
      const quanto = seguente ? durata(voce.quando, seguente.quando) : null;
      const ultimo = i === cambi.length - 1;
      return `<div class="srv-history-event">
        <div class="srv-event-dot-wrap">
          <div class="srv-event-dot ${esc(info.cls)}" style="background:${esc(info.col)};box-shadow:0 0 0 1.5px ${esc(info.col)};"></div>
          ${ultimo ? "" : '<div class="srv-event-line"></div>'}
        </div>
        <div class="srv-event-info">
          <div class="srv-event-state" style="color:${esc(info.col)}">${esc(info.label)}</div>
          <div class="srv-event-time">${esc(scrivi(voce.quando))}</div>
          ${quanto ? `<div class="srv-event-duration">${esc(t("Durata", "Duration"))}: ${esc(quanto)}</div>` : ""}
        </div>
      </div>`;
    })
    .join("");
}

/* La domanda al Recorder passa dalla stessa porta REST del guscio: e' quella
 * che la cornice sa gia' rimettere a posto quando la plancia vive in un
 * riquadro ospitato. */
async function storicoDi(entity, intervallo) {
  const base = clean(root.HA_HTTP_URL) || "";
  const inizio = new Date(intervallo.start).toISOString();
  const fine = new Date(intervallo.end).toISOString();
  const url = `${base}/api/history/period/${inizio}?filter_entity_id=${encodeURIComponent(entity)}&end_time=${encodeURIComponent(fine)}&significant_changes_only=false`;
  const token = gettoneDiAccesso();
  const risposta = await root.fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
  if (!risposta?.ok) throw new Error(`HTTP ${risposta?.status}`);
  return normalizeHistoryRows(await risposta.json(), entity);
}

async function ricarica(intervallo) {
  const tipo = state.tipo;
  const cronologia = doc?.getElementById("srv-hist-timeline");
  const sottotitolo = doc?.getElementById("srv-hist-subtitle");
  if (!cronologia || !tipo) return false;
  const { sensore, mappa } = statiDi(tipo);
  const generazione = ++state.generazione;
  state.intervallo = intervallo;
  sincronizzaBarra(intervallo);
  if (sottotitolo)
    sottotitolo.textContent = intervallo.personalizzato
      ? nomeDelPeriodo(intervallo, locale())
      : parolaDelPeriodo(PERIODI.find((periodo) => periodo.ore === intervallo.ore)) || nomeDelPeriodo(intervallo, locale());
  cronologia.innerHTML = `<div class="srv-hist-loading"><div class="srv-hist-spinner"></div>${esc(t("Caricamento storico...", "Loading history..."))}</div>`;
  try {
    const righe = await storicoDi(entitaDi(sensore), intervallo);
    if (generazione !== state.generazione) return false;
    if (!righe.length) {
      cronologia.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-dim);font-weight:800;font-size:12px;">${esc(t("Nessun dato storico trovato in questo periodo", "No history found in this period"))}</div>`;
      return true;
    }
    cronologia.innerHTML = cronologiaMarkup(cambiDiStato(righe), mappa);
    return true;
  } catch (errore) {
    if (generazione !== state.generazione) return false;
    cronologia.innerHTML = `<div style="text-align:center;padding:24px;color:#ef4444;font-weight:800;font-size:12px;">❌ ${esc(t("Storico non disponibile", "History unavailable"))}<br><span style="color:var(--text-dim);font-size:10px;">${esc(errore?.message || errore)}</span></div>`;
    return false;
  }
}

/* ── la barra ─────────────────────────────────────────────────────────── */

function barraMarkup() {
  return `${PERIODI_CRONOLOGIA.map(
    (periodo) =>
      `<button type="button" class="dm-srv-periodo" data-hours="${periodo.ore}">${esc(parolaDelPeriodo(periodo))}</button>`,
  ).join("")}<button type="button" class="dm-srv-periodo dm-srv-periodo-custom" data-dm-srv-custom>${esc(
    t("Da … a", "From … to"),
  )}</button>
  <div class="dm-srv-custom" data-dm-srv-custom-riga hidden>
    <label><span>${esc(t("Dal", "From"))}</span><input type="datetime-local" class="ed-input" data-dm-srv-da></label>
    <label><span>${esc(t("Al", "To"))}</span><input type="datetime-local" class="ed-input" data-dm-srv-a></label>
    <button type="button" class="dm-srv-periodo dm-srv-applica" data-dm-srv-applica>${esc(t("Applica", "Apply"))}</button>
    <small class="dm-srv-esito" data-dm-srv-esito></small>
  </div>`;
}

export function ensureBarra() {
  const sottotitolo = doc?.getElementById?.("srv-hist-subtitle");
  if (!sottotitolo) return null;
  let barra = doc.getElementById("dm-srv-periodi");
  if (!barra) {
    barra = doc.createElement("div");
    barra.id = "dm-srv-periodi";
    barra.className = "dm-srv-periodi";
    barra.innerHTML = barraMarkup();
    sottotitolo.after(barra);
  }
  return barra;
}

function sincronizzaBarra(intervallo) {
  const barra = ensureBarra();
  if (!barra) return false;
  barra.querySelectorAll(".dm-srv-periodo[data-hours]").forEach((tasto) =>
    tasto.classList.toggle(
      "active",
      !intervallo.personalizzato && Number(tasto.dataset.hours) === Number(intervallo.ore),
    ),
  );
  barra.querySelector("[data-dm-srv-custom]")?.classList.toggle("active", Boolean(intervallo.personalizzato));
  const riga = barra.querySelector("[data-dm-srv-custom-riga]");
  if (riga) {
    const da = riga.querySelector("[data-dm-srv-da]");
    const a = riga.querySelector("[data-dm-srv-a]");
    if (da && !da.value) da.value = perInputLocale(intervallo.start);
    if (a && !a.value) a.value = perInputLocale(intervallo.end);
  }
  return true;
}

function onClick(event) {
  const barra = event.target?.closest?.("#dm-srv-periodi");
  if (!barra) return;
  /* La barra sta dentro l'overlay, che si chiude toccandolo: il tocco qui
   * non deve arrivargli. */
  event.stopPropagation();
  const periodo = event.target.closest(".dm-srv-periodo[data-hours]");
  if (periodo) {
    event.preventDefault();
    ricarica(intervalloDa(Number(periodo.dataset.hours)));
    return;
  }
  const riga = barra.querySelector("[data-dm-srv-custom-riga]");
  if (event.target.closest("[data-dm-srv-custom]")) {
    event.preventDefault();
    if (riga) riga.hidden = !riga.hidden;
    return;
  }
  if (event.target.closest("[data-dm-srv-applica]")) {
    event.preventDefault();
    const esito = barra.querySelector("[data-dm-srv-esito]");
    const scelto = intervalloPersonalizzato(
      daInputLocale(riga?.querySelector("[data-dm-srv-da]")?.value),
      daInputLocale(riga?.querySelector("[data-dm-srv-a]")?.value),
    );
    if (!scelto) {
      if (esito)
        esito.textContent = t(
          "Scegli un inizio prima della fine, e non nel futuro.",
          "Pick a start before the end, and not in the future.",
        );
      return;
    }
    if (esito) esito.textContent = "";
    ricarica(scelto);
  }
}

/* Il guscio apre sui sette giorni: la barra li segna, e da li' si cambia. */
function dopoLApertura() {
  const overlay = doc?.getElementById?.("srv-hist-overlay");
  if (!overlay?.classList.contains("show")) return;
  const intervallo = intervalloDa(168);
  state.intervallo = intervallo;
  state.generazione += 1;
  sincronizzaBarra(intervallo);
}

function installStyles() {
  installStyle(
    "dm-srv-periodi-style",
    `
    #dm-srv-periodi{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 12px}
    #dm-srv-periodi .dm-srv-periodo{
      flex:0 0 auto;min-height:30px;padding:6px 12px;border:1px solid var(--card-border,#e2e8f0);border-radius:999px;
      background:var(--surface-2,#f8fafc);color:var(--text-dim,#64748b);font:inherit;font-size:11.5px;font-weight:850;cursor:pointer}
    #dm-srv-periodi .dm-srv-periodo.active{background:var(--accent,#0ea5e9);border-color:var(--accent,#0ea5e9);color:#fff}
    #dm-srv-periodi .dm-srv-custom{
      flex:1 1 100%;display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;
      padding:10px;border-radius:14px;background:var(--surface-2,#f8fafc);border:1px solid var(--card-border,#e2e8f0)}
    #dm-srv-periodi .dm-srv-custom[hidden]{display:none}
    #dm-srv-periodi .dm-srv-custom label{display:grid;gap:3px;flex:1 1 150px;min-width:0}
    #dm-srv-periodi .dm-srv-custom label span{font-size:10px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:var(--text-dim,#64748b)}
    #dm-srv-periodi .dm-srv-custom input{width:100%;min-width:0;box-sizing:border-box;font:inherit;font-size:13px}
    #dm-srv-periodi .dm-srv-esito{flex:1 1 100%;color:#b91c1c;font-weight:700;font-size:11px}
    #dm-srv-periodi .dm-srv-esito:empty{display:none}
    `,
  );
}

export function installStoricoConnettivita() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick, true);
  const aggancia = () => wrapFunction("apriSrvHistory", "__dmStoricoConnettivita", dopoLApertura);
  /* Il tipo — connettivita', inverter — lo dice l'argomento dell'apertura:
   * lo si legge avvolgendo la funzione una volta di piu', prima. */
  const ricorda = () => {
    const attuale = root.apriSrvHistory;
    if (typeof attuale !== "function" || attuale.__dmRicordaTipo) return false;
    function conTipo(tipo, ...resto) {
      state.tipo = clean(tipo) || "connettivita";
      return attuale.apply(this, [tipo, ...resto]);
    }
    conTipo.__dmRicordaTipo = true;
    conTipo.__dmPrevious = attuale;
    root.apriSrvHistory = conTipo;
    return true;
  };
  const installa = () => {
    ricorda();
    aggancia();
  };
  installa();
  for (const evento of ["dashboardmodern:legacy-ready", "pageshow"]) root.addEventListener?.(evento, installa);
  return true;
}

installStoricoConnettivita();
