/* La campanella di Home Assistant non suona piu'.
 *
 * «Login attempt failed — Login attempt or request with invalid
 * authentication from localhost (127.0.0.1). See the log for details.»
 * Sempre la stessa, a ogni apertura. E' la notifica che Home Assistant scrive
 * per OGNI richiesta REST arrivata senza una credenziale valida; da Nabu Casa
 * l'indirizzo e' 127.0.0.1 per tutti. Dentro il pannello la plancia un gettone
 * non ce l'ha: le sue richieste a `/api/` valgono solo se firmate dal socket
 * (`authSig`) o col gettone della telecamera (`token=`). Tutto il resto puo'
 * solo prendersi un 401 — e far suonare.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  SENZA_CREDENZIALE,
  bussaSenzaCredenziali,
  installIndirizzoDiCasa,
} from "../src/sections/indirizzo-di-casa-section.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

function dentroIlPannello(corpo) {
  const prima = {
    hosted: globalThis.__DASHBOARDMODERN_HOSTED__,
    gettone: globalThis.DASHBOARDMODERN_AUTH_TOKEN,
  };
  globalThis.__DASHBOARDMODERN_HOSTED__ = true;
  delete globalThis.DASHBOARDMODERN_AUTH_TOKEN;
  try {
    return corpo();
  } finally {
    if (prima.hosted === undefined) delete globalThis.__DASHBOARDMODERN_HOSTED__;
    else globalThis.__DASHBOARDMODERN_HOSTED__ = prima.hosted;
    if (prima.gettone === undefined) delete globalThis.DASHBOARDMODERN_AUTH_TOKEN;
    else globalThis.DASHBOARDMODERN_AUTH_TOKEN = prima.gettone;
  }
}

test("fuori dal pannello non si tocca niente", () => {
  delete globalThis.__DASHBOARDMODERN_HOSTED__;
  assert.equal(bussaSenzaCredenziali("/api/calendars/calendar.casa?start=a&end=b"), false);
});

test("dentro il pannello una richiesta senza credenziali non esce; firmata o col gettone sì", () => {
  dentroIlPannello(() => {
    assert.equal(bussaSenzaCredenziali("/api/calendars/calendar.casa?start=a&end=b"), true);
    assert.equal(bussaSenzaCredenziali("https://casa.duckdns.org/api/states"), true);
    /* Firmata dal socket: passa. */
    assert.equal(bussaSenzaCredenziali("/api/calendars/calendar.casa?start=a&authSig=eyJ.x.y"), false);
    /* Col gettone della telecamera: passa. */
    assert.equal(bussaSenzaCredenziali("/api/camera_proxy/camera.ingresso?token=abc&t=1"), false);
    /* Con un gettone vero — la pagina servita da sola — passa tutto. */
    globalThis.DASHBOARDMODERN_AUTH_TOKEN = "gettone-vero";
    assert.equal(bussaSenzaCredenziali("/api/calendars/calendar.casa"), false);
  });
});

test("la riparazione di fetch da' il 401 in casa, senza bussare", async () => {
  const chiamate = [];
  const originale = globalThis.fetch;
  globalThis.fetch = async (risorsa, init) => {
    chiamate.push({ risorsa, init });
    return new Response("{}", { status: 200 });
  };
  try {
    assert.equal(installIndirizzoDiCasa(), true);
    await dentroIlPannello(async () => {
      const nuda = await globalThis.fetch("/api/calendars/calendar.casa?start=a&end=b", {
        credentials: "include",
      });
      assert.equal(nuda.status, SENZA_CREDENZIALE);
      assert.equal(nuda.ok, false);
      assert.deepEqual(chiamate, [], "una richiesta nuda non deve uscire dal pannello");

      const firmata = await globalThis.fetch("/api/camera_proxy/camera.x?token=abc");
      assert.equal(firmata.status, 200);
      assert.equal(chiamate.length, 1);
    });
    /* Quello che non va a Home Assistant non si guarda nemmeno. */
    await globalThis.fetch("https://tile.example/1/2/3.png");
    assert.equal(chiamate.length, 2);
  } finally {
    globalThis.fetch = originale;
  }
});

test("l'Agenda senza firma non bussa: passa al servizio", () => {
  const home = leggi("sections/home-widgets-section.js");
  assert.match(home, /if \(!gettone && !firmato\) return null;/);
  /* E il servizio c'e' ancora, per chi non ha la porta HTTP. */
  assert.match(home, /service: "get_events"/);
});
