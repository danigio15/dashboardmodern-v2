/*
 * README preview generator.
 *
 * Boots the vendored dashboard document against a mocked Home Assistant
 * WebSocket (states, history and recorder statistics), walks every section and
 * writes the screenshots used by README.md into docs/preview/.
 *
 * Usage:
 *   npm ci
 *   npm i --no-save chart.js        # optional: real charts instead of stubs
 *   node scripts/capture-previews.mjs                      # dark/auto gallery
 *   node scripts/capture-previews.mjs --theme light --keep  # light gallery (-light files)
 *   node scripts/capture-previews.mjs --variant dashboard-en.html --out docs/preview-en
 *   node scripts/capture-previews.mjs --only home,energy-flow
 *
 * The screenshots are generated from scripts/preview-fixture.mjs — an invented
 * demo home. No preview contains data from a real installation.
 */

import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import { extraStorage, haStates, seed, statisticsDeltas } from "./preview-fixture.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FRONTEND = path.join(ROOT, "custom_components/dashboardmodern/frontend");

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};

const VARIANT = flag("variant", "dashboard.html");
const OUT_DIR = path.resolve(ROOT, flag("out", "docs/preview"));
const ONLY = flag("only", "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const PORT = Number(flag("port", "4318"));
const FORMAT = flag("format", "webp") === "png" ? "png" : "webp";
/* Forces one theme for every target and suffixes the files, so a light and a
   dark gallery can live side by side in docs/preview/. */
const THEME = ["light", "dark", "auto"].includes(flag("theme", "")) ? flag("theme", "") : "";
const WEBP_QUALITY = Number(flag("quality", "0.92"));
const HEADED = argv.includes("--headed");
const KEEP = argv.includes("--keep");
const FRESH = argv.includes("--fresh");

const CHROMIUM_PATH =
  process.env.DM_CHROMIUM ||
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium/chrome"].find(
    (candidate) => existsSync(candidate),
  );

const CHART_JS = [
  process.env.DM_CHART_JS,
  path.join(ROOT, "node_modules/chart.js/dist/chart.umd.js"),
].find((candidate) => candidate && existsSync(candidate));

/* Chart.js is loaded from a CDN by the shipped document. Previews must not
   depend on network access, so a stub keeps the layout intact when the real
   library is unavailable. */
const CHART_STUB =
  "window.Chart=class{static defaults={color:'',font:{}};static register(){}" +
  "static getChart(){return null}constructor(){this.data={};this.options={}}" +
  "update(){}resize(){}destroy(){}};";

const PANZOOM_STUB =
  "window.panzoom=function(){return{dispose(){},zoomAbs(){},moveTo(){},getTransform(){" +
  "return{x:0,y:0,scale:1}},on(){},pause(){},resume(){}}};";
const HLS_STUB =
  "window.Hls=class{static isSupported(){return false};static Events={};" +
  "loadSource(){};attachMedia(){};on(){};destroy(){}};";

const DESKTOP = { width: 1360, height: 1000, deviceScaleFactor: 1, maxHeight: 3400 };
const MOBILE = { width: 402, height: 900, deviceScaleFactor: 2, maxHeight: 2600 };

/* ─────────────────────────────── preview targets ──────────────────────────── */

/**
 * Each target activates one dashboard view and screenshots it.
 * `setup` runs inside the page; `clip` optionally trims the shot.
 */
const TARGETS = [
  {
    id: "segnalazioni-config",
    title: "Segnalazioni · la tessera in Configurazione",
    both: true,
    setup: () => {
      window.__dmPreview.tab("config");
    },
  },
  {
    id: "segnalazioni-nuova",
    title: "Segnalazioni · aprirne una",
    both: true,
    settle: 900,
    modal: true,
    setup: () => {
      window.__dmPreviewTickets("nuova");
    },
  },
  {
    id: "segnalazioni-mie",
    title: "Segnalazioni · le mie",
    both: true,
    settle: 900,
    modal: true,
    setup: () => {
      window.__dmPreviewTickets("mie");
    },
  },
  {
    id: "segnalazioni-cruscotto",
    title: "Segnalazioni · il cruscotto",
    both: true,
    settle: 900,
    modal: true,
    setup: () => {
      window.__dmPreviewTickets("console");
    },
  },
  {
    id: "segnalazioni-chiuse",
    title: "Segnalazioni · il cruscotto, quelle chiuse",
    both: true,
    settle: 900,
    modal: true,
    setup: () => {
      window.__dmPreviewTickets("chiuse");
    },
  },
  {
    id: "segnalazioni-widget",
    title: "Segnalazioni \u00b7 la tessera in Home",
    both: true,
    settle: 1200,
    setup: () => {
      window.__dmPreviewTickets("widget");
      window.__dmPreview.tab("home");
    },
  },
  {
    id: "segnalazioni-difetti",
    title: "Segnalazioni \u00b7 i difetti da lavorare",
    both: true,
    settle: 900,
    modal: true,
    setup: () => {
      window.__dmPreviewTickets("difetti");
    },
  },
  {
    id: "segnalazioni-filo",
    title: "Segnalazioni · il filo di una segnalazione",
    both: true,
    settle: 900,
    modal: true,
    setup: () => {
      window.__dmPreviewTickets("filo");
    },
  },
  {
    id: "segnalazioni-allegati",
    title: "Segnalazioni · foto e video, appena spedita",
    both: true,
    settle: 900,
    modal: true,
    setup: () => {
      window.__dmPreviewTickets("allegati");
    },
  },
  {
    id: "segnalazioni-codice",
    title: "Segnalazioni · il codice, dopo l'invio",
    both: true,
    settle: 900,
    modal: true,
    setup: () => {
      window.__dmPreviewTickets("codice");
    },
  },
  {
    id: "segnalazioni-collega",
    title: "Segnalazioni · il modulo, senza chiedere niente",
    both: true,
    settle: 900,
    modal: true,
    setup: () => {
      window.__dmPreviewTickets("collega");
    },
  },
  {
    id: "home",
    title: "Home",
    both: true,
    setup: () => {
      window.__dmPreview.tab("home");
    },
  },
  {
    id: "navigation",
    title: "Barra di navigazione",
    both: true,
    setup: () => {
      window.__dmPreview.tab("home");
      window.__dmPreview.nav();
    },
  },
  {
    id: "energy-flow",
    title: "Energia · flusso live",
    motion: true,
    settle: 2600,
    both: true,
    setup: () => {
      window.__dmPreview.tab("energy");
      window.__dmPreview.sub("page-energy", "ist");
    },
  },
  {
    id: "energy-day",
    title: "Energia · giornaliera",
    both: true,
    setup: () => {
      window.__dmPreview.tab("energy");
      window.__dmPreview.sub("page-energy", "day");
    },
  },
  {
    id: "energy-month",
    title: "Energia · mensile",
    both: true,
    setup: () => {
      window.__dmPreview.tab("energy");
      window.__dmPreview.sub("page-energy", "month");
    },
  },
  {
    id: "energy-report",
    title: "Energia · report",
    both: true,
    setup: () => {
      window.__dmPreview.tab("energy");
      window.__dmPreview.sub("page-energy", "panoramica");
      window.renderEnergyDashboard?.();
      window.edSwitchTab?.("panoramica");
    },
    settle: 3000,
  },
  {
    id: "energy-analysis",
    title: "Energia · analisi",
    setup: () => {
      window.__dmPreview.tab("energy");
      window.__dmPreview.sub("page-energy", "panoramica");
      window.renderEnergyDashboard?.();
      window.edSwitchTab?.("analisi");
    },
    settle: 3000,
  },
  {
    id: "energy-temperatures",
    title: "Energia · temperature impianto",
    both: true,
    setup: () => {
      window.__dmPreview.tab("energy");
      window.__dmPreview.sub("page-energy", "temp");
      window.renderInverterTemp?.();
    },
  },
  {
    id: "appliances",
    title: "Elettrodomestici",
    both: true,
    setup: () => {
      window.__dmPreview.tab("appliances-main");
      window.renderApplianceSection?.(true);
      window.__dmPreview.sub("page-appliances-main", "overview");
    },
    settle: 2200,
  },
  {
    id: "appliances-consumption",
    title: "Elettrodomestici · consumi",
    setup: () => {
      window.__dmPreview.tab("appliances-main");
      window.renderApplianceSection?.(true);
      window.__dmPreview.sub("page-appliances-main", "consumption");
    },
    settle: 2200,
  },
  {
    id: "ev",
    title: "Auto elettrica e wallbox",
    both: true,
    setup: () => {
      window.__dmPreview.tab("ev");
    },
  },
  {
    id: "climate",
    title: "Clima",
    both: true,
    setup: () => {
      window.__dmPreview.tab("clima");
      window.renderQuickClima?.();
    },
  },
  {
    id: "temperature",
    title: "Temperatura e umidità",
    both: true,
    setup: () => {
      window.__dmPreview.tab("temp");
      window.buildTempCards?.();
    },
  },
  {
    id: "shutters",
    title: "Finestre",
    both: true,
    setup: () => {
      window.__dmPreview.tab("tapparelle");
      window.renderTapparelle?.();
    },
  },
  {
    id: "security",
    title: "Sicurezza",
    both: true,
    setup: () => {
      window.__dmPreview.tab("security");
      window.renderAllarmeBanner?.();
    },
  },
  {
    id: "solar-thermal",
    title: "Solare termico",
    motion: true,
    settle: 2600,
    both: true,
    setup: () => {
      window.__dmPreview.tab("boiler");
      window.renderThermalPanel?.();
    },
  },
  {
    id: "pool",
    title: "Piscina",
    motion: true,
    settle: 3200,
    both: true,
    setup: () => {
      window.__dmPreview.tab("piscina");
    },
  },
  {
    id: "irrigation",
    title: "Irrigazione",
    motion: true,
    settle: 3200,
    both: true,
    setup: () => {
      window.__dmPreview.tab("irrigazione");
    },
  },
  {
    id: "server",
    title: "MiniPC e rete",
    both: true,
    setup: () => {
      window.__dmPreview.tab("server");
    },
  },
  {
    /* La sezione Stanze (1.3): le pillole in alto, e sotto tutto quello che
       quella stanza possiede, diviso per tipo. */
    id: "rooms",
    title: "Stanze",
    both: true,
    setup: () => {
      window.__dmPreview.tab("stanze");
    },
  },
  {
    /* Le Luci hanno una pagina propria dalla 1.1.9: prima erano solo un popup
       della Home. */
    id: "lights",
    title: "Luci",
    both: true,
    setup: () => {
      window.__dmPreview.tab("luci");
    },
  },
  {
    id: "robot",
    title: "Aspirapolvere",
    both: true,
    setup: () => {
      window.__dmPreview.tab("robot");
    },
  },
  {
    /* La finestra di una tessera (1.3.1): apre come apre una pagina — stessa
       fascia col titolo nel colore della sezione — e in cima porta i numeri che
       riassumono, ricavati dalle righe. */
    id: "widget-popup",
    title: "La finestra di una tessera",
    both: true,
    setup: () => {
      window.__dmPreview.tab("home");
      /* Le tessere si disegnano dopo il cambio pagina: premerle nello stesso
         giro vuol dire premere qualcosa che non c'e' ancora. */
      /* La finestra si apre quando il modulo dei widget si ricorda quale tessera
         e' espansa, e la ridisegna al giro dopo. Premere la tessera dal di fuori
         non basta: il ridisegno del cambio pagina la richiude. Si dice invece al
         modulo quale vuole aprire, e la si lascia disegnare. */
      setTimeout(() => {
        const stato = window.__DASHBOARDMODERN_HOME_WIDGETS__;
        if (stato) stato.expanded = "clima";
        window.dispatchEvent(new Event("resize"));
      }, 2400);
    },
    settle: 3600,
  },
  {
    /* La rotella del Clima: modalita', temperatura e ventola sulla riga, con i
       soli comandi che quell'unita' dichiara di accettare. */
    id: "widget-popup-climate-dial",
    title: "La rotella del Clima",
    both: true,
    setup: () => {
      window.__dmPreview.tab("home");
      setTimeout(() => {
        const stato = window.__DASHBOARDMODERN_HOME_WIDGETS__;
        if (stato) {
          stato.expanded = "clima";
          /* Le righe col pannello aperto stanno in un insieme che il ridisegno
             ritrova: dirlo qui vale quanto premere la rotella, e non viene
             disfatto dal giro dopo. */
          stato.aperti?.add?.("climate.soggiorno");
        }
        window.dispatchEvent(new Event("resize"));
      }, 2400);
    },
    settle: 4400,
  },
  {
    id: "lights-popup",
    title: "Gestione luci",
    modal: true,
    both: true,
    setup: () => {
      window.__dmPreview.tab("home");
      window.apriGestioneLuci?.(false);
    },
  },
  {
    id: "light-control-popup",
    title: "Controlli di una luce",
    modal: true,
    both: true,
    setup: () => {
      window.__dmPreview.tab("home");
      window.apriGestioneLuci?.(false);
      /* Si apre dal pulsante della card, come farebbe una persona: passare un id
         al punto d'ingresso del runtime apriva un foglio «NON DISPONIBILE»,
         perche' l'id della vista non e' l'entity_id. */
      document
        .querySelector('[data-dm-light="light.soggiorno_strip"] [data-dm-light-open]')
        ?.click();
    },
    element: ".dm-lightctl-dialog",
    settle: 2200,
  },
  {
    id: "alerts-popup",
    title: "Dettaglio avvisi",
    modal: true,
    setup: () => {
      window.__dmPreview.tab("home");
      window.apriDettagli?.(null, "luci");
    },
  },
  {
    id: "climate-popup",
    title: "Controllo rapido clima",
    modal: true,
    both: true,
    setup: () => {
      window.__dmPreview.tab("home");
      window.apriQuickClima?.();
    },
  },
  {
    id: "appliance-detail",
    title: "Dettaglio elettrodomestico",
    modal: true,
    both: true,
    setup: () => {
      window.__dmPreview.tab("appliances-main");
      window.renderApplianceSection?.(true);
      window.apriApplianceDetail?.(0);
    },
    settle: 2500,
  },
  {
    id: "editor-settings",
    title: "Editor · impostazioni",
    setup: () => {
      window.__dmPreview.editor("visib");
    },
  },
  {
    /* The 🪄 button in Impostazioni: it runs the detection and shows what it
       found, writing nothing until the summary is accepted. */
    id: "editor-autodetect",
    title: "Editor · autorilevamento entità",
    setup: () => {
      window.__dmPreview.editor("visib");
      window.edAutoRileva?.();
    },
    settle: 4000,
  },
  {
    id: "editor-rooms",
    title: "Editor · stanze",
    setup: () => {
      window.__dmPreview.editor("stanze");
    },
  },
  {
    id: "editor-energy",
    title: "Editor · energia, flussi ed entità",
    setup: () => {
      window.__dmPreview.editor("sez1", 0);
    },
    settle: 2200,
  },
  {
    id: "editor-energy-loads",
    title: "Editor · energia, carichi",
    setup: () => {
      window.__dmPreview.editor("sez1", 1);
    },
    settle: 2200,
  },
  {
    id: "editor-energy-report",
    title: "Editor · energia, report",
    setup: () => {
      window.__dmPreview.editor("sez1", 2);
    },
    settle: 2200,
  },
  {
    id: "editor-energy-settings",
    title: "Editor · energia, tariffe",
    setup: () => {
      window.__dmPreview.editor("sez1", 3);
    },
    settle: 2200,
  },
  {
    id: "editor-appliances",
    title: "Editor · elettrodomestici",
    setup: () => {
      window.__dmPreview.editor("appliances");
    },
  },
  {
    id: "editor-temperature",
    title: "Editor · temperatura",
    setup: () => {
      window.__dmPreview.editor("sez7");
    },
  },
  {
    id: "editor-lights",
    title: "Editor · luci",
    setup: () => {
      window.__dmPreview.editor("luci");
    },
  },
  {
    id: "editor-climate",
    title: "Editor · clima",
    setup: () => {
      window.__dmPreview.editor("sez9");
    },
  },
  {
    id: "editor-quick-actions",
    title: "Editor · azioni rapide",
    setup: () => {
      window.__dmPreview.editor("sez8");
    },
  },
  {
    id: "editor-pool",
    title: "Editor · piscina",
    setup: () => {
      window.__dmPreview.editor("pool");
    },
  },
  {
    id: "editor-irrigation",
    title: "Editor · irrigazione",
    setup: () => {
      window.__dmPreview.editor("irr");
    },
  },
  {
    id: "editor-shutters",
    title: "Editor · tapparelle",
    setup: () => {
      window.__dmPreview.editor("tapp");
    },
  },
  {
    id: "editor-ev",
    title: "Editor · auto elettrica",
    setup: () => {
      window.__dmPreview.editor("sez2");
    },
  },
  {
    id: "editor-people",
    title: "Editor · persone",
    setup: () => {
      window.__dmPreview.editor("people");
    },
    settle: 2200,
  },
  {
    id: "editor-robot",
    title: "Editor · aspirapolvere",
    setup: () => {
      window.__dmPreview.editor("robot");
    },
  },
  {
    id: "editor-todo",
    title: "Editor · cose da fare",
    setup: () => {
      window.__dmPreview.editor("todo");
    },
  },
  {
    id: "editor-doors",
    title: "Editor · aperture",
    setup: () => {
      window.__dmPreview.editor("doors");
    },
  },
  {
    id: "editor-backup",
    title: "Editor · backup e ripristino",
    setup: () => {
      window.__dmPreview.editor("backup");
    },
  },
  {
    id: "editor-alerts",
    title: "Editor · avvisi",
    setup: () => {
      window.__dmPreview.editor("avvisi");
    },
  },
];

/* ───────────────────────────────── static server ──────────────────────────── */

async function waitForPort(port, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const open = await new Promise((resolve) => {
      const socket = net.connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (open) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`static server did not start on port ${port}`);
}

function startServer(port) {
  const child = spawn(
    process.env.PYTHON || "python3",
    ["-m", "http.server", String(port), "--directory", FRONTEND, "--bind", "127.0.0.1"],
    { stdio: "ignore" },
  );
  return child;
}

/* ───────────────────────────── in-page mock backend ───────────────────────── */

function installMockBackend(page) {
  return page.addInitScript(
    ({ states, deltas, storage, instance }) => {
      const prefix = `cd_${instance}_`;
      const raw = window.localStorage;
      const setItem = Storage.prototype.setItem;
      for (const [key, value] of Object.entries(storage))
        setItem.call(
          raw,
          `${prefix}${key}`,
          typeof value === "string" ? value : JSON.stringify(value),
        );

      /* Deterministic clock-independent series generators. */
      const numericState = (entityId) => {
        const value = Number(states.find((item) => item.entity_id === entityId)?.state);
        return Number.isFinite(value) ? value : 0;
      };
      const unitOf = (entityId) =>
        String(
          states.find((item) => item.entity_id === entityId)?.attributes?.unit_of_measurement || "",
        );
      const isTemperature = (entityId) => /°/.test(unitOf(entityId));
      const isPercent = (entityId) => unitOf(entityId) === "%";
      const isPower = (entityId) =>
        /^(w|kw)$/i.test(
          String(
            states.find((item) => item.entity_id === entityId)?.attributes?.unit_of_measurement ||
              "",
          ),
        );

      const historySeries = (entityId, startMs, endMs, points = 48) => {
        const current = numericState(entityId);
        const rows = [];
        for (let index = 0; index <= points; index += 1) {
          const time = startMs + ((endMs - startMs) * index) / points;
          const hour = new Date(time).getHours() + new Date(time).getMinutes() / 60;
          let value;
          if (isPower(entityId)) {
            // Daylight-shaped curve for solar-ish entities, load-shaped otherwise.
            const solar = /fv|solar|pv/i.test(entityId);
            const shape = solar
              ? Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI))
              : 0.45 + 0.4 * Math.sin(((hour - 7) / 24) * 2 * Math.PI) + (index % 5) * 0.02;
            value = Math.max(0, current * shape * 1.15);
          } else if (isTemperature(entityId)) {
            /* Rooms cool overnight and warm through the afternoon: a ramp would
               draw the trend chart as a straight line. */
            value = current - 2.4 + 2.4 * Math.sin(((hour - 9) / 24) * 2 * Math.PI + Math.PI / 2);
          } else if (isPercent(entityId)) {
            value = current + 3 * Math.sin(((hour - 4) / 24) * 2 * Math.PI);
          } else {
            value = current * (0.35 + (0.65 * index) / points);
          }
          rows.push({ s: value.toFixed(2), lu: Math.round(time / 1000) });
        }
        return rows;
      };

      const baseSum = {};
      states.forEach((item, index) => {
        baseSum[item.entity_id] = 1000 + index * 37;
      });

      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      const sharedConfig = {
        revision: 0,
        updated_at: 0,
        keys_revision: 2,
        reset: false,
        values: {},
      };

      const statisticsFor = (message) => {
        const period = message.period;
        const endTime = new Date(message.end_time || Date.now()).getTime();
        const table =
          period === "hour" || period === "5minute"
            ? deltas.day
            : period === "month"
              ? deltas.year
              : endTime > currentMonthStart
                ? deltas.month
                : deltas.previousMonth;
        const startTime = new Date(message.start_time || endTime - 86_400_000).getTime();
        const step =
          period === "5minute"
            ? 300_000
            : period === "hour"
              ? 3_600_000
              : period === "month"
                ? 30 * 86_400_000
                : 86_400_000;
        const buckets = Math.max(2, Math.min(320, Math.round((endTime - startTime) / step)));

        /* Weights shape the per-bucket deltas so charts show a plausible
           profile instead of a straight ramp, while the total delta still
           matches the fixture. */
        const weights = Array.from(
          { length: buckets },
          (_, index) => 1 + 0.45 * Math.sin(index * 1.35) + 0.25 * Math.sin(index * 0.42),
        );
        const weightTotal = weights.reduce((total, value) => total + value, 0);

        return Object.fromEntries(
          (message.statistic_ids || []).map((id) => {
            const initial = baseSum[id] ?? 1000;
            const delta = table[id] ?? 0;
            const rows = [];
            let sum = initial;
            for (let index = 0; index < buckets; index += 1) {
              const bucketStart = startTime + index * step;
              rows.push({
                start: new Date(bucketStart).toISOString(),
                end: new Date(bucketStart + step).toISOString(),
                sum,
                state: sum,
                mean: sum,
                min: sum,
                max: sum,
              });
              sum += (delta * weights[index]) / weightTotal;
            }
            rows.push({
              start: new Date(endTime - 1).toISOString(),
              end: new Date(endTime).toISOString(),
              sum,
              state: sum,
              mean: sum,
              min: sum,
              max: sum,
            });
            return [id, rows];
          }),
        );
      };

      class MockSocket extends EventTarget {
        static OPEN = 1;
        readyState = 1;
        onopen = null;
        onmessage = null;
        onclose = null;
        onerror = null;
        constructor() {
          super();
          /* The hosted bridge authenticates natively: emitting `auth_required`
             makes the energy broker reject the connection on purpose. */
          queueMicrotask(() => {
            this.onopen?.({});
            this.emit({ type: "auth_ok", ha_version: "2025.8.0" });
          });
        }
        emit(message) {
          const event = new MessageEvent("message", { data: JSON.stringify(message) });
          this.dispatchEvent(event);
          this.onmessage?.(event);
        }
        reply(id, result, success = true) {
          this.emit({ id, type: "result", success, result });
        }
        send(payload) {
          let message;
          try {
            message = JSON.parse(payload);
          } catch {
            return;
          }
          const { id, type } = message;
          (window.__dmSent ||= []).push(message);
          if (type === "auth") return this.emit({ type: "auth_ok", ha_version: "2025.8.0" });
          if (type === "get_states") return this.reply(id, states);
          if (type === "subscribe_events" || type === "subscribe_trigger")
            return this.reply(id, null);
          if (type === "frontend/get_user_data") return this.reply(id, { value: null });
          if (type === "frontend/set_user_data") return this.reply(id, null);

          /* Shared configuration store of the integration: one copy per
             installation, replacing the old per-user frontend user data. The
             mock starts empty, so the seeded device pushes its own snapshot —
             the same path a freshly configured installation takes. */
          if (type === "dashboardmodern/config/get")
            return this.reply(id, {
              profile: "primary",
              requested_profile: message.profile || "primary",
              snapshot: { ...sharedConfig, values: { ...sharedConfig.values } },
              recoverable: [],
              profiles: ["primary"],
            });
          if (type === "dashboardmodern/config/set") {
            const values = message.snapshot?.values || {};
            sharedConfig.values = { ...values };
            sharedConfig.revision += 1;
            sharedConfig.keys_revision = Number(message.snapshot?.keys_revision) || 2;
            sharedConfig.updated_at = Number(message.snapshot?.updated_at) || 0;
            sharedConfig.reset = Boolean(message.reset);
            return this.reply(id, {
              status: "saved",
              profile: "primary",
              snapshot: { ...sharedConfig, values: { ...sharedConfig.values } },
              recoverable: [],
            });
          }
          if (type === "dashboardmodern/config/restore")
            return this.reply(id, {
              status: "saved",
              profile: "primary",
              snapshot: { ...sharedConfig, values: { ...sharedConfig.values } },
            });
          if (type === "history/history_during_period") {
            const end = new Date(message.end_time || Date.now()).getTime();
            const start = new Date(message.start_time || end - 86_400_000).getTime();
            return this.reply(
              id,
              Object.fromEntries(
                (message.entity_ids || []).map((entityId) => [
                  entityId,
                  historySeries(entityId, start, end),
                ]),
              ),
            );
          }
          if (type === "recorder/statistics_during_period")
            return this.reply(id, statisticsFor(message));
          if (type === "call_service") return this.reply(id, { context: { id: "preview" } });
          if (type === "auth/sign_path") return this.reply(id, { path: message.path });
          if (/registry\/list$/.test(String(type))) return this.reply(id, []);
          if (type === "camera/stream") return this.reply(id, null, false);
          return this.reply(id, []);
        }
        close() {
          this.readyState = 3;
          this.onclose?.({});
        }
      }

      window.__DASHBOARDMODERN_HOSTED__ = true;
      window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
      window.WebSocket = MockSocket;
      window.DASHBOARDMODERN_AUTH_TOKEN = "preview-token";

      /* Screenshot hygiene. Sections whose whole point is movement (the energy
         flow, the pool and irrigation scenes) are captured with animations
         running instead — see `__dmPreview.motion`. */
      window.__DM_PREVIEW_STILL_CSS__ = `
        *,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;
          transition-duration:0s!important;transition-delay:0s!important}
      `;
      document.addEventListener("DOMContentLoaded", () => {
        const base = document.createElement("style");
        base.textContent = `
          #cd-boot-overlay,#setup-wizard{display:none!important}
          ::-webkit-scrollbar{width:0!important;height:0!important}
          .bottom-nav-handle{display:none!important}
        `;
        document.head.appendChild(base);
        const still = document.createElement("style");
        still.id = "dm-preview-still";
        still.textContent = window.__DM_PREVIEW_STILL_CSS__;
        document.head.appendChild(still);
      });
    },
    { states: haStates, deltas: statisticsDeltas, storage: extraStorage, instance: "preview" },
  );
}

/* Home Assistant REST fallbacks used by the legacy runtime when a WebSocket
   answer is unavailable. Without them the previews log 404s and some cards keep
   their loading state. */
async function installRestRoutes(page, cameraStill, vehicleStill) {
  const byId = new Map(haStates.map((item) => [item.entity_id, item]));

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const json = (body) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });

    if (url.pathname.startsWith("/api/camera_proxy") && cameraStill)
      return route.fulfill({ contentType: "image/png", body: cameraStill });

    if (url.pathname.startsWith("/api/dm_preview/") && vehicleStill)
      return route.fulfill({ contentType: "image/png", body: vehicleStill });

    if (url.pathname.startsWith("/api/history/period/")) {
      const start = Date.parse(decodeURIComponent(url.pathname.split("/api/history/period/")[1]));
      const end = Date.parse(url.searchParams.get("end_time") || "") || Date.now();
      const ids = (url.searchParams.get("filter_entity_id") || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const series = ids.map((entityId) => {
        const item = byId.get(entityId);
        const value = Number(item?.state);
        const points = 24;
        return Array.from({ length: points + 1 }, (_, index) => {
          const time = new Date(start + ((end - start) * index) / points).toISOString();
          const scaled = Number.isFinite(value)
            ? (value * (0.3 + (0.7 * index) / points)).toFixed(2)
            : String(item?.state ?? "unknown");
          return {
            entity_id: entityId,
            state: scaled,
            attributes: index === 0 ? item?.attributes || {} : {},
            last_changed: time,
            last_updated: time,
          };
        });
      });
      return json(series.filter((rows) => rows.length));
    }

    if (url.pathname === "/api/states") return json(haStates);
    if (url.pathname.startsWith("/api/states/"))
      return json(byId.get(url.pathname.replace("/api/states/", "")) || {});
    if (url.pathname === "/api/config")
      return json({ version: "2025.8.0", location_name: "Casa demo", currency: "EUR" });
    return json({});
  });
}

async function installRoutes(page) {
  const chartBody = CHART_JS ? await readFile(CHART_JS, "utf8") : CHART_STUB;
  const cache = new Map();

  await page.route(/^https:\/\//, async (route) => {
    const url = route.request().url();
    const js = (body) => route.fulfill({ contentType: "application/javascript", body });

    if (/chart\.js|chart\.umd/i.test(url)) return js(chartBody);
    if (/panzoom/i.test(url)) return js(PANZOOM_STUB);
    if (/hls(\.min)?\.js/i.test(url)) return js(HLS_STUB);

    /* Vehicle brand marks: served from a local simple-icons copy when present,
       so the EV section renders its real logos without network access. */
    const icon = /simple-icons@[^/]+\/icons\/([a-z0-9-]+)\.svg/i.exec(url);
    if (icon) {
      const file = path.join(ROOT, "node_modules/simple-icons/icons", `${icon[1]}.svg`);
      if (existsSync(file))
        return route.fulfill({ contentType: "image/svg+xml", body: await readFile(file) });
      return route.fulfill({ status: 404, body: "" });
    }

    /* Web fonts are fetched through Node so the browser needs no direct egress. */
    if (/fonts\.(googleapis|gstatic)\.com/.test(url)) {
      try {
        if (!cache.has(url)) {
          const response = await fetch(url);
          cache.set(url, {
            status: response.status,
            contentType: response.headers.get("content-type") || "text/css",
            body: Buffer.from(await response.arrayBuffer()),
          });
        }
        const cached = cache.get(url);
        return route.fulfill({
          status: cached.status,
          contentType: cached.contentType,
          body: cached.body,
        });
      } catch {
        return route.fulfill({ status: 200, contentType: "text/css", body: "" });
      }
    }
    return route.fulfill({ status: 200, body: "" });
  });

  /* The shipped document pins CDN scripts with SRI; local stubs legitimately
     differ, so integrity is stripped from the served copy only. */
  await page.route(/\/legacy\/dashboard(?:-en)?\.html(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      /\s+integrity="sha384-[^"]+"\s+crossorigin="anonymous"/g,
      "",
    );
    await route.fulfill({ response, body });
  });
}

/* ─────────────────────────────────── capture ──────────────────────────────── */

/* WebP keeps the previews sharp at roughly a quarter of the PNG bytes, which
   matters when the README ships forty of them. Chromium does the encoding, so
   the script stays dependency-free. */
async function createEncoder(browser) {
  if (FORMAT !== "webp") return null;
  const page = await browser.newPage({ viewport: { width: 8, height: 8 } });
  await page.setContent("<!doctype html><html><body></body></html>");
  return async (buffer) => {
    const encoded = await page.evaluate(
      async ({ base64, quality }) => {
        const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext("2d").drawImage(bitmap, 0, 0);
        return canvas.toDataURL("image/webp", quality).split(",")[1];
      },
      { base64: buffer.toString("base64"), quality: WEBP_QUALITY },
    );
    return Buffer.from(encoded, "base64");
  };
}

/* A neutral, obviously-synthetic still for the camera cards: the previews must
   never suggest they show footage from a real installation. */
async function renderCameraStill(browser) {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await page.setContent(`<!doctype html><html><body style="margin:0">
    <div style="width:640px;height:360px;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:14px;font-family:system-ui,sans-serif;color:#64748b;
      background:radial-gradient(circle at 50% 35%,#1e293b,#0b1220 70%)">
      <div style="font-size:54px">📷</div>
      <div style="font-size:16px;font-weight:700;letter-spacing:.14em">ANTEPRIMA DEMO</div>
      <div style="font-size:12px;opacity:.75">nessuno stream reale in questa immagine</div>
    </div></body></html>`);
  const buffer = await page.screenshot({ type: "png" });
  await page.close();
  return buffer;
}

/* Same idea as the camera still: the vehicle hero shows the owner's own photo,
   so the preview needs something that is clearly a placeholder. */
async function renderVehicleStill(browser) {
  const page = await browser.newPage({ viewport: { width: 900, height: 420 } });
  await page.setContent(`<!doctype html><html><body style="margin:0">
    <div style="width:900px;height:420px;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:12px;font-family:system-ui,sans-serif;color:#94a3b8;
      background:radial-gradient(circle at 50% 40%,#1f2937,#0b1220 72%)">
      <div style="font-size:88px">🚗</div>
      <div style="font-size:15px;font-weight:700;letter-spacing:.16em">FOTO DEL VEICOLO</div>
      <div style="font-size:12px;opacity:.75">anteprima demo · qui va la tua foto</div>
    </div></body></html>`);
  const buffer = await page.screenshot({ type: "png" });
  await page.close();
  return buffer;
}

async function bootPage(context, cameraStill, vehicleStill) {
  const page = await context.newPage();
  page.on("pageerror", (error) => console.warn("  ! page error:", error.message.slice(0, 160)));
  await installRestRoutes(page, cameraStill, vehicleStill);
  await installRoutes(page);
  await installMockBackend(page);

  await page.addInitScript(
    ({ dashboardSeed }) => {
      const setItem = Storage.prototype.setItem;
      const getItem = Storage.prototype.getItem;
      const raw = window.localStorage;
      const write = (key, value) => {
        if (getItem.call(raw, key) === null) setItem.call(raw, key, value);
      };
      write("cd_preview_dm_dashboard_state", JSON.stringify(dashboardSeed));
      write(
        "cd_preview_cd_connection",
        JSON.stringify({
          token: "preview-token",
          ws_url: "ws://home-assistant.test/api/websocket",
        }),
      );
    },
    { dashboardSeed: seed },
  );

  await page.goto(`http://127.0.0.1:${PORT}/legacy/${VARIANT}?dmi=preview`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () => window.__DASHBOARDMODERN_LEGACY_READY__ && window.DashboardModernModules,
    null,
    { timeout: 60_000 },
  );

  await page.evaluate((states) => {
    const closeOverlays = () => {
      document.getElementById("editor-modal")?.remove();
      document.querySelectorAll(".modal-wrapper.show").forEach((node) => {
        node.classList.remove("show");
        node.style.removeProperty("opacity");
        node.style.removeProperty("visibility");
        node.style.removeProperty("pointer-events");
      });
      /* I fogli che non sono `.modal-wrapper` — i controlli di una luce, le
       * finestre di sezione — restavano aperti sopra il bersaglio successivo, e
       * la fotografia del popup usciva con dentro quello di prima. Si tolgono di
       * mezzo rimuovendoli: il runtime li ricostruisce a ogni apertura. */
      document
        .querySelectorAll("#dm-light-control-modal, .dm-section-modal, .dm-lightctl-dialog")
        .forEach((node) => node.remove());
      /* Boot artefact: the empty-state banner is evaluated 500 ms after
         DOMContentLoaded, before the mocked store has projected its sections. */
      document.getElementById("cd-empty-banner")?.remove();
    };

    /* ─── Segnalazioni ────────────────────────────────────────────────────
     *
     * La finestra delle segnalazioni parla col backend, che qui non c'e': al
     * suo posto risponde questo, con una coda inventata. Come per il resto
     * della galleria, niente arriva da un'installazione vera — sono
     * segnalazioni scritte apposta per la foto.
     */
    window.__dmPreviewTickets = (dove) => {
      const ORA = Date.parse("2026-09-01T09:20:00");
      const GIORNO = 86400000;
      const miei = [
        {
          id: "t1",
          type: "bug",
          title: "Le tapparelle non si fermano a meta'",
          body: "Premo stop dalla pagina Finestre e continuano a scendere fino in fondo. Con due Shelly 2PM su tre succede sempre.",
          state: "in-carico",
          created_at: ORA - 2 * GIORNO,
          remote_id: "194",
          reply:
            "Riprodotta: il comando stop parte, ma la seconda tapparella lo ignora. Sto guardando come il rele' riporta la posizione.",
          issue_url: "https://github.com/danigio15/dashboardmodern-v2/issues/194",
          delivery_error: "",
          diagnostics: {},
        },
        {
          id: "t2",
          type: "feature",
          title: "Un widget per il consumo della pompa di calore",
          body: "Mi piacerebbe vedere la pompa di calore accanto agli altri carichi, con il suo storico giornaliero.",
          state: "risolto",
          created_at: ORA - 9 * GIORNO,
          remote_id: "186",
          reply: "Fatto in beta.21: la pompa di calore si aggiunge dai carichi come le altre voci.",
          issue_url: "https://github.com/danigio15/dashboardmodern-v2/issues/186",
          delivery_error: "",
          diagnostics: {},
        },
        {
          id: "t3",
          type: "assistenza",
          title: "Non capisco come collegare il secondo contatore",
          body: "Ho un contatore per la casa e uno per il garage. Il secondo non so dove metterlo.",
          state: "bozza",
          created_at: ORA - 20 * 60000,
          remote_id: "",
          reply: "",
          issue_url: "",
          delivery_error: "",
          diagnostics: {},
        },
      ];
      const coda = [
        {
          number: 197,
          type: "bug",
          title: "La foto dell'auto torna quella di prima dopo il salvataggio",
          body: "Seleziono la vettura nuova, salvo, e un istante dopo ricompare quella vecchia.",
          state: "inviato",
          issue_url: "https://github.com/danigio15/dashboardmodern-v2/issues/197",
          author: "marco-b",
          origin: "plancia",
          comments: 2,
          attachments: 1,
        },
        {
          number: 196,
          type: "assistenza",
          title: "Non trovo la pagina Piscina",
          body: "Ho configurato le entita' ma la sezione non compare nella barra.",
          state: "inviato",
          issue_url: "https://github.com/danigio15/dashboardmodern-v2/issues/196",
          author: "chiara-r",
          origin: "plancia",
          comments: 1,
          attachments: 0,
        },
        {
          number: 194,
          type: "bug",
          title: "Le tapparelle non si fermano a meta'",
          body: "Premo stop dalla pagina Finestre e continuano a scendere fino in fondo.",
          state: "in-carico",
          issue_url: "https://github.com/danigio15/dashboardmodern-v2/issues/194",
          author: "anna-g",
          origin: "plancia",
          comments: 2,
          attachments: 2,
        },
        {
          number: 191,
          type: "feature",
          title: "Vorrei riordinare le stanze trascinandole",
          body: "Adesso si spostano con le frecce, una posizione per volta.",
          state: "inviato",
          issue_url: "https://github.com/danigio15/dashboardmodern-v2/issues/191",
          author: "luca-t",
          origin: "plancia",
          comments: 1,
          attachments: 0,
        },
        {
          number: 186,
          type: "feature",
          title: "Un widget per il consumo della pompa di calore",
          body: "Accanto agli altri carichi, con il suo storico giornaliero.",
          state: "risolto",
          issue_url: "https://github.com/danigio15/dashboardmodern-v2/issues/186",
          author: "anna-g",
          origin: "plancia",
          comments: 3,
          attachments: 0,
        },
        {
          number: 232,
          type: "bug",
          title: "Cam RING",
          body: "La telecamera si vede in Home Assistant ma nella pagina Sicurezza resta nera.",
          state: "in-carico",
          origin: "github",
          issue_url: "https://github.com/danigio15/dashboardmodern-v2/issues/232",
          author: "andyz68",
          comments: 3,
          attachments: 0,
        },
        {
          number: 266,
          type: "feature",
          title: "aggiunta radar meteo assieme al meteo",
          body: "Sarebbe comodo vedere il radar accanto alle previsioni, nella stessa pagina.",
          state: "inviato",
          origin: "github",
          issue_url: "https://github.com/danigio15/dashboardmodern-v2/issues/266",
          author: "pier08-byte",
          comments: 0,
          attachments: 0,
        },
        {
          number: 249,
          type: "",
          title: "[Feature]:",
          body: "Il modulo e' partito col titolo vuoto: nessuna etichetta, nessun prefisso da leggere.",
          state: "in-carico",
          origin: "github",
          issue_url: "https://github.com/danigio15/dashboardmodern-v2/issues/249",
          author: "nictes75",
          comments: 2,
          attachments: 0,
        },
      ];
      const collegato = dove !== "collega" && dove !== "codice";
      const daManutentore =
        dove === "console" || dove === "filo" || dove === "chiuse" || dove === "difetti";
      const account = collegato
        ? { connected: true, login: "anna-g", maintainer: daManutentore }
        : { connected: false, login: "", maintainer: false };
      const risposte = {
        "dashboardmodern/tickets/list": {
          tickets: miei,
          delivery: true,
          account,
          console: daManutentore,
        },
        "dashboardmodern/tickets/queue": { tickets: coda },
        "dashboardmodern/tickets/thread": {
          number: 197,
          body: "Seleziono la vettura nuova, salvo, e un istante dopo ricompare quella vecchia.",
          attachments: [],
          issue_url: "https://github.com/danigio15/dashboardmodern-v2/issues/197",
          state: "inviato",
          comments: [
            {
              id: "1",
              author: "marco-b",
              maintainer: false,
              at: "2026-09-01T08:41:00Z",
              body: "Ecco cosa vedo: nel video si nota che la foto cambia da sola dopo circa un secondo.",
              attachments: [
                {
                  url: "https://github.com/user-attachments/assets/finto-1",
                  kind: "image",
                  name: "Schermata del profilo auto",
                },
                {
                  url: "https://github.com/user-attachments/assets/finto-2",
                  kind: "file",
                  name: "registrazione.mp4",
                },
              ],
            },
            {
              id: "2",
              author: "chiara-r",
              maintainer: false,
              at: "2026-09-01T09:02:00Z",
              body: "Confermo, succede anche a me con due vetture configurate.",
              attachments: [],
            },
          ],
        },
        "dashboardmodern/tickets/auth/start": {
          user_code: "WDJB-MJHT",
          device_code: "finto",
          verification_uri: "https://github.com/login/device",
          interval: 5,
          expires_in: 900,
        },
        get_config: { version: "2026.8.0" },
      };
      const servizio = window.DashboardModernEnergyService || {};
      window.DashboardModernEnergyService = {
        ...servizio,
        broker: {
          ...(servizio.broker || {}),
          request: async (messaggio) => risposte[messaggio?.type] ?? {},
        },
      };
      const stato = window.__DASHBOARDMODERN_SEGNALAZIONI__;
      if (stato) {
        stato.appena =
          dove === "allegati"
            ? {
                numero: "197",
                url: "https://github.com/danigio15/dashboardmodern-v2/issues/197",
              }
            : null;
        stato.tab =
          dove === "codice"
            ? "mie"
            : dove === "collega"
              ? "nuova"
              : dove === "allegati"
                ? "mie"
                : dove === "filo" || dove === "chiuse" || dove === "difetti"
                  ? "console"
                  : dove;
        stato.fili = {};
        stato.filiInCorso = {};
        stato.queue =
          dove === "console" || dove === "filo" || dove === "chiuse" || dove === "difetti"
            ? coda
            : null;
        stato.auth =
          dove === "codice"
            ? {
                user_code: "7990-137F",
                device_code: "finto",
                verification_uri: "https://github.com/login/device",
                interval: 5,
                expires_in: 900,
              }
            : null;
        stato.avviso =
          dove === "codice" ? "Salvata. Manca solo la firma: autorizza GitHub e parte." : "";
        stato.tipo = "bug";
        stato.filtro = dove === "chiuse" ? "chiuse" : "aperte";
        stato.tipoCoda = dove === "difetti" ? "bug" : "";
        stato.bozza =
          dove === "nuova"
            ? {
                title: "Le tapparelle non si fermano a meta'",
                body: "Premo stop dalla pagina Finestre e continuano a scendere fino in fondo.\n\nSuccede con due Shelly 2PM su tre. La terza si ferma dove deve.",
                contact: "",
              }
            : { title: "", body: "", contact: "" };
      }
      if (dove === "widget") {
        // La tessera vive in Home: qui si semina soltanto quello che le serve.
        if (stato) {
          stato.console = true;
          stato.queue = coda;
          stato.queueAt = Date.now();
        }
        return;
      }
      window.DashboardModernSegnalazioni?.apri();
      if (dove === "filo" && stato) {
        stato.fili = { 197: risposte["dashboardmodern/tickets/thread"] };
      }
    };

    window.__dmPreview = {
      tab(name) {
        closeOverlays();
        document.body.classList.remove("nav-visible");
        document.getElementById("dm-preview-nav-style")?.remove();
        document.querySelector("nav.bottom-nav-bar")?.classList.remove("visible");
        document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
        document.querySelectorAll(".tab").forEach((node) => node.classList.remove("active"));
        const tab = document.querySelector(`.tab[data-tab="${name}"]`);
        if (tab) {
          tab.style.display = "";
          try {
            tab.click();
          } catch {}
          tab.classList.add("active");
        }
        document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
        document.getElementById(`page-${name}`)?.classList.add("active");
        closeOverlays();
        window.scrollTo(0, 0);
      },
      /* Sub-views are wired through inline onclick handlers that read the
         implicit global `event`, so they must be triggered by a real click. */
      sub(pageId, token) {
        const buttons = document.querySelectorAll(`#${pageId} .sub-tab-btn`);
        const match = [...buttons].find((button) =>
          String(button.getAttribute("onclick") || "").includes(`'${token}'`),
        );
        match?.click();
      },
      /* On pointer devices the bar is revealed by :hover, on touch by the
         handle's `visible` class. The injected rule mirrors the shipped
         :hover block so the preview shows the real revealed state. */
      nav() {
        document.body.classList.add("nav-visible");
        document.querySelector("nav.bottom-nav-bar")?.classList.add("visible");
        document.querySelectorAll(".tab").forEach((tab) => {
          if (tab.style.display === "none") tab.style.display = "";
        });
        if (!document.getElementById("dm-preview-nav-style")) {
          const style = document.createElement("style");
          style.id = "dm-preview-nav-style";
          style.textContent = `nav.tabs.bottom-nav-bar{bottom:20px!important;opacity:1!important;
            pointer-events:auto!important}`;
          document.head.appendChild(style);
        }
      },
      /* The shipped theme switcher: 'auto' follows the OS preference. */
      theme(pref) {
        window.setTheme?.(pref);
      },
      motion(enabled) {
        const existing = document.getElementById("dm-preview-still");
        if (enabled) {
          existing?.remove();
          return;
        }
        if (existing) return;
        const still = document.createElement("style");
        still.id = "dm-preview-still";
        still.textContent = window.__DM_PREVIEW_STILL_CSS__ || "";
        document.head.appendChild(still);
      },
      editor(tab, innerTab) {
        closeOverlays();
        window.apriConfigEntita?.();
        /* Le schede aggiunte dai moduli — Persone, Aspirapolvere, Aperture,
         * Backup — si registrano dopo l'apertura dell'editor: chiamare
         * `editorSwitch` subito le trovava assenti e lasciava il corpo vuoto.
         * Premere la linguetta e' quello che farebbe una persona, e funziona
         * per tutte allo stesso modo. */
        const linguetta = document.querySelector(`.ed-tab[data-tab="${tab}"]`);
        if (linguetta) linguetta.click();
        else window.editorSwitch?.(tab);
        /* Le schede dei moduli si disegnano quando si riconoscono attive, e chi
         * decide chi e' attiva e' la classe sulla linguetta. Il runtime la
         * sposta solo per le schede che conosce, e per le altre svuota il corpo
         * subito dopo il click: bisogna quindi rimetterla quando lui ha finito,
         * non nello stesso giro. */
        setTimeout(() => {
          for (const nodo of document.querySelectorAll(".ed-tab")) {
            nodo.classList.toggle("active", nodo.dataset.tab === tab);
          }
          /* L'evento con cui l'editor annuncia di essersi ridisegnato: i moduli
           * lo aspettano per riempire il corpo della propria scheda. */
          window.dispatchEvent(new Event("dashboardmodern:editor-rendered"));
        }, 400);
        if (innerTab != null)
          document.querySelectorAll("#ed-body .ed-inner-tabs .ed-inner-tab")[innerTab]?.click();
      },
    };

    /* Some renderers read the global state tables directly. */
    states.forEach((item) => {
      window._RAW_STATES ||= {};
      window.STATES ||= {};
      window._RAW_STATES[item.entity_id] = structuredClone(item);
      window.STATES[item.entity_id] = structuredClone(item);
    });
  }, haStates);

  if (argv.includes("--debug")) {
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type()))
        console.log(`  [${message.type()}]`, message.text().slice(0, 200));
    });
    page.on("requestfailed", (request) => console.log("  [failed]", request.url().slice(0, 160)));
    page.on("response", (response) => {
      if (response.status() >= 400)
        console.log(`  [${response.status()}]`, response.url().slice(0, 160));
    });
  }

  /* Let the runtime finish its first full render pass. */
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    try {
      window.render?.();
    } catch {}
    try {
      window.buildQuickActions?.();
      window.buildTempCards?.();
      window.buildDeviceCards?.();
      window.cdRenderCustomAvvisi?.();
      window.renderAllarmeBanner?.();
      window.renderCaldaiaBanner?.();
    } catch {}
  });
  await page.waitForTimeout(1500);
  return page;
}

const MEASURE = () => {
  const visible = (node) => {
    const style = getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden";
  };
  let bottom = 0;
  const walk = (node, depth) => {
    if (!visible(node)) return;
    const box = node.getBoundingClientRect();
    if (box.height > 0) bottom = Math.max(bottom, box.bottom + window.scrollY);
    if (depth <= 0) return;
    for (const child of node.children) walk(child, depth - 1);
  };
  for (const node of document.querySelectorAll(
    "header, .page.active, .modal-wrapper.show, #editor-modal, #dm-light-control-modal, #dm-widget-popup",
  ))
    walk(node, 3);
  /* La larghezza serve quanto l'altezza. Se il contenuto e' piu' largo della
   * finestra, il browser fotografa la finestra e il resto resta fuori: si
   * vedeva come un taglio netto sul bordo di ogni pagina. */
  return {
    bottom: Math.ceil(bottom),
    width: Math.ceil(
      Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0),
    ),
  };
};

async function shoot(page, target, file, viewport, encode) {
  const isModal = Boolean(target.modal) || String(target.setup).includes("__dmPreview.editor");
  const settle = target.settle ?? 1600;
  const fit = (value) => Math.min(Math.max(Math.ceil(value) + 24, 460), viewport.maxHeight);

  let width = viewport.width;

  const paint = async (height, wait) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: target.motion ? "no-preference" : "reduce" });
    await page.evaluate((enabled) => window.__dmPreview.motion(enabled), Boolean(target.motion));
    await page.evaluate((pref) => window.__dmPreview.theme(pref), THEME || target.theme || "auto");
    await page.evaluate(target.setup);
    await page.waitForTimeout(wait);
    await page.evaluate(() => window.scrollTo(0, 0));
    return page.evaluate(MEASURE);
  };

  /* Two passes: the first learns the content height, the second re-renders at
     that exact viewport so nothing depends on a stale layout and position:fixed
     chrome (navigation bar, modal shell) lands where it belongs. */
  const first = await paint(viewport.height, settle);
  /* Una sola volta, prima della passata che conta: la larghezza cresce fino a
   * contenere quello che sborda, mai oltre un limite ragionevole. */
  if (first.width > width && first.width - width <= 400) width = first.width;
  const second = await paint(fit(first.bottom), settle);
  if (second.width > width && second.width - width <= 400) width = second.width;
  if (Math.abs(fit(second.bottom) - fit(first.bottom)) > 32 || second.width > viewport.width) {
    await paint(fit(second.bottom), Math.round(settle / 2));
  }

  if (argv.includes("--debug")) {
    const diag = await page.evaluate(() => ({
      sent: [...new Set((window.__dmSent || []).map((message) => message.type))],
      stats: (window.__dmSent || []).filter((m) => m.type?.includes("statistics")).length,
      bridged: Boolean(window.__DASHBOARDMODERN_BRIDGED__),
      service: Object.keys(window.DashboardModernEnergyService || {}),
      bundle: window.DashboardModernEnergyService?.broker
        ? Object.keys(window.DashboardModernEnergyService.broker)
        : null,
      runtime: Object.keys(window).filter((key) => key.startsWith("__DASHBOARDMODERN_RUNTIME")),
    }));
    console.log("  debug", JSON.stringify(diag).slice(0, 1200));
  }

  /* Un foglio che non e' una `.modal-card` — i controlli di una luce vivono in
   * un dialogo tutto loro, sopra il popup delle luci — va detto per nome,
   * altrimenti la fotografia inquadra la card sotto e taglia quella sopra. */
  const element = target.element
    ? await page.$(target.element)
    : isModal
      ? await page.$("#editor-modal .modal-card, .modal-wrapper.show .modal-card")
      : null;
  const shot = element
    ? await element.screenshot({ type: "png", scale: "device" })
    : await page.screenshot({ type: "png", scale: "device" });
  const buffer = encode ? await encode(shot) : shot;
  await writeFile(file, buffer);
  console.log(`  ✓ ${path.relative(ROOT, file)} (${Math.round(buffer.length / 1024)} KB)`);
}

async function main() {
  const server = startServer(PORT);
  const stop = () => {
    if (!server.killed) server.kill();
  };
  process.on("exit", stop);

  try {
    await waitForPort(PORT);
    /* Svuotare la cartella ha senso solo per una passata che la riempie tutta.
     * Una passata parziale — un tema solo, o `--only` — cancellerebbe il lavoro
     * dell'altra: e' esattamente cosi' che una galleria chiara si e' portata via
     * quella scura. Chi vuole davvero ripartire da zero lo chiede con `--fresh`. */
    const partial = Boolean(THEME) || ONLY.length > 0;
    if (KEEP === false && (FRESH || !partial)) {
      await rm(OUT_DIR, { recursive: true, force: true });
    }
    await mkdir(OUT_DIR, { recursive: true });

    const browser = await chromium.launch({
      headless: !HEADED,
      ...(CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : {}),
      args: ["--font-render-hinting=none", "--force-color-profile=srgb", "--hide-scrollbars"],
    });

    const cameraStill = await renderCameraStill(browser);
    const vehicleStill = await renderVehicleStill(browser);
    const encode = await createEncoder(browser);
    const targets = ONLY.length ? TARGETS.filter((item) => ONLY.includes(item.id)) : TARGETS;
    console.log(
      `Rendering ${targets.length} previews from ${VARIANT}` +
        `${CHART_JS ? " (real Chart.js)" : " (chart stub)"}`,
    );

    for (const [label, viewport] of [
      ["desktop", DESKTOP],
      ["mobile", MOBILE],
    ]) {
      const scoped = targets.filter(
        (target) => label === "desktop" || target.both || argv.includes("--all-mobile"),
      );
      if (!scoped.length) continue;
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.deviceScaleFactor,
        isMobile: label === "mobile",
        hasTouch: label === "mobile",
        locale: VARIANT.includes("-en") ? "en-GB" : "it-IT",
        timezoneId: "Europe/Rome",
        /* Must agree with the theme being captured: the shipped CSS has both
           `prefers-color-scheme` rules and an explicit [data-theme] override, so
           announcing dark while forcing the light theme mixes the two palettes. */
        colorScheme: THEME === "light" ? "light" : "dark",
        reducedMotion: "reduce",
      });
      const page = await bootPage(context, cameraStill, vehicleStill);
      console.log(`\n${label}:`);
      for (const target of scoped) {
        const suffix = `${label === "mobile" ? "-mobile" : ""}${THEME ? `-${THEME}` : ""}`;
        const file = path.join(OUT_DIR, `${target.id}${suffix}.${FORMAT}`);
        try {
          await shoot(page, target, file, viewport, encode);
        } catch (error) {
          console.error(`  ✗ ${target.id}: ${error.message.slice(0, 200)}`);
        }
      }
      await context.close();
    }

    await browser.close();
  } finally {
    stop();
  }
}

await main();
