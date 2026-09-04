/* La valvola termostatica di un termosifone: quanto e' aperta, quanto chiusa.
 *
 * «Nella sezione riscaldamento dare la possibilita' di inserire valvole TRV
 * mostrando percentuale apertura e percentuale chiusura valvola.» Una valvola
 * la dice in due modi: un'entita' a parte — un `sensor` o un `number` con la
 * posizione da 0 a 100 — oppure un attributo dell'unita' `climate` stessa
 * (`valve_position`, `pi_heating_demand`, secondo l'integrazione). Questo
 * modulo legge tutti e due e risponde con due numeri che fanno cento.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** Il campo della configurazione dell'unita' che porta l'entita' della valvola. */
export const CAMPO_VALVOLA = "valvola";

/* Gli attributi con cui le integrazioni dicono la posizione della valvola. */
export const ATTRIBUTI_VALVOLA = Object.freeze([
  "valve_position",
  "current_valve_position",
  "valve_opening",
  "valve",
  "pi_heating_demand",
  "heating_demand",
  "opening_degree",
  "position",
]);

/** Una percentuale da 0 a 100, da un numero o da una parola. */
export function percentuale(valore) {
  const testo = pulito(valore).toLowerCase();
  if (!testo || /^(unknown|unavailable|none)$/.test(testo)) return null;
  if (/^(open|on|opened|aperta|aperto)$/.test(testo)) return 100;
  if (/^(closed|off|chiusa|chiuso)$/.test(testo)) return 0;
  const n = Number(testo.replace("%", ""));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function aperturaDaStato(stato) {
  return percentuale(stato?.state);
}

export function aperturaDagliAttributi(attributi) {
  if (!attributi || typeof attributi !== "object") return null;
  for (const nome of ATTRIBUTI_VALVOLA) {
    if (attributi[nome] === undefined || attributi[nome] === null) continue;
    const n = percentuale(attributi[nome]);
    if (n !== null) return n;
  }
  return null;
}

/**
 * La lettura della valvola: `{ aperta, chiusa }`, o `null` quando nessuno la
 * dice. L'entita' a parte vince sull'attributo, perche' l'ha scelta chi
 * configura.
 */
export function letturaValvola({ stato = null, attributi = null } = {}) {
  const aperta = aperturaDaStato(stato) ?? aperturaDagliAttributi(attributi);
  if (aperta === null) return null;
  return { aperta, chiusa: 100 - aperta };
}
