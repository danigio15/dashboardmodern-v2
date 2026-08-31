/* La barra del Clima si trascina, e la testata dice come sta la caldaia.
 *
 * Dal campo: «possibilita' di scorrere la barra per aumentare e diminuire la
 * temperatura sia da desktop che da mobile» e «mostrare lo stato caldaia se
 * accesa o spenta e nel caso fosse accesa da quanto tempo». La corsia era un
 * disegno: ora il puntatore la prende, il pomello segue, e al rilascio parte
 * UNA set_temperature col grado intero scelto. La caldaia di cd_termico_caldo
 * entra fra i numeri della testata: accesa · da quanto, o spenta.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "salone", name: "Salone", icon: "mdi:sofa" }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [{ name: "Salone", entity: "climate.salone", type: "clima", room: "salone" }],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, clima: true },
};

test("la presa sulla corsia manda il grado scelto, la caldaia dice da quanto", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    window.__DM_CHIAMATE__ = [];
    class MockBridgeSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
      onerror = null;
      constructor() {
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === "auth") return;
        if (message.type === "call_service") window.__DM_CHIAMATE__.push(message);
        let result = null;
        if (message.type === "get_states") result = [];
        if (message.type === "frontend/get_user_data") result = { value: null };
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
    window.__DASHBOARDMODERN_HOSTED__ = true;
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockBridgeSocket;
    window.WebSocket = MockBridgeSocket;
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    stati["climate.salone"] = {
      entity_id: "climate.salone",
      state: "cool",
      attributes: {
        friendly_name: "Salone",
        current_temperature: 27,
        temperature: 26,
        hvac_modes: ["off", "cool"],
      },
    };
    stati["switch.caldaia_vera"] = {
      entity_id: "switch.caldaia_vera",
      state: "on",
      last_changed: new Date(Date.now() - 2 * 3600e3).toISOString(),
      attributes: { friendly_name: "Caldaia" },
    };
    localStorage.setItem(
      "cd_termico_caldo",
      JSON.stringify([{ name: "Caldaia", entity: "switch.caldaia_vera", icon: "🔥" }]),
    );
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-clima")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.render?.();
  });
  await page.waitForFunction(
    () => Boolean(document.querySelector("#page-clima .dm-cl-shell .dm-cl-card")),
    null,
    { timeout: 15000 },
  );

  /* La caldaia nella testata: accesa, e dice da quanto. */
  const caldaia = page.locator("#page-clima [data-dm-cl-caldaia]");
  await expect(caldaia).toBeVisible({ timeout: 10000 });
  await expect(caldaia.locator("[data-dm-cl-caldaia-stato]")).toContainText("Accesa", {
    timeout: 10000,
  });
  await expect(caldaia.locator("[data-dm-cl-caldaia-stato]")).toContainText("2 h");

  /* La presa sulla corsia: al centro di 16..30 c'e' il grado 23. */
  const rail = page.locator('#page-clima [data-dm-cl="climate.salone"] .dm-cl-rail');
  await expect(rail).toBeVisible({ timeout: 10000 });
  const box = await rail.boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 2 });
  await page.mouse.up();
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (window.__DM_CHIAMATE__ || []).filter(
            (c) => c.domain === "climate" && c.service === "set_temperature",
          ),
        ),
      { timeout: 10000 },
    )
    .toHaveLength(1);
  const chiamata = await page.evaluate(
    () =>
      (window.__DM_CHIAMATE__ || []).find(
        (c) => c.domain === "climate" && c.service === "set_temperature",
      ).service_data,
  );
  expect(chiamata.entity_id).toBe("climate.salone");
  expect(chiamata.temperature).toBe(23);
  /* E la presa NON ha aperto il popup della card. */
  await expect(page.locator("#clima-popup.show, #hvac-popup.show")).toHaveCount(0);
});
