/* Il flusso dell'energia non riscrive quello che non e' cambiato.
 *
 * La scena del flusso e' la cosa piu' indaffarata della plancia: gira piu' di
 * una volta al secondo, per tre viste, e per ognuna riscriveva gli attributi di
 * ogni bolla e di ogni linea — col valore che avevano gia'. Un `data-` riscritto
 * uguale e' comunque una scrittura sull'attributo: sveglia ogni osservatore
 * della pagina e invalida lo stile del nodo.
 *
 * Misurate, a stati fermi, erano **millesettecentosettantasette scritture in
 * quattro secondi**. Contano soprattutto quando una finestra e' aperta: il velo
 * del modale ha una sfocatura che rilegge lo sfondo, e ogni scrittura dietro e'
 * una sfocatura da rifare — e' da li' che viene il lampo che si vede sul
 * telefono.
 *
 * Qui si guarda la causa, non il lampo: con le letture ferme, la scena non deve
 * toccare quasi niente.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const LOADS = [
  { id: "load-boiler", name: "Boiler", power_entity: "sensor.boiler_power", order: 0 },
  { id: "load-wallbox", name: "Wallbox", power_entity: "sensor.wb_power", order: 1 },
];

const STATES = [
  {
    entity_id: "sensor.boiler_power",
    state: "800",
    attributes: { unit_of_measurement: "W", device_class: "power" },
  },
  {
    entity_id: "sensor.wb_power",
    state: "7200",
    attributes: { unit_of_measurement: "W", device_class: "power" },
  },
];

test("a stati fermi la scena del flusso non tocca le sue bolle e le sue linee", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);

  await bootNamespacedDashboard(page, "dashboard.html", testInfo, {
    schema_version: 4,
    sections: {
      rooms: [],
      cameras: [],
      appliances: [],
      loads: LOADS,
      lights: [],
      climate: [],
      ev: [],
      covers: [],
      pool: {},
      irrigation: { zones: [] },
      energy: {},
      entityOverrides: {},
    },
    visibility: { home: true, energy: true },
  });
  await page.waitForFunction(
    () => Boolean(document.getElementById("dm-page-masthead-style")),
    null,
    { timeout: 30_000 },
  );
  await page.evaluate((states) => {
    const raw = eval("_RAW_STATES");
    for (const entry of states) raw[entry.entity_id] = entry;
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  }, STATES);
  await page.evaluate(() => document.querySelector('[data-tab="energy"]')?.click());
  await page.waitForTimeout(1800);

  const esito = await page.evaluate(async () => {
    const viste = [...document.querySelectorAll("#page-energy .flow-view")];
    if (!viste.length) return { errore: "nessuna vista del flusso" };
    let scritture = 0;
    const per = new Map();
    const osservatore = new MutationObserver((mutazioni) => {
      for (const m of mutazioni) {
        /* Solo cio' che la scena possiede: le bolle, gli archi, le linee e il
         * palco. I contenitori `.flow-view` restano fuori: sono condivisi, e
         * chi ci scrive sopra (il velo di caricamento della pagina Energia) e'
         * un altro modulo. */
        const nodo = m.target;
        const suo =
          nodo.dataset?.dmFlowNode !== undefined ||
          nodo.dataset?.dmFlowArc !== undefined ||
          nodo.classList?.contains?.("flow-line") ||
          nodo.classList?.contains?.("flow-stage");
        if (!suo) continue;
        scritture += 1;
        const chi = `${nodo.nodeName}.${nodo.className?.baseVal ?? nodo.className ?? ""}`;
        per.set(String(chi).slice(0, 60), (per.get(String(chi).slice(0, 60)) || 0) + 1);
      }
    });
    for (const vista of viste) {
      osservatore.observe(vista, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      });
    }
    // Quattro secondi di giri di stati, e nessuna lettura che cambia.
    for (let i = 0; i < 8; i++) {
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
      await new Promise((r) => setTimeout(r, 500));
    }
    osservatore.disconnect();
    return { scritture, dettaglio: [...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8) };
  });

  expect(esito.errore, esito.errore || "").toBeUndefined();
  expect(
    esito.scritture,
    `la scena si e' riscritta ${esito.scritture} volte a stati fermi: ${JSON.stringify(
      esito.dettaglio,
    )}`,
  ).toBeLessThanOrEqual(20);
});
