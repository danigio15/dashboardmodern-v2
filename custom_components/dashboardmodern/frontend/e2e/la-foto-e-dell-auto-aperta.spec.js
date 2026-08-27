/* La foto e' dell'auto che si sta configurando.
 *
 * «Ancora problemi con foto auto»: con due vetture, la matita apriva la Zoe
 * ma il pannello delle foto continuava a parlare con la Tesla — quella IN
 * USO. Si caricava la foto della Zoe e finiva addosso all'altra, e in
 * plancia compariva una macchina che nessuno aveva scelto. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
  schema_version: 4,
  sections: { rooms: [], lights: [], appliances: [], loads: [], covers: [], ev: [] },
  visibility: { home: true, ev: true },
};

async function boot(page, testInfo) {
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await page.route("**/local/**", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: "<svg xmlns='http://www.w3.org/2000/svg' width='8' height='4'/>",
    }),
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_ev_cars",
      JSON.stringify([
        { name: "Tesla", uid: "car-a", img: "/local/tesla.png", entities: {} },
        { name: "Zoe", uid: "car-b", entities: {} },
      ]),
    );
    localStorage.setItem("cd_ev_car_active", "0");
    localStorage.setItem("cd_ev_image", JSON.stringify("/local/tesla.png"));
    window.apriConfigEntita();
    window.editorSwitch("sez2");
  });
  await page.waitForTimeout(600);
}

test("la matita apre un'auto: la sua foto e' sua, e il disegno resta dell'auto in uso", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);

  // La matita sulla seconda auto — quella che NON e' in uso.
  await page.evaluate(() => {
    const riga = [...document.querySelectorAll("#ed-body .ed-row")].find((r) =>
      /Zoe/.test(r.textContent || ""),
    );
    [...riga.querySelectorAll("button")].find((b) => /✏️/.test(b.textContent || ""))?.click();
  });
  await page.waitForTimeout(500);

  // Il pannello dichiara la Zoe, non la Tesla.
  await expect(page.locator("[data-ev-photos-title]")).toContainText("Zoe");
  await expect(page.locator('[data-ev-photo="idle"] input')).toHaveValue("");

  await page.evaluate(() => {
    const campo = document.querySelector('[data-ev-photo="idle"] input');
    campo.value = "/local/zoe.png";
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector("[data-ev-photos-save]").click();
  });
  await page.waitForTimeout(400);

  const esito = await page.evaluate(() => ({
    auto: JSON.parse(localStorage.getItem("cd_ev_cars") || "[]").map((c) => ({
      n: c.name,
      img: c.img,
    })),
    disegno: JSON.parse(localStorage.getItem("cd_ev_image") || '""'),
    attiva: localStorage.getItem("cd_ev_car_active"),
  }));
  // La foto sta sulla Zoe; la Tesla tiene la sua; il disegno resta quello
  // dell'auto in uso, che nessuno ha cambiato.
  expect(esito.auto).toEqual([
    { n: "Tesla", img: "/local/tesla.png" },
    { n: "Zoe", img: "/local/zoe.png" },
  ]);
  expect(esito.disegno).toBe("/local/tesla.png");
  expect(esito.attiva).toBe("0");
});

test("la foto non tremola: il disegno la rimette identica a ogni giro", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await page.evaluate(() => {
    // due foto per l'auto in uso: scollegata e collegata, blindate
    localStorage.setItem(
      "cd_ev_cars",
      JSON.stringify([
        {
          name: "Tesla",
          uid: "car-a",
          img: "/local/tesla.png",
          imgPlugged: "/local/tesla-p.png",
          ov: {},
          entities: {},
        },
        { name: "Zoe", uid: "car-b", img: "/local/zoe.png", ov: {}, entities: {} },
      ]),
    );
    localStorage.setItem("cd_ev_car_active", "0");
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    document.getElementById("page-ev")?.classList.add("active");
    window.__SRC = new Set();
    for (let giro = 0; giro < 6; giro += 1) window.render?.();
  });
  await page.waitForTimeout(1200);
  const esito = await page.evaluate(() => {
    const img = document.getElementById("ev-mod-car-img");
    const viste = new Set();
    for (let giro = 0; giro < 6; giro += 1) {
      window.render?.();
      viste.add((img?.getAttribute("src") || "").split("/").pop());
    }
    return {
      viste: [...viste],
      auto: JSON.parse(localStorage.getItem("cd_ev_cars") || "[]").map((c) => ({
        i: c.img,
        p: c.imgPlugged,
      })),
    };
  });
  // Una sola foto su sei giri: nessuna alternanza.
  expect(esito.viste).toHaveLength(1);
  // E le coppie restano quelle configurate, su tutte e due le auto.
  expect(esito.auto).toEqual([
    { i: "/local/tesla.png", p: "/local/tesla-p.png" },
    { i: "/local/zoe.png", p: undefined },
  ]);
});
