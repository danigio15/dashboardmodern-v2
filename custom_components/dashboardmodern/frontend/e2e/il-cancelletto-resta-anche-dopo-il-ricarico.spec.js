/* «Ho riprovato con la nuova versione ma lo switch del cancelletto non viene
 * memorizzato» (#439), e la stessa cosa su una `cover.` (#450).
 *
 * Che si salvi lo prova già `le-porte-si-salvano-tutte`. Quello che quella
 * prova NON guarda è cosa resta dopo: la plancia si ricarica, la
 * configurazione ripassa dalle migrazioni, e una riga che sparisce lì dentro
 * dà esattamente il sintomo segnalato — «l'ho salvata e non c'è più». Qui si
 * riapre la plancia da capo e si guarda se il cancelletto è ancora suo.
 */
import { expect, test } from "@playwright/test";
import { attendiLaPlancia, bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, security: true },
};

const porte = (page) =>
  page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("cd_security_doors") || "[]").map((p) => p.entity),
  );

test("il cancelletto salvato è ancora lì dopo un ricarico", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);

  /* Lo stesso relè è ANCHE una presa: è il caso della segnalazione — un
   * Sonoff che apre il cancelletto e che uno ha messo anche fra le prese. */
  await page.evaluate(() => {
    window.localStorage.setItem(
      "cd_prese",
      JSON.stringify([{ id: "p1", entity: "switch.cancelletto", name: "Cancelletto" }]),
    );
  });

  await page.evaluate(() => window.apriConfigEntita());
  await page.evaluate(() => window.editorSwitch?.("doors"));
  await expect(page.locator("[data-door-add]")).toBeAttached({ timeout: 20000 });
  await page.locator("[data-door-add]").click();
  await page.locator("[data-door-add]").click();
  await page.evaluate(() => {
    const compila = (indice, nome, entita) => {
      document.getElementById(`dm-door-${indice}-name`).value = nome;
      const campo = document.getElementById(`dm-door-${indice}-entity`);
      campo.value = entita;
      campo.dispatchEvent(new Event("change", { bubbles: true }));
    };
    compila(0, "Cancelletto", "switch.cancelletto");
    compila(1, "Basculante", "cover.basculante");
  });
  await page.locator(".dm-save-footer-btn").click();

  await expect
    .poll(() => porte(page), { timeout: 10000 })
    .toEqual(["switch.cancelletto", "cover.basculante"]);

  /* Il ricarico: è qui che il sintomo si vede — «l'ho salvata e non c'è più».
   * La plancia riparte, ripassa dalle migrazioni, e la riga deve restare. */
  await page.reload();
  await expect
    .poll(() => porte(page), { timeout: 25000 })
    .toEqual(["switch.cancelletto", "cover.basculante"]);

  /* E la configurazione le ritrova: salvate ma invisibili sarebbe lo stesso
   * sintomo detto in un altro modo.
   *
   * Si aspetta che la plancia sia ripartita prima di chiederle qualcosa: dopo
   * un ricarico `editorSwitch` per un attimo non c'e', e chiamarla allora non
   * apre niente e non dice niente. */
  await attendiLaPlancia(page);
  await page.evaluate(() => window.apriConfigEntita());
  await page.evaluate(() => window.editorSwitch?.("doors"));
  await expect(page.locator("[data-door-index]")).toHaveCount(2, { timeout: 25000 });
});

/* Il modo in cui la riga si perde davvero.
 *
 * L'editor delle porte ascolta solo i clic: quello che si scrive — o che ci
 * mette il selettore 🔍 — vive nel documento e in nessun altro posto finché
 * non si preme il tasto verde. Ma il tasto «＋ Aggiungi apertura», la matita
 * di un'altra riga e la spunta della conferma RIDISEGNANO l'elenco leggendolo
 * da quello che è salvato: tutto quello che si era battuto e non ancora
 * salvato sparisce, in silenzio. Chi aggiunge due cancelli di fila perde il
 * primo, e da fuori si chiama «non viene memorizzato».
 */
test("l'entità scritta non sparisce se si aggiunge un'altra riga", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => window.apriConfigEntita());
  await page.evaluate(() => window.editorSwitch?.("doors"));
  await expect(page.locator("[data-door-add]")).toBeAttached({ timeout: 20000 });

  await page.locator("[data-door-add]").click();
  await page.evaluate(() => {
    document.getElementById("dm-door-0-name").value = "Cancelletto";
    const campo = document.getElementById("dm-door-0-entity");
    campo.value = "switch.cancelletto";
    campo.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // Il secondo cancello: è questo gesto che ridisegna e si mangiava il primo.
  await page.locator("[data-door-add]").click();

  await expect(page.locator("#dm-door-0-entity")).toHaveValue("switch.cancelletto");
  await expect(page.locator("#dm-door-0-name")).toHaveValue("Cancelletto");
});
