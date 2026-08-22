import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* «Icone report ancora sballate.»
 *
 * Nel Report ogni voce ha il suo quadratino con l'icona, in fila accanto ai
 * pulsanti che la spostano su e giu'. Quei pulsanti hanno il filo chiaro del
 * tema e il fondo della plancia; il quadratino no: gli si diceva quanto grande
 * e quanto arrotondato, mai di che colore. Senza una regola sul bordo restava
 * quello che ci mette il browser — due pixel neri in rilievo su un grigio che
 * non e' di nessun tema — e accanto agli altri si vedeva benissimo che erano
 * due stili diversi.
 *
 * La prova non guarda «e' bello»: guarda che il quadratino porti lo stesso
 * filo dei controlli che gli stanno accanto. E' l'unica cosa che si puo'
 * misurare, ed e' esattamente quella che era sbagliata.
 */
const seme = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [
      {
        id: "a1",
        name: "Lavatrice",
        emoji_icon: "🧺",
        energy_entity: "sensor.energia_lavatrice",
        history_entity: "sensor.energia_lavatrice",
        show_in_report: true,
        order: 0,
      },
      {
        id: "a2",
        name: "Boiler",
        emoji_icon: "♨️",
        energy_entity: "sensor.energia_boiler",
        history_entity: "sensor.energia_boiler",
        show_in_report: true,
        order: 1,
      },
    ],
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
  visibility: { home: true },
};

const stile = (locator) =>
  locator.evaluate((nodo) => {
    const s = getComputedStyle(nodo);
    return { border: s.border, bg: s.backgroundColor };
  });

test("il quadratino dell'icona e' vestito come i pulsanti che gli stanno accanto", async ({
  page,
}, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);

  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("sez1");
  });
  await page
    .locator("#ed-body .ed-inner-tab")
    .filter({ hasText: /report/i })
    .first()
    .click();
  await expect(page.locator(".dm-report-row")).toHaveCount(2);

  const azione = await stile(page.locator(".dm-report-actions button").first());
  // Il filo del tema, non quello di serie del browser.
  expect(azione.border).toMatch(/^1px solid/);

  const quadratini = page.locator(".dm-report-icon button");
  await expect(quadratini).toHaveCount(2);
  for (let i = 0; i < 2; i += 1) {
    const icona = await stile(quadratini.nth(i));
    expect(icona.border, "il bordo di serie del browser").toBe(azione.border);
    expect(icona.bg).not.toBe("rgba(0, 0, 0, 0)");
    // E il grigio di serie dei pulsanti, che non e' di nessun tema.
    expect(icona.bg).not.toBe("rgb(239, 239, 239)");
  }

  // Anche quello della voce aggiunta a mano, che e' lo stesso campo.
  await page.locator("[data-report-add]").click();
  const manuale = page.locator("[data-report-manual] .dm-icon-field button");
  await expect(manuale).toHaveCount(1);
  expect((await stile(manuale)).border).toBe(azione.border);
});
