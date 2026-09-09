/* Chi c'è in casa, stanza per stanza (#432).
 *
 * «Ci vorrebbe una sezione con i sensori presenza o movimento.»
 *
 * È la stessa domanda dei varchi, fatta su un'altra famiglia di sensori: di un
 * rilevatore di movimento non si vuole sapere che esiste, si vuole sapere dove
 * c'è qualcuno adesso — e, quasi più importante, da quanto una stanza è vuota.
 * Non si comanda niente: si guarda.
 *
 * Come per i varchi, per il fumo e per l'aria non c'è niente da configurare per
 * cominciare. Un rilevatore lo dichiara Home Assistant col suo `device_class`
 * — `motion`, `occupancy`, `presence` — e chi ne ha uno se lo ritrova. La
 * configurazione serve solo a correggere quel rilevamento: togliere il sensore
 * del cortile che qualcuno ha etichettato «motion», aggiungere quello che
 * nessuno ha etichettato, dare un nome più chiaro di «Motion 3C». È la stessa
 * forma della scheda dei varchi e di quella dell'aria, perché è lo stesso
 * problema.
 *
 * ── Movimento e presenza non sono la stessa cosa ────────────────────────
 *
 * Un `motion` dice «adesso si muove qualcosa» e torna a `off` dopo qualche
 * secondo; un `occupancy` o un `presence` dicono «qui c'è qualcuno» e restano
 * accesi finché la stanza è occupata. Il conteggio in cima li tratta uguali —
 * a chi guarda interessa «in tre stanze c'è qualcuno» — ma la riga li
 * distingue col disegno e col tempo: di un movimento conta l'ultimo, di una
 * presenza conta da quanto dura.
 *
 * È puro: nessun DOM, nessuna memoria, nessun orologio — l'adesso lo passa chi
 * chiama.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** Dove si scrive la configurazione della presenza. */
export const CHIAVE_PRESENZA = "cd_presenza";

/* Le classi che contano come rilevatore. `moving` c'è perché qualche
 * integrazione la usa per i sensori a radar, e `vibration` no: una lavatrice
 * che vibra non è qualcuno che passa. */
export const CLASSI_DELLA_PRESENZA = Object.freeze(["motion", "occupancy", "presence", "moving"]);

/* Il disegno di un rilevatore. Chi dice «c'è qualcuno» e chi dice «si è
 * mosso» non sono la stessa notizia, e vederlo si capisce prima di leggerlo. */
const DISEGNI = Object.freeze({
  motion: "🏃",
  moving: "🏃",
  occupancy: "🧍",
  presence: "🧍",
});

/** Il disegno di un rilevatore, dalla classe che Home Assistant gli ha dato. */
export function disegnoDelRilevatore(classe) {
  return DISEGNI[pulito(classe)] || "🏃";
}

/**
 * Se un rilevatore dice «adesso si muove» o «qui c'è qualcuno».
 *
 * Serve a chi disegna: di un movimento si scrive quando è stato l'ultimo, di
 * una presenza da quanto dura. Sono due frasi diverse per due sensori diversi.
 */
export function eUnaPresenzaStabile(classe) {
  const nome = pulito(classe);
  return nome === "occupancy" || nome === "presence";
}

/** Se questa entità è un rilevatore, per quello che ne dice Home Assistant. */
export function eUnRilevatore(entity, stato) {
  if (!pulito(entity).startsWith("binary_sensor.")) return false;
  return CLASSI_DELLA_PRESENZA.includes(pulito(stato?.attributes?.device_class));
}

/**
 * La configurazione, ripulita.
 *
 * `escluse` e `aggiunte` sono elenchi di entità; `nomi` è il nome che si è
 * voluto dare a un rilevatore quando quello dell'integrazione non dice niente.
 * È la stessa forma dei varchi, e non per simmetria: è la stessa scheda, e chi
 * ne ha imparata una sa già usare l'altra.
 */
export function normalizzaPresenza(stored) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const elenco = (valori) =>
    (Array.isArray(valori) ? valori : [])
      .map(pulito)
      .filter((entity) => entity.includes("."))
      .filter((entity, indice, tutti) => tutti.indexOf(entity) === indice);
  const nomi = {};
  for (const [entity, nome] of Object.entries(
    dato.nomi && typeof dato.nomi === "object" ? dato.nomi : {},
  )) {
    const id = pulito(entity);
    const scritto = pulito(nome);
    if (id.includes(".") && scritto) nomi[id] = scritto;
  }
  return { escluse: elenco(dato.escluse), aggiunte: elenco(dato.aggiunte), nomi };
}

/**
 * Se questa entità è un rilevatore di questa casa.
 *
 * Lo dice Home Assistant col `device_class`, e lo dice chi ha la casa: uno
 * escluso non è un rilevatore per questa plancia, uno aggiunto lo è anche se
 * Home Assistant non lo dichiara.
 */
export function eUnRilevatoreDiCasa(entity, stato, config) {
  const id = pulito(entity);
  const scelte = normalizzaPresenza(config);
  if (scelte.escluse.includes(id)) return false;
  if (scelte.aggiunte.includes(id)) return id.includes(".");
  return eUnRilevatore(id, stato);
}

/** Se c'è qualcosa da mostrare: almeno un rilevatore leggibile in casa. */
export function presenzaConfigurata(states = {}, config) {
  return Object.entries(states || {}).some(([entity, stato]) =>
    eUnRilevatoreDiCasa(entity, stato, config),
  );
}

/* Gli stati che vogliono dire «non lo so». Un rilevatore muto non è una stanza
 * vuota: è una sorveglianza che manca, ed è una notizia diversa. */
const MUTI = new Set(["unavailable", "unknown", "none", ""]);

/** Come sta un rilevatore: `attivo`, `libero`, o «» quando non risponde. */
export function comeStaIlRilevatore(stato) {
  const grezzo = pulito(stato?.state).toLowerCase();
  if (MUTI.has(grezzo)) return "";
  return grezzo === "on" ? "attivo" : "libero";
}

/* Da quando sta così. `last_changed` è l'ultimo cambio di STATO, che è quello
 * che serve: `last_updated` si muove anche quando cambia solo un attributo, e
 * direbbe «libera da un minuto» di una stanza vuota da ieri. */
export function istanteDelCambio(stato) {
  const quando = Date.parse(pulito(stato?.last_changed) || pulito(stato?.last_updated) || "");
  return Number.isFinite(quando) ? quando : null;
}

/**
 * I rilevatori di casa, letti: nome, classe, come stanno e da quando.
 *
 * L'ordine è quello che serve a chi guarda: prima chi rileva qualcuno — è la
 * risposta alla domanda — poi i muti, che sono una sorveglianza che manca, e in
 * fondo le stanze libere, che sono la quiete. Dentro ogni gruppo, per nome.
 */
export function presenzaDiCasa(states = {}, config, nomeDi = (entity) => entity) {
  const scelte = normalizzaPresenza(config);
  const righe = [];
  for (const [entity, stato] of Object.entries(states || {})) {
    if (!eUnRilevatoreDiCasa(entity, stato, config)) continue;
    const classe = pulito(stato?.attributes?.device_class) || "motion";
    righe.push({
      entity,
      name: scelte.nomi[entity] || pulito(nomeDi(entity)) || entity,
      classe,
      glifo: disegnoDelRilevatore(classe),
      stabile: eUnaPresenzaStabile(classe),
      stato: comeStaIlRilevatore(stato),
      da: istanteDelCambio(stato),
    });
  }
  const peso = (riga) => (riga.stato === "attivo" ? 0 : riga.stato === "" ? 1 : 2);
  return righe.sort((a, b) => peso(a) - peso(b) || a.name.localeCompare(b.name));
}

/**
 * Il conto: quante stanze hanno qualcuno, quante sono libere, quante mute.
 *
 * Chi non risponde non conta né fra le attive né fra le libere: contarlo libero
 * sarebbe una bugia tranquillizzante, ed è la stessa regola con cui li conta la
 * configurazione dei varchi.
 */
export function contoDellaPresenza(righe = []) {
  const attivi = righe.filter((riga) => riga.stato === "attivo");
  return {
    attivi: attivi.length,
    liberi: righe.filter((riga) => riga.stato === "libero").length,
    muti: righe.filter((riga) => riga.stato === "").length,
    totale: righe.length,
    nomi: attivi.map((riga) => riga.name),
  };
}

/**
 * Da quanto l'ultima volta che si è mosso qualcosa, fra i rilevatori che
 * rispondono.
 *
 * È il numero che risponde a «è passato qualcuno mentre non c'ero»: con la casa
 * tutta libera, il rilevatore che ha cambiato stato più di recente è quello che
 * si è appena spento, cioè l'ultimo movimento. Torna `null` quando nessuno ha
 * una storia da raccontare.
 *
 * Chi non risponde resta fuori, e non è un dettaglio: un rilevatore che passa a
 * `unavailable` cambia stato in quel momento, e contarlo voleva dire scrivere
 * «Ultimo movimento · appena adesso» a una casa in cui l'unica cosa successa
 * era un sensore andato giù. È la stessa regola con cui un muto non viene
 * contato fra le stanze libere: un'assenza di notizie non è una notizia.
 */
export function ultimoMovimento(righe = []) {
  const istanti = righe
    .filter((riga) => riga?.stato !== "")
    .map((riga) => riga?.da)
    .filter((quando) => Number.isFinite(quando));
  return istanti.length ? Math.max(...istanti) : null;
}
