/* La barra c'e' senza doverla chiamare.
 *
 * Prima partiva a scomparsa dappertutto. Sul computer questo, insieme al fatto
 * che la scelta restava sul dispositivo che l'aveva fatta, chiudeva la porta a
 * chiave: la barra a riposo sta fuori dallo schermo e si chiama avvicinando il
 * mouse al fondo, ma il comando per tenerla ferma sta nella pagina Config, e a
 * quella pagina ci si arriva dalla barra. Chi non riusciva a chiamarla non
 * poteva dirle di restare, e metterla ferma dal telefono non serviva perche'
 * quella preferenza non viaggiava — segnalato da Edoardo Saccozza: sul telefono
 * la vedeva, sul browser del PC in nessun modo.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
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
    irrigazione: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

const barraInVista = (page) =>
  page.evaluate(() => {
    const nodo = document.querySelector("nav.tabs.bottom-nav-bar");
    if (!nodo) return { c: false };
    const riquadro = nodo.getBoundingClientRect();
    return {
      c: true,
      dentro: riquadro.top < window.innerHeight - 1 && riquadro.bottom > 0,
      opacita: getComputedStyle(nodo).opacity,
      classe: document.body.classList.contains("cd-nav-fixed"),
    };
  });

test("appena aperta la barra e' li', senza avvicinare il mouse al fondo", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);

  // Il puntatore sta in alto: non deve essere lui a farla uscire.
  const misura = page.viewportSize() || { width: 1440, height: 900 };
  await page.mouse.move(Math.round(misura.width / 2), 80);

  await expect
    .poll(() => barraInVista(page))
    .toMatchObject({
      c: true,
      dentro: true,
      opacita: "1",
      classe: true,
    });
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("cd_navbar_mode")))
    .toBe("fixed");
});

/* Chi preferisce il dock lo sceglie, e la scelta vale piu' del valore di
 * partenza: non gliela si riscrive addosso al caricamento dopo. */
test("ma chi sceglie il dock se lo tiene", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    const chiave = `cd_${new URLSearchParams(location.search).get("dmi")}_cd_navbar_mode`;
    Storage.prototype.setItem.call(window.localStorage, chiave, "auto");
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);

  await expect.poll(() => page.evaluate(() => localStorage.getItem("cd_navbar_mode"))).toBe("auto");
  await expect
    .poll(() => page.evaluate(() => document.body.classList.contains("cd-nav-fixed")))
    .toBe(false);
});
