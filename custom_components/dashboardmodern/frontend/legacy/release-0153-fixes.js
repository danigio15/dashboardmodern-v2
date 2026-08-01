/* DashboardModern 0.14.13: monthly Energy/Report synchronization and appliance media layout. */
import { refreshEnergyStatistics0152 } from "./release-0152-runtime.js";

const FLAG_0153 = "__DASHBOARDMODERN_RELEASE_0153__";
let refreshTimer0153 = 0;
let refreshGeneration0153 = 0;

function visible(node) {
  if (!(node instanceof Element)) return false;
  if (node.hidden || node.closest("[hidden],[aria-hidden='true']")) return false;
  const style = globalThis.getComputedStyle?.(node);
  return !style || (style.display !== "none" && style.visibility !== "hidden");
}

function controlDescription(control) {
  return [
    control.id,
    control.getAttribute?.("name"),
    control.className,
    control.getAttribute?.("aria-label"),
    control.getAttribute?.("title"),
    control.dataset?.period,
    control.dataset?.type,
    control.previousElementSibling?.textContent,
    control.closest?.("label")?.textContent,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function monthIndex(value, text = "") {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return numeric - 1;
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 11) return numeric;
  const normalized = `${value || ""} ${text || ""}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const names = [
    ["january", "gennaio"], ["february", "febbraio"], ["march", "marzo"],
    ["april", "aprile"], ["may", "maggio"], ["june", "giugno"],
    ["july", "luglio"], ["august", "agosto"], ["september", "settembre"],
    ["october", "ottobre"], ["november", "novembre"], ["december", "dicembre"],
  ];
  return names.findIndex((aliases) => aliases.some((name) => normalized.includes(name)));
}

export function selectedEnergyDate0153(root = document) {
  const now = new Date();
  const controls = [...root.querySelectorAll("select,input,button,[data-month],[data-year]")]
    .filter((control) => !control.closest("#editor-modal") && visible(control));

  const monthControl = controls.find((control) => /month|mese/.test(controlDescription(control)));
  const yearControl = controls.find((control) => /year|anno/.test(controlDescription(control)));

  const activeMonth = controls.find(
    (control) =>
      (control.matches?.(".active,[aria-pressed='true'],[aria-selected='true']") ||
        control.dataset?.selected === "true") &&
      (/month|mese/.test(controlDescription(control)) || control.dataset?.month != null),
  );
  const activeYear = controls.find(
    (control) =>
      (control.matches?.(".active,[aria-pressed='true'],[aria-selected='true']") ||
        control.dataset?.selected === "true") &&
      (/year|anno/.test(controlDescription(control)) || control.dataset?.year != null),
  );

  const monthSource = activeMonth || monthControl;
  const month = monthIndex(
    monthSource?.dataset?.month ?? monthSource?.value,
    monthSource?.selectedOptions?.[0]?.textContent || monthSource?.textContent || "",
  );

  const yearSource = activeYear || yearControl;
  const rawYear = Number(
    yearSource?.dataset?.year ??
      yearSource?.value ??
      yearSource?.selectedOptions?.[0]?.textContent ??
      String(yearSource?.textContent || "").match(/20\d{2}/)?.[0],
  );

  return new Date(
    Number.isInteger(rawYear) && rawYear >= 2000 ? rawYear : now.getFullYear(),
    month >= 0 ? month : now.getMonth(),
    1,
  );
}

async function refreshSelectedEnergy0153() {
  const generation = ++refreshGeneration0153;
  const selected = selectedEnergyDate0153();
  const result = await refreshEnergyStatistics0152(selected);
  if (generation !== refreshGeneration0153) return false;
  if (result) {
    globalThis.renderEnergy?.();
    globalThis.renderEnergyDashboard?.();
    globalThis.renderReport?.();
  }
  return result;
}

function scheduleRefresh0153(delay = 40) {
  clearTimeout(refreshTimer0153);
  refreshTimer0153 = setTimeout(() => refreshSelectedEnergy0153(), delay);
}

function installEnergyHooks0153() {
  const replaceRefresh = (name) => {
    const previous = globalThis[name];
    if (previous?.__dm0153) return;
    const wrapped = (..._args) => refreshSelectedEnergy0153();
    wrapped.__dm0153 = true;
    wrapped.__dmPrevious = previous;
    globalThis[name] = wrapped;
  };
  replaceRefresh("cdDeriveFromTotals");
  replaceRefresh("cdRefreshPeriodDeltas");

  document.addEventListener(
    "change",
    (event) => {
      const control = event.target;
      if (!(control instanceof HTMLSelectElement || control instanceof HTMLInputElement)) return;
      if (control.closest("#editor-modal")) return;
      if (/month|mese|year|anno|report|period/i.test(controlDescription(control))) {
        scheduleRefresh0153(20);
      }
    },
    true,
  );

  document.addEventListener(
    "click",
    (event) => {
      const control = event.target.closest?.("button,[data-month],[data-year],[data-period]");
      if (!control || control.closest("#editor-modal")) return;
      if (/month|mese|year|anno|report|giornal|daily|mensil|monthly|period/i.test(controlDescription(control) + " " + (control.textContent || ""))) {
        scheduleRefresh0153(60);
      }
    },
    true,
  );
}

function installArtworkStyles0153() {
  if (document.getElementById("dm-release-0153-artwork-styles")) return;
  const style = document.createElement("style");
  style.id = "dm-release-0153-artwork-styles";
  style.textContent = `
    html body .appl-wide-card .appl-visual {
      display: grid !important;
      place-items: center !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      padding: 8px !important;
    }

    html body .appl-wide-card .appl-visual > .appl-ic,
    html body .appl-wide-card .appl-visual .dm-appliance-media,
    html body .appl-wide-card .appl-visual [data-dm-art] {
      display: grid !important;
      place-items: center !important;
      box-sizing: border-box !important;
      width: 100% !important;
      height: 100% !important;
      min-width: 0 !important;
      min-height: 0 !important;
      max-width: 100% !important;
      max-height: 100% !important;
      padding: 0 !important;
      margin: 0 !important;
      overflow: hidden !important;
      transform: none !important;
    }

    html body .appl-wide-card .appl-visual img,
    html body .appl-wide-card .appl-visual picture,
    html body .appl-wide-card .appl-visual [data-custom-image] {
      display: block !important;
      width: auto !important;
      height: auto !important;
      max-width: 88% !important;
      max-height: 88% !important;
      object-fit: contain !important;
      object-position: center !important;
      margin: auto !important;
      transform: none !important;
    }

    html body .appl-wide-card .appl-visual [data-dm-art] > svg,
    html body .appl-wide-card .appl-visual .dm-appliance-art-0152 > svg {
      display: block !important;
      width: auto !important;
      height: 76% !important;
      max-width: 82% !important;
      max-height: 76% !important;
      aspect-ratio: 1 / 1 !important;
      object-fit: contain !important;
      object-position: center !important;
      margin: auto !important;
      transform: none !important;
      flex: none !important;
      overflow: visible !important;
    }
  `;
  document.head.append(style);
}

function install0153() {
  if (globalThis[FLAG_0153]?.installed) return;
  globalThis[FLAG_0153] = { installed: true, version: "0.14.13" };
  installArtworkStyles0153();
  installEnergyHooks0153();
  scheduleRefresh0153(300);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", () => {
    installArtworkStyles0153();
    installEnergyHooks0153();
    scheduleRefresh0153(100);
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install0153, { once: true });
  } else {
    install0153();
  }
}
