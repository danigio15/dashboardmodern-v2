import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "custom_components/dashboardmodern/frontend/e2e",
  // The list reporter is on in CI as well: the dot line the github reporter
  // prints says how many tests failed and nothing about which, and the html
  // report is an artifact you have to download to read. A job that goes red
  // should say why in its own log.
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  retries: process.env.CI ? 2 : 0,
  expect: {
    timeout: process.env.CI ? 10_000 : 5_000,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python -m http.server 4173 --directory custom_components/dashboardmodern/frontend",
    port: 4173,
    reuseExistingServer: true,
  },
  // Il tetto di tempo di una prova e' un fatto del browser, non della prova.
  //
  // Il valore di serie e' trenta secondi, e vale lo stesso per tutti e tre i
  // progetti — ma WebKit su iPad, dentro un contenitore, ci mette circa una
  // volta e mezza quello che ci mette Chromium. `phase6-functional` gira in
  // diciotto secondi sul desktop: su WebKit sotto carico passa i trenta, e
  // cade. Non resta appesa da nessuna parte — il tempo finisce mentre fa
  // l'ultima cosa, e infatti cade in un punto diverso a ogni giro.
  //
  // Che il tetto di serie fosse stretto lo diceva gia' la suite da sola: in
  // cinquantacinque file c'e' scritto a mano
  // `setTimeout(project === "webkit-ipad" ? 120_000 : 75_000)`, novantacinque
  // volte. E le prove che cadono sono esattamente quelle a cui nessuno si e'
  // ricordato di scriverlo — `phase6-functional` sulla PR, `beta32-real-device-
  // uniformity` su main. Una regola da ricordare a mano in ogni file nuovo non
  // e' una regola: e' un tranello.
  //
  // Quindi il pavimento sta qui, dove il browser e' dichiarato. Quello scritto
  // nelle singole prove resta, ed e' un'altra cosa: un permesso in piu' per i
  // giri lunghi, sopra il pavimento, non il pavimento stesso. Nessuna prova
  // perde tempo, perche' ogni valore scritto a mano e' gia' maggiore o uguale.
  projects: [
    { name: "desktop", timeout: 75_000, use: { viewport: { width: 1440, height: 900 } } },
    {
      name: "mobile",
      timeout: 75_000,
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: "webkit-ipad",
      timeout: 120_000,
      use: { ...devices["iPad Pro 11"], browserName: "webkit" },
    },
  ],
});
