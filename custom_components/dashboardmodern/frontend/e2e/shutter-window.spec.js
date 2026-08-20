/* La tapparella sta fuori, l'infisso si vede da dentro.
 *
 * La card mostrava una tapparella senza finestra. Si guarda invece dalla stanza,
 * e allora in primo piano c'e' sempre l'infisso — telaio, due ante, maniglia —
 * con la tapparella che scende dietro. E un infisso puo' essere aperto: un
 * contatto sull'anta lo dice, e le ante rientrano verso i loro cardini.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEED = {
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
      { id: "c1", name: "Camera", entity: "cover.c1", contact: "binary_sensor.finestra_camera" },
      { id: "c2", name: "Salone", entity: "cover.c2" },
    ],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, tapparelle: true },
};

const STATES = [
  {
    entity_id: "cover.c1",
    state: "open",
    attributes: { friendly_name: "Camera", current_position: 100, supported_features: 15 },
  },
  {
    entity_id: "cover.c2",
    state: "closed",
    attributes: { friendly_name: "Salone", current_position: 0, supported_features: 15 },
  },
  {
    entity_id: "binary_sensor.finestra_camera",
    state: "on",
    attributes: { friendly_name: "Finestra camera", device_class: "window" },
  },
];

async function apriTapparelle(page, testInfo) {
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEED);
  await page.waitForFunction(
    () => Boolean(document.getElementById("dm-shutter-window-style")),
    null,
    { timeout: 15000 },
  );
  await page.evaluate((states) => {
    const raw = eval("_RAW_STATES");
    for (const entry of states) raw[entry.entity_id] = entry;
  }, STATES);
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-tapparelle").classList.add("active");
    globalThis.renderTapparelle?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await page.waitForTimeout(600);
}

function carte(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("#page-tapparelle .tapp-card[data-tapp]")].map((card) => {
      const vano = card.querySelector(".tapp-win");
      const anta = vano?.querySelector(".dm-tw-anta-sx");
      return {
        tapp: card.getAttribute("data-tapp"),
        infisso: Boolean(vano?.querySelector(".dm-tw-infisso .dm-tw-telaio")),
        ante: vano?.querySelectorAll(".dm-tw-anta").length || 0,
        maniglia: Boolean(vano?.querySelector(".dm-tw-maniglia")),
        stato: vano?.dataset.dmInfissoStato || "",
        // L'anta aperta si stringe verso il suo cardine.
        stretta: anta ? getComputedStyle(anta).transform !== "none" : false,
        pastiglia: card.querySelector(".dm-tw-pill")?.textContent?.trim() || "",
      };
    }),
  );
}

test("l'infisso sta in primo piano su ogni tapparella", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await apriTapparelle(page, testInfo);
  const lista = await carte(page);
  expect(lista.length).toBe(2);
  for (const carta of lista) {
    expect(carta.infisso, `${carta.tapp} ha il telaio`).toBe(true);
    expect(carta.ante, `${carta.tapp} ha due ante`).toBe(2);
    expect(carta.maniglia, `${carta.tapp} ha la maniglia`).toBe(true);
  }

  // E l'infisso sta davanti alla tapparella, non dietro: e' la tapparella a
  // stare fuori.
  const ordine = await page.evaluate(() => {
    const vano = document.querySelector("#page-tapparelle .tapp-win");
    const z = (selector) => Number(getComputedStyle(vano.querySelector(selector)).zIndex) || 0;
    return { infisso: z(".dm-tw-infisso"), tapparella: z(".tapp-shutter") };
  });
  expect(ordine.infisso).toBeGreaterThan(ordine.tapparella);
});

test("il contatto apre la finestra, e solo quella che ce l'ha", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await apriTapparelle(page, testInfo);

  let lista = await carte(page);
  const conSensore = lista.find((carta) => carta.tapp === "cover.c1");
  const senzaSensore = lista.find((carta) => carta.tapp === "cover.c2");
  expect(conSensore.stato).toBe("aperto");
  expect(conSensore.stretta, "l'anta rientra verso il cardine").toBe(true);
  expect(conSensore.pastiglia).toBe("Finestra aperta");
  // Chi non ha il contatto resta chiuso e non guadagna una pastiglia.
  expect(senzaSensore.stato).toBe("chiuso");
  expect(senzaSensore.pastiglia).toBe("");

  // Si chiude la finestra: la card la segue.
  await page.evaluate(() => {
    const raw = eval("_RAW_STATES");
    raw["binary_sensor.finestra_camera"] = {
      ...raw["binary_sensor.finestra_camera"],
      state: "off",
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await expect
    .poll(async () => (await carte(page)).find((carta) => carta.tapp === "cover.c1")?.stato)
    .toBe("chiuso");
  lista = await carte(page);
  expect(lista.find((carta) => carta.tapp === "cover.c1").pastiglia).toBe("");
});

test("il sensore si configura dove si configura la tapparella", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await apriTapparelle(page, testInfo);
  const esito = await page.evaluate(async () => {
    globalThis.apriConfigEntita?.();
    await new Promise((resolve) => setTimeout(resolve, 800));
    document.querySelector('#editor-modal .ed-tab[data-tab="tapp"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 900));
    const campo = document.getElementById("ed-tp-contact");
    if (!campo) return { campo: false };

    // Si compila come si compila a mano, e si aggiunge la tapparella.
    document.getElementById("ed-tp-name").value = "Bagno";
    document.getElementById("ed-tp-ent").value = "cover.c3";
    campo.value = "binary_sensor.finestra_bagno";
    globalThis.edTappAdd?.();
    await new Promise((resolve) => setTimeout(resolve, 500));
    /* Si guarda dove il disegno va a leggere: il modello canonico se c'e' gia',
     * altrimenti la copia in localStorage. Il modello si allinea con i suoi
     * tempi, e chiedere solo a lui vorrebbe dire misurare la sincronizzazione
     * invece del salvataggio. */
    const canoniche = globalThis.DashboardModernModules?.store?.getSection?.("covers") || [];
    const chiave = Object.keys(localStorage).find((name) => name.endsWith("cd_tapparelle"));
    let copia = [];
    try {
      copia = JSON.parse(localStorage.getItem(chiave || "cd_tapparelle") || "[]");
    } catch (_error) {}
    const trova = (elenco) => elenco.find((item) => item?.entity === "cover.c3");
    const nuova = trova(canoniche) || trova(copia) || null;
    return {
      campo: true,
      // Il campo riceve il trattamento di tutti gli altri campi entita':
      // la pastiglia che apre il catalogo, la matita e il cestino. Non si
      // controlla la lente com'e' nata, perche' proprio quella decorazione la
      // trasforma; si controlla che sia arrivata.
      vestito: Boolean(campo.closest('[data-dm-entity-chip="true"]')),
      pastiglia: Boolean(campo.closest(".ed-form-row")?.querySelector(".dm-slot-chip")),
      contatto: nuova?.contact || "",
      nome: nuova?.name || "",
    };
  });
  expect(esito.campo, "il campo esiste nella scheda Tapparelle").toBe(true);
  expect(esito.vestito, "il campo e' vestito come gli altri campi entita'").toBe(true);
  expect(esito.pastiglia, "e ha la pastiglia che apre il catalogo").toBe(true);
  expect(esito.nome).toBe("Bagno");
  // E quello che si e' scritto si ritrova dove il disegno lo va a leggere.
  expect(esito.contatto).toBe("binary_sensor.finestra_bagno");
});

/* La matita apre il suo editor, e il contatto dev'essere anche li'.
 *
 * Le matite delle righe sono intercettate in fase di cattura da un altro
 * modulo, che apre la propria finestra di modifica: quella con nome, entita' e
 * stanza. Il campo aggiunto al modulo di aggiunta non passa da li', quindi
 * senza questo un contatto sbagliato non si poteva ne' correggere ne' togliere
 * — si poteva solo cancellare la tapparella e rifarla.
 */
test("il contatto si modifica anche dalla matita", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await apriTapparelle(page, testInfo);
  const esito = await page.evaluate(async () => {
    globalThis.apriConfigEntita?.();
    await new Promise((resolve) => setTimeout(resolve, 800));
    document.querySelector('#editor-modal .ed-tab[data-tab="tapp"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 900));

    // La matita della prima tapparella, quella che il contatto ce l'ha gia'.
    const matita = document.querySelector("#ed-body .ed-row .dm-edit-existing");
    matita?.click();
    await new Promise((resolve) => setTimeout(resolve, 700));
    const form = document.querySelector("#dm-shutter-editor-modal form");
    if (!form?.elements?.contact) return { campo: false };
    const partenza = form.elements.contact.value;

    form.elements.contact.value = "binary_sensor.finestra_nuova";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 700));

    const leggi = () => {
      const canoniche = globalThis.DashboardModernModules?.store?.getSection?.("covers") || [];
      const chiave = Object.keys(localStorage).find((name) => name.endsWith("cd_tapparelle"));
      let copia = [];
      try {
        copia = JSON.parse(localStorage.getItem(chiave || "cd_tapparelle") || "[]");
      } catch (_error) {}
      const trova = (elenco) => elenco.find((item) => item?.entity === "cover.c1");
      return trova(canoniche)?.contact ?? trova(copia)?.contact ?? "";
    };
    return { campo: true, partenza, dopo: leggi() };
  });

  expect(esito.campo, "la finestra di modifica ha il campo del contatto").toBe(true);
  // Ci arriva gia' compilato con quello che c'era.
  expect(esito.partenza).toBe("binary_sensor.finestra_camera");
  // E quello che si scrive si salva.
  expect(esito.dopo).toBe("binary_sensor.finestra_nuova");
});
