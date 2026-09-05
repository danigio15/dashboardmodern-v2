/* Una finestra con la sola inferriata si aggiunge (#33 della lista, dalla
 * segnalazione dell'utente).
 *
 * «Sezione finestre mi deve dare la possibilita' di aggiungere anche senza
 * entita' cover»: la scheda offre sette caselle e poi, riempita la sola che
 * uno ha — il sensore sulla grata — risponde «Inserisci una entita' cover
 * valida». Il contatto dell'infisso era gia' fra le alternative accettate; la
 * grata, arrivata dopo, non ci era mai entrata. Sono due contatti della stessa
 * finestra: uno vale l'altro.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-camera", name: "Camera", icon: "🛏️" }],
    covers: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, tapparelle: true },
};

test("con la sola grata la finestra si aggiunge, senza il rifiuto della cover", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const rifiuti = [];
  page.on("dialog", (finestra) => {
    rifiuti.push(finestra.message());
    finestra.dismiss().catch(() => {});
  });
  await page.route("https://**", (route) =>
    route.fulfill({ status: 200, body: "" }).catch(() => {}),
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 20_000,
  });

  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await page.locator('.ed-tab[data-tab="tapp"]').first().click();
  await expect(page.locator("#ed-tp-inferriata")).toHaveCount(1, { timeout: 15_000 });

  /* Le caselle delle entita' hanno il loro selettore addosso: si scrive dentro
   * come farebbe lui, annunciando input e change. */
  await page.evaluate(() => {
    const scrivi = (id, valore) => {
      const campo = document.getElementById(id);
      campo.value = valore;
      campo.dispatchEvent(new Event("input", { bubbles: true }));
      campo.dispatchEvent(new Event("change", { bubbles: true }));
    };
    scrivi("ed-tp-name", "Finestra camera");
    scrivi("ed-tp-inferriata", "binary_sensor.inferriata_camera");
    document.getElementById("ed-tp-ent").value = "";
  });
  await page.evaluate(() => edTappAdd());

  // Nessun rifiuto: la casella riempita e' una di quelle che la card sa usare.
  expect(rifiuti).toEqual([]);
  // E la riga c'e', con la grata sopra.
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("cd_tapparelle")), { timeout: 10_000 })
    .toContain("binary_sensor.inferriata_camera");
  const salvato = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cd_tapparelle") || "[]"),
  );
  expect(salvato).toHaveLength(1);
  expect(salvato[0].name).toBe("Finestra camera");
  expect(salvato[0].inferriata).toBe("binary_sensor.inferriata_camera");
  // Senza inventarle una tapparella che non ha.
  expect(salvato[0].entity || "").toBe("");
});
