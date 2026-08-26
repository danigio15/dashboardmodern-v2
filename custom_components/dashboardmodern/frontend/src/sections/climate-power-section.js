/* Spegnere il clima funziona su ogni impianto.
 *
 * I due pulsanti — quello sulla scheda della zona e quello dentro al popup —
 * chiedevano `climate.turn_off`. Sembra la cosa ovvia, ma in Home Assistant
 * quel servizio esiste solo se l'integrazione dichiara di saperlo fare: le piu'
 * vecchie non lo dichiarano, e su Bticino MyHome la chiamata cadeva nel vuoto.
 * Da fuori si vedeva una zona che restava accesa per sempre e un pulsante che
 * non faceva niente.
 *
 * Qui i due pulsanti passano dalla regola scritta in `climate-power.js`: se il
 * termostato ha la modalita' "off" lo si mette in "off", che e' cio' che ogni
 * termostato sa fare; altrimenti si torna a chiedere `turn_off`. E riaccendere
 * rimette la modalita' che c'era prima, invece di sceglierne una a caso.
 */
import { canonicalClimateType } from "../core/device-model.js";
import { climateIsOff, climatePowerCall } from "../core/climate-power.js";
import { allStates, clean, readClimateUnits, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_CLIMATE_POWER__";
const state = (root[KEY] ||= { installed: false, ultime: new Map() });

function statoDi(entity) {
  const id = clean(entity);
  if (!id) return null;
  const stati = allStates();
  return stati?.[id] || null;
}

/* Con che modalita' era accesa l'ultima volta che l'abbiamo vista.
 *
 * Serve per riaccenderla com'era: un termostato che stava raffrescando deve
 * tornare a raffrescare, non mettersi a scaldare perche' "heat" viene prima in
 * ordine alfabetico. */
export function ricordaModalita(entity) {
  const id = clean(entity);
  const corrente = clean(statoDi(id)?.state).toLowerCase();
  if (id && corrente && corrente !== "off" && corrente !== "unavailable") {
    state.ultime.set(id, corrente);
  }
  return state.ultime.get(id) || "";
}

/* La presa con cui la plancia parla a Home Assistant.
 *
 * Qui si provavano tre strade — `cdCallServiceJson`, `callService`, `hass` —
 * e nessuna delle tre esiste nella plancia: la prima non e' definita da
 * nessuna parte, la seconda nemmeno, e `hass` c'e' solo dentro il pannello di
 * Home Assistant. Quella vera e' `dmCallHaService`, che il runtime definisce
 * e che manda il servizio sul WebSocket: e' la stessa che usano le luci, le
 * tapparelle e il robot. Mancando lei, il tasto di accensione del clima non
 * chiamava niente — «impostando correttamente le entita' non si accendono» —
 * e nessuno se ne accorgeva, perche' fallire in silenzio era il suo modo di
 * fallire.
 *
 * Torna true solo se qualcuno ha davvero preso la chiamata: chi la usa deve
 * poter distinguere «fatto» da «non c'era nessuno», altrimenti la strada di
 * riserva non parte mai. */
function chiama(entity, service, data) {
  const payload = { entity_id: entity, ...data };
  try {
    if (typeof root.dmCallHaService === "function") {
      root.dmCallHaService("climate", service, payload)?.catch?.((error) => {
        root.console?.warn?.("[DashboardModern] climate power", error);
      });
      return true;
    }
    if (typeof root.cdCallServiceJson === "function") {
      root.cdCallServiceJson("climate", service, JSON.stringify(payload));
      return true;
    }
    if (typeof root.callService === "function") {
      root.callService("climate", service, payload);
      return true;
    }
    const hass = root.hass || root._hass;
    if (typeof hass?.callService === "function") {
      hass.callService("climate", service, payload);
      return true;
    }
  } catch (error) {
    root.console?.warn?.("[DashboardModern] climate power", error);
  }
  return false;
}

/* La modalita' che il tab chiede, ma solo per chi vive in tutti e due.
 *
 * La pompa di calore (#195) ha una card in Freddo e una in Caldo: il tasto del
 * tab Caldo deve scaldare, quello del tab Freddo raffrescare. Per gli altri
 * tipi il tab non aggiunge informazione — un condizionatore sta solo in
 * Freddo — e la scelta resta quella ricordata. */
export function modalitaRichiesta(entity, zona) {
  const id = clean(entity);
  const dove = clean(zona).toLowerCase();
  if (!id || (dove !== "caldo" && dove !== "freddo")) return "";
  let unita = [];
  try {
    unita = readClimateUnits();
  } catch (_error) {
    return "";
  }
  const trovata = unita.find(
    (voce) => clean(voce?.entity || voce?.entity_id || voce?.entities?.[0]) === id,
  );
  if (!trovata || canonicalClimateType(trovata.type) !== "pompa") return "";
  return dove === "caldo" ? "heat" : "cool";
}

/* Il verso dell'elenco da cui si preme, per tutti — non solo per la pompa.
 *
 * `modalitaRichiesta` e' l'ordine perentorio della pompa di calore, che vive
 * in tutti e due gli elenchi e deve obbedire al tab. Questo invece e' solo un
 * suggerimento: vale quando non c'e' una modalita' da ricordare, e serve a non
 * accendere in "heat" un condizionatore premuto dal tab Freddo. */
function modalitaDiZona(zona) {
  const dove = clean(zona).toLowerCase();
  if (dove === "caldo") return "heat";
  if (dove === "freddo") return "cool";
  return "";
}

/** Accende o spegne una zona, con il servizio che quel termostato accetta. */
export function commutaClima(entity, acceso, zona = "") {
  const id = clean(entity);
  if (!id) return null;
  const stato = statoDi(id);
  const precedente = ricordaModalita(id);
  const voluto = typeof acceso === "boolean" ? acceso : climateIsOff(stato);
  const chiamata = climatePowerCall(
    stato,
    voluto,
    precedente,
    modalitaRichiesta(id, zona),
    modalitaDiZona(zona),
  );
  /* Se non c'era nessuno ad ascoltare, questa non e' una commutazione
   * riuscita: dirlo lascia partire la strada di riserva di chi ci chiama. */
  if (!chiama(id, chiamata.service, chiamata.data)) return null;
  return chiamata;
}

/* I due pulsanti della plancia. Il runtime resta dov'e': gli si sostituisce la
 * funzione, perche' e' li' che la scelta sbagliata era scritta. */
function installaComandi() {
  if (typeof root.toggleClima === "function" && !root.toggleClima.__dmClimaPower) {
    const precedente = root.toggleClima;
    function commuta(entity, zona) {
      const esito = commutaClima(entity, undefined, zona);
      return esito || precedente.call(this, entity);
    }
    commuta.__dmClimaPower = true;
    commuta.__dmPrevious = precedente;
    root.toggleClima = commuta;
  }
  if (typeof root.cpPower === "function" && !root.cpPower.__dmClimaPower) {
    const precedente = root.cpPower;
    function accendi(valore) {
      const entity = clean(root.cpCurrentEntity);
      const esito = entity ? commutaClima(entity, clean(valore).toLowerCase() !== "off") : null;
      if (!esito) return precedente.call(this, valore);
      // I due pulsanti del popup si accendono come prima: quello lo fa il
      // runtime, e resta suo.
      try {
        const spento = clean(valore).toLowerCase() === "off";
        const acceso = root.document?.getElementById?.("cp-btn-on");
        const spegni = root.document?.getElementById?.("cp-btn-off");
        if (acceso) acceso.style.opacity = spento ? "1" : "0.4";
        if (spegni) spegni.style.opacity = spento ? "0.4" : "1";
      } catch (_error) {}
      return esito;
    }
    accendi.__dmClimaPower = true;
    accendi.__dmPrevious = precedente;
    root.cpPower = accendi;
  }
  return Boolean(root.toggleClima?.__dmClimaPower);
}

export function installClimatePowerSection() {
  installaComandi();
  if (state.installed) return;
  state.installed = true;
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready", "pageshow"]) {
    root.addEventListener?.(evento, installaComandi);
  }
  // Ogni giro di stato e' l'occasione per ricordare com'era accesa una zona.
  root.addEventListener?.("dashboardmodern:state-changed", () => {
    for (const id of state.ultime.keys()) ricordaModalita(id);
  });
}

installClimatePowerSection();
