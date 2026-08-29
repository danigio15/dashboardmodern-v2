// DM-FIX-20260812C
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { matchCanonicalRoom } from "../src/sections/beta16-real-device-layout-section.js";

// Release gate for the screenshot-proven room and responsive regressions fixed in beta16.
const rooms = [
  { id: "room_msqjk307", name: "Cameretta", icon: "mdi:bed" },
  { id: "room_salone", name: "Salone", icon: "mdi:sofa" },
];

test("beta16 resolves canonical room ids to their readable names", () => {
  assert.equal(matchCanonicalRoom(rooms, "room_msqjk307")?.name, "Cameretta");
  assert.equal(matchCanonicalRoom(rooms, "salone")?.id, "room_salone");
});

test("beta16 can recover a missing climate room from the configured unit name", () => {
  assert.equal(matchCanonicalRoom(rooms, "", "cameretta")?.id, "room_msqjk307");
  assert.equal(matchCanonicalRoom(rooms, "", "SALONE")?.id, "room_salone");
});

test("beta16 runtime loads after beta14 and owns the requested mobile contracts", async () => {
  const buildInfo = await readFile(new URL("../legacy/build-info.js", import.meta.url), "utf8");
  const generator = await readFile(
    new URL("../../../../scripts/generate_build_info.py", import.meta.url),
    "utf8",
  );
  const source = await readFile(
    new URL("../src/sections/beta16-real-device-layout-section.js", import.meta.url),
    "utf8",
  );
  for (const sentinel of [buildInfo, generator]) {
    const beta14 = sentinel.indexOf("beta14-real-device-hotfix-section.js");
    const beta16 = sentinel.indexOf("beta16-real-device-layout-section.js");
    assert.ok(beta14 >= 0, "beta14 import is present");
    assert.ok(beta16 > beta14, "beta16 loads after beta14");
  }
  /* La griglia a due colonne del Clima non si pretende piu' qui: quel foglio
     e' andato via insieme al resto delle regole sulla scheda `cp-*`. Erano
     quattordici misure decise da questo foglio e da beta7-regression in
     disaccordo — la card alta 248px o senza minimo, il numero grande 46px o
     28px — su un markup che nessuno disegna piu': la pagina Clima e' tutta di
     climate-thermal-section, e a plancia aperta i nodi `cp-*` sono zero, con
     e senza i dati vecchi del guscio. */
  assert.match(source, /clima-page-mode-btn\{min-height:52px!important/);
  assert.match(source, /dm-temperature-room-tabs/);
  assert.match(source, /dmBeta16ActionName/);
  assert.match(source, /dmBeta16ClimateName/);
  assert.match(source, /dmBeta16TemperatureName/);
  // The Pool page moved to its own scene owner; beta16 no longer decorates it.
  assert.doesNotMatch(source, /page-piscina|pool-wrap/);
});
