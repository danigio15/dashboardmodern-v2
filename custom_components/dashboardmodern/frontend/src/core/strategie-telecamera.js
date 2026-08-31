/* Quale strada prendere per far vedere una telecamera, e in che ordine.
 *
 * Aprire una telecamera vuol dire provare piu' strade finche' una regge:
 * WebRTC, HLS, MJPEG, e in ultimo le istantanee a due fotogrammi al secondo.
 * L'ordine era fisso e uguale per tutti, e le attese erano tarate su una
 * telecamera di casa attaccata alla rete locale.
 *
 * Due cose non tornavano, e si vedevano su Ring e Arlo.
 *
 * La prima: WebRTC si provava sempre, perche' la condizione era «il browser sa
 * fare WebRTC» — che oggi e' vero dappertutto. Ma quel WebRTC li' non e' quello
 * di Home Assistant: e' l'estensione go2rtc, e vuole il nome del flusso che le
 * si e' dato dentro go2rtc. Chi non ce l'ha installata non ha nessun flusso con
 * quel nome, e il nome lo si tirava a indovinare dall'entita'. Tre secondi buttati
 * a ogni apertura, per tutti, prima ancora di cominciare.
 *
 * La seconda: le telecamere in cloud dormono. Ring, Arlo, Blink, Nest non hanno
 * un flusso sempre acceso da agganciare: quando le chiami devono svegliare
 * l'apparecchio e cominciare a trasmettere, e ci mettono piu' di dieci secondi.
 * Dieci secondi era il tempo massimo concesso, quindi si mollava proprio quando
 * stavano per partire e si finiva sulle istantanee — «funziona ma si vede a
 * scatti», che e' il modo in cui si vive un difetto senza saperlo nominare.
 *
 * Home Assistant lo dice da se' che flusso ha una telecamera:
 * `frontend_stream_type` vale `hls` o `web_rtc` sulle entita' per cui
 * l'integrazione dei flussi e' pronta. E' un dato, non un indovinello, e questo
 * modulo lo usa per decidere.
 *
 * Il modulo e' puro: entrano la telecamera e quello che Home Assistant dice di
 * lei, esce l'elenco delle strade con quanto aspettare ciascuna e, per quelle
 * che si saltano, il perche'. Le parole per dirlo a schermo non stanno qui —
 * questo modulo non sa che lingua si parla — stanno nel codice che disegna.
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
  MJPEG: 3_000,
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

  const strade = [];

  if (!webrtcNelBrowser) strade.push({ nome: "WebRTC", salta: "browser-senza-webrtc" });
  else if (nomeDelFlusso)
    strade.push({ nome: "WebRTC", attesa: ATTESE.WEBRTC, flusso: nomeDelFlusso });
  else if (nativa)
    strade.push({
      nome: "WebRTC",
      /* Una telecamera in cloud che negozia in nativo deve prima svegliarsi:
       * il tempo e' quello della sveglia, non quello della rete di casa. */
      attesa: dorme ? ATTESE.HLS_SVEGLIA : ATTESE.HLS_LOCALE,
      nativa: true,
    });
  else strade.push({ nome: "WebRTC", salta: "senza-nome-di-flusso" });

  if (!hlsNelBrowser) strade.push({ nome: "HLS", salta: "browser-senza-hls" });
  else
    strade.push({
      nome: "HLS",
      attesa: dorme ? ATTESE.HLS_SVEGLIA : ATTESE.HLS_LOCALE,
      sveglia: dorme,
    });

  /* MJPEG vuole un flusso continuo dal proxy: una telecamera che dorme non ce
   * l'ha, e l'attesa finisce sempre a vuoto. Meglio andare dritti alle
   * istantanee, che per lei sono la cosa giusta. */
  if (dorme) strade.push({ nome: "MJPEG", salta: "telecamera-che-dorme" });
  else strade.push({ nome: "MJPEG", attesa: ATTESE.MJPEG });

  /* Le istantanee non si saltano mai: sono l'ultima rete, e non hanno attesa
   * perche' o il fotogramma arriva o non arriva. */
  strade.push({ nome: "Istantanee" });
  return strade;
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
