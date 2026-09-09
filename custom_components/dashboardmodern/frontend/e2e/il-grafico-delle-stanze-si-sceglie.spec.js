/* Il grafico delle Temperature: quale misura, e chi ci sta dentro.
 *
 * «avere anche quello relativo all'umidità in modo da poterla tenere
 *  d'occhio» (#427) e «poter togliere dal grafico alcune entità/stanze
 *  cliccandoci sopra … nel mio caso il vano tecnico» (#433).
 *
 * Il vano tecnico di questa casa sta a otto gradi mentre le altre due stanze
 * stanno a ventidue: è la casa della segnalazione, quella in cui la differenza
 * fra salone e camera diventa due pixel.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "r1", name: "Salone", icon: "🛋️", temp: "sensor.salone_t", hum: "sensor.salone_u" },
      { id: "r2", name: "Camera", icon: "🛏️", temp: "sensor.camera_t", hum: "sensor.camera_u" },
      { id: "r3", name: "Vano tecnico", icon: "🔧", temp: "sensor.vano_t" },
    ],
  },
  visibility: { temp: true },
};

const STATI = [
  { entity_id: "sensor.salone_t", state: "22.1", attributes: { unit_of_measurement: "°C" } },
  { entity_id: "sensor.camera_t", state: "21.6", attributes: { unit_of_measurement: "°C" } },
  { entity_id: "sensor.vano_t", state: "8.2", attributes: { unit_of_measurement: "°C" } },
  { entity_id: "sensor.salone_u", state: "52", attributes: { unit_of_measurement: "%" } },
  { entity_id: "sensor.camera_u", state: "58", attributes: { unit_of_measurement: "%" } },
];

/* Ogni entità la sua storia, attorno al valore che dichiara adesso: senza
 * questo il vano tecnico e il salone avrebbero la stessa linea. */
const CENTRI = {
  "sensor.salone_t": 22,
  "sensor.camera_t": 21.5,
  "sensor.vano_t": 8,
  "sensor.salone_u": 52,
  "sensor.camera_u": 58,
};

async function avvia(page, testInfo) {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await page.addInitScript(
    ({ haStates, centri }) => {
      window.WebSocket = class extends EventTarget {
        static OPEN = 1;
        readyState = 1;
        constructor() {
          super();
          queueMicrotask(() =>
            this.onmessage?.({ data: JSON.stringify({ type: "auth_required" }) }),
          );
        }
        send(raw) {
          const m = JSON.parse(raw);
          if (m.type === "auth") {
            this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
            return;
          }
          let result = [];
          if (m.type === "get_states") result = haStates;
          if (m.type === "history/history_during_period") {
            const entity = m.entity_ids?.[0];
            const centro = centri[entity] ?? 20;
            const end = Date.now();
            const rows = [];
            for (let i = 96; i >= 0; i -= 1)
              rows.push({
                s: (centro + Math.sin(i / 9) * 1.4).toFixed(1),
                lu: (end - i * 15 * 60 * 1000) / 1000,
              });
            result = { [entity]: rows };
          }
          this.onmessage?.({
            data: JSON.stringify({ id: m.id, type: "result", success: true, result }),
          });
        }
        close() {}
      };
    },
    { haStates: STATI, centri: CENTRI },
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.evaluate((haStates) => {
    haStates.forEach((s) => {
      _RAW_STATES[s.entity_id] = s;
      STATES[s.entity_id] = s;
    });
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-temp")?.classList.add("active");
    window.render?.();
    window.buildTempCards?.();
  }, STATI);
  const panel = page.locator("#dm-temperature-trend");
  await expect(panel).toHaveAttribute("data-state", "ready", { timeout: 10000 });
  return panel;
}

const chip = (panel, nome) =>
  panel.locator(`.dm-trend-chip:has(.dm-trend-chip-name:text-is("${nome}"))`);

test("il vano tecnico esce dal grafico toccandolo, e la scelta resta scritta", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const panel = await avvia(page, testInfo);
  await expect.poll(() => panel.locator(".dm-trend-series").count()).toBe(3);
  await testInfo.attach("grafico-con-il-vano-tecnico", {
    body: await panel.screenshot(),
    contentType: "image/png",
  });

  await chip(panel, "Vano tecnico").click();
  // Fuori dal disegno, e non piu' nella scala: restano due linee.
  await expect.poll(() => panel.locator(".dm-trend-series").count()).toBe(2);
  // La sua voce resta, sbiadita, perche' e' l'unico posto da cui riaccenderla.
  await expect(chip(panel, "Vano tecnico")).toHaveAttribute("data-dm-spenta", "true");
  await expect(chip(panel, "Vano tecnico")).toHaveAttribute("aria-pressed", "false");
  await expect(chip(panel, "Salone")).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      page.evaluate(() => {
        try {
          return JSON.parse(localStorage.getItem("cd_grafico_stanze") || "{}").spente || [];
        } catch (_errore) {
          return [];
        }
      }),
    )
    .toEqual(["r3"]);
  await testInfo.attach("grafico-senza-il-vano-tecnico", {
    body: await panel.screenshot(),
    contentType: "image/png",
  });

  // Ritoccandola torna dentro.
  await chip(panel, "Vano tecnico").click();
  await expect.poll(() => panel.locator(".dm-trend-series").count()).toBe(3);
});

test("l'umidità è lo stesso grafico, con la sua unità e la sua fascia", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const panel = await avvia(page, testInfo);
  // I gradi sono la misura di partenza, ed e' quella accesa.
  await expect(panel.locator('.dm-trend-misura[data-dm-misura="temperatura"]')).toHaveClass(
    /active/,
  );

  await panel.locator('.dm-trend-misura[data-dm-misura="umidita"]').click();
  await expect(panel).toHaveAttribute("data-state", "ready", { timeout: 10000 });
  /* Due stanze su tre: il vano tecnico la sonda dell'umidita' non ce l'ha, e
   * chi non ce l'ha non entra nel disegno. */
  await expect.poll(() => panel.locator(".dm-trend-series").count()).toBe(2);
  await expect(chip(panel, "Vano tecnico")).toHaveCount(0);
  // I valori si scrivono in per cento, senza decimali e senza il gradino.
  await expect(chip(panel, "Salone").locator(".dm-trend-chip-now")).toHaveText(/^\d+%$/);
  await testInfo.attach("grafico-dell-umidita", {
    body: await panel.screenshot(),
    contentType: "image/png",
  });

  await panel.locator('.dm-trend-misura[data-dm-misura="temperatura"]').click();
  await expect.poll(() => panel.locator(".dm-trend-series").count()).toBe(3);
  await expect(chip(panel, "Salone").locator(".dm-trend-chip-now")).toHaveText(/^\d+,\d°$/);
});
