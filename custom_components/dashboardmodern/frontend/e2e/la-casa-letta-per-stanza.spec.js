/* La pagina Stanze, sulla plancia vera.
 *
 * Il modello si prova senza browser; qui si prova che la pagina esce, che le
 * pillole cambiano stanza, che dentro ci finiscono le card vere delle sezioni —
 * la luce e' la card della pagina Luci, non una copia — e che la scena della
 * stanza tocca le luci di QUELLA stanza e nessun'altra.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const LUCI = {
  "light.faretti_dx": "Salone - Faretti destra",
  "light.faretti_sx": "Salone - Faretti sinistra",
  "light.lampadario_cucina": "Lampadario Cucina",
  "light.orfana": "Luce senza stanza",
};
const STANZE_LUCI = {
  "light.faretti_dx": "Salone",
  "light.faretti_sx": "Salone",
  "light.lampadario_cucina": "Cucina",
};

const seme = {
  schema_version: 4,
  sections: {
    rooms: [
      { name: "Salone", icon: "🛋️", temp: "sensor.t_salone", hum: "sensor.h_salone" },
      { name: "Cucina", icon: "🍴" },
      { name: "Cameretta", icon: "🛏️" },
    ],
    cameras: [{ name: "Salone", entity: "camera.salone", room: "Salone" }],
    appliances: [{ name: "Lavastoviglie", entity: "sensor.lavastoviglie", room: "Cucina" }],
    loads: [],
    climate: [{ name: "Condizionatore salone", entity: "climate.salone", room: "Salone" }],
    ev: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
    covers: [{ name: "Tapparella salone", entity: "cover.tapp_salone", room: "Salone" }],
    prese: [{ name: "TV Salotto", entity: "switch.tv_salotto", room: "Salone" }],
  },
  visibility: { home: true, stanze: true },
};

const stati = {
  "sensor.t_salone": { state: "29.2", attributes: {} },
  "sensor.h_salone": { state: "56", attributes: {} },
  "light.faretti_dx": { state: "off", attributes: { supported_color_modes: ["brightness"] } },
  "light.faretti_sx": { state: "off", attributes: { supported_color_modes: ["brightness"] } },
  "light.lampadario_cucina": { state: "off", attributes: {} },
  "light.orfana": { state: "off", attributes: {} },
  "climate.salone": { state: "cool", attributes: {} },
  "cover.tapp_salone": { state: "open", attributes: { current_position: 60 } },
  "camera.salone": { state: "idle", attributes: {} },
  "switch.tv_salotto": { state: "on", attributes: {} },
};

async function apri(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.evaluate(
    ({ s, luci, stanze }) => {
      window.__HASS__ = { states: s };
      window.hass = { ...(window.hass || {}), states: s };
      window._RAW_STATES = s;
      window.__DM_CHIAMATE__ = [];
      window.cdCallServiceJson = (domain, service, data) =>
        window.__DM_CHIAMATE__.push({ domain, service, data });
      window.localStorage.setItem("cd_luci", JSON.stringify(luci));
      window.localStorage.setItem("cd_luci_rooms", JSON.stringify(stanze));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
    },
    { s: stati, luci: LUCI, stanze: STANZE_LUCI },
  );
  await page.locator('.tab[data-tab="stanze"]').first().click();
  await expect(page.locator("#page-stanze")).toHaveClass(/active/);
}

test("ogni stanza porta quello che le appartiene, e le sue luci sono le card vere", async ({
  page,
}, testInfo) => {
  await apri(page, testInfo);
  const salone = page.locator('#page-stanze [data-dm-stanza="room-salone"]');
  await expect(salone).toHaveClass(/active/);

  // La luce non e' una card nuova: e' quella della pagina Luci, col suo
  // cursore. E la presa della TV sta qui con la stessa card, senza cursore:
  // «la sezione Prese non viene riportata dentro Stanze».
  await expect(page.locator("#page-stanze .dm-lucip-card")).toHaveCount(3);
  await expect(page.locator("#page-stanze [data-dm-lucip-brightness]")).toHaveCount(2);
  await expect(page.locator("#page-stanze")).toContainText("TV Salotto");
  await expect(page.locator("#page-stanze")).toContainText(/Prese|Plugs/);
  // E il clima parla italiano, non `cool`.
  await expect(page.locator("#page-stanze")).toContainText(/Raffredda|Cooling/);
  await expect(page.locator("#page-stanze")).toContainText("29.2°");

  // Un'altra stanza, un altro contenuto: la cucina ha una luce e un elettrodomestico.
  await page.locator('#page-stanze [data-dm-stanza="room-cucina"]').click();
  await expect(page.locator("#page-stanze .dm-lucip-card")).toHaveCount(1);
  await expect(page.locator("#page-stanze")).toContainText("Lavastoviglie");

  /* La luce che non ha stanza non sparisce: sta sotto la sua pillola, che e'
   * la sola occasione di accorgersi di aver dimenticato un'assegnazione. */
  await page.locator('#page-stanze [data-dm-stanza="dm-senza-stanza"]').click();
  await expect(page.locator("#page-stanze")).toContainText("Luce senza stanza");
});

test("la scena accende le luci di quella stanza, e nessun'altra", async ({ page }, testInfo) => {
  await apri(page, testInfo);
  await expect(page.locator("#page-stanze [data-dm-stanza-scena='on']")).toBeVisible();
  await page.locator("#page-stanze [data-dm-stanza-scena='on']").click();
  const chiamate = await page.evaluate(() => window.__DM_CHIAMATE__);
  const toccate = chiamate.map((chiamata) => chiamata.data?.entity_id).sort();
  assertUguale(toccate, ["light.faretti_dx", "light.faretti_sx"]);
  for (const chiamata of chiamate) expect(chiamata.service).toBe("turn_on");

  function assertUguale(avuto, atteso) {
    expect(avuto).toEqual(atteso);
  }
});

test("una stanza senza luci non offre una scena che non farebbe niente", async ({
  page,
}, testInfo) => {
  await apri(page, testInfo);
  await page.locator('#page-stanze [data-dm-stanza="room-cameretta"]').click();
  await expect(page.locator("#page-stanze [data-dm-stanza-scena]")).toHaveCount(0);
  await expect(page.locator("#page-stanze")).toContainText(/non ha ancora niente|Nothing here yet/);
});

/* La luce si accende da qui, non solo si guarda.
 *
 * La card della luce e' la stessa della pagina Luci — stessa forma, stesso
 * cursore — ma il gesto era rimasto legato a quella pagina: il gestore
 * pretendeva che il tocco venisse da dentro il suo recinto, e qui il recinto
 * non c'e'. Si vedeva l'interruttore, si premeva, e non succedeva niente.
 * Segnalato esattamente cosi'. Il cursore della luminosita' invece ha sempre
 * funzionato, perche' il suo gestore guarda la card: era il recinto a essere
 * di troppo, non la card a essere nel posto sbagliato.
 */
test("l'interruttore della luce comanda anche dalla pagina Stanze", async ({ page }, testInfo) => {
  await apri(page, testInfo);
  const carta = page.locator('#page-stanze [data-dm-lucip="light.faretti_sx"]');
  await expect(carta).toHaveCount(1);
  await carta.locator("[data-dm-lucip-toggle]").click();

  const chiamate = await page.evaluate(() => window.__DM_CHIAMATE__);
  expect(chiamate.length).toBeGreaterThan(0);
  const ultima = chiamate[chiamate.length - 1];
  expect(ultima.data?.entity_id).toBe("light.faretti_sx");
  expect(ultima.service).toBe("turn_on");
});

/* E si comanda anche quello che una stanza si e' presa a mano.
 *
 * Le luci hanno la card vera della pagina Luci, e quella si e' sempre comandata.
 * Tutto il resto — un'entita' assegnata a mano a una stanza, una presa, un
 * ventilatore — era una riga che portava nella sezione e basta: si toccava e
 * non succedeva niente. «Le entita' nelle stanze continuano a non funzionare:
 * non mi dice se dopo clicco la luce e' accesa.» Adesso quello che si accende e
 * si spegne ha il suo interruttore qui, e la riga dice subito com'e' andata.
 */
test("una presa assegnata a mano si accende dalla pagina Stanze", async ({ page }, testInfo) => {
  await apri(page, testInfo);
  await page.evaluate(() => {
    // Il documento aggiunge da solo il prefisso della plancia alle chiavi.
    localStorage.setItem(
      "cd_stanze_entita",
      JSON.stringify({ "switch.presa_salone": "room-salone" }),
    );
    const grezzi = eval("_RAW_STATES");
    grezzi["switch.presa_salone"] = {
      entity_id: "switch.presa_salone",
      state: "off",
      attributes: { friendly_name: "Presa salone" },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.locator('#page-stanze [data-dm-stanza="room-salone"]').click();

  const interruttore = page.locator('#page-stanze [data-dm-stanza-tocca="switch.presa_salone"]');
  await expect(interruttore).toHaveCount(1);
  await expect(interruttore).toHaveAttribute("aria-checked", "false");
  await interruttore.click();

  const chiamate = await page.evaluate(() => window.__DM_CHIAMATE__);
  const ultima = chiamate[chiamate.length - 1];
  expect(ultima.domain).toBe("switch");
  expect(ultima.service).toBe("turn_on");
  expect(ultima.data?.entity_id).toBe("switch.presa_salone");
  await expect(interruttore).toHaveAttribute("aria-checked", "true");
});

/* Lo stesso lettore in due posti (#426).
 *
 * «Dopo l'aggiornamento che ha identificato i vari speaker nelle stanze,
 *  questi vengono duplicati: se si clicca quello sotto la sezione musica si va
 *  nella sezione corretta, se si seleziona quello sotto la voce altro in questa
 *  stanza si torna alla home della dashboard.»
 *
 * Arrivava da due parti — la sua scheda, che la stanza la chiede da quando c'è
 * il blocco Musica, e l'assegnazione a mano, che era il modo di metterlo in
 * stanza prima. Due oggetti diversi, la stessa entità: qui si conta quante
 * righe la nominano sulla pagina, che è quello che si vede.
 */
test("il lettore compare una volta sola, e nel suo blocco", async ({ page }, testInfo) => {
  await apri(page, testInfo);
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_media_player",
      JSON.stringify([
        { id: "mp1", entity: "media_player.sonos", name: "Sonos", room_id: "room-salone" },
      ]),
    );
    /* E la stessa entità assegnata a mano, come chi l'aveva messa in stanza
     * quando il blocco Musica non c'era ancora. */
    localStorage.setItem(
      "cd_stanze_entita",
      JSON.stringify({ "media_player.sonos": "room-salone" }),
    );
    const grezzi = eval("_RAW_STATES");
    grezzi["media_player.sonos"] = {
      entity_id: "media_player.sonos",
      state: "playing",
      attributes: { friendly_name: "Sonos", media_title: "Bohemian Rhapsody" },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.locator('#page-stanze [data-dm-stanza="room-salone"]').click();

  const righe = page.locator('#page-stanze [data-dm-stanza-entita="media_player.sonos"]');
  await expect(righe).toHaveCount(1);
  /* E porta dove si comanda: la pagina Musica, non la Home — che è il modo in
   * cui si vedeva quale delle due righe era quella buona. */
  await expect(righe).toHaveAttribute("data-dm-stanza-vai", "media");
});

/* «The media player card must have media player functions, the climate card
 * must have climate control functions» (#467).
 *
 * La riga della stanza diceva com'è messa una cosa e portava alla sua sezione:
 * per una luce basta — c'è l'interruttore — e per una cassa o un condizionatore
 * no, perché quello che si vuole fare lì è mettere in pausa e alzare di un
 * grado, non leggere. I comandi sono gli stessi della pagina Musica e della
 * finestra del Clima: qui si pretende che ci siano e che funzionino, e che
 * toccarli NON cambi pagina.
 */
test("il lettore e il clima si comandano dalla stanza, senza cambiare pagina", async ({
  page,
}, testInfo) => {
  await apri(page, testInfo);
  await page.evaluate(() => {
    /* I comandi del lettore passano dalla chiamata della plancia, non da
     * quella del guscio: si registra anche quella, o il tasto sembra muto. */
    window.dmCallHaService = (domain, service, data) =>
      window.__DM_CHIAMATE__.push({ domain, service, data });
    localStorage.setItem(
      "cd_media_player",
      JSON.stringify([
        { id: "mp1", entity: "media_player.sonos", name: "Sonos", room_id: "room-salone" },
      ]),
    );
    const grezzi = eval("_RAW_STATES");
    grezzi["media_player.sonos"] = {
      entity_id: "media_player.sonos",
      state: "playing",
      attributes: {
        friendly_name: "Sonos",
        media_title: "Bohemian Rhapsody",
        media_artist: "Queen",
        supported_features: 84421,
      },
    };
    grezzi["climate.salone"] = {
      entity_id: "climate.salone",
      state: "cool",
      attributes: {
        friendly_name: "Condizionatore salone",
        current_temperature: 26,
        temperature: 24,
        hvac_modes: ["off", "cool", "heat"],
        supported_features: 1,
      },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.locator('#page-stanze [data-dm-stanza="room-salone"]').click();

  const lettore = page.locator('#page-stanze [data-dm-stanza-entita="media_player.sonos"]');
  const pausa = lettore.locator('[data-dm-mp="centro"]');
  await expect(pausa).toHaveCount(1);

  await pausa.click();
  /* Il comando parte davvero... */
  await expect
    .poll(
      () => page.evaluate(() => window.__DM_CHIAMATE__.map((c) => `${c.domain}.${c.service}`)),
      {
        timeout: 10000,
      },
    )
    .toContain("media_player.media_play_pause");
  /* ...e la pagina è ancora la stanza: prima il tocco saliva alla riga, che
   * porta alla pagina Musica, e mettere in pausa voleva dire andarsene. */
  await expect(page.locator("#page-stanze")).toHaveClass(/active/);

  /* Il clima porta il suo pannello, quello vero della finestra del Clima. */
  const clima = page.locator('#page-stanze [data-dm-stanza-entita="climate.salone"]');
  await expect(clima.locator("[data-dm-w-panel]")).toHaveCount(1);
});
