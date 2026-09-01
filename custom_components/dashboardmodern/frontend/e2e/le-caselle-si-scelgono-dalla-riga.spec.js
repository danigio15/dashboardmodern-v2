/* Le caselle del popup Lavatrice si scelgono dalla riga, come tutte le altre.
 *
 * Dal campo, con lo scatto: «lente per ricerca entita nel config azioni rapide
 * popup lavatrice: questa funzione e' stata deprecata con la nuova metodologia
 * di ricerca entita'» — e poi, per essere chiari: «non c'e' la lente per la
 * ricerca entita' ma si fa direttamente nella riga».
 *
 * Nella finestra «Modifica azione» ogni casella portava DUE tasti azzurri con
 * la lente, appaiati: uno se lo disegnava la carta, l'altro glielo metteva la
 * guardia del selettore, che non riconosceva il primo come gia' fatto. E
 * nessuno dei due era il modo giusto: in tutta la plancia un'entita' si sceglie
 * dalla riga stessa — la pastiglia che dice cosa c'e' dentro, il cestino per
 * toglierla, «Modifica manuale» per chi vuole batterla a mano.
 *
 * Quella passata girava solo dentro le fisarmoniche delle Sezioni, e questa
 * carta nella finestra di modifica sta altrove: non la raggiungeva. Adesso la
 * carta la chiede, e vale nei due posti in cui compare.
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

async function apriLaModificaDellaLavatrice(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
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
  /* La matita della riga «Lavatrice»: e' da li' che si arriva alla finestra
   * dello scatto. */
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
  await expect(carta.locator(".dm-lav-slot-in")).toHaveCount(8);
  return carta;
}

test("le caselle del popup hanno la riga di scelta, non la lente", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const carta = await apriLaModificaDellaLavatrice(page, testInfo);

  /* La riga di scelta su tutte e otto. Si aspetta, perche' la passata che
   * decora arriva a giri e la carta nasce un istante prima. */
  await expect
    .poll(
      () => page.evaluate(() => document.querySelectorAll(".dm-lav-slot > .dm-slot-chip").length),
      { timeout: 20_000 },
    )
    .toBe(8);
  await expect(carta.locator(".dm-lav-slot > .dm-slot-chip").first()).toContainText(
    "Scegli entità",
  );

  /* E la lente non si vede piu'.
   *
   * Quella che la carta si disegnava da sola non c'e' proprio piu'. Della
   * guardia ne resta una nel documento, nascosta insieme al campo grezzo:
   * torna in vista solo con «Modifica manuale», dove si batte l'entita' a
   * mano ed e' un aiuto. Quello che conta e' che a riga chiusa non se ne
   * veda nessuna — erano due, appaiate, ed e' la segnalazione. */
  const lentiVisibili = () =>
    page.evaluate(
      () =>
        [
          ...document.querySelectorAll(
            ".dm-lav-slot .dm-entity-picker:not(.dm-slot-chip),.dm-lav-slot .dm-lav-slot-btn",
          ),
        ].filter((nodo) => nodo.getBoundingClientRect().width > 0).length,
    );
  await expect.poll(lentiVisibili, { timeout: 20_000 }).toBe(0);

  /* Il tasto della carta e' proprio sparito dal documento, non solo nascosto:
   * era un doppione di quello che fa la guardia. */
  expect(await page.evaluate(() => document.querySelectorAll(".dm-lav-slot-btn").length)).toBe(0);
});

test("dalla riga si sceglie davvero, e la scelta si salva", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const carta = await apriLaModificaDellaLavatrice(page, testInfo);
  await expect
    .poll(
      () => page.evaluate(() => document.querySelectorAll(".dm-lav-slot > .dm-slot-chip").length),
      { timeout: 20_000 },
    )
    .toBe(8);

  /* Il tocco sulla riga apre il selettore del guscio, con IL CAMPO di questa
   * carta: col nome dello slot scriverebbe nella riga gemella delle Sezioni. */
  await page.evaluate(() => {
    window.__DM_SCELTO__ = "";
    const originale = window.wzPickEntity;
    window.wzPickEntity = function (bersaglio, ...resto) {
      window.__DM_SCELTO__ = bersaglio?.dataset?.ref || String(bersaglio);
      return originale?.apply(this, [bersaglio, ...resto]);
    };
  });
  await carta
    .locator('.dm-lav-slot:has(.dm-lav-slot-in[data-ref="dm.lavatrice_programma"]) > .dm-slot-chip')
    .click();
  await expect.poll(() => page.evaluate(() => window.__DM_SCELTO__)).toBe("dm.lavatrice_programma");

  /* E quello che entra nel campo si salva: e' il giro completo. */
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

  /* La riga adesso dice cosa c'e' dentro, invece di «Scegli entità». */
  await expect(
    carta.locator(
      '.dm-lav-slot:has(.dm-lav-slot-in[data-ref="dm.lavatrice_programma"]) > .dm-slot-chip',
    ),
  ).toContainText("select.lavatrice_programma");
});
