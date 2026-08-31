/* Le cose che si guardano e basta.
 *
 * «Non e' meglio oscurare il tasto accendi/spegni sulla presa del frigo?» —
 * si', e non e' una preferenza estetica: un tasto che non va premuto non
 * dovrebbe esserci. La presa del frigo, quella del modem, il congelatore in
 * garage sono interruttori come gli altri, e la plancia li disegna come gli
 * altri; solo che premerli non e' mai una cosa che si voleva fare, e chi li
 * preme spesso non e' chi ha configurato la plancia.
 *
 * Il grigio da solo non basta, ed e' il punto di questa prova. Un tasto
 * disegnato spento che poi funziona lo stesso e' PEGGIO di un tasto normale:
 * chi lo guarda crede di non poterlo premere e chi lo preme scopre di si'. Le
 * pagine che comandano una luce sono quattro — Luci, Stanze, i riquadri della
 * Home, le Prese — e il rifiuto sta in un punto solo per cui passano tutte:
 * `lightCommand` non costruisce nemmeno il comando.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { lightCommand, lightView } from "../src/core/light-model.js";

const PRESA = {
  entity_id: "switch.presa_frigo",
  state: "on",
  attributes: { friendly_name: "Presa frigo" },
};

const vistaDi = (comandabile) =>
  lightView("switch.presa_frigo", { state: PRESA, comandabile });

test("una presa bloccata non produce nessun comando, in nessun verso", () => {
  const vista = vistaDi(false);
  assert.equal(vista.comandabile, false);
  for (const gesto of [{ power: false }, { power: true }, {}, { brightnessPct: 40 }]) {
    assert.equal(
      lightCommand(vista, gesto),
      null,
      `il gesto ${JSON.stringify(gesto)} ha prodotto un comando su una presa che non si comanda`,
    );
  }
});

test("la stessa presa, senza blocco, si comanda come prima", () => {
  const vista = vistaDi(true);
  assert.equal(vista.comandabile, true);
  assert.deepEqual(lightCommand(vista, { power: false }), {
    domain: "switch",
    service: "turn_off",
    data: { entity_id: "switch.presa_frigo" },
  });
});

test("chi non dice niente si comanda: il blocco si chiede, non si subisce", () => {
  /* Ogni chiamata che non sa niente di questa faccenda — e sono la maggioranza —
   * deve continuare a funzionare come prima. */
  const vista = lightView("switch.presa_frigo", { state: PRESA });
  assert.equal(vista.comandabile, true);
  assert.ok(lightCommand(vista, { power: true }));
});

test("una luce vera bloccata non si accende e non si scurisce", () => {
  const lampada = lightView("light.salone", {
    state: {
      entity_id: "light.salone",
      state: "on",
      attributes: { supported_color_modes: ["brightness"], brightness: 180 },
    },
    comandabile: false,
  });
  assert.equal(lampada.dimmable, true, "resta una lampada dimmerabile: cambia solo chi la comanda");
  assert.equal(lightCommand(lampada, { brightnessPct: 10 }), null);
  assert.equal(lightCommand(lampada, { power: true }), null);
});

test("il blocco non cambia niente di quello che la scheda racconta", () => {
  /* Sarebbe comodo spegnere anche il resto — «tanto non si comanda» — ed e'
   * sbagliato: la presa del frigo si guarda proprio per sapere se e' accesa. */
  const libera = vistaDi(true);
  const bloccata = vistaDi(false);
  for (const campo of ["on", "available", "name", "domain", "dimmable"])
    assert.deepEqual(bloccata[campo], libera[campo], `il blocco ha cambiato «${campo}»`);
});

/* ── l'elenco: chi e' bloccata, e chi lo scrive ──────────────────────────────
 *
 * L'elenco sta in un posto solo. Se ce ne fossero due, il tasto sarebbe grigio
 * su una pagina e vivo su un'altra — che e' il difetto che questa faccenda
 * doveva evitare, non crearne uno nuovo.
 */
test("l'elenco delle bloccate si scrive e si rilegge da un posto solo", async () => {
  const dentro = new Map();
  globalThis.localStorage = {
    getItem: (chiave) => (dentro.has(chiave) ? dentro.get(chiave) : null),
    setItem: (chiave, valore) => dentro.set(chiave, String(valore)),
    removeItem: (chiave) => dentro.delete(chiave),
  };
  const { segnaSoloLettura, siComanda } = await import("../src/sections/shared.js");

  assert.equal(siComanda("switch.presa_frigo"), true, "di partenza si comanda tutto");
  assert.equal(segnaSoloLettura("switch.presa_frigo", true), true);
  assert.equal(siComanda("switch.presa_frigo"), false);
  /* Bloccarla due volte non e' una modifica: senza questo, ogni giro di disegno
   * segnerebbe la configurazione come cambiata e partirebbe un salvataggio. */
  assert.equal(segnaSoloLettura("switch.presa_frigo", true), false);

  assert.equal(segnaSoloLettura("switch.presa_frigo", false), true);
  assert.equal(siComanda("switch.presa_frigo"), true);
  assert.equal(segnaSoloLettura("switch.presa_frigo", false), false);

  /* Le altre non c'entrano niente. */
  assert.equal(siComanda("switch.presa_tv"), true);
  /* Senza entita' non si dice di no: dire che manca un'entita' e' compito di
   * un altro. */
  assert.equal(siComanda(""), true);
});

/* ── e il divieto deve VIAGGIARE col modello ────────────────────────────────
 *
 * `lightCommand` rifiuta guardando `view.comandabile`, e la finestra dei
 * controlli disegna il lucchetto guardando lo stesso campo. Ma `lightView` da'
 * per buono che si comandi: chi costruisce la vista senza passare il divieto
 * ottiene un modello che dice di si' su tutta la linea — tasto acceso e
 * comando che parte davvero. E' successo proprio cosi' nelle viste della
 * finestra delle Luci, dove il divieto non veniva passato.
 */
test("chi costruisce una vista di luce passa il divieto, sempre", () => {
  const sorgente = readFileSync(
    new URL("../src/sections/lights-scene-section.js", import.meta.url),
    "utf8",
  );
  const costruite = (sorgente.match(/\blightView\(/g) || []).length;
  const conDivieto = (sorgente.match(/\bcomandabile:/g) || []).length;
  assert.ok(costruite >= 2, "le viste della finestra Luci sono almeno due");
  assert.equal(
    conDivieto,
    costruite,
    `${costruite} viste costruite ma solo ${conDivieto} portano il divieto`,
  );
});
