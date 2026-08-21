/* Un passo che cade non deve zittire quelli dopo.
 *
 * L'avvio e il rinfresco della plancia sono due file di chiamate al vecchio
 * runtime, una dietro l'altra: la proiezione della configurazione, le schede
 * dei dispositivi, la visibilita' delle sezioni, il disegno. Erano scritte di
 * seguito, senza rete: bastava che la prima inciampasse — una configurazione
 * strana, un'entita' che non c'e' piu' — perche' tutte quelle dopo non
 * partissero mai. Chi lo subiva vedeva sezioni configurate e attive comparire
 * a un caricamento e sparire a quello successivo, a seconda di quando arrivava
 * la configurazione condivisa e di quale passo inciampava quella volta.
 *
 * Qui ogni passo corre per conto suo. Se cade lo si dice, col suo nome, e si
 * tira dritto: la plancia esce incompleta in un punto invece che vuota, e il
 * prossimo racconto porta scritto quale passo l'ha fatta cadere. */

/**
 * Esegue i passi in ordine, uno per volta, isolati.
 *
 * @param {Array<[string, Function]>} steps coppie nome/passo.
 * @param {{onError?: (name: string, error: unknown) => void}} [options]
 * @returns {string[]} i nomi dei passi caduti, nell'ordine in cui sono caduti.
 */
export function runSteps(steps, { onError } = {}) {
  const caduti = [];
  for (const step of steps || []) {
    const [name, run] = Array.isArray(step) ? step : [];
    if (typeof run !== "function") continue;
    try {
      run();
    } catch (error) {
      caduti.push(String(name));
      try {
        onError?.(String(name), error);
      } catch (_ignored) {}
    }
  }
  return caduti;
}

/** Il racconto standard di un passo caduto: nome esplicito, non "qualcosa". */
export const stepReporter = (console_, prefisso) => (name, error) =>
  console_?.error?.(`[DashboardModern] ${prefisso}: "${name}" non e' andato a buon fine`, error);
