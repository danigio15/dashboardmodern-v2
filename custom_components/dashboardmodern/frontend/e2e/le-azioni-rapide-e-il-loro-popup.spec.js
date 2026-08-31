/* Le azioni rapide: fuori dai widget, e configurabili anche in modifica.
 *
 * Due segnalazioni dallo stesso schermo. «Tutte le azioni rapide non devono
 * comparire nei widget: affianco a una azione rapida creata mi compare lo
 * switch per attivare o meno il widget e comunque non compare — devi abolire
 * la sezione azioni rapide dai widget, hanno la sezione loro nella home.» E:
 * «azione rapida lavatrice in modifica non mi fa scegliere tutte le entita'
 * del popup ... ho inserito tutte le entita' ma non me le ha salvate».
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

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
  visibility: { home: true },
};

const AZIONI = [
  { type: "builtin", builtin: "lavatrice", name: "Lavatrice", icon: "🧺" },
  { type: "toggle", entity: "switch.frog", name: "Frog", icon: "⚡" },
];

async function apriAzioni(page) {
  await page.evaluate((azioni) => {
    localStorage.setItem("cd_quick_actions", JSON.stringify(azioni));
    window.buildQuickActions?.();
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    try {
      editorSwitch("sez8");
    } catch (_errore) {}
  }, AZIONI);
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            [...document.querySelectorAll("#ed-body .ed-row")].filter((riga) =>
              /Frog/.test(riga.textContent || ""),
            ).length,
        ),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
}

test("sulla riga di un'azione rapida non c'e' l'interruttore dei widget", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await apriAzioni(page);

  /* L'interruttore si attaccava a ogni riga che nomina un'entita', e la riga
   * di un'azione la nomina: prometteva di togliere dai widget una cosa che nei
   * widget non c'e' mai stata. Si aspetta il giro del motore, poi si guarda. */
  await page.waitForTimeout(1200);
  const conteggio = await page.evaluate(() => {
    const righe = [...document.querySelectorAll("#ed-body .ed-row")].filter((riga) =>
      riga.querySelector('[onclick^="edDelQA"]'),
    );
    return {
      righe: righe.length,
      interruttori: righe.filter((riga) => riga.querySelector("[data-dm-widget-entities]")).length,
    };
  });
  expect(conteggio.righe).toBeGreaterThan(0);
  expect(conteggio.interruttori).toBe(0);
});

test("modificando l'azione della lavatrice esce la configurazione completa del popup", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await apriAzioni(page);

  /* La matita della riga «Lavatrice», che e' il gesto di chi torna a
   * configurare quello che ha gia' creato. */
  await page.evaluate(() => {
    const riga = [...document.querySelectorAll("#ed-body .ed-row")].find((r) =>
      /Lavatrice/i.test(r.textContent || ""),
    );
    const matita = [...(riga?.querySelectorAll("button,.ed-del") || [])].find((b) =>
      /✏️/.test(b.textContent || ""),
    );
    matita?.click();
  });

  const carta = page.locator("#dm-action-editor-modal [data-dm-lav-programmi]");
  await expect(carta).toBeVisible({ timeout: 20_000 });
  /* Tutte le caselle del popup, non solo i tasti dei programmi. */
  await expect(carta.locator(".dm-lav-slot-in")).toHaveCount(8);

  /* E quello che si scrive qui si salva: e' il punto della segnalazione. */
  await carta.locator('.dm-lav-slot-in[data-ref="dm.lavatrice_programma"]').evaluate((campo) => {
    campo.value = "select.lavatrice_programma";
    campo.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("cd_entity_overrides") || "{}")[
              "dm.lavatrice_programma"
            ] || "",
        ),
      { timeout: 20_000 },
    )
    .toBe("select.lavatrice_programma");

  /* Scelta un'altra azione la carta si ritira: non e' roba di tutte. */
  await page.locator("#dm-action-editor-modal select[name='type']").selectOption("toggle");
  await expect(carta).toHaveCount(0);
});

test("i tasti dei programmi portano i disegni di casa, e chi aveva un'emoji la tiene", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));

  const tasti = await page.evaluate(async () => {
    localStorage.setItem(
      "cd_lavatrice_programmi",
      JSON.stringify([
        { name: "Eco", entity: "script.eco", icon: "mdi:leaf" },
        { name: "Centrifuga", entity: "script.centrifuga", icon: "mdi:rotate-3d-variant" },
        { name: "Vecchio", entity: "script.vecchio", icon: "⏱️" },
      ]),
    );
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    await new Promise((ok) => setTimeout(ok, 800));
    return [...document.querySelectorAll("#lavatrice-modal .lav-preset-btn")].map((tasto) => ({
      nome: tasto.querySelector(".name")?.textContent,
      disegno: Boolean(tasto.querySelector(".icon-wrap svg")),
      testo: (tasto.querySelector(".icon-wrap")?.textContent || "").trim(),
    }));
  });

  expect(tasti.map((tasto) => tasto.nome)).toEqual(["Eco", "Centrifuga", "Vecchio"]);
  expect(tasti[0].disegno).toBe(true);
  expect(tasti[1].disegno).toBe(true);
  /* Chi si era scritto un'emoji a mano non perde niente. */
  expect(tasti[2].testo).toBe("⏱️");
});
