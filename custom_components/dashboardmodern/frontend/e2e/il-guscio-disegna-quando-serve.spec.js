/* Il guscio disegna quando serve, non a ogni battito.
 *
 * Dal campo: «le vecchie sezioni sotto che vengono sovrascritte», e il
 * telefono che si scalda. Il runtime vendorizzato ridisegnava tutto a ogni
 * cambio di stato di casa — anche a scheda nascosta —, riscriveva la finestra
 * dei dettagli con gli stessi stati, teneva accesi per sempre una ventina di
 * timer che un modulo fa gia', apriva una seconda presa dopo ogni caduta e
 * faceva girare le particelle della ricarica su una pagina che nessuno
 * guardava. Qui si prova, sulla plancia vera, che ognuna di quelle cose ha un
 * padrone solo e lavora solo quando qualcuno guarda.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [{ id: "c1", name: "Salone", entity: "climate.salone", type: "clima" }],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, clima: true, security: true },
};

const TIMER_SPENTI = [
  "auto",
  "auto-nascondi",
  "barra",
  "clima",
  "dispositivi",
  "inverter",
  "irrigazione",
  "orologi",
  "piscina",
  "ponte-elettrodomestici",
  "tapparelle",
];

const attendi = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    /* Una presa finta che sa emettere cambi di stato a comando e cadere. */
    window.__dmPrese = [];
    class PresaFinta extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      constructor() {
        super();
        this.readyState = 1;
        this.onopen = null;
        this.onmessage = null;
        this.onclose = null;
        window.__dmPrese.push(this);
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_required" }) });
        });
      }
      send(raw) {
        const messaggio = JSON.parse(raw);
        /* La presa principale e' quella che si abbona agli stati: il guscio
         * ne apre altre, di passaggio, per leggere i registri. */
        if (messaggio.type === "subscribe_events") this.principale = true;
        if (messaggio.type === "auth") {
          queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) }));
          return;
        }
        let result = null;
        if (messaggio.type === "get_states") {
          result = [
            {
              entity_id: "climate.salone",
              state: "cool",
              attributes: { temperature: 24, current_temperature: 26, friendly_name: "Salone" },
            },
          ];
        }
        if (messaggio.type === "frontend/get_user_data") result = { value: null };
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({ id: messaggio.id, type: "result", success: true, result }),
          }),
        );
      }
      close() {
        if (this.readyState === 3) return;
        this.readyState = 3;
        queueMicrotask(() => this.onclose?.({ code: 1000 }));
      }
      cadi() {
        this.readyState = 3;
        this.onclose?.({ code: 1006 });
      }
      emetti(entity_id, state, attributes = {}) {
        this.onmessage?.({
          data: JSON.stringify({
            type: "event",
            event: {
              event_type: "state_changed",
              data: {
                entity_id,
                new_state: { entity_id, state, attributes, last_updated: new Date().toISOString() },
              },
            },
          }),
        });
      }
    }
    window.WebSocket = PresaFinta;
    /* La presa del runtime, e non l'ultima aperta: `ws` e' una variabile
     * lessicale del guscio, e nella plancia ospitata e' avvolta
     * dall'adattatore del preludio, che tiene quella vera in
     * `__dmInnerSocket`. */
    window.__dmPresa = () => {
      const esterna = window.eval("typeof ws !== 'undefined' && ws ? ws : null");
      return esterna?.__dmInnerSocket || esterna;
    };
    window.__dmPresePrincipali = () => window.__dmPrese.filter((presa) => presa.principale).length;
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(
    () =>
      window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed === true &&
      window.cdRenderSoon?.__dmQuandoServe === true &&
      document.getElementById("live-dot")?.classList.contains("connected"),
    null,
    { timeout: 60_000 },
  );
  // L'avvio fa i suoi disegni: si aspetta che abbia finito.
  await page.waitForTimeout(1500);
}

/* Conta i render del guscio per la durata di `prova`. */
async function contaIDisegni(page, prova) {
  return page.evaluate(async (corpo) => {
    const originale = window.render;
    let disegni = 0;
    window.render = function contato(...args) {
      disegni += 1;
      return originale.apply(this, args);
    };
    try {
      // eslint-disable-next-line no-new-func
      return await new Function("attendi", "conta", `return (${corpo})()`)(
        (ms) => new Promise((ok) => setTimeout(ok, ms)),
        () => disegni,
      );
    } finally {
      window.render = originale;
    }
  }, prova.toString());
}

test("una raffica di eventi fa un disegno solo, mezzo secondo dopo", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const esito = await contaIDisegni(page, async () => {
    const presa = window.__dmPresa();
    for (let evento = 0; evento < 50; evento += 1)
      presa.emetti(`sensor.altro_${evento % 5}`, `${evento}`);
    await attendi(150);
    const presto = conta();
    await attendi(700);
    return { presto, dopo: conta() };
  });
  expect(esito.presto, "durante la raffica non si disegna").toBe(0);
  expect(esito.dopo, "allo scadere del passo si disegna una volta").toBe(1);
});

test("a scheda nascosta non si disegna; al ritorno si disegna una volta", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const esito = await contaIDisegni(page, async () => {
    const scheda = (stato) => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => stato });
      document.dispatchEvent(new Event("visibilitychange"));
    };
    try {
      scheda("hidden");
      const presa = window.__dmPresa();
      for (let evento = 0; evento < 20; evento += 1)
        presa.emetti(`sensor.altro_${evento}`, `${evento}`);
      await attendi(800);
      const alBuio = conta();
      scheda("visible");
      await attendi(300);
      return { alBuio, alRitorno: conta() };
    } finally {
      delete document.visibilityState;
    }
  });
  expect(esito.alBuio).toBe(0);
  expect(esito.alRitorno).toBe(1);
});

test("i timer del guscio che un modulo fa gia' sono spenti, gli altri restano", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const timer = await page.evaluate(() =>
    (window.__DASHBOARDMODERN_LEGACY_INTERVALS__ || []).map((voce) => ({
      period: voce.period,
      cleared: voce.cleared,
      owner: voce.owner || "",
    })),
  );
  expect(
    timer
      .filter((voce) => voce.cleared)
      .map((voce) => voce.owner)
      .sort(),
  ).toEqual(TIMER_SPENTI);
  // Il programma dell'irrigazione e il conto della piscina, ogni trenta secondi.
  expect(timer.filter((voce) => voce.period === 30000 && !voce.cleared)).toHaveLength(2);
  // La barra non viene piu' riletta ogni tre secondi da un timer.
  const giriDellaBarra = await page.evaluate(async () => {
    const prima = window.__CD_NVRUN;
    await new Promise((ok) => setTimeout(ok, 3600));
    return window.__CD_NVRUN - prima;
  });
  expect(giriDellaBarra).toBe(0);
});

test("la pagina Clima non si ridipinge da Home, e si dipinge quando si apre", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const esito = await page.evaluate(async () => {
    const clima = document.getElementById("page-clima");
    const dentro = (nodo) =>
      Boolean(nodo?.closest?.(".dm-cl-shell")) ||
      Boolean(nodo?.classList?.contains?.("dm-cl-shell")) ||
      Boolean(nodo?.querySelector?.(".dm-cl-shell"));
    let scritture = 0;
    const osservatore = new MutationObserver((mutazioni) => {
      for (const m of mutazioni) {
        if (dentro(m.target) || [...m.addedNodes].some(dentro)) scritture += 1;
      }
    });
    osservatore.observe(clima, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    window
      .__dmPresa()
      .emetti("climate.salone", "heat", { temperature: 22, current_temperature: 19 });
    await new Promise((ok) => setTimeout(ok, 900));
    const daHome = scritture;
    document.querySelector('.tab[data-tab="clima"]')?.click();
    await new Promise((ok) => setTimeout(ok, 400));
    osservatore.disconnect();
    return {
      daHome,
      aperta: scritture,
      carte: clima.querySelectorAll(".dm-cl-card").length,
      attiva: clima.classList.contains("active"),
    };
  });
  expect(esito.attiva).toBe(true);
  expect(esito.daHome, "da Home la pagina Clima non si tocca").toBe(0);
  expect(esito.aperta, "aperta, si dipinge").toBeGreaterThan(0);
  expect(esito.carte).toBeGreaterThan(0);
});

test("la finestra dei dettagli non si riscrive con gli stessi stati", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  /* Il gruppo `clima` del Quadro Avvisi si riempie come farebbe il guscio,
   * dentro la sua portata lessicale. */
  await page.evaluate(() =>
    window.eval(
      "if (!GRUPPI_MONITORAGGIO['clima'].includes('climate.salone')) GRUPPI_MONITORAGGIO['clima'].push('climate.salone')",
    ),
  );
  const esito = await page.evaluate(async () => {
    window.apriDettagli(null, "clima");
    await new Promise((ok) => setTimeout(ok, 100));
    const lista = document.getElementById("details-list");
    let scritture = 0;
    const osservatore = new MutationObserver((m) => {
      scritture += m.length;
    });
    osservatore.observe(lista, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    // Due giri del guscio a stati fermi: la lista non si tocca.
    window.render();
    window.render();
    await new Promise((ok) => setTimeout(ok, 100));
    const ferme = scritture;
    // Uno stato del gruppo cambia: la lista si riscrive.
    window
      .__dmPresa()
      .emetti("climate.salone", "heat", { temperature: 21, friendly_name: "Salone" });
    await new Promise((ok) => setTimeout(ok, 900));
    osservatore.disconnect();
    return {
      ferme,
      dopoIlCambio: scritture,
      righe: lista.querySelectorAll(".detail-row").length,
      aperta: document.getElementById("details-modal").classList.contains("show"),
      testo: lista.textContent,
    };
  });
  expect(esito.aperta).toBe(true);
  expect(esito.righe).toBe(1);
  expect(esito.ferme, "a stati fermi la finestra non si riscrive").toBe(0);
  expect(esito.dopoIlCambio, "con uno stato cambiato si riscrive").toBeGreaterThan(0);
  expect(esito.testo).toMatch(/Riscalda|HEAT/i);
});

test("l'ora sulle telecamere gira solo con la Sicurezza aperta", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const esito = await page.evaluate(async () => {
    const stato = window.__DASHBOARDMODERN_GUSCIO_QUANDO_SERVE__;
    const daHome = stato.orologio;
    document.querySelector('.tab[data-tab="security"]')?.click();
    await new Promise((ok) => setTimeout(ok, 150));
    const inSicurezza = stato.orologio;
    document.querySelector('.tab[data-tab="home"]')?.click();
    await new Promise((ok) => setTimeout(ok, 150));
    return { daHome, inSicurezza, tornati: stato.orologio };
  });
  expect(esito.daHome).toBe(0);
  expect(esito.inSicurezza).not.toBe(0);
  expect(esito.tornati).toBe(0);
});

test("dopo una caduta si riapre una presa sola, e il timer del guscio non nasce", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const esito = await page.evaluate(async () => {
    const prima = window.__dmPresePrincipali();
    window.__dmPresa().cadi();
    /* Sette secondi: oltre i due della sezione e i cinque del guscio. Con due
     * padroni qui ci sarebbero due prese nuove. */
    await new Promise((ok) => setTimeout(ok, 7000));
    return {
      nuove: window.__dmPresePrincipali() - prima,
      spenti: window.__DASHBOARDMODERN_CONNECTION_RECOVERY__.legacyTimersCancelled,
      connessa: document.getElementById("live-dot").classList.contains("connected"),
      padrone: window.connect?.__dmConnectionRecovery === true,
    };
  });
  expect(esito.padrone).toBe(true);
  expect(esito.spenti).toBeGreaterThanOrEqual(1);
  expect(esito.nuove).toBe(1);
  expect(esito.connessa).toBe(true);
});

test("le particelle della ricarica non girano fuori dalla pagina EV", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const esito = await page.evaluate(async () => {
    /* Nella pagina, come quella vera: il giro del guscio misura il genitore. */
    const tela = document.createElement("canvas");
    document.getElementById("page-ev")?.appendChild(tela);
    const originale = window.requestAnimationFrame;
    let fotogrammi = 0;
    window.requestAnimationFrame = (fn) => {
      if (String(fn).includes("_animRunning")) fotogrammi += 1;
      return originale.call(window, fn);
    };
    try {
      tela._animRunning = true;
      window.lmStartParticles(tela); // da Home, come fa render()
      await new Promise((ok) => setTimeout(ok, 120));
      const daHome = { gira: tela._animRunning, fotogrammi };
      document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
      document.getElementById("page-ev")?.classList.add("active");
      tela._animRunning = true;
      window.lmStartParticles(tela);
      await new Promise((ok) => setTimeout(ok, 120));
      const inEv = { fotogrammi };
      tela._animRunning = false;
      return { avvolto: window.lmStartParticles.__dmQuandoServe === true, daHome, inEv };
    } finally {
      window.requestAnimationFrame = originale;
      tela.remove();
      document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
      document.getElementById("page-home")?.classList.add("active");
    }
  });
  expect(esito.avvolto).toBe(true);
  expect(esito.daHome.gira).toBe(false);
  expect(esito.daHome.fotogrammi).toBe(0);
  expect(esito.inEv.fotogrammi).toBeGreaterThan(0);
});
