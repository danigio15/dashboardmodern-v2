/* Un'azione rapida chiama il servizio che quell'entita' sa eseguire.
 *
 * «Ho l'entita' button.ingresso_apri_la_porta e l'ho messa in azioni con il
 * "toggle" nella speranza che in home quando lo premo mi apre il portone ma
 * non lo fa e non capisco se e' un problema di integrazione o sono nella
 * sezione errata.» La sezione era quella giusta.
 *
 * Il guscio conosce due servizi: `turn_on` per script e scene, `toggle` per
 * tutto il resto. Ma `toggle` non e' universale — un `button` ha soltanto
 * `press`, perche' non ha due stati da scambiare. Home Assistant rispondeva
 * che quel servizio non esiste, il messaggio restava in console e il portone
 * non si muoveva: da fuori, un tasto rotto.
 *
 * Qui si guarda cosa parte davvero sul filo.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    lights: [],
    appliances: [],
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

const AZIONI = [
  { type: "entity", name: "Portone", icon: "🚪", entity: "button.ingresso_apri_la_porta" },
  { type: "entity", name: "Luce", icon: "💡", entity: "light.salone" },
  { type: "entity", name: "Serratura", icon: "🔒", entity: "lock.portoncino" },
];

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((azioni) => {
    localStorage.setItem("cd_quick_actions", JSON.stringify(azioni));
    const raw = eval("_RAW_STATES");
    raw["light.salone"] = { entity_id: "light.salone", state: "off", attributes: {} };
    raw["lock.portoncino"] = { entity_id: "lock.portoncino", state: "locked", attributes: {} };
    raw["button.ingresso_apri_la_porta"] = {
      entity_id: "button.ingresso_apri_la_porta",
      state: "unknown",
      attributes: {},
    };
    /* Si prende nota di tutto quello che parte sul filo. */
    window.__inviati = [];
    const socket = eval("typeof ws !== 'undefined' ? ws : null");
    if (socket) {
      const originale = socket.send.bind(socket);
      socket.send = (grezzo) => {
        try {
          const m = JSON.parse(grezzo);
          if (m?.type === "call_service") window.__inviati.push(`${m.domain}.${m.service}`);
        } catch (_e) {}
        return originale(grezzo);
      };
    }
    window.buildQuickActions?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, AZIONI);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  /* Il guscio definisce `qaRun` quando gli pare, e chi lo corregge si attacca
   * dopo: si aspetta che il pezzo sia al suo posto, non un tempo a caso. */
  await page.waitForFunction(() => Boolean(window.qaRun?.__dmServizioGiusto), null, {
    timeout: 15_000,
  });
}

const inviati = (page) => page.evaluate(() => window.__inviati || []);

test("il pulsante chiede press, non toggle", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await page.evaluate(() => window.qaRun(0));
  await page.waitForTimeout(400);
  const partiti = await inviati(page);
  expect(partiti, `sul filo e' partito: ${partiti.join(", ") || "niente"}`).toContain(
    "button.press",
  );
  expect(partiti, "e' partito un servizio che non esiste").not.toContain("button.toggle");
});

test("dove toggle e' giusto non si cambia niente", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await page.evaluate(() => window.qaRun(1));
  await page.waitForTimeout(400);
  const partiti = await inviati(page);
  expect(partiti, `sul filo e' partito: ${partiti.join(", ") || "niente"}`).toContain(
    "light.toggle",
  );
});

test("la serratura chiusa si apre, non si scambia", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await page.evaluate(() => window.qaRun(2));
  await page.waitForTimeout(400);
  const partiti = await inviati(page);
  expect(partiti, `sul filo e' partito: ${partiti.join(", ") || "niente"}`).toContain(
    "lock.unlock",
  );
  expect(partiti, "la serratura non ha un toggle").not.toContain("lock.toggle");
});
