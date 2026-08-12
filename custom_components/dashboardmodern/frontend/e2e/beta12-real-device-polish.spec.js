// DM-FIX-20260812B
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "room-salone", name: "Salone", icon: "mdi:sofa" },
      { id: "room-bagno", name: "Bagno", icon: "mdi:shower" },
    ],
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
  visibility: {
    home: true,
    energy: true,
    clima: true,
    temp: true,
    temperature: true,
    tapparelle: true,
    piscina: true,
  },
};

async function boot(page, variant, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
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
        window.__BETA12_WS_CALLS__ ||= [];
        window.__BETA12_WS_CALLS__.push(structuredClone(message));
        let result = null;
        if (message.type === "get_states") result = [];
        if (message.type === "frontend/get_user_data")
          result = { value: window.__BETA12_REMOTE__ || null };
        if (message.type === "frontend/set_user_data")
          window.__BETA12_REMOTE__ = structuredClone(message.value);
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

  await bootNamespacedDashboard(page, variant, testInfo, seed);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await expect
    .poll(() => page.evaluate(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true))
    .toBe(true);
}

async function openEditor(page, tab) {
  await page.evaluate((target) => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    editorSwitch(target);
  }, tab);
  await expect(page.locator("#editor-modal")).toBeVisible();
  await expect(page.locator(`.ed-tab[data-tab="${tab}"]`)).toHaveClass(/active/);
}

async function expectColoredRoomIcon(locator, glyph) {
  await expect(locator).toBeVisible();
  await expect
    .poll(async () =>
      locator.evaluate((node) => {
        const semantic = node.querySelector(".dm-beta12-room-glyph")?.textContent || "";
        const fallback = getComputedStyle(node, "::before").content || "";
        return `${semantic}${fallback}`;
      }),
    )
    .toContain(glyph);
}

async function expectQuickActionDisplayGlyph(locator, glyph) {
  await expect(locator).toBeVisible();
  await expect
    .poll(async () =>
      locator.evaluate((node) => {
        const stable = node.dataset.dmBeta12DisplayGlyph || "";
        const pseudo = getComputedStyle(node, "::before").content || "";
        const semantic = node.querySelector(".dm-beta12-action-glyph")?.textContent || "";
        return `${stable}${pseudo}${semantic}`;
      }),
    )
    .toContain(glyph);
}

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: beta12 paints quick actions colored in the same render turn`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
    await boot(page, variant, testInfo);

    const immediate = await page.evaluate(() => {
      localStorage.setItem(
        "cd_quick_actions",
        JSON.stringify([
          {
            type: "builtin",
            builtin: "luci",
            name: "Luci",
            icon: "mdi:lightbulb",
            color: "#f59e0b",
          },
        ]),
      );
      window.dispatchEvent(new CustomEvent("dashboardmodern:legacy-ready"));
      buildQuickActions();
      const icon = document.querySelector("#qa-grid .qa-btn .icon");
      return {
        text: icon?.textContent || "",
        colored: Boolean(icon?.querySelector(".dm-beta12-action-glyph")),
        displayGlyph: icon?.dataset.dmBeta12DisplayGlyph || "",
        svgCount: icon?.querySelectorAll("svg").length || 0,
      };
    });

    expect(immediate.text).toBe("💡");
    expect(immediate.colored).toBe(true);
    expect(immediate.displayGlyph).toBe("💡");
    expect(immediate.svgCount).toBe(0);

    const settled = page.locator("#qa-grid .qa-btn .icon").first();
    await expectQuickActionDisplayGlyph(settled, "💡");
    await page.locator("#qa-grid .qa-btn").first().dispatchEvent("click");
    await expectQuickActionDisplayGlyph(page.locator("#qa-grid .qa-btn .icon").first(), "💡");
    await page.waitForTimeout(950);
    await expectQuickActionDisplayGlyph(page.locator("#qa-grid .qa-btn .icon").first(), "💡");
  });

  test(`${variant}: beta12 keeps room artwork visible and colored in rows and picker`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
    await boot(page, variant, testInfo);
    await openEditor(page, "stanze");

    const row = page
      .locator('#ed-body .ed-row:has([data-dm-edit-kind="room"][data-dm-edit-index="0"])')
      .first();
    const rowIcon = row.locator(".dm-room-list-icon");
    await expect(row).toBeVisible();
    await expectColoredRoomIcon(rowIcon, "🛋️");

    await row.locator('[data-dm-edit-kind="room"]').click();
    const modal = page.locator("#dm-room-editor-modal");
    await expect(modal).toBeVisible();
    const preview = modal.locator("[data-room-icon-preview]");
    await expect(preview.locator(".dm-beta12-room-glyph")).toHaveText("🛋️");
    await expect(preview).toHaveAttribute("data-dm-beta12-colored", "true");
    await preview.click();

    const picker = page.locator('#dm-visual-picker[data-kind="room"]');
    await expect(picker).toBeVisible();
    await expect(picker).toHaveAttribute("data-dm-beta12-colored", "true");
    expect(
      await picker.locator(".dm-picker-option .dm-beta12-room-glyph").count(),
    ).toBeGreaterThanOrEqual(20);
    await expect(
      picker.locator('.dm-picker-option[data-index="0"] .dm-beta12-room-glyph'),
    ).toHaveText("🛋️");
    await expect(
      picker.locator('.dm-picker-option[data-index="5"] .dm-beta12-room-glyph'),
    ).toHaveText("🚿");
  });

  test(`${variant}: configured temperatures render from the canonical room registry`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
    await boot(page, variant, testInfo);

    await page.evaluate(async () => {
      const room = {
        id: "room-salone",
        name: "Salone",
        icon: "mdi:sofa",
        temp: "sensor.salone_temperature",
        hum: "sensor.salone_humidity",
      };
      const states = [
        {
          entity_id: room.temp,
          state: "22.4",
          attributes: { device_class: "temperature", unit_of_measurement: "°C" },
        },
        {
          entity_id: room.hum,
          state: "48",
          attributes: { device_class: "humidity", unit_of_measurement: "%" },
        },
      ];
      for (const item of states) {
        _RAW_STATES[item.entity_id] = structuredClone(item);
        STATES[item.entity_id] = structuredClone(item);
      }
      await DashboardModernModules.store.replaceSection("rooms", [room]);
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-temp")?.classList.add("active");
      buildTempCards();
    });

    const card = page.locator(
      '#temp-grid .temp-card[data-dm-temperature-canonical="true"][data-room-id="room-salone"]',
    );
    await expect(card).toBeVisible();
    await expect(card.locator(".temp-room-name")).toHaveText("Salone");
    await expect(card.locator(".temp-value")).toHaveText("22.4");
    await expect(card.locator(".temp-hum-val")).toHaveText("48%");
    await expect(card.locator(".dm-temperature-icon-fallback")).toHaveText("🛋️");
    await expect(page.locator("#temp-grid")).toHaveAttribute(
      "data-dm-temperature-renderer",
      "canonical",
    );
  });

  test(`${variant}: beta12 climate uses a persistent cold/warm segmented tab`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
    await boot(page, variant, testInfo);

    await page.evaluate(() => {
      localStorage.setItem(
        "cd_clima_units",
        JSON.stringify([
          { entity: "climate.salone", name: "Salone", room: "Salone", type: "clima" },
          { entity: "climate.bagno", name: "Bagno", room: "Bagno", type: "termo" },
        ]),
      );
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-clima")?.classList.add("active");
      buildClimaCards();
      setClimaPageMode("freddo", true);
    });

    const segmented = page.locator("#page-clima .clima-page-mode-switch");
    await expect(segmented).toBeVisible();
    await expect(segmented).toHaveCSS("display", "grid");
    await expect(page.locator("#clima-page-mode-freddo")).toHaveAttribute("aria-pressed", "true");
    await page.locator("#clima-page-mode-caldo").click();
    await expect(page.locator("#clima-page-mode-caldo")).toHaveClass(/active-caldo/);
    await expect(page.locator("#clima-page-mode-caldo")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#page-clima .clima-zone-caldo")).toHaveClass(/show/);
    await expect(page.locator("#page-clima .clima-zone-freddo")).not.toHaveClass(/show/);
  });

  test(`${variant}: energy flow animation is directional on desktop and mobile`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
    await boot(page, variant, testInfo);

    await page.evaluate(() => {
      const solar = document.getElementById("v-solar");
      const home = document.getElementById("v-home");
      if (!solar || !home) throw new Error("missing instant energy values");
      solar.textContent = "2.60 kW";
      home.textContent = "0 W";
      dmRefreshEnergyFlows();
    });

    for (const selector of ["#line-solar-home", "#m-line-solar-home"]) {
      const line = page.locator(selector);
      await expect(line).toHaveClass(/dm-energy-flow-active/);
      await expect(line).toHaveAttribute("data-dm-flow-animated", "true");
      const animation = await line.evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          name: style.animationName,
          state: style.animationPlayState,
          dash: style.strokeDasharray,
        };
      });
      expect(animation.name).toContain("dmEnergyFlowDash");
      expect(animation.state).toBe("running");
      expect(animation.dash).not.toBe("none");
    }
  });

  test(`${variant}: shutter page has one stable geometry before and after delayed polish`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
    await boot(page, variant, testInfo);

    const first = await page.evaluate(() => {
      localStorage.setItem(
        "cd_tapparelle",
        JSON.stringify([
          { name: "Tapparella", entity: "cover.tapparella", room_id: "room-salone" },
        ]),
      );
      const state = {
        entity_id: "cover.tapparella",
        state: "open",
        attributes: { friendly_name: "Tapparella", current_position: 63 },
      };
      _RAW_STATES[state.entity_id] = structuredClone(state);
      STATES[state.entity_id] = structuredClone(state);
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-tapparelle")?.classList.add("active");
      renderTapparelle();
      const card = document.querySelector("#page-tapparelle .tapp-card");
      const windowNode = card?.querySelector(".tapp-win");
      const style = card ? getComputedStyle(card) : null;
      return {
        width: card?.getBoundingClientRect().width || 0,
        height: windowNode?.getBoundingClientRect().height || 0,
        padding: style?.padding || "",
        radius: style?.borderRadius || "",
      };
    });
    expect(first.width).toBeGreaterThan(0);
    expect(first.width).toBeLessThanOrEqual(361);
    expect(first.height).toBe(132);
    expect(first.padding).toContain("14px");

    await page.waitForTimeout(140);
    const settled = await page
      .locator("#page-tapparelle .tapp-card")
      .first()
      .evaluate((card) => ({
        width: card.getBoundingClientRect().width,
        height: card.querySelector(".tapp-win")?.getBoundingClientRect().height || 0,
        padding: getComputedStyle(card).padding,
        radius: getComputedStyle(card).borderRadius,
      }));
    expect(Math.abs(settled.width - first.width)).toBeLessThanOrEqual(1);
    expect(settled.height).toBe(first.height);
    expect(settled.padding).toBe(first.padding);
    expect(settled.radius).toBe(first.radius);
  });

  test(`${variant}: beta12 pool renders a recognizable tiled basin without changing controls`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
    await boot(page, variant, testInfo);

    await page.evaluate(() => {
      localStorage.setItem(
        "cd_piscina",
        JSON.stringify({
          tempEnt: "sensor.pool_temperature",
          pumpEnt: "switch.pool_pump",
          heatEnt: "switch.pool_heat",
          lightEnt: "switch.pool_light",
          filterHours: 8,
          autoHours: true,
        }),
      );
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-piscina")?.classList.add("active");
      renderPiscina();
    });

    const hero = page.locator("#page-piscina .pool-hero");
    await expect(hero).toBeVisible();
    await expect(hero).toHaveAttribute("data-dm-beta12-pool", "true");
    await expect(hero.locator(".dm-beta12-pool-basin")).toBeVisible();
    await expect(hero.locator(".dm-beta12-pool-ladder")).toBeVisible();
    await expect(hero.locator(".dm-beta12-pool-steps")).toBeVisible();
    await expect(hero.locator('.pool-tg[data-act="pump"]')).toBeVisible();
    await expect(hero.locator('.pool-tg[data-act="heat"]')).toBeVisible();
    await expect(hero.locator('.pool-tg[data-act="light"]')).toBeVisible();
    await expect(hero.locator(".pool-wave").first()).toHaveCSS("display", "none");

    const geometry = await hero.evaluate((node) => {
      const basin = node.querySelector(".dm-beta12-pool-basin")?.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      return {
        basinWidth: basin?.width || 0,
        basinHeight: basin?.height || 0,
        overflowX: node.scrollWidth - node.clientWidth,
        inside: Boolean(basin && basin.left >= box.left && basin.right <= box.right + 1),
      };
    });
    expect(geometry.basinWidth).toBeGreaterThan(180);
    expect(geometry.basinHeight).toBeGreaterThan(120);
    expect(geometry.overflowX).toBeLessThanOrEqual(1);
    expect(geometry.inside).toBe(true);
  });
}

test("dashboard.html: total reset clears alerts and remote config without changing the panel URL", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await boot(page, "dashboard.html", testInfo);

  const result = await page.evaluate(async () => {
    localStorage.setItem(
      "cd_gruppi_extra",
      JSON.stringify({ altro: ["binary_sensor.test_alert"] }),
    );
    localStorage.setItem("cd_gruppi_removed", JSON.stringify({ altro: [] }));
    localStorage.setItem(
      "cd_avvisi_names_extra",
      JSON.stringify({ "binary_sensor.test_alert": "Test alert" }),
    );
    localStorage.setItem("cd_stanze", JSON.stringify([{ id: "room-test", name: "Test" }]));
    const before = location.href;
    const ok = await dmResetAllConfig({ skipConfirm: true, reload: false });
    const lastSet = (window.__BETA12_WS_CALLS__ || [])
      .filter((message) => message.type === "frontend/set_user_data")
      .at(-1);
    return {
      ok,
      before,
      after: location.href,
      alertGroups: localStorage.getItem("cd_gruppi_extra"),
      alertRemoved: localStorage.getItem("cd_gruppi_removed"),
      alertNames: localStorage.getItem("cd_avvisi_names_extra"),
      rooms: localStorage.getItem("cd_stanze"),
      remoteValues: lastSet?.value?.values || null,
    };
  });

  expect(result.ok).toBe(true);
  expect(result.after).toBe(result.before);
  expect(result.alertGroups).toBeNull();
  expect(result.alertRemoved).toBeNull();
  expect(result.alertNames).toBeNull();
  expect(result.rooms).toBeNull();
  expect(result.remoteValues).toEqual({});
});

test("dashboard.html: beta12 iPhone kiosk is opt-in, reversible and uses the dynamic viewport", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      get: () =>
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
    });
  });
  await boot(page, "dashboard.html", testInfo);

  await page.evaluate(() => {
    const url = new URL(location.href);
    url.searchParams.set("kiosk", "1");
    history.replaceState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  await expect(page.locator("html")).toHaveAttribute("data-dm-ios-kiosk", "true");
  await expect(page.locator("body")).toHaveAttribute("data-dm-ios-kiosk", "true");
  const viewportContract = await page.evaluate(() => ({
    height: getComputedStyle(document.documentElement)
      .getPropertyValue("--dm-ios-kiosk-height")
      .trim(),
    overflowX: getComputedStyle(document.body).overflowX,
    minHeight: getComputedStyle(document.documentElement).minHeight,
  }));
  expect(viewportContract.height).toMatch(/^\d+px$/);
  expect(Number.parseInt(viewportContract.height, 10)).toBeGreaterThan(300);
  expect(viewportContract.overflowX).toBe("hidden");
  expect(viewportContract.minHeight).not.toBe("0px");

  await page.evaluate(() => {
    const url = new URL(location.href);
    url.searchParams.set("kiosk", "0");
    history.replaceState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.locator("html")).not.toHaveAttribute("data-dm-ios-kiosk", "true");
});
