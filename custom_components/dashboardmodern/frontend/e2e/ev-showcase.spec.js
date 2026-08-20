// DM-FIX-20260817D
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
    ev: [
      { id: "ev-b10", name: "B10", brand: "Leapmotor", model: "B10", icon: "mdi:car-electric" },
      { id: "ev-t03", name: "T03", brand: "Leapmotor", model: "T03", icon: "mdi:car-electric" },
    ],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, energy: true, ev: true },
};

/** Put the EV page on screen with the values the render loop would have written. */
async function openEvPage(page, { mode = "off", charging = false } = {}) {
  await page.evaluate(
    ({ mode: activeMode, charging: isCharging }) => {
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-ev")?.classList.add("active");
      const fill = document.getElementById("ev-mod-batt-fill");
      if (fill) {
        fill.style.width = "68%";
        fill.style.setProperty("--batt-col", "#16a34a");
      }
      document.querySelectorAll(".v-ev-pow").forEach((el) => (el.textContent = "7.4 kW"));
      document.querySelectorAll(".v-ev-remain").forEach((el) => (el.textContent = "1h 25m"));
      document.querySelectorAll(".v-auto-limite").forEach((el) => (el.textContent = "368 km"));
      document.querySelectorAll(".evcc-mode-btn").forEach((btn) => btn.classList.remove("active"));
      document.getElementById(`m-btn-${activeMode}`)?.classList.add("active");
      document.getElementById("lm-hero-card")?.classList.toggle("lm-charging", isCharging);
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    },
    { mode, charging },
  );
}

test.describe("EV page redesign", () => {
  test("the skin mounts without losing a single legacy hook", async ({ page }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
    await openEvPage(page, { mode: "off" });

    // The photo, the battery bar and the badge ids keep existing: the legacy
    // render loop writes into them on every state event.
    await expect(page.locator("#page-ev")).toHaveClass(/dm-evv/);
    await expect(page.locator("#ev-mod-car-img")).toHaveCount(1);
    await expect(page.locator("#ev-mod-batt-fill")).toHaveCount(1);
    await expect(page.locator("#lm-charge-badge #lm-stato-txt")).toHaveCount(1);

    // The battery block is moved into the ring, not copied.
    await expect(page.locator(".dm-evv-gauge .lm-batt-section")).toHaveCount(1);
    await expect(page.locator(".lm-batt-section")).toHaveCount(1);

    // The ring draws the value the bar carries: 68% of the circumference.
    const arc = page.locator(".dm-evv-arc");
    const [drawn, gap] = ((await arc.getAttribute("stroke-dasharray")) || "")
      .split(" ")
      .map(Number);
    expect(Math.round((drawn / (drawn + gap)) * 100)).toBe(68);

    // The rows next to the ring are filled by the legacy value classes.
    await expect(page.locator(".dm-evv-row-val.v-ev-pow")).toHaveText("7.4 kW");
    await expect(page.locator(".dm-evv-row-val.v-ev-remain")).toHaveText("1h 25m");
  });

  test("the page follows the colour of the active EVCC mode", async ({ page }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);

    for (const mode of ["off", "pv", "minpv", "now"]) {
      await openEvPage(page, { mode });
      await expect(page.locator("#page-ev")).toHaveAttribute("data-dm-ev-mode", mode);
    }

    // With no mode marked the page falls back to the neutral colour instead of
    // keeping the last one.
    await page.evaluate(() => {
      document.querySelectorAll(".evcc-mode-btn").forEach((btn) => btn.classList.remove("active"));
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    });
    await expect(page.locator("#page-ev")).toHaveAttribute("data-dm-ev-mode", "");
  });

  test("the vehicle picker keeps switching profiles", async ({ page }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
    await openEvPage(page, { mode: "pv" });

    // La tendina di cui parla questa prova e' quella in cima alla pagina Auto.
    // Le stesse linguette si disegnano anche dentro al popup dell'auto — e'
    // la stessa tendina in un secondo posto — quindi contarle su tutta la
    // pagina ne trova il doppio e non dice piu' di quale si sta parlando.
    const cards = page.locator("#ev-car-picker .dm-vehicle-profile-card");
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toHaveClass(/active/);
    await cards.nth(1).click();
    await expect(cards.nth(1)).toHaveClass(/active/);
    await expect(cards.first()).not.toHaveClass(/active/);
  });

  test("re-rendering never duplicates the cards it mounts", async ({ page }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
    await openEvPage(page, { mode: "pv" });
    for (let pass = 0; pass < 4; pass += 1) await openEvPage(page, { mode: "pv" });

    await expect(page.locator(".dm-evv-power")).toHaveCount(1);
    await expect(page.locator(".dm-evv-row")).toHaveCount(3);
    await expect(page.locator("#m-btn-pv .dm-evv-fx")).toHaveCount(1);
    // The page must never scroll sideways on a phone. Measured once the page has
    // stopped being rebuilt: a re-render in flight can be a few pixels wide for
    // a frame, and what matters is where it comes to rest.
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      )
      .toBe(true);
  });
});
