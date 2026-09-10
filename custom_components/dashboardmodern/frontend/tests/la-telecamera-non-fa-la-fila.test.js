/* «Togli tutta quella roba a cascata: se sono WebRTC va configurata, in
 *  alternativa recupera il flusso live e deve essere immediato.»
 *
 * Aprire una telecamera provava quattro strade in fila, ognuna col suo
 * permesso di tempo: WebRTC tre secondi, HLS venticinque, MJPEG otto, e in
 * fondo le istantanee. Ogni attesa serviva soltanto a scoprire che quella
 * strada non era la sua, e chi arrivava in fondo aveva guardato un rettangolo
 * per mezzo minuto.
 *
 * Adesso la strada si sceglie da quattro fatti che si sanno prima di partire,
 * e se ne percorre UNA. Le istantanee restano, ma non fanno fila con nessuno:
 * non hanno attesa, e sono li' perche' nessuno resti davanti al nero.
 *
 * Queste prove guardano la regola nel suo insieme: per ogni telecamera, una
 * strada dal vivo e una sola, e nessuna attesa spesa per scoprire un no.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ATTESE,
  daProvare,
  stradaScelta,
  strategieDellaTelecamera,
} from "../src/core/strategie-telecamera.js";

const CASI = [
  {
    che: "il nome del flusso go2rtc scritto a mano accende WebRTC",
    cam: { stream: "salone" },
    stato: { entity_id: "camera.salone" },
    attesa: "WebRTC",
  },
  {
    che: "Home Assistant che dichiara web_rtc lo negozia da se'",
    cam: {},
    stato: { entity_id: "camera.ring", attributes: { frontend_stream_type: "web_rtc" } },
    attesa: "WebRTC",
  },
  {
    che: "una telecamera di casa col flusso pronto prende l'HLS",
    cam: {},
    /* Lo stato di una telecamera e' `idle` finche' qualcuno non guarda, anche
     * per quella cablata in corridoio: non e' quello a dire se dorme. Questa
     * prova lo scriveva `streaming` per aggirare una regola sbagliata, e cosi'
     * copriva proprio il caso che non funzionava. */
    stato: {
      entity_id: "camera.ingresso",
      state: "idle",
      attributes: { frontend_stream_type: "hls" },
    },
    attesa: "HLS",
  },
  {
    che: "un'Arlo col flusso dichiarato prende l'HLS, come nella finestra di Home Assistant",
    cam: {},
    stato: {
      entity_id: "camera.aarlo_giardino",
      state: "idle",
      attributes: { frontend_stream_type: "hls" },
    },
    attesa: "HLS",
  },
  {
    che: "una che non dichiara nessun flusso prende il proxy dal vivo",
    cam: {},
    stato: { entity_id: "camera.generica" },
    attesa: "MJPEG",
  },
];

for (const caso of CASI) {
  test(`una strada sola, scelta: ${caso.che}`, () => {
    const strade = strategieDellaTelecamera(caso.cam, caso.stato, {});
    assert.equal(stradaScelta(strade)?.nome, caso.attesa);
    /* Percorribili: la strada scelta e l'ultima rete. Nient'altro — cioe'
     * nessun'altra attesa da spendere per sentirsi dire no. */
    /* Percorribili: la strada scelta, il proxy come rete dal vivo, e le
     * istantanee. Nient'altro — cioe' nessun'altra attesa spesa prima di
     * cominciare, e nessuna strada dal vivo buttata via per sempre. */
    assert.deepEqual(
      daProvare(strade).map((strada) => strada.nome),
      caso.attesa === "MJPEG" ? ["MJPEG", "Istantanee"] : [caso.attesa, "MJPEG", "Istantanee"],
    );
  });
}

test("ogni strada non tentata sa dire perche', cosi' l'errore si legge", () => {
  for (const caso of CASI) {
    const strade = strategieDellaTelecamera(caso.cam, caso.stato, {});
    for (const strada of strade)
      if (strada.salta)
        assert.match(
          strada.salta,
          /^[a-z-]+$/,
          `«${strada.nome}» deve portare un codice, non una frase: le parole le mette chi disegna`,
        );
  }
});

test("le istantanee non hanno attesa: e' per questo che non sono un tentativo", () => {
  for (const caso of CASI) {
    const strade = strategieDellaTelecamera(caso.cam, caso.stato, {});
    const rete = strade.find((strada) => strada.nome === "Istantanee");
    assert.ok(rete, "l'ultima rete c'e' sempre");
    assert.equal(rete.salta, undefined);
    assert.equal(rete.attesa, undefined);
  }
});

test("un browser che non sa fare ne' WebRTC ne' HLS resta col proxy dal vivo", () => {
  /* Questa prova diceva «resta con le istantanee», e la ragione scritta era
   * «e' l'unica strada che c'e'». Non lo era: il proxy MJPEG e' un `<img>` su
   * un altro indirizzo — `camera_proxy_stream` invece di `camera_proxy` — e non
   * chiede al browser di saper suonare niente. Chi non ha ne' WebRTC ne' HLS
   * puo' vedere il vivo lo stesso, e ci veniva mandato sopra i fotogrammi a
   * intervalli per una convinzione sbagliata. */
  const strade = strategieDellaTelecamera(
    {},
    { entity_id: "camera.generica" },
    { webrtcNelBrowser: false, hlsNelBrowser: false },
  );
  assert.equal(stradaScelta(strade)?.nome, "MJPEG");
  assert.deepEqual(
    daProvare(strade).map((strada) => strada.nome),
    ["MJPEG", "Istantanee"],
  );
  assert.equal(strade.find((s) => s.nome === "WebRTC").salta, "browser-senza-webrtc");
  assert.equal(strade.find((s) => s.nome === "HLS").salta, "browser-senza-hls");
  /* E le istantanee restano sotto: la rete non si toglie mai. */
  assert.equal(strade.find((s) => s.nome === "Istantanee").salta, undefined);
  /* Non si dice di svegliare una telecamera che non dorme: il proxy qui e' la
   * strada scelta, non la sveglia di una che sta in cloud. */
  assert.equal(strade.find((s) => s.nome === "MJPEG").sveglia, false);
});

test("il flusso dichiarato batte l'HLS anche quando il browser sa fare tutto (#418)", () => {
  /* Un'Arlo dichiara `hls` e non sta trasmettendo, perche' nessuno la sta
   * guardando. Per un po' qui si diceva «dorme, quindi niente HLS»: le si
   * toglieva proprio la strada che nella finestra di Home Assistant le
   * funziona, e la segnalazione continuava. */
  const arlo = strategieDellaTelecamera(
    {},
    {
      entity_id: "camera.aarlo_ingresso",
      state: "idle",
      attributes: { frontend_stream_type: "hls" },
    },
    {},
  );
  const strada = stradaScelta(arlo);
  assert.equal(strada?.nome, "HLS");
  /* Il dormire non cambia la strada: cambia il tempo che le si concede. */
  assert.equal(strada.sveglia, true);
  assert.equal(strada.attesa, ATTESE.HLS_SVEGLIA);
  /* Il proxy resta sotto come rete: non si percorre se l'HLS regge, e si
   * percorre se l'HLS cade — che e' l'unico momento in cui serve. */
  assert.equal(arlo.find((s) => s.nome === "MJPEG").salta, undefined);

  /* La stessa telecamera in casa: stessa strada, meno attesa. */
  const casa = strategieDellaTelecamera(
    {},
    { entity_id: "camera.ingresso", state: "idle", attributes: { frontend_stream_type: "hls" } },
    {},
  );
  assert.equal(stradaScelta(casa)?.attesa, ATTESE.HLS_LOCALE);
  assert.equal(stradaScelta(casa)?.sveglia, false);
});

test("chi non dichiara nessun flusso non spende un'attesa per sentirsi dire no", () => {
  /* Home Assistant scrive `frontend_stream_type` solo per le entita' che
   * sanno trasmettere. Dove non c'e', chiedere `camera/stream` vorrebbe dire
   * pagare un'attesa per un no gia' scritto. */
  const strade = strategieDellaTelecamera({}, { entity_id: "camera.vecchia" }, {});
  assert.equal(strade.find((s) => s.nome === "HLS").salta, "senza-flusso-dichiarato");
  assert.equal(stradaScelta(strade)?.nome, "MJPEG");
});
