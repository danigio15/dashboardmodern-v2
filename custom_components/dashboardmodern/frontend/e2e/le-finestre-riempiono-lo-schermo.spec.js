/* «Le cards sono tutte in colonna e non responsive» (#349).
 *
 * «Quando si guarda da PC o tablet le cards sono tutte in colonna: sarebbe
 * bello si allineassero in modo da sfruttare tutto lo spazio in larghezza, es.
 * 2 card o più in base alla risoluzione dello schermo.»
 *
 * La colonna aveva un tetto in pixel, e con un massimo definito il browser
 * conta le colonne su QUEL massimo: servivano 374 px per ognuna, e su un
 * tablet da 800 — dove di posto ce n'era per due — ne entrava una sola.
 *
 * Qui si contano le card che stanno sulla stessa riga, che è la cosa che si
 * vede: due o più da PC, una sola sul telefono.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-salone", name: "Salone", icon: "🛋️" }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: Array.from({ length: 6 }, (_vuoto, indice) => ({
      id: `c${indice + 1}`,
      name: `Finestra ${indice + 1}`,
      entity: `cover.finestra_${indice + 1}`,
      room: "Salone",
    })),
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, tapparelle: true },
};

const STATI = SEME.sections.covers.map((riga) => ({
  entity_id: riga.entity,
  state: "closed",
  attributes: { friendly_name: riga.name, current_position: 0, supported_features: 15 },
}));

async function avvia(page, testInfo) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((haStati) => {
    for (const voce of haStati) _RAW_STATES[voce.entity_id] = structuredClone(voce);
    if (typeof STATES !== "undefined")
      for (const [id, voce] of Object.entries(_RAW_STATES)) STATES[id] = structuredClone(voce);
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-tapparelle")?.classList.add("active");
    window.renderTapparelle?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  }, STATI);
  await expect(page.locator("#page-tapparelle .tapp-card")).toHaveCount(6, { timeout: 15_000 });
}

/* Quante card stanno sulla riga più affollata: si guardano le coordinate vere,
 * non il foglio di stile — è quello che si vede aprendo la pagina. */
function perRiga(page) {
  return page.evaluate(() => {
    const righe = new Map();
    for (const carta of document.querySelectorAll("#page-tapparelle .tapp-card")) {
      const y = Math.round(carta.getBoundingClientRect().y);
      righe.set(y, (righe.get(y) || 0) + 1);
    }
    return Math.max(0, ...righe.values());
  });
}

/* Quanto della larghezza disponibile resta bianco: una griglia che si ferma a
 * un terzo dello schermo è il difetto, e va misurata come tale. */
function riempimento(page) {
  return page.evaluate(() => {
    const griglia = document.getElementById("tapp-grid");
    const carte = [...griglia.querySelectorAll(".tapp-card")].map((c) => c.getBoundingClientRect());
    if (!carte.length) return 0;
    const sinistra = Math.min(...carte.map((r) => r.left));
    const destra = Math.max(...carte.map((r) => r.right));
    return (destra - sinistra) / griglia.getBoundingClientRect().width;
  });
}

test("da PC le finestre stanno in fila, non in colonna", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "il telefono ha la sua prova");
  await avvia(page, testInfo);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(() => perRiga(page)).toBeGreaterThanOrEqual(2);
  /* E lo spazio si usa quasi tutto: prima le card si fermavano a un terzo. */
  expect(await riempimento(page)).toBeGreaterThan(0.9);

  /* Un tablet in verticale: il posto per due c'è, e adesso ci stanno. */
  await page.setViewportSize({ width: 800, height: 1000 });
  await expect.poll(() => perRiga(page)).toBeGreaterThanOrEqual(2);

  /* Uno schermo largo ne mette ancora di più, invece di lasciare il bianco. */
  await page.setViewportSize({ width: 1600, height: 900 });
  await expect.poll(() => perRiga(page)).toBeGreaterThanOrEqual(3);
});

test("sul telefono resta una card per riga", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "questa è la prova del telefono");
  await avvia(page, testInfo);
  await expect.poll(() => perRiga(page)).toBe(1);
  /* E la card riempie la sua colonna: nessuna striscia di bianco di fianco. */
  expect(await riempimento(page)).toBeGreaterThan(0.9);
});
