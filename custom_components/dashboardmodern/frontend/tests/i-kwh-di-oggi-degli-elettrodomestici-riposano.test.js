/* Il conto dei kWh di oggi degli elettrodomestici ha un riposo vero.
 *
 * Ce n'era gia' uno, di cinque secondi, e non lo rispettava nessuno: ogni
 * infornata di stati — e un misuratore di potenza ne manda in continuazione —
 * rimetteva a zero l'orologio, e una lettura delle statistiche partiva a ogni
 * infornata per tutto il tempo che la pagina restava aperta. Sul mini PC e'
 * proprio il giro che tiene il Recorder occupato mentre la casa e' viva.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const sorgente = readFileSync(
  new URL("../src/sections/appliances-section.js", import.meta.url),
  "utf8",
);

test("il riposo e' di almeno un minuto: e' il passo con cui il dato esiste", () => {
  const dichiarazione = /const DAILY_REFRESH_MS = (\d[\d_]*);/.exec(sorgente);
  assert.ok(dichiarazione, "manca la dichiarazione del riposo");
  const riposo = Number(dichiarazione[1].replaceAll("_", ""));
  assert.ok(riposo >= 60_000, `il riposo e' di ${riposo} ms`);
});

test("un'infornata di stati non azzera l'orologio del riposo", () => {
  const ascolto = sorgente.slice(
    sorgente.indexOf('root.addEventListener?.("dashboardmodern:state-changed"'),
  );
  const corpo = ascolto.slice(0, ascolto.indexOf("});"));
  assert.match(corpo, /scheduleApplianceNormalization\(\);/, "le schede si rifanno lo stesso");
  assert.equal(
    /state\.dailyUpdatedAt = 0;/.test(corpo),
    false,
    "l'orologio del riposo viene ancora azzerato dagli stati",
  );
});

test("la configurazione cambiata invece vale la lettura subito", () => {
  const magazzino = sorgente.slice(sorgente.indexOf("function subscribeStore()"));
  const corpo = magazzino.slice(0, magazzino.indexOf("\n}\n"));
  assert.match(corpo, /change\.section === "appliances"/);
  assert.match(corpo, /state\.dailyUpdatedAt = 0;/);
});

test("il riposo tiene finche' non e' passato il minuto, e il tocco lo scavalca", async () => {
  const { ilContoDiOggiRiposa } = await import("../src/sections/appliances-section.js");
  const adesso = Date.now();
  /* Cinque secondi dopo l'ultima lettura — cioe' il vecchio riposo — si
   * riposa ancora: e' li' che una infornata di stati faceva ripartire la
   * lettura delle statistiche. */
  assert.equal(ilContoDiOggiRiposa({ aggiornatoIl: adesso - 5_000, adesso }), true);
  assert.equal(ilContoDiOggiRiposa({ aggiornatoIl: adesso - 59_000, adesso }), true);
  assert.equal(ilContoDiOggiRiposa({ aggiornatoIl: adesso - 61_000, adesso }), false);
  /* Chi tocca la tessera per aprire il dettaglio chiede lo stesso subito. */
  assert.equal(ilContoDiOggiRiposa({ aggiornatoIl: adesso, adesso, force: true }), false);
  /* E la prima volta non si riposa: non c'e' niente da mostrare. */
  assert.equal(ilContoDiOggiRiposa({ aggiornatoIl: 0, adesso }), false);
});
