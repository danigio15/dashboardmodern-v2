/* Il velo delle finestre: cosa c'è dietro una finestra aperta (#522).
 *
 * «Se apro alcune card, come quella della persona, sullo sfondo resta la
 *  dashboard sfocata; se apro tutte le altre invece lo sfondo è nero.»
 *
 * Non è un difetto di una finestra: è che il velo era scritto ogni volta da
 * capo, e ogni volta con numeri diversi. Il guscio storico copre al 85% sul
 * chiaro e all'82% sullo scuro, con venti pixel di sfocatura: a quell'opacità
 * la plancia dietro non si distingue più, e si legge «nero». Quella della
 * persona copriva al 55% con sei pixel: la plancia dietro si vedeva eccome,
 * solo sfocata. Due finestre della stessa plancia, due mondi.
 *
 * Quindi il velo si scrive qui, una volta, con i numeri del guscio — perché
 * sono quelli che si vedono quasi dappertutto, e la finestra che stona è
 * l'altra. Chi lo usa dichiara i suoi valori con `tokenDelVelo` e mette
 * `VELO_DELLE_FINESTRE` sul proprio overlay: quanto sale la card, che raggio
 * ha, dove sta nell'impilamento restano cose sue.
 *
 * ── Quelle che ancora si vestono da sole ─────────────────────────────────
 *
 * Non sono tutte, ed è voluto dirlo invece di lasciarlo scoprire: `.dm-section-modal`
 * (58%, 5px), `.dm-appliance-daily-overlay` (58%, 7px) e `.dm-appliance-kpi-overlay`
 * (42%, 15px) hanno ancora i loro numeri. Passano di qui quando qualcuno le
 * tocca per un altro motivo — spostarle adesso, senza vederle, vorrebbe dire
 * cambiare tre schermate che nessuno ha segnalato.
 */

/* Il velo, senza le misure di chi lo porta: quelle — raggio, imbottitura,
 * impilamento, come entra — sono della finestra e restano sue. */
export const VELO_DELLE_FINESTRE = `position:fixed;inset:0;
  background:var(--dm-velo-fondo);
  backdrop-filter:blur(var(--dm-velo-sfocatura));
  -webkit-backdrop-filter:blur(var(--dm-velo-sfocatura))`;

/**
 * I valori del velo, per il tema chiaro e per quello scuro.
 *
 * Sono quelli del guscio storico, alla lettera: è il velo che chi usa la
 * plancia vede quasi ogni volta che apre qualcosa, e allinearsi a lui vuol
 * dire che non cambia niente per nessuno tranne che per la finestra che
 * stonava.
 *
 * `selettore` è chi lo porta, e si scrive una volta per blocco.
 */
export function tokenDelVelo(selettore) {
  return `${selettore}{
  --dm-velo-fondo:rgba(230,235,241,.85);
  --dm-velo-sfocatura:20px}
html[data-theme="dark"] ${selettore},
body.dark-theme ${selettore}{
  --dm-velo-fondo:rgba(8,12,22,.82)}`;
}
