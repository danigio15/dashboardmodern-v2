/* «Storico internet dà errore.»
 *
 * Nella finestra della connettività, al posto della cronologia dei sette
 * giorni: «❌ Storico non disponibile — Failed to fetch».
 *
 * «Failed to fetch» non è una risposta. Non è un 401 e non è un 404: è una
 * richiesta che non è mai arrivata da nessuna parte. Il perché sta in come il
 * guscio si costruisce l'indirizzo a cui chiedere: parte da `location.host` e,
 * quando quello è vuoto, indovina `LOCAL_IP`.
 *
 * La plancia ospitata vive in una cornice `srcdoc`. Quella cornice eredita
 * l'origine di chi la contiene — la memoria del browser è la stessa, ed è un
 * fatto che questa casa conosce già — ma il suo `location` no: è
 * `about:srcdoc`, e `location.host` da lì è la stringa vuota. Misurato dentro
 * la cornice con la plancia vera: `HA_HTTP_URL` diventa
 * `http://homeassistant.local:8123`, che è il nome giusto in una casa su cento
 * e in tutte le altre è un host che non esiste — o che esiste ma in chiaro,
 * mentre la pagina viaggia in https, e allora il browser blocca la richiesta
 * senza nemmeno provarci.
 *
 * Gli indirizzi relativi invece funzionano, ed è il motivo per cui tutto il
 * resto della plancia va: in un documento `srcdoc` si risolvono contro la base
 * del padre. Le telecamere l'avevano già imparato — «usa l'origine della
 * plancia invece del vecchio HA_HTTP_URL» — e in questa finestra non era
 * arrivato.
 *
 * La condizione che fa scattare la riparazione è UNA: il documento non ha un
 * host suo. Un documento che sa dove sta non si tocca, perché lì `HA_HTTP_URL`
 * è giusto e dirottare sarebbe peggio del difetto.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  autorizzazioneInutile,
  conLEntitaVera,
  indirizzoRiparato,
  senzaHost,
  versoLApi,
} from "../src/core/indirizzo-di-casa.js";

test("un indirizzo senza host si riconosce dalla stringa", () => {
  assert.equal(senzaHost("http:///api/history/period/2026-09-03"), true);
  assert.equal(senzaHost("http://"), true);
  assert.equal(senzaHost("https://"), true);
  assert.equal(senzaHost("http://casa.local/api/history/period/x"), false);
  assert.equal(senzaHost("/api/history/period/x"), false);
  assert.equal(senzaHost(""), false);
});

test("si ripara solo quello che va a Home Assistant", () => {
  assert.equal(versoLApi("/api/history/period/x"), true);
  assert.equal(versoLApi("http:///api/websocket"), true);
  assert.equal(versoLApi("https://casa.local/api/states"), true);
  assert.equal(versoLApi("https://tile.example/12/3/4.png"), false);
  assert.equal(versoLApi("/local/foto.png"), false);
});

/* L'host che il guscio ha indovinato: è questo che arriva davvero dentro la
 * cornice, misurato con la plancia vera. */
const INDOVINATO =
  "http://homeassistant.local:8123/api/history/period/2026-08-27T00:00:00.000Z" +
  "?filter_entity_id=binary_sensor.internet&significant_changes_only=false";
const CASA = "https://casa.duckdns.org/dashboardmodern-panel";

test("dentro la cornice l'host indovinato torna a essere casa", () => {
  assert.equal(
    indirizzoRiparato(INDOVINATO, CASA, ""),
    "https://casa.duckdns.org/api/history/period/2026-08-27T00:00:00.000Z" +
      "?filter_entity_id=binary_sensor.internet&significant_changes_only=false",
  );
});

test("un documento che sa dove sta non si tocca", () => {
  /* La plancia aperta per conto suo: `HA_HTTP_URL` è giusto, e dirottare una
   * richiesta che qualcuno ha voluto sarebbe peggio del difetto. */
  assert.equal(indirizzoRiparato(INDOVINATO, CASA, "casa.duckdns.org"), null);
  assert.equal(
    indirizzoRiparato("https://altra.casa/api/states", CASA, "casa.duckdns.org"),
    null,
  );
});

test("anche l'indirizzo rotto in sé diventa quello di casa", () => {
  /* Senza `LOCAL_IP` da indovinare ne esce `http://`, che non è nemmeno un
   * indirizzo: quello si ripara ovunque, host del documento o no. */
  assert.equal(
    indirizzoRiparato("http:///api/states", CASA, "casa.duckdns.org"),
    "https://casa.duckdns.org/api/states",
  );
});

test("senza una base da cui partire resta il percorso, che basta", () => {
  /* In una cornice `srcdoc` un percorso si risolve da solo contro la base del
   * padre: è esattamente quello che fa funzionare tutto il resto. */
  assert.equal(indirizzoRiparato("http:///api/states", "", ""), "/api/states");
});

test("la plancia aperta da un file su disco resta con il suo LOCAL_IP", () => {
  /* Lì di host non ce n'è e di base utilizzabile nemmeno: `LOCAL_IP` è
   * l'unica risposta che esista, ed è giusto che resti. La sezione lo
   * garantisce non passando una base `file:`. */
  assert.equal(indirizzoRiparato(INDOVINATO, "", ""), null);
});

test("un indirizzo già relativo, e uno che non va all'API, non si toccano", () => {
  assert.equal(indirizzoRiparato("/api/history/period/x", CASA, ""), null);
  assert.equal(indirizzoRiparato("https://tile.example/9/1/2.png", CASA, ""), null);
});

test("il gettone della plancia ospitata non è un gettone", () => {
  /* `__dashboardmodern_hosted__` è un segnale che dice «i cookie bastano»:
   * spedirlo come Bearer si prende un 401 su una richiesta che sarebbe
   * passata da sola. */
  assert.equal(autorizzazioneInutile("Bearer __dashboardmodern_hosted__"), true);
  assert.equal(autorizzazioneInutile("__dashboardmodern_hosted__"), true);
  assert.equal(autorizzazioneInutile("Bearer undefined"), true);
  assert.equal(autorizzazioneInutile("Bearer "), true);
  assert.equal(autorizzazioneInutile("Bearer eyJhbGciOi.vero.gettone"), false);
  assert.equal(autorizzazioneInutile(""), false);
});

/* ─── E la domanda dice il nome giusto ────────────────────────────────────
 *
 * Riparato l'indirizzo, la stessa finestra ha ancora un modo di non mostrare
 * niente: chiede al Recorder `dm.server_raggiungibilita_google`, che è una
 * casella della plancia e non un'entità di Home Assistant. Torna un elenco
 * vuoto e la finestra scrive «Nessun dato storico trovato per dm.…»: un errore
 * che non sembra un errore, sulla stessa richiesta di prima.
 */

const MAPPA = {
  "dm.server_raggiungibilita_google": "binary_sensor.internet_di_casa",
  "dm.energy_stato_rete": "binary_sensor.inverter_in_rete",
};
const risolvi = (nome) => MAPPA[nome] || nome;

test("la casella della plancia diventa l'entità che ci sta dentro", () => {
  assert.equal(
    conLEntitaVera(
      "/api/history/period/2026-09-03?filter_entity_id=dm.server_raggiungibilita_google&end_time=x",
      risolvi,
    ),
    "/api/history/period/2026-09-03?filter_entity_id=binary_sensor.internet_di_casa&end_time=x",
  );
});

test("una casella non mappata resta com'è", () => {
  /* La risposta vuota, li', è la verità: quella lettura non ha un'entità, e
   * metterci quella di un'altra sarebbe peggio del non rispondere. */
  assert.equal(
    conLEntitaVera("/api/history/period/x?filter_entity_id=dm.mai_configurata", risolvi),
    null,
  );
});

test("un indirizzo che non chiede uno storico non si tocca", () => {
  assert.equal(conLEntitaVera("/api/states", risolvi), null);
  assert.equal(conLEntitaVera("/api/history/period/x", risolvi), null);
  /* Un'entità vera nominata per nome non ha niente da tradurre. */
  assert.equal(
    conLEntitaVera("/api/history/period/x?filter_entity_id=binary_sensor.vera", risolvi),
    null,
  );
});

test("più caselle insieme, e basta che una sia da tradurre", () => {
  assert.equal(
    conLEntitaVera(
      "/api/history/period/x?filter_entity_id=dm.energy_stato_rete,binary_sensor.vera,dm.mai_vista",
      risolvi,
    ),
    "/api/history/period/x?filter_entity_id=binary_sensor.inverter_in_rete,binary_sensor.vera,dm.mai_vista",
  );
});

test("una mappatura che non c'è, o che si arrabbia, non ferma la richiesta", () => {
  const indirizzo = "/api/history/period/x?filter_entity_id=dm.server_raggiungibilita_google";
  assert.equal(conLEntitaVera(indirizzo, undefined), null);
  assert.equal(
    conLEntitaVera(indirizzo, () => {
      throw new Error("la configurazione non è ancora arrivata");
    }),
    null,
  );
  /* Una mappatura che risponde con un'altra casella virtuale non ha risposto. */
  assert.equal(conLEntitaVera(indirizzo, () => "dm.qualcos_altro"), null);
});
