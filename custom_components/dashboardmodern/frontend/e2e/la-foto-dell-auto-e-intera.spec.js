/* La foto dell'auto, da desktop, si vede intera e grande.
 *
 * La cornice era una fascia larga quanto lo schermo e alta un numero fisso:
 * dentro una foto sedici a nove ci stava larga cinquecento pixel, in mezzo a
 * novecento di sfocato. Adesso la cornice prende la FORMA della foto, quindi
 * la foto la riempie tutta: niente tagli e niente bande.
 *
 * La prova serve una foto vera, di misure note, cosi' la forma si puo'
 * verificare invece che dichiarare. */
import { deflateSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/** Un PNG pieno di un colore solo, delle misure chieste. */
function pngTinta(larghezza, altezza, colore = [12, 110, 180]) {
  const righe = Buffer.concat(
    Array.from({ length: altezza }, () =>
      Buffer.concat([
        Buffer.from([0]),
        Buffer.from(Array.from({ length: larghezza }, () => colore).flat()),
      ]),
    ),
  );
  const pezzo = (nome, corpo) => {
    const testa = Buffer.concat([Buffer.from(nome, "ascii"), corpo]);
    const lunghezza = Buffer.alloc(4);
    lunghezza.writeUInt32BE(corpo.length);
    const firma = Buffer.alloc(4);
    firma.writeUInt32BE(crc32(testa) >>> 0);
    return Buffer.concat([lunghezza, testa, firma]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(larghezza, 0);
  ihdr.writeUInt32BE(altezza, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pezzo("IHDR", ihdr),
    pezzo("IDAT", deflateSync(righe, { level: 9 })),
    pezzo("IEND", Buffer.alloc(0)),
  ]);
}

const TAVOLA = (() => {
  const tavola = new Int32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let valore = i;
    for (let giro = 0; giro < 8; giro += 1)
      valore = valore & 1 ? 0xedb88320 ^ (valore >>> 1) : valore >>> 1;
    tavola[i] = valore;
  }
  return tavola;
})();

function crc32(buffer) {
  let valore = -1;
  for (const byte of buffer) valore = TAVOLA[(valore ^ byte) & 0xff] ^ (valore >>> 8);
  return valore ^ -1;
}

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [
      {
        name: "Leapmotor B10",
        uid: "b10",
        brand: "Leapmotor",
        model: "B10",
        img: "/prova-hero/larga.png",
        ov: { "dm.ev_batteria_auto": "sensor.batteria" },
      },
    ],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, ev: true },
};

async function apriEv(page, testInfo, foto) {
  await page.route("**/local/prova-hero/*.png", (route) =>
    route.fulfill({ contentType: "image/png", body: foto }),
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page
    .locator('.tab[data-tab="ev"]')
    .first()
    .evaluate((tab) => tab.click());
  // La vetrina si ridisegna sugli eventi del runtime: la pagina esiste adesso.
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} })),
  );
  await expect(page.locator("#page-ev.dm-evv")).toHaveCount(1);
  await expect(page.locator('#page-ev .lm-hero[data-dm-evv-photo="on"]')).toHaveCount(1);
}

/** Cornice e foto, in pixel veri. */
function misure(page) {
  return page.evaluate(() => {
    const cornice = document.querySelector("#page-ev .lm-hero");
    const foto = document.getElementById("ev-mod-car-img");
    const box = cornice.getBoundingClientRect();
    return {
      cornice: { larghezza: box.width, altezza: box.height },
      naturale: { larghezza: foto.naturalWidth, altezza: foto.naturalHeight },
      pagina: document.documentElement.clientWidth,
      alta: window.innerHeight,
    };
  });
}

test.describe("la foto dell'auto", () => {
  test("da desktop la cornice prende la forma della foto", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "la regola vale da 900px in su");
    await apriEv(page, testInfo, pngTinta(1600, 900));
    const { cornice, naturale, pagina, alta } = await misure(page);
    const forma = cornice.larghezza / cornice.altezza;
    expect(forma).toBeCloseTo(naturale.larghezza / naturale.altezza, 1);
    // Grande davvero: non la fascia bassa di prima, e mai piu' larga della pagina.
    expect(cornice.altezza).toBeGreaterThan(300);
    expect(cornice.altezza).toBeLessThanOrEqual(Math.min(alta * 0.52, 440) + 1);
    expect(cornice.larghezza).toBeLessThanOrEqual(pagina);
  });

  test("una foto quadrata non fa della cornice una torre", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "la regola vale da 900px in su");
    await apriEv(page, testInfo, pngTinta(900, 900));
    const { cornice } = await misure(page);
    // Sotto 1,15 non si scende: la foto resta intera, con un filo di margine.
    expect(cornice.larghezza / cornice.altezza).toBeCloseTo(1.15, 1);
  });
});
