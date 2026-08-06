const root = globalThis;

const callFirst = (names, args = []) => {
  for (const name of names) {
    const fn = root[name];
    if (typeof fn === "function") return fn(...args);
  }
  return undefined;
};

export function createLegacySectionAdapter({ key, pageId, renderers = [], refreshers = [], state = [] }) {
  const api = Object.freeze({
    key,
    pageId,
    isVisible() {
      const page = root.document?.getElementById?.(pageId);
      return Boolean(page && !page.hidden && page.style?.display !== "none");
    },
    render(...args) {
      return callFirst(renderers, args);
    },
    refresh(...args) {
      return callFirst(refreshers.length ? refreshers : renderers, args);
    },
    snapshot() {
      return Object.fromEntries(state.map((name) => [name, root[name]]));
    },
  });

  root.__DASHBOARDMODERN_SECTIONS__ ||= {};
  root.__DASHBOARDMODERN_SECTIONS__[key] = api;
  return api;
}
