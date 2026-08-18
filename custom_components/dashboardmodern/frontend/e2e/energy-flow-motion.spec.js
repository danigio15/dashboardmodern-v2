// DM-FIX-20260817F
/* Il moto dei flussi, misurato nel browser invece che dedotto dal CSS.
 *
 * Il tratteggio che scorre e' l'unico segnale che l'energia sta passando, e
 * "animation-name e' impostato" non prova che si muova: qui si campiona
 * stroke-dashoffset a distanza di tempo. Il secondo caso e' quello che sul
 * desktop lasciava la plancia immobile: con "riduci movimento" attivo tutte le
 * linee si fermavano, e una linea tratteggiata ferma e' indistinguibile da una
 * spenta. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

const states = [
  {
    entity_id: "sensor.boiler_power",
    state: "2100",
    attributes: { unit_of_measurement: "W", device_class: "power" },
  },
  {
    entity_id: "sensor.wb_power",
    state: "0",
    attributes: { unit_of_measurement: "W", device_class: "power" },
  },
  {
    entity_id: "sensor.casa_power",
    state: "2100",
    attributes: { unit_of_measurement: "W", device_class: "power" },
  },
];

const seed = {
  schema_version: 4,
  sections: {
    rooms: [],
    lights: [],
    appliances: [],
    climate: [],
    ev: [],
    loads: [
      {
        id: "boiler",
        name: "Boiler",
        icon: "mdi:water-boiler",
        order: 0,
        power_entity: "sensor.boiler_power",
      },
      {
        id: "wallbox",
        name: "Wallbox",
        icon: "mdi:ev-station",
        order: 1,
        power_entity: "sensor.wb_power",
      },
    ],
    energy: { home: { power: "sensor.casa_power" } },
  },
  visibility: { home: true, energy: true },
};

async function boot(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((haStates) => {
    class MockBridgeSocket extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      constructor() {
        super();
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === "auth") return;
        const result =
          message.type === "get_states"
            ? haStates
            : message.type === "frontend/get_user_data"
              ? { value: null }
              : null;
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
          }),
        );
      }
      close() {
        this.readyState = 3;
        this.onclose?.({});
      }
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockBridgeSocket;
    window.WebSocket = MockBridgeSocket;
  }, states);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await clickBottomTab(page, "energy", testInfo);
  await expect(page.locator("#page-energy.active")).toBeVisible();
  // Un connettore per riquadro: quello desktop e quello mobile, uno solo mostrato.
  await expect(page.locator('#view-ist [data-dm-flow-arc="boiler"]')).toHaveCount(2);
}

/* Il connettore del carico acceso, nel riquadro effettivamente mostrato a
 * questa larghezza: desktop e mobile hanno due SVG e uno dei due e' nascosto. */
function readArc(page, arc) {
  return page.evaluate((id) => {
    const paths = [...document.querySelectorAll(`#view-ist [data-dm-flow-arc="${id}"]`)];
    const path =
      paths.find(
        (node) => node.getBoundingClientRect().width > 0 || node.getBoundingClientRect().height > 0,
      ) || paths[0];
    const style = getComputedStyle(path);
    return {
      offset: style.strokeDashoffset,
      dash: style.strokeDasharray,
      opacity: Number(style.opacity),
      animations: path.getAnimations ? path.getAnimations().length : 0,
    };
  }, arc);
}

test("il connettore di un carico acceso scorre davvero", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  const first = await readArc(page, "boiler");
  expect(first.animations).toBeGreaterThan(0);
  expect(first.opacity).toBe(1);

  /* Campioni ravvicinati invece di due soli: il ciclo dura 0,8 s, e due letture
   * distanti quanto il ciclo tornerebbero lo stesso offset anche mentre la
   * linea scorre. */
  const offsets = [first.offset];
  for (let index = 0; index < 4; index += 1) {
    await page.waitForTimeout(130);
    offsets.push((await readArc(page, "boiler")).offset);
  }
  expect(new Set(offsets).size).toBeGreaterThan(1);
});

test("le linee scorrono anche con 'riduci movimento': stessa lettura su ogni schermo", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await boot(page, testInfo);

  /* La preferenza di sistema e' spesso attiva su un computer e quasi mai su un
   * telefono: rispettarla qui lasciava il desktop immobile mentre il telefono
   * scorreva, cioe' la stessa plancia raccontava due cose diverse. Il
   * tratteggio in movimento non e' una decorazione, e' l'unico segnale che
   * l'energia sta passando. */
  const first = await readArc(page, "boiler");
  expect(first.animations).toBeGreaterThan(0);
  expect(first.opacity).toBe(1);
  expect(first.dash).not.toBe("none");

  const offsets = [first.offset];
  for (let index = 0; index < 4; index += 1) {
    await page.waitForTimeout(130);
    offsets.push((await readArc(page, "boiler")).offset);
  }
  expect(new Set(offsets).size).toBeGreaterThan(1);

  // Il carico spento resta comunque distinguibile: sbiadito e senza moto.
  const idle = await readArc(page, "wallbox");
  expect(idle.opacity).toBeLessThan(1);
});
