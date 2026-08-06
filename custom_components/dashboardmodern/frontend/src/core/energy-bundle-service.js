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
  const incompleteMessage = (results) =>
    results
      .flatMap(([kind, result]) =>
        (result.missing || []).map(
          (plan) => `${kind}:${plan.group}.${plan.key}:${plan.entity}`,
        ),
      )
      .join(", ");

  async function load(period) {
    const currentGeneration = ++generation;
    const monthDate = selectedDate(period);
    const today = now();
    const [dayResult, monthResult, yearResult, deviceMonth, deviceYear] =
      await Promise.all([
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
    if (results.some(([, result]) => result.complete === false)) {
      throw new Error(
        `Incomplete Home Assistant statistics: ${incompleteMessage(results)}`,
      );
    }

    return Object.freeze({
      generation: currentGeneration,
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
