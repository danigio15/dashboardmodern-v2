/* «Cambio auto, si vede giusta, e poi ricambia.»
 *
 * Le due caselle da cui il disegno legge la foto — quella senza cavo e quella
 * col cavo — devono dire quello che dice l'auto scelta, e continuare a dirlo.
 * La prova che c'era guardava i valori subito dopo il cambio, sincrona: il
 * difetto segnalato pero' arriva *dopo*, quando qualche altra passata ci
 * ripassa sopra. Qui si guarda anche dopo l'attesa.
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
  visibility: { home: true, ev: true },
};

async function preparaDueAuto(page) {
  return page.evaluate(() => {
    localStorage.setItem("cd_ev_image", JSON.stringify("/local/a-idle.png"));
    localStorage.setItem("cd_ev_image_plugged", JSON.stringify("/local/a-plug.png"));
    const a = window.cdEvCaptureProfile();
    localStorage.setItem("cd_ev_image", JSON.stringify("/local/b-idle.png"));
    localStorage.setItem("cd_ev_image_plugged", JSON.stringify("/local/b-plug.png"));
    const b = window.cdEvCaptureProfile();
    localStorage.setItem(
      "cd_ev_cars",
      JSON.stringify([
        { name: "A", ...a },
        { name: "B", ...b },
      ]),
    );
    return { a, b };
  });
}

const foto = (page) =>
  page.evaluate(() => {
    const read = (k) => {
      try {
        return JSON.parse(localStorage.getItem(k) || '""');
      } catch (e) {
        return localStorage.getItem(k) || "";
      }
    };
    return { idle: read("cd_ev_image"), plugged: read("cd_ev_image_plugged") };
  });

async function scegli(page, indice) {
  await page.evaluate((i) => window.cdEvApplyCar(i), indice);
  // Il tempo in cui la plancia fa le sue passate: e' li' che si vedeva ricambiare.
  await page.waitForTimeout(1500);
}

test("le due foto seguono l'auto scelta, e ci restano", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  /* Si aspetta che la plancia abbia messo mano ai giri del runtime: prima di
   * quel momento nessun utente puo' aver toccato niente, perche' la pagina non
   * ha ancora disegnato. */
  await page.waitForFunction(() => Boolean(window.cdEvApplyCar?.__dmEvSection), null, {
    timeout: 30_000,
  });
  const { a, b } = await preparaDueAuto(page);
  expect(a, "il profilo deve portarsi dietro tutte e due le foto").toMatchObject({
    img: "/local/a-idle.png",
    imgPlugged: "/local/a-plug.png",
  });
  expect(b).toMatchObject({ img: "/local/b-idle.png", imgPlugged: "/local/b-plug.png" });

  await scegli(page, 1);
  expect(await foto(page), "scelta la B").toEqual({
    idle: "/local/b-idle.png",
    plugged: "/local/b-plug.png",
  });

  await scegli(page, 0);
  expect(await foto(page), "tornati sulla A").toEqual({
    idle: "/local/a-idle.png",
    plugged: "/local/a-plug.png",
  });

  await scegli(page, 1);
  expect(await foto(page), "e di nuovo sulla B").toEqual({
    idle: "/local/b-idle.png",
    plugged: "/local/b-plug.png",
  });
});
