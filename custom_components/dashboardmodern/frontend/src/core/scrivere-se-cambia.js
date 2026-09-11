/* Scrivere sul documento solo quello che cambia davvero.
 *
 * Riscrivere un attributo col valore che ha gia' non e' gratis. Il documento
 * non confronta niente: registra la scrittura e sveglia chiunque stia
 * guardando. Se chi si sveglia rimette a posto quegli stessi attributi — ed e'
 * il mestiere di chi fa la guardia ai campi dell'entita' — la passata seguente
 * sveglia di nuovo, e da fermi, con la scheda aperta e nessuno che tocchi
 * niente, il giro non si ferma piu'.
 *
 * Misurato su una riga dei tasti dell'antifurto (#494): trentotto scritture in
 * tre secondi, col dito lontano. Chi ci rimette sono le caselle: un campo che
 * cambia attributi dodici volte al secondo non sta mai fermo, e scriverci
 * dentro diventa una lotta. «Continuamente resettato», nelle parole di chi ha
 * la casa.
 *
 * Sta nel nucleo e non fra le sezioni perche' lo usano tutt'e due i piani: le
 * sezioni che decorano e i moduli comuni che il guscio chiama.
 */

/**
 * Scrive l'attributo solo se il valore e' diverso da quello che c'e'.
 *
 * @returns {boolean} se ha scritto davvero.
 */
export function attributoSeCambia(nodo, nome, valore) {
  if (!nodo?.getAttribute) return false;
  const testo = String(valore ?? "");
  if (nodo.getAttribute(nome) === testo) return false;
  nodo.setAttribute(nome, testo);
  return true;
}

/**
 * Aggiunge o toglie una classe solo se cambia davvero qualcosa.
 *
 * Togliere una classe che non c'e' sembra gratis e non lo e': la lista delle
 * classi riscrive comunque l'attributo `class`, se l'elemento ne ha uno — e
 * gli elementi di una scheda ne hanno sempre uno.
 *
 * @returns {boolean} se ha cambiato davvero.
 */
export function classeSeCambia(nodo, classe, acceso) {
  const lista = nodo?.classList;
  if (!lista) return false;
  if (lista.contains(classe) === Boolean(acceso)) return false;
  if (acceso) lista.add(classe);
  else lista.remove(classe);
  return true;
}
