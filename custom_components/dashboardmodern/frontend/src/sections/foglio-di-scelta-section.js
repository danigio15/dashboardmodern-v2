/* Il foglio con cui la plancia fa scegliere una cosa fra tante.
 *
 * Ce n'era uno solo, nell'editor degli elettrodomestici: uno sfondo scuro, una
 * scheda al centro, un titolo, quello che c'e' da scegliere e un tasto Chiudi.
 * Quando e' servita una seconda scelta — i dispositivi del Report, che vanno
 * disegnati con le icone di casa e non possono stare dentro un `<select>` — la
 * strada facile era ricopiare quelle quattro regole di stile. Ricopiate, le due
 * schede si sarebbero allontanate al primo ritocco.
 *
 * Qui c'e' la CORNICE, e basta: lo sfondo, la scheda, il titolo, il tasto per
 * chiudere, e i tre modi di chiudere che una scheda deve avere — il tasto, il
 * tocco fuori, il tasto Esc. Cosa ci sta dentro lo decide chi la apre: gli
 * elettrodomestici ci mettono una griglia di piastrelle, il Report un elenco di
 * righe. Sono due contenuti diversi per la stessa finestra, ed e' esattamente
 * la riga di taglio giusta.
 */
import { doc, installStyle, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_FOGLIO_DI_SCELTA__";
const state = (root[KEY] ||= { installed: false, aperto: null });

const STILE = "dm-foglio-scelta-style";

/* Il foglio sta sopra tutto, e non per vezzo: lo si apre da dentro una scheda
 * di modifica — l'editor degli elettrodomestici, l'editor del Report — e quelle
 * schede stanno gia' a `z-index:100040`. Un foglio piu' in basso si vede lo
 * stesso, perche' il velo dell'editor e' trasparente, ma i tocchi se li prende
 * la scheda sotto: le piastrelle si vedono e non si possono premere. Questa
 * riga stava scritta a parte, agganciata all'id di un solo foglio; ora e' della
 * cornice, cosi' vale per chiunque la apra senza doverselo ricordare. */
function installaLoStile() {
  installStyle(
    STILE,
    `
    .dm-foglio-scelta{position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:auto!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:16px!important;background:rgba(15,23,42,.60)!important}
    .dm-foglio-scelta-scheda{display:flex!important;flex-direction:column!important;box-sizing:border-box!important;width:min(460px,100%)!important;max-height:80dvh!important;padding:18px!important;border-radius:22px!important;background:var(--card-background-color,#fff)!important;color:var(--text,#0f172a)!important;box-shadow:0 20px 60px rgba(0,0,0,.35)!important}
    .dm-foglio-scelta-scheda>strong{margin-bottom:10px!important;font-size:14.5px!important;font-weight:900!important}
    .dm-foglio-scelta-corpo{overflow-y:auto!important;min-height:0!important}
    .dm-foglio-scelta-chiudi{margin-top:10px!important;min-height:44px!important;padding:11px!important;border:0!important;border-radius:12px!important;background:#94a3b8!important;color:#fff!important;font-weight:800!important;cursor:pointer!important}
    html[data-theme="dark"] .dm-foglio-scelta-scheda{background:var(--card-background-color,#111827)!important;color:var(--text,#e5e7eb)!important}
    `,
  );
}

/** Chiude il foglio aperto, se ce n'e' uno. */
export function chiudiIlFoglioDiScelta() {
  const aperto = state.aperto;
  if (!aperto) return false;
  state.aperto = null;
  try {
    aperto.remove();
  } catch (_errore) {}
  return true;
}

/**
 * Apre il foglio e torna il CORPO, che chi apre riempie come vuole.
 *
 * `titolo` e' la riga in cima. `id` serve a non averne due aperti dello stesso
 * genere. Chi chiama disegna dentro il corpo e chiude col valore scelto.
 */
export function apriIlFoglioDiScelta({ titolo = "", id = "dm-foglio-scelta" } = {}) {
  if (!doc?.body) return null;
  installaLoStile();
  chiudiIlFoglioDiScelta();
  doc.getElementById(id)?.remove();

  const sfondo = doc.createElement("div");
  sfondo.id = id;
  sfondo.className = "dm-foglio-scelta";
  const titoloId = `${id}-titolo`;
  sfondo.innerHTML = `<section class="dm-foglio-scelta-scheda" role="dialog" aria-modal="true" aria-labelledby="${titoloId}">
    <strong id="${titoloId}"></strong>
    <div class="dm-foglio-scelta-corpo"></div>
    <button type="button" class="dm-foglio-scelta-chiudi"></button>
  </section>`;
  /* Il titolo e la parola del tasto si scrivono come testo: passano da chi
   * chiama, e un titolo con dentro una virgoletta non deve poter diventare
   * markup. */
  sfondo.querySelector("strong").textContent = titolo;
  const chiudi = sfondo.querySelector(".dm-foglio-scelta-chiudi");
  chiudi.textContent = t("Chiudi", "Close");

  chiudi.addEventListener("click", () => chiudiIlFoglioDiScelta());
  sfondo.addEventListener("click", (evento) => {
    if (evento.target === sfondo) chiudiIlFoglioDiScelta();
  });

  doc.body.append(sfondo);
  state.aperto = sfondo;
  return sfondo.querySelector(".dm-foglio-scelta-corpo");
}

export function installFoglioDiSceltaSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installaLoStile();
  /* Esc chiude, che e' quello che chiunque prova per primo. Sta qui e non in
   * chi apre: e' della finestra, non di cosa c'e' scritto dentro. */
  doc.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") chiudiIlFoglioDiScelta();
  });
  return true;
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installFoglioDiSceltaSection, { once: true });
} else {
  installFoglioDiSceltaSection();
}
