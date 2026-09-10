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
 * Da questi quattro esce UNA strada, e a sceglierla e' quello che Home
 * Assistant dichiara: `web_rtc` si negozia, `hls` si trasmette, e chi non
 * dichiara niente non sa trasmettere — per lui la strada e' il proxy dal vivo,
 * che manda i fotogrammi che ha appena li ha senza chiedere niente al browser.
 *
 * E' la stessa regola che usa Home Assistant per la sua `ha-camera-stream`,
 * quella dietro `camera_view: live`: `web_rtc` si negozia, `hls` si trasmette,
 * e il proxy MJPEG e' quello che disegna quando la telecamera un flusso non ce
 * l'ha. Assomigliarle non e' pigrizia: e' l'unico modo perche' quello che si
 * vede nella plancia sia quello che si vede nella finestra di Home Assistant.
 *
 * Il dormire non cambia la strada: cambia quanto le si concede. C'e' stato un
 * tempo in cui a chi dorme si toglieva l'HLS per dargli il proxy, scritto
 * credendo che fosse il proxy a fare `camera_view: live`. Cosi' a un'Arlo si
 * toglieva proprio la strada che nella finestra di Home Assistant le funziona,
 * ed e' la #418 che continuava.
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
  /* Il proxy dal vivo risponde appena ha un'immagine. E' la strada di chi un
   * flusso non ce l'ha, non un tentativo dopo altri: se non ha nemmeno
   * un'immagine restano le istantanee, che non costano attesa. Il tempo e' uno
   * solo — chi dorme e chi no aspettano lo stesso, perche' qui non c'e' niente
   * da svegliare: si chiede un fotogramma e o arriva o non arriva. */
  MJPEG_SVEGLIA: 8_000,
});

/* Le integrazioni le cui telecamere si accendono su richiesta.
 *
 * Non decidono la strada — quella la dichiara Home Assistant — ma decidono
 * quanto le si aspetta: un apparecchio in cloud ci mette secondi a svegliarsi,
 * uno in casa risponde subito. Il confronto e' sul nome dell'entita' e su
 * quello del dispositivo, perche' e' li' che il nome dell'integrazione finisce
 * per comparire. */
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

/**
 * Se questa telecamera va svegliata prima di trasmettere.
 *
 * Lo dice l'integrazione da cui arriva, e nient'altro. C'era anche una
 * seconda regola — «dichiara un flusso ma non sta trasmettendo, quindi
 * dorme» — e sbagliava quasi sempre: lo stato di una telecamera e' `idle`
 * finche' qualcuno non guarda, anche per quella cablata in corridoio. Con
 * quella regola dormivano TUTTE, e tutte finivano sulla strada di chi dorme.
 *
 * Il tempo che si concede e' l'unica cosa che questo cambia: chi sta in cloud
 * ci mette secondi a svegliarsi, chi sta in casa risponde subito. Quale strada
 * si prende invece lo decide quello che Home Assistant dichiara.
 */
export function siSveglia(stato = {}) {
  const attributi = stato?.attributes || {};
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
   * `web_rtc`, lo negozia lui e si va li'. Se dichiara `hls` c'e' un flusso da
   * trasmettere, e la strada e' quella — la stessa che guarda la finestra di
   * Home Assistant, e la stessa `camera/stream` che sveglia l'apparecchio. Se
   * non dichiara niente non sa trasmettere, e la strada e' il proxy dal vivo.
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

  /* L'HLS e' la strada di chi un flusso ce l'ha, e lo dichiara.
   *
   * `frontend_stream_type: hls` Home Assistant lo scrive solo per le entita'
   * che sanno trasmettere: e' la stessa cosa che guarda la sua finestra, ed e'
   * la stessa `camera/stream` che si chiede noi — quella chiamata sveglia
   * l'apparecchio. Per un po' qui c'e' stata una regola che a chi dorme
   * toglieva l'HLS e dava il proxy dal vivo, scritta credendo che il proxy
   * fosse quello che fa `camera_view: live` di `picture-entity`. Non lo e':
   * `live` disegna il flusso — HLS o WebRTC — e il proxy e' un'altra cosa. Il
   * risultato era che a un'Arlo si toglieva proprio la strada che nella
   * finestra di Home Assistant le funziona (#418).
   *
   * Il tempo, quello si': una telecamera in cloud ci mette a svegliarsi, e
   * l'attesa e' la sua. Intanto l'istantanea e' gia' a schermo (#476), quindi
   * aspettare non vuol dire guardare il nero. */
  const flussoHls = pulito(stato?.attributes?.frontend_stream_type).toLowerCase() === "hls";

  if (webrtcInCorsa) strade.push({ nome: "HLS", salta: GIA_SCELTA });
  else if (!hlsNelBrowser) strade.push({ nome: "HLS", salta: "browser-senza-hls" });
  else if (!flussoHls) strade.push({ nome: "HLS", salta: "senza-flusso-dichiarato" });
  else
    strade.push({
      nome: "HLS",
      attesa: dorme ? ATTESE.HLS_SVEGLIA : ATTESE.HLS_LOCALE,
      sveglia: dorme,
    });

  /* Il proxy MJPEG e' la strada di chi un flusso non ce l'ha — e la rete di
   * chi ce l'ha e non ha funzionato.
   *
   * Una telecamera che non dichiara niente non sa trasmettere: chiederle
   * `camera/stream` vorrebbe dire spendere un'attesa per sentirsi dire no, e
   * il proxy invece manda i fotogrammi che ha, appena li ha, senza chiedere al
   * browser di saper suonare niente.
   *
   * Ma non si toglie di mezzo nemmeno quando una strada c'e': si toglieva
   * dicendo «strada-gia-scelta», e quella ragione vale finche' la strada
   * scelta regge — se regge, qui non ci si arriva e il proxy non costa niente.
   * Vale zero nel momento in cui serve: quando il flusso ha appena fallito, ed
   * e' proprio allora che un'altra strada dal vivo servirebbe. Chi guardava
   * finiva sulle istantanee — due fotogrammi al secondo chiesti dal browser —
   * mentre il proxy di Home Assistant gliene darebbe altrettanti spingendoli
   * lui. Non e' la cascata di prima: le strade dal vivo sono due, non quattro,
   * e la seconda si percorre solo dopo un no vero. */
  strade.push({ nome: "MJPEG", attesa: ATTESE.MJPEG_SVEGLIA, sveglia: dorme });

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
