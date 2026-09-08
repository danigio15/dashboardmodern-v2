/* Le batterie della casa: quali sono, come stanno, e sotto quanto preoccupano.
 *
 * «Le batterie quelle cariche non le fa vedere? Sarebbe carino che le batterie
 *  stessero nel config come le altre cose configurazioni.» (#398)
 *
 * Le batterie la plancia le trovava da sola — un sensore in percentuale che
 * Home Assistant dichiara `device_class: battery` — e le mostrava solo quando
 * una scendeva sotto il venti per cento. Venti scritto nel codice, uguale per
 * tutti: chi ha una serratura che va cambiata al trenta e un telecomando che
 * dura fino al cinque aveva un numero solo per due cose diverse.
 *
 * Qui c'e' la parte che si puo' sbagliare in silenzio: cosa conta come
 * batteria, quando e' scarica, e come si riassumono. Il resto — quali si
 * aggiungono a mano, quali si tolgono, come si chiamano — non nasce qui:
 * quelle strade esistono gia' ed erano solo senza una porta da cui entrare
 * (`cd_gruppi_extra`, `cd_gruppi_removed`, `cd_avvisi_names_extra`). Scriverne
 * di nuove vorrebbe dire due elenchi per la stessa casa.
 *
 * E' puro: nessun DOM, nessuna memoria, nessun orologio.
 */

export const CHIAVE_BATTERIE = "cd_batterie";

/* Venti e' quello che c'era, ed e' un valore di serie ragionevole: sotto il
 * venti per cento una pila la si compra. Chi vuole un altro numero adesso lo
 * puo' scrivere. */
export const SOGLIA_PREDEFINITA = 20;

/* Oltre il novanta non si sta piu' avvisando: si sta dicendo che ogni batteria
 * della casa e' scarica, che e' un avviso che non si guarda piu'. */
export const SOGLIA_MASSIMA = 90;

const pulito = (valore) => String(valore ?? "").trim();

const numero = (valore) => {
  const letto = Number(valore);
  return Number.isFinite(letto) ? letto : null;
};

/** La soglia scritta in configurazione, o quella di serie. */
export function sogliaDelleBatterie(stored) {
  const scritta = numero(stored?.soglia);
  if (scritta === null) return SOGLIA_PREDEFINITA;
  return Math.round(Math.max(1, Math.min(SOGLIA_MASSIMA, scritta)));
}

/**
 * Se questa entita' e' una batteria che ha senso guardare.
 *
 * Deve dire una percentuale: un `device_class: battery` che risponde `on` e
 * `off` esiste — e' l'allarme «batteria scarica» di certi sensori — ma non e'
 * un livello, e metterlo in un elenco di percentuali vorrebbe dire scrivere
 * «on%» accanto a «34%».
 */
export function eUnaBatteria(stato) {
  if (pulito(stato?.attributes?.device_class).toLowerCase() !== "battery") return false;
  return pulito(stato?.attributes?.unit_of_measurement) === "%";
}

/**
 * Le batterie di casa: quelle configurate piu' quelle che si riconoscono da se'.
 *
 * L'elenco configurato nasce da una passata sola, all'avvio della plancia: chi
 * accoppia una pila nuova il mese dopo non la vede comparire da nessuna parte,
 * perche' quella passata gira soltanto quando l'elenco e' vuoto. Ed e' proprio
 * il caso in cui una batteria conta: quella nuova nessuno l'ha ancora
 * dichiarata.
 *
 * Home Assistant pero' le batterie le dice da se' — `device_class: battery` e
 * l'unita' in percento — e qui c'e' gia' la regola che le riconosce. Si
 * uniscono: prima quelle configurate (l'ordine che si e' scelto), poi quelle
 * che si riconoscono e nessuno aveva ancora nominato. Le tolte a mano restano
 * fuori da tutte e due: togliere una riga e vedersela tornare al ricaricamento
 * e' peggio che non poterla togliere.
 *
 * E' puro: gli stati arrivano da fuori, e non si guarda nessun magazzino.
 */
export function batterieDiCasa({ configurate = [], stati = {}, tolte = [] } = {}) {
  const elenco = (lista) => (Array.isArray(lista) ? lista.map(pulito).filter(Boolean) : []);
  const fuori = new Set(elenco(tolte));
  const viste = new Set();
  const uscita = [];
  const metti = (id) => {
    if (!id || fuori.has(id) || viste.has(id)) return;
    viste.add(id);
    uscita.push(id);
  };
  for (const id of elenco(configurate)) metti(id);
  for (const [id, stato] of Object.entries(stati || {})) if (eUnaBatteria(stato)) metti(pulito(id));
  return Object.freeze(uscita);
}

/**
 * Come sta una batteria: il livello, e se e' sotto soglia.
 *
 * Una che non risponde non e' una batteria carica ne' una scarica: e' muta, e
 * si dice. Contarla carica sarebbe una bugia tranquillizzante, contarla
 * scarica manderebbe a cambiare una pila che sta benissimo.
 */
export function letturaDellaBatteria(
  entity,
  stato,
  { soglia = SOGLIA_PREDEFINITA, nome = "" } = {},
) {
  const livello = numero(stato?.state);
  return Object.freeze({
    entity: pulito(entity),
    name: pulito(nome) || pulito(stato?.attributes?.friendly_name) || pulito(entity),
    level: livello,
    muta: livello === null,
    scarica: livello !== null && livello <= sogliaDelleBatterie({ soglia }),
  });
}

/**
 * Le batterie date, lette e messe in ordine: prima le piu' scariche.
 *
 * Le mute vanno in fondo. Non sono un allarme — non si sa niente di loro — ma
 * nemmeno si nascondono: una batteria che ha smesso di rispondere e' spesso
 * una batteria finita, e toglierla dall'elenco vorrebbe dire far sparire
 * proprio quella che sta per lasciarti a piedi.
 */
export function batterieLette(entities = [], states = {}, { soglia, nome } = {}) {
  const quanto = sogliaDelleBatterie({ soglia });
  const dammiIlNome = typeof nome === "function" ? nome : () => "";
  return (Array.isArray(entities) ? entities : [])
    .map((entity) => pulito(entity))
    .filter(Boolean)
    .map((entity) =>
      letturaDellaBatteria(entity, states?.[entity], {
        soglia: quanto,
        nome: dammiIlNome(entity),
      }),
    )
    .sort((sinistra, destra) => {
      if (sinistra.muta !== destra.muta) return sinistra.muta ? 1 : -1;
      if (sinistra.muta) return sinistra.name.localeCompare(destra.name);
      return sinistra.level - destra.level;
    });
}

/**
 * Il riepilogo che va in cima: quante ce ne sono, quante sono scariche, e qual
 * e' la piu' bassa — cioe' quella che chiedera' una pila per prima.
 */
export function riepilogoBatterie(righe = []) {
  const elenco = Array.isArray(righe) ? righe : [];
  const lette = elenco.filter((riga) => !riga.muta);
  const scariche = lette.filter((riga) => riga.scarica);
  return Object.freeze({
    quante: elenco.length,
    lette: lette.length,
    scariche: scariche.length,
    mute: elenco.length - lette.length,
    /* La piu' bassa fra quelle che rispondono: senza nessuna che risponda non
     * c'e' una piu' bassa, e dire zero sarebbe inventare un allarme. */
    minima: lette.length ? lette[0] : null,
  });
}
