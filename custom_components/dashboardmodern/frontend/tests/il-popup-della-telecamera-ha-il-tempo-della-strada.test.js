/* «E ancora telecamere non funzionanti.» Il velo «Connessione WebRTC…» sopra un
 * fotogramma fermo, e la fila che non passa mai alla strada dopo.
 *
 * Il tempo del WebRTC nativo era scritto in due posti che non si parlavano.
 *
 * Il guscio lo chiede alla strategia: `dmCamWebRTC(cam, strada, content,
 * strada.attesa)`, e per la strada nativa la strategia dà dieci secondi a una
 * telecamera di casa e venticinque a una in cloud, che deve prima svegliarsi.
 *
 * Il nostro negoziato — che sostituisce quello del guscio per portarci i TURN
 * di casa — se n'era scritto uno suo: quindici secondi, sempre, per chiunque.
 *
 * E i due numeri contano tutt'e due, perché il guscio aspetta che la nostra
 * funzione TORNI prima di guardare il proprio cronometro:
 *
 *   · a una telecamera di casa, quindici invece di dieci sono cinque secondi di
 *     velo in più prima che la fila passi all'MJPEG o alle istantanee. Chi
 *     guarda li paga tutti;
 *   · a un'Arlo o a una Ring, quindici invece di venticinque vuol dire
 *     interrompere la trattativa dieci secondi prima della fine del tempo che
 *     il guscio le aveva dato: proprio alle telecamere che di tempo hanno
 *     bisogno si toglieva la strada buona.
 *
 * Il tempo adesso è uno solo e lo dice la strategia, che è il posto dove la
 * strada viene scelta.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  ATTESE,
  attesaDelFlusso,
  strategieDellaTelecamera,
} from "../src/core/strategie-telecamera.js";

const SORGENTE = readFileSync(
  new URL("../src/sections/telecamera-webrtc-section.js", import.meta.url),
  "utf8",
);

const NATIVA = { frontend_stream_types: ["web_rtc"] };
const inCasa = { entity_id: "camera.cameretta", attributes: { friendly_name: "Cam 02 Cameretta" } };
const inCloud = { entity_id: "camera.arlo_giardino", attributes: { friendly_name: "Arlo Giardino" } };

test("il tempo della strada nativa è quello della sveglia, o quello di casa", () => {
  assert.equal(attesaDelFlusso(inCasa), ATTESE.HLS_LOCALE);
  assert.equal(attesaDelFlusso(inCloud), ATTESE.HLS_SVEGLIA);
});

test("ed è lo stesso numero che la strategia mette sulla strada", () => {
  for (const stato of [inCasa, inCloud]) {
    const strade = strategieDellaTelecamera({ entity: stato.entity_id }, stato, {
      capacita: NATIVA,
    });
    const webrtc = strade.find((strada) => strada.nome === "WebRTC");
    assert.ok(webrtc && !webrtc.salta, "la strada nativa deve essere quella scelta");
    assert.equal(webrtc.attesa, attesaDelFlusso(stato));
  }
});

test("il negoziato del popup chiede quel tempo, non ne tiene uno suo", () => {
  assert.match(
    SORGENTE,
    /const sessione = await avviaWebRtcNativo\(entity, videoEl, \{\s*\n\s*attesa: attesaDelFlusso\(allStates\(\)\?\.\[entity\]\),/,
  );
  /* E il numero non è scritto qui: viene dal modulo che sceglie le strade. */
  assert.match(SORGENTE, /import \{ attesaDelFlusso \} from "\.\.\/core\/strategie-telecamera\.js";/);
  const negoziato = SORGENTE.slice(SORGENTE.indexOf("async function avviaPerIlPopup"));
  assert.ok(
    !/attesa:\s*\d/.test(negoziato),
    "nessun tempo scritto a mano dentro il negoziato del popup",
  );
});
