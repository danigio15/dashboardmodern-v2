/* «Puoi mettere nella creazione di ticket per bug un menu a tendina che
 * seleziona quale sezione della dashboard è incriminata e quale funzione, così
 * è più diretta la segnalazione.»
 *
 * Due tendine: la sezione — quelle che uno ha davvero nella barra — e la parte,
 * che cambia con la sezione. La scelta viaggia con la segnalazione, e sulla
 * pagina pubblica si legge in cima. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: { rooms: [], lights: [], appliances: [], loads: [], covers: [] },
  visibility: { home: true, energy: true },
};

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    class PonteFinto extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
      constructor() {
        super();
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(grezzo) {
        const messaggio = JSON.parse(grezzo);
        if (messaggio.type === "auth") return;
        let risultato = null;
        if (messaggio.type === "get_states") risultato = [];
        else if (messaggio.type === "dashboardmodern/tickets/list")
          risultato = { tickets: [], delivery: true, account: { connected: false } };
        else if (messaggio.type === "dashboardmodern/tickets/create") {
          (window.__inviate ||= []).push(messaggio);
          risultato = { ticket: {}, delivered: false };
        }
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({
              id: messaggio.id,
              type: "result",
              success: true,
              result: risultato,
            }),
          }),
        );
      }
      close() {}
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
    window.WebSocket = PonteFinto;
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
}

test("le due tendine dicono dove succede, e la scelta parte con la segnalazione", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await avvia(page, testInfo);

  /* Si apre dalla tessera in Configurazione, come farebbe una persona. */
  await page.locator('.tab[data-tab="config"]').first().click();
  await page.locator("#dm-tkt-card").click();
  await expect(page.locator("#dm-tkt-modal")).toHaveClass(/show/);

  const sezione = page.locator("#dm-tkt-sezione");
  const funzione = page.locator("#dm-tkt-funzione");
  await expect(sezione).toBeVisible();
  /* Le sezioni sono quelle della barra, non un elenco scritto a mano. */
  const dallaBarra = await page.evaluate(() =>
    [...document.querySelectorAll(".tab[data-tab]")].map((tab) => tab.dataset.tab),
  );
  const offerte = await sezione
    .locator("option")
    .evaluateAll((nodi) => nodi.map((n) => n.value).filter(Boolean));
  expect(offerte.length).toBeGreaterThan(0);
  for (const voce of offerte) expect(dallaBarra).toContain(voce);

  /* Le parti cambiano con la sezione: quelle dell'Energia non sono quelle
   * delle Luci. */
  await sezione.selectOption("energy");
  await expect(page.locator("#dm-tkt-funzione option[value='report']")).toHaveCount(1);
  await sezione.selectOption("config");
  await expect(page.locator("#dm-tkt-funzione option[value='report']")).toHaveCount(0);
  await expect(page.locator("#dm-tkt-funzione option[value='entita']")).toHaveCount(1);

  /* Si sceglie, si racconta, si manda. */
  await sezione.selectOption("energy");
  await page.locator("#dm-tkt-funzione").selectOption("report");
  await page.locator("#dm-tkt-campo-titolo").fill("Il report resta vuoto");
  await page.locator("#dm-tkt-corpo").fill("Apro il report e non arriva niente.");
  await page.locator('[data-dm-tkt="invia"]').click();

  const inviata = await page.evaluate(async () => {
    for (let giro = 0; giro < 40 && !(window.__inviate || []).length; giro += 1)
      await new Promise((ok) => setTimeout(ok, 100));
    return (window.__inviate || [])[0] || null;
  });
  expect(inviata).not.toBeNull();
  /* Le parole, non gli identificativi: la legge una persona. */
  expect(inviata.diagnostics.sezione).toBeTruthy();
  expect(inviata.diagnostics.funzione).toBeTruthy();
  expect(inviata.diagnostics.funzione).not.toBe("report");
  expect(funzione).toBeTruthy();
});
