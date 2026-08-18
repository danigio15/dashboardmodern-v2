// DM-FIX-20260817E
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [{ id: "ev-b10", name: "B10", brand: "Leapmotor", model: "B10", icon: "mdi:car-electric" }],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, energy: true, ev: true },
};

function evBody(page) {
  return page
    .locator("#ed-body .ed-acc-body")
    .filter({ has: page.locator('.ed-slot-in[data-ref^="dm.ev_"]') })
    .first();
}

async function openEvEditor(page) {
  await page.evaluate(() => {
    window._RAW_STATES = Object.assign(window._RAW_STATES || {}, {
      "sensor.b10_soc": { state: "68", attributes: { friendly_name: "B10 Stato di carica" } },
    });
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    editorSwitch("sez2");
    const accordion = [...document.querySelectorAll("#ed-body details.ed-acc")].find((node) =>
      node.querySelector('.ed-slot-in[data-ref^="dm.ev_"]'),
    );
    if (accordion) accordion.open = true;
  });
  await expect(page.locator("#editor-modal")).toBeVisible();
  // The rows are decorated on the frame after the editor prints them.
  await expect(evBody(page).locator(".dm-slot").first()).toBeVisible();
}

test.describe("editor entity rows", () => {
  test("each slot becomes one readable row, with the raw field kept behind a switch", async ({
    page,
  }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
    await openEvEditor(page);

    const row = evBody(page).locator(".dm-slot").first();
    await expect(row.locator(".dm-slot-chip")).toBeVisible();
    // The field the editor saves through is still there, just not on screen.
    await expect(row.locator(".ed-slot-in")).toHaveCount(1);
    await expect(row.locator(".ed-slot-in")).toBeHidden();

    const body = evBody(page);
    await body.locator(".dm-slots-manual").click();
    await expect(body.locator(".ed-slot-in").first()).toBeVisible();
    await body.locator(".dm-slots-manual").click();
    await expect(body.locator(".ed-slot-in").first()).toBeHidden();
  });

  test("choosing an entity repaints the row without touching the save path", async ({
    page,
  }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
    await openEvEditor(page);

    // What cdEpChoose() does once the picker closes: write the value and fire
    // change, which is the event edSetSlot listens to.
    const result = await page.evaluate(() => {
      const body = [...document.querySelectorAll("#ed-body .ed-acc-body")].find((node) =>
        node.querySelector('.ed-slot-in[data-ref^="dm.ev_"]'),
      );
      const row = body.querySelector(".dm-slot");
      const input = row.querySelector(".ed-slot-in");
      input.value = "sensor.b10_soc";
      input.dispatchEvent(new Event("change"));
      return {
        state: row.dataset.dmSlot,
        chip: row.querySelector(".dm-slot-chip").innerText,
        saved: input.value,
      };
    });
    expect(result.state).toBe("mapped");
    expect(result.chip).toContain("B10 Stato di carica");
    expect(result.chip).toContain("sensor.b10_soc");
    expect(result.saved).toBe("sensor.b10_soc");
  });

  test("brand and model sit inside the vehicle section, above its entities", async ({
    page,
  }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
    await openEvEditor(page);

    // The editor repaints while the tab settles; the panel lands in its section
    // as soon as the accordion exists.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const body = [...document.querySelectorAll("#ed-body .ed-acc-body")].find((node) =>
            node.querySelector('.ed-slot-in[data-ref^="dm.ev_"]'),
          );
          const panel = document.querySelector("[data-ev-appearance]");
          return Boolean(body && panel && body.contains(panel));
        }),
      )
      .toBe(true);

    const inside = await page.evaluate(() => {
      const body = [...document.querySelectorAll("#ed-body .ed-acc-body")].find((node) =>
        node.querySelector('.ed-slot-in[data-ref^="dm.ev_"]'),
      );
      const panel = document.querySelector("[data-ev-appearance]");
      return {
        inAccordion: Boolean(body && panel && body.contains(panel)),
        beforeSlots: Boolean(
          panel &&
          panel.compareDocumentPosition(body.querySelector(".dm-slot")) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ),
        hasBrand: Boolean(panel?.querySelector("select[data-brand]")),
        hasModel: Boolean(panel?.querySelector("select[data-model]")),
      };
    });
    expect(inside).toEqual({
      inAccordion: true,
      beforeSlots: true,
      hasBrand: true,
      hasModel: true,
    });
  });
});
