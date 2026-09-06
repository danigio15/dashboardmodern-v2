/* Si dipinge per chi guarda, e solo di cio' che e' cambiato.
 *
 * Le pagine restano nel documento: il guscio le nasconde, non le toglie. Una
 * sezione che ridisegna a ogni mazzetto di stati — mezzo secondo, e una casa
 * vera ne manda di continuo — lavorava anche per le otto pagine che nessuno ha
 * davanti, e per la plancia messa da parte dietro un'altra pagina di Home
 * Assistant. La regola sta in un posto solo, e queste sono le sue prove.
 */
import assert from "node:assert/strict";
import test from "node:test";

const documento = {
  visibilityState: "visible",
  pagine: new Map(),
  getElementById(id) {
    return documento.pagine.get(id) || null;
  },
};

function pagina(id, attiva) {
  documento.pagine.set(id, { classList: { contains: (nome) => nome === "active" && attiva } });
}

globalThis.document = documento;
globalThis.localStorage = { getItem: () => null, setItem() {} };

const { ilCambioTocca, paginaVisibile, planciaVisibile } = await import(
  "../src/sections/shared.js"
);

test.afterEach(() => {
  documento.visibilityState = "visible";
  delete globalThis.__DASHBOARDMODERN_PARCHEGGIATA__;
});

test("la scheda in secondo piano spegne il disegno", () => {
  assert.equal(planciaVisibile(), true);
  documento.visibilityState = "hidden";
  assert.equal(planciaVisibile(), false);
});

test("e anche la plancia messa da parte", () => {
  /* Il parcheggio: chi ospita la plancia la mette al riparo quando si va su
   * un'altra pagina di Home Assistant. La cornice resta viva — e' tutto il
   * punto — ma nessuno la guarda: il documento dentro continua a dirsi
   * «visible», quindi senza questo segno le sezioni avrebbero continuato a
   * disegnare, e le telecamere a far lavorare il server di casa. */
  globalThis.__DASHBOARDMODERN_PARCHEGGIATA__ = true;
  assert.equal(planciaVisibile(), false);
  globalThis.__DASHBOARDMODERN_PARCHEGGIATA__ = false;
  assert.equal(planciaVisibile(), true);
});

test("si dipinge la pagina aperta, non le altre otto", () => {
  pagina("page-luci", true);
  pagina("page-prese", false);
  assert.equal(paginaVisibile("page-luci"), true);
  assert.equal(paginaVisibile("page-prese"), false);
  documento.visibilityState = "hidden";
  assert.equal(paginaVisibile("page-luci"), false, "nemmeno quella aperta, a scheda nascosta");
});

test("una pagina che non c'e' non spegne niente", () => {
  /* Chi la cerca disegna altrove — un guscio fatto in un altro modo, una
   * prova — e tacere li' vorrebbe dire spegnere quella sezione per sempre. */
  assert.equal(paginaVisibile("page-che-non-esiste"), true);
});

test("il mazzetto tocca solo chi ci sta dentro", () => {
  const mie = ["light.salone", "switch.presa"];
  const mazzetto = (entity_ids) => ({ detail: { entity_ids, coalesced: true } });
  assert.equal(ilCambioTocca(mazzetto(["light.salone"]), mie), true);
  assert.equal(ilCambioTocca(mazzetto(["sensor.altro", "switch.presa"]), mie), true);
  assert.equal(ilCambioTocca(mazzetto(["sensor.altro", "sensor.ancora"]), mie), false);
  /* Il vecchio avviso con una entita' sola vale come un mazzetto da uno. */
  assert.equal(ilCambioTocca({ detail: { entity_id: "light.salone" } }, mie), true);
  assert.equal(ilCambioTocca({ detail: { entity_id: "sensor.altro" } }, mie), false);
});

test("senza elenco, o senza entita' nell'avviso, si dipinge", () => {
  /* Una sezione che non sa dire cosa legge continua a fare come ha sempre
   * fatto, e un annuncio generico — «gli stati sono pronti» — non si scarta. */
  assert.equal(ilCambioTocca({ detail: { entity_ids: ["sensor.x"] } }, []), true);
  assert.equal(ilCambioTocca({ detail: {} }, ["light.salone"]), true);
  assert.equal(ilCambioTocca(undefined, ["light.salone"]), true);
  /* Un insieme va bene quanto una lista: le sezioni tengono i loro id cosi'. */
  assert.equal(ilCambioTocca({ detail: { entity_ids: ["a.b"] } }, new Set(["a.b"])), true);
  assert.equal(ilCambioTocca({ detail: { entity_ids: ["a.b"] } }, new Set(["c.d"])), false);
});
