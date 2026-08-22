/* Il velo del chiosco non deve portarsi via il tema di Home Assistant.
 *
 * Segnalato dal telefono: cambiando la barra da fissa a scomparsa lo schermo
 * diventa bianco «e cambia anche il tema di HA», e per tornare a posto bisogna
 * chiudere e riaprire l'app.
 *
 * Il velo scriveva `overflow` sul documento di Home Assistant e, per togliersi,
 * riassegnava `style.cssText` a com'era prima. Ma `cssText` non e' una
 * proprieta': e' tutte le dichiarazioni in linea di quell'elemento. E Home
 * Assistant il tema ce lo tiene esattamente li' — `applyThemesOnElement`
 * scrive ogni variabile del tema come stile in linea su `<html>`. Rimettere
 * `cssText` gliele cancellava tutte in un colpo, e lui non se ne accorgeva:
 * per lui il tema era applicato, quindi non lo riscriveva.
 *
 * Si prova sul comportamento, non sul testo: si scrive un tema come lo scrive
 * Home Assistant, si accende e si spegne il velo, e il tema deve essere ancora
 * li'.
 */

import assert from "node:assert/strict";
import test from "node:test";

/* Un `style` che si comporta come quello vero per quel che conta qui: le
 * proprieta' stanno una per una, e `cssText` le sostituisce tutte. */
function stileFinto() {
  const dichiarazioni = new Map();
  return {
    dichiarazioni,
    getPropertyValue: (nome) => dichiarazioni.get(nome)?.valore ?? "",
    getPropertyPriority: (nome) => dichiarazioni.get(nome)?.priorita ?? "",
    setProperty: (nome, valore, priorita = "") =>
      dichiarazioni.set(nome, { valore, priorita }),
    removeProperty: (nome) => dichiarazioni.delete(nome),
    get cssText() {
      return [...dichiarazioni]
        .map(([nome, { valore }]) => `${nome}: ${valore}`)
        .join("; ");
    },
    set cssText(testo) {
      dichiarazioni.clear();
      for (const pezzo of String(testo).split(";")) {
        const [nome, valore] = pezzo.split(":");
        if (nome?.trim() && valore?.trim())
          dichiarazioni.set(nome.trim(), { valore: valore.trim(), priorita: "" });
      }
    },
  };
}

/* Le due mosse del modulo, isolate: si segna cosa c'era e si rimette solo
 * quello. Sono la stessa forma di `ricordaEScrivi`/`rimetti`. */
function ricordaEScrivi(element, dichiarazioni) {
  const prima = [];
  for (const [nome, valore, priorita] of dichiarazioni) {
    prima.push({
      nome,
      valore: element.style.getPropertyValue(nome),
      priorita: element.style.getPropertyPriority(nome),
    });
    element.style.setProperty(nome, valore, priorita || "");
  }
  return prima;
}

function rimetti(element, prima = []) {
  for (const { nome, valore, priorita } of prima) {
    if (valore) element.style.setProperty(nome, valore, priorita || "");
    else element.style.removeProperty(nome);
  }
}

const conTema = () => {
  const element = { style: stileFinto() };
  // Come lo scrive Home Assistant: variabili in linea su <html>.
  element.style.setProperty("--primary-color", "#03a9f4");
  element.style.setProperty("--primary-background-color", "#111111");
  element.style.setProperty("--primary-text-color", "#e1e1e1");
  return element;
};

test("acceso e spento il velo, il tema e' ancora li'", () => {
  const html = conTema();
  const prima = ricordaEScrivi(html, [["overflow", "hidden", "important"]]);
  assert.equal(html.style.getPropertyValue("overflow"), "hidden");

  rimetti(html, prima);

  assert.equal(html.style.getPropertyValue("--primary-color"), "#03a9f4");
  assert.equal(html.style.getPropertyValue("--primary-background-color"), "#111111");
  assert.equal(html.style.getPropertyValue("--primary-text-color"), "#e1e1e1");
  assert.equal(html.style.getPropertyValue("overflow"), "");
});

test("un tema riscritto mentre il velo e' su non viene sorpassato", () => {
  const html = conTema();
  const prima = ricordaEScrivi(html, [["overflow", "hidden", "important"]]);

  // Home Assistant cambia tema mentre la plancia e' aperta.
  html.style.setProperty("--primary-color", "#ff9800");
  html.style.setProperty("--nuova-variabile", "42px");

  rimetti(html, prima);

  assert.equal(html.style.getPropertyValue("--primary-color"), "#ff9800");
  assert.equal(html.style.getPropertyValue("--nuova-variabile"), "42px");
});

test("un overflow che c'era gia' torna quello di prima, non sparisce", () => {
  const html = conTema();
  html.style.setProperty("overflow", "auto");
  const prima = ricordaEScrivi(html, [["overflow", "hidden", "important"]]);
  rimetti(html, prima);
  assert.equal(html.style.getPropertyValue("overflow"), "auto");
});

/* La prova che il vecchio modo era davvero distruttivo: se cade questa, il
 * meccanismo descritto qui sopra non e' quello che succedeva. */
test("rimettere cssText avrebbe cancellato il tema", () => {
  const html = conTema();
  const com_era = html.style.cssText;
  html.style.setProperty("overflow", "hidden", "important");
  // Home Assistant applica il tema mentre il velo e' su.
  html.style.setProperty("--tema-arrivato-dopo", "#123456");

  html.style.cssText = com_era;

  assert.equal(html.style.getPropertyValue("--tema-arrivato-dopo"), "");
});
