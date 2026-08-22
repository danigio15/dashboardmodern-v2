import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* «Dopo aver salvato la nuova sezione non compare modifica.»
 *
 * Si scrive un nome, si sceglie l'entita', si preme «Aggiungi tapparella»: la
 * riga compare nell'elenco con il suo cestino e basta. Senza matita quella riga
 * e' finita — non si puo' piu' aggiungere la tenda dello stesso infisso, ne' il
 * contatto, ne' correggere l'entita'. Restava solo cancellarla e rifarla.
 */
const seme = {
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
  visibility: { home: true, tapparelle: true },
};

test("la riga appena salvata si puo' riaprire", async ({ page }, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);

  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("tapp");
  });

  // Le tre caselle in piu' stanno sotto la principale, dentro la scheda.
  for (const id of ["ed-tp-tenda", "ed-tp-tendasole", "ed-tp-contact"])
    await expect(page.locator(`#${id}`)).toHaveCount(1);

  /* Le caselle entita' stanno dietro il chip, come ovunque nella scheda: si
   * scrive nel campo e si avvisa. */
  await page.evaluate(() => {
    const scrivi = (id, valore) => {
      const campo = document.getElementById(id);
      campo.value = valore;
      campo.dispatchEvent(new Event("input", { bubbles: true }));
    };
    scrivi("ed-tp-name", "Bagno");
    scrivi("ed-tp-ent", "cover.tapparella_bagno");
    scrivi("ed-tp-tenda", "cover.tenda_bagno");
    window.edTappAdd();
  });

  await expect.poll(() => page.evaluate(() => window.getTapparelle().length)).toBe(1);

  /* E le tre caselle sono ancora li'.
   *
   * Le rimetteva `editorSwitch`, cioe' il cambio di linguetta. Salvando pero'
   * cambia il modello, e il modello ridisegna il corpo della scheda per conto
   * suo: le caselle sparivano insieme alla matita, e per rivederle bisognava
   * uscire dalla linguetta e rientrarci. */
  for (const id of ["ed-tp-tenda", "ed-tp-tendasole", "ed-tp-contact"])
    await expect(page.locator(`#${id}`)).toHaveCount(1);

  // La matita, sulla riga salvata.
  const matita = page.locator('[data-dm-edit-kind="shutter"][data-dm-edit-index="0"]');
  await expect(matita).toHaveCount(1);
  await matita.first().click();
  const modale = page.locator("#dm-shutter-editor-modal");
  await expect(modale).toBeVisible();
  await expect(modale.locator("input[name=entity]")).toHaveValue("cover.tapparella_bagno");
  // E quello che era stato scritto nelle caselle in piu' e' stato salvato.
  await expect(modale.locator("input[name=tenda]")).toHaveValue("cover.tenda_bagno");
});
