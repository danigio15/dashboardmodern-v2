import { expect } from "@playwright/test";

export async function bootNamespacedDashboard(page, variant, testInfo, seed) {
  const instance = [
    "e2e",
    testInfo.project.name,
    variant.replace(/\W+/g, "-"),
    Math.random().toString(36).slice(2),
  ].join("-");

  // Seed the raw namespaced keys before dashboard scripts start. This avoids a
  // WebKit race where the first runtime writes an empty migrated state between
  // the post-load seed and page.reload(). The guard keeps later reloads from
  // resetting changes made by the test.
  await page.addInitScript(
    ({ dashboardSeed, storageInstance }) => {
      const storage = window.localStorage;
      const prefix = `cd_${storageInstance}_`;
      const getItem = Storage.prototype.getItem;
      const setItem = Storage.prototype.setItem;
      const setIfMissing = (key, value) => {
        const rawKey = `${prefix}${key}`;
        if (getItem.call(storage, rawKey) === null) {
          setItem.call(storage, rawKey, value);
        }
      };

      setIfMissing("dm_dashboard_state", JSON.stringify(dashboardSeed));
      setIfMissing(
        "cd_connection",
        JSON.stringify({
          token: "e2e-token",
          ws_url: "ws://home-assistant.test/api/websocket",
        }),
      );
    },
    { dashboardSeed: seed, storageInstance: instance },
  );

  await page.goto(`/legacy/${variant}?dmi=${encodeURIComponent(instance)}`);
  await page.waitForFunction(() => Boolean(window.__DASHBOARDMODERN_STORAGE_NS__));
  await page.waitForFunction(
    () => window.__DASHBOARDMODERN_LEGACY_READY__ && window.DashboardModernModules,
  );
  await expect
    .poll(() => page.evaluate(() => DashboardModernModules.store.getState()))
    .toMatchObject({ schema_version: 4 });
  if (testInfo.project.name === "webkit-ipad") {
    await expect(page.locator("html")).toHaveClass(/dm-touch-navigation/);
    /* Quello che conta e' che alla barra ci si arrivi, non il modo.
     *
     * Qui si pretendeva la maniglia per tirare fuori il dock. Da quando la
     * barra parte ferma quella maniglia e' nascosta apposta — non c'e' niente
     * da tirare fuori — e questa riga faceva cadere all'avvio ogni prova del
     * progetto, che e' l'unico ad averla: sessanta rosse per una barra che
     * funzionava benissimo. */
    await expect
      .poll(() =>
        page.evaluate(() => {
          const dipinto = (nodo) => {
            if (!nodo) return false;
            const stile = getComputedStyle(nodo);
            if (stile.display === "none" || stile.visibility === "hidden" || stile.opacity === "0")
              return false;
            const riquadro = nodo.getBoundingClientRect();
            return riquadro.width > 0 && riquadro.height > 0;
          };
          if (dipinto(document.getElementById("bottomNavHandle"))) return "maniglia";
          const barra = document.querySelector("nav.tabs.bottom-nav-bar");
          if (!barra) return "niente";
          /* La tenda non conta.
           *
           * `opacity:0` finche' la barra non sa che forma avere e' la politica
           * di comparsa della barra, ha le sue prove, e non dice niente su «ci
           * si arriva»: dice solo che non e' ancora il momento di guardarla.
           * Guardarla qui legava l'avvio di TUTTE le prove del tablet a quel
           * momento, e quando la configurazione condivisa non arriva — dentro
           * una prova non arriva mai, il ponte e' finto — quel momento e'
           * l'ultimo appello: quattro secondi di attesa a ogni prova, e chi
           * scriveva nella pagina appena avviata scriveva quattro secondi
           * tardi. Qui si guarda dove sta la barra: ferma in fondo allo
           * schermo e' raggiungibile, coperta o no. */
          const riquadro = barra.getBoundingClientRect();
          return riquadro.top < window.innerHeight - 1 ? "barra ferma" : "niente";
        }),
      )
      .not.toBe("niente");
  }
}
