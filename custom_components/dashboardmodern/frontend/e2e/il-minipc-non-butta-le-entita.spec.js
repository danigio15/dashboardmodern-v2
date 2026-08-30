/* Aggiungere una voce al MiniPC non butta le entita' gia' scritte.
 *
 * «Se ho inserito entita' e poi clicco su Aggiungi su una nuova voce dal
 * menu a tendina mi elimina tutte le entita' inserite»: il ridisegno della
 * lista ripartiva dai valori catturati alla costruzione del pannello, e
 * tutto cio' che era digitato ma non ancora salvato spariva — con
 * l'Aggiungi come col cestino. Questa prova digita, aggiunge, toglie, e
 * pretende che il testo resti.
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

test("aggiungi e cestino non svuotano i campi digitati", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("sez6");
  });
  const pannello = page.locator("[data-server-compact]");
  await expect(pannello).toBeVisible({ timeout: 20000 });

  const aggiungi = async (ref) => {
    await pannello.locator("[data-slot-select]").selectOption(ref);
    await pannello.locator("[data-add]").click();
  };

  await aggiungi("dm.server_cpu");
  const rigaCpu = pannello.locator('[data-ref="dm.server_cpu"]');
  await expect(rigaCpu).toBeVisible();
  /* Il campo entita' diventa una riga-chip (il testo vive dietro la matita):
   * si scrive come scrive il salvataggio, sull'input, con i suoi eventi. */
  const scrivi = (ref, valore) =>
    page.evaluate(
      ([r, v]) => {
        const input = document.querySelector(`[data-ref="${r}"] [data-server-value]`);
        input.value = v;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      },
      [ref, valore],
    );
  await scrivi("dm.server_cpu", "sensor.cpu_percento");

  // La seconda voce non deve portarsi via quello che c'e' scritto nella prima.
  await aggiungi("dm.server_ram");
  await expect(pannello.locator('[data-ref="dm.server_ram"]')).toBeVisible();
  await expect(rigaCpu.locator("[data-server-value]")).toHaveValue("sensor.cpu_percento");

  // E nemmeno il cestino di un'altra riga.
  await pannello.locator('[data-ref="dm.server_ram"] [data-remove]').click();
  await expect(rigaCpu.locator("[data-server-value]")).toHaveValue("sensor.cpu_percento");

  /* «Dopo aver fatto salva e inserito le entita' la sezione non passa
   * automaticamente in visibile»: col salvataggio la sezione configurata si
   * accende da sola — in cd_sections e nella barra. */
  /* Il tasto del pannello viene sostituito dal salvatore canonico della
   * scheda («Salva sezione»): si preme quello, come fa il dito. */
  await page.locator("#ed-body .ed-save-btn:visible, #ed-body [data-save]:visible").last().click();
  /* La verita' della visibilita' e' cdCfg (store canonico + localStorage),
   * non il localStorage nudo: il repair non riscrive cio' che e' gia' vero. */
  await expect
    .poll(() => page.evaluate(() => (window.cdCfg?.("cd_sections") || {}).server ?? null), {
      timeout: 10000,
    })
    .toBe(true);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const tab = document.querySelector('.tab[data-tab="server"]');
          return tab ? getComputedStyle(tab).display !== "none" : null;
        }),
      { timeout: 10000 },
    )
    .toBe(true);
});

test("il salva batte il veto manuale della sola sezione salvata", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  /* La storia del campo: la sezione era stata nascosta a mano, e da allora
   * la riparazione la saltava per sempre — anche col MiniPC appena
   * configurato e salvato. */
  await page.evaluate(() => {
    const sezioni = JSON.parse(localStorage.getItem("cd_sections") || "{}");
    sezioni.server = false;
    localStorage.setItem("cd_sections", JSON.stringify(sezioni));
    localStorage.setItem("cd_sections_manual", JSON.stringify({ server: true, clima: true }));
    window.apriConfigEntita();
    window.editorSwitch("sez6");
  });
  const pannello = page.locator("[data-server-compact]");
  await expect(pannello).toBeVisible({ timeout: 20000 });
  await pannello.locator("[data-slot-select]").selectOption("dm.server_cpu");
  await pannello.locator("[data-add]").click();
  await page.evaluate(() => {
    const input = document.querySelector('[data-ref="dm.server_cpu"] [data-server-value]');
    input.value = "sensor.cpu_percento";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.locator("#ed-body .ed-save-btn:visible, #ed-body [data-save]:visible").last().click();
  await expect
    .poll(() => page.evaluate(() => (window.cdCfg?.("cd_sections") || {}).server ?? null), {
      timeout: 10000,
    })
    .toBe(true);
  /* Le ALTRE scelte manuali restano sacre: il clima spento a mano resta com'e'. */
  const clima = await page.evaluate(
    () => JSON.parse(localStorage.getItem("cd_sections") || "{}").clima,
  );
  expect(clima).not.toBe(true);
});
