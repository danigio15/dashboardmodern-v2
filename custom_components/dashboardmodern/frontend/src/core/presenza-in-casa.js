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
export function presenzaDiCasa(
  states = {},
  config,
  nomeDi = (entity) => entity,
  stanzaDi = () => "",
) {
  const scelte = normalizzaPresenza(config);
  const righe = [];
  for (const [entity, stato] of Object.entries(states || {})) {
    if (!eUnRilevatoreDiCasa(entity, stato, config)) continue;
    const classe = pulito(stato?.attributes?.device_class) || "motion";
    righe.push({
      entity,
      name: scelte.nomi[entity] || pulito(nomeDi(entity)) || entity,
      /* La stanza di Home Assistant, quando la sa: e' l'identita' del posto,
       * e serve al conto qui sotto. */
      stanza: pulito(stanzaDi(entity)),
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
 * Si contano i POSTI, non i rilevatori (#549).
 *
 * «Ho due sensori sulla stessa stanza e mi dice in due stanze c'è qualcuno.
 *  Ovviamente sono assegnati sulla stessa stanza.» Il conto guardava una riga
 * alla volta: due rilevatori in salotto facevano due stanze occupate, e la
 * didascalia scriveva «Salotto · Salotto». Una stanza grande, o un corridoio
 * con due sensori ai due capi, è il caso normale — non l'eccezione.
 *
 * Il posto è la STANZA, e solo in mancanza di quella il nome.
 *
 * Contarlo per nome non bastava: «non posso dare lo stesso nome se i sensori
 * sono diversi, uno prossimità è l'altro presenza, è utile sapere quale dei
 * due». Ha ragione — chiedere di chiamarli uguale vuol dire buttare via
 * proprio l'informazione che distingue i due rilevatori. Ma la stanza lo dice
 * senza toccare i nomi: due rilevatori nella stessa stanza di Home Assistant
 * sono lo stesso posto anche se si chiamano in due modi diversi.
 *
 * Il nome resta il ripiego per chi la stanza non ce l'ha — Home Assistant non
 * obbliga ad assegnarla — e li' vale la regola di prima: chiamarli uguale
 * basta a farne un posto solo. E il verdetto del posto è il più forte dei suoi
 * rilevatori: basta che uno rilevi perché lì ci sia qualcuno, e perché sia
 * libero devono dirlo tutti quelli che rispondono.
 *
 * Chi non risponde non conta né fra le attive né fra le libere: contarlo libero
 * sarebbe una bugia tranquillizzante, ed è la stessa regola con cui li conta la
 * configurazione dei varchi. Un posto è muto solo se non ha nessun'altra
 * lettura: un sensore giù accanto a uno che risponde non spegne la risposta.
 */
export function contoDellaPresenza(righe = []) {
  const posti = new Map();
  for (const riga of Array.isArray(righe) ? righe : []) {
    const nome = pulito(riga?.name);
    const stanza = pulito(riga?.stanza);
    /* Senza stanza e senza nome non si può dire che due righe siano lo stesso
     * posto: l'entità le tiene distinte, che è la risposta prudente. */
    const chiave = stanza
      ? `stanza:${stanza.toLocaleLowerCase()}`
      : nome
        ? `nome:${nome.toLocaleLowerCase()}`
        : `entita:${pulito(riga?.entity)}`;
    const posto = posti.get(chiave) || { nome: stanza || nome, attivo: false, libero: false };
    if (riga?.stato === "attivo") posto.attivo = true;
    else if (riga?.stato === "libero") posto.libero = true;
    if (!posto.nome && nome) posto.nome = nome;
    posti.set(chiave, posto);
  }
  const tutti = [...posti.values()];
  const attivi = tutti.filter((posto) => posto.attivo);
  return {
    attivi: attivi.length,
    liberi: tutti.filter((posto) => !posto.attivo && posto.libero).length,
    muti: tutti.filter((posto) => !posto.attivo && !posto.libero).length,
    totale: tutti.length,
    nomi: attivi.map((posto) => posto.nome),
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
