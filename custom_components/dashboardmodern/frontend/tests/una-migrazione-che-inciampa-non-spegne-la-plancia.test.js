/* «`recoverEnergyConfiguration` va in TypeError sul gruppo `cooling`, e
 *  interrompe `store.migrate()` dopo il ripristino.» (#533)
 *
 * Sono due difetti, uno dentro l'altro, e il secondo è molto più grande del
 * primo.
 *
 * Il primo: `ENERGY_SLOT_MAP` comincia con i cinque percorsi `cooling.*`, e la
 * forma che il recupero si costruisce non conosceva quel gruppo. Il giro che
 * riempie gli slot scriveva dentro `undefined`, e sollevava. Non è un caso di
 * laboratorio: succede a chiunque abbia quei cinque alias nelle sostituzioni e
 * il gruppo perso in un ripristino.
 *
 * Il secondo, che è quello che si è visto in casa della gente: `store.migrate()`
 * sta al primo livello di `modules-entry.js`, e sopra ci passa tutto — il ponte
 * verso le chiavi storiche, la proiezione delle sostituzioni, il coordinatore
 * dei disegni e, in fondo al file, `DashboardModernModules`. Un'eccezione lì
 * non lasciava «una migrazione a metà»: lasciava una plancia senza niente di
 * moderno, perché il modulo smetteva di essere valutato e quell'oggetto non
 * nasceva mai. Da lì, tutte insieme, la #531 (flussi e potenze spariti), la
 * #532 (widget della Home spariti) e la #534 (popup delle finestre senza
 * grafica né nomi).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { recoverEnergyConfiguration } from "../src/sections/beta24-energy-recovery-section.js";
import { COOLING_SLOT_MAP, ENERGY_SLOT_MAP } from "../src/core/energy-projection.js";

/* Lo stato che rompeva: i cinque alias del raffreddamento nelle sostituzioni,
 * e il gruppo `cooling` che non c'è. */
const statoDellaSegnalazione = () => ({
  sections: {
    energy: {
      house: { power: "sensor.casa_potenza" },
      grid: {},
      solar: {},
      battery: {},
      metadata: { semantics_version: 4 },
    },
    entityOverrides: Object.fromEntries(
      Object.values(COOLING_SLOT_MAP).map((slot) => [slot, "sensor.qualcosa"]),
    ),
  },
});

test("il recupero non solleva sul gruppo che non c'è, e recupera i cinque valori", () => {
  const stato = statoDellaSegnalazione();
  const recuperati = recoverEnergyConfiguration(stato, {});
  assert.equal(recuperati, 5);
  assert.deepEqual(stato.sections.energy.cooling, {
    inverter_ac_temperature: "sensor.qualcosa",
    inverter_dc_temperature: "sensor.qualcosa",
    battery_temperature: "sensor.qualcosa",
    fan_power: "sensor.qualcosa",
    fan_switch: "sensor.qualcosa",
  });
  /* E quello che c'era prima resta dov'era. */
  assert.equal(stato.sections.energy.house.power, "sensor.casa_potenza");
});

test("ogni gruppo della mappa degli slot esiste nella forma dello stato", () => {
  /* La prova che impedisce il ritorno: il difetto è nato perché la mappa e la
   * forma sono due elenchi, e uno dei due ha imparato un gruppo che l'altro non
   * sapeva. Qui si guardano insieme, gruppo per gruppo, invece di fidarsi. */
  const sorgente = readFileSync(
    new URL("../src/sections/beta24-energy-recovery-section.js", import.meta.url),
    "utf8",
  );
  const forma = sorgente.slice(
    sorgente.indexOf("function ensureEnergyShape"),
    sorgente.indexOf("export function recoverEnergyConfiguration"),
  );
  for (const percorso of Object.keys(ENERGY_SLOT_MAP)) {
    const gruppo = percorso.split(".")[0];
    assert.ok(
      new RegExp(`\\n\\s*${gruppo}: \\{ \\.\\.\\.objectValue\\(current\\.${gruppo}\\) \\}`).test(
        forma,
      ),
      `"${gruppo}" è nella mappa degli slot ma non nella forma dello stato: scriverci dentro solleverebbe`,
    );
  }
  /* E comunque il giro apre il gruppo se non c'è: il giorno in cui qualcuno
   * aggiunge un gruppo nuovo e si dimentica di scriverlo sopra, non porta giù
   * tutta la plancia. */
  assert.match(sorgente, /energy\[group\] \|\|= \{\};\s*\n\s*energy\[group\]\[key\] = value;/);
});

test("una migrazione che inciampa non porta giù tutto il resto", () => {
  /* È questa la riga che trasformava un difetto in un blackout. Tutto quello
   * che viene dopo — il ponte, la proiezione, il coordinatore, e in fondo al
   * file `DashboardModernModules` — non esisteva più. */
  const entry = readFileSync(new URL("../legacy/modules-entry.js", import.meta.url), "utf8");
  assert.match(
    entry,
    /try \{ store\.migrate\(\); \} catch \(error\) \{[\s\S]{0,200}?\}\s*\n\s*store\.installLegacyWriteBridge\(\);/,
  );
  /* E non si tace: una migrazione che inciampa è un guaio da guardare. */
  assert.match(
    entry,
    /console\?\.error\?\.\("\[DashboardModern\] migrazione dello stato non riuscita"/,
  );
});
