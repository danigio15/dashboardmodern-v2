/* «Tapparella aperta», «Tenda dispiegata», «Finestra aperta» (#353).
 *
 * Tre cose in una segnalazione sola, e sono la stessa cosa vista da tre lati:
 * la pastiglia diceva «Aperta» senza dire di COSA, la spunta delle percentuali
 * invertite non girava lo stato dichiarato, e con lei restavano fermi anche il
 * cursore e il disegno.
 *
 * Qui si guarda la pagina vera: le parole sulle card, e una tapparella montata
 * al contrario che la posizione non la pubblica affatto — che e' il caso in cui
 * la spunta non faceva assolutamente nulla.
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
    covers: [
      /* La tapparella della segnalazione: montata al contrario, e Home
       * Assistant per lei dice solo «open» — nessuna percentuale. */
      {
        id: "c1",
        name: "Tapparella girata",
        entity: "cover.girata",
        room: "Salone",
        invertita: true,
      },
      { id: "c2", name: "Tapparella dritta", entity: "cover.dritta", room: "Salone" },
      { id: "c3", name: "Tenda del salone", tenda: "cover.tenda", room: "Salone" },
      { id: "c4", name: "Tenda da sole", tendaSole: "cover.sole", room: "Salone" },
      { id: "c5", name: "Vasistas", contact: "binary_sensor.vasistas", room: "Salone" },
    ],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, tapparelle: true },
};

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });
const STATI = [
  /* Nessun `current_position`: e' proprio la copertura su cui la spunta non
   * faceva niente. Home Assistant la dice aperta; girata, e' chiusa. */
  stato("cover.girata", "open", { friendly_name: "Girata" }),
  stato("cover.dritta", "open", { friendly_name: "Dritta", current_position: 100 }),
  stato("cover.tenda", "open", {
    friendly_name: "Tenda",
    current_position: 100,
    device_class: "curtain",
  }),
  stato("cover.sole", "open", {
    friendly_name: "Sole",
    current_position: 100,
    device_class: "awning",
  }),
  stato("binary_sensor.vasistas", "on", { friendly_name: "Vasistas", device_class: "window" }),
];

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
}

const carta = (page, entity) => page.locator(`#page-tapparelle .tapp-card[data-tapp="${entity}"]`);
const pastiglia = (page, entity) => carta(page, entity).locator("[data-dm-state]");

test("ogni card dice cosa è aperto: tapparella, tenda, tenda da sole, finestra", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await expect(carta(page, "cover.dritta")).toBeVisible({ timeout: 15_000 });
  await expect(pastiglia(page, "cover.dritta")).toHaveText("Tapparella aperta");
  await expect(pastiglia(page, "cover.tenda")).toHaveText("Tenda aperta");
  /* Una tenda da sole non si «apre»: si dispiega. */
  await expect(pastiglia(page, "cover.sole")).toHaveText("Tenda dispiegata");
  await expect(pastiglia(page, "binary_sensor.vasistas")).toHaveText("Finestra aperta");
});

test("la tapparella girata senza percentuali segue davvero la spunta", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  const girata = carta(page, "cover.girata");
  await expect(girata).toBeVisible({ timeout: 15_000 });
  /* Home Assistant la dice «open»; la riga e' invertita, quindi sulla plancia
   * e' chiusa — e lo dicono tutte e tre le cose insieme. */
  await expect(pastiglia(page, "cover.girata")).toHaveText("Tapparella chiusa");
  /* Il telo copre tutto il vano e la barra della posizione e' vuota: il
   * disegno e il cursore non smentiscono piu' la pastiglia — prima restavano
   * tutti e tre sull'«aperta» di Home Assistant. */
  const disegno = () =>
    page.evaluate(() => {
      const carta = document.querySelector('.tapp-card[data-tapp="cover.girata"]');
      return {
        telo: carta?.querySelector("[data-dm-panel]")?.style.height,
        luce: carta?.style.getPropertyValue("--tapp-open").trim(),
      };
    });
  await expect.poll(disegno).toEqual({ telo: "100%", luce: "0" });
  /* E la sua vicina, non invertita, dice il contrario con gli stessi occhi. */
  await expect(pastiglia(page, "cover.dritta")).toHaveText("Tapparella aperta");
  await expect(carta(page, "cover.dritta").locator("[data-dm-readout]")).toHaveText("100%");

  /* Chiusa secondo Home Assistant, aperta sulla plancia: il giro completo. */
  await page.evaluate(() => {
    for (const registro of [_RAW_STATES, typeof STATES === "undefined" ? {} : STATES])
      if (registro["cover.girata"]) registro["cover.girata"].state = "closed";
    window.dispatchEvent(
      new CustomEvent("dashboardmodern:state-changed", { detail: { entity_id: "cover.girata" } }),
    );
  });
  await expect(pastiglia(page, "cover.girata")).toHaveText("Tapparella aperta", {
    timeout: 15_000,
  });
  await expect.poll(disegno).toEqual({ telo: "0%", luce: "1" });
});
