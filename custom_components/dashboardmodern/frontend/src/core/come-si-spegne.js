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

import { SA } from "./media-player.js";

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

/* Un lettore si ferma come SA fermarsi, non come vorremmo noi.
 *
 * Ogni `media_player` riceveva `media_pause`. Ma la pausa non ce l'hanno
 * tutti: un altoparlante da annunci, una radio via rete, certe TV sanno solo
 * fermarsi o spegnersi. A loro il tasto arrivava lo stesso, Home Assistant
 * rispondeva «non supportato», e l'entita' restava accesa — cioe' il tasto
 * c'era e non serviva a niente.
 *
 * Home Assistant lo dichiara in `supported_features`, e questa plancia quel
 * numero lo sa gia' leggere: le sigle stanno in `media-player.js` e sono
 * quelle del protocollo, non una convenzione nostra. Si sceglie in ordine di
 * gentilezza — la pausa lascia il segno dov'era, il ferma lo perde, lo spegni
 * spegne la TV attaccata — e chi non sa fare nessuna delle tre non prende un
 * tasto che non funzionerebbe. */
function comandoDelLettore(stato) {
  const bandiere = Number(stato?.attributes?.supported_features) || 0;
  const sa = (bandiera) => Boolean(bandiere & bandiera);
  if (sa(SA.PAUSA)) return { dominio: "media_player", servizio: "media_pause", parola: "pausa" };
  if (sa(SA.FERMA)) return { dominio: "media_player", servizio: "media_stop", parola: "ferma" };
  if (sa(SA.SPEGNI)) return { dominio: "media_player", servizio: "turn_off", parola: "spegni" };
  return null;
}

/**
 * Come si spegne questa entita'.
 *
 * Torna `{ dominio, servizio, parola }` — `parola` e' la chiave da tradurre
 * dove si disegna, non una frase gia' scritta: qui non si sa in che lingua
 * sta guardando chi guarda. `null` quando non c'e' niente da comandare.
 *
 * `stato` e' quello che Home Assistant dice di quell'entita' adesso: serve ai
 * lettori, che dichiarano cosa sanno fare. Senza, di un lettore non si sa
 * niente e non gli si promette niente.
 */
export function comandoPerSpegnere(entity, stato = null) {
  const dominio = dominioDi(entity);
  if (!dominio) return null;
  /* Una tapparella non si spegne: si chiude. */
  if (dominio === "cover") return { dominio: "cover", servizio: "close_cover", parola: "chiudi" };
  /* Una cassa che suona si mette in pausa: spegnerla vorrebbe dire spegnere la
   * TV a cui e' attaccata, e non e' quello che chiede chi vede «in
   * riproduzione». Se la pausa non ce l'ha, si guarda cosa sa fare. */
  if (dominio === "media_player") return comandoDelLettore(stato);
  /* Una serratura si chiude a chiave. */
  if (dominio === "lock") return { dominio: "lock", servizio: "lock", parola: "chiudi" };
  if (SI_SPENGONO.has(dominio))
    return { dominio: "homeassistant", servizio: "turn_off", parola: "spegni" };
  /* Un contatto, un sensore: si guarda. */
  return null;
}
