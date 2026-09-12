/* Come si spegne quello che e' rimasto acceso.
 *
 * L'elenco che si apre dalla barra sotto il meteo dice cosa e' acceso adesso —
 * «devi mostrare solo quelli accesi» — e un elenco di cose accese che non si
 * possono spegnere e' mezzo elenco: chi lo apre lo apre proprio per quello.
 *
 * Il servizio giusto pero' non e' uno solo. `homeassistant.turn_off` vale per
 * tutto quello che ha due stati — una luce, una presa, un ventilatore, un
 * clima — ma una tapparella non si spegne, si chiude; una cassa che suona non
 * si spegne, si mette in pausa; una serratura si chiude a chiave. E un
 * contatto sull'anta di una finestra non si comanda affatto: e' un sensore,
 * dice e basta.
 *
 * Qui non si guarda il documento e non si chiama niente: entra un'entita',
 * esce il servizio da chiamare e la parola da scrivere sul tasto — oppure
 * `null`, che vuol dire «questa si guarda soltanto».
 */

const clean = (value) => String(value ?? "").trim();

/** Il dominio di un'entita', in minuscolo: «light» di `light.cucina`. */
export function dominioDi(entity) {
  const id = clean(entity);
  const punto = id.indexOf(".");
  return punto > 0 ? id.slice(0, punto).toLowerCase() : "";
}

/* Quello che si spegne davvero. `homeassistant.turn_off` li prende tutti in
 * una riga sola, ed e' il servizio che Home Assistant stesso consiglia per non
 * dover conoscere il dominio. */
const SI_SPENGONO = new Set([
  "light",
  "switch",
  "input_boolean",
  "fan",
  "climate",
  "humidifier",
  "water_heater",
  "siren",
  "vacuum",
  "remote",
]);

/**
 * Come si spegne questa entita'.
 *
 * Torna `{ dominio, servizio, parola }` — `parola` e' la chiave da tradurre
 * dove si disegna, non una frase gia' scritta: qui non si sa in che lingua
 * sta guardando chi guarda. `null` quando non c'e' niente da comandare.
 */
export function comandoPerSpegnere(entity) {
  const dominio = dominioDi(entity);
  if (!dominio) return null;
  /* Una tapparella non si spegne: si chiude. */
  if (dominio === "cover") return { dominio: "cover", servizio: "close_cover", parola: "chiudi" };
  /* Una cassa che suona si mette in pausa: spegnerla vorrebbe dire spegnere la
   * TV a cui e' attaccata, e non e' quello che chiede chi vede «in
   * riproduzione». */
  if (dominio === "media_player")
    return { dominio: "media_player", servizio: "media_pause", parola: "pausa" };
  /* Una serratura si chiude a chiave. */
  if (dominio === "lock") return { dominio: "lock", servizio: "lock", parola: "chiudi" };
  if (SI_SPENGONO.has(dominio))
    return { dominio: "homeassistant", servizio: "turn_off", parola: "spegni" };
  /* Un contatto, un sensore: si guarda. */
  return null;
}
