/* Le pastiglie di stato si possono spegnere.
 *
 * «Enable/disable container for status pills (boiler + burglar alarm,
 * side-by-side)» (#491).
 *
 * Sono la riga in cima alla Home che dice le due cose che non si vedono da
 * nessun'altra parte: la caldaia accesa e l'antifurto inserito. Compaiono da
 * sole quando hanno qualcosa da dire, e stanno in cima perche' sono un avviso.
 *
 * Per questo non sono un blocco da riordinare: metterle in fila con gli altri
 * vorrebbe dire poterle mandare in fondo, cioe' non vederle mai — e un avviso
 * che si trova solo scorrendo non e' un avviso. Ma spegnerle e' un'altra cosa:
 * chi le spegne lo fa sapendo cosa sta spegnendo, una volta, in una casella
 * che dice cosa fa. Nascondere per sbaglio e nascondere apposta non sono lo
 * stesso gesto.
 *
 * Qui c'e' solo la regola. Chi la scrive addosso al documento sta altrove.
 */

/** Dove si scrive se le pastiglie si vedono. */
export const CHIAVE_PASTIGLIE = "cd_home_pastiglie";

/**
 * Se le pastiglie di stato si vedono.
 *
 * Accese di serie: chi non ha mai aperto quella casella deve trovare la Home
 * di sempre. Si spengono solo con un «no» scritto — qualunque altra cosa ci
 * sia in memoria, comprese le scritture di una versione che non sapeva niente
 * di questa casella, vale «si'».
 */
export function lePastiglieSiVedono(scritto) {
  return (
    String(scritto ?? "")
      .trim()
      .toLowerCase() !== "no"
  );
}

/** Come si salva la scelta. */
export function scelaDellePastiglie(accese) {
  return accese ? "si" : "no";
}
