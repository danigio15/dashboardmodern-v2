import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Le tende, accanto alle tapparelle.
 *
 * La sezione disegnava una finestra con la tapparella che scende, perche' era
 * la sola cosa che sapeva esserci. Una tenda pero' non scende: si apre di lato,
 * in due teli che si scostano dal centro. Chi non sceglie niente non deve
 * scegliere: la classe che Home Assistant da' all'entita' lo dice gia'.
 */
const stati = {
  "cover.tapparella_camera": {
    entity_id: "cover.tapparella_camera",
    state: "open",
    attributes: { device_class: "shutter", current_position: 100, supported_features: 15 },
  },
  "cover.tenda_salotto": {
    entity_id: "cover.tenda_salotto",
    state: "open",
    attributes: { device_class: "curtain", current_position: 40, supported_features: 15 },
  },
  "cover.senza_classe": {
    entity_id: "cover.senza_classe",
    state: "closed",
    attributes: { current_position: 0, supported_features: 15 },
  },
};

const seme = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [
      { id: "c1", name: "Camera", entity: "cover.tapparella_camera" },
      { id: "c2", name: "Salotto", entity: "cover.tenda_salotto" },
      { id: "c3", name: "Senza classe", entity: "cover.senza_classe" },
    ],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, tapparelle: true },
};

async function semina(page) {
  await page.evaluate((valori) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...valori } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, valori);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, stati);
}

const apri = (page) =>
  page.evaluate(() => {
    document.querySelectorAll(".page").forEach((nodo) => nodo.classList.remove("active"));
    document.getElementById("page-tapparelle")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });

const carta = (page, entity) => page.locator(`[data-dm-shutter-card][data-tapp="${entity}"]`);

test.describe("tende e tapparelle", () => {
  test("ognuna e' disegnata per quello che e'", async ({ page }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
    await semina(page);
    await apri(page);

    await expect(page.locator("[data-dm-shutter-card]")).toHaveCount(3);

    // La tapparella scende: una fascia sola, alta quanto la parte coperta.
    const tapparella = carta(page, "cover.tapparella_camera");
    await expect(tapparella).toHaveAttribute("data-dm-cover-kind", "tapparella");
    await expect(tapparella.locator(".tapp-shutter")).toHaveCount(1);
    await expect(tapparella.locator(".dm-tenda")).toHaveCount(0);

    // La tenda si scosta: due teli, ognuno largo meta' della parte coperta.
    const tenda = carta(page, "cover.tenda_salotto");
    await expect(tenda).toHaveAttribute("data-dm-cover-kind", "tenda");
    await expect(tenda.locator(".dm-tenda-telo")).toHaveCount(2);
    await expect(tenda.locator(".tapp-shutter")).toHaveCount(0);
    await expect
      .poll(() =>
        tenda
          .locator(".dm-tenda")
          .evaluate((nodo) => nodo.style.getPropertyValue("--tenda-chiusa")),
      )
      .toBe("30%");

    // Senza classe resta com'era: una tapparella, che e' cio' che la sezione
    // ha sempre disegnato.
    await expect(carta(page, "cover.senza_classe")).toHaveAttribute(
      "data-dm-cover-kind",
      "tapparella",
    );
  });

  test("la matita apre le caselle, e la scelta vecchia non si perde", async ({
    page,
  }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    /* Una riga vecchia: il tipo lo dichiarava il menu, che ora non c'e' piu'.
     * Deve continuare a uscire come tenda, e deve restare una tenda anche dopo
     * che la matita l'ha salvata. */
    const semeVecchio = {
      ...seme,
      sections: {
        ...seme.sections,
        covers: [{ id: "c1", name: "Camera", entity: "cover.tapparella_camera", kind: "tenda" }],
      },
    };
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, semeVecchio);
    await semina(page);
    await apri(page);
    await expect(carta(page, "cover.tapparella_camera")).toHaveAttribute(
      "data-dm-cover-kind",
      "tenda",
    );

    await page.evaluate(() => {
      window.apriConfigEntita();
      window.editorSwitch("tapp");
    });
    await page.locator('[data-dm-edit-kind="shutter"][data-dm-edit-index="0"]').first().click();
    const modale = page.locator("#dm-shutter-editor-modal");
    await expect(modale).toBeVisible();

    // Il menu del tipo non c'e' piu': al suo posto ci sono le caselle.
    await expect(modale.locator("select[name=kind]")).toHaveCount(0);
    await expect(modale.locator("input[name=entity]")).toHaveValue("cover.tapparella_camera");
    await expect(modale.locator("input[name=tenda]")).toHaveCount(1);
    await expect(modale.locator("input[name=tendaSole]")).toHaveCount(1);
    await expect(modale.locator("input[name=contact]")).toHaveCount(1);

    // Si aggiunge la tenda da sole dello stesso infisso e si salva. Le caselle
    // entita' stanno dietro il chip, come tutte le altre: si scrive nel campo.
    await modale.locator("input[name=tendaSole]").evaluate((campo) => {
      campo.value = "cover.tenda_sole_camera";
      campo.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await modale.locator("form").evaluate((form) => form.requestSubmit());

    await apri(page);
    await semina(page);
    /* La scelta di prima e' ancora li' — la card e' una sola (stesso infisso,
     * due coperture) e la principale resta una tenda... */
    const infisso = carta(page, "cover.tapparella_camera");
    await expect(infisso).toHaveAttribute("data-dm-cover-kind", "tenda");
    await expect(infisso).toHaveAttribute("data-dm-covers", "2");
    /* ...e la casella nuova ha portato il suo telo e la sua barra, col suo
     * tipo. Il cursore trascinabile arriva solo quando l'entita' dichiara
     * SET_POSITION — questa non ha ancora uno stato, quindi la barra e'
     * statica, ma e' comunque SUA. */
    await expect(infisso.locator(".dm-tendasole")).toHaveCount(1);
    await expect(infisso.locator('[data-dm-bar="cover.tenda_sole_camera"]')).toHaveCount(1);
  });
});
