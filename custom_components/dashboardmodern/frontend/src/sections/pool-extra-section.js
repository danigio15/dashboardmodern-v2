/* Le vasche oltre la prima.
 *
 * Il runtime vendorizzato conosce una piscina sola: tiene i suoi secondi di
 * filtrazione, ferma la pompa quando ha finito e risponde ai suoi comandi. Chi
 * ne ha due non poteva dirlo, e adesso che puo' le vasche in piu' hanno bisogno
 * di qualcuno che faccia per loro lo stesso lavoro — altrimenti la filtrazione
 * partirebbe e non si fermerebbe piu'.
 *
 * Questo modulo si occupa solo di quelle: la prima resta interamente del
 * runtime, cosi' nessuna vasca ha due padroni e lo storico di chi ha sempre
 * avuto una piscina non riparte da zero.
 */
import {
  configuredPools,
  poolRunKey,
  poolRunToday,
  poolTargetHours,
} from "../core/pool-model.js";
import { allStates, clean, readJson, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_POOL_EXTRA__";
const state = (root[KEY] ||= { installed: false, stops: new Map(), timer: 0 });

/* Lo stesso passo con cui il runtime conta i secondi della prima vasca: un
 * passo diverso vorrebbe dire due piscine che contano il tempo in modo
 * diverso. */
export const POOL_TICK_SECONDS = 30;

function pools() {
  try {
    return configuredPools(root.getPool?.() || {});
  } catch (_error) {
    return [];
  }
}

function pumping(entity) {
  const reference = clean(entity);
  if (!reference) return false;
  return clean(allStates()[reference]?.state).toLowerCase() === "on";
}

function readNumber(entity) {
  const reference = clean(entity);
  if (!reference) return null;
  const value = Number.parseFloat(allStates()[reference]?.state);
  return Number.isFinite(value) ? value : null;
}

function callService(entity, service) {
  const reference = clean(entity);
  if (!reference) return;
  try {
    root.cdPoolSvc?.(reference, service);
  } catch (_error) {}
}

function runSeconds(pool, index) {
  return Math.max(0, Number(readRun(pool, index).s) || 0);
}

function readRun(pool, index) {
  return poolRunToday(readJson(poolRunKey(pool, index), {}), new Date().toDateString());
}

function startFiltration(pool, index) {
  if (!clean(pool.pumpEnt)) return;
  const target = poolTargetHours(pool, readNumber(pool.tempEnt)) * 3600;
  // Un minuto e' il minimo anche quando la vasca ha gia' finito le sue ore:
  // premere Avvia deve fare qualcosa di visibile, non niente.
  const remaining = Math.max(60, target - runSeconds(pool, index));
  callService(pool.pumpEnt, "turn_on");
  state.stops.set(index, Date.now() + remaining * 1000);
  syncExtraPoolTimer();
}

function stopFiltration(pool, index) {
  callService(pool.pumpEnt, "turn_off");
  state.stops.delete(index);
}

/** Esegue il comando premuto su una vasca che non e' la prima. */
export function extraPoolCommand(button, index) {
  const pool = pools().find((item) => item.index === index);
  if (!pool) return false;
  const act = clean(button?.dataset?.act);
  if (act === "pump") callService(pool.pumpEnt, "toggle");
  else if (act === "heat") callService(pool.heatEnt, "toggle");
  else if (act === "light") callService(pool.lightEnt, "toggle");
  else if (act === "fstart") startFiltration(pool, index);
  else if (act === "fstop") stopFiltration(pool, index);
  else return false;
  return true;
}

/** Conta il tempo trascorso e ferma le vasche che hanno finito. */
export function tickExtraPools(now = Date.now()) {
  const today = new Date().toDateString();
  for (const pool of pools()) {
    if (pool.index === 0) continue;
    const stopAt = state.stops.get(pool.index);
    if (stopAt && now > stopAt) stopFiltration(pool, pool.index);
    if (!pumping(pool.pumpEnt)) continue;
    const key = poolRunKey(pool, pool.index);
    const run = poolRunToday(readJson(key, {}), today);
    run.s += POOL_TICK_SECONDS;
    try {
      root.localStorage?.setItem(key, JSON.stringify(run));
    } catch (_error) {}
  }
}

/* Il tempo si conta solo mentre c'e' del tempo da contare.
 *
 * Un orologio acceso per sempre su ogni dispositivo, per una vasca che quasi
 * nessuno ha, e' il modo in cui una plancia diventa lenta e consuma batteria.
 * Questo si arma quando la pompa di una vasca in piu' comincia a girare e si
 * disarma appena si ferma: fuori da quella finestra non c'e' niente da
 * contare e niente da fermare. */
function anyExtraPumping() {
  return pools().some((pool) => pool.index !== 0 && pumping(pool.pumpEnt));
}

export function syncExtraPoolTimer() {
  const serve = anyExtraPumping() || state.stops.size > 0;
  if (serve && !state.timer) {
    state.timer =
      root.setInterval?.(() => {
        try {
          tickExtraPools();
          if (!anyExtraPumping() && !state.stops.size) syncExtraPoolTimer();
        } catch (_error) {}
      }, POOL_TICK_SECONDS * 1000) || 0;
    return true;
  }
  if (!serve && state.timer) {
    root.clearInterval?.(state.timer);
    state.timer = 0;
    return true;
  }
  return false;
}

export function installPoolExtraSection() {
  if (state.installed) return;
  state.installed = true;
  for (const event of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
  ])
    root.addEventListener?.(event, () => {
      try {
        syncExtraPoolTimer();
      } catch (_error) {}
    });
  syncExtraPoolTimer();
}
