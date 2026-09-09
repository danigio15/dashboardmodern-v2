// DM-FIX-20260815A
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

/* La linguetta della stanza porta il DISEGNO, non l'emoji.
 *
 * Dal campo: «nelle stanze degli elettrodomestici ci sono icone che non sono
 * del nostro catalogo — non voglio vedere icone che non sono nostre». Qui si
 * chiedeva `iconGlyph`, che di un nome mdi torna l'emoji del telefono; adesso
 * si chiede il disegno, lo stesso delle tessere.
 *
 * Il tasto finto modella la cosa che conta: scrivere `innerHTML` cambia anche
 * `textContent`, ed e' quello che rende il giro idempotente — al secondo passo
 * il prefisso `mdi:` non c'e' piu' e non si tocca piu' niente. */
test("appliance room tab normalization replaces an MDI prefix once", async () => {
  const button = {
    _html: "",
    textContent: "mdi:bed-king-outline Cameretta",
    set innerHTML(valore) {
      this._html = valore;
      this.textContent = String(valore).replaceAll(/<[^>]*>/g, "");
    },
    get innerHTML() {
      return this._html;
    },
  };
  globalThis.document = {
    documentElement: { lang: "it" },
    querySelectorAll: (selector) =>
      selector === "#page-appliances-main .sub-tabs-energy .appl-section-tab" ? [button] : [],
    getElementById: () => null,
    querySelector: () => null,
    addEventListener: () => {},
  };
  const module = await import(`../src/sections/appliances-section.js?fix=${Date.now()}`);
  assert.equal(module.normalizeApplianceRoomTabs(), true);
  assert.match(button.innerHTML, /<svg/, "la linguetta deve portare il disegno del catalogo");
  /* Il nome mdi resta negli attributi del disegno — e' la firma con cui il
   * motore riconosce quello che ha gia' scritto — ma di leggibile non ne resta
   * niente: chi guarda vede il disegno e la parola. */
  assert.equal(button.textContent.trim(), "Cameretta");
  const prima = button.innerHTML;
  assert.equal(module.normalizeApplianceRoomTabs(), false);
  assert.equal(button.innerHTML, prima);
  button.textContent = "📊 Panoramica";
  assert.equal(module.normalizeApplianceRoomTabs(), false);
  assert.equal(button.textContent, "📊 Panoramica");
});

test("temperature row normalizer owns missing label nodes and fallback order", async () => {
  const source = await readFile(
    new URL("../src/sections/temperature-section.js", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /clean\(room\?\.name\).*clean\(row\.dataset\.roomName\).*clean\(row\.dataset\.roomId\)/s,
  );
  assert.match(source, /if \(!main\).*doc\.createElement\("div"\)/s);
  assert.match(source, /if \(!primary\).*primary\.className = "ed-row-new"/s);
  assert.match(source, /if \(!secondary\).*secondary\.className = "ed-row-old"/s);
  const entry = await readFile(new URL("../legacy/modules-entry.js", import.meta.url), "utf8");
  assert.match(entry, /room\.name \|\| "".*room\.id \|\| ""/s);
});
