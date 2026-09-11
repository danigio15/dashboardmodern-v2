/* Il blocco delle stanze nasce dove chi ha la casa lo ha messo (#493).
 *
 * Le stanze in plancia sono un blocco come gli altri: si sposta con le frecce
 * insieme alle persone, alle tessere e alle azioni rapide. Ma nasce tardi —
 * quando si spunta la prima stanza — e nasce in fondo alla pagina, perche' chi
 * lo crea lo attacca in coda e non conosce l'ordine.
 *
 * Chi quell'ordine lo applica gira sugli eventi, e a quel giro e' gia' passato:
 * il disegno del blocco sta dentro un requestAnimationFrame, la messa in fila
 * no. Cosi' la prima stanza spuntata compariva in fondo alla Home — sotto i
 * dispositivi, anche a chi le stanze le aveva messe per prime — e ci restava
 * finche' non passava di li' un evento di stato per tutt'altra ragione.
 *
 * Qui si fa il gesto vero: si mettono le stanze in cima all'ordine, si apre la
 * scheda Home dell'editor, si spunta una stanza e si guarda dove nasce il
 * blocco. Senza toccare piu' niente.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { BLOCCHI_DELLA_HOME } from "../src/core/ordine-dei-blocchi.js";

const STANZE = [
  { id: "room_a", name: "Soggiorno", icon: "🛋️" },
  { id: "room_b", name: "Cucina", icon: "🍳" },
];

/* Le stanze davanti a tutto il resto. L'elenco si costruisce dal modello: una
 * fila battuta a mano qui invecchierebbe al primo blocco nuovo. */
const STANZE_IN_CIMA = ["stanze", ...BLOCCHI_DELLA_HOME.filter((nome) => nome !== "stanze")];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: STANZE,
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
  visibility: { home: true, stanze: true },
};

/* A che altezza stanno, fra i figli della Home, il blocco delle stanze e il
 * primo blocco che di serie gli sta sotto. E' quello che vede una persona, non
 * quello che dice la configurazione. */
const altezze = (page) =>
  page.evaluate(() => {
    const figli = [...(document.getElementById("page-home")?.children || [])];
    const dove = (id) => figli.findIndex((nodo) => nodo.id === id);
    return { stanze: dove("dm-stanze-home"), dispositivi: dove("dev-title") };
  });

test("spuntata la prima stanza, il blocco nasce al suo posto e non in fondo", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(
    ({ stanze, ordine }) => {
      window.localStorage.setItem("cd_stanze", JSON.stringify(stanze));
      window.localStorage.setItem("cd_home_blocchi", JSON.stringify(ordine));
    },
    { stanze: STANZE, ordine: STANZE_IN_CIMA },
  );

  /* Di serie il blocco non c'e': nessuna stanza spuntata vuol dire nessun
   * blocco, ed e' la meta' della richiesta. */
  await expect(page.locator("#dm-stanze-home")).toHaveCount(0);

  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="sez0"]').first().click();
  const spunta = page.locator(
    '#ed-body [data-dm-home-blocchi] [data-dm-stanza-plancia-scelta="room_a"]',
  );
  await expect(spunta).toHaveCount(1, { timeout: 15_000 });
  await spunta.evaluate((nodo) => nodo.click());

  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cd_home_stanze") || "null")))
    .toEqual(["room_a"]);

  /* E adesso, senza nessun altro gesto: il blocco c'e', ed e' sopra i
   * dispositivi. Se fosse nato in coda starebbe sotto. */
  await page.evaluate(() => document.getElementById("editor-modal")?.classList.remove("show"));
  await expect(page.locator("#dm-stanze-home .dm-stanza-plancia")).toHaveCount(1, {
    timeout: 15_000,
  });
  const dove = await altezze(page);
  expect(dove.stanze).toBeGreaterThanOrEqual(0);
  expect(dove.dispositivi).toBeGreaterThanOrEqual(0);
  expect(dove.stanze).toBeLessThan(dove.dispositivi);
});
