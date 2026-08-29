/* La scheda dei nodi non riaccende una bolla che il flusso ha ritirato.
 *
 * Nel guscio ci sono cinque bolle a posto fisso — Boiler, Wallbox, Clima,
 * Lavanderia, Cucina — di quando i carichi erano quei cinque e basta. Oggi li
 * disegna il flusso nuovo, in numero e posizione decisi dalla configurazione, e
 * quelle cinque le ritira: le marchia `data-dm-legacy-energy-load="replaced"` e
 * le nasconde.
 *
 * La scheda dei nodi decide un'altra cosa: se una bolla e' spenta in
 * configurazione. Quando una veniva riaccesa, rimetteva a posto la sua
 * `display` — e cancellava proprio il `none` con cui il flusso l'aveva
 * ritirata. Tornavano due serie disegnate insieme: un cerchio in piu' in fondo,
 * e uno sopra il Wallbox nuovo.
 *
 * Questa prova guarda chi tocca cosa. C'e' anche una prova col browser
 * (`e2e/due-serie-di-bolle.spec.js`) che guarda il risultato dipinto; questa
 * resta rossa anche se un domani la regola di stile che fa da seconda difesa
 * venisse tolta, perche' e' la regola vera a essere sorvegliata: **una bolla ha
 * un padrone solo**.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  nascondiPerConfigurazione,
  rimettiComeStava,
} from "../src/sections/beta26-real-device-stability-section.js";

/* Una bolla finta che si ricorda ogni scrittura di stile ricevuta: e' l'unica
 * cosa che questa prova deve poter contare. */
function bollaFinta({ ritirata = false } = {}) {
  const dichiarazioni = new Map();
  const scritture = [];
  const bolla = {
    dataset: {},
    style: {
      setProperty(nome, valore, priorita) {
        dichiarazioni.set(nome, { valore, priorita: priorita || "" });
        scritture.push(`set:${nome}=${valore}`);
      },
      removeProperty(nome) {
        dichiarazioni.delete(nome);
        scritture.push(`remove:${nome}`);
      },
      getPropertyValue(nome) {
        return dichiarazioni.get(nome)?.valore || "";
      },
      priorityOf(nome) {
        return dichiarazioni.get(nome)?.priorita || "";
      },
    },
    scritture,
  };
  if (ritirata) {
    /* Come l'ha lasciata il flusso dopo averla sostituita. */
    bolla.dataset.dmLegacyEnergyLoad = "replaced";
    bolla.style.setProperty("display", "none", "important");
    scritture.length = 0;
  }
  return bolla;
}

test("su una bolla ritirata dal flusso la scheda non scrive niente", () => {
  const bolla = bollaFinta({ ritirata: true });

  /* Il giro che rompeva: spenta in configurazione, e poi riaccesa. */
  nascondiPerConfigurazione(bolla);
  rimettiComeStava(bolla);

  assert.deepEqual(
    bolla.scritture,
    [],
    "la scheda ha scritto sulla bolla che il flusso aveva gia' ritirato: sono due padroni per la stessa bolla",
  );
  assert.equal(
    bolla.style.getPropertyValue("display"),
    "none",
    "la bolla vecchia deve restare ritirata, altrimenti si dipinge accanto a quella nuova",
  );
  assert.equal(bolla.style.priorityOf("display"), "important");
});

test("riaccendere rimette il valore di prima, non il vuoto", () => {
  const bolla = bollaFinta();
  /* Qualcun altro aveva gia' deciso come si mostra questa bolla. */
  bolla.style.setProperty("display", "grid");
  bolla.scritture.length = 0;

  nascondiPerConfigurazione(bolla);
  assert.equal(bolla.style.getPropertyValue("display"), "none");

  rimettiComeStava(bolla);
  assert.equal(
    bolla.style.getPropertyValue("display"),
    "grid",
    "riaccendere deve rimettere quello che c'era: cancellare la proprieta' non ripristina, scopre quello che sta sotto",
  );
});

test("una bolla che nessuno aveva toccato torna senza `display` addosso", () => {
  const bolla = bollaFinta();
  nascondiPerConfigurazione(bolla);
  rimettiComeStava(bolla);
  assert.equal(bolla.style.getPropertyValue("display"), "");
  assert.equal(bolla.dataset.dmBeta27ForcedHidden, undefined);
  assert.equal(bolla.dataset.dmBeta27DisplayPrima, undefined);
});

test("nascondere due volte non dimentica il valore di prima", () => {
  const bolla = bollaFinta();
  bolla.style.setProperty("display", "grid");
  nascondiPerConfigurazione(bolla);
  nascondiPerConfigurazione(bolla);
  rimettiComeStava(bolla);
  assert.equal(
    bolla.style.getPropertyValue("display"),
    "grid",
    "il secondo giro aveva preso `none` per il valore di prima",
  );
});
