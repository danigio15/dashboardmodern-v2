// DM-FIX-20260812B
const freezeRecord = (value) => Object.freeze({ ...(value || {}) });

export function createEnergyBundleService({
  loadEnergyPeriod,
  loadDevicePeriod,
  readRates,
  now = () => new Date(),
} = {}) {
  if (typeof loadEnergyPeriod !== "function") throw new TypeError("loadEnergyPeriod is required");
  if (typeof loadDevicePeriod !== "function") throw new TypeError("loadDevicePeriod is required");
  if (typeof readRates !== "function") throw new TypeError("readRates is required");

  let generation = 0;

  const selectedDate = (period) => new Date(period.year, period.month - 1, 1);
  /* Le caselle che il Recorder non ha saputo riempire, col nome dell'entita'
   * che le riguarda. Non e' un errore: e' un fatto di configurazione, e chi
   * guarda deve poterlo leggere sopra i numeri che ci sono. */
  const mancantiDi = (results) =>
    results.flatMap(([kind, result]) => (result.missing || []).map((plan) => ({ kind, plan })));

  async function load(period) {
    const currentGeneration = ++generation;
    const monthDate = selectedDate(period);
    const today = now();
    const [dayResult, monthResult, yearResult, deviceMonth, deviceYear] = await Promise.all([
      loadEnergyPeriod("day", today),
      loadEnergyPeriod("month", monthDate),
      loadEnergyPeriod("year", monthDate),
      loadDevicePeriod("month", monthDate),
      loadDevicePeriod("year", monthDate),
    ]);

    if (currentGeneration !== generation) return null;

    const results = [
      ["day", dayResult],
      ["month", monthResult],
      ["year", yearResult],
    ];
    /* Un pacchetto arrivato a meta' e' comunque arrivato.
     *
     * Qui si buttava via tutto se anche UNA sola casella era vuota — un
     * contatore configurato senza statistiche a lungo termine — e chi
     * aspettava non riceveva niente, per sempre: quella casella non si
     * riempie perche' la si richiede, e richiederla costa al Recorder ogni
     * volta. Adesso esce cio' che c'e', con scritto cosa manca e di chi. */
    const mancanti = mancantiDi(results);

    return Object.freeze({
      generation: currentGeneration,
      mancanti: Object.freeze(mancanti),
      complete: mancanti.length === 0,
      period: freezeRecord(period),
      day: freezeRecord(dayResult.data),
      month: freezeRecord(monthResult.data),
      year: freezeRecord(yearResult.data),
      sources: Object.freeze({
        day: dayResult,
        month: monthResult,
        year: yearResult,
      }),
      deviceMonth,
      deviceYear,
      rates: freezeRecord(readRates()),
    });
  }

  return Object.freeze({
    load,
    invalidate() {
      generation += 1;
    },
    generation() {
      return generation;
    },
  });
}
