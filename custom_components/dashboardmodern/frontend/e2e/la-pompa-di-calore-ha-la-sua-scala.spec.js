/* La barra del Clima arriva fin dove arriva la macchina (#252).
 *
 * «Ho una pompa di calore Samsung, il sensore mi gestisce la temperatura di
 * uscita dell'acqua dai 40 gradi fino a 70 massimo. Quando vado a inserire nel
 * menu clima l'entita', mi mette in predefinito 10-28 gradi.» La scala era
 * scritta nel codice e valeva per tutti: il pomello restava incollato al fondo
 * e quarantacinque gradi non si potevano scegliere.
 *
 * Questa prova tiene ferme le due meta' della riparazione sulla plancia vera:
 * la pompa che dichiara 40 e 70 disegna 40 e 70 e obbedisce al grado scelto,
 * e il condizionatore che non dichiara niente tiene la scala di sempre.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "centrale", name: "Centrale termica", icon: "mdi:heat-pump" }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [
      { name: "Pompa di calore", entity: "climate.pompa", type: "termo", room: "centrale" },
      /* Il testimone: nessun min/max dichiarato, e la sua scala non deve
       * muoversi di un grado rispetto a quella che ha sempre avuto. */
      { name: "Termosifone", entity: "climate.termo", type: "termo", room: "centrale" },
    ],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, clima: true },
};

test("la pompa che dichiara 40-70 disegna 40-70, chi non dichiara niente non cambia", async ({
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
    stati["climate.pompa"] = {
      entity_id: "climate.pompa",
      state: "heat",
      attributes: {
        friendly_name: "Pompa di calore",
        current_temperature: 21.4,
        temperature: 45,
        min_temp: 40,
        max_temp: 70,
        target_temp_step: 1,
        hvac_modes: ["off", "heat"],
      },
    };
    stati["climate.termo"] = {
      entity_id: "climate.termo",
      state: "heat",
      attributes: {
        friendly_name: "Termosifone",
        current_temperature: 19,
        temperature: 21,
        hvac_modes: ["off", "heat"],
      },
    };
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
  /* Qui non si tocca nessun interruttore, ed e' giusto cosi'.
   *
   * Questa casa ha solo macchine che scaldano: una zona sola. E la plancia,
   * da molto prima di questa prova, con una zona sola l'interruttore
   * Caldo/Freddo non lo mostra — non c'e' niente fra cui scegliere, e i due
   * tasti restano nel documento ma fuori vista. La pagina si apre gia' sulla
   * zona che ha le macchine.
   *
   * La prova cliccava quel tasto e restava ad aspettare per due minuti e
   * mezzo che diventasse visibile: non lo sarebbe mai diventato. Quello che
   * qui si guarda — la scala che la pompa dichiara — si vede senza. */

  const pompa = page.locator('#page-clima [data-dm-cl="climate.pompa"]');
  await expect(pompa).toBeVisible({ timeout: 10000 });

  /* La legenda dice quello che dice la macchina, non i due numeri di prima. */
  await expect(pompa.locator("[data-dm-cl-low]")).toHaveText("40°", { timeout: 10000 });
  await expect(pompa.locator("[data-dm-cl-high]")).toHaveText("70°");

  /* E il pomello sta dove sta l'obiettivo: 45 su 40..70 e' un sesto di corsa,
   * non il fondo scala a cui la barra vecchia lo schiacciava. */
  const quota = await pompa
    .locator("[data-dm-cl-knob]")
    .evaluate((nodo) => parseFloat(nodo.style.left));
  expect(quota).toBeGreaterThan(14);
  expect(quota).toBeLessThan(20);

  /* Il testimone non si e' mosso: 16..30, come sempre. */
  const termo = page.locator('#page-clima [data-dm-cl="climate.termo"]');
  await expect(termo.locator("[data-dm-cl-low]")).toHaveText("10°");
  await expect(termo.locator("[data-dm-cl-high]")).toHaveText("28°");

  await page.screenshot({
    path: testInfo.outputPath("clima-scala-pompa.png"),
    fullPage: false,
  });
  await testInfo.attach("clima-scala-pompa", {
    path: testInfo.outputPath("clima-scala-pompa.png"),
    contentType: "image/png",
  });

  /* A meta' della corsia della pompa ci sono cinquantacinque gradi. Con la
   * scala di prima la stessa presa avrebbe mandato diciannove. */
  const rail = pompa.locator(".dm-cl-rail");
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
  expect(chiamata.entity_id).toBe("climate.pompa");
  expect(chiamata.temperature).toBe(55);
});
