/* Il foglio di stile del guscio, quando ci mette troppo o non arriva.
 *
 * «I flussi spesso scompaiono e nel mio caso la batteria anche. Devo
 * ricaricare spesso la pagina per far comparire tutto correttamente.» Nella
 * console, sotto quella pagina, c'era scritto: «this page failed to load a
 * stylesheet from a URL — dashboard-runtime-it.css». E poco dopo, guardando la
 * stessa pagina: «dopo parecchio tempo li ha caricati».
 *
 * Non e' un file che manca: c'e', e pesa duecentosessantaquattro kilobyte. E'
 * una richiesta che ogni tanto si perde o arriva tardissimo. Finche' non
 * arriva, la plancia sembra quasi normale — l'intestazione, le linguette, la
 * barra in basso e i carichi in fondo se li disegnano i moduli, che portano il
 * proprio stile con se' — ma tutto cio' che ha lo stile solo li' resta senza:
 * i cerchi del flusso (Solare, Rete, Casa, Batteria) restano invisibili, e la
 * pagina Energia mostra due archi tratteggiati appesi al nulla.
 *
 * Da fuori e' «i flussi sono scomparsi», e ricaricare funziona perche' la
 * seconda richiesta di solito riesce. Qui la seconda richiesta la si fa da
 * soli, senza buttare via la pagina e senza che nessuno debba accorgersene.
 *
 * Un foglio che non e' arrivato non compare in `document.styleSheets`, mentre
 * il suo `<link>` resta nel documento: e' quella la differenza che si guarda.
 */
import { root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_FOGLIO_GUSCIO__";
const state = (root[KEY] ||= { installed: false, tentativi: 0 });

/* Il foglio grosso del guscio, quello con la lingua nel nome. L'altro —
 * `dashboard-runtime.css`, dodici kilobyte — non porta il disegno delle
 * sezioni, e trovare lui non vuol dire che sia arrivato questo. */
const NOME = /dashboard-runtime-[a-z]{2}(?:-[a-z]+)?\.css(?:$|\?)/i;

/** Il `<link>` del guscio, se il documento ne ha uno. */
function collegamento() {
  for (const nodo of root.document?.querySelectorAll?.('link[rel~="stylesheet"][href]') || [])
    if (NOME.test(String(nodo.getAttribute("href") || ""))) return nodo;
  return null;
}

/** Se quel foglio e' davvero arrivato. */
export function foglioArrivato() {
  try {
    for (const foglio of root.document?.styleSheets || [])
      if (NOME.test(String(foglio.href || ""))) return true;
  } catch (_error) {
    /* Un foglio di un'altra origine puo' far arrabbiare la lettura: nel dubbio
     * si dice di si', perche' riprovare a vuoto e' peggio che non riprovare. */
    return true;
  }
  return false;
}

/* Si richiede lo stesso indirizzo con una coda diversa: senza, il browser
 * risponde con la stessa risposta fallita che ha gia' in mano. */
function riprova(nodo, numero) {
  const href = String(nodo.getAttribute("href") || "");
  if (!href) return false;
  const separatore = href.includes("?") ? "&" : "?";
  const nuovo = root.document.createElement("link");
  nuovo.rel = "stylesheet";
  nuovo.dataset.dmFoglioRiprovato = String(numero);
  nuovo.href = `${href}${separatore}dm-riprova=${numero}`;
  nodo.after(nuovo);
  return true;
}

/* Tre tentativi, sempre piu' distanziati. Se dopo il terzo non c'e' ancora,
 * insistere non e' recupero: e' un giro che non finisce mai. */
const ATTESE = Object.freeze([600, 2500, 8000]);

export function controllaFoglio() {
  if (foglioArrivato()) return true;
  const nodo = collegamento();
  if (!nodo) return true;
  if (state.tentativi >= ATTESE.length) return false;
  const numero = state.tentativi + 1;
  const attesa = ATTESE[state.tentativi];
  state.tentativi = numero;
  riprova(nodo, numero);
  root.setTimeout?.(controllaFoglio, attesa);
  return false;
}

export function installFoglioDelGuscio() {
  if (state.installed) return false;
  if (!root.document?.querySelectorAll) return false;
  state.installed = true;
  /* Non subito: mentre il documento si sta ancora leggendo, un foglio che sta
   * arrivando non e' ancora fra quelli arrivati, e lo si direbbe perso senza
   * che lo sia. Si guarda quando la pagina ha finito di caricare, e una volta
   * ancora poco dopo. */
  const avvia = () => {
    controllaFoglio();
    root.setTimeout?.(controllaFoglio, 1500);
  };
  if (root.document.readyState === "complete") avvia();
  else root.addEventListener?.("load", avvia, { once: true });
  return true;
}
