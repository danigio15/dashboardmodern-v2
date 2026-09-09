/* Quale strada prendere per far vedere una telecamera. Una, scelta.
 *
 * Prima erano quattro provate in fila — WebRTC, HLS, MJPEG, istantanee —
 * ognuna col suo permesso di tempo. Chi arrivava in fondo aveva guardato un
 * rettangolo per mezzo minuto, e ogni attesa era servita soltanto a scoprire
 * che quella strada non era la sua. «Togli tutta quella roba a cascata»: una
 * fila di tentativi non e' una ricerca, e' un'ignoranza pagata a tempo.
 *
 * Quello che serve sapere si sa prima di partire, e sono quattro fatti:
 *
 *   · il nome del flusso go2rtc, se chi configura l'ha scritto. C'e' un campo
 *     apposta nella scheda Telecamere, ed e' QUELLO ad accendere WebRTC: il
 *     nome della telecamera non c'entra, e indovinarlo dall'entita' era il
 *     motivo per cui tre secondi li pagavano tutti;
 *   · `frontend_stream_type`, che Home Assistant scrive da se': vale `web_rtc`
 *     quando l'entita' negozia via `camera/webrtc/offer`, `hls` quando
 *     l'integrazione dei flussi e' pronta;
 *   · se la telecamera dorme. Ring, Arlo, Blink, Nest non hanno un flusso
 *     sempre acceso: quando le chiami devono svegliare l'apparecchio;
 *   · cosa sa fare il browser di chi guarda.
 *
 * Da questi quattro esce UNA strada. E per chi dorme non e' l'HLS, nemmeno
 * quando Home Assistant lo dichiara: la dichiarazione dice che l'integrazione
 * dei flussi c'e', non che un apparecchio in cloud riesca a svegliarsi e a
 * produrre segmenti — ed e' quel passaggio che non arriva. La sua strada e' il
 * proxy dal vivo, che manda i fotogrammi che ha appena li ha: la stessa cosa
 * che fa `camera_view: live` di `picture-entity`, la card che su un'Arlo si
 * muove mentre la plancia no. Ci si arrivava lo stesso, ma per quarti, dopo
 * ventotto secondi: molto piu' di quanto uno resta a guardare, ed e' per
 * questo che la live «non parte in nessun modo».
 *
 * Le istantanee restano sempre percorribili. Non sono un tentativo in fila —
 * non hanno attesa, o il fotogramma c'e' o non c'e' — e sono li' perche'
 * nessuno resti davanti al nero se la strada scelta cade.
 *
 * Il modulo e' puro: entrano la telecamera e quello che Home Assistant dice di
 * lei, esce l'elenco con la strada da percorrere e, per le altre, il perche'
 * non si tentano. Le parole per dirlo a schermo non stanno qui — questo modulo
 * non sa che lingua si parla — stanno nel codice che disegna.
 */

const pulito = (valore) => String(valore ?? "").trim();

/* Quanto si aspetta, in millisecondi.
 *
 * `SVEGLIA` e' il tempo di una telecamera che dorme: e' lungo apposta, ed e' la
 * differenza fra vedere il video e vedere le istantanee. Non e' infinito perche'
 * una telecamera rotta deve pur arrendersi. */
export const ATTESE = Object.freeze({
  WEBRTC: 3_000,
  HLS_LOCALE: 10_000,
  HLS_SVEGLIA: 25_000,
  /* Il proxy dal vivo risponde appena ha un'immagine. E' la strada di chi
   * dorme, non un tentativo dopo altri: se non ne ha nemmeno una restano le
   * istantanee, che non costano attesa.
   *
   * Il gemello per chi NON dorme se n'e' andato con la cascata: MJPEG adesso
   * si percorre solo quando e' la strada scelta, e la strada scelta e' quella
   * di chi dorme. Una costante che nessuno legge e' una domanda in piu' per
   * chi legge. */
  MJPEG_SVEGLIA: 8_000,
});

/* Le integrazioni le cui telecamere si accendono su richiesta.
 *
 * Serve solo quando Home Assistant non dichiara `frontend_stream_type`: quello
 * e' il dato vero, questo e' il ripiego per chi sta su una versione che non lo
 * scrive. Il confronto e' sul nome dell'entita' e su quello del dispositivo,
 * perche' e' li' che il nome dell'integrazione finisce per comparire. */
const CHE_DORMONO = Object.freeze([
  "ring",
  "arlo",
  "aarlo",
  "blink",
  "nest",
  "eufy",
  "wyze",
  "tuya",
]);

/** Se questa telecamera va svegliata prima di trasmettere. */
export function siSveglia(stato = {}) {
  const attributi = stato?.attributes || {};
  /* Il flusso c'e' ma l'apparecchio e' fermo: e' esattamente una che dorme. */
  const tipo = pulito(attributi.frontend_stream_type).toLowerCase();
  const acceso = pulito(stato?.state).toLowerCase() === "streaming";
  if (tipo && !acceso) return true;
  const indizi =
    `${pulito(stato?.entity_id)} ${pulito(attributi.friendly_name)} ${pulito(attributi.brand)}`.toLowerCase();
  return CHE_DORMONO.some((nome) => indizi.includes(nome));
}

/**
 * Le strade da provare, in ordine, con quanto aspettare ciascuna.
 *
 * Ogni voce che si salta porta il suo `salta`: un codice, non una frase, cosi'
 * chi disegna puo' dirlo nella lingua giusta e chi legge i registri sa perche'
 * una strada non e' stata nemmeno tentata.
 *
 * `nomeDelFlusso` e' il nome che la telecamera dichiara per go2rtc. Se non c'e',
 * WebRTC non si prova: indovinarlo dall'entita' e' quello che costava tre
 * secondi a tutti.
 */
export function strategieDellaTelecamera(cam = {}, stato = {}, opzioni = {}) {
  const nomeDelFlusso = pulito(cam.stream);
  const dorme = siSveglia(stato);
  const webrtcNelBrowser = opzioni.webrtcNelBrowser !== false;
  const hlsNelBrowser = opzioni.hlsNelBrowser !== false;
  /* Home Assistant moderno parla WebRTC da solo: `frontend_stream_type` vale
   * `web_rtc` quando l'entita' negozia via `camera/webrtc/offer` (go2rtc e'
   * integrato dal 2024.12, e Ring/Nest passano di li'). E' un'altra strada
   * rispetto all'estensione go2rtc col nome del flusso: quella resta per chi
   * l'ha configurata, questa non chiede niente — lo dichiara Home Assistant. */
  const nativa = pulito(stato?.attributes?.frontend_stream_type).toLowerCase() === "web_rtc";

  /* Una strada si SCEGLIE, non si prova.
   *
   * Prima erano quattro in fila, ognuna col suo permesso di tempo: WebRTC tre
   * secondi, HLS venticinque, MJPEG otto, e in fondo le istantanee. Chi
   * arrivava in fondo aveva aspettato mezzo minuto guardando un rettangolo, e
   * ogni attesa era servita solo a scoprire che quella strada non era la sua.
   * «Togli tutta quella roba a cascata»: la fila non e' una ricerca, e'
   * un'ignoranza pagata a tempo.
   *
   * Quello che serve sapere lo si sa prima di partire. Se il nome del flusso
   * go2rtc c'e', WebRTC e' configurato e si va li'. Se Home Assistant dichiara
   * `web_rtc`, lo negozia lui e si va li'. Se la telecamera dorme — Ring,
   * Arlo, Blink — la strada e' il proxy dal vivo, e su questo non si tira a
   * indovinare: e' la stessa cosa che fa `camera_view: live` di
   * `picture-entity`, ed e' quella che su un'Arlo si muove mentre l'HLS no
   * («dalla card YAML si muove, dalla plancia no», e la #418 dice che la live
   * «non parte in nessun modo»). Prima ci si arrivava dopo ventotto secondi di
   * altre strade, che e' molto piu' di quanto uno resti a guardare.
   * Altrimenti e' l'HLS, il flusso dal vivo di una telecamera di casa.
   *
   * Le istantanee restano sempre percorribili, e non sono un tentativo in
   * fila: non hanno attesa — o il fotogramma c'e' o non c'e' — e sono li'
   * perche' nessuno resti davanti al nero se la strada scelta cade.
   *
   * Tutto il resto porta il suo `salta`: non si tenta, e si sa dire perche'.
   */
  const strade = [];
  const scelta = (nome) => strade.some((strada) => strada.nome === nome && !strada.salta);
  /* Saltata perche' un'altra strada era gia' quella giusta, non perche' non
   * possa funzionare: e' la differenza fra «non serve» e «non si puo'». */
  const GIA_SCELTA = "strada-gia-scelta";

  if (!webrtcNelBrowser) strade.push({ nome: "WebRTC", salta: "browser-senza-webrtc" });
  else if (nomeDelFlusso)
    strade.push({ nome: "WebRTC", attesa: ATTESE.WEBRTC, flusso: nomeDelFlusso });
  else if (nativa)
    strade.push({
      nome: "WebRTC",
      /* Una telecamera in cloud che negozia in nativo deve prima svegliarsi:
       * il tempo e' quello della sveglia, non quello della rete di casa. E qui
       * l'attesa non e' buttata — e' la strada scelta, non una prova. */
      attesa: dorme ? ATTESE.HLS_SVEGLIA : ATTESE.HLS_LOCALE,
      nativa: true,
    });
  else strade.push({ nome: "WebRTC", salta: "senza-nome-di-flusso" });

  const webrtcInCorsa = scelta("WebRTC");

  /* Il proxy dal vivo prima dell'HLS, per chi dorme. L'HLS su queste vuole che
   * l'integrazione dei flussi svegli l'apparecchio e produca i segmenti, ed e'
   * esattamente il passaggio che non arriva; il proxy manda i fotogrammi che
   * ha, appena li ha. */
  const proxyDalVivo = !webrtcInCorsa && dorme;

  if (webrtcInCorsa || proxyDalVivo) strade.push({ nome: "HLS", salta: GIA_SCELTA });
  else if (!hlsNelBrowser) strade.push({ nome: "HLS", salta: "browser-senza-hls" });
  else strade.push({ nome: "HLS", attesa: ATTESE.HLS_LOCALE, sveglia: false });

  /* Il proxy MJPEG e' anche l'ultima strada VIVA, non solo quella di chi dorme.
   *
   * Senza WebRTC e con un browser che l'HLS non lo sa suonare — hls.js che non
   * si carica, e niente HLS nativo — non era stata scelta nessuna strada, e
   * MJPEG si toglieva di mezzo dicendo «strada-gia-scelta»: una ragione falsa,
   * perche' scelta non ce n'era nessuna. Chi guardava finiva dritto sulle
   * istantanee, cioe' su dei fotogrammi a intervalli, mentre il proxy dal vivo
   * era li' e funzionava. */
  const vivoInCorsa = webrtcInCorsa || scelta("HLS");
  if (proxyDalVivo) strade.push({ nome: "MJPEG", attesa: ATTESE.MJPEG_SVEGLIA, sveglia: true });
  else if (vivoInCorsa) strade.push({ nome: "MJPEG", salta: GIA_SCELTA });
  else strade.push({ nome: "MJPEG", attesa: ATTESE.MJPEG_SVEGLIA, sveglia: false });

  /* Le istantanee non si saltano mai: sono l'ultima rete, e non hanno attesa
   * perche' o il fotogramma arriva o non arriva. Non fanno fila con nessuno —
   * costano zero — e sono la ragione per cui nessuno resta davanti al nero. */
  strade.push({ nome: "Istantanee" });
  return strade;
}

/** La strada scelta: quella che si percorre davvero, senza l'ultima rete. */
export function stradaScelta(strade = []) {
  return strade.find((strada) => !strada?.salta && pulito(strada?.nome) !== "Istantanee") || null;
}

/** Le strade che si provano davvero, senza quelle saltate. */
export const daProvare = (strade = []) => strade.filter((strada) => !strada.salta);

/**
 * Il resoconto di un'apertura andata male, in forma di dati.
 *
 * `tentativi` e' quello che e' successo davvero: `{nome, salta}` per le strade
 * non tentate, `{nome, errore}` per quelle tentate e fallite. Torna indietro
 * ordinato e senza buchi, cosi' il messaggio a schermo puo' dire *cosa* non ha
 * funzionato invece di «nessuna strategia ha funzionato», che non si sa da che
 * parte prendere.
 */
export function diagnosi(tentativi = []) {
  return tentativi
    .map((tentativo) => ({
      nome: pulito(tentativo?.nome),
      salta: pulito(tentativo?.salta) || null,
      errore: pulito(tentativo?.errore) || null,
    }))
    .filter((tentativo) => tentativo.nome);
}
