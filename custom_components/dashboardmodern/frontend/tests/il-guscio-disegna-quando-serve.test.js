/* Il guscio disegna quando serve, non a ogni battito.
 *
 * Il runtime vendorizzato ridisegnava tutto a ogni cambio di stato di casa,
 * riscriveva la finestra dei dettagli con gli stessi stati, teneva accesi una
 * ventina di timer per sempre e faceva girare le particelle della ricarica su
 * una pagina che nessuno guardava. Qui si prova che ognuna di quelle cose ha
 * un padrone solo e che lavora solo quando qualcuno guarda.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const RUNTIME = readFileSync(new URL("../legacy/dashboard-runtime-it.js", import.meta.url), "utf8");
const RUNTIME_EN = readFileSync(
  new URL("../legacy/dashboard-runtime-en.js", import.meta.url),
  "utf8",
);
const SECTION_RUNTIME = readFileSync(
  new URL("../src/sections/section-runtime.js", import.meta.url),
  "utf8",
);

/* Un documento finto — pagine con la loro classe, la finestra dei dettagli,
 * la visibilita' della scheda — messo PRIMA dell'import: shared.js legge
 * `document` una volta sola. */
const pagine = new Map();
function pagina(id) {
  if (!pagine.has(id)) {
    const classi = new Set();
    pagine.set(id, {
      id,
      classList: {
        contains: (c) => classi.has(c),
        add: (c) => classi.add(c),
        remove: (c) => classi.delete(c),
      },
    });
  }
  return pagine.get(id);
}
const ascoltiDelDocumento = new Map();
const documento = {
  visibilityState: "visible",
  readyState: "complete",
  finestraAperta: false,
  getElementById(id) {
    if (id === "details-modal") {
      return { classList: { contains: (c) => c === "show" && documento.finestraAperta } };
    }
    return pagina(id);
  },
  addEventListener(type, fn) {
    ascoltiDelDocumento.set(type, fn);
  },
};
globalThis.document = documento;
const ascoltiDellaFinestra = new Map();
globalThis.addEventListener = (type, fn) => {
  ascoltiDellaFinestra.set(type, [...(ascoltiDellaFinestra.get(type) || []), fn]);
};
globalThis.dispatchEvent = (evento) => {
  for (const fn of ascoltiDellaFinestra.get(evento.type) || []) fn(evento);
  return true;
};

/* Orologi finti: i timer si prendono in mano e si fanno scattare a comando. */
const timer = { attese: [], intervalli: [], fotogrammi: [], cancellati: [] };
let prossimo = 1;
globalThis.setTimeout = (fn, ms) => {
  timer.attese.push({ id: prossimo, fn, ms });
  return prossimo++;
};
globalThis.clearTimeout = (id) => timer.cancellati.push(id);
globalThis.setInterval = (fn, ms) => {
  timer.intervalli.push({ id: prossimo, fn, ms });
  return prossimo++;
};
globalThis.clearInterval = (id) => timer.cancellati.push(id);
globalThis.requestAnimationFrame = (fn) => {
  timer.fotogrammi.push({ id: prossimo, fn });
  return prossimo++;
};

const {
  RITARDO_DEL_DISEGNO_MS,
  TIMER_DEL_GUSCIO,
  fermaLeParticelle,
  firmaDellaFinestra,
  potaITimerDelGuscio,
  richiediDisegno,
  riprendiLeParticelle,
  sincronizzaIrrigazione,
  sincronizzaOrologi,
  sincronizzaPiscina,
} = await import("../src/sections/il-guscio-disegna-quando-serve-section.js");
const stato = globalThis.__DASHBOARDMODERN_GUSCIO_QUANDO_SERVE__;

function azzera() {
  for (const lista of Object.values(timer)) lista.length = 0;
  stato.timer = 0;
  stato.frame = 0;
  stato.pendente = false;
  documento.visibilityState = "visible";
}
function scatta(lista) {
  for (const voce of lista.splice(0)) voce.fn();
}
const annuncia = (nome) => globalThis.dispatchEvent(new CustomEvent(nome));
const unGiro = () => new Promise((ok) => queueMicrotask(ok));

test("cento eventi fanno un timer solo e, mezzo secondo dopo, un disegno solo", () => {
  azzera();
  let disegni = 0;
  globalThis.render = () => {
    disegni += 1;
  };
  assert.equal(stato.installed, true);
  assert.equal(globalThis.cdRenderSoon.__dmQuandoServe, true);
  for (let evento = 0; evento < 100; evento += 1) globalThis.cdRenderSoon();
  assert.equal(timer.attese.length, 1, "una raffica arma un timer solo");
  assert.equal(timer.attese[0].ms, RITARDO_DEL_DISEGNO_MS);
  assert.equal(RITARDO_DEL_DISEGNO_MS, 500, "lo stesso passo del cancello dei moduli");
  assert.equal(disegni, 0, "durante la raffica non si disegna");
  scatta(timer.attese);
  assert.equal(timer.fotogrammi.length, 1, "allo scadere si aspetta il fotogramma");
  scatta(timer.fotogrammi);
  assert.equal(disegni, 1);
  assert.equal(stato.pendente, false);
});

test("a scheda nascosta si prende nota e basta; al ritorno si disegna una volta", () => {
  azzera();
  let disegni = 0;
  globalThis.render = () => {
    disegni += 1;
  };
  documento.visibilityState = "hidden";
  for (let evento = 0; evento < 20; evento += 1) globalThis.cdRenderSoon();
  assert.equal(timer.attese.length, 0);
  assert.equal(timer.fotogrammi.length, 0);
  assert.equal(stato.pendente, true);
  documento.visibilityState = "visible";
  ascoltiDelDocumento.get("visibilitychange")();
  assert.equal(timer.fotogrammi.length, 1, "il ritorno disegna al fotogramma dopo, senza attesa");
  scatta(timer.fotogrammi);
  assert.equal(disegni, 1);
  // Un ritorno senza niente in sospeso non disegna.
  ascoltiDelDocumento.get("visibilitychange")();
  assert.equal(timer.fotogrammi.length, 0);
});

test("chi chiede «subito» salta l'attesa ma non raddoppia il fotogramma", () => {
  azzera();
  let disegni = 0;
  globalThis.render = () => {
    disegni += 1;
  };
  globalThis.cdRenderSoon();
  assert.equal(timer.attese.length, 1);
  richiediDisegno({ subito: true });
  assert.ok(timer.cancellati.includes(timer.attese[0].id), "l'attesa si disfa");
  assert.equal(timer.fotogrammi.length, 1);
  richiediDisegno({ subito: true });
  assert.equal(timer.fotogrammi.length, 1);
  scatta(timer.fotogrammi);
  assert.equal(disegni, 1);
});

test("le temperature dell'inverter si leggono dopo il disegno, con la vista aperta", async () => {
  azzera();
  let letture = 0;
  globalThis.renderInverterTemp = () => {
    letture += 1;
  };
  globalThis.render = () => {};
  annuncia("dashboardmodern:legacy-ready");
  assert.equal(globalThis.render.__dmQuandoServeInverter, true);
  globalThis.render();
  await unGiro();
  assert.equal(letture, 0, "vista chiusa: niente");
  pagina("view-temp").classList.add("active");
  globalThis.render();
  await unGiro();
  assert.equal(letture, 1);
  pagina("view-temp").classList.remove("active");
});

test("la finestra dei dettagli si riscrive solo quando gli stati del suo gruppo cambiano", () => {
  let scritture = 0;
  function apriDettagli() {
    scritture += 1;
  }
  apriDettagli.__dmShowcase = true;
  globalThis.apriDettagli = apriDettagli;
  globalThis.GRUPPI_MONITORAGGIO = { luci: ["light.a", "light.b"] };
  globalThis.STATES = {
    "light.a": { state: "on", last_updated: "1" },
    "light.b": { state: "off", last_updated: "1" },
  };
  globalThis.currentPopupType = "luci";
  documento.finestraAperta = true;
  annuncia("dashboardmodern:runtime-ready");
  assert.notEqual(globalThis.apriDettagli, apriDettagli);
  assert.equal(globalThis.apriDettagli.__dmQuandoServe, true);
  assert.equal(globalThis.apriDettagli.__dmShowcase, true, "porta con se' i segni degli altri");

  globalThis.apriDettagli(null, "luci");
  assert.equal(scritture, 1, "la prima volta si scrive");
  globalThis.apriDettagli(null, "luci");
  assert.equal(scritture, 1, "stessi stati: si lascia stare");
  globalThis.STATES["light.b"] = { state: "on", last_updated: "2" };
  globalThis.apriDettagli(null, "luci");
  assert.equal(scritture, 2, "uno stato cambiato: si riscrive");
  globalThis.apriDettagli(null, "luci");
  assert.equal(scritture, 2);
  globalThis.apriDettagli({ stopPropagation() {} }, "luci");
  assert.equal(scritture, 3, "un tocco riscrive sempre");
  documento.finestraAperta = false;
  globalThis.apriDettagli(null, "luci");
  assert.equal(scritture, 4, "a finestra chiusa si apre");
  documento.finestraAperta = true;
  globalThis.apriDettagli(null, "win");
  assert.equal(scritture, 5, "un gruppo che non si conosce si scrive sempre");

  /* Se qualcuno si rimette sopra senza portare i nostri segni, al prossimo
   * annuncio si torna fuori; l'involucro rimasto dentro non decide niente. */
  const nostro = globalThis.apriDettagli;
  const esterno = function (evento, tipo) {
    return nostro.call(this, evento, tipo);
  };
  globalThis.apriDettagli = esterno;
  annuncia("dashboardmodern:legacy-ready");
  assert.notEqual(globalThis.apriDettagli, esterno);
  globalThis.STATES["light.a"] = { state: "off", last_updated: "3" };
  globalThis.apriDettagli(null, "luci");
  assert.equal(scritture, 6);
  globalThis.apriDettagli(null, "luci");
  assert.equal(scritture, 6);
});

test("la firma legge stato e last_updated, e senza last_updated gli attributi", () => {
  const gruppi = { batt: ["sensor.b1", "sensor.b2"] };
  const prima = firmaDellaFinestra("batt", gruppi, {
    "sensor.b1": { state: "12", attributes: { unit_of_measurement: "%" } },
  });
  const uguale = firmaDellaFinestra("batt", gruppi, {
    "sensor.b1": { state: "12", attributes: { unit_of_measurement: "%" } },
  });
  const cambiata = firmaDellaFinestra("batt", gruppi, {
    "sensor.b1": { state: "12", attributes: { unit_of_measurement: "%", icon: "x" } },
  });
  assert.equal(prima, uguale);
  assert.notEqual(prima, cambiata);
  assert.equal(firmaDellaFinestra("sconosciuto", gruppi, {}), "");
});

test("i timer del guscio che un modulo fa gia' si spengono; gli altri restano", () => {
  azzera();
  const elenco = [
    {
      id: 11,
      period: 2000,
      fn: "function(){ try {  var pg=document.getElementById('page-tapparelle'); if(pg && pg.offsetParent!==null) renderTapparelle(); } catch(e){} }",
    },
    {
      id: 12,
      period: 1000,
      fn: "function(){ try { if(CD_IRR.cur>=0 && Date.now()>CD_IRR.until) cdIrrNext();  var pg=document.getElementById('page-irrigazione'); if(pg && pg.offsetParent!==null) renderIrrigazione(); } catch(e){} }",
    },
    {
      id: 13,
      period: 30000,
      fn: "function(){ try { var o=getIrr(); if(!o.enabled || !o.zones.length || CD_IRR.cur>=0) return; var d=new Date(); cdIrrProgram(false); } catch(e){} }",
    },
    {
      id: 14,
      period: 2000,
      fn: "function(){ try { if(CD_POOL.stopAt && Date.now()>CD_POOL.stopAt){ cdPoolStopFilter(); }  var pg=document.getElementById('page-piscina'); if(pg && pg.offsetParent!==null) renderPiscina(); } catch(e){} }",
    },
    {
      id: 15,
      period: 30000,
      fn: "function(){ try { var o=getPool(); if(o.pumpEnt && cdPoolOn(o.pumpEnt)){ var r=cdPoolRunToday(); r.s+=30; } cdPoolStartFilter(); } catch(e){} }",
    },
    { id: 16, period: 2000, fn: "function(){ try { cdEvCarsRefresh(); } catch(e){} }" },
    { id: 17, period: 3000, fn: "function(){ try { cdApplyNavVis(); } catch(e) {} }" },
    {
      id: 18,
      period: 15000,
      fn: "function cdApplBridge(){ try { if(typeof APPLIANCES==='undefined') return; }",
    },
    {
      id: 19,
      period: 2000,
      fn: "() => {\n  const view = document.getElementById('view-temp');\n  if (view && view.classList.contains('active')) {\n    renderInverterTemp();\n  }\n}",
    },
    {
      id: 20,
      period: 20000,
      fn: "() => { try { if (Object.keys(_RAW_STATES).length) updateClimaCards(); } catch(e) {} }",
    },
    {
      id: 21,
      period: 20000,
      fn: "() => { try { if (Object.keys(_RAW_STATES).length) updateDeviceCards(); } catch(e) {} }",
    },
    { id: 22, period: 21600000, fn: "() => cdCheckUpdate(false)" },
    { id: 23, period: 60000, fn: "() => { try { cdAutoHide(); } catch(e){} }" },
    { id: 24, period: 1000, fn: "function updateCamClocks() {\n    const now = new Date();" },
    { id: 25, period: 600000, fn: "function cdDeriveFromTotals() {" },
  ];
  const potati = potaITimerDelGuscio(elenco);
  assert.deepEqual(
    [...potati].sort(),
    TIMER_DEL_GUSCIO.map((regola) => regola.nome).sort(),
  );
  assert.deepEqual(
    timer.cancellati.slice().sort((a, b) => a - b),
    [11, 12, 14, 16, 17, 18, 19, 20, 21, 23, 24],
  );
  assert.deepEqual(
    elenco.filter((voce) => !voce.cleared).map((voce) => voce.id),
    [13, 15, 22, 25],
    "il programma dell'irrigazione, il conto della piscina, gli aggiornamenti e i totali restano",
  );
  assert.equal(elenco[6].owner, "barra");
  assert.deepEqual(potaITimerDelGuscio(elenco), [], "una seconda passata non tocca niente");
  assert.deepEqual(potaITimerDelGuscio(undefined), []);
});

/* Il primo argomento di una chiamata, letto dal sorgente: e' quello che a
 * runtime il preludio annota con `String(handler)`. Si ferma alla virgola
 * fuori da ogni parentesi e da ogni stringa. */
function primoArgomento(sorgente, da) {
  let profondita = 0;
  let corda = "";
  for (let i = da; i < sorgente.length; i += 1) {
    const c = sorgente[i];
    if (corda) {
      if (c === "\\") i += 1;
      else if (c === corda) corda = "";
      continue;
    }
    if (c === "'" || c === '"' || c === "`") corda = c;
    else if ("({[".includes(c)) profondita += 1;
    else if (")}]".includes(c)) {
      if (profondita === 0) return { testo: sorgente.slice(da, i), fine: i };
      profondita -= 1;
    } else if (c === "," && profondita === 0) return { testo: sorgente.slice(da, i), fine: i };
  }
  return { testo: sorgente.slice(da), fine: sorgente.length };
}

function passoDopo(sorgente, da) {
  const preso = sorgente.slice(da, da + 60).match(/^\s*,\s*([\d\s*]+)\)/);
  if (!preso) return 0;
  return preso[1].split("*").reduce((totale, fattore) => totale * Number(fattore.trim()), 1);
}

test("ogni regola corrisponde a un timer del runtime vendorizzato, in entrambe le lingue", () => {
  for (const sorgente of [RUNTIME, RUNTIME_EN]) {
    const occorrenze = [];
    const cerca = /setInterval\(/g;
    let presa;
    while ((presa = cerca.exec(sorgente))) {
      const { testo, fine } = primoArgomento(sorgente, presa.index + 12);
      /* Nel sorgente un timer puo' nominare una funzione dichiarata altrove
       * (`setInterval(updateCamClocks, 1000)`): a runtime `String(handler)`
       * comincia con `function nome(`. */
      const nome = testo.match(/^\s*([A-Za-z_$][\w$]*)\s*$/)?.[1];
      occorrenze.push({
        testo: nome ? `function ${nome}(` : testo.trim(),
        period: passoDopo(sorgente, fine),
      });
    }
    assert.equal(occorrenze.length, 20, "i timer del runtime sono venti");
    for (const regola of TIMER_DEL_GUSCIO) {
      const prese = occorrenze.filter(
        (occorrenza) =>
          occorrenza.period === regola.period && regola.firma.test(occorrenza.testo),
      );
      assert.equal(prese.length, 1, `${regola.nome}: una sola occorrenza nel runtime`);
    }
    /* I due da trenta secondi portano logica che nessun modulo fa: nessuna
     * regola li prende. */
    const tenuti = occorrenze.filter((occorrenza) => occorrenza.period === 30000);
    assert.equal(tenuti.length, 2);
    assert.match(tenuti[0].testo, /cdIrrProgram\(false\)/);
    assert.match(tenuti[1].testo, /cdPoolStartFilter\(\)/);
    for (const occorrenza of tenuti) {
      assert.equal(
        TIMER_DEL_GUSCIO.some(
          (regola) => regola.period === occorrenza.period && regola.firma.test(occorrenza.testo),
        ),
        false,
      );
    }
  }
});

test("l'ora sulle telecamere gira solo con la Sicurezza aperta e la scheda in vista", () => {
  azzera();
  let letture = 0;
  globalThis.updateCamClocks = () => {
    letture += 1;
  };
  assert.equal(sincronizzaOrologi(), false);
  assert.equal(stato.orologio, 0);
  pagina("page-security").classList.add("active");
  assert.equal(sincronizzaOrologi(), true);
  assert.equal(letture, 1, "appena si apre l'ora e' quella giusta");
  assert.equal(timer.intervalli.length, 1);
  assert.equal(timer.intervalli[0].ms, 1000);
  timer.intervalli[0].fn();
  assert.equal(letture, 2);
  assert.equal(sincronizzaOrologi(), false, "gia' acceso: non se ne accende un altro");
  documento.visibilityState = "hidden";
  assert.equal(sincronizzaOrologi(), true);
  assert.equal(stato.orologio, 0);
  assert.ok(timer.cancellati.includes(timer.intervalli[0].id));
  documento.visibilityState = "visible";
  pagina("page-security").classList.remove("active");
  assert.equal(sincronizzaOrologi(), false);
});

test("il passo dell'irrigazione corre solo con una sequenza in corso", async () => {
  azzera();
  let passi = 0;
  let disegni = 0;
  globalThis.CD_IRR = { seq: [0, 1], cur: 0, until: Date.now() - 1 };
  globalThis.cdIrrNext = () => {
    passi += 1;
    globalThis.CD_IRR.cur = -1;
  };
  globalThis.renderIrrigazione = () => {
    disegni += 1;
  };
  pagina("page-irrigazione").classList.add("active");
  assert.equal(sincronizzaIrrigazione(), true);
  assert.equal(timer.intervalli.length, 1);
  assert.equal(timer.intervalli[0].ms, 1000);
  // Il tempo della zona e' scaduto: si passa alla prossima. La sequenza
  // finisce e l'orologio si spegne da solo.
  timer.intervalli[0].fn();
  assert.equal(passi, 1);
  assert.equal(stato.irrigazione, 0);
  assert.ok(timer.cancellati.includes(timer.intervalli[0].id));

  // Con la zona ancora in tempo: niente passo, e il conto alla rovescia si
  // disegna solo con la pagina in vista.
  globalThis.CD_IRR = { seq: [0], cur: 0, until: Date.now() + 60000 };
  azzera();
  sincronizzaIrrigazione();
  timer.intervalli[0].fn();
  assert.equal(passi, 1);
  assert.equal(disegni, 1);
  documento.visibilityState = "hidden";
  timer.intervalli[0].fn();
  assert.equal(disegni, 1, "a scheda nascosta il passo c'e', il disegno no");
  documento.visibilityState = "visible";
  pagina("page-irrigazione").classList.remove("active");
  timer.intervalli[0].fn();
  assert.equal(disegni, 1, "da un'altra pagina lo stesso");

  // Chi avvia una sequenza arma l'orologio: cdIrrStartSeq e' avvolto.
  globalThis.CD_IRR = { seq: [], cur: -1, until: 0 };
  sincronizzaIrrigazione();
  azzera();
  globalThis.cdIrrStartSeq = () => {
    globalThis.CD_IRR = { seq: [0], cur: 0, until: Date.now() + 1000 };
  };
  annuncia("dashboardmodern:legacy-ready");
  assert.equal(globalThis.cdIrrStartSeq.__dmQuandoServeIrrigazione, true);
  globalThis.cdIrrStartSeq([0]);
  await unGiro();
  assert.equal(timer.intervalli.length, 1);
  globalThis.CD_IRR.cur = -1;
  sincronizzaIrrigazione();
});

test("la fine della filtrazione e' una sveglia, non un sondaggio ogni due secondi", () => {
  azzera();
  let fermate = 0;
  globalThis.cdPoolStopFilter = () => {
    fermate += 1;
    globalThis.CD_POOL.stopAt = 0;
  };
  globalThis.CD_POOL = { stopAt: 0 };
  assert.equal(sincronizzaPiscina(), false);
  assert.equal(timer.attese.length, 0);
  globalThis.CD_POOL.stopAt = Date.now() + 10000;
  assert.equal(sincronizzaPiscina(), true);
  assert.equal(timer.attese.length, 1);
  assert.ok(timer.attese[0].ms >= 10000 && timer.attese[0].ms <= 10500);
  // Scatta prima dell'ora (spostata nel frattempo): si riarma, non ferma.
  globalThis.CD_POOL.stopAt = Date.now() + 20000;
  scatta(timer.attese);
  assert.equal(fermate, 0);
  assert.equal(timer.attese.length, 1);
  globalThis.CD_POOL.stopAt = Date.now() - 1;
  scatta(timer.attese);
  assert.equal(fermate, 1);
  // Uno stop a mano disfa la sveglia.
  globalThis.CD_POOL.stopAt = Date.now() + 5000;
  sincronizzaPiscina();
  const sveglia = timer.attese[0].id;
  globalThis.CD_POOL.stopAt = 0;
  assert.equal(sincronizzaPiscina(), false);
  assert.ok(timer.cancellati.includes(sveglia));
});

test("le particelle della ricarica girano solo con la pagina EV in vista", () => {
  azzera();
  let avvii = 0;
  globalThis.lmStartParticles = () => {
    avvii += 1;
  };
  annuncia("dashboardmodern:legacy-ready");
  assert.equal(globalThis.lmStartParticles.__dmQuandoServe, true);
  const tela = { _animRunning: true };
  globalThis.lmStartParticles(tela); // da Home, come fa render()
  assert.equal(avvii, 0);
  assert.equal(tela._animRunning, false, "il giro non parte, e il guscio potra' richiederlo");
  assert.equal(stato.particelleVolute, true);
  assert.equal(riprendiLeParticelle(), false, "la pagina non si vede ancora");
  pagina("page-ev").classList.add("active");
  // Il ritorno sulla pagina chiede un disegno subito: e' il guscio a far
  // ripartire il giro, se l'auto carica ancora.
  assert.equal(riprendiLeParticelle(), true);
  assert.equal(timer.fotogrammi.length, 1);
  tela._animRunning = true;
  globalThis.lmStartParticles(tela);
  assert.equal(avvii, 1);
  documento.visibilityState = "hidden";
  assert.equal(fermaLeParticelle(), true);
  assert.equal(tela._animRunning, false);
  assert.equal(fermaLeParticelle(), false, "gia' ferme");
  documento.visibilityState = "visible";
  pagina("page-ev").classList.remove("active");
  assert.equal(riprendiLeParticelle(), false);
});

test("il runtime delle sezioni la installa per prima, prima di ogni involucro", () => {
  assert.match(SECTION_RUNTIME, /il-guscio-disegna-quando-serve-section\.js/);
  const installazione = SECTION_RUNTIME.indexOf("installGuscioQuandoServe();");
  assert.ok(installazione > 0);
  assert.ok(installazione < SECTION_RUNTIME.indexOf("installIndirizzoDiCasa();"));
  assert.match(SECTION_RUNTIME, /sections: Object\.freeze\(\[\s*"il-guscio-disegna-quando-serve",/);
});
