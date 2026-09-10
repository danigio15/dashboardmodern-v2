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

/* Sei finestre, e la stanza la decide chi chiama: tutte insieme in salone —
 * come nella #349 — oppure una per stanza, che e' la casa della #424. */
function seme(stanze) {
  return {
    schema_version: 4,
    sections: {
      rooms: [...new Set(stanze)].map((nome, indice) => ({
        id: `room-${indice + 1}`,
        name: nome,
        icon: "🛋️",
      })),
      cameras: [],
      appliances: [],
      loads: [],
      lights: [],
      climate: [],
      ev: [],
      covers: stanze.map((stanza, indice) => ({
        id: `c${indice + 1}`,
        name: `Finestra ${indice + 1}`,
        entity: `cover.finestra_${indice + 1}`,
        room: stanza,
      })),
      pool: {},
      irrigation: { zones: [] },
      energy: {},
      entityOverrides: {},
    },
    visibility: { home: true, tapparelle: true },
  };
}

const TUTTE_IN_SALONE = seme(Array.from({ length: 6 }, () => "Salone"));
const UNA_PER_STANZA = seme(["Salone", "Cucina", "Camera", "Studio", "Bagno", "Ingresso"]);

const statiDi = (semino) =>
  semino.sections.covers.map((riga) => ({
    entity_id: riga.entity,
    state: "closed",
    attributes: { friendly_name: riga.name, current_position: 0, supported_features: 15 },
  }));

async function avvia(page, testInfo, semino = TUTTE_IN_SALONE) {
  const STATI = statiDi(semino);
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, semino);
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

test("una tapparella per stanza non le manda in colonna (#424)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "il telefono ha una colonna sola per scelta");
  await avvia(page, testInfo, UNA_PER_STANZA);

  /* Le stesse sei finestre della prova qui sopra, cambiata una cosa sola: una
   * per stanza invece che tutte in salone. Prima bastava questo per rimettere
   * tutto in colonna, perche' ogni card si portava dietro la sua intestazione
   * di stanza, che prende la riga intera. */
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(() => perRiga(page)).toBeGreaterThanOrEqual(2);
  expect(await riempimento(page)).toBeGreaterThan(0.9);

  await page.setViewportSize({ width: 1600, height: 900 });
  await expect.poll(() => perRiga(page)).toBeGreaterThanOrEqual(3);

  /* E la stanza non si e' persa per strada: la dice la card, sotto il nome. */
  const stanze = await page
    .locator("#page-tapparelle .tapp-card .dm-tapp-room")
    .evaluateAll((nodi) => nodi.map((n) => n.textContent.trim()));
  expect(new Set(stanze)).toEqual(
    new Set(["Salone", "Cucina", "Camera", "Studio", "Bagno", "Ingresso"]),
  );
  await expect(page.locator("#page-tapparelle .dm-tapp-group")).toHaveCount(0);
});

test("la stanza con piu' finestre si annuncia ancora", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "e' una prova di larghezza");
  /* L'intestazione non e' stata tolta: e' rimasta dove distingue qualcosa. Con
   * due finestre in salone e le altre sparse, si annuncia il salone e basta. */
  await avvia(page, testInfo, seme(["Salone", "Salone", "Cucina", "Camera", "Studio", "Bagno"]));
  await page.setViewportSize({ width: 1280, height: 900 });
  const gruppi = page.locator("#page-tapparelle .dm-tapp-group");
  await expect(gruppi).toHaveCount(1);
  await expect(gruppi.first()).toContainText("Salone");
  await expect(gruppi.first()).toContainText("2");
});
