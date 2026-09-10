/* La tessera della musica, sulla plancia vera (#460).
 *
 * «Display the track title and artist name on the media player; use the
 * vertical three-dot button in the top right corner to open the pop-up.»
 *
 * Il modello si prova senza browser; qui si pretende quello che si vede: la
 * copertina al posto dell'altoparlante, il titolo sulla riga della didascalia,
 * l'artista sotto, i tre puntini in alto a destra, e la finestra coi comandi
 * che si apre toccando la mattonella.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seme = {
  schema_version: 4,
  sections: {
    rooms: [{ name: "Salotto", icon: "🛋️" }],
    cameras: [],
    appliances: [],
    loads: [],
    climate: [],
    ev: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
    covers: [],
  },
  visibility: { home: true },
};

const LETTORI = [{ id: "mp1", entity: "media_player.sonos", nome: "Salotto" }];

const suonando = {
  "media_player.sonos": {
    state: "playing",
    attributes: {
      friendly_name: "Sonos Salotto",
      media_title: "So What",
      media_artist: "Miles Davis",
      media_album_name: "Kind of Blue",
      entity_picture: "/api/media_player_proxy/media_player.sonos?token=x",
      supported_features: 84421,
      volume_level: 0.3,
    },
  },
};

async function apri(page, testInfo, stati) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  /* La copertina è un indirizzo di Home Assistant: qui non c'è nessun Home
   * Assistant, e senza questa risposta l'immagine resterebbe rotta. */
  await page.route("**/api/media_player_proxy/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/gif",
      body: Buffer.from("R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==", "base64"),
    }),
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.evaluate(
    ({ s, lettori }) => {
      window.__HASS__ = { states: s };
      window.hass = { ...(window.hass || {}), states: s };
      window._RAW_STATES = s;
      window.localStorage.setItem("cd_media_player", JSON.stringify(lettori));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
    },
    { s: stati, lettori: LETTORI },
  );
  const tessera = page.locator('#dm-widgets [data-dm-widget="media"]');
  await expect(tessera).toBeVisible();
  return tessera;
}

test("con un brano solo: copertina, titolo e artista sotto", async ({ page }, testInfo) => {
  const tessera = await apri(page, testInfo, suonando);

  // La copertina sta nella pastiglia, al posto del disegno dell'altoparlante.
  const arte = tessera.locator(".dm-tile-chip .dm-tile-arte");
  await expect(arte).toHaveCount(1);
  await expect(arte).toHaveAttribute("src", /media_player_proxy/);

  // Il titolo sulla riga della didascalia, l'artista sotto: due fatti diversi,
  // due righe diverse.
  await expect(tessera.locator("[data-dm-tile-caption]")).toHaveText("So What");
  const sotto = tessera.locator("[data-dm-tile-sotto]");
  await expect(sotto).toHaveText("Miles Davis");
  /* L'artista segue la didascalia, non fa storia a sé: nella pillola compatta
   * — quella dei telefoni — il fondo della mattonella non c'è affatto, e una
   * riga sola che sopravvivesse là sotto sarebbe una riga fuori posto. */
  const didascalia = tessera.locator("[data-dm-tile-caption]");
  await expect(sotto).toBeVisible({ visible: await didascalia.isVisible() });

  // I tre puntini in alto a destra.
  await expect(tessera.locator(".dm-tile-menu")).toHaveCount(1);

  // Il nome resta: in una Home di venti mattonelle una senza nome non si trova.
  await expect(tessera.locator("[data-dm-tile-label]")).toHaveText(/Musica|Media/);

  // E toccandola si apre la finestra coi comandi veri del lettore.
  await tessera.click();
  const finestra = page.locator("#dm-widget-popup");
  await expect(finestra.locator(".dm-w-media")).toHaveCount(1);
  await expect(finestra.locator("[data-dm-mp]").first()).toBeVisible();
});

test("senza niente in riproduzione la seconda riga sparisce e la pastiglia torna la sua", async ({
  page,
}, testInfo) => {
  const tessera = await apri(page, testInfo, {
    "media_player.sonos": { state: "off", attributes: { friendly_name: "Sonos Salotto" } },
  });
  await expect(tessera.locator(".dm-tile-chip .dm-tile-arte")).toHaveCount(0);
  await expect(tessera.locator("[data-dm-tile-sotto]")).toBeHidden();
  await expect(tessera.locator("[data-dm-tile-caption]")).toHaveText(
    /Nessuno in riproduzione|Nothing playing/,
  );
});

test("il brano che cambia riscrive la tessera senza rifarla", async ({ page }, testInfo) => {
  const tessera = await apri(page, testInfo, suonando);
  await expect(tessera.locator("[data-dm-tile-caption]")).toHaveText("So What");
  /* Il nodo deve restare LO STESSO: rifare la tessera a ogni canzone le
   * farebbe ricominciare l'animazione di apertura mentre uno la guarda. */
  await tessera.evaluate((nodo) => nodo.setAttribute("data-dm-prova", "1"));

  await page.evaluate(() => {
    const stati = window._RAW_STATES;
    stati["media_player.sonos"] = {
      state: "playing",
      attributes: {
        ...stati["media_player.sonos"].attributes,
        media_title: "Blue in Green",
        media_artist: "Bill Evans",
      },
    };
    window.__HASS__ = { states: stati };
    window.hass = { ...(window.hass || {}), states: stati };
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  });

  await expect(tessera.locator("[data-dm-tile-caption]")).toHaveText("Blue in Green");
  await expect(tessera.locator("[data-dm-tile-sotto]")).toHaveText("Bill Evans");
  await expect(tessera).toHaveAttribute("data-dm-prova", "1");
});
