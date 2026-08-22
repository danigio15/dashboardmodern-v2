/* «Il bianco persiste su iOS.»
 *
 * Il modo chiosco scrive nel documento di Home Assistant — lo scorrimento
 * bloccato, le proprieta' degli antenati che imprigionerebbero un velo fisso —
 * e a toglierlo era la plancia stessa, chiamata da chi smonta attraverso
 * `frame.contentWindow`.
 *
 * Ma lo smontaggio parte da `disconnectedCallback`, cioe' *dopo* che il
 * pannello e la cornice sono gia' stati staccati dal documento: li' il
 * contesto della cornice puo' essere gia' finito. Chrome rimanda quella
 * distruzione a un giro successivo e la chiamata fa in tempo; WebKit la fa
 * subito, e su iPhone la chiamata non arrivava a nessuno. Restava tutto
 * addosso alle altre plance, e solo un ricaricamento vero le puliva —
 * riaprire l'app riprende la stessa pagina senza ricaricarla, quindi non
 * bastava. Su Android non si vedeva: e' la differenza fra i due motori.
 *
 * C'era gia' una prova che diceva «e se la cornice non risponde piu', si
 * smonta lo stesso», e passava: si smontava, rinunciando alla pulizia. Era il
 * difetto scambiato per un comportamento accettabile. Qui si pretende il
 * documento pulito *anche* quando il figlio non c'e' piu'.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  UNDO_ATTR,
  markUndo,
  releaseMarkedElements,
  restoreDeclarations,
} from "../src/core/kiosk-undo.js";

/* Un elemento con solo quello che serve: le dichiarazioni in linea, lette e
 * scritte per proprieta', e gli attributi. Se bastasse `cssText` la prova non
 * direbbe niente, perche' e' proprio `cssText` il modo sbagliato. */
function elementoFinto(inLinea = {}) {
  const dichiarazioni = new Map(Object.entries(inLinea).map(([k, v]) => [k, { valore: v, priorita: "" }]));
  const attributi = new Map();
  return {
    dichiarazioni,
    attributi,
    style: {
      getPropertyValue: (nome) => dichiarazioni.get(nome)?.valore ?? "",
      getPropertyPriority: (nome) => dichiarazioni.get(nome)?.priorita ?? "",
      setProperty: (nome, valore, priorita = "") =>
        dichiarazioni.set(nome, { valore: String(valore), priorita }),
      removeProperty: (nome) => dichiarazioni.delete(nome),
    },
    getAttribute: (nome) => attributi.get(nome) ?? null,
    setAttribute: (nome, valore) => attributi.set(nome, String(valore)),
    removeAttribute: (nome) => attributi.delete(nome),
  };
}

/* Il documento di Home Assistant: quello che conta e' saper trovare chi porta
 * il promemoria, che e' l'unica cosa che chi smonta ha davanti. */
function documentoFinto(elementi) {
  return {
    querySelectorAll: (selettore) =>
      selettore === `[${UNDO_ATTR}]` ? elementi.filter((e) => e.attributi.has(UNDO_ATTR)) : [],
  };
}

/** Quello che il chiosco scrive sul documento di Home Assistant. */
function accendiChiosco(html) {
  const prima = [];
  for (const [nome, valore] of [["overflow", "hidden"]]) {
    prima.push({
      nome,
      valore: html.style.getPropertyValue(nome),
      priorita: html.style.getPropertyPriority(nome),
    });
    html.style.setProperty(nome, valore, "important");
  }
  markUndo(html, prima);
}

test("chi smonta rimette a posto leggendo solo il documento", () => {
  /* Il tema di Home Assistant e' scritto proprio li', come stile in linea su
   * <html>: se la pulizia lo sfiorasse, la plancia successiva resterebbe senza
   * colori — che e' il bianco di cui si parla. */
  const html = elementoFinto({ "--primary-text-color": "#e1e1e1", "--card-background-color": "#1c1c1c" });
  accendiChiosco(html);
  assert.equal(html.style.getPropertyValue("overflow"), "hidden", "il chiosco ha scritto");

  releaseMarkedElements(documentoFinto([html]), ["data-dm-ios-kiosk"]);

  assert.equal(html.style.getPropertyValue("overflow"), "", "lo scorrimento e' tornato libero");
  assert.equal(
    html.style.getPropertyValue("--primary-text-color"),
    "#e1e1e1",
    "il tema di Home Assistant non si tocca",
  );
  assert.equal(html.style.getPropertyValue("--card-background-color"), "#1c1c1c");
  assert.equal(html.getAttribute(UNDO_ATTR), null, "il promemoria se ne va con la pulizia");
});

test("il valore di prima si rimette, non si cancella e basta", () => {
  const nodo = elementoFinto({ overflow: "auto" });
  accendiChiosco(nodo);
  releaseMarkedElements(documentoFinto([nodo]));
  assert.equal(nodo.style.getPropertyValue("overflow"), "auto", "com'era prima, non vuoto");
});

test("toccato due volte, si torna a com'era la prima", () => {
  /* Il velo, gli antenati e il blocco dello scorrimento possono toccare lo
   * stesso elemento: dal secondo giro in poi si rileggerebbe quello che ci
   * abbiamo scritto noi, e non si tornerebbe piu' indietro. */
  const nodo = elementoFinto({ transform: "translateX(-100%)" });
  for (let giro = 0; giro < 3; giro += 1) {
    const prima = [
      {
        nome: "transform",
        valore: nodo.style.getPropertyValue("transform"),
        priorita: nodo.style.getPropertyPriority("transform"),
      },
    ];
    nodo.style.setProperty("transform", "none", "important");
    markUndo(nodo, prima);
  }
  releaseMarkedElements(documentoFinto([nodo]));
  assert.equal(nodo.style.getPropertyValue("transform"), "translateX(-100%)");
});

test("pulire due volte non fa danno", () => {
  const nodo = elementoFinto({ overflow: "auto" });
  accendiChiosco(nodo);
  const documento = documentoFinto([nodo]);
  assert.equal(releaseMarkedElements(documento), 1);
  assert.equal(releaseMarkedElements(documento), 0, "la seconda non trova piu' niente");
  assert.equal(nodo.style.getPropertyValue("overflow"), "auto");
});

test("l'attributo del chiosco se ne va con la pulizia", () => {
  const nodo = elementoFinto({});
  accendiChiosco(nodo);
  nodo.setAttribute("data-dm-ios-kiosk", "true");
  releaseMarkedElements(documentoFinto([nodo]), ["data-dm-ios-kiosk"]);
  assert.equal(nodo.getAttribute("data-dm-ios-kiosk"), null);
});

test("rimettere non riassegna mai tutte le dichiarazioni insieme", () => {
  /* `cssText` non e' una proprieta': e' *tutte* le dichiarazioni in linea di
   * quell'elemento, tema di Home Assistant compreso. L'elemento finto non ce
   * l'ha nemmeno, quindi se qualcuno tornasse a usarlo questa prova cadrebbe
   * invece di lasciar passare la cosa. */
  const nodo = elementoFinto({ overflow: "auto" });
  assert.equal("cssText" in nodo.style, false, "l'elemento finto non offre la scorciatoia");
  restoreDeclarations(nodo, [{ nome: "overflow", valore: "scroll", priorita: "" }]);
  assert.equal(nodo.style.getPropertyValue("overflow"), "scroll");
});

test("chi smonta la plancia non si appoggia soltanto al figlio", () => {
  const host = new URL("../src/legacy/host.js", import.meta.url);
  const sorgente = readFileSync(host, "utf8");
  const destroy = sorgente.slice(sorgente.indexOf("destroy()"));
  const chiamata = destroy.indexOf("dmReleaseOwnerDocument");
  const pulizia = destroy.indexOf("releaseMarkedElements");
  const rimozione = destroy.indexOf("frame.remove()");
  assert.ok(chiamata > -1, "si chiede al figlio, che e' la strada precisa");
  assert.ok(pulizia > -1, "ma si ripassa comunque dal documento");
  assert.ok(pulizia > chiamata, "prima il figlio, poi quello che gli e' sfuggito");
  assert.ok(rimozione > pulizia, "e tutto prima che la cornice sparisca");
});

/* E dentro le radici ombra, che e' dove sta la roba che conta.
 *
 * `querySelectorAll` si ferma al confine di una radice ombra, e Home Assistant
 * e' fatto di quelle: il velo del chiosco, per non restare imprigionato, toglie
 * `transform` e compagnia proprio agli antenati che stanno la' dentro.
 * Fermarsi al documento voleva dire rimettere a posto `<html>` e `<body>` e
 * lasciare modificato tutto il resto — mezza pulizia creduta finita.
 */
function radiceFinta(elementi, figli = []) {
  return {
    querySelectorAll: (selettore) =>
      selettore === `[${UNDO_ATTR}]`
        ? elementi.filter((e) => e.attributi.has(UNDO_ATTR))
        : figli,
  };
}

test("si rimette a posto anche quello che sta dentro una radice ombra", () => {
  const dentro = elementoFinto({ transform: "translateX(-100%)" });
  markUndo(dentro, [{ nome: "transform", valore: "translateX(-100%)", priorita: "" }]);
  dentro.style.setProperty("transform", "none", "important");

  const ospite = { shadowRoot: radiceFinta([dentro], []) };
  const html = elementoFinto({});
  markUndo(html, [{ nome: "overflow", valore: "auto", priorita: "" }]);
  html.style.setProperty("overflow", "hidden", "important");
  const documento = radiceFinta([html], [ospite]);

  assert.equal(releaseMarkedElements(documento), 2, "vanno rimessi tutti e due");
  assert.equal(html.style.getPropertyValue("overflow"), "auto");
  assert.equal(
    dentro.style.getPropertyValue("transform"),
    "translateX(-100%)",
    "l'antenato dentro l'ombra e' rimasto modificato",
  );
});

test("una radice che ricompare non manda in tondo", () => {
  // Lo stesso pezzo di interfaccia puo' affacciarsi da piu' parti.
  const dentro = elementoFinto({});
  markUndo(dentro, [{ nome: "filter", valore: "", priorita: "" }]);
  dentro.style.setProperty("filter", "none", "important");
  const condivisa = radiceFinta([dentro], []);
  const uno = { shadowRoot: condivisa };
  const due = { shadowRoot: condivisa };
  assert.equal(releaseMarkedElements(radiceFinta([], [uno, due])), 1, "una volta sola");
  assert.equal(dentro.style.getPropertyValue("filter"), "");
});
