/* «Non si può interagire con le schede allerte per espandere le informazioni»
 *  (#422).
 *
 * La tessera dice il minimo per alzare la testa: icona, nome, livello, una
 * frase e due righe. Il resto c'era già e non si vedeva — il testo di un
 * avviso della protezione civile lo si tagliava a centottanta caratteri per
 * farlo stare nel riquadro, e tutto quello che l'integrazione scrive negli
 * attributi non usciva da nessuna parte.
 *
 * Adesso la tessera si apre. Ma solo se dentro c'è qualcosa in più di quello
 * che si vede già: un riquadro che sembra premibile e non fa niente è peggio
 * di uno fermo, perché la seconda volta non si prova più nemmeno dove invece
 * funzionava.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  RUMORE,
  TESTO_LUNGO,
  comeSiLegge,
  titoloDellaVoce,
  valeLaPenaAprirla,
  vociDelDettaglio,
} from "../src/core/dettaglio-allerta.js";

const sezione = new URL("../src/sections/allerte-section.js", import.meta.url);

/* Un avviso della protezione civile come lo scrive la sua integrazione. */
const PROTEZIONE_CIVILE = {
  friendly_name: "Allerta Protezione Civile",
  icon: "mdi:alert",
  event_description:
    "Dalle ore 12:00 di oggi e per le successive 18 ore si prevedono precipitazioni diffuse, anche a carattere di rovescio o temporale, sulla zona di allerta.",
  severity: "Moderate",
  zone: ["Zona A", "Zona B"],
  valid_from: "2026-09-09T12:00:00+02:00",
};

test("esce quello che l'integrazione scrive, e non il modo in cui HA tiene l'entità", () => {
  const voci = vociDelDettaglio(PROTEZIONE_CIVILE);
  const chiavi = voci.map((voce) => voce.chiave);
  assert.deepEqual(chiavi, ["event_description", "severity", "zone", "valid_from"]);
  /* `friendly_name` è già il titolo della finestra e `icon` è già disegnata:
   * occuperebbero le prime righe con roba che non dice niente, proprio dove
   * si è venuti a leggere. */
  assert.ok(RUMORE.has("friendly_name") && RUMORE.has("icon"));
});

test("un paragrafo si riconosce da solo: chi disegna non deve misurarlo", () => {
  const voci = vociDelDettaglio(PROTEZIONE_CIVILE);
  const testo = voci.find((voce) => voce.chiave === "event_description");
  assert.equal(testo.lungo, true);
  assert.ok(testo.valore.length > TESTO_LUNGO);
  /* E per intero: è la tessera che lo taglia, non questo. */
  assert.equal(testo.valore, PROTEZIONE_CIVILE.event_description);
  assert.equal(voci.find((voce) => voce.chiave === "severity").lungo, false);
});

test("i nomi si scrivono come una frase, ma non si traducono", () => {
  /* Sono nomi che l'integrazione ha scelto: tradurli vorrebbe dire indovinare
   * cosa intendeva. Almeno non si leggono come una chiave. */
  assert.equal(titoloDellaVoce("event_description"), "Event description");
  assert.equal(titoloDellaVoce("valid-from"), "Valid from");
  assert.equal(titoloDellaVoce(""), "");
  assert.equal(titoloDellaVoce(undefined), "");
});

test("un valore che non si può leggere non si mostra", () => {
  /* Stampare un oggetto vuol dire scriverci «[object Object]», che è peggio
   * di non scrivere niente. */
  assert.equal(comeSiLegge({ roba: 1 }), "");
  assert.equal(comeSiLegge(undefined), "");
  assert.equal(comeSiLegge(Number.NaN), "");
  assert.equal(comeSiLegge(["a", { b: 2 }, "c"]), "a, c");
  assert.equal(comeSiLegge(0), "0");
  assert.equal(comeSiLegge(false), "no");
  assert.equal(vociDelDettaglio({ payload: { a: 1 }, vuoto: "   " }).length, 0);
});

test("una tessera senza niente dentro non finge di essere premibile", () => {
  assert.equal(valeLaPenaAprirla({}, {}), false);
  assert.equal(valeLaPenaAprirla({}, { friendly_name: "Solo il nome" }), false);
  assert.equal(valeLaPenaAprirla({}, PROTEZIONE_CIVILE), true);
  /* Il testo intero che la tessera taglia è già un motivo per aprirla, anche
   * senza un solo attributo interessante. */
  assert.equal(valeLaPenaAprirla({ testo: "un avviso lungo" }, {}), true);
  /* E le letture che una categoria si porta accanto in ALTRE entita': i
   * pollini presi uno per uno, gli indici del disagio (#428). Guardando i soli
   * attributi dell'entita' principale, una tessera piena di righe sembrava
   * vuota e non si apriva. */
  assert.equal(valeLaPenaAprirla({ voci: [{ chiave: "erba", indice: 4 }] }, {}), true);
  assert.equal(valeLaPenaAprirla({ voci: [] }, {}), false);
});

test("solo le tessere apribili invitano il dito, e si aprono anche da tastiera", async () => {
  const source = await readFile(sezione, "utf8");
  assert.match(
    source,
    /const apribile = valeLaPenaAprirla\(lettura, attributiDi\(lettura\.entity\)\);/,
  );
  assert.match(source, /data-dm-allerta-apri/);
  assert.match(source, /role="button" tabindex="0" aria-haspopup="dialog"/);
  /* Un bottone che risponde solo al dito è un bottone a metà. */
  assert.match(source, /evento\.key !== "Enter" && evento\.key !== " "/);
  assert.match(source, /if \(evento\.key === "Escape"\)/);
});

test("la finestra è quella di tutte le altre, e il gesto è agganciato al documento", async () => {
  const source = await readFile(sezione, "utf8");
  /* La veste sta in un posto solo: `.modal-wrapper` più `.modal-card`. */
  assert.match(source, /modal\.className = "modal-wrapper";/);
  assert.match(source, /class="modal-card dm-allerta-dettaglio"/);
  assert.match(source, /role="dialog" aria-modal="true"/);
  /* Le tessere si rifanno a ogni ridisegno: un gestore per tessera sarebbe da
   * riattaccare ogni volta, cioè da dimenticare una volta. */
  assert.match(source, /doc\.addEventListener\("click", \(evento\) => \{\s*const tessera/);
  /* E si chiude da fuori, come ogni altra finestra della plancia. */
  assert.match(
    source,
    /if \(evento\.target === modal \|\| evento\.target\?\.closest\?\.\("\[data-dm-chiudi\]"\)\)/,
  );
});
