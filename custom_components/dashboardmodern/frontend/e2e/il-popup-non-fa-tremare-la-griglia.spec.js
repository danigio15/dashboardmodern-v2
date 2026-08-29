/* Aprire un popup non rifa' la griglia dei widget.
 *
 * «In ogni popup che premo dei widget trema tutto»: nel video si vede la Home
 * svuotarsi — resta una card bianca sola — e ridisegnarsi mentre la finestra
 * sale. La causa era la firma della struttura, che contava anche QUALE tessera
 * fosse aperta: un resto dell'epoca in cui il dettaglio era una tendina dentro
 * la griglia. Aprire o chiudere cambiava la firma, e la firma ributtava giu'
 * tutte le tessere con `innerHTML`, due volte per popup.
 *
 * La prova marca i nodi delle tessere prima del tocco e pretende di ritrovare
 * GLI STESSI nodi — non copie appena stampate — a finestra aperta e dopo la
 * chiusura. E l'evidenza della tessera aperta deve muoversi lo stesso: e' un
 * valore che si scrive addosso alla tessera, non una ragione per rifarla.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-salone", name: "Salone", icon: "mdi:sofa", order: 0 }],
    cameras: [],
    appliances: [],
    loads: [],
    climate: [],
    ev: [],
    covers: [],
    lights: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
  },
  visibility: { home: true, prese: true },
};

test("le tessere restano gli stessi nodi quando il popup si apre e si chiude", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    for (const [id, stato] of [
      ["switch.tv_salotto", "on"],
      ["switch.firestick", "off"],
    ])
      stati[id] = { entity_id: id, state: stato, attributes: { friendly_name: id } };
    localStorage.setItem(
      "cd_prese",
      JSON.stringify([
        { name: "TV Salotto", entity: "switch.tv_salotto", room_id: "room-salone" },
        { name: "Firestick", entity: "switch.firestick" },
      ]),
    );
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.waitForTimeout(1600);

  const tessera = page.locator('#dm-widgets .dm-tile[data-dm-widget="prese"]');
  await expect(tessera).toBeVisible();

  /* Il segno sta sul nodo, non nel documento: un nodo ristampato lo perde. */
  const marca = () =>
    page.evaluate(() => {
      const tessere = [...document.querySelectorAll("#dm-widgets .dm-tile")];
      tessere.forEach((nodo) => {
        nodo.__dmStessaTessera = true;
      });
      return tessere.length;
    });
  const marcate = () =>
    page.evaluate(() => {
      const tessere = [...document.querySelectorAll("#dm-widgets .dm-tile")];
      return {
        quante: tessere.length,
        stesse: tessere.filter((nodo) => nodo.__dmStessaTessera === true).length,
      };
    });

  const prima = await marca();
  expect(prima).toBeGreaterThan(0);

  await tessera.click();
  await page.waitForTimeout(500);
  await expect(page.locator('#dm-widget-popup [data-dm-widget-detail="prese"]')).toBeVisible();
  await expect(tessera).toHaveAttribute("data-open", "true");

  const conAperto = await marcate();
  expect(conAperto.quante).toBe(prima);
  expect(conAperto.stesse).toBe(prima);

  await page.evaluate(() => document.querySelector("[data-dm-widget-close]")?.click());
  await page.waitForTimeout(500);
  await expect(page.locator("#dm-widget-popup")).toBeHidden();
  await expect(tessera).toHaveAttribute("data-open", "false");

  const dopoChiuso = await marcate();
  expect(dopoChiuso.quante).toBe(prima);
  expect(dopoChiuso.stesse).toBe(prima);
});
