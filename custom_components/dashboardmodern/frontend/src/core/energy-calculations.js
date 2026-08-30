// DM-FIX-20260812B
const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function nonNegative(value) {
  return Math.max(0, number(value));
}

export function periodDelta(start, end) {
  const first = number(start);
  const last = number(end);
  if (last >= first) return last - first;
  // A cumulative meter may reset during the selected period. In that case
  // the last reading is the energy measured after the reset.
  return nonNegative(last);
}

export function sumEnergy(values = []) {
  return values.reduce((total, value) => total + nonNegative(value), 0);
}

export function energyBalance({
  solar = 0,
  gridImport = 0,
  gridExport = 0,
  batteryCharge = 0,
  batteryDischarge = 0,
} = {}) {
  const production = nonNegative(solar);
  const imported = nonNegative(gridImport);
  const exported = nonNegative(gridExport);
  const charged = nonNegative(batteryCharge);
  const discharged = nonNegative(batteryDischarge);
  const consumption = nonNegative(production + imported + discharged - exported - charged);
  const selfConsumed = Math.min(production, nonNegative(production - exported));
  return Object.freeze({
    production,
    consumption,
    imported,
    exported,
    charged,
    discharged,
    selfConsumed,
  });
}

export function energyPercentages(balance = {}) {
  const production = nonNegative(balance.production);
  const consumption = nonNegative(balance.consumption);
  const selfConsumed = nonNegative(balance.selfConsumed);
  return Object.freeze({
    selfConsumption: production > 0 ? Math.min(100, (selfConsumed / production) * 100) : 0,
    selfSufficiency: consumption > 0 ? Math.min(100, (selfConsumed / consumption) * 100) : 0,
  });
}

export function energyCost(
  { imported = 0, exported = 0 } = {},
  { importPrice = 0, exportPrice = 0 } = {},
) {
  const importCost = nonNegative(imported) * nonNegative(importPrice);
  const exportCredit = nonNegative(exported) * nonNegative(exportPrice);
  return Object.freeze({ importCost, exportCredit, netCost: importCost - exportCredit });
}

/* La tariffa, da qualunque forma arrivi (#217).
 *
 * `raw` puo' essere un numero, una stringa numerica — anche con la virgola —
 * oppure l'id di un'entita': in quel caso il valore e' il suo stato corrente
 * in `states`, che si aggiorna da solo quando il fornitore cambia prezzo.
 *
 * I default vivono QUI e da nessun'altra parte. La semantica e' quella di
 * sempre: un valore sopra lo zero vince, tutto il resto — vuoto, zero
 * esplicito, entita' sparita, stato non numerico — cade sul default. Lo zero
 * esplicito non vince perche' il salvataggio non lo scrive mai apposta, e un
 * Report che alterna gli euro calcolati a «0,00» e' il difetto che questi due
 * numeri sono nati per impedire. */
export const DEFAULT_IMPORT_RATE = 0.25;
export const DEFAULT_EXPORT_RATE = 0.1;

/* Un id di entita' comincia con un dominio, non con una cifra: cosi' «0.25»
 * resta un numero e «sensor.prezzo_kwh» una lettura da fare. */
const somigliaAUnaEntita = (value) => /^[a-z_][\w-]*\.[\w.-]+$/i.test(value);

export function resolveRate(raw, states = {}, fallback = 0) {
  const testo = String(raw ?? "").trim();
  if (!testo) return fallback;
  const sorgente = somigliaAUnaEntita(testo) ? (states?.[testo]?.state ?? states?.[testo]) : testo;
  const parsed = Number(String(sorgente ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/* Dove il modello Energia canonico tiene l'entita' del prezzo di acquisto. */
export function importRateEntity(model = {}) {
  return String(model?.rates?.import_entity ?? "").trim();
}
