/* «Il lettore che ho messo fra le Azioni rapide mostra solo la copertina di
 * sfondo, il simbolo della cassa in mezzo e il nome dell'apparecchio. Dovrebbe
 * dire il titolo del brano, l'artista, e avere i tre puntini in alto a destra
 * che aprono una finestra con tutti i comandi» (#460, dopo la chiusura).
 *
 * La correzione della 1.4.18 aveva rifatto la tessera della Home. Il tasto
 * delle Azioni rapide lo disegna il guscio, e noi gli posavamo addosso la
 * copertina e nient'altro: li' non era cambiato niente.
 *
 * Questa prova apre la Home con un lettore fra le Azioni rapide e pretende le
 * tre cose, sul tasto vero: il brano, chi lo suona, e che i puntini aprano la
 * finestra coi comandi senza mettere in pausa per strada.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const CASSA = "media_player.salotto";

/* Un Sonos che sa fare quello che sa fare un Sonos: pausa, brano avanti e
 * indietro, volume, muto, sorgente e spegnimento. I numeri sono quelli di
 * Home Assistant — PAUSA 1, VOLUME 4, MUTO 8, PRECEDENTE 16, SUCCESSIVO 32,
 * SPEGNI 256, SORGENTE 2048 — e stanno in `core/media-player.js`. */
const SONOS = 1 | 4 | 8 | 16 | 32 | 256 | 2048;

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
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
  visibility: { home: true },
};

test("il tasto dice il brano, e i puntini aprono i comandi", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60_000,
  });

  const chiamate = [];
  await page.exposeFunction("segnaChiamata", (riga) => chiamate.push(riga));

  await page.evaluate(
    ({ cassa, funzioni }) => {
      const stati = eval("_RAW_STATES");
      stati[cassa] = {
        entity_id: cassa,
        state: "playing",
        attributes: {
          friendly_name: "Sonos Salotto",
          media_title: "So What",
          media_artist: "Miles Davis",
          media_album_name: "Kind of Blue",
          entity_picture: "/api/media_player_proxy/salotto?token=prova",
          volume_level: 0.34,
          is_volume_muted: false,
          supported_features: funzioni,
        },
      };
      window.applyStates?.();
      localStorage.setItem(
        "cd_quick_actions",
        JSON.stringify([{ type: "media", name: "Salotto", entity: cassa }]),
      );
      /* Nessuna casa dall'altra parte: i comandi si annotano invece di
       * partire, cosi' si vede CHE COSA avrebbe fatto il tocco. */
      window.dmCallHaService = (dominio, servizio, dati) => {
        window.segnaChiamata(`${dominio}.${servizio}:${dati?.entity_id || ""}`);
        return Promise.resolve();
      };
      window.buildQuickActions?.();
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { cassa: CASSA, funzioni: SONOS },
  );

  const tasto = page.locator("#qa-grid .qa-btn").first();
  await expect(tasto).toHaveCount(1, { timeout: 20_000 });

  /* 1. Il brano e chi lo suona, sul tasto. */
  await expect(tasto.locator(".dm-qa-media-titolo")).toHaveText("So What", { timeout: 20_000 });
  await expect(tasto.locator(".dm-qa-media-sotto")).toHaveText("Miles Davis · Kind of Blue");

  /* 2. Il simbolo della cassa se ne va: al suo posto c'e' la copertina, che
   *    dice quello che il simbolo non diceva. */
  await expect(tasto.locator(".icon")).toBeHidden();

  /* 3. I puntini aprono la finestra — e non mettono in pausa per strada. */
  const puntini = tasto.locator(".dm-qa-media-menu");
  await expect(puntini).toHaveCount(1);
  await puntini.click();

  const finestra = page.locator("#dm-mp-popup");
  await expect(finestra).toBeVisible({ timeout: 10_000 });
  await expect(finestra.locator(".dm-mp-titolo")).toHaveText("So What");
  await expect(finestra.locator(".dm-mp-sotto")).toHaveText("Miles Davis · Kind of Blue");
  /* Dentro ci sono i comandi veri, non una seconda copia smilza: il tasto
   * centrale, il brano avanti e indietro, il volume, la sorgente. */
  await expect(finestra.locator('[data-dm-mp="centro"]')).toHaveCount(1);
  await expect(finestra.locator('[data-dm-mp="precedente"]')).toHaveCount(1);
  await expect(finestra.locator('[data-dm-mp="successivo"]')).toHaveCount(1);
  await expect(finestra.locator(".dm-mp-slider")).toHaveCount(1);
  expect(chiamate, "i puntini hanno anche messo in pausa").toEqual([]);

  /* 4. E i comandi comandano davvero da qui dentro. */
  await finestra.locator('[data-dm-mp="centro"]').click();
  await expect.poll(() => chiamate).toEqual([`media_player.media_play_pause:${CASSA}`]);

  /* 5. Si chiude toccando fuori, come tutte le altre finestre. */
  await finestra.click({ position: { x: 6, y: 6 } });
  await expect(finestra).toBeHidden();
});
