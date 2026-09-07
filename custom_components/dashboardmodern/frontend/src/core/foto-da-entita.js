/* La foto di una cosa, quando a darla e' un'entita' di Home Assistant (#369).
 *
 * «Sarebbe utile avere anche la possibilita' di specificare l'immagine
 * dell'auto come entita' immagine da selezionare al posto del path del file
 * locale. Alcune integrazioni come UConnect mettono a disposizione questa
 * entita'.»
 *
 * Finora la foto era un indirizzo scritto a mano: `/local/mia_auto.png`. Ma
 * certe integrazioni la foto ce l'hanno gia' — l'auto vera, con lo sporco di
 * oggi — e la pubblicano come entita': un `image.` o una `camera.`. Copiarla a
 * mano in `www` vuol dire tenerla aggiornata a mano.
 *
 * Home Assistant mette l'indirizzo vero in `entity_picture`, e ci mette dentro
 * un gettone che cambia quando l'immagine cambia: e' la cosa giusta da usare —
 * si aggiorna da se' e non resta in cache quando la foto e' un'altra.
 *
 * Qui c'e' solo il riconoscimento e la lettura. Chi disegna non deve sapere se
 * sta guardando un file o un'entita': chiede l'indirizzo e basta.
 */

const clean = (value) => String(value ?? "").trim();

/* I domini che una foto ce l'hanno davvero.
 *
 * `image` e' quello fatto apposta. `camera` la pubblica come fermo immagine, ed
 * e' quello che usano parecchie integrazioni auto per la vista dall'alto.
 * `person` ha un ritratto ma non e' una foto di una cosa: sta fuori, o
 * scrivendo per sbaglio una persona in una casella dell'auto uscirebbe la sua
 * faccia sull'eroe. */
const DOMINI_CON_FOTO = Object.freeze(["image", "camera"]);

/** Se questo valore e' il nome di un'entita' che porta una foto. */
export function eUnaFotoDaEntita(valore) {
  const testo = clean(typeof valore === "string" ? valore : valore?.url || valore?.path || "");
  const punto = testo.indexOf(".");
  if (punto <= 0 || testo.includes("/") || testo.includes(" ")) return false;
  return DOMINI_CON_FOTO.includes(testo.slice(0, punto).toLowerCase());
}

/**
 * L'indirizzo della foto pubblicata da quell'entita', o `""`.
 *
 * Torna vuoto quando l'entita' non c'e' o non ha ancora una foto: vuoto vuol
 * dire «nessuna foto», e chi disegna sa gia' cosa farne. Inventare un indirizzo
 * vorrebbe dire un riquadro rotto al posto di niente.
 */
export function fotoDallEntita(valore, states = {}) {
  if (!eUnaFotoDaEntita(valore)) return "";
  const id = clean(typeof valore === "string" ? valore : valore?.url || valore?.path || "");
  const stato = states?.[id];
  const foto = clean(stato?.attributes?.entity_picture);
  if (foto) return foto;
  /* Certe telecamere non pubblicano `entity_picture` finche' non le si guarda:
   * l'indirizzo del fermo immagine e' pero' sempre lo stesso, e Home Assistant
   * lo serve. Meglio quello di un buco. */
  const dominio = id.slice(0, id.indexOf("."));
  if (dominio === "camera" && stato) return `/api/camera_proxy/${id}`;
  return "";
}
