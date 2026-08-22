// DM-FIX-20260818A
/* The Beta 31 round, in a real browser: the parts that only exist once there is
 * a document — the camera wall, the bottom bar, and the entity rows across the
 * editors. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const states = [
  {
    entity_id: "camera.strada",
    state: "idle",
    attributes: {
      friendly_name: "Strada",
      entity_picture: "/api/camera_proxy/camera.strada?token=a",
    },
  },
  {
    entity_id: "camera.cortile",
    state: "idle",
    attributes: {
      friendly_name: "Cortile",
      entity_picture: "/api/camera_proxy/camera.cortile?token=b",
    },
  },
  {
    entity_id: "cover.tapparella",
    state: "closed",
    attributes: { friendly_name: "Tapparella", current_position: 0, supported_features: 15 },
  },
];

const seed = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [
      { id: "camera-strada", name: "Strada", entity: "camera.strada" },
      { id: "camera-cortile", name: "Cortile destro", entity: "camera.cortile" },
    ],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [{ id: "cover-tapparella", name: "Tapparella", entity: "cover.tapparella" }],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, security: true, tapparelle: true, ev: true },
};

/* Il dock a scomparsa non e' piu' come parte la plancia: adesso la barra sta
 * ferma, e a scomparsa ci va chi lo sceglie. Le due prove qui sotto guardano
 * proprio il dock, quindi la scelta la fanno loro prima di aprire. */
async function scegliIlDock(page) {
  await page.addInitScript(() => {
    const chiave = `cd_${new URLSearchParams(location.search).get("dmi")}_cd_navbar_mode`;
    Storage.prototype.setItem.call(window.localStorage, chiave, "auto");
  });
}

async function boot(page, testInfo) {
  await page.route("**/api/camera_proxy/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: "<svg xmlns='http://www.w3.org/2000/svg' width='4' height='3'><rect width='4' height='3' fill='#0f0'/></svg>",
    }),
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.evaluate((haStates) => {
    const registry = eval("_RAW_STATES");
    for (const entry of haStates) registry[entry.entity_id] = entry;
  }, states);
}

async function openPage(page, name) {
  await page.evaluate((id) => {
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById(`page-${id}`)?.classList.add("active");
  }, name);
}

test.describe("beta31", () => {
  test("a rebuilt camera wall gets its frames back", async ({ page }, testInfo) => {
    await boot(page, testInfo);
    await openPage(page, "security");

    // The exact sequence that left every camera black: the frames are asked for
    // and the wall is rebuilt on top of them in the same turn.
    await page.evaluate(() => {
      const grid = document.getElementById("cam-grid");
      if (grid) {
        grid.innerHTML = "";
        grid._sig = "";
      }
      window.refreshCameras?.();
      window.renderSecurity?.();
    });

    const images = page.locator("#cam-grid .dm-cam img");
    await expect(images).toHaveCount(2);
    await expect
      .poll(() =>
        images.evaluateAll((nodes) =>
          nodes.every(
            (node) => Boolean(node.getAttribute("src")) && node.dataset.dmCameraState === "ready",
          ),
        ),
      )
      .toBe(true);
  });

  test("the closed shutter covers the whole opening", async ({ page }, testInfo) => {
    await boot(page, testInfo);
    await openPage(page, "tapparelle");
    await page.evaluate(() => window.renderTapparelle?.());
    const geometry = await page.evaluate(() => {
      const win = document.querySelector("#page-tapparelle .tapp-win");
      const panel = document.querySelector("#page-tapparelle .tapp-shutter");
      if (!win || !panel) return null;
      const style = getComputedStyle(win);
      const border = Number.parseFloat(style.borderTopWidth) || 0;
      const winBox = win.getBoundingClientRect();
      const panelBox = panel.getBoundingClientRect();
      return {
        top: Math.round(panelBox.top - (winBox.top + border)),
        left: Math.round(panelBox.left - (winBox.left + border)),
        right: Math.round(winBox.right - border - panelBox.right),
        height: Math.round(panelBox.height - (winBox.height - border * 2)),
      };
    });
    expect(geometry).not.toBeNull();
    // Flush with the opening on every side: no sky above it, no hills beside it.
    expect(geometry).toEqual({ top: 0, left: 0, right: 0, height: 0 });
  });

  test("the bottom bar closes on a page that swallows the tap", async ({ page }, testInfo) => {
    // The dock is the touch navigation: on a pointer viewport there is no bar
    // to close, and the sidebar takes its place.
    test.skip(!testInfo.project.use.hasTouch, "touch navigation only");
    await scegliIlDock(page);
    await boot(page, testInfo);
    await openPage(page, "security");
    // The section modules install after the legacy runtime announces itself.
    await page.waitForFunction(() => Boolean(window.__DASHBOARDMODERN_NAVIGATION_SECTION__));
    const closed = await page.evaluate(() => {
      const nav = document.querySelector("nav.bottom-nav-bar");
      const host = document.getElementById("page-security");
      // A redesigned page that stops propagation on its own cards, which is
      // what used to leave the dock open here and closed on Home.
      host.addEventListener("click", (event) => event.stopPropagation());
      nav.classList.add("visible");
      document.body.classList.add("nav-visible");
      host.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      return {
        nav: nav.classList.contains("visible"),
        body: document.body.classList.contains("nav-visible"),
      };
    });
    expect(closed).toEqual({ nav: false, body: false });
  });

  test("the handle still opens the dock, and opens it once", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch, "touch navigation only");
    await scegliIlDock(page);
    await boot(page, testInfo);
    await page.waitForFunction(() => Boolean(window.__DASHBOARDMODERN_NAVIGATION_SECTION__));
    const handle = page.locator("#bottomNavHandle");
    await expect(handle).toBeVisible();
    await handle.evaluate((node) => node.click());
    // One tap, one toggle: the runtime binds the handle too, and both acting on
    // the same tap would cancel each other out.
    await expect(page.locator("nav.bottom-nav-bar")).toHaveClass(/visible/);
  });

  test("the Home configuration no longer asks twice for the alarm and the gate", async ({
    page,
  }, testInfo) => {
    await boot(page, testInfo);
    await page.evaluate(() => {
      window.apriConfigEntita();
      window.editorSwitch("sez0");
    });
    await expect(page.locator("#ed-body .ed-slot").first()).toBeVisible();
    await expect(
      page.locator('#ed-body .ed-slot-in[data-ref="dm.home_interruttore_antifurto"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('#ed-body .ed-slot-in[data-ref="dm.home_script_apertura_cancello"]'),
    ).toHaveCount(0);
    // The rows that stay are untouched.
    await expect(page.locator('#ed-body .ed-slot-in[data-ref="dm.home_meteo"]')).toHaveCount(1);
  });

  test("every entity field in the editors is the same readable row", async ({ page }, testInfo) => {
    await boot(page, testInfo);
    for (const tab of ["luci", "tapp", "irr", "sez1", "sez0"]) {
      const counts = await page.evaluate(async (name) => {
        if (!document.getElementById("editor-modal")?.classList.contains("show")) {
          window.apriConfigEntita();
        }
        window.editorSwitch(name);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const body = document.getElementById("ed-body");
        const fields = [...body.querySelectorAll('input[data-entity-input="true"]')];
        const rows = fields.filter(
          (input) => input.closest(".dm-slot") || input.closest('[data-dm-entity-chip="true"]'),
        );
        const bareLens = [...body.querySelectorAll(".dm-entity-picker")].filter(
          (button) =>
            !button.classList.contains("dm-slot-chip") &&
            !button.closest(".dm-slot") &&
            button.getClientRects().length > 0,
        );
        return { fields: fields.length, rows: rows.length, bareLens: bareLens.length };
      }, tab);
      expect(counts.rows, `${tab}: every entity field is a row`).toBe(counts.fields);
      expect(counts.bareLens, `${tab}: no bare lens left`).toBe(0);
    }
  });

  /* Some forms pin their own layout for the very field the row replaces: the
   * "Aggiungi luce" form fixes its entity input to display:block and gives the
   * lens a 58px column, which used to leave that one row showing the raw id
   * beside a chip squeezed into the column. */
  test("the readable row survives the forms that lay themselves out", async ({
    page,
  }, testInfo) => {
    await boot(page, testInfo);
    for (const tab of ["luci", "irr"]) {
      const rows = await page.evaluate(async (name) => {
        if (!document.getElementById("editor-modal")?.classList.contains("show")) {
          window.apriConfigEntita();
        }
        window.editorSwitch(name);
        await new Promise((resolve) => setTimeout(resolve, 600));
        const body = document.getElementById("ed-body");
        return [...body.querySelectorAll('[data-dm-entity-chip="true"]')]
          .filter((host) => host.getClientRects().length > 0)
          .map((host) => {
            const raw = host.querySelector(".dm-chip-raw");
            const chip = host.querySelector(".dm-entity-picker.dm-slot-chip");
            const manual = host.querySelector(".dm-chip-manual");
            return {
              id: raw?.id || raw?.dataset.ref || "",
              rawHidden: raw ? getComputedStyle(raw).display === "none" : null,
              chipWidth: Math.round(chip?.getBoundingClientRect().width || 0),
              manualWidth: Math.round(manual?.getBoundingClientRect().width || 0),
            };
          });
      }, tab);
      expect(rows.length, `${tab}: has rows to check`).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.rawHidden, `${tab}/${row.id}: the id stays behind the pencil`).toBe(true);
        expect(row.chipWidth, `${tab}/${row.id}: the chip is the row`).toBeGreaterThan(140);
        expect(row.manualWidth, `${tab}/${row.id}: the pencil is a square`).toBeGreaterThanOrEqual(
          36,
        );
      }
    }
  });

  /* A form printed after the pass that decorates the tab — the Temperatura form
   * is drawn by its own owner and lands late on a phone — used to keep the raw
   * field and the magnifier while every other field on the tab had its row. */
  test("a field printed after the tab still becomes a row", async ({ page }, testInfo) => {
    await boot(page, testInfo);
    await page.evaluate(async () => {
      window.apriConfigEntita();
      window.editorSwitch("tapp");
      await new Promise((resolve) => setTimeout(resolve, 2200));
    });
    // Long after everything has settled, a late owner prints one more field.
    await page.evaluate(() => {
      const body = document.getElementById("ed-body");
      const row = document.createElement("div");
      row.className = "ed-form-row dm-entity-picker-row";
      row.dataset.dmLateField = "true";
      row.innerHTML =
        '<input id="dm-late-entity" class="ed-input" data-entity-input="true" placeholder="sensor.entity">' +
        '<button type="button" class="dm-entity-picker" data-entity-target="dm-late-entity">🔍</button>';
      body.append(row);
    });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const row = document.querySelector("[data-dm-late-field]");
          return {
            chip: Boolean(row?.querySelector(".dm-entity-picker.dm-slot-chip")),
            pencil: Boolean(row?.querySelector(".dm-chip-manual")),
            rawHidden: getComputedStyle(row.querySelector("#dm-late-entity")).display === "none",
          };
        }),
      )
      .toEqual({ chip: true, pencil: true, rawHidden: true });
  });

  test("the EV configuration takes two photos of the car", async ({ page }, testInfo) => {
    await boot(page, testInfo);
    await page.evaluate(() => {
      window.apriConfigEntita();
      window.editorSwitch("sez2");
      const accordion = [...document.querySelectorAll("#ed-body details.ed-acc")].find((node) =>
        node.querySelector('.ed-slot-in[data-ref^="dm.ev_"]'),
      );
      if (accordion) accordion.open = true;
    });
    const photos = page.locator("#ed-body [data-ev-photos]");
    await expect(photos).toHaveCount(1);
    await expect(photos.locator('[data-ev-photo="idle"] input')).toHaveCount(1);
    await expect(photos.locator('[data-ev-photo="plugged"] input')).toHaveCount(1);
    // And the single field these two replace is gone from the tab, not merely
    // marked hidden under an editor rule that keeps drawing it.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            [...document.querySelectorAll("#ed-body .ed-slot")].filter(
              (slot) =>
                /immagine auto|car image/i.test(
                  slot.querySelector(".ed-slot-lbl")?.textContent || "",
                ) && slot.getClientRects().length > 0,
            ).length,
        ),
      )
      .toBe(0);

    await photos.locator('[data-ev-photo="idle"] input').fill("/local/auto.png");
    await photos.locator('[data-ev-photo="plugged"] input').fill("/local/auto-cavo.png");
    // Both paths are still there after the tab has finished settling: the panel
    // is refreshed while it does, and it used to blank the field the person had
    // just left to type in the other one.
    await page.waitForTimeout(2200);
    await expect(photos.locator('[data-ev-photo="idle"] input')).toHaveValue("/local/auto.png");
    await expect(photos.locator('[data-ev-photo="plugged"] input')).toHaveValue(
      "/local/auto-cavo.png",
    );
    // The panel save sits behind the tab's single save now.
    await page.locator("#ed-body [data-dm-save-all]").click();
    await expect
      .poll(() =>
        page.evaluate(() => ({
          idle: localStorage.getItem("cd_ev_image"),
          plugged: localStorage.getItem("cd_ev_image_plugged"),
        })),
      )
      .toEqual({ idle: '"/local/auto.png"', plugged: '"/local/auto-cavo.png"' });
  });

  test("brand and model come up in the same place every time", async ({ page }, testInfo) => {
    await boot(page, testInfo);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await page.evaluate(() => {
        if (!document.getElementById("editor-modal")?.classList.contains("show")) {
          window.apriConfigEntita();
        }
        window.editorSwitch("sez7");
        window.editorSwitch("sez2");
        const accordion = [...document.querySelectorAll("#ed-body details.ed-acc")].find((node) =>
          node.querySelector('.ed-slot-in[data-ref^="dm.ev_"]'),
        );
        if (accordion) accordion.open = true;
      });
      const panel = page.locator("#ed-body [data-ev-appearance]");
      await expect(panel).toHaveCount(1);
      // Always inside the vehicle accordion, never floating at the top of the tab.
      await expect
        .poll(() =>
          page.evaluate(() => {
            const node = document.querySelector("#ed-body [data-ev-appearance]");
            return Boolean(
              node?.parentElement?.classList.contains("ed-acc-body") &&
              node.parentElement.querySelector('.ed-slot-in[data-ref^="dm.ev_"]'),
            );
          }),
        )
        .toBe(true);
    }
  });
});
