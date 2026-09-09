/* Quali entità contano come batterie, e come si chiamano. Una risposta sola,
 * per tre che chiedono.
 *
 * La tessera in Home, la pagina Batterie e la scheda della configurazione
 * devono guardare lo STESSO elenco: se la scheda ne toglie una e la tessera
 * continua a contarla, chi ha tolto quella riga vede il numero non muoversi e
 * pensa che la plancia non l'abbia sentito.
 *
 * Due cose che questo elenco NON fa, e sono due correzioni:
 *
 * La prima: non si ferma a quello che il guscio ha trovato all'avvio. Quella
 * passata gira una volta sola, e solo se l'elenco è vuoto: una pila accoppiata
 * il mese dopo non compariva da nessuna parte. Adesso agli entity dichiarati si
 * uniscono quelli che Home Assistant descrive come batterie — è la regola che
 * sta in `batterie-di-casa.js`, la stessa che legge i livelli.
 *
 * La seconda: non toglie quelle nascoste dai widget. Nascondere una batteria
 * dalla tessera di Home vuol dire «non voglio vederla in Home», non «non ce
 * l'ho»: prima spariva anche dalla sua pagina, dalla sua scheda e dalla voce
 * nella barra. Quel filtro adesso lo mette solo la tessera, che è l'unica a cui
 * serve.
 *
 * ── E come si chiamano ──────────────────────────────────────────────────
 *
 * «Nella sezione batterie mi vengono mostrate le entità con il loro nome, nel
 *  mio caso molto lunghe ed illegibili, sarebbe possibile mettere un'etichetta
 *  o customizzare il nome visualizzato?» (#430)
 *
 * Il posto dove scriverlo c'era già — la riga della scheda Batterie ha la sua
 * casella del nome, e quello che ci si scrive finisce in `cd_avvisi_names_extra`
 * insieme ai nomi del Quadro Avvisi — ma a leggerlo era rimasta solo la
 * tessera della Home: la pagina e la scheda il nome lo chiedevano a Home
 * Assistant e basta. Si battezzava una batteria e il nome dato spariva al
 * primo ridisegno, quello del salvataggio compreso: la casella tornava a dire
 * «Sensore Porta/finestra Camera matrimoniale Batteria», cioè il nome che si
 * era appena finito di cambiare.
 *
 * Adesso come si chiama una batteria lo dice questa funzione, e la regola di
 * come si compone — quello scelto, poi quello di Home Assistant, poi
 * l'identificativo reso leggibile — è `nomeDellEntita`, che vale per ogni
 * entità della plancia.
 */
import { batterieDiCasa } from "../core/batterie-di-casa.js";
import { entitaSorvegliate } from "./home-widgets-section.js";
import { allStates, lexicalGlobal, nomeDellEntita, readJson } from "./shared.js";

/* I nomi scelti stanno dove stanno quelli degli avvisi: uno dato alla riga di
 * una batteria vale anche nel Quadro Avvisi, perché è lo stesso nome della
 * stessa entità. */
export const CHIAVE_NOMI_SCELTI = "cd_avvisi_names_extra";

/**
 * Come si chiama una batteria, per chi la disegna.
 *
 * La mappa dei nomi si può passare già letta: chi disegna un elenco la legge
 * una volta e non una per riga.
 */
export function nomeDellaBatteria(entity, states = allStates(), nomi = null) {
  const scelti = nomi || readJson(CHIAVE_NOMI_SCELTI, {}) || {};
  return nomeDellEntita(entity, scelti?.[entity], states);
}

/** Le batterie sorvegliate adesso, come le vede tutta la plancia. */
export function batterieSorvegliate() {
  try {
    const tolte = readJson("cd_gruppi_removed", {});
    let vive = [];
    try {
      vive = lexicalGlobal("GRUPPI_MONITORAGGIO")?.batt;
    } catch (_error) {}
    return batterieDiCasa({
      configurate: entitaSorvegliate("batt", {
        extras: readJson("cd_gruppi_extra", {}),
        removed: tolte,
        vive,
      }),
      stati: allStates(),
      tolte: tolte?.batt,
    });
  } catch (_error) {
    return [];
  }
}
