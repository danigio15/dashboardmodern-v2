/* Rientrare nell'app non deve lasciare la plancia a "CONNECTING…".
 *
 * Su iPhone il sistema butta via la pagina dell'app quando passi ad altro: al
 * rientro il pannello la ricostruisce da zero. Il runtime apre la presa verso
 * Home Assistant una volta sola e, se quel tentativo salta — il ponte verso il
 * frontend ospite puo' non essere ancora pronto — non ne prova altri: resta la
 * scritta che sta nel documento appena aperto, i gradi a "--" e i riquadri
 * vuoti. Chiudere e riaprire l'app la sistemava, perche' era un avvio nuovo.
 */
import { expect, test } from "@playwright/test";
import { PRIMARY } from "./helpers/variants.js";

for (const variant of PRIMARY) {
  test(`${variant}: a socket that fails to open is retried, not given up on`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    // Il costruttore della presa salta, come quando il ponte non e' pronto.
    // Dal terzo tentativo in poi funziona: la plancia deve arrivarci da sola.
    await page.addInitScript(() => {
      const Real = window.WebSocket;
      window.__dmSocketAttempts__ = 0;
      const Guarded = function (...args) {
        window.__dmSocketAttempts__ += 1;
        if (window.__dmSocketAttempts__ <= 2) throw new Error("bridge not ready");
        return new Real(...args);
      };
      Guarded.CONNECTING = Real.CONNECTING;
      Guarded.OPEN = Real.OPEN;
      Guarded.CLOSING = Real.CLOSING;
      Guarded.CLOSED = Real.CLOSED;
      window.WebSocket = Guarded;
    });

    await page.goto(`/legacy/${variant}`);
    await page.waitForFunction(() => Boolean(window.DashboardModernModules), null, {
      timeout: 20000,
    });
    // Il modulo arriva qualche istante dopo il deposito: agire prima vorrebbe
    // dire mettere alla prova qualcosa che non c'e' ancora.
    await page.waitForFunction(
      () => Boolean(window.__DASHBOARDMODERN_CONNECTION_RECOVERY__?.installed),
      null,
      { timeout: 20000 },
    );

    // Il primo tentativo e' saltato e il runtime, da solo, non ne farebbe altri.
    await expect
      .poll(() => page.evaluate(() => window.__dmSocketAttempts__), { timeout: 30000 })
      .toBeGreaterThan(2);

    // E mentre riprova lo dice: la scritta del documento appena aperto non
    // resta li' a far credere che stia succedendo qualcosa la prima volta.
    await expect
      .poll(() => page.evaluate(() => document.getElementById("conn-text")?.textContent || ""), {
        timeout: 30000,
      })
      .toMatch(/riconness|reconnect/i);
  });

  test(`${variant}: coming back to the app asks for the connection again`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.goto(`/legacy/${variant}`);
    await page.waitForFunction(() => Boolean(window.DashboardModernModules), null, {
      timeout: 20000,
    });
    // Il modulo arriva qualche istante dopo il deposito: agire prima vorrebbe
    // dire mettere alla prova qualcosa che non c'e' ancora.
    await page.waitForFunction(
      () => Boolean(window.__DASHBOARDMODERN_CONNECTION_RECOVERY__?.installed),
      null,
      { timeout: 20000 },
    );

    /* Chi ha chiamato, non quando.
     *
     * Anche il runtime richiama connect() cinque secondi dopo ogni chiusura:
     * misurare il tempo vorrebbe dire tirare a indovinare quale dei due ha
     * parlato. La chiamata porta con se' la propria pila, e li' il nome della
     * funzione dice da dove arriva. */
    const wrapped = await page.evaluate(() => {
      window.__dmConnectStacks__ = [];
      const previous = window.connect;
      if (typeof previous !== "function") return false;
      window.connect = function () {
        window.__dmConnectStacks__.push(String(new Error().stack || ""));
      };
      return true;
    });
    expect(wrapped, "the runtime exposes the connection it opens").toBe(true);

    // Lo stato in cui iOS lascia la pagina: la presa non c'e' piu'. Una presa
    // che si sta ancora aprendo non va raddoppiata, ed e' giusto cosi': qui non
    // ce n'e' nessuna da rispettare.
    await page.evaluate(() => {
      try {
        window.eval("typeof ws !== 'undefined' && ws && ws.close && ws.close()");
      } catch (error) {}
    });
    await expect
      .poll(() =>
        page.evaluate(() => window.eval("typeof ws !== 'undefined' && ws ? ws.readyState : null")),
      )
      .toBe(3);

    // Il rientro: la pagina torna visibile e il sistema la risveglia.
    await page.evaluate(() => {
      window.__dmConnectStacks__.length = 0;
      window.dispatchEvent(new Event("pageshow"));
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });

    await expect
      .poll(
        () =>
          page.evaluate(() =>
            window.__dmConnectStacks__.some(
              (stack) => stack.includes("attemptReconnect") && stack.includes("resume"),
            ),
          ),
        { message: "il rientro richiede la connessione", timeout: 15000 },
      )
      .toBe(true);
  });
}
