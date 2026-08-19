/* Una stanza che c'e' solo sulle luci non e' una stanza fantasma.
 *
 * L'importazione dalle aree di Home Assistant assegna a ogni luce il nome della
 * sua area e, separatamente, aggiunge quelle aree all'elenco delle stanze. Le
 * due scritture non hanno lo stesso proprietario: l'elenco viene riscritto dal
 * deposito a ogni salvataggio, l'assegnazione delle luci no. Bastava un
 * salvataggio perche' le luci restassero a puntare a nomi che nella sezione
 * Stanze non c'erano piu'.
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
  test(`${variant}: una stanza assegnata solo alle luci finisce nell'elenco`, async ({
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
      localStorage.setItem(
        "cd_luci_rooms",
        JSON.stringify({ "light.piantana": "Mansarda", "light.faretti": "Salone" }),
      );
    });
    // La passata sui contratti gira quando il runtime la sveglia: qui la si
    // sveglia dalla stessa porta, invece di aspettare che passi da sola. Senza
    // questo la prova dipendeva da quale evento capitasse entro venti secondi,
    // e su una macchina lenta non ne capitava nessuno.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            window.dispatchEvent(new Event("pageshow"));
            const rooms = window.DashboardModernModules?.store?.getSection?.("rooms") || [];
            return rooms.map((room) => room.name).sort();
          }),
        { message: "la stanza delle luci compare fra le stanze", timeout: 20_000 },
      )
      .toEqual(["Mansarda", "Salone"]);

    const assignment = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("cd_luci_rooms") || "{}")["light.piantana"];
      } catch (error) {
        return null;
      }
    });
    expect(assignment, "la luce punta alla stanza per id").toMatch(/^room-/);
  });
}
