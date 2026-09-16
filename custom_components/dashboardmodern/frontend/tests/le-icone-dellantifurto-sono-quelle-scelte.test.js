/* «Le icone selezionate in configurazione sono diverse da quelle visualizzate
 * nella sezione Sicurezza» (#547, terzo punto).
 *
 * Chi si è fatto l'antifurto con uno script scrive i suoi tasti in
 * configurazione: un nome, un'entità, e un'icona scelta dal catalogo dei
 * disegni — il catalogo si apre, si sfoglia, si sceglie un disegno. Poi si
 * entrava nella Sicurezza e sul tasto c'era un'emoji.
 *
 * Non era un caso: le tre file di tasti dell'antifurto disegnavano in due modi
 * diversi. La finestra rapida del banner passava dal motore delle icone e
 * disegnava; la pagina e la tessera della Home scrivevano `voce.icon`, che è
 * l'emoji di ripiego che il catalogo tiene accanto a ogni voce. Un'emoji al
 * posto di un disegno non è la stessa icona in piccolo: è un'altra icona.
 *
 * E lo stesso valeva per il cartellone tondo in cima alla pagina, che il guscio
 * riempiva d'emoji — 🛡️ 🌙 🏡 ✈️ 🎚️ 🔓 🚨 ⏳ — anche quando l'inserimento acceso
 * era un tasto scritto a mano: la stessa icona scelta in configurazione resa in
 * due modi diversi a tre centimetri di distanza.
 *
 * Qui si prova che a disegnare un tasto dell'antifurto è una funzione sola, e
 * che quello che disegna è il catalogo — mai un'emoji.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { ALARM_DISARM, ALARM_MODES } from "../src/core/alarm-panel.js";

const leggi = (nome) => readFileSync(new URL(`../${nome}`, import.meta.url), "utf8");
const VETRINA = leggi("src/sections/security-showcase-section.js");
const TESSERA = leggi("src/sections/home-widgets-section.js");

const memoria = new Map();
test.before(() => {
  globalThis.localStorage ||= {
    getItem: (chiave) => (memoria.has(chiave) ? memoria.get(chiave) : null),
    setItem: (chiave, valore) => memoria.set(chiave, String(valore)),
    removeItem: (chiave) => memoria.delete(chiave),
  };
});

async function vetrina() {
  return import(`../src/sections/security-showcase-section.js?icone=${Date.now()}`);
}

test("un tasto di serie porta il disegno del catalogo, non l'emoji", async () => {
  const { disegnoDelTastoAntifurto } = await vetrina();
  for (const voce of [...ALARM_MODES, ALARM_DISARM]) {
    const disegno = disegnoDelTastoAntifurto(voce, 22);
    assert.match(disegno, /<svg/, `il tasto ${voce.mode} non disegna`);
    assert.doesNotMatch(disegno, /[\u{1F300}-\u{1FAFF}]/u, `il tasto ${voce.mode} scrive un'emoji`);
  }
});

test("un tasto scritto a mano porta l'icona scelta in configurazione", async () => {
  const { disegnoDelTastoAntifurto } = await vetrina();
  const mio = { suMisura: true, icona: "mdi:shield-home", icon: "🛡️" };
  const disegno = disegnoDelTastoAntifurto(mio, 22);
  /* Il motore delle icone marca il glifo col nome scelto, e quello che ne esce
   * è un disegno: è la prova che si è passati dalla scelta e non dal ripiego. */
  assert.match(disegno, /dm-icon-engine-glyph/);
  assert.match(disegno, /mdi:shield-home/);
  assert.match(disegno, /<svg/);
  assert.doesNotMatch(disegno, /[\u{1F300}-\u{1FAFF}]/u);
  /* E due icone diverse danno due disegni diversi: senza questo, «disegna
   * qualcosa» passerebbe anche se disegnasse sempre lo scudo. */
  const altro = disegnoDelTastoAntifurto({ suMisura: true, icona: "mdi:weather-night" }, 22);
  assert.notEqual(altro, disegno);
});

test("la misura la decide chi disegna: le tre caselle non sono uguali", async () => {
  const { disegnoDelTastoAntifurto } = await vetrina();
  const grande = disegnoDelTastoAntifurto({ disegno: "moon" }, 26);
  const piccolo = disegnoDelTastoAntifurto({ disegno: "moon" }, 16);
  assert.notEqual(grande, piccolo);
  assert.match(grande, /26/);
  assert.match(piccolo, /16/);
});

test("le tre file di tasti disegnano tutte con la stessa funzione", () => {
  /* La pagina. */
  assert.match(
    VETRINA,
    /<span class="dm-sec-mode-ic" aria-hidden="true">\$\{disegnoDelTastoAntifurto\(voce, 22\)\}<\/span>/,
  );
  /* La finestra rapida del banner. */
  assert.match(
    VETRINA,
    /<span class="qa-alarm-btn-icon">\$\{disegnoDelTastoAntifurto\(voce, 26\)\}<\/span>/,
  );
  /* La tessera della Home. */
  assert.match(TESSERA, /disegnoDelTastoAntifurto\(voce, 16\)/);
  /* E nessuna delle tre scrive più l'emoji di ripiego dentro un tasto. */
  assert.doesNotMatch(VETRINA, /aria-hidden="true">\$\{icon\}</);
  assert.doesNotMatch(TESSERA, /comando\(voce\.service, voce\.mode === acceso, voce\.icon/);
});

test("il cartellone tondo ha un disegno per ogni stato che il guscio racconta", async () => {
  const { DISEGNI_DEL_CARTELLONE, disegnoDelCartellone } = await vetrina();
  /* Gli stati che il guscio sa raccontare, presi dal guscio stesso: se un
   * giorno ne aggiunge uno, questa prova lo scopre invece di lasciarlo a
   * emoji. */
  const guscio = leggi("legacy/dashboard-runtime-it.js");
  const elenco = guscio.match(/const centraleHaRisposto = \[([^\]]+)\]/);
  assert.ok(elenco, "il guscio non elenca più gli stati della centrale");
  const stati = elenco[1].split(",").map((pezzo) => pezzo.trim().replace(/^'|'$/g, ""));
  assert.ok(stati.length >= 9);
  for (const stato of stati) {
    assert.ok(DISEGNI_DEL_CARTELLONE[stato], `lo stato ${stato} non ha un disegno`);
    assert.match(disegnoDelCartellone(stato), /<svg/);
  }
  /* Lo stato dell'inserimento e quello del suo tasto portano lo stesso segno:
   * il tondo e il tasto acceso sotto non possono dire due cose diverse. */
  for (const voce of [...ALARM_MODES, ALARM_DISARM])
    assert.equal(DISEGNI_DEL_CARTELLONE[voce.state], voce.disegno);
});

test("con un tasto scritto a mano acceso, il tondo porta la sua icona", async () => {
  const { disegnoDelCartellone } = await vetrina();
  const miei = [{ id: "su-misura-1", icona: "mdi:shield-home" }];
  const tondo = disegnoDelCartellone("su-misura-1", miei);
  assert.match(tondo, /dm-icon-engine-glyph/);
  assert.match(tondo, /mdi:shield-home/);
  assert.match(tondo, /<svg/);
  /* Quello che non si sa disegnare torna vuoto, e il guscio scrive l'emoji
   * come ha sempre fatto: un cartellone vuoto sarebbe peggio di un'emoji. */
  assert.equal(disegnoDelCartellone("chissa-che", miei), "");
  assert.equal(disegnoDelCartellone(""), "");
  assert.equal(disegnoDelCartellone(), "");
});

test("il guscio disegna il tondo, e scrive l'emoji solo se non c'è disegno", () => {
  for (const nome of ["legacy/dashboard-runtime-it.js", "legacy/dashboard-runtime-en.js"]) {
    const guscio = leggi(nome);
    assert.match(guscio, /disegnoDelTondo = dmAlarmOrbMarkup\(chiaveDelTondo\)/, nome);
    assert.match(guscio, /if \(disegnoDelTondo\) alIconEl\.innerHTML = disegnoDelTondo;/, nome);
    assert.match(guscio, /else alIconEl\.textContent = icon;/, nome);
    /* E la chiave è quella giusta: allarme scattato prima di tutto, poi il
     * tasto scritto a mano acceso, poi lo stato della centrale. */
    assert.match(guscio, /let chiaveDelTondo = alarmTriggered \? 'triggered' : alarmState;/, nome);
    assert.match(guscio, /chiaveDelTondo = suMisura\.mode;/, nome);
  }
});
