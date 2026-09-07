/* Lo stato della ricarica, in una lettera.
 *
 * La pastiglia sulla foto dell'auto ha sempre letto l'alfabeto delle
 * colonnine — IEC 61851: A = non connessa, B = collegata e ferma, C e D = in
 * carica, F = guasto — e con quello diceva «Non connessa», «Collegata», «In
 * carica». Poi la colonnina e' entrata da un'integrazione, e la casella dello
 * stato si e' riempita con quello che l'integrazione pubblica: un
 * `binary_sensor.charging` che dice `on` e `off`, un sensore che dice
 * `Charging` o `Connected`. La pastiglia stampava la parola grezza: «on» con
 * l'auto attaccata, «off» un momento dopo. «Prima usciva come stato: non
 * collegato, collegato, in ricarica.»
 *
 * Qui si traduce qualunque forma nella lettera, e da quella la pastiglia torna
 * a parlare. Puro: entrano lo stato grezzo, se il cavo e' dichiarato attaccato
 * e la potenza che passa; esce la lettera, o niente quando non si sa.
 */

const clean = (value) => String(value ?? "").trim();

/* Le parole in cui le integrazioni dicono le quattro cose. I negativi vanno
 * letti per primi: «disconnected» contiene «connected», «not charging»
 * contiene «charging». */
const GUASTO = /\b(error|errore|fault|guast|fehler|failure|failed)\b/i;
const STACCATO =
  /\b(disconnect\w*|scollegat\w*|staccat\w*|unplug\w*|not[ _-]?connected|no[ _-]?vehicle|no[ _-]?car|nessun\w* (auto|veicolo))\b/i;
const NON_IN_CARICA =
  /\b(not[ _-]?charging|non in carica|discharg\w*|charg\w* (complete|finished|done|stopped|paused)|complete|finished|done|stopped|paused|suspended\w*|waiting|ready|pronta|attesa)\b/i;
const IN_CARICA =
  /\b(charging|in carica|ricarica in corso|ricaricando|l[äa]dt|laden|cargando|en charge)\b/i;
const ATTACCATO =
  /\b(connected|collegat\w*|plugged|plug|attaccat\w*|occupied|preparing|angeschlossen|conectad\w*|branch[ée]e?)\b/i;
/* Stati che da soli non dicono se il cavo e' dentro: `off` di un
 * `binary_sensor.charging` vuol dire «non sta caricando», e chi decide fra
 * «collegata» e «non connessa» e' il sensore del cavo, se c'e'. */
const SPENTO = /^(off|false|0|idle|none|available|free|libero|nessuno|standby|inactive)$/i;
const ACCESO = /^(on|true|1|active|attiv[ao])$/i;
const MUTO = /^(unknown|unavailable|none|)$/i;

/**
 * La lettera della ricarica.
 *
 * `stato` e' quello che la casella dice, com'e'. `collegata` e' il verdetto
 * del SENSORE DEL CAVO (true/false) o `null` se nessuno lo sa — non si deduce
 * da un «off» di carica, che dice solo «non sta caricando» (osservazione
 * della review). `potenza` in watt, o `null`. Torna "A", "B", "C", "F",
 * "N" — non in carica, col cavo che nessuno sa — oppure "" quando non c'e'
 * abbastanza per dire qualcosa: e allora la pastiglia mostra quello che
 * mostrava prima.
 */
export function codiceDellaRicarica({ stato, collegata = null, potenza = null } = {}) {
  const grezzo = clean(stato);
  const spazi = grezzo.replace(/_/g, " ");
  const watt = Number(potenza);
  const carica = Number.isFinite(watt) && watt > 10;
  const attaccata = collegata === true;
  const staccata = collegata === false;

  /* Le lettere della norma, per prime: sono esatte. */
  if (/^[aA]$/.test(grezzo)) return "A";
  if (/^[bB]$/.test(grezzo)) return "B";
  if (/^[cCdD]$/.test(grezzo)) return "C";
  if (/^[fF]$/.test(grezzo)) return "F";

  if (!MUTO.test(grezzo)) {
    if (GUASTO.test(spazi)) return "F";
    if (STACCATO.test(spazi)) return "A";
    if (NON_IN_CARICA.test(spazi)) return staccata ? "A" : "B";
    if (IN_CARICA.test(spazi)) return "C";
    if (ATTACCATO.test(spazi)) return carica ? "C" : "B";
    /* `on` di un sensore «charging»: sta caricando. `off`: non sta caricando,
     * e se il cavo e' dentro e' «collegata», se nessuno lo sa si guarda la
     * potenza. */
    if (ACCESO.test(grezzo)) return "C";
    if (SPENTO.test(grezzo)) return attaccata || carica ? "B" : staccata ? "A" : "N";
  }

  /* Senza uno stato che parli, restano il cavo e la potenza. */
  if (carica) return "C";
  if (attaccata) return "B";
  if (staccata) return "A";
  return "";
}

/** Le pastiglie leggono anche quello che il guscio scrive gia': le lettere. */
export const LETTERE = Object.freeze(["A", "B", "C", "F", "N"]);

/* Il cavo lo dice solo il suo sensore. Un «off» del sensore di carica non e'
 * un cavo fuori: e' una carica ferma, e il cavo puo' essere dentro. Qui si
 * legge il sensore del cavo — `dm.ev_cavo_collegato` — e si risponde si', no,
 * o «non lo so» quando lo stato non e' fra quelli che parlano.
 *
 * Sta qui, e non nella sezione della pastiglia, perche' lo leggono in due: la
 * pastiglia sulla pagina Auto e la tessera in Home. «Nel widget la ricarica
 * risulta scollegata, ma nella pagina dedicata la vedi collegata» (#348) era
 * esattamente questo: due letture diverse dello stesso cavo. */
const CAVO_DENTRO = /^(on|true|1|home|connected|plugged|collegato|attaccato)$/i;
const CAVO_FUORI = /^(off|false|0|not_home|disconnected|unplugged|scollegato|staccato)$/i;

/* E le lettere della norma dicono il cavo meglio di chiunque.
 *
 * IEC 61851: A e' la presa libera, B il cavo dentro e fermo, C e D il cavo
 * dentro che carica. Le colonnine serie — KEBA, go-e, openWB — pubblicano
 * proprio quella lettera, spesso in un sensore che si chiama «vehicle status»,
 * e chi la legge sa del cavo senza bisogno di un secondo sensore. F e' un
 * guasto: di dov'e' il cavo non dice niente, e infatti qui non risponde. */
const CAVO_LETTERA_FUORI = /^[aA]$/;
const CAVO_LETTERA_DENTRO = /^[bBcCdD]$/;

export function cavoDalloStato(stato) {
  const grezzo = clean(stato);
  if (CAVO_LETTERA_DENTRO.test(grezzo)) return true;
  if (CAVO_LETTERA_FUORI.test(grezzo)) return false;
  if (CAVO_DENTRO.test(grezzo)) return true;
  if (CAVO_FUORI.test(grezzo)) return false;
  return null;
}

/** Se uno stato e' una delle lettere della norma. */
export function eUnaLettera(stato) {
  return /^[abcdfABCDF]$/.test(clean(stato));
}
