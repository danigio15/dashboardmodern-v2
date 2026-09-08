/* Quali entità contano come batterie. Una risposta sola, per tre che chiedono.
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
 */
import { batterieDiCasa } from "../core/batterie-di-casa.js";
import { entitaSorvegliate } from "./home-widgets-section.js";
import { allStates, lexicalGlobal, readJson } from "./shared.js";

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
