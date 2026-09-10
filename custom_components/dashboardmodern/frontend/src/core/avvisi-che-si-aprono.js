/* Un avviso personalizzato che si fa vedere da solo (#445).
 *
 * «Ho una gestione carichi che mi stacca e attacca gli elettrodomestici in
 *  base al carico, e ho un boolean che se attivo mi indica con un popup il suo
 *  intervento: vorrei sfruttarlo in questo fantastico lavoro.»
 *
 * La tessera dell'avviso personalizzato c'e' da un pezzo e si accende: chi
 * guarda la Home la vede. Ma un intervento del distacco carichi non e' una
 * cosa da vedere passando — e' una cosa da sapere adesso, ed e' esattamente la
 * differenza fra una tessera e un popup. Una tessera aspetta lo sguardo; un
 * popup lo va a prendere.
 *
 * ── Perche' questo modulo esiste, ed e' cosi' piccolo ────────────────────────
 *
 * Aprire una finestra addosso a chi guarda e' il gesto piu' facile da
 * sbagliare di tutta la plancia, e i modi di sbagliarlo sono tre:
 *
 *  1. aprirla al primo sguardo. L'avviso e' acceso da stamattina; aprire la
 *     Home e trovarsi la finestra in faccia, ogni volta, per una cosa che si
 *     sa gia', e' il modo piu' rapido di far spegnere la funzione;
 *  2. riaprirla mentre l'avviso resta acceso. Lo stato non cambia per ore, e
 *     ogni disegno riproporrebbe la stessa finestra — anche subito dopo che
 *     l'hai chiusa;
 *  3. aprirla sopra qualcos'altro. Chi sta guardando un'altra finestra ha gia'
 *     scelto cosa guardare.
 *
 * Tutti e tre si evitano rispondendo a una domanda sola, che e' quella di qui:
 * quali avvisi si sono ACCESI ADESSO — cioe' erano spenti l'ultima volta che
 * si e' guardato e sono accesi ora. Non «quali sono accesi»: quali sono
 * cambiati. Il primo sguardo non ha un «prima», e allora non accende niente:
 * prende nota e basta.
 *
 * E' puro: entrano due elenchi, esce un elenco. Chi apre davvero la finestra
 * sta nella sezione, che e' l'unica a sapere se ce n'e' gia' una aperta.
 */

const insieme = (valori) =>
  new Set(
    (Array.isArray(valori) ? valori : [...(valori || [])])
      .map((v) => String(v ?? "").trim())
      .filter(Boolean),
  );

/**
 * Quali avvisi si sono accesi adesso, e cosa ricordarsi per la prossima volta.
 *
 * `prima` e' `null` al primo sguardo — e allora non si apre niente: non si sa
 * se l'avviso e' appena scattato o se e' acceso da ieri, e sbagliare in quel
 * verso vuol dire una finestra in faccia a ogni apertura della Home.
 */
export function avvisiAppenaAccesi(prima, adesso) {
  const ora = insieme(adesso);
  if (prima === null || prima === undefined) return { aperti: [], memoria: ora };
  const erano = insieme(prima);
  return { aperti: [...ora].filter((chiave) => !erano.has(chiave)), memoria: ora };
}
