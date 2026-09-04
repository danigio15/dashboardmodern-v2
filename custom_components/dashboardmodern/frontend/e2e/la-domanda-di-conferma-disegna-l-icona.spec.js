/* «Azioni rapide: quando si utilizza la domanda nella schermata non è visibile
 * l'icona impostata, ma solo il testo di configurazione» (#320).
 *
 * La finestra di conferma scriveva la sua icona con `setTxt`, cioè come testo.
 * Finché le icone erano emoji nessuno se n'era accorto; da quando si scelgono
 * dal catalogo il valore salvato è il nome mdi, e nella finestra ci finiva
 * scritto «mdi:gate» a caratteri cubitali — mentre la tessera della stessa
 * azione, che passa dal motore delle icone, il cancello lo disegnava.
 *
 * Qui si guarda la finestra vera, aperta da un'azione vera.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

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
  visibility: { home: true },
};

/* Un'azione con l'icona presa dal catalogo e la domanda accesa: il caso della
 * segnalazione. */
const AZIONI = [
  { name: "Apri cancello", icon: "mdi:gate", entity: "script.cancello", confirm: "Sei sicuro?" },
];

const iconaDellaFinestra = (page) =>
  page.evaluate(() => {
    const nodo = document.getElementById("confirm-icon");
    return {
      testo: nodo.textContent.trim(),
      token: nodo.querySelector("[data-token]")?.dataset.token || "",
      disegno: Boolean(nodo.querySelector("svg,img,.dm-icon-engine-glyph")),
    };
  });

test("la domanda di conferma disegna l'icona dell'azione, non il suo nome", async ({
  page,
}, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.evaluate((azioni) => {
    localStorage.setItem("cd_quick_actions", JSON.stringify(azioni));
    eval("_RAW_STATES")["script.cancello"] = {
      entity_id: "script.cancello",
      state: "off",
      attributes: { friendly_name: "Cancello" },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
    /* La griglia la costruisce il guscio all'avvio: le azioni arrivano dopo. */
    try {
      buildQuickActions();
    } catch (_errore) {}
  }, AZIONI);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));

  await page.locator("#qa-grid .qa-btn").first().click();
  await expect(page.locator("#confirm-modal")).toHaveClass(/show/);

  const prima = await iconaDellaFinestra(page);
  expect(prima.token).toBe("mdi:gate");
  expect(prima.disegno).toBe(true);
  /* Il nome del catalogo non si legge da nessuna parte nella finestra. */
  await expect(page.locator("#confirm-modal .confirm-card")).not.toContainText("mdi:");

  /* Una seconda domanda con un'altra icona non deve lasciare quella di prima:
   * dove non c'e' testo c'e' un disegno nostro, e il ricordo serve solo li'. */
  await page.evaluate(() => {
    forceClose("confirm-modal");
    confermaAzione({
      icon: "mdi:lightbulb",
      title: "Luce",
      message: "Accendo?",
      onConfirm: () => {},
    });
  });
  await expect.poll(async () => (await iconaDellaFinestra(page)).token).toBe("mdi:lightbulb");

  /* E un'emoji resta un'emoji: chi l'aveva scritta a mano non se la vede
   * cambiare sotto il naso. */
  await page.evaluate(() => {
    forceClose("confirm-modal");
    confermaAzione({ icon: "⚡", title: "Scena", message: "Vai?", onConfirm: () => {} });
  });
  await expect.poll(async () => (await iconaDellaFinestra(page)).testo).toBe("⚡");
});
