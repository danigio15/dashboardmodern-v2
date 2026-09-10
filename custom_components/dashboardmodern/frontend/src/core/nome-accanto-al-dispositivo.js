/* Come si chiama un'entita' che sta accanto a un dispositivo.
 *
 * Home Assistant chiama le entita' di un dispositivo «Nome del dispositivo
 * Nome dell'entita'»: su una scheda che porta gia' «Roborock Qrevo Edge» in
 * testa, un tasto «Roborock Qrevo Edge Asp e lav» ripete tre parole per dirne
 * tre. La regola e' una sola — si toglie il prefisso quando c'e' — e vale per
 * tutte le entita' che una scheda si porta dietro: i comandi in piu' di un
 * robot o di un elettrodomestico, le sue letture, le sue mappe.
 *
 * Sta qui, e non dentro il modello del robot, perche' i comandi e le letture
 * la usano tutt'e due: tenerla di la' vorrebbe dire due moduli che si
 * importano a vicenda, oppure la stessa regola scritta due volte.
 */

const clean = (value) => String(value ?? "").trim();

/** Una parola d'id — `asp_e_lav` — scritta come si legge: «Asp e lav». */
export function umano(testo) {
  const pulito = clean(testo).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return pulito ? pulito[0].toUpperCase() + pulito.slice(1) : "";
}

/**
 * Il nome di quell'entita', senza il nome del dispositivo davanti.
 *
 * Senza `friendly_name` si legge la coda dell'id, che e' comunque una parola
 * scritta da qualcuno.
 *
 * Il nome della scheda puo' non venire da un'entita' (#338): un
 * elettrodomestico comandato solo da script un'entita' sua non ce l'ha, e
 * quello che sta scritto in testa alla sua scheda e' il nome che gli ha dato
 * chi l'ha configurato. Si prova con tutti e due i prefissi — quello
 * dell'entita' e quello scritto — perche' un apparecchio puo' avere l'uno,
 * l'altro o due nomi diversi.
 */
export function nomeAccantoAlDispositivo(entity, dispositivo = {}, states = {}) {
  const voce = clean(entity);
  const proprio = clean(states?.[voce]?.attributes?.friendly_name);
  const prefissi = [
    clean(states?.[clean(dispositivo?.entity)]?.attributes?.friendly_name),
    clean(dispositivo?.name),
  ].filter(Boolean);
  if (proprio) {
    for (const suo of prefissi) {
      if (proprio.length <= suo.length || !proprio.toLowerCase().startsWith(suo.toLowerCase()))
        continue;
      const coda = proprio.slice(suo.length).replace(/^[\s:·\-–—]+/, "");
      if (coda) return umano(coda);
    }
    return proprio;
  }
  const oggetto = voce.split(".")[1] || voce;
  const radice = clean(dispositivo?.entity).split(".")[1] || "";
  const coda =
    radice && oggetto.startsWith(`${radice}_`) ? oggetto.slice(radice.length + 1) : oggetto;
  return umano(coda);
}
