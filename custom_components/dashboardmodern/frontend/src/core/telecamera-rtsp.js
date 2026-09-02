/* Un indirizzo RTSP, letto per quello che e' e per quello che non e'.
 *
 * «Ho una telecamera con flusso video su rtsp://192.168.5.30:8556/Salone, non
 * c'e' possibilita' di configurazione.» La segnalazione dice il vero, e la
 * risposta onesta comincia da una cosa che nessuna riga di codice puo'
 * aggirare: **un browser non apre rtsp://**. Non c'e' un lettore da caricare,
 * non c'e' una libreria che manchi. Il flusso deve passare da qualcosa che sta
 * dalla parte del server e lo riconfeziona — la telecamera Generica di Home
 * Assistant, che ne fa HLS, oppure go2rtc/Frigate, che ne fanno WebRTC.
 *
 * Quindi questo modulo non promette di riprodurre niente. Fa le due cose che
 * servono davvero a chi incolla quell'indirizzo:
 *
 *   1. lo legge — host, porta, percorso — e ne ricava il nome che go2rtc dà
 *      per convenzione a quel flusso, che e' l'ultimo pezzo del percorso.
 *      «rtsp://192.168.5.30:8556/Salone» diventa «Salone», ed e' esattamente
 *      la parola che il campo «Nome stream go2rtc» aspetta;
 *   2. lo rende mostrabile — con la password oscurata. Un indirizzo RTSP di
 *      casa quasi sempre porta utente e password in chiaro, e una schermata di
 *      configurazione finisce nelle fotografie che si allegano alle
 *      segnalazioni.
 *
 * Il modulo e' puro: entra una stringa, esce un dato. Le parole per dirlo a
 * schermo stanno in chi disegna.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** Se questa stringa e' un indirizzo RTSP, anche solo cominciato. */
export function sembraRtsp(testo) {
  return /^rtsps?:\/\//i.test(pulito(testo));
}

/* Il nome di un flusso in go2rtc sta in un file YAML come chiave: niente
 * spazi, niente barre. Quello che si ricava dal percorso ci passa quasi
 * sempre intatto — «Salone», «stream1», «h264Preview_01_main» — e quando non
 * ci passa e' meglio ripulirlo che proporre una chiave che YAML rifiuta. */
const ripulisciNome = (valore) =>
  pulito(valore)
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

/**
 * Un indirizzo RTSP fatto a pezzi, oppure `null` se non lo e'.
 *
 * `nome` e' il nome di flusso proposto, `mascherato` l'indirizzo da mostrare.
 * `utente` c'e' per poter dire «con credenziali» senza stampare la password:
 * la password non esce da qui in nessun campo.
 */
export function analizzaRtsp(testo) {
  const grezzo = pulito(testo);
  if (!sembraRtsp(grezzo)) return null;

  /* `URL` non conosce lo schema rtsp: lo tratta come opaco e non riempie
   * `hostname` su tutti i motori. Il pezzo dopo «://» si legge a mano, che
   * per un indirizzo di telecamera e' piu' prevedibile che sperare. */
  const schema = grezzo.slice(0, grezzo.indexOf("://")).toLowerCase();
  const resto = grezzo.slice(grezzo.indexOf("://") + 3);
  const taglio = resto.search(/[/?#]/);
  const autorita = taglio === -1 ? resto : resto.slice(0, taglio);
  const coda = taglio === -1 ? "" : resto.slice(taglio);
  const chiocciola = autorita.lastIndexOf("@");
  const credenziali = chiocciola === -1 ? "" : autorita.slice(0, chiocciola);
  const ospite = chiocciola === -1 ? autorita : autorita.slice(chiocciola + 1);
  const duePunti = credenziali.indexOf(":");
  const utente = duePunti === -1 ? credenziali : credenziali.slice(0, duePunti);
  const conPassword = duePunti !== -1 && credenziali.length > duePunti + 1;

  /* Un IPv6 sta fra parentesi quadre, e i suoi due punti non sono quelli
   * della porta: si guarda dopo la chiusa. */
  const dopoIndirizzo = ospite.startsWith("[") ? ospite.indexOf("]") + 1 : 0;
  const portaA = ospite.indexOf(":", dopoIndirizzo);
  const host = portaA === -1 ? ospite : ospite.slice(0, portaA);
  const porta = portaA === -1 ? "" : ospite.slice(portaA + 1);

  const percorso = coda.split(/[?#]/)[0];
  const pezzi = percorso.split("/").filter(Boolean);
  const nome = ripulisciNome(pezzi.at(-1) || host);

  const mascherato = credenziali
    ? `${schema}://${utente}${conPassword ? ":•••" : ""}@${ospite}${coda}`
    : grezzo;

  return {
    url: grezzo,
    schema,
    host,
    porta,
    percorso,
    nome,
    utente: pulito(utente),
    conCredenziali: Boolean(credenziali),
    mascherato,
  };
}

/**
 * La riga da incollare in go2rtc.yaml (o nel campo `streams` di Frigate).
 *
 * Due spazi di rientro perche' quel file la vuole sotto `streams:`, e chi la
 * copia la incolla li' sotto senza doverla riallineare.
 */
export function rigaGo2rtc(indirizzo, nomeScelto = "") {
  const letto = analizzaRtsp(indirizzo);
  if (!letto) return "";
  const nome = ripulisciNome(nomeScelto) || letto.nome;
  return nome ? `  ${nome}: ${letto.url}` : "";
}

/**
 * Cosa manca perche' quell'indirizzo diventi video.
 *
 * Torna un codice, non una frase: chi disegna sa che lingua si parla, questo
 * modulo no. `pronta` vuol dire che la telecamera ha gia' un'entita' di Home
 * Assistant e l'indirizzo e' solo una nota in piu'.
 */
export function cosaManca(cam = {}) {
  const indirizzo = analizzaRtsp(cam.rtsp);
  const entita = /^camera\.[a-z0-9_]+$/i.test(pulito(cam.entity));
  if (!indirizzo) return entita ? "pronta" : "senza-indirizzo";
  if (entita) return "pronta";
  return pulito(cam.stream) ? "senza-entita-con-flusso" : "senza-entita";
}
