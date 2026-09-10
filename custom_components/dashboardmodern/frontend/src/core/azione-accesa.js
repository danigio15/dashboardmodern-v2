/* Un'azione rapida che e' accesa lo dice (#477).
 *
 * «Color the active Quick Action cards when they are active. Change the card's
 * background color when it is active; for example, when the "light" card is
 * active, the background could turn yellow.»
 *
 * Il tasto di un'azione rapida e' un tasto: si preme e succede qualcosa. Ma
 * meta' delle azioni che uno ci mette non sono gesti, sono INTERRUTTORI — la
 * luce del salone, la presa del ripetitore, il gruppo di luci del piano — e un
 * interruttore che non dice se e' acceso costringe ad andare a vedere da
 * un'altra parte.
 *
 * Quindi: chi ha uno stato lo mostra, chi non ce l'ha resta com'e'. Una scena
 * non e' mai «accesa» — si lancia e basta — e colorarla vorrebbe dire dire una
 * cosa falsa. Percio' questa funzione ha tre risposte e non due: acceso,
 * spento, e «questa azione uno stato non ce l'ha».
 *
 * E' puro: entrano l'azione e gli stati, esce la risposta. Il colore lo mette
 * la sezione, con la tinta che l'azione ha gia'.
 */

const pulito = (valore) => String(valore ?? "").trim();
const minuscolo = (valore) => pulito(valore).toLowerCase();

/* Gli stati che vogliono dire «acceso». `playing` c'e' per i lettori, `open`
 * per una tapparella messa fra le azioni: sono modi diversi di dire che quella
 * cosa sta facendo qualcosa. */
const ACCESI = new Set(["on", "open", "opening", "playing", "cleaning", "heat", "cool", "auto"]);

/* Gli stati che vogliono dire «non lo so»: una cosa che non risponde non e'
 * spenta, e colorarla di spento sarebbe una bugia tranquillizzante. */
const MUTI = new Set(["", "unavailable", "unknown", "none"]);

/* I tipi di azione che uno stato non ce l'hanno mai. Una scena non e' accesa:
 * e' un pulsante che mette la casa in un certo modo, e finisce li'. */
const SENZA_STATO = new Set(["scene", "script_run", "service", "url", "navigate"]);

/** L'entita' che dice se questa azione e' accesa, o "" se non ce n'e' una. */
export function entitaDellAzione(azione) {
  if (!azione || typeof azione !== "object") return "";
  const tipo = minuscolo(azione.type);
  if (SENZA_STATO.has(tipo)) return "";
  return pulito(azione.entity || azione.entity_id);
}

/**
 * Se un'azione rapida e' accesa adesso.
 *
 * Torna `true`, `false`, oppure `null` quando la domanda non ha senso — una
 * scena, un'azione senza entita', un'entita' che non risponde. Chi disegna
 * colora solo il `true`: il `false` e' il tasto normale, e il `null` non deve
 * nemmeno sembrare spento.
 */
export function azioneAccesa(azione, states = {}, risolvi = null) {
  if (!azione || typeof azione !== "object") return null;
  /* Un gruppo di luci e' acceso se lo e' almeno una: e' la stessa regola con
   * cui la plancia conta le luci accese di una stanza, e quella che uno ha in
   * testa quando guarda il tasto «Piano di sopra». */
  if (minuscolo(azione.type) === "luci_group") {
    const luci = Array.isArray(azione.lights) ? azione.lights.map(pulito).filter(Boolean) : [];
    if (!luci.length) return null;
    let vive = 0;
    for (const luce of luci) {
      const stato = minuscolo(states?.[risolta(luce, risolvi)]?.state);
      if (MUTI.has(stato)) continue;
      vive += 1;
      if (ACCESI.has(stato)) return true;
    }
    return vive ? false : null;
  }
  const entity = entitaDellAzione(azione);
  if (!entity) return null;
  const stato = minuscolo(states?.[risolta(entity, risolvi)]?.state);
  if (MUTI.has(stato)) return null;
  /* Uno script mentre gira e' acceso: e' l'unico caso in cui un gesto ha una
   * durata, e vederlo acceso dice «sta ancora andando». */
  return ACCESI.has(stato);
}

/* Il nome vero di un'entita' scritta con una scorciatoia.
 *
 * Un'azione rapida si puo' configurare con un alias della plancia — `dm.luce`,
 * per dire — e chi la esegue lo traduce prima di parlare con Home Assistant. Il
 * registro degli stati pero' conosce solo i nomi veri: cercarci dentro l'alias
 * non trova niente, e il tasto restava spento anche dopo aver acceso la luce.
 * Qui si traduce prima di guardare. */
function risolta(entity, risolvi) {
  if (typeof risolvi !== "function") return entity;
  try {
    return pulito(risolvi(entity)) || entity;
  } catch (_errore) {
    return entity;
  }
}

/** Le entita' che le azioni guardano: serve a chi decide se ridisegnare. */
export function entitaDelleAzioni(azioni = [], risolvi = null) {
  const elenco = [];
  for (const azione of Array.isArray(azioni) ? azioni : []) {
    if (minuscolo(azione?.type) === "luci_group") {
      for (const luce of Array.isArray(azione?.lights) ? azione.lights : [])
        if (pulito(luce)) elenco.push(risolta(pulito(luce), risolvi));
      continue;
    }
    const entity = entitaDellAzione(azione);
    if (entity) elenco.push(risolta(entity, risolvi));
  }
  return [...new Set(elenco)];
}
