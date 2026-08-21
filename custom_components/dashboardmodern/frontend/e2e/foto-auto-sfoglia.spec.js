import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* La foto dell'auto si sceglie, non si scrive.
 *
 * Il campo chiedeva un percorso come "/local/auto.png": bisognava sapere che
 * /config/www si chiama /local, come si chiama il file e come si scrive. Il
 * tasto 📁 apre le cartelle che Home Assistant gia' elenca, e la foto scelta
 * viene copiata nel suo archivio immagini — che la serve a un indirizzo che
 * non scade, al contrario di quello firmato con cui si legge il file. */
const seed = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [{ id: "ev-uno", name: "Prima", brand: "Leapmotor", icon: "mdi:car-electric" }],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, ev: true },
};

/* Un Home Assistant finto che risponde come quello vero: la radice ha una
 * cartella, la cartella ha una foto, e la foto si risolve in un indirizzo
 * firmato. */
async function fingiHomeAssistant(page) {
  await page.addInitScript(() => {
    const cartelle = {
      "": {
        media_content_id: "media-source://media_source",
        title: "Media",
        children: [
          {
            media_content_id: "media-source://media_source/local/auto",
            title: "Auto",
            can_expand: true,
          },
          {
            media_content_id: "media-source://media_source/local/nota.txt",
            title: "nota.txt",
            media_class: "document",
          },
        ],
      },
      "media-source://media_source/local/auto": {
        media_content_id: "media-source://media_source/local/auto",
        title: "Auto",
        children: [
          {
            media_content_id: "media-source://media_source/local/auto/mia.png",
            title: "mia.png",
            media_class: "image",
            can_play: true,
          },
        ],
      },
    };
    class PresaFinta extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      constructor() {
        super();
        queueMicrotask(() => {
          this.dispatchEvent(new Event("open"));
          this.onopen?.();
          this.manda({ type: "auth_required", ha_version: "test" });
        });
      }
      manda(valore) {
        const evento = new MessageEvent("message", { data: JSON.stringify(valore) });
        this.dispatchEvent(evento);
        this.onmessage?.(evento);
      }
      send(payload) {
        const messaggio = JSON.parse(payload);
        if (messaggio.type === "auth") return this.manda({ type: "auth_ok", ha_version: "test" });
        if (messaggio.type === "media_source/browse_media")
          return this.manda({
            id: messaggio.id,
            type: "result",
            success: true,
            result: cartelle[messaggio.media_content_id || ""],
          });
        if (messaggio.type === "media_source/resolve_media")
          return this.manda({
            id: messaggio.id,
            type: "result",
            success: true,
            result: { url: "/media/local/auto/mia.png?authSig=finta", mime_type: "image/png" },
          });
        return this.manda({ id: messaggio.id, type: "result", success: true, result: [] });
      }
      close() {}
    }
    window.WebSocket = PresaFinta;
  });
}

/* Il pezzo che non si puo' provare a vuoto: il file firmato e il caricamento
 * nell'archivio immagini sono due chiamate HTTP a Home Assistant. */
async function fingiArchivioImmagini(page) {
  await page.route("**/media/local/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from([137, 80, 78, 71]) }),
  );
  await page.route("**/api/image/upload", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "abc123", content_type: "image/png" }),
    }),
  );
  await page.route("**/api/image/serve/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from([137, 80, 78, 71]) }),
  );
}

test.describe("foto dell'auto", () => {
  test("si sfogliano le cartelle di Home Assistant e la foto resta buona", async ({
    page,
  }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await fingiArchivioImmagini(page);
    await fingiHomeAssistant(page);
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
    await page.evaluate(() => {
      window.apriConfigEntita();
      window.editorSwitch("sez2");
    });

    const sfoglia = page.locator('[data-ev-photo="idle"] [data-ev-photo-browse]');
    await expect(sfoglia).toHaveCount(1);
    await sfoglia.scrollIntoViewIfNeeded();
    await sfoglia.click();

    const finestra = page.locator("#dm-media-picker-modal");
    await expect(finestra).toBeVisible();
    // La radice mostra la cartella; il file di testo non e' una foto e non si elenca.
    await expect(finestra.locator('.dm-media-row[data-media-kind="folder"]')).toHaveText(/Auto/);
    await expect(finestra.locator(".dm-media-row")).toHaveCount(1);
    await expect(finestra.locator(".dm-media-skipped")).toBeVisible();

    await finestra.locator('.dm-media-row[data-media-kind="folder"]').click();
    const foto = finestra.locator('.dm-media-row[data-media-kind="image"]');
    await expect(foto).toHaveText(/mia\.png/);
    await foto.click();

    await expect(finestra).toHaveCount(0);
    // In configurazione finisce l'indirizzo stabile dell'archivio, non quello
    // firmato che sarebbe scaduto da solo.
    await expect
      .poll(() =>
        page.evaluate(
          () => document.querySelector('[data-ev-photo="idle"] [data-ev-photo-input]')?.value || "",
        ),
      )
      .toBe("/api/image/serve/abc123/original");
    // E la foto e' quella che la plancia mostra davvero.
    await expect
      .poll(() =>
        page.evaluate(() => document.getElementById("ev-mod-car-img")?.getAttribute("src") || ""),
      )
      .toBe("/api/image/serve/abc123/original");
  });

  /* Quando Home Assistant non risponde la finestra lo dice e si chiude senza
   * toccare niente: un percorso gia' scritto a mano non si perde per aver
   * provato a sfogliare. */
  test("senza Home Assistant lo dice, e il percorso scritto resta", async ({ page }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
    await page.evaluate(() => {
      window.apriConfigEntita();
      window.editorSwitch("sez2");
    });
    const campo = page.locator('[data-ev-photo="idle"] [data-ev-photo-input]');
    await expect(campo).toHaveCount(1);
    await campo.fill("/local/scritta-a-mano.png");

    await page.locator('[data-ev-photo="idle"] [data-ev-photo-browse]').click();
    const finestra = page.locator("#dm-media-picker-modal");
    await expect(finestra.locator('[data-status][data-kind="error"]')).not.toBeEmpty();
    await finestra.locator("[data-cancel]").click();
    await expect(finestra).toHaveCount(0);
    await page.waitForTimeout(1500);
    for (let i = 0; i < 8; i += 1) {
      const stato = await page.evaluate(() => ({
        pannelli: document.querySelectorAll("[data-ev-photos]").length,
        accBody: document.querySelectorAll("#ed-body .ed-acc-body").length,
        evSlot: document.querySelectorAll('#ed-body .ed-slot-in[data-ref^="dm.ev_"]').length,
        img: document.getElementById("ev-mod-car-img")?.getAttribute("src") || null,
      }));
      console.log("TICK", i, JSON.stringify(stato));
      await page.waitForTimeout(800);
    }
    console.log(
      "DBG",
      JSON.stringify(
        await page.evaluate(() => ({
          input:
            document.querySelector('[data-ev-photo="idle"] [data-ev-photo-input]')?.value ?? null,
          pannelli: document.querySelectorAll("[data-ev-photos]").length,
          tab: document.querySelector(".ed-tab.active")?.dataset?.tab,
          storage: Object.fromEntries(
            Object.keys(localStorage)
              .filter((k) => k.includes("ev_image") || k.includes("ev_cars"))
              .map((k) => [k, localStorage.getItem(k)]),
          ),
        })),
      ),
    );
    await expect(campo).toHaveValue("/local/scritta-a-mano.png");
  });
});
