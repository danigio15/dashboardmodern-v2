/* Two cars, two pairs of photos — issue #162.
 *
 * A car profile carries that car's entity map and, from the runtime, one
 * picture. The second photo is the overlay's, and was never in the profile, so
 * the two cars shared it; and a profile saved before its picture was chosen
 * carried an empty one, which picking that car wrote over the photo the other
 * car had just set. Configure two cars and both pictures left the dashboard,
 * while the editor — reading its own field — still previewed them.
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
  visibility: { ev: true },
};
test("two cars keep their own photos", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.waitForFunction(() => Boolean(window.cdEvCaptureProfile?.__dmEvSection), null, {
    timeout: 15000,
  });
  const result = await page.evaluate(() => {
    const read = (k) => {
      try {
        return JSON.parse(localStorage.getItem(k) || '""');
      } catch (e) {
        return localStorage.getItem(k) || "";
      }
    };
    // Car A: both photos set, saved as a profile.
    localStorage.setItem("cd_ev_image", JSON.stringify("/local/a-idle.png"));
    localStorage.setItem("cd_ev_image_plugged", JSON.stringify("/local/a-plug.png"));
    const a = window.cdEvCaptureProfile();
    // Car B: its own photos, saved as a second profile.
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
    window.cdEvApplyCar(0);
    const afterA = { idle: read("cd_ev_image"), plugged: read("cd_ev_image_plugged") };
    window.cdEvApplyCar(1);
    const afterB = { idle: read("cd_ev_image"), plugged: read("cd_ev_image_plugged") };
    // A profile with no picture of its own must not blank what is showing.
    localStorage.setItem(
      "cd_ev_cars",
      JSON.stringify([
        { name: "A", ...a },
        { name: "Blank", ov: {}, img: "" },
      ]),
    );
    window.cdEvApplyCar(0);
    window.cdEvApplyCar(1);
    const afterBlank = { idle: read("cd_ev_image"), plugged: read("cd_ev_image_plugged") };
    return { captured: { a, b }, afterA, afterB, afterBlank };
  });
  expect(result.captured.a).toMatchObject({
    img: "/local/a-idle.png",
    imgPlugged: "/local/a-plug.png",
  });
  expect(result.captured.b).toMatchObject({
    img: "/local/b-idle.png",
    imgPlugged: "/local/b-plug.png",
  });
  expect(result.afterA).toEqual({ idle: "/local/a-idle.png", plugged: "/local/a-plug.png" });
  expect(result.afterB).toEqual({ idle: "/local/b-idle.png", plugged: "/local/b-plug.png" });
  expect(result.afterBlank).toEqual({ idle: "/local/a-idle.png", plugged: "/local/a-plug.png" });
});

/* La foto resta quella scritta.
 *
 * Il disegno risolveva il percorso della foto attiva e lo riscriveva nella
 * configurazione, scegliendo la chiave in base al cavo: con la sola foto "col
 * cavo" impostata e il cavo staccato la riscriveva in quella "senza cavo", e
 * da li' le due diventavano la stessa da sole.
 */
test("il disegno non riscrive le foto configurate", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.waitForFunction(() => Boolean(window.cdEvCaptureProfile?.__dmEvSection), null, {
    timeout: 15000,
  });
  const before = await page.evaluate(() => {
    localStorage.setItem("cd_ev_image", JSON.stringify(""));
    localStorage.setItem("cd_ev_image_plugged", JSON.stringify("/solo-col-cavo.png"));
    return {
      idle: localStorage.getItem("cd_ev_image"),
      plugged: localStorage.getItem("cd_ev_image_plugged"),
    };
  });
  // Il disegno gira sulle passate che seguono gli eventi del runtime: qui se ne
  // chiedono parecchie, dalla stessa porta da cui arrivano davvero.
  for (let pass = 0; pass < 8; pass += 1) {
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("dashboardmodern:state-changed", {
          detail: { entity_id: "dm.ev_stato_ricarica" },
        }),
      );
      window.dispatchEvent(new Event("pageshow"));
    });
    await page.waitForTimeout(180);
  }
  await page.waitForTimeout(2000);
  // Se la passata non fosse mai girata questa prova non proverebbe niente.
  expect(
    await page.evaluate(() => Boolean(document.getElementById("lm-hero-card")?.dataset.evImage)),
    "la passata che disegna la foto e' girata",
  ).toBe(true);
  const after = await page.evaluate(() => ({
    idle: localStorage.getItem("cd_ev_image"),
    plugged: localStorage.getItem("cd_ev_image_plugged"),
  }));
  expect(after, "la configurazione e' quella che l'utente ha scritto").toEqual(before);
});
