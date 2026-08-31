/* Il vassoio delle Azioni rapide segue il tema.
 *
 * Dal campo, con lo screenshot: in modalita' scura il ripiano restava un
 * lenzuolo bianco in mezzo alla Home nera, coi tasti scuri sopra. La causa
 * era una variabile fantasma: il fondo leggeva `--bg`, che non esiste da
 * nessuna parte nel tema — la variabile vera e' `--bg-sculpted` — e in dark
 * restava il ripiego chiaro. La prova MISURA la luminanza del fondo nei due
 * temi: scuro col tema scuro, chiaro col chiaro.
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

test("il ripiano delle azioni e' scuro col tema scuro", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_quick_actions",
      JSON.stringify([
        { type: "builtin", builtin: "luci", name: "Luci", icon: "💡" },
        { type: "builtin", builtin: "clima", name: "Clima", icon: "❄️" },
      ]),
    );
    window.buildQuickActions?.();
    document.querySelectorAll(".page").forEach((nodo) => nodo.classList.remove("active"));
    document.getElementById("page-home")?.classList.add("active");
  });
  const vassoio = page.locator("#page-home .dm-vassoio");
  await expect(vassoio).toBeVisible({ timeout: 15000 });

  /* Il primo colore del gradiente, risolto dal motore, nei due temi. */
  const luminanza = (tema) =>
    page.evaluate((scelto) => {
      if (scelto) document.documentElement.setAttribute("data-theme", scelto);
      else document.documentElement.removeAttribute("data-theme");
      const fondo = getComputedStyle(
        document.querySelector("#page-home .dm-vassoio"),
      ).backgroundImage;
      /* Il motore serializza i color-mix come `color(srgb r g b)` coi canali
       * fra 0 e 1; il vecchio rgb() arriva coi canali fino a 255. Si leggono
       * tutti e due. */
      let r = -1;
      let g = -1;
      let b = -1;
      const moderno = fondo.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/);
      const storico = fondo.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
      if (moderno) [r, g, b] = [Number(moderno[1]), Number(moderno[2]), Number(moderno[3])];
      else if (storico)
        [r, g, b] = [Number(storico[1]) / 255, Number(storico[2]) / 255, Number(storico[3]) / 255];
      if (r < 0) return { fondo, luce: -1 };
      return { fondo: fondo.slice(0, 80), luce: 0.2126 * r + 0.7152 * g + 0.0722 * b };
    }, tema);

  const scuro = await luminanza("dark");
  console.log("VASSOIO scuro:", JSON.stringify(scuro));
  expect(scuro.luce, "col tema scuro il ripiano e' scuro, non un lenzuolo bianco").toBeLessThan(
    0.35,
  );

  const chiaro = await luminanza("light");
  console.log("VASSOIO chiaro:", JSON.stringify(chiaro));
  expect(chiaro.luce, "col tema chiaro il ripiano resta chiaro").toBeGreaterThan(0.7);
});
