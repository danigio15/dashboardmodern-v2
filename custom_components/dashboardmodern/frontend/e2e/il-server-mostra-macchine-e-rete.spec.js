/* «I controlli del server proxmox dove gira HA con tutti i suoi container, e
 * controllare lo stato del fritbox e i suoi ripeter» (#382).
 *
 * Qui si guarda quello che vede chi ha Proxmox e un FritzBox: la tessera in
 * Home che dice quante sono ferme, le due fasce nella pagina Server, e il tasto
 * che ferma il container — che esce solo dove c'è davvero qualcosa da premere.
 *
 * E soprattutto chi NON deve vedersi: la lavatrice e il telefono portano le
 * stesse due classi dei container e del router — «running» e «connectivity» —
 * e prendendo tutto quello che le porta la sezione si riempiva di roba d'altri
 * («porta in automatico tutte queste entità sotto che non c'entrano nulla con
 * quella sezione»). Adesso si sceglie da quali integrazioni prendere, e la
 * casa finta qui sotto ha apposta le due giuste e le due sbagliate.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [{ entity: "light.salotto", name: "Salotto" }],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, server: true },
};

const STATI = {
  "light.salotto": {
    entity_id: "light.salotto",
    state: "off",
    attributes: { friendly_name: "Salotto" },
  },
  "binary_sensor.pve_lxc_101_status": {
    entity_id: "binary_sensor.pve_lxc_101_status",
    state: "on",
    attributes: { device_class: "running", friendly_name: "HomeAssistant" },
  },
  "binary_sensor.pve_qemu_103_status": {
    entity_id: "binary_sensor.pve_qemu_103_status",
    state: "off",
    attributes: { device_class: "running", friendly_name: "NAS" },
  },
  "switch.pve_qemu_103": {
    entity_id: "switch.pve_qemu_103",
    state: "off",
    attributes: { friendly_name: "NAS" },
  },
  "binary_sensor.fritzbox_connection": {
    entity_id: "binary_sensor.fritzbox_connection",
    state: "on",
    attributes: { device_class: "connectivity", friendly_name: "FRITZ!Box" },
  },
  "binary_sensor.ripetitore_salotto_connection": {
    entity_id: "binary_sensor.ripetitore_salotto_connection",
    state: "off",
    attributes: { device_class: "connectivity", friendly_name: "Ripetitore salotto" },
  },
  /* La lavatrice: «running» come un container di Proxmox. */
  "binary_sensor.lavatrice_in_funzione": {
    entity_id: "binary_sensor.lavatrice_in_funzione",
    state: "on",
    attributes: { device_class: "running", friendly_name: "Lavatrice" },
  },
  /* Il telefono: «connectivity» come il FritzBox. */
  "binary_sensor.telefono_online": {
    entity_id: "binary_sensor.telefono_online",
    state: "on",
    attributes: { device_class: "connectivity", friendly_name: "Telefono" },
  },
};

/* Di chi è ognuna, come lo dice il registro di Home Assistant al comando
 * `integrations/catalog`. È l'unico posto dove la differenza si vede. */
const PIATTAFORME = {
  "binary_sensor.pve_lxc_101_status": "proxmoxve",
  "binary_sensor.pve_qemu_103_status": "proxmoxve",
  "binary_sensor.fritzbox_connection": "fritz",
  "binary_sensor.ripetitore_salotto_connection": "fritz",
  "binary_sensor.lavatrice_in_funzione": "hon",
  "binary_sensor.telefono_online": "mobile_app",
};

const NOMI = {
  proxmoxve: "Proxmox VE",
  fritz: "FRITZ!Box Tools",
  hon: "hOn",
  mobile_app: "Mobile App",
};

/* Le integrazioni che questa casa prende: il server e il router, non la
 * lavatrice e non il telefono. */
const SCELTE = ["proxmoxve", "fritz"];

/* Il registro, per finta: risponde solo a «di chi sono queste entità» e al
 * catalogo delle integrazioni, che è tutto quello che questa scheda chiede. */
async function registroFinto(page) {
  await page.addInitScript(
    ({ piattaforme, nomi }) => {
      class PonteFinto extends EventTarget {
        readyState = 1;
        onopen = null;
        onmessage = null;
        onclose = null;
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
          if (messaggio.type === "dashboardmodern/integrations/catalog") {
            if (Array.isArray(messaggio.entity_ids))
              risultato = {
                entities: messaggio.entity_ids
                  .filter((entity) => piattaforme[entity])
                  .map((entity) => ({ entity_id: entity, platform: piattaforme[entity] })),
              };
            else
              risultato = {
                integrations: Object.entries(nomi).map(([domain, name]) => ({
                  domain,
                  name,
                  custom: false,
                  devices: 1,
                  entries: [],
                })),
                devices: [],
                entities: [],
              };
          } else if (messaggio.type === "call_service") risultato = {};
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
        close() {
          this.readyState = 3;
          this.onclose?.({});
        }
      }
      window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
      window.WebSocket = PonteFinto;
    },
    { piattaforme: PIATTAFORME, nomi: NOMI },
  );
}

async function avvia(page, testInfo, { integrazioni = SCELTE } = {}) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await registroFinto(page);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  /* Le integrazioni scelte si scrivono a plancia avviata: prima il guscio non
   * ha ancora messo il suo prefisso di istanza sulla memoria, e la chiave
   * finirebbe in un posto che nessuno legge. */
  await page.evaluate(
    ({ stati, scelte }) => {
      if (scelte.length)
        localStorage.setItem("cd_macchine", JSON.stringify({ integrazioni: scelte }));
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
      const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
      if (raw) Object.assign(raw, stati);
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      window.renderHomeWidgets?.();
    },
    { stati: STATI, scelte: integrazioni },
  );
}

test("la tessera dice quante sono ferme, e quali", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  const tessera = page.locator('.dm-tile[data-dm-widget="macchine"]').first();
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  /* Due ferme: il NAS e il ripetitore del salotto. */
  await expect(tessera.locator("[data-dm-tile-value]")).toHaveText("2");
  await expect(tessera.locator("[data-dm-tile-caption]")).toContainText("NAS");
  await expect(tessera).toHaveAttribute("data-alert", "true");
});

test("la pagina Server porta le macchine e la rete, col loro tasto", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate(() => document.querySelector('.tab[data-tab="server"]')?.click());

  const fasce = page.locator("#page-server .dm-macchine-fascia");
  await expect(fasce).toHaveCount(2, { timeout: 20_000 });

  const nas = page.locator("#page-server .dm-macchina", { hasText: "NAS" }).first();
  await expect(nas).toHaveAttribute("data-stato", "giu");
  const ha = page.locator("#page-server .dm-macchina", { hasText: "HomeAssistant" }).first();
  await expect(ha).toHaveAttribute("data-stato", "su");

  /* Il NAS ha un interruttore che si chiama come lui: il tasto c'è, e dice
   * «Avvia» perché adesso è fermo. */
  await expect(nas.locator("[data-dm-macchina-switch]")).toHaveText(/Avvia|Start/);
  /* HomeAssistant non ha niente da premere: nessun tasto. */
  await expect(ha.locator("[data-dm-macchina-switch], [data-dm-macchina-premi]")).toHaveCount(0);

  /* Il ripetitore è nella fascia della rete, e dice «Assente». */
  const ripetitore = page
    .locator("#page-server .dm-macchina", { hasText: "Ripetitore salotto" })
    .first();
  await expect(ripetitore).toHaveAttribute("data-stato", "giu");
  await expect(ripetitore.locator(".dm-macchina-stato")).toHaveText(/Assente|Down/);
});

test("il tasto chiede davvero ad Home Assistant di accendere", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate(() => document.querySelector('.tab[data-tab="server"]')?.click());
  await expect(page.locator("#page-server .dm-macchina").first()).toBeVisible({ timeout: 20_000 });

  await page.evaluate(() => {
    window.__CHIAMATE = [];
    window.dmCallHaService = (dominio, servizio, dati) => {
      window.__CHIAMATE.push([dominio, servizio, dati?.entity_id]);
    };
  });
  await page
    .locator("#page-server .dm-macchina", { hasText: "NAS" })
    .first()
    .locator("[data-dm-macchina-switch]")
    .click();
  expect(await page.evaluate(() => window.__CHIAMATE)).toEqual([
    ["switch", "turn_on", "switch.pve_qemu_103"],
  ]);
});

test("la lavatrice e il telefono restano fuori, anche se portano le stesse classi", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate(() => document.querySelector('.tab[data-tab="server"]')?.click());
  await expect(page.locator("#page-server .dm-macchina").first()).toBeVisible({ timeout: 20_000 });

  /* Quattro righe e non sei: due container e due pezzi di rete. */
  await expect(page.locator("#page-server .dm-macchina")).toHaveCount(4);
  await expect(page.locator("#page-server .dm-macchina", { hasText: "Lavatrice" })).toHaveCount(0);
  await expect(page.locator("#page-server .dm-macchina", { hasText: "Telefono" })).toHaveCount(0);
});

test("senza aver scelto niente non si adotta niente, e non si dice niente", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { integrazioni: [] });
  await page.evaluate(() => document.querySelector('.tab[data-tab="server"]')?.click());

  /* Meglio una sezione vuota che una piena di roba d'altri: questo non cambia.
   * Quello che è cambiato è che la sezione vuota adesso tace.
   *
   * C'era una riga d'invito — «MACCHINE E RETE · Da scegliere · 21» — con un
   * paragrafo che spiegava dove andare a spuntare le integrazioni. Ma dove si
   * sceglie lo dice già la scheda del Config, che è dove uno sta guardando
   * quando configura: «se si configura nella sezione config di riferimento
   * togli ste scritte inutili, soprattutto se non è configurato nulla». Una
   * pagina che non ha niente da mostrare non ha nemmeno niente da dire. */
  await expect(page.locator("#page-server .dm-macchina")).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator("#page-server .dm-macchine-invito")).toHaveCount(0);
});

test("dal config si spunta l'integrazione, e la sezione si riempie", async ({ page }, testInfo) => {
  await avvia(page, testInfo, { integrazioni: [] });
  await page.evaluate(() => {
    window.apriConfigEntita?.();
    window.editorSwitch?.("sez6");
  });

  /* Il menù arriva quando il registro ha risposto: una riga per integrazione,
   * col nome leggibile e quanto porterebbe. */
  const proxmox = page.locator('#ed-body [data-dm-macchina-integrazione="proxmoxve"]');
  await expect(proxmox).toBeVisible({ timeout: 20_000 });
  const riga = page.locator("#ed-body .dm-macchina-ed-int", { hasText: "Proxmox VE" }).first();
  await expect(riga.locator(".dm-macchina-ed-int-conto")).toContainText("2");
  /* Anche la lavatrice è in elenco: è chi configura a dire di no, non una
   * lista di nomi scritta dentro la plancia. */
  await expect(page.locator('#ed-body [data-dm-macchina-integrazione="hon"]')).toHaveCount(1);
  /* Ma finché non si spunta niente, nessuna riga. */
  await expect(page.locator("#ed-body .dm-macchina-ed-riga")).toHaveCount(0);

  await proxmox.click();

  /* Spuntata quella giusta: i due container entrano, la lavatrice no. */
  await expect(page.locator("#ed-body .dm-macchina-ed-riga")).toHaveCount(2);
  await expect(page.locator("#ed-body .dm-macchina-ed-riga")).toContainText(["pve", "pve"]);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("cd_macchine") || "{}").integrazioni),
  ).toEqual(["proxmoxve"]);
});
