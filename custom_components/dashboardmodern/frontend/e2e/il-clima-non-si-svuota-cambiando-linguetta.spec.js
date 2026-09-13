/* «Al primo tocco su FREDDO/CALDO l'elenco delle card sparisce, e non torna
 * più — nemmeno tornando sulla linguetta di partenza» (#541).
 *
 * I numeri del riassunto continuano a essere giusti e ad aggiornarsi, quindi i
 * dati ci sono: è il disegno delle card che non arriva a schermo. Questa prova
 * fa esattamente i passi della segnalazione — apri, CALDO, FREDDO — e a ogni
 * passo conta le card della zona che si vede.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const base = {
  rooms: [],
  cameras: [],
  appliances: [],
  loads: [],
  lights: [],
  ev: [],
  covers: [],
  pool: {},
  irrigation: { zones: [] },
  energy: {},
  entityOverrides: {},
};

/* Tre condizionatori e dieci termosifoni: le due zone della segnalazione. */
const CLIMA = [
  ...[1, 2, 3].map((n) => ({
    entity: `climate.freddo_${n}`,
    name: `Freddo ${n}`,
    type: "clima",
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    entity: `climate.caldo_${i + 1}`,
    name: `Caldo ${i + 1}`,
    type: "termo",
  })),
];

const foto = (page) =>
  page.evaluate(() => {
    const shell = document.querySelector("#page-clima .dm-cl-shell");
    const zona = (nome) => {
      const nodo = document.querySelector(`.clima-zone-${nome}`);
      return {
        attaccata: Boolean(nodo?.isConnected),
        vista: Boolean(nodo?.classList.contains("show")),
        carte: nodo?.querySelectorAll(".dm-cl-card").length || 0,
      };
    };
    return {
      freddo: zona("freddo"),
      caldo: zona("caldo"),
      /* Quello che si vede davvero: le card della zona con `show`. */
      inVista: document.querySelectorAll(".clima-zone.show .dm-cl-card").length,
      accesi: shell?.querySelector("[data-dm-cl-running]")?.textContent || "",
      quante: {
        freddo: document.querySelectorAll(".clima-zone-freddo").length,
        caldo: document.querySelectorAll(".clima-zone-caldo").length,
      },
    };
  });

test("cambiando linguetta le card restano al loro posto", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, {
    schema_version: 4,
    sections: { ...base, climate: CLIMA },
    visibility: { clima: true },
  });
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-clima")?.classList.add("active");
    window.render?.();
  });
  await page.waitForFunction(
    () => Boolean(document.querySelector("#page-clima .dm-cl-shell")),
    null,
    {
      timeout: 15000,
    },
  );
  await page.waitForTimeout(900);

  const apertura = await foto(page);
  expect(apertura.inVista, "all'apertura il Freddo ha le sue tre card").toBe(3);

  await page.click("#page-clima .dm-cl-shell [data-dm-cl-zone='caldo']");
  await page.waitForTimeout(700);
  const suCaldo = await foto(page);
  expect(suCaldo.caldo.vista, "il Caldo si vede").toBe(true);
  expect(suCaldo.inVista, "sul Caldo si vedono le dieci card").toBe(10);

  await page.click("#page-clima .dm-cl-shell [data-dm-cl-zone='freddo']");
  await page.waitForTimeout(700);
  const tornato = await foto(page);
  expect(tornato.freddo.vista, "il Freddo torna a vedersi").toBe(true);
  expect(tornato.inVista, "tornando sul Freddo le card tornano").toBe(3);
});

/* Con le stanze configurate il disegno delle card cambia — intestazioni di
 * gruppo che occupano tutta la riga — ed è la forma in cui la segnalazione
 * dice di averlo visto. */
test("con le stanze configurate le card restano lo stesso", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, {
    schema_version: 4,
    sections: {
      ...base,
      rooms: [
        { id: "giorno", name: "Zona Giorno" },
        { id: "notte", name: "Zona Notte" },
      ],
      climate: CLIMA.map((unita, indice) => ({
        ...unita,
        room: indice % 2 ? "Zona Giorno" : "Zona Notte",
      })),
    },
    visibility: { clima: true },
  });
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-clima")?.classList.add("active");
    window.render?.();
  });
  await page.waitForFunction(
    () => Boolean(document.querySelector("#page-clima .dm-cl-shell")),
    null,
    {
      timeout: 15000,
    },
  );
  await page.waitForTimeout(900);
  expect((await foto(page)).inVista).toBe(3);

  await page.click("#page-clima .dm-cl-shell [data-dm-cl-zone='caldo']");
  await page.waitForTimeout(700);
  expect((await foto(page)).inVista, "sul Caldo si vedono le dieci card").toBe(10);

  await page.click("#page-clima .dm-cl-shell [data-dm-cl-zone='freddo']");
  await page.waitForTimeout(700);
  const tornato = await foto(page);
  expect(tornato.inVista, "tornando sul Freddo le card tornano").toBe(3);
  /* E una sola copia delle due zone nel documento: se ce ne fossero due, lo
   * `document.querySelector` del guscio ne sposterebbe una fuori schermo e in
   * pagina resterebbero due zone senza `show`. */
  expect(tornato.quante, "una zona per parte, non due").toEqual({ freddo: 1, caldo: 1 });
});
