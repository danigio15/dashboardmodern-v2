/* «Sarebbe carino una sezione dedicata ai dispositivi Media Player… la
 * possibilità di aggiungerli anche nelle Azioni rapide, sarebbe figo se lo
 * sfondo fosse l'anteprima di ciò che viene riprodotto (la copertina del
 * disco)» (#269).
 *
 * Tre cose da difendere. La prima: i tasti che compaiono sono quelli che il
 * lettore sa eseguire davvero — Home Assistant lo dice in un numero, e
 * disegnare «brano precedente» su una radio è un tasto che non fa niente. La
 * seconda: il tempo che passa nessuno lo manda, quindi la posizione del brano
 * si calcola, e solo mentre suona. La terza: il tasto centrale fa tre cose
 * diverse a seconda di com'è messa la cassa, e su una cassa spenta
 * `media_play_pause` non dà errore e non fa niente.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  CHIAVE_MEDIA,
  SA,
  comandoDelLettore,
  entitaDeiLettori,
  letturaDelLettore,
  lettureDeiLettori,
  lettoriConfigurati,
  normalizzaLettore,
  orologio,
  posizioneOra,
} from "../src/core/media-player.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

/* Un Sonos vero: sa mettere in pausa, cambiare brano, il volume, il muto e la
 * sorgente. La radio no — sa solo suonare e il volume. */
const SONOS = SA.PAUSA | SA.VOLUME | SA.MUTO | SA.PRECEDENTE | SA.SUCCESSIVO | SA.SORGENTE;
const RADIO = SA.SUONA | SA.VOLUME;

const STATI = {
  "media_player.salotto": {
    state: "playing",
    attributes: {
      friendly_name: "Sonos Salotto",
      media_title: "So What",
      media_artist: "Miles Davis",
      media_album_name: "Kind of Blue",
      entity_picture: "/api/media_player_proxy/media_player.salotto?token=abc",
      volume_level: 0.34,
      is_volume_muted: false,
      media_duration: 545,
      media_position: 120,
      media_position_updated_at: "2026-09-03T07:00:00+00:00",
      source: "Spotify",
      source_list: ["Spotify", "Radio"],
      supported_features: SONOS,
    },
  },
  "media_player.cucina": {
    state: "paused",
    attributes: {
      media_title: "Caterpillar",
      media_duration: 3600,
      media_position: 1800,
      media_position_updated_at: "2026-09-03T07:00:00+00:00",
      supported_features: RADIO,
    },
  },
  "media_player.camera": { state: "off", attributes: { supported_features: SA.ACCENDI } },
};

const QUANDO = Date.parse("2026-09-03T07:00:00+00:00");

test("un lettore è quattro cose, e senza entità non è un lettore", () => {
  assert.deepEqual(normalizzaLettore({ entity: " media_player.x ", name: "Sala", icon: "🔊" }), {
    id: "lettore-1",
    entity: "media_player.x",
    nome: "Sala",
    icona: "🔊",
    room_id: "",
  });
  const lista = [{ entity: "media_player.a" }, { entity: "" }, { entity: "media_player.b" }];
  assert.equal(lettoriConfigurati(lista).length, 2, "la riga a metà resta fuori");
  assert.deepEqual(entitaDeiLettori(lista), ["media_player.a", "media_player.b"]);
  assert.equal(CHIAVE_MEDIA, "cd_media_player");
});

test("i tasti che compaiono sono quelli che quel lettore sa fare", () => {
  const sonos = letturaDelLettore({ entity: "media_player.salotto" }, STATI);
  assert.equal(sonos.suona, true);
  assert.equal(sonos.titolo, "So What");
  assert.equal(sonos.artista, "Miles Davis");
  assert.equal(sonos.copertina, "/api/media_player_proxy/media_player.salotto?token=abc");
  assert.equal(sonos.volume, 0.34);
  assert.deepEqual(sonos.sorgenti, ["Spotify", "Radio"]);
  assert.equal(sonos.puo.precedente, true);
  assert.equal(sonos.puo.successivo, true);
  assert.equal(sonos.puo.sorgente, true);

  /* Una radio non ha il brano precedente, e il tasto non va disegnato. */
  const radio = letturaDelLettore({ entity: "media_player.cucina" }, STATI);
  assert.equal(radio.puo.precedente, false);
  assert.equal(radio.puo.successivo, false);
  assert.equal(radio.puo.sorgente, false);
  assert.equal(radio.puo.muto, false);
  /* `SUONA` da solo basta a dire che il tasto centrale serve: c'è chi
   * dichiara solo quello e mette in pausa lo stesso. */
  assert.equal(radio.puo.pausa, true);
  assert.equal(radio.inPausa, true);
});

test("quello che non risponde non è spento, e spento non è muto", () => {
  const spento = letturaDelLettore({ entity: "media_player.camera" }, STATI);
  assert.equal(spento.spento, true);
  assert.equal(spento.muto, false, "«off» è una risposta, non un silenzio");
  assert.equal(spento.acceso, false);

  const assente = letturaDelLettore({ entity: "media_player.mai_vista" }, STATI);
  assert.equal(assente.muto, true);
  assert.equal(assente.spento, false);
  assert.equal(assente.acceso, false);
});

test("il nome scritto vince, poi quello di Home Assistant, e in ultimo l'entità", () => {
  assert.equal(
    letturaDelLettore({ entity: "media_player.salotto", nome: "Giradischi" }, STATI).nome,
    "Giradischi",
  );
  assert.equal(letturaDelLettore({ entity: "media_player.salotto" }, STATI).nome, "Sonos Salotto");
  assert.equal(
    letturaDelLettore({ entity: "media_player.cucina" }, STATI).nome,
    "media_player.cucina",
  );
});

test("mentre suona il tempo avanza da solo; in pausa sta fermo", () => {
  const sonos = letturaDelLettore({ entity: "media_player.salotto" }, STATI);
  /* Un minuto dopo la misura: il brano è andato avanti di un minuto, e nessuno
   * ha mandato niente. Senza questo conto la barra resterebbe ferma su un
   * pezzo che scorre. */
  const dopo = posizioneOra(sonos, QUANDO + 60_000);
  assert.equal(Math.round(dopo.secondi), 180);
  assert.ok(Math.abs(dopo.quota - 180 / 545) < 0.001);
  /* E non si va oltre la fine, nemmeno a distanza di un'ora. */
  assert.equal(posizioneOra(sonos, QUANDO + 3_600_000).secondi, 545);

  const radio = letturaDelLettore({ entity: "media_player.cucina" }, STATI);
  assert.equal(posizioneOra(radio, QUANDO + 60_000).secondi, 1800, "in pausa non scorre");

  /* Senza durata non c'è barra da disegnare: una barra senza fine è un
   * disegno che mente. */
  assert.equal(posizioneOra(letturaDelLettore({ entity: "media_player.camera" }, STATI)), null);
  assert.equal(posizioneOra(null), null);
});

test("l'orologio scrive i minuti come li scrive qualunque lettore", () => {
  assert.equal(orologio(0), "0:00");
  assert.equal(orologio(65), "1:05");
  assert.equal(orologio(545), "9:05");
  assert.equal(orologio(3661), "1:01:01");
  assert.equal(orologio(null), "");
  assert.equal(orologio(-5), "");
});

test("il tasto centrale fa la cosa giusta anche su una cassa spenta", () => {
  const acceso = letturaDelLettore({ entity: "media_player.salotto" }, STATI);
  const spento = letturaDelLettore({ entity: "media_player.camera" }, STATI);
  assert.equal(comandoDelLettore("centro", acceso), "media_play_pause");
  /* Su una cassa spenta `media_play_pause` non dà errore e non fa niente: da
   * fuori è un tasto rotto. */
  assert.equal(comandoDelLettore("centro", spento), "turn_on");
  assert.equal(comandoDelLettore("precedente", acceso), "media_previous_track");
  assert.equal(comandoDelLettore("successivo", acceso), "media_next_track");
  assert.equal(comandoDelLettore("muto", acceso), "volume_mute");
  assert.equal(comandoDelLettore("spegni", acceso), "turn_off");
  assert.equal(comandoDelLettore("boh", acceso), "");
});

test("le letture arrivano tutte insieme, nell'ordine configurato", () => {
  const righe = lettureDeiLettori(
    [{ entity: "media_player.cucina" }, { entity: "media_player.salotto" }],
    STATI,
  );
  assert.deepEqual(
    righe.map((r) => r.stato),
    ["paused", "playing"],
  );
});

test("la copertina fa la card, ed è l'unica pagina che mostra invece di disegnare", () => {
  const pagina = leggi("sections/media-player-section.js");
  /* Due immagini della stessa copertina: quadrata davanti, grande e sfocata
   * dietro a fare da fondo. È letteralmente quello che è stato chiesto. */
  assert.match(pagina, /class="dm-mp-fondo"/);
  assert.match(pagina, /filter:blur\(26px\)/);
  /* Il fondo si riconosce da un attributo, non da `:has()`: quella regola su
   * qualche WebView non c'è, e la card resterebbe col testo scuro sul
   * fondale scuro. */
  assert.match(pagina, /data-arte="\$\{Boolean\(riga\.copertina\)\}"/);
  assert.doesNotMatch(pagina, /:has\(\.dm-mp-fondo\)/);
  /* L'indirizzo della copertina si riscrive solo quando cambia: è firmato e
   * cambia a ogni brano, e riscriverlo a ogni giro farebbe lampeggiare la
   * card fra un'immagine e la stessa immagine. */
  assert.match(pagina, /if \(arte\.dataset\.dmMpSrc === riga\.copertina\) continue;/);
});

test("la voce nella barra c'è solo se un lettore c'è, e si può spegnere", () => {
  const pagina = leggi("sections/media-player-section.js");
  assert.match(pagina, /export const MEDIA_TAB = "media";/);
  /* Portare a una pagina vuota è peggio che non offrirla. */
  assert.match(pagina, /voce\.style\.display = configurati\.length && accesa \? "" : "none";/);
  /* E la fascia della visibilità sa dove mettersi: la chiave è quella che la
   * pagina stessa legge, o si scriverebbe una preferenza che nessuno guarda. */
  assert.match(leggi("sections/config-uniformity-section.js"), /media: "media",/);
  assert.match(pagina, /sezioni\[MEDIA_TAB\] === false/);
});

test("il battito del tempo vive solo mentre la pagina è davanti e qualcosa suona", () => {
  const pagina = leggi("sections/media-player-section.js");
  assert.match(pagina, /const serve = paginaAperta\(\) && righe\.some\(\(riga\) => riga\.suona/);
  assert.match(pagina, /if \(!serve\) \{\s*ferma\(\);/);
  assert.match(pagina, /clearInterval/);
});

test("nelle Azioni rapide il tasto prende la copertina, e il tocco mette in pausa", async () => {
  const azioni = leggi("sections/media-in-azioni-section.js");
  const { eUnLettore, TIPO_MEDIA } = await import("../src/sections/media-in-azioni-section.js");
  assert.equal(TIPO_MEDIA, "media");
  assert.equal(eUnLettore({ entity: "media_player.salotto" }), true);
  assert.equal(eUnLettore({ entity: "light.salotto" }), false);
  assert.equal(eUnLettore(null), false);

  /* Il vassoio delle Azioni rapide dipinge lo sfondo con un !important e una
   * fila di identificatori: senza scrivere la stessa fila, la copertina non
   * arriverebbe mai a vedersi. */
  assert.match(
    azioni,
    /html body #page-home \.dm-vassoio #qa-grid \.qa-btn\[data-dm-qa-media="arte"\]/,
  );
  assert.match(
    azioni,
    /background-image:\s*\n\s*linear-gradient\(180deg[^;]*var\(--dm-qa-arte\)!important/,
  );
  /* Il velo è un secondo strato dello sfondo e non un pseudo-elemento: il nome
   * del tasto è un nodo di testo nudo, e un ::before gli passerebbe sopra. */
  assert.doesNotMatch(azioni, /data-dm-qa-media="arte"\]::before/);

  /* E al tocco: pausa, non `toggle` — che spegnerebbe la cassa. */
  const servizi = leggi("sections/azioni-servizio-giusto-section.js");
  assert.match(servizi, /media_player: \(stato\) =>/);
  assert.match(servizi, /"media_play_pause"/);
  const { servizioPerEntita } = await import("../src/sections/azioni-servizio-giusto-section.js");
  assert.equal(
    servizioPerEntita("media_player.salotto", { "media_player.salotto": { state: "playing" } }),
    "media_play_pause",
  );
  assert.equal(
    servizioPerEntita("media_player.camera", { "media_player.camera": { state: "off" } }),
    "turn_on",
  );
});

test("il disegno della cassa è di casa, e la scheda viaggia con la plancia", async () => {
  const { haOggettoWidget } = await import("../src/core/oggetti-widget.js");
  assert.equal(
    haOggettoWidget("media"),
    true,
    "senza il suo disegno la barra tornerebbe a un'emoji",
  );
  assert.match(leggi("sections/navigation-section.js"), /media: "media",/);
  const persistenza = leggi("sections/config-persistence-section.js");
  assert.match(persistenza, /"cd_media_player",/);
  assert.match(persistenza, /CONFIG_KEYS_REVISION = 26/);
  const runtime = leggi("sections/section-runtime.js");
  assert.match(runtime, /installMediaPlayer\(\);/);
  assert.match(runtime, /installMediaEditor\(\);/);
  assert.match(runtime, /installMediaInAzioni\(\);/);
});

/* ── la tessera in Home ─────────────────────────────────────────────────
 *
 * «Per media player pensa anche a un widget che ti dica cosa è in
 * riproduzione.» È l'unica tessera del ponte in cui il numero grande non è la
 * risposta: quante casse suonano si vede, quello che si vuole sapere è cosa.
 */

test("la tessera dice cosa sta suonando, non solo quante casse", () => {
  const ponte = leggi("sections/home-widgets-section.js");
  /* La didascalia porta titolo e artista, e con più di una cassa anche dove:
   * due titoli di fila senza il posto sono due titoli e basta. */
  assert.match(ponte, /function cosaSuona\(riga, conIlPosto\)/);
  assert.match(
    ponte,
    /const pezzo = \[titoloDelLettore\(riga\), riga\.artista\]\.filter\(Boolean\)\.join\(" — "\);/,
  );
  assert.match(ponte, /const conIlPosto = suonano\.length > 1;/);
  /* E la tessera è iscritta all'elenco ordina/accendi, o esisterebbe in Home
   * senza potersi né spostare né spegnere. */
  assert.match(
    leggi("sections/todo-editor-section.js"),
    /\["media", "🔊", t\("Musica", "Media"\)\]/,
  );
  /* Dalla finestra si arriva alla sezione. */
  assert.match(ponte, /media: "media",\n\}\);/);
});

test("la finestra della tessera non ripete la stessa riga due volte", () => {
  const ponte = leggi("sections/home-widgets-section.js");
  /* Le pastiglie dello stato direbbero «Salotto · SO WHAT» sopra un lettore
   * che dice già Salotto, So What e Miles Davis, con la copertina accanto. */
  assert.doesNotMatch(ponte, /value: titoloDelLettore\(riga\),/);
  assert.match(ponte, /lettori: righe,/);
  /* E i tasti dentro la finestra sono quelli della pagina: un secondo disegno
   * con un secondo gestore vorrebbe dire due modi di mettere in pausa. */
  assert.match(ponte, /\$\{comandiMediaMarkup\(riga\)\}/);
  assert.match(
    leggi("sections/media-player-section.js"),
    /export function comandiMediaMarkup\(riga\)/,
  );
});

test("la lettura della finestra dice cosa suona, e quando non suona lo dice", async () => {
  const { analisiDellaSezione } = await import("../src/core/analisi-sezione.js");
  const it = (italiano) => italiano;
  const en = (_italiano, inglese) => inglese;
  const tessera = (lettori) => ({ key: "media", lettori });

  const uno = analisiDellaSezione(
    tessera([{ nome: "Salotto", suona: true, titolo: "So What", artista: "Miles Davis" }]),
    it,
  );
  assert.equal(uno.frase, "Salotto sta suonando So What — Miles Davis.");

  /* Con più di una cassa il titolo non lo dice la frase: lo dice la
   * didascalia, che li elenca tutti — ed è il suo mestiere. */
  const due = analisiDellaSezione(
    tessera([
      { nome: "Salotto", suona: true, titolo: "So What" },
      { nome: "Cucina", suona: true, titolo: "Caterpillar" },
    ]),
    it,
  );
  assert.equal(due.frase, "2 casse stanno suonando.");
  assert.deepEqual(due.punti, []);

  /* In pausa non è «non sta suonando niente»: è un'altra cosa, e si dice. */
  assert.match(
    analisiDellaSezione(tessera([{ nome: "Salotto", inPausa: true }]), it).frase,
    /in pausa/,
  );
  assert.equal(
    analisiDellaSezione(tessera([{ nome: "Salotto", spento: true }]), it).frase,
    "Non sta suonando niente.",
  );
  assert.deepEqual(analisiDellaSezione(tessera([{ nome: "Salotto", spento: true }]), it).punti, [
    "Uno e' spento",
  ]);
  /* Muto non è spento: uno che non risponde va detto, non contato fra i fermi. */
  assert.deepEqual(analisiDellaSezione(tessera([{ nome: "X", muto: true }]), it).punti, [
    "Uno non risponde",
  ]);
  /* E senza lettori non si inventa una frase su una casa senza casse. */
  assert.equal(analisiDellaSezione(tessera([]), en).frase, "No player set up.");
});
