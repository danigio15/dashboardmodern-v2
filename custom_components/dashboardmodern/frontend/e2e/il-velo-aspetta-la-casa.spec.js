/* Il velo si toglie quando la casa ha risposto, non prima.
 *
 * Dal filmato, cronometrato: la plancia in scena all'8,9 e la casa vera
 * all'11,1. Due secondi e due decimi di una casa che non e' quella di chi
 * guarda — zeri, «Caricamento...», sei tessere invece di tredici — e in cima
 * la riga che diceva «tutto tranquillo» mentre le Aperture chiedevano
 * attenzione. Poi tutto si rimpaginava sotto gli occhi.
 *
 * Il velo sapeva gia' aspettare due cose — che i moduli avessero dipinto e che
 * i fogli fossero arrivati — cioe' che la plancia fosse pronta a disegnare. Non
 * aspettava pero' che ci fosse qualcosa da disegnare: la casa poteva ancora non
 * aver risposto, e si vedeva.
 *
 * Qui si sorveglia la regola, non il cronometro: con una casa configurata il
 * velo resta finche' la prima risposta agli stati non arriva, e se ne va quando
 * arriva. E la rete c'e' gia' — la stessa scadenza che copre moduli e fogli —
 * quindi una casa che non risponde non tiene il velo per sempre, e ad aprirlo
 * non dev'essere il guardiano del guscio con l'errore rosso.
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

const velo = (page) =>
  page.evaluate(() => {
    const o = document.getElementById("cd-boot-overlay");
    if (!o) return "andato";
    return o.style.opacity === "0" ? "in uscita" : "in scena";
  });

/* Il filo non deve rispondere da solo: cosi' l'unico modo in cui il velo puo'
 * andarsene e' quello che la prova decide. Si tiene da parte la consegna degli
 * stati per farla scattare a comando. */
const filoMuto = (page) =>
  page.addInitScript(() => {
    globalThis.__DM_STATI__ = null;
    const Vero = globalThis.WebSocket;
    function Muta(url) {
      const s = new Vero(url);
      globalThis.__DM_STATI__ = (elenco) => {
        try {
          s.onmessage?.({ data: JSON.stringify({ id: 7, type: "result", result: elenco }) });
        } catch (_e) {}
      };
      return s;
    }
    Muta.prototype = Vero.prototype;
    Object.assign(Muta, Vero);
    globalThis.WebSocket = Muta;
  });

test.setTimeout(90_000);

test("il velo resta finche' la casa non ha risposto, e poi se ne va", async ({
  page,
}, testInfo) => {
  await filoMuto(page);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => typeof globalThis.cdHideBoot === "function", null, {
    timeout: 60_000,
  });
  /* Il controllo degli aggiornamenti ha finito il suo giro: da qui in poi il
   * velo dipende solo da quello che la plancia sta aspettando. */
  await page.evaluate(() => globalThis.cdHideBoot());
  await page.waitForTimeout(700);

  expect(await velo(page), "senza risposta dalla casa il velo resta").toBe("in scena");

  await page.evaluate(() =>
    globalThis.__DM_STATI__?.([{ entity_id: "sensor.prova", state: "1", attributes: {} }]),
  );
  await expect.poll(() => velo(page), { timeout: 10_000 }).not.toBe("in scena");
});

test("una casa che non risponde non tiene il velo per sempre", async ({ page }, testInfo) => {
  await filoMuto(page);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => typeof globalThis.cdHideBoot === "function", null, {
    timeout: 60_000,
  });
  await page.evaluate(() => globalThis.cdHideBoot());
  /* La scadenza e' a otto secondi, e il guardiano del guscio si arrende a
   * dieci: qui si aspetta abbastanza da vedere la prima e non il secondo. */
  await expect.poll(() => velo(page), { timeout: 12_000 }).not.toBe("in scena");
  const stato = await page.evaluate(
    () => document.getElementById("cd-boot-overlay")?.dataset?.state || "",
  );
  expect(stato, "e ad aprirlo non dev'essere il guardiano, con l'errore").not.toBe("error");
});
