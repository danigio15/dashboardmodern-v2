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
      /* Quello che si vede DAVVERO: non le card che stanno nel documento — di
       * quelle la segnalazione ne ha in pagina e non le vede — ma quelle che
       * occupano spazio e non sono trasparenti. */
      inVista: [...document.querySelectorAll(".clima-zone.show .dm-cl-card")].filter((carta) => {
        const r = carta.getBoundingClientRect();
        const stile = getComputedStyle(carta);
        return (
          r.height > 10 &&
          r.width > 10 &&
          stile.visibility !== "hidden" &&
          stile.display !== "none" &&
          Number(stile.opacity) > 0.05
        );
      }).length,
      scritte: document.querySelectorAll(".clima-zone.show .dm-cl-card").length,
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

/* Col «Stato termico (Caldo)» configurato — la casella «🔥 ZONA GIORNO ·
 * Spenta» che si vede nel video della segnalazione. È l'ingrediente che
 * mancava alle due prove qui sopra: compare solo sulla zona Caldo, e da lì in
 * poi l'elenco delle card non si vedeva più in nessuna delle due zone. */
test("con lo stato termico configurato le card non spariscono", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, {
    schema_version: 4,
    sections: { ...base, climate: CLIMA },
    visibility: { clima: true },
  });
  await page.evaluate(() => {
    /* La Gestione termica (#281): è da lì che nel video esce «ZONA GIORNO». */
    localStorage.setItem(
      "cd_caldaia",
      JSON.stringify([{ name: "Zona Giorno", stato: "switch.zona_giorno" }]),
    );
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
  expect((await foto(page)).inVista, "all'apertura il Freddo ha le sue tre card").toBe(3);

  await page.click("#page-clima .dm-cl-shell [data-dm-cl-zone='caldo']");
  await page.waitForTimeout(900);
  const suCaldo = await foto(page);
  await page.screenshot({ path: testInfo.outputPath("clima-caldo.png") });
  expect(suCaldo.inVista, "sul Caldo si vedono le dieci card").toBe(10);

  await page.click("#page-clima .dm-cl-shell [data-dm-cl-zone='freddo']");
  await page.waitForTimeout(900);
  const tornato = await foto(page);
  await page.screenshot({ path: testInfo.outputPath("clima-freddo.png") });
  expect(tornato.inVista, "tornando sul Freddo le card tornano").toBe(3);
});

/* E se qualcuno la svuota lo stesso, il vuoto non è per sempre.
 *
 * È il pezzo che il video mostra e che qui non si riesce a far succedere: le
 * card spariscono e non tornano più, nemmeno tornando sulla linguetta di
 * partenza. Il «non tornano più» era la firma appiccicata al nodo, che
 * continuava a dire «già fatto» sopra una griglia svuotata da altri. Qui la
 * griglia si svuota a mano — è il gesto di chiunque sia il colpevole — e si
 * guarda se al giro dopo torna. */
test("una griglia svuotata da fuori si ridisegna al giro dopo", async ({ page }, testInfo) => {
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
  expect((await foto(page)).inVista).toBe(3);

  /* Qualcun altro passa e riscrive le due griglie. */
  const svuotate = await page.evaluate(() => {
    for (const id of ["clima-grid-freddo", "clima-grid-caldo"]) {
      const grid = document.getElementById(id);
      if (grid) grid.innerHTML = "";
    }
    return document.querySelectorAll(".clima-zone.show .dm-cl-card").length;
  });
  expect(svuotate, "la griglia è davvero vuota").toBe(0);

  /* Il giro dopo la rimette a posto. È la strada che la rete del guscio
   * percorre ogni venti secondi — `updateClimaCards()` — e che prima trovava
   * la firma a dire «già fatto» sopra il vuoto. */
  await page.evaluate(() => window.updateClimaCards?.());
  await page.waitForTimeout(700);
  expect((await foto(page)).inVista, "le card tornano da sole").toBe(3);

  await page.click("#page-clima .dm-cl-shell [data-dm-cl-zone='caldo']");
  await page.waitForTimeout(700);
  expect((await foto(page)).inVista, "e il Caldo ha le sue").toBe(10);
});
