import assert from "node:assert/strict";
import test from "node:test";

import { EVCC_REFS, evccPresence } from "../src/core/ev-console.js";

const mappa = (coppie) => (reference) => coppie[reference] || reference;

test("senza mappatura non c'e' niente della console da mostrare", () => {
  // Chi la macchina la attacca e basta: nessuna delle due entita' e' mappata, e
  // un riferimento che si traduce in se stesso vuol dire proprio questo.
  assert.deepEqual(
    evccPresence({}, (value) => value),
    { target: false, mode: false },
  );
  assert.deepEqual(evccPresence(), { target: false, mode: false });
});

test("il target e le modalita' si accendono ognuno per conto suo", () => {
  const states = { "number.target": { state: "80" } };
  const solaTarget = evccPresence(states, mappa({ "dm.ev_target_soc": "number.target" }));
  assert.deepEqual(solaTarget, { target: true, mode: false });

  const conModalita = evccPresence(
    { ...states, "select.modo": { state: "pv" } },
    mappa({ "dm.ev_target_soc": "number.target", "dm.ev_modalita_ricarica_evcc": "select.modo" }),
  );
  assert.deepEqual(conModalita, { target: true, mode: true });
});

test("un'entita' che non risponde non e' una console da mostrare", () => {
  // Mappata ieri, sparita da Home Assistant oggi: un target fermo su "—" non
  // serve a nessuno.
  for (const muto of ["unavailable", "unknown", "none", "", null]) {
    const presenza = evccPresence(
      { "number.target": { state: muto } },
      mappa({ "dm.ev_target_soc": "number.target" }),
    );
    assert.equal(presenza.target, false, String(muto));
  }
});

test("va bene anche la forma con input_ davanti", () => {
  // La plancia legge il target come input_dm.ev_target_soc: e' lo stesso
  // riferimento visto dal lato dei comandi, e vale come mappatura.
  const presenza = evccPresence(
    { "number.target": { state: "80" } },
    mappa({ "input_dm.ev_target_soc": "number.target" }),
  );
  assert.equal(presenza.target, true);
  assert.ok(EVCC_REFS.target.includes("dm.ev_target_soc"));
});

test("una mappatura che esplode non accende niente per sbaglio", () => {
  const presenza = evccPresence({ "number.target": { state: "80" } }, () => {
    throw new Error("no");
  });
  assert.deepEqual(presenza, { target: false, mode: false });
});
