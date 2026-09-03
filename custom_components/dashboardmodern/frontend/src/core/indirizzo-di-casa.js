/* L'indirizzo di casa, quando la plancia non sa dove sta.
 *
 * «Storico internet dà errore»: dentro la finestra della connettività, al
 * posto della cronologia dei sette giorni, «❌ Storico non disponibile —
 * Failed to fetch».
 *
 * «Failed to fetch» non è una risposta: non è un 401 e non è un 404, è una
 * richiesta che non è mai arrivata da nessuna parte. E il motivo sta in come
 * il guscio si costruisce l'indirizzo a cui chiedere:
 *
 *     host = location.host
 *     if (!host) host = LOCAL_IP        // «homeassistant.local:8123»
 *     HA_HTTP_URL = httpProto + '//' + host
 *
 * La plancia ospitata vive in una cornice `srcdoc`. Quella cornice eredita
 * l'origine di chi la contiene — la memoria del browser è la stessa, ed è un
 * fatto che questa casa conosce già — ma il suo `location` no: è
 * `about:srcdoc`, e da lì `location.host` è la stringa vuota. Il guscio allora
 * fa l'unica cosa che può fare senza sapere dove si trova: indovina, e
 * indovina `homeassistant.local:8123`, che è il nome giusto in una casa su
 * cento e in tutte le altre è un host che non esiste — o che esiste ma in
 * chiaro, mentre la pagina viaggia in https, e allora il browser blocca la
 * richiesta senza nemmeno provarci.
 *
 * Misurato dentro la cornice, con la plancia vera: `location.host` è "",
 * `document.baseURI` è la pagina di Home Assistant, e `HA_HTTP_URL` è
 * `http://homeassistant.local:8123`.
 *
 * Gli indirizzi RELATIVI invece funzionano, ed è il motivo per cui tutto il
 * resto della plancia va: in un documento `srcdoc` si risolvono contro la base
 * del padre, cioè contro Home Assistant. È la stessa cosa che le telecamere
 * hanno imparato a suo tempo — «usa l'origine della plancia invece del vecchio
 * HA_HTTP_URL» — e che in questa finestra non era arrivata.
 *
 * Questo modulo è l'aritmetica di quella riparazione, e sta nel nucleo perché
 * è una domanda su delle stringhe: dato un indirizzo che qualcuno ha
 * costruito, la base del documento e l'host che il documento ha (o non ha),
 * qual è l'indirizzo giusto? Si prova senza rete e senza browser.
 */

const pulito = (valore) => String(valore ?? "").trim();

const ASSOLUTO = /^https?:\/\//i;

/* Un indirizzo che non porta da nessuna parte: lo schema c'è, l'host no.
 *
 * `new URL("http://")` lancia, e `new URL("http:///api/x")` non lancia ma
 * legge «api» come host: si guarda la stringa, che è l'unica cosa che si
 * comporta uguale dappertutto. */
export function senzaHost(indirizzo) {
  return /^https?:\/\/(?:\/|$)/i.test(pulito(indirizzo));
}

/** Se questo indirizzo chiede qualcosa a Home Assistant. */
export function versoLApi(indirizzo) {
  const valore = pulito(indirizzo);
  if (!valore) return false;
  if (valore.startsWith("/api/")) return true;
  return /^https?:\/\/[^/]*\/api\//i.test(valore);
}

/* Il percorso, con la domanda attaccata: è la parte che si conserva.
 *
 * L'host senza host va tagliato a mano — `new URL` legge «api» come host — e
 * quello con host si legge invece con `new URL`, che sa dove finisce. */
function percorsoConDomanda(indirizzo) {
  const valore = pulito(indirizzo);
  if (senzaHost(valore)) {
    const nudo = valore.replace(ASSOLUTO, "");
    return nudo.startsWith("/") ? nudo : `/${nudo}`;
  }
  try {
    const letto = new URL(valore);
    return `${letto.pathname}${letto.search}${letto.hash}`;
  } catch (_errore) {
    return valore;
  }
}

/**
 * L'indirizzo da usare davvero.
 *
 * Torna `null` quando non c'è niente da riparare — chi chiama passa oltre
 * senza toccare la richiesta, che è il caso normale e deve restare gratis.
 *
 * `hostDelDocumento` è il `location.host` di chi sta chiedendo, e la stringa
 * vuota vuol dire «questo documento non ha un host suo»: è la cornice
 * `srcdoc`, ed è l'unica condizione in cui il guscio ha dovuto indovinare. Un
 * documento che il suo host ce l'ha non si tocca: lì `HA_HTTP_URL` è giusto, e
 * dirottare una richiesta che qualcuno ha voluto sarebbe peggio del difetto
 * che si sta correggendo.
 *
 * Senza una base contro cui risolvere non si inventa niente. Vale per la
 * plancia aperta da un file su disco, che di host non ne ha e di base
 * utilizzabile nemmeno: lì `LOCAL_IP` è l'unica risposta che esista, ed è
 * giusto che resti.
 */
export function indirizzoRiparato(indirizzo, base = "", hostDelDocumento = "") {
  const valore = pulito(indirizzo);
  if (!valore || !versoLApi(valore)) return null;
  /* Già relativo: parte da casa da solo, che è esattamente quello che serve. */
  if (!ASSOLUTO.test(valore)) return null;
  const rotto = senzaHost(valore);
  if (!rotto && pulito(hostDelDocumento)) return null;
  const percorso = percorsoConDomanda(valore);
  const fondo = pulito(base);
  /* Senza base resta il percorso, e solo per l'indirizzo che è rotto in sé: in
   * una cornice si risolve da solo contro il padre, e comunque non può andare
   * peggio di `http:///`. */
  if (!fondo) return rotto ? percorso : null;
  try {
    return new URL(percorso, fondo).href;
  } catch (_errore) {
    return percorso;
  }
}

/* Il gettone che non è un gettone.
 *
 * Nella plancia ospitata il guscio mette `__dashboardmodern_hosted__` al posto
 * del gettone: è un segnale, non una credenziale, e vuol dire «i cookie
 * bastano già». Spedirlo come `Bearer` è il modo di farsi rispondere 401 da
 * una richiesta che sarebbe passata da sola. */
export const GETTONE_FINTO = "__dashboardmodern_hosted__";

export function autorizzazioneInutile(valore) {
  const scritto = pulito(valore);
  if (!scritto) return false;
  const nudo = scritto.replace(/^Bearer\b\s*/i, "").trim();
  return !nudo || nudo === GETTONE_FINTO || nudo === "undefined" || nudo === "null";
}

/* Il riferimento che il Recorder non conosce.
 *
 * Riparato l'indirizzo, la stessa finestra ha ancora un modo di non mostrare
 * niente, più silenzioso del primo. La domanda che parte è:
 *
 *     /api/history/period/...?filter_entity_id=dm.server_raggiungibilita_google
 *
 * `dm.server_raggiungibilita_google` non è un'entità di Home Assistant: è una
 * casella della plancia, e quale entità ci sia dentro lo sa la mappatura. Il
 * Recorder non ha niente con quel nome, risponde con un elenco vuoto, e la
 * finestra scrive «Nessun dato storico trovato per dm.…»: un errore che non
 * sembra un errore.
 *
 * La mappatura è la stessa con cui la plancia legge lo stato di quella casella
 * — `resolveEntity` — quindi qui non si inventa niente, si chiede a lei. Una
 * casella non mappata resta com'è: in quel caso la risposta vuota è la verità,
 * e sostituirla con un'altra entità sarebbe peggio.
 */
const RIFERIMENTO = /([?&]filter_entity_id=)([^&#]*)/i;

const virtuale = (nome) => /^dm\./i.test(nome);

export function conLEntitaVera(indirizzo, risolvi) {
  const valore = pulito(indirizzo);
  if (!valore || typeof risolvi !== "function") return null;
  const trovato = valore.match(RIFERIMENTO);
  if (!trovato) return null;
  /* Più entità separate da virgola: è quello che l'API accetta, e basta una
   * sola casella da tradurre perché valga la pena riscrivere. */
  const prima = trovato[2].split(",");
  const dopo = prima.map((pezzo) => {
    const nome = pezzo.trim();
    if (!virtuale(nome)) return pezzo;
    let vero = "";
    try {
      vero = pulito(risolvi(nome));
    } catch (_errore) {
      return pezzo;
    }
    return vero && vero !== nome && !virtuale(vero) ? vero : pezzo;
  });
  if (dopo.every((pezzo, indice) => pezzo === prima[indice])) return null;
  return valore.replace(RIFERIMENTO, (_tutto, capo) => `${capo}${dopo.join(",")}`);
}
