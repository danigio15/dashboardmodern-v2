/* «Il meteo radar non va: se metto casa non si vede nulla.»
 *
 * Due cose mancavano, e tutte e due facevano lo stesso vuoto. Il posto: casa si
 * leggeva da `zone.home` fra gli stati e in ripiego da `hass.config`, che nella
 * plancia ospitata non esiste — e senza posto niente quadratini. E la fonte:
 * l'indirizzo del servizio andava scritto a mano, e chi sceglieva «Casa» senza
 * saperne scrivere uno aveva un radar che sapeva dove guardare e non cosa.
 *
 * Adesso casa si chiede a Home Assistant (`get_config`) quando la zona non c'e',
 * e i servizi che si conoscono si scelgono da una tendina. Queste prove tengono
 * ferme le due strade e il fatto che nessuna delle due parta da sola.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { modelloVivo, radarScelto, servizioScelto } from "../src/sections/radar-meteo-section.js";

const sorgente = readFileSync(
  new URL("../src/sections/radar-meteo-section.js", import.meta.url),
  "utf8",
);

test("da dove arrivano i quadratini: la tendina, un indirizzo proprio, o niente", () => {
  /* Di serie la pioggia arriva da RainViewer: «se metto casa non si vede nulla»
   * finisce qui. Chi non vuole nessun servizio lo dice con «nessuno». */
  assert.equal(servizioScelto({}), "rainviewer");
  assert.equal(servizioScelto({ servizio: "nessuno" }), "");
  assert.equal(servizioScelto({ servizio: "none" }), "");
  assert.equal(servizioScelto({ servizio: "rainviewer" }), "rainviewer");
  assert.equal(
    servizioScelto({ servizio: "modello", modello: "https://e/{z}/{x}/{y}.png" }),
    "modello",
  );
  /* «Un indirizzo mio» senza indirizzo non e' una scelta. */
  assert.equal(servizioScelto({ servizio: "modello", modello: "https://fisso.png" }), "");
  assert.equal(servizioScelto({ servizio: "boh" }), "");
  /* Chi aveva scritto l'indirizzo prima che la tendina esistesse: l'indirizzo
   * con i segnaposto basta a dire «il mio». */
  assert.equal(servizioScelto({ modello: "https://e/{z}/{x}/{y}.png" }), "modello");
  assert.equal(radarScelto({ modello: "https://e/{z}/{x}/{y}.png" }).servizio, "modello");
  assert.equal(radarScelto({ modello: "https://e/{z}/{x}/{y}.png" }).modo, "mappa");
});

test("il modello vivo: il proprio subito, quello del servizio quando il fotogramma arriva", async () => {
  const mio = radarScelto({ servizio: "modello", modello: "https://e/{z}/{x}/{y}.png" });
  assert.equal(modelloVivo(mio), "https://e/{z}/{x}/{y}.png");
  assert.equal(modelloVivo(null), "");
  assert.equal(modelloVivo(radarScelto({ entity: "camera.radar" })), "");

  /* Il servizio: la prima lettura non ha ancora il fotogramma e chiede
   * l'elenco — UNA richiesta, all'indirizzo dichiarato nel nucleo. */
  const chieste = [];
  const fetchDiPrima = globalThis.fetch;
  globalThis.fetch = async (url) => {
    chieste.push(String(url));
    return {
      ok: true,
      json: async () => ({
        host: "https://tilecache.rainviewer.com",
        radar: { past: [{ time: 1700000600, path: "/v2/radar/1700000600" }] },
      }),
    };
  };
  try {
    const servizio = radarScelto({ servizio: "rainviewer" });
    assert.equal(modelloVivo(servizio), "", "prima del fotogramma non c'e' indirizzo");
    modelloVivo(servizio);
    await new Promise((fine) => setTimeout(fine, 10));
    assert.deepEqual(chieste, ["https://api.rainviewer.com/public/weather-maps.json"]);
    assert.equal(
      modelloVivo(servizio),
      "https://tilecache.rainviewer.com/v2/radar/1700000600/256/{z}/{x}/{y}/2/1_1.png",
    );
  } finally {
    globalThis.fetch = fetchDiPrima;
  }
});

test("casa si chiede a Home Assistant quando la zona non c'e', e intanto si aspetta", () => {
  assert.match(sorgente, /chiediAHomeAssistant\(\{ type: "get_config" \}\)/);
  /* Senza posto il blocco dice «attesa» mentre chiede, non «muto». */
  assert.match(sorgente, /nodo\.dataset\.dmRadar = chiediLaCasa\(\) \? "attesa" : "muto";/);
  /* E la casa che arriva si passa al motore al posto di `hass.config`. */
  assert.match(sorgente, /luogoDelRadar\(scelto, allStates\(\), casaNota\(\)\)/);
  /* `hass.config` resta solo come ripiego dentro `casaNota`, mai passato al
   * motore direttamente: nella plancia ospitata e' vuoto. */
  assert.doesNotMatch(sorgente, /luogoDelRadar\([^)]*root\.hass/);
  assert.match(sorgente, /return state\.casa \|\| root\.hass\?\.config \|\| \{\};/);
});

test("la tendina dice cosa si sceglie, e la nota sotto il radar da chi arriva", () => {
  assert.match(sorgente, /data-dm-radar-campo="servizio"/);
  assert.match(sorgente, /data-dm-radar-campo="fondo"/);
  /* L'indirizzo proprio compare solo con «un indirizzo mio». */
  assert.match(sorgente, /data-dm-radar-solo="modello"/);
  assert.match(sorgente, /data-dm-radar-solo="fondo-modello"/);
  assert.match(sorgente, /\[data-dm-radar-solo\]\[hidden\]\{display:none!important\}/);
  /* La nota sotto il titolo nomina il servizio: chi guarda sa a chi la sua
   * plancia sta chiedendo la pioggia. Con un indirizzo scritto a mano si legge
   * l'ospite a cui bussa — prima li' non c'era scritto niente, e una plancia
   * che chiede la pioggia al servizio sbagliato non aveva modo di dirlo. */
  assert.match(sorgente, /etichettaDelServizio\(\s*scelto,[\s\S]{0,120}?nomeDelFondo\(scelto\),/);
  assert.match(sorgente, /export function nomeDelServizio/);
  /* E lo zoom a cui sta chiedendo i quadratini: «c'e' ancora quella scritta
   * sullo zoom» (#323) non si puo' rispondere senza sapere quale livello sia. */
  assert.match(sorgente, /`z\$\{finestraTessere\.zoom\}`/);
  /* E dice anche da chi arriva la MAPPA.
   *
   * Le scritte «Zoom Level Not Supported» che si vedono sul campo (#323) le
   * stampa il servizio del FONDO, non quello della pioggia: chiedendo questa
   * riga per capire da dove arrivassero si otteneva la risposta a un'altra
   * domanda, e si perdeva un giro. Adesso ci sono tutti e due. */
  assert.match(sorgente, /export function nomeDelFondo/);
  /* E «Casa» resta la voce di serie della tendina del posto. */
  assert.match(
    sorgente,
    /<option value=""\$\{scelta \? "" : " selected"\}>\$\{esc\(t\("Casa", "Home"\)\)\}/,
  );
});

test("il nome del fondo si legge, e un servizio ritirato si riconosce", async () => {
  const { nomeDelFondo } = await import("../src/sections/radar-meteo-section.js");
  /* Un fondo dell'elenco si chiama col suo nome. */
  assert.equal(
    nomeDelFondo({ fondo: "https://tile.openstreetmap.org/{z}/{x}/{y}.png" }),
    "OpenStreetMap",
  );
  /* Uno scritto a mano porta il suo ospite: e' l'unica cosa che, guardando la
   * nota, permette di riconoscere un servizio che non risponde piu'. */
  assert.equal(
    nomeDelFondo({ fondo: "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png" }),
    "a.basemaps.cartocdn.com",
  );
  /* Senza fondo non si inventa un nome. */
  assert.equal(nomeDelFondo({}), "");
  assert.equal(nomeDelFondo({ fondo: "non un indirizzo" }), "");
});

test("la nota distingue «non risponde» da «non sta piovendo» (#323)", async () => {
  const { etichettaDelServizio } = await import("../src/sections/radar-meteo-section.js");
  /* Col fotogramma il radar e' vivo, e l'ora lo dimostra: un cielo sereno
   * sopra una mappa vuota non e' un radar rotto. */
  const vivo = etichettaDelServizio({ servizio: "rainviewer" }, { time: 1_757_000_000 });
  assert.match(vivo, /^RainViewer \d{1,2}[:.]\d{2}/);
  /* Senza, si dice quale delle due sta succedendo invece di tacere. */
  assert.match(
    etichettaDelServizio({ servizio: "rainviewer" }, null, true),
    /RainViewer — (in attesa|waiting)/,
  );
  assert.match(
    etichettaDelServizio({ servizio: "rainviewer" }, null, false),
    /RainViewer — (nessuna risposta|no answer)/,
  );
  /* Un indirizzo scritto a mano non ha un elenco da aspettare: resta il nome. */
  assert.equal(
    etichettaDelServizio({
      servizio: "modello",
      modello: "https://tiles.mio.it/{z}/{x}/{y}.png",
    }),
    "tiles.mio.it",
  );
  assert.equal(etichettaDelServizio({}), "");
});
