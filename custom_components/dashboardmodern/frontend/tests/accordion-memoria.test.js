/* Gli accordion del Config restano come l'utente li ha lasciati.
 *
 * Cancellare una riga ridisegna la scheda intera, e ogni <details> rinasceva
 * chiuso: dentro Avvisi si apriva Aperture, si cancellava un sensore e il
 * gruppo si richiudeva sopra la mano. La memoria vive per scheda e la chiave
 * e' l'intestazione senza i contatori, che cambiano proprio cancellando. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  accordionKey,
  restoreAccordions,
} from "../src/sections/config-uniformity-section.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const state = globalThis.__DASHBOARDMODERN_CONFIG_UNIFORMITY__;

/* Un <details> finto quanto basta: summary con l'etichetta e la pastiglia
 * del conteggio, che accordionKey deve togliere. */
function fakeDetails(label, count, open) {
  return {
    open,
    querySelector: (selector) => {
      if (selector !== ":scope > summary") return null;
      return {
        cloneNode: () => {
          let badge = count;
          return {
            querySelectorAll: () =>
              badge === undefined ? [] : [{ remove: () => (badge = undefined) }],
            get textContent() {
              return badge === undefined ? ` ${label} ` : ` ${label}   ${badge} `;
            },
          };
        },
      };
    },
  };
}

test("la chiave e' l'intestazione, mai il conteggio", () => {
  const prima = fakeDetails("🚪 Aperture", 5, true);
  const dopo = fakeDetails("🚪 Aperture", 4, false);
  assert.equal(accordionKey(prima), "🚪 Aperture");
  assert.equal(accordionKey(prima), accordionKey(dopo));
});

test("dopo il ridisegno ogni accordion torna come lo si era lasciato", () => {
  state.accordions = {
    avvisi: { "🚪 Aperture": true, "⭐ Personalizzati": false },
  };
  const aperture = fakeDetails("🚪 Aperture", 4, false); // rinato chiuso
  const custom = fakeDetails("⭐ Personalizzati", 2, true); // rinato aperto
  const batterie = fakeDetails("🔋 Batterie", 3, false); // mai toccato
  const body = { querySelectorAll: () => [aperture, custom, batterie] };
  const restored = restoreAccordions(body, "avvisi");
  assert.equal(restored, 2);
  assert.equal(aperture.open, true);
  assert.equal(custom.open, false);
  // Chi non e' in memoria resta nello stato con cui il markup l'ha scritto.
  assert.equal(batterie.open, false);
  delete state.accordions;
});

test("la memoria e' della scheda, non del modale intero", () => {
  state.accordions = { avvisi: { "🚪 Aperture": true } };
  const aperture = fakeDetails("🚪 Aperture", 4, false);
  const body = { querySelectorAll: () => [aperture] };
  // Su un'altra scheda una chiave uguale non deve scattare.
  assert.equal(restoreAccordions(body, "energia"), 0);
  assert.equal(aperture.open, false);
  assert.equal(restoreAccordions(body, "avvisi"), 1);
  assert.equal(aperture.open, true);
  delete state.accordions;
});

test("la passata di uniformita' ripristina, e i toggle vengono ascoltati", async () => {
  const source = await read("../src/sections/config-uniformity-section.js");
  assert.match(source, /restoreAccordions\(body, tab\)/);
  assert.match(source, /addEventListener\("toggle", rememberAccordion, true\)/);
});
