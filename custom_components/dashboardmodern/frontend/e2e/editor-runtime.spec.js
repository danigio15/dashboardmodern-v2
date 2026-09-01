import { expect, test } from "@playwright/test";
import { clickStableButton } from "./helpers/navigation.js";
import { editEntityFieldByHand, saveSection, showRawEntityFields } from "./helpers/entity-field.js";
import { PRIMARY } from "./helpers/variants.js";

/* Le tre librerie stanno in casa, e queste prove le sostituiscono li'.
 *
 * Prima arrivavano da jsdelivr e bastava dirottare `https://**`; adesso le
 * serve l'integrazione da `legacy/vendor/`, quindi si dirotta quel percorso.
 * Chi passa `null` come corpo se le prende davvero. */
async function stubVendorScripts(page, corpi) {
  await page.route(/\/vendor\/[^/]+\.js(?:\?.*)?$/, (route) => {
    const nome = route.request().url().split("/").pop().split("?")[0];
    const corpo = corpi[nome];
    if (corpo === undefined) return route.continue();
    return route.fulfill({ contentType: "application/javascript", body: corpo });
  });
}

/* Nessuna richiesta verso l'esterno, mai piu'.
 *
 * E' la garanzia che questo giro difende: una casa senza internet sul quadro
 * deve vedere la plancia com'e', non aspettare che il browser si arrenda. */
function nienteRete(page, fuori) {
  page.on("request", (richiesta) => {
    const url = richiesta.url();
    if (/^https?:\/\/(?!127\.0\.0\.1|localhost)/.test(url)) fuori.push(url);
  });
}

for (const variant of PRIMARY) {
  test(`${variant}: missing Chart.js still reaches legacy readiness`, async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(`${error.message}\n${error.stack || ""}`));
    const fuori = [];
    nienteRete(page, fuori);
    await stubVendorScripts(page, {
      "chart.umd.min.js": "",
      "panzoom.min.js": "",
      "hls.min.js": "",
    });
    await page.addInitScript(() => {
      window.WebSocket = class extends EventTarget {
        static OPEN = 1;
        readyState = 1;
        send() {}
        close() {}
      };
    });
    await page.goto(`/legacy/${variant}`);
    await page.waitForFunction(
      () => window.__DASHBOARDMODERN_LEGACY_READY__ === true && document.readyState !== "loading",
    );
    await expect(
      page.locator('[role="alert"]', {
        hasText: "Errore durante il caricamento di DashboardModern",
      }),
    ).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    expect(fuori, "la plancia ha chiesto qualcosa alla rete").toEqual([]);
  });

  test(`${variant}: runtime, energy, loads and report use the shipped module`, async ({
    page,
  }, testInfo) => {
    /* Il giro completo dell'editor e' la prova piu' lunga del progetto: apre
     * ogni linguetta, ogni finestra e ogni selettore. Da sola sta dentro il
     * mezzo minuto di default per un pelo — ventisei secondi su una macchina
     * ferma — e con la suite intera addosso non ci sta piu': cadeva a caso, e
     * non per quello che stava provando. Le altre prove pesanti del progetto
     * si prendono lo stesso minuto e un quarto. */
    test.setTimeout(testInfo.project.name === "webkit-ipad" ? 180_000 : 75_000);
    const errors = [];
    const pageErrors = [];
    const seedState = {
      schema_version: 3,
      sections: {
        rooms: [],
        appliances: [
          {
            id: "appliance-seed",
            name: "Seed washer",
            device_type: "lavatrice",
            show_in_report: true,
            report_label: "Washer first",
            report_icon: "🧺",
            report_entity: "sensor.washer_month",
            report_order: 0,
          },
        ],
        loads: [
          {
            id: "load-seed",
            name: "Seed pump",
            category: "secondary",
            show_in_report: true,
            report_label: "Pump second",
            report_icon: "💧",
            report_entity: "sensor.pump_month",
            report_order: 1,
          },
          {
            id: "manual-seed",
            name: "Seed manual",
            category: "manual-report",
            show_in_report: true,
            show_in_dashboard: false,
            report_label: "Manual third",
            report_icon: "🔌",
            report_entity: "sensor.manual_month",
            report_order: 2,
          },
        ],
        entityOverrides: {
          "dm.lavatrice_potenza_presa": "sensor.washer_power",
        },
      },
      visibility: {},
    };

    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    let rejectEarlyPageError;
    const earlyPageError = new Promise((_, reject) => {
      rejectEarlyPageError = reject;
    });
    page.on("pageerror", (error) => {
      const detail = [error.message, error.stack || "Stack unavailable", `URL: ${page.url()}`].join(
        "\n",
      );
      pageErrors.push(detail);
      rejectEarlyPageError(new Error(`Page error before runtime readiness:\n${detail}`));
    });
    const fuori = [];
    nienteRete(page, fuori);
    await stubVendorScripts(page, {
      "chart.umd.min.js":
        "window.Chart=class{static defaults={color:'',font:{}};constructor(){}destroy(){}}",
      "panzoom.min.js": "window.panzoom=()=>({dispose(){}})",
      "hls.min.js": "window.Hls=class{static isSupported(){return false}}",
    });
    await page.addInitScript(() => {
      class TestSocket extends EventTarget {
        static OPEN = 1;
        readyState = 1;
        constructor() {
          super();
          queueMicrotask(() => {
            this.dispatchEvent(new Event("open"));
            this.onopen?.();
            this.emit({ type: "auth_required", ha_version: "test" });
          });
        }
        emit(value) {
          const event = new MessageEvent("message", { data: JSON.stringify(value) });
          this.dispatchEvent(event);
          this.onmessage?.(event);
        }
        send(payload) {
          const message = JSON.parse(payload);
          if (message.type === "auth") this.emit({ type: "auth_ok", ha_version: "test" });
          else this.emit({ id: message.id, type: "result", success: true, result: [] });
        }
        close() {}
      }
      window.WebSocket = TestSocket;
    });

    // Seed only the canonical snapshot. Writing cd_entity_overrides after the
    // first page load would trigger the legacy write bridge and overwrite this
    // fixture with the already-initialized empty store before reload.
    await page.goto(`/legacy/${variant}`);
    await page.evaluate((state) => {
      localStorage.clear();
      localStorage.setItem("dm_dashboard_state", JSON.stringify(state));
    }, seedState);
    await page.reload();

    await Promise.race([
      page.waitForFunction(
        () =>
          window.__DASHBOARDMODERN_LEGACY_READY__ === true &&
          !!window.DashboardModernModules &&
          document.readyState !== "loading",
      ),
      earlyPageError,
    ]);
    await expect(
      page.locator('[role="alert"]', {
        hasText: "Errore durante il caricamento di DashboardModern",
      }),
    ).toHaveCount(0);
    /* Le voci del Report si aspettano, non si leggono al volo.
     *
     * `__DASHBOARDMODERN_LEGACY_READY__` dice che il guscio c'e', non che ha
     * gia' rifatto l'elenco: quello lo rifa' `cdRebuildReportDevices` da un
     * setTimeout a 2600 ms dall'apertura del socket. La lettura secca vinceva
     * la corsa su una macchina ferma e la perdeva con la suite intera addosso
     * — «Array []» al posto delle tre voci. Le stesse tre voci, aspettate. */
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            ED_DEVICES.map((device) => [device.name, device.icon, device.sensor]),
          ),
        { timeout: 20_000 },
      )
      .toEqual([
        ["Washer first", "🧺", "sensor.washer_month"],
        ["Pump second", "💧", "sensor.pump_month"],
        ["Manual third", "🔌", "sensor.manual_month"],
      ]);
    expect(
      await page.evaluate(() => {
        const state = window.DashboardModernModules.store.getState();
        const washer = state.sections.appliances.filter((item) => item.device_type === "lavatrice");
        return {
          schema: state.schema_version,
          count: washer.length,
          visual: [washer[0]?.visual_type, washer[0]?.visual_key],
        };
      }),
    ).toEqual({ schema: 4, count: 1, visual: ["asset", "lavatrice"] });
    expect(await page.evaluate(() => ED_DEVICES.some((item) => item.name === "Wallbox"))).toBe(
      false,
    );
    await page
      .locator("#setup-wizard")
      .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
    await expect(page.locator("#setup-wizard")).toHaveCount(0);
    await page.evaluate(() => {
      window.cdSyncPush = async () => {};
    });
    await expect(page.locator("#ed-modal")).toHaveCount(0);
    await page.evaluate(() => window.apriConfigEntita());
    await expect(page.locator('.ed-tab[data-tab="runtime"]')).toHaveCount(1);
    await page.locator('.ed-tab[data-tab="runtime"]').click();
    /* Una riga per voce, e il numero e' proprio la prova: se un'etichetta
     * tradotta torna vuota la sua chiave collassa, la riga sparisce senza
     * rumore, e solo il conto se ne accorge.
     *
     * Il conto e' passato da undici a dodici quando la plancia ha imparato a
     * dire da dove arrivano le sue parti — impacchettate o sciolte. Ci sono
     * volute quattro tornate di CI per capirlo, perche' il fallimento si
     * leggeva come una prova ballerina: cadeva sempre e solo qui, e sempre e
     * solo su uno shard. Non ballava affatto — contava giusto.
     *
     * Chi aggiunge una voce alza questo numero E la nomina qui sotto: cosi'
     * la prossima volta il conto si legge invece di sembrare capriccio. */
    await expect(page.locator("[data-runtime-diagnostics] .ed-row")).toHaveCount(12);
    await expect(page.locator("[data-runtime-diagnostics]")).toContainText("Integration version");
    /* La dodicesima. Vale in tutt'e due gli stati, che e' il punto: la riga
     * dice quale dei due, non presume. */
    await expect(page.locator("[data-runtime-diagnostics]")).toContainText(/impacchettati|sciolti/);
    await page.evaluate(() => window.editorSwitch("sez1"));
    await expect(page.locator('#ed-body[data-renderer="energy"]')).toBeVisible();
    await page.screenshot({ path: `test-results/${testInfo.project.name}-${variant}-energy.png` });
    // One picker per entity field, and each picker pointing at a field that is
    // really there. The field itself is behind the pencil now, so the row —
    // the picker — is what has to be on screen, not the raw id box.
    const pickerCounts = () =>
      page.locator("#ed-body").evaluate((body) => {
        const onScreen = (node) => Boolean(node) && node.getClientRects().length > 0;
        const pickers = [...body.querySelectorAll(".dm-entity-picker")].filter(onScreen);
        const fields = [...body.querySelectorAll("[data-entity-input]")].filter(
          (input) => onScreen(input) || onScreen(input.closest('[data-dm-entity-chip="true"]')),
        );
        return {
          inputs: fields.length,
          pickers: pickers.length,
          uniqueTargets: new Set(pickers.map((button) => button.dataset.entityTarget)).size,
          orphans: pickers.filter(
            (button) =>
              !body.querySelector(`[data-entity-input][id="${button.dataset.entityTarget}"]`),
          ).length,
        };
      });
    /* La rifinitura arriva un attimo dopo il pannello.
     *
     * I selettori li costruisce una passata che segue il disegno del pannello:
     * leggere il conteggio al primo colpo, su una macchina carica, coglie il
     * pannello gia' scritto e la passata ancora a meta'. L'invariante e' che si
     * assesti, non che sia vera al primo istante. */
    const assertPickerInvariant = async () => {
      await expect
        .poll(
          async () => {
            const counts = await pickerCounts();
            return counts.pickers === counts.inputs && counts.uniqueTargets === counts.inputs;
          },
          { message: "un selettore per campo, e ognuno punta a un campo che c'e'" },
        )
        .toBe(true);
      const counts = await pickerCounts();
      expect(counts.pickers).toBe(counts.inputs);
      expect(counts.uniqueTargets).toBe(counts.inputs);
      expect(counts.orphans).toBe(0);
    };
    await assertPickerInvariant();
    await clickStableButton(
      page,
      page.getByRole("button", { name: /IMPOSTAZIONI|SETTINGS/ }),
      testInfo,
    );
    await clickStableButton(
      page,
      page.getByRole("button", { name: /FLUSSI ED ENTITÀ|FLOWS & ENTITIES/ }),
      testInfo,
    );
    await assertPickerInvariant();
    await page.evaluate(() => window.editorSwitch("sez2"));
    await assertPickerInvariant();
    await page.locator("#ed-body").evaluate((body) => {
      body.scrollTop = body.scrollHeight;
    });
    await expect(page.locator("#ed-body")).toHaveJSProperty(
      "scrollTop",
      await page.locator("#ed-body").evaluate((body) => body.scrollTop),
    );
    expect(
      await page.locator("#ed-body").evaluate((body) => body.scrollWidth <= body.clientWidth + 1),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-ev-bottom.png`,
    });
    await page.evaluate(() => window.editorSwitch("sez1"));
    const housePower = page.locator('[data-energy-panel="flows"] input').first();
    await editEntityFieldByHand(page, "#dm-energy-house-power");
    await housePower.fill("sensor.house_power");
    await housePower.blur();
    await expect(page.locator("[data-energy-actions]")).toHaveAttribute("data-state", "dirty");
    await saveSection(page);
    await expect(page.locator("[data-energy-actions]")).toHaveAttribute("data-state", "success");
    await expect(page.locator('#ed-body[data-renderer="energy"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: /FLUSSI ED ENTITÀ|FLOWS & ENTITIES/ }),
    ).toBeVisible();
    await clickStableButton(page, page.getByRole("button", { name: /CARICHI|LOADS/ }), testInfo);
    const loads = await page.locator('[data-energy-panel="loads"]').innerHTML();
    // One card per circle under Home, in the order the flow draws them, and the
    // appliances live inside their own load instead of a separately bound group.
    const seeded = page.locator('[data-dm-load="load-seed"]');
    await expect(seeded).toHaveCount(1);
    await expect(seeded.locator(".dm-loads-preview-text b")).toHaveText("Seed pump");
    // The manual report row is not a circle and must not appear here.
    await expect(page.locator('[data-dm-load="manual-seed"]')).toHaveCount(0);

    await seeded.locator(".dm-loads-preview").click();
    await clickStableButton(page, seeded.locator("[data-dm-subload-add]"), testInfo);
    await seeded.locator("[data-dm-subload-name]").fill("Booster");
    await seeded.locator("[data-dm-subload-name]").blur();
    await expect(seeded.locator(".dm-loads-subload", { hasText: "Booster" })).toHaveCount(1);

    await clickStableButton(page, seeded.locator("[data-dm-subload-add]"), testInfo);
    await seeded.locator("[data-dm-subload-name]").fill("Temporary load");
    await seeded.locator("[data-dm-subload-name]").blur();
    const temporary = seeded.locator(".dm-loads-subload", { hasText: "Temporary load" });
    await expect(temporary).toHaveCount(1);
    await temporary.locator("[data-dm-subload-delete]").click();
    await expect(temporary).toHaveCount(0);

    // Saving goes through the canonical section, and the appliance is stored
    // inside the load that owns it.
    await saveSection(page);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window.DashboardModernModules?.store?.getSection("loads") || []).some(
            (item) =>
              item.name === "Booster" && item.metadata?.beta27_subload_group === "load-seed",
          ),
        ),
      )
      .toBe(true);
    await expect(page.locator("[data-dm-loads-save]")).toBeDisabled();
    await page.screenshot({ path: `test-results/${testInfo.project.name}-${variant}-loads.png` });
    await clickStableButton(page, page.getByRole("button", { name: "REPORT" }), testInfo);
    const report = await page.locator('[data-energy-panel="report"]').innerHTML();
    expect(report).not.toBe(loads);
    expect(report).toMatch(/Salva Report|Save Report/);
    expect(report).not.toContain("dm-load-category");
    await clickStableButton(page, page.locator("[data-report-add]"), testInfo);
    await showRawEntityFields(page);
    await page.locator("[data-manual-name]").fill("Manual water");
    await page.locator("#dm-manual-report-icon").fill("💧");
    await page.locator("#dm-manual-report-entity").fill("sensor.water_month");
    await page.locator("#dm-manual-report-history").fill("sensor.water_total");
    await clickStableButton(page, page.locator("[data-manual-confirm]"), testInfo);
    await expect(page.locator(".dm-report-row")).toHaveCount(4);
    let manual = page.locator(".dm-report-row").last();
    await expect(manual.locator('[data-report-name][value="Manual water"]')).toHaveCount(1);
    await expect(manual.locator(".dm-entity-picker")).toHaveCount(2);
    await expect(manual.locator(".dm-icon-picker")).toHaveCount(1);
    manual = page.locator(".dm-report-row").last();
    await expect(manual.locator("[data-report-up]")).toHaveCount(1);
    manual = page.locator(".dm-report-row").last();
    await expect(manual.locator("[data-report-down]")).toHaveCount(1);
    await expect(manual.locator("[data-report-delete]")).toHaveCount(1);
    const firstReport = page.locator(".dm-report-row").first();
    await firstReport.locator("[data-report-toggle]").check();
    await firstReport.locator("[data-report-label]").fill("Canonical label");
    // The entity row shows what is chosen and keeps the id behind the pencil.
    await showRawEntityFields(page);
    await firstReport.locator("[data-entity-field] input").first().fill("sensor.canonical_month");
    await saveSection(page);
    await expect(page.locator("[data-report-actions]")).toHaveAttribute("data-state", "success");
    await expect(page.locator('[data-energy-panel="report"]')).toBeVisible();
    // The popup mirror is derived from the loads on save: the appliance sits
    // under the load that owns it, with no group left to bind by hand.
    expect(
      await page.evaluate(() => {
        const groups = JSON.parse(localStorage.getItem("cd_subloads_extra") || "{}");
        return groups["load-seed"]?.some((item) => item.name === "Booster");
      }),
    ).toBe(true);
    await clickStableButton(page, page.getByRole("button", { name: /CARICHI|LOADS/ }), testInfo);
    await clickStableButton(page, page.getByRole("button", { name: "REPORT" }), testInfo);
    await expect(page.locator('[data-report-name][value="Manual water"]')).toHaveCount(1);
    await page.screenshot({ path: `test-results/${testInfo.project.name}-${variant}-report.png` });
    expect(
      await page.evaluate(() => ED_DEVICES.map((device) => [device.name, device.sensor])),
    ).toContainEqual(["Canonical label", "sensor.canonical_month"]);
    await expect(
      page.locator('#ed-dev-selector option[value="sensor.canonical_month"]'),
    ).toContainText("Canonical label");
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("dm_dashboard_state")).schema_version,
      ),
    ).toBe(4);
    await page.evaluate(() => window.editorSwitch("stanze"));
    await clickStableButton(
      page,
      page.locator('#ed-body button[title="Selettore icone"]'),
      testInfo,
    );
    const roomPicker = page.locator('#dm-visual-picker[data-kind="room"]');
    await expect(roomPicker).toBeVisible();
    await expect(roomPicker).toHaveAttribute("data-dm-beta17-picker", "room");
    const roomOptions = roomPicker.locator(".dm-beta17-room-option");
    expect(await roomOptions.count()).toBeGreaterThanOrEqual(20);
    /* Le stanze del selettore hanno il disegno di casa, non piu' l'emoji del
     * sistema: si cerca il nome del disegno. */
    for (const disegno of [
      "room-bedroom",
      "room-living",
      "oven",
      "room-bathroom",
      "room-office",
      "room-garage",
      "room-balcony",
      "washer",
    ]) {
      expect(
        await roomPicker.locator(`.dm-beta12-room-glyph [data-dm-art="${disegno}"]`).count(),
      ).toBeGreaterThanOrEqual(1);
    }
    const roomSearch = roomPicker.locator("[data-search]");
    await roomSearch.fill("bedroom");
    await expect(roomPicker.getByRole("button", { name: /Camera|Bedroom/i })).toBeVisible();
    await roomSearch.fill("camera");
    expect(
      await roomPicker.locator(".dm-beta17-room-option:not([hidden])").count(),
    ).toBeGreaterThanOrEqual(1);
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-room-picker.png`,
    });
    await clickStableButton(page, roomPicker.locator("[data-close]"), testInfo);
    await expect(roomPicker).toHaveCount(0);
    await page.evaluate(() => window.editorSwitch("luci"));
    await assertPickerInvariant();
    const lightAddEntity = page.locator("#ed-body [data-light-add-entity]");
    await expect(lightAddEntity).toHaveCount(1);
    // The id itself sits behind the pencil here as it does on every other
    // entity field: the row is what is on screen until the pencil is pressed.
    await expect(lightAddEntity).toBeHidden();
    await editEntityFieldByHand(page, "#ed-body [data-light-add-entity]");
    await expect(lightAddEntity).toBeVisible();
    await expect(lightAddEntity).toHaveAttribute("data-entity-input", "true");
    const lightAddEntityId = await lightAddEntity.getAttribute("id");
    expect(lightAddEntityId).toBeTruthy();
    await expect(
      page.locator(`#ed-body .dm-entity-picker[data-entity-target="${lightAddEntityId}"]`),
    ).toHaveCount(1);
    await page.screenshot({ path: `test-results/${testInfo.project.name}-${variant}-lights.png` });
    await page.evaluate(() => document.getElementById("editor-modal")?.remove());
    await page.waitForFunction(() => typeof window.apriConfigEntita === "function");
    await page.evaluate(() => window.apriConfigEntita());
    await page.evaluate(() => window.editorSwitch("luci"));
    await assertPickerInvariant();

    await page.evaluate(() => {
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-appliances-main")?.classList.add("active");
      window.renderApplianceSection(true);
    });
    const applianceCards = page.locator("#appl-grid-overview .appl-wide-card");
    await expect(applianceCards).toHaveCount(1);
    // Showcase card: the artwork/image lives in the hero.
    await expect(
      applianceCards
        .first()
        .locator(
          ".dm-ap-hero > .dm-hero-art svg, .dm-ap-hero > .dm-appliance-art svg, .dm-ap-hero > img.dm-ap-img",
        ),
    ).toHaveCount(1);
    expect(
      await applianceCards
        .first()
        .locator(".dm-ap-hero")
        .evaluate(
          (visual) =>
            visual.getBoundingClientRect().width > 0 &&
            visual.getBoundingClientRect().height > 0 &&
            !!visual.querySelector("svg,img"),
        ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${variant}-appliances.png`,
    });
    expect(errors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(fuori, "la plancia ha chiesto qualcosa alla rete").toEqual([]);
  });
}
