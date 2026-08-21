import assert from "node:assert/strict";
import test from "node:test";

import {
  NAVBAR_MODE_DEFAULT,
  NAVBAR_MODE_KEY,
  navbarMode,
  seedNavbarMode,
} from "../src/sections/navigation-section.js";
import { CONFIG_KEYS } from "../src/sections/config-persistence-section.js";

const memoria = (valori = {}) => {
  const dati = new Map(Object.entries(valori));
  return {
    getItem: (k) => (dati.has(k) ? dati.get(k) : null),
    setItem: (k, v) => dati.set(k, String(v)),
    tutto: () => Object.fromEntries(dati),
  };
};

/* La barra parte ferma. Prima partiva a scomparsa dappertutto, e sul computer
 * il comando per tenerla ferma stava dietro la barra stessa. */
test("senza una scelta la barra e' ferma", () => {
  assert.equal(NAVBAR_MODE_DEFAULT, "fixed");
  assert.equal(navbarMode(memoria()), "fixed");
  assert.equal(navbarMode(memoria({ [NAVBAR_MODE_KEY]: "" })), "fixed");
  assert.equal(navbarMode(memoria({ [NAVBAR_MODE_KEY]: "qualcosa" })), "fixed");
});

test("ma una scelta fatta vale piu' del valore di partenza", () => {
  assert.equal(navbarMode(memoria({ [NAVBAR_MODE_KEY]: "auto" })), "auto");
  assert.equal(navbarMode(memoria({ [NAVBAR_MODE_KEY]: "fixed" })), "fixed");
});

test("senza memoria del browser la barra resta ferma, non sparisce", () => {
  assert.equal(navbarMode(null), "fixed");
  assert.equal(
    navbarMode({
      getItem: () => {
        throw new Error("negata");
      },
    }),
    "fixed",
  );
});

test("il valore di partenza si scrive, cosi' anche il vecchio runtime lo legge", () => {
  const storage = memoria();
  assert.equal(seedNavbarMode(storage, {}), true);
  assert.deepEqual(storage.tutto(), { [NAVBAR_MODE_KEY]: "fixed" });
});

test("e non si scrive sopra a una scelta gia' fatta", () => {
  const storage = memoria({ [NAVBAR_MODE_KEY]: "auto" });
  assert.equal(seedNavbarMode(storage, {}), false);
  assert.equal(storage.getItem(NAVBAR_MODE_KEY), "auto");
});

/* Scriverlo come fosse una scelta farebbe partire la spinta della
 * configurazione, e una copia appena accesa arriverebbe a sovrascrivere il "a
 * scomparsa" scelto davvero altrove prima ancora di averlo ricevuto. */
test("scrivere il valore di partenza non conta come una scelta da spedire", () => {
  const view = {};
  const storage = {
    getItem: () => null,
    setItem: () => {
      assert.equal(
        view.__DASHBOARDMODERN_PERSIST_RESTORE__,
        true,
        "la scrittura dev'essere marcata come ripristino",
      );
    },
  };
  seedNavbarMode(storage, view);
  assert.equal("__DASHBOARDMODERN_PERSIST_RESTORE__" in view, false, "il segno va tolto dopo");
});

test("e se qualcuno stava gia' ripristinando, il suo segno resta suo", () => {
  const view = { __DASHBOARDMODERN_PERSIST_RESTORE__: true };
  seedNavbarMode(memoria(), view);
  assert.equal(view.__DASHBOARDMODERN_PERSIST_RESTORE__, true);
});

/* E la scelta viaggia: era il secondo pezzo della segnalazione, "metto la barra
 * fissa sul telefono e sul computer non cambia niente". */
test("la modalita' della barra viaggia con la configurazione", () => {
  assert.ok(CONFIG_KEYS.includes(NAVBAR_MODE_KEY));
});
