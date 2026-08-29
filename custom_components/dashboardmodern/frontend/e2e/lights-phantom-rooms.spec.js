/* Le stanze sono soltanto quelle della sezione Stanze.
 *
 * L'importazione dalle aree di Home Assistant lascia sulle luci il NOME
 * dell'area, non il suo identificativo. Se quel nome corrisponde a una stanza
 * configurata, l'assegnazione va riscritta con l'id: cambiare il nome della
 * stanza non deve staccarle le luci.
 *
 * Se invece quel nome non corrisponde a niente, prima la plancia adottava la
 * stanza — la aggiungeva all'elenco per non perdere l'assegnazione. Sembrava
 * gentile, ed era il secondo padrone dell'elenco delle stanze: da li' nasceva
 * il nome che si allungava a ogni cancellazione, `room-room-room-terrazzo`.
 * Adesso l'elenco ha un padrone solo, ed e' la sezione Stanze. Una luce che
 * punta a una stanza che non c'e' semplicemente non ha una stanza: finisce
 * fra le altre zone, dove si vede, e la si riassegna in due tocchi.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { PRIMARY } from "./helpers/variants.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-salone", name: "Salone", icon: "mdi:sofa" }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [
      { id: "l1", name: "Piantana", entities: ["light.piantana"] },
      { id: "l2", name: "Faretti", entities: ["light.faretti"] },
    ],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: {},
};

for (const variant of PRIMARY) {
  test(`${variant}: una stanza che c'e' solo sulle luci non entra nell'elenco`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await bootNamespacedDashboard(page, variant, testInfo, seed);
    await page.evaluate(() => {
      localStorage.setItem(
        "cd_luci",
        JSON.stringify({ "light.piantana": "Piantana", "light.faretti": "Faretti" }),
      );
      // Quello che lascia l'importazione dalle aree: un nome, non un id.
      // «Salone» e' una stanza configurata, «Mansarda» no.
      localStorage.setItem(
        "cd_luci_rooms",
        JSON.stringify({ "light.piantana": "Mansarda", "light.faretti": "Salone" }),
      );
    });
    /* La passata sui contratti gira quando il runtime la sveglia: qui la si
     * sveglia dalla stessa porta, invece di aspettare che passi da sola. */
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            window.dispatchEvent(new Event("pageshow"));
            try {
              return JSON.parse(localStorage.getItem("cd_luci_rooms") || "{}");
            } catch (error) {
              return {};
            }
          }),
        {
          message:
            "il nome diventa un id per la stanza che c'e', e sparisce per quella che non c'e'",
          timeout: 20_000,
        },
      )
      .toEqual({ "light.faretti": "room-salone" });

    /* L'elenco delle stanze non e' cresciuto: nessuno l'ha scritto tranne la
     * sezione Stanze, che qui non e' stata toccata. */
    const stanze = await page.evaluate(() =>
      (window.DashboardModernModules?.store?.getSection?.("rooms") || []).map(
        (stanza) => stanza.name,
      ),
    );
    expect(stanze, "nessuna stanza inventata").toEqual(["Salone"]);
  });
}
