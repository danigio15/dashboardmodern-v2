// DM-FIX-20260812B
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { PRIMARY } from "./helpers/variants.js";

const states = [
  {
    entity_id: "sensor.cameretta_temperature",
    state: "25.8",
    attributes: { unit_of_measurement: "°C", device_class: "temperature" },
  },
  {
    entity_id: "sensor.cameretta_humidity",
    state: "52",
    attributes: { unit_of_measurement: "%", device_class: "humidity" },
  },
  {
    entity_id: "cover.tapparella",
    state: "open",
    attributes: { friendly_name: "Tapparella", current_position: 100 },
  },
  {
    entity_id: "light.ingresso",
    state: "off",
    attributes: { friendly_name: "Ingresso" },
  },
];

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room-cameretta",
        name: "Cameretta",
        icon: "mdi:sofa",
        temp: "sensor.cameretta_temperature",
        hum: "sensor.cameretta_humidity",
      },
      { id: "room-bagno", name: "Bagno", icon: "mdi:shower", temp: "", hum: "" },
    ],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [
      {
        id: "light-ingresso",
        name: "Ingresso",
        entities: ["light.ingresso"],
        room_id: "room-cameretta",
      },
    ],
    climate: [],
    ev: [
      {
        id: "ev-b10",
        name: "B10",
        brand: "Leapmotor",
        model: "B10",
        icon: "mdi:car-electric",
        ov: {},
      },
    ],
    covers: [
      {
        id: "cover-main",
        name: "Tapparella",
        entity: "cover.tapparella",
        room_id: "room-cameretta",
      },
    ],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, ev: true, temp: true, temperature: true, tapparelle: true },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((haStates) => {
    class MockBridgeSocket extends EventTarget {
      static OPEN = 1;
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
      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === "auth") return;
        let result = null;
        if (message.type === "get_states") result = haStates;
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
  }, states);

  await bootNamespacedDashboard(page, variant, testInfo, seed);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await expect
    .poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true))
    .toBe(true);
  await page.evaluate((haStates) => {
    haStates.forEach((item) => {
      _RAW_STATES[item.entity_id] = structuredClone(item);
      STATES[item.entity_id] = structuredClone(item);
    });
    buildTempCards?.();
  }, states);
}

async function openEditor(page, tab) {
  await page.evaluate((target) => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    editorSwitch(target);
  }, tab);
  await expect(page.locator("#editor-modal")).toBeVisible();
  await expect(page.locator(`.ed-tab[data-tab="${tab}"]`)).toHaveClass(/active/);
  await page.waitForTimeout(100);
}

for (const variant of PRIMARY) {
  test(`${variant}: beta9 matches the real-device screenshot contracts`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 180_000 : 120_000);
    await boot(page, variant, testInfo);

    await page.evaluate(() => {
      localStorage.setItem(
        "cd_quick_actions",
        JSON.stringify([
          { type: "builtin", builtin: "luci", name: "Gestione Luci" },
          { type: "builtin", builtin: "clima", name: "Clima" },
          { type: "builtin", builtin: "antifurto", name: "Antifurto" },
          { type: "builtin", builtin: "lavatrice", name: "Lavatrice" },
          { type: "toggle", name: "Cancello", icon: "⛩️", entity: "switch.cancello" },
        ]),
      );
      window.buildQuickActions?.();
    });
    const actionIcons = page.locator("#qa-grid .qa-btn .icon");
    await expect(actionIcons).toHaveCount(5);
    for (const [index, glyph] of ["💡", "❄️", "🛡️", "🧺", "⛩️"].entries()) {
      await expect
        .poll(() =>
          actionIcons
            .nth(index)
            .evaluate(
              (node) =>
                `${node.dataset.dmBeta12DisplayGlyph || ""}${getComputedStyle(node, "::before").content || ""}`,
            ),
        )
        .toContain(glyph);
    }
    await expect(page.locator("#page-home")).not.toContainText(
      /AZIONI RAPIDE PREMIUM|PREMIUM QUICK ACTIONS/i,
    );

    await openEditor(page, "sez2");
    const appearance = page.locator("#ed-body [data-ev-appearance]");
    await expect(appearance).toBeVisible();
    /* Brand and model open the vehicle's own section, above that car's entities.
     * The claim is where the panel *is* — one home, whatever else the tab draws
     * around it — rather than which block happens to be topmost by a pixel: the
     * editor prints intros and hints of its own, and on a slow browser they
     * arrive in a different order every time. */
    await expect
      .poll(() =>
        appearance.evaluate((node) => {
          const home = node.closest(".ed-acc-body");
          if (!home) return "no home";
          const slot = home.querySelector(".ed-slot");
          if (!slot) return "no slots";
          return node.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING
            ? "above its entities"
            : "below its entities";
        }),
      )
      .toBe("above its entities");
    const brand = appearance.locator("select[data-brand]");
    const model = appearance.locator("select[data-model]");
    await brand.selectOption("MINI");
    /* The choice is the select's; the logo beside it is repainted a frame later
     * by whichever owner of the panel gets there first, and on a slow browser
     * that frame is not the next one. Wait for the panel to say it has caught
     * up before reading the mark itself. */
    await expect(brand).toHaveValue("MINI");
    await expect
      .poll(
        () =>
          appearance.evaluate(
            (node) => node.querySelector("[data-brand-preview]")?.dataset.dmBeta11Brand || "",
          ),
        { message: "the preview follows the chosen brand", timeout: 10_000 },
      )
      .toBe("mini");
    /* Il segno del marchio si guarda dopo che il pannello ha dipinto.
     *
     * Marchio e scritta li scrive la stessa riga, in un colpo solo: finche' la
     * scritta non dice MINI, il pittore non e' ancora passato, e cercare il
     * segno vuol dire misurare una corsa invece di un risultato. Su Safari
     * quella corsa si perdeva circa una volta su due — con lo stesso commit
     * della 1.0.0 gia' pubblicata, due esecuzioni in parallelo davano una verde
     * e una rossa — ed e' questa attesa che mancava. */
    await expect
      .poll(
        () =>
          appearance.evaluate(
            (nodo) =>
              nodo.querySelector("[data-brand-preview] .dm-ev-brand-copy b")?.textContent?.trim() ||
              "",
          ),
        { message: "il pannello ha ridisegnato l'anteprima col marchio scelto", timeout: 20_000 },
      )
      .toBe("MINI");
    await expect(
      appearance.locator('[data-brand-preview] .dm-car-brand[data-brand="mini"]'),
    ).toHaveCount(1);
    await expect(model).toContainText("Cooper Electric");
    await expect(model).toContainText("Aceman");
    await expect(model).toContainText("Countryman Electric");
    await expect(model).toBeEnabled();
    await model.selectOption("Cooper Electric");
    await expect(appearance.locator("[data-brand-preview]")).toContainText("Cooper Electric");

    await appearance.locator("[data-brand-preview]").click();
    const brandPicker = page.locator('#dm-visual-picker[data-kind="car"]');
    await expect(brandPicker).toBeVisible();
    const brandVisuals = brandPicker.locator(".dm-picker-option .dm-picker-visual");
    expect(await brandVisuals.count()).toBeGreaterThan(20);
    expect(
      await brandVisuals.evaluateAll((nodes) =>
        nodes.every((node) => {
          const box = node.getBoundingClientRect();
          return (
            box.width >= 70 && box.height >= 38 && getComputedStyle(node).overflow === "hidden"
          );
        }),
      ),
    ).toBe(true);
    const brandColors = await brandPicker
      .locator(".dm-car-brand")
      .evaluateAll((nodes) => [...new Set(nodes.map((node) => getComputedStyle(node).color))]);
    expect(brandColors).toHaveLength(1);
    await brandPicker.locator("[data-close]").click();

    await openEditor(page, "stanze");
    const roomRow = page.locator("#ed-body .dm-room-config-row", { hasText: "Cameretta" }).first();
    await expect(roomRow).toBeVisible();
    const roomIcon = roomRow.locator('.dm-room-list-icon[data-room-icon="mdi:sofa"]');
    await expect(roomIcon).toBeVisible();
    await expect
      .poll(() =>
        roomIcon.evaluate((node) => {
          const semantic = node.querySelector(".dm-beta12-room-glyph")?.textContent || "";
          const fallback = getComputedStyle(node, "::before").content || "";
          return `${semantic}${fallback}`;
        }),
      )
      .toContain("🛋️");

    await openEditor(page, "sez7");
    const configuredTemperature = page.locator(
      '#editor-modal [data-temperature-room][data-room-id="room-cameretta"]',
    );
    await expect(configuredTemperature).toBeVisible();
    await configuredTemperature.locator("[data-temperature-edit]").click();
    const temperatureSelect = page.locator("#dm-temperature-room");
    await expect(temperatureSelect).toBeEnabled();
    await expect(temperatureSelect).toHaveAttribute("data-dm-real-device-editable", "true");
    await expect(temperatureSelect).toHaveCSS("pointer-events", "auto");
    await temperatureSelect.selectOption("room-bagno");
    await expect(temperatureSelect).toHaveValue("room-bagno");

    await openEditor(page, "luci");
    const lightForm = page.locator(
      '#ed-body .dm-light-add-form[data-dm-light-add-layout="beta9-real"]',
    );
    await expect(lightForm).toBeVisible();
    /* The entity field of this form is the readable row: the picker says what is
     * chosen and takes the width, the pencil beside it is a square, and the raw
     * id is behind that pencil. The row is measured, not the id field. */
    const lightGeometry = await lightForm.evaluate((form) => {
      const row = form.querySelector(".dm-light-add-entity-row");
      const entity = form.querySelector("#luce-add-ent");
      const chip = row?.querySelector(".dm-entity-picker");
      const manual = row?.querySelector(".dm-chip-manual");
      const name = form.querySelector("#luce-add-name");
      return {
        noOverflow: form.scrollWidth <= form.clientWidth + 1,
        rawHidden: entity ? getComputedStyle(entity).display === "none" : false,
        chipWidth: chip?.getBoundingClientRect().width || 0,
        manualWidth: manual?.getBoundingClientRect().width || 0,
        nameWidth: name?.getBoundingClientRect().width || 0,
      };
    });
    expect(lightGeometry.noOverflow).toBe(true);
    expect(lightGeometry.rawHidden).toBe(true);
    expect(lightGeometry.chipWidth).toBeGreaterThan(180);
    expect(lightGeometry.manualWidth).toBeGreaterThanOrEqual(36);
    expect(lightGeometry.nameWidth).toBeGreaterThan(240);

    await page.locator("#editor-modal .ed-head-close").last().click();
    await page.evaluate(() => {
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-tapparelle")?.classList.add("active");
      window.renderTapparelle?.();
    });
    const shutterCard = page.locator("#page-tapparelle .tapp-card").first();
    await expect(shutterCard).toBeVisible();
    const shutterGeometry = await shutterCard.evaluate((card) => ({
      width: card.getBoundingClientRect().width,
      windowHeight: card.querySelector(".tapp-win")?.getBoundingClientRect().height || 0,
      slatAnimation: getComputedStyle(card.querySelector(".tapp-shutter i")).animationName,
    }));
    expect(shutterGeometry.width).toBeLessThanOrEqual(361);
    expect(shutterGeometry.windowHeight).toBeLessThanOrEqual(133);
    expect(shutterGeometry.slatAnimation).toBe("none");

    await page.evaluate(() => {
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-home")?.classList.add("active");
      window.dispatchEvent(
        new CustomEvent("dashboardmodern:state-changed", {
          detail: { entity_id: "cover.tapparella" },
        }),
      );
    });
    const shutterAlertIcon = page.locator("#page-home .dm-shutter-alert .g-icon-wrap");
    await expect(shutterAlertIcon).toBeVisible();
    await expect(shutterAlertIcon).toHaveAttribute("data-dm-alert-motion", "static");
    await expect(shutterAlertIcon).not.toHaveClass(/anim-ping/);
  });
}
