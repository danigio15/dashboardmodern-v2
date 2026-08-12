// DM-FIX-20260812B
export function createRuntimeMetrics() {
  const values = { recorderRequests: 0, energyRefreshes: 0, applianceRenders: 0, globalRenders: 0 };
  return Object.freeze({
    increment(key) {
      if (Object.hasOwn(values, key)) values[key] += 1;
    },
    snapshot() {
      return Object.freeze({ ...values });
    },
    reset() {
      Object.keys(values).forEach((key) => {
        values[key] = 0;
      });
    },
  });
}

export function createCoalescedUpdater(callback, schedule = queueMicrotask) {
  let pending = false;
  return () => {
    if (pending) return false;
    pending = true;
    schedule(() => {
      pending = false;
      callback();
    });
    return true;
  };
}

export const runtimeMetrics = createRuntimeMetrics();
