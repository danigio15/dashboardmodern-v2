/* La barra si lascia trovare col mouse.
 *
 * Sul computer la barra sta a riposo fuori dallo schermo: e' un dock, compare
 * quando ci si avvicina. Misurata su una finestra alta 900, pero', cominciava a
 * 908, e l'unica zona sensibile era la striscia di quattordici pixel che il suo
 * bordo invisibile sporgeva in alto. Da un browser ci si arrivava per un pelo;
 * dall'app di Home Assistant sul Mac, dove il fondo della finestra e'
 * occupato, non ci si arrivava affatto — segnalato da Gio Cor: da web
 * funzionava, da app no, mentre su iPhone e iPad, che non hanno il mouse, la
 * barra e' sempre in vista.
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
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

test("il dock esce anche senza inseguire l'ultimo pixel", async ({ page, viewport }, testInfo) => {
  test.setTimeout(90_000);
  test.skip(
    (viewport?.width ?? 1440) < 769,
    "il dock che si nasconde e' del computer: dove si tocca la barra resta in vista",
  );
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);

  const barra = page.locator("nav.tabs.bottom-nav-bar");
  await expect(barra).toHaveCount(1);

  const altezza = page.viewportSize()?.height ?? 900;
  const larghezza = page.viewportSize()?.width ?? 1440;

  // A riposo il dock e' ritirato: e' voluto.
  await expect.poll(() => barra.evaluate((nodo) => getComputedStyle(nodo).opacity)).toBe("0");

  /* Il mouse si ferma ventiquattro pixel sopra il bordo, che e' quanto basta a
   * mancare la striscia di prima: e' la condizione in cui si trovava chi apriva
   * la plancia dall'app del Mac. */
  await page.mouse.move(Math.round(larghezza / 2), altezza - 24);

  await expect
    .poll(
      () =>
        barra.evaluate((nodo) => {
          const riquadro = nodo.getBoundingClientRect();
          return {
            opacita: getComputedStyle(nodo).opacity,
            dentro: riquadro.top < window.innerHeight,
          };
        }),
      { message: "il dock esce quando il mouse si avvicina al fondo", timeout: 10_000 },
    )
    .toEqual({ opacita: "1", dentro: true });
});
