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

/* «La tenda e' chiusa ma il render non la mostra proprio.»
 *
 * Stessa radice: la casella della tenda spariva col ridisegno prima ancora che
 * si premesse «Aggiungi», quindi quell'entita' non veniva salvata e la sua card
 * non poteva esistere. Restava la sola tapparella, e la tenda non si vedeva da
 * nessuna parte — nemmeno chiusa.
 */
test("la tenda salvata esce sulla pagina, e chiusa si vede chiusa", async ({ page }, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);

  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("tapp");
  });
  await expect(page.locator("#ed-tp-tenda")).toHaveCount(1);
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
  await expect
    .poll(() => page.evaluate(() => window.getTapparelle()[0]?.tenda))
    .toBe("cover.tenda_bagno");

  await page.evaluate(() => {
    const valori = {
      "cover.tapparella_bagno": {
        entity_id: "cover.tapparella_bagno",
        state: "open",
        attributes: { device_class: "shutter", current_position: 100, supported_features: 15 },
      },
      "cover.tenda_bagno": {
        entity_id: "cover.tenda_bagno",
        state: "closed",
        attributes: { device_class: "curtain", current_position: 0, supported_features: 15 },
      },
    };
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...valori } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, valori);
    document.querySelectorAll(".page").forEach((nodo) => nodo.classList.remove("active"));
    document.getElementById("page-tapparelle")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });

  /* Due caselle compilate, UNA card: l'infisso e' uno solo, e sotto la
   * finestra ci sono due cursori — uno per copertura. */
  const card = page.locator("[data-dm-shutter-card]");
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute("data-dm-covers", "2");
  await expect(card.locator("[data-dm-position]")).toHaveCount(2);
  // Una tenda si scosta di lato: due teli, dentro la stessa finestra.
  await expect(card.locator(".dm-tenda-telo")).toHaveCount(2);
  await expect(card.locator('[data-dm-position][data-dm-entity="cover.tenda_bagno"]')).toHaveCount(
    1,
  );
  // E chiusa si vede chiusa: i due teli coprono meta' finestra per uno.
  await expect
    .poll(() =>
      card.locator(".dm-tenda").evaluate((nodo) => nodo.style.getPropertyValue("--tenda-chiusa")),
    )
    .toBe("50%");
  await expect(card.locator('[data-dm-readout][data-dm-entity="cover.tenda_bagno"]')).toHaveText(
    "0%",
  );
});
