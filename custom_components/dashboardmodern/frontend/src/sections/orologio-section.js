/* L'orologio, accanto al meteo (#272).
 *
 * «Sarebbe carino avere l'orologio. Magari vicino al meteo.»
 *
 * Il posto è quello: il meteo sta nell'intestazione, e alla sua destra c'è lo
 * spazio che avanza prima dello stato del ponte. Ora e data insieme, perché su
 * una plancia appesa al muro la data serve quanto l'ora — e chi la guarda dal
 * telefono l'ora ce l'ha già in cima allo schermo, quindi qui non si prende più
 * spazio del necessario: sul telefono la data sparisce e resta l'ora.
 *
 * Non c'è un cronometro che gira ogni secondo. I secondi non si mostrano, e
 * tenere acceso un battito al secondo per aggiornare un numero che cambia una
 * volta al minuto è lavoro sprecato su una pagina che sta aperta tutto il
 * giorno: il prossimo aggiornamento si fissa sul minuto esatto che viene, e
 * quando arriva se ne fissa un altro. L'ora è sempre giusta e la pagina dorme
 * in mezzo.
 *
 * Le parole non sono nostre: mese e giorno li scrive `Intl` nella lingua della
 * plancia, che è l'unico modo perché tredici lingue leggano una data come la
 * leggono a casa loro.
 */
import { rigaDellaTestata } from "./weather-in-masthead-section.js";
import { doc, installStyle, locale, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_OROLOGIO__";
const STYLE_ID = "dm-orologio-style";
const state = (root[KEY] ||= { installed: false, attesa: 0, firma: "" });

export const OROLOGIO_KEY = "cd_orologio";

/** Se l'orologio si vede. Di serie sì: era la richiesta. */
export function orologioAcceso() {
  try {
    return root.localStorage?.getItem?.(OROLOGIO_KEY) !== "0";
  } catch (_error) {
    return true;
  }
}

/* Ora e data, nella lingua della plancia.
 *
 * L'ora senza secondi e senza AM/PM dove non si usa: `Intl` sa quale delle due
 * forme è quella di casa, e sceglierla a mano vorrebbe dire sceglierla male per
 * dodici lingue su tredici. */
export function lettureOrologio(adesso = new Date(), lingua = locale()) {
  const prova = (opzioni) => {
    try {
      return new Intl.DateTimeFormat(lingua, opzioni).format(adesso);
    } catch (_error) {
      return "";
    }
  };
  return {
    ora: prova({ hour: "2-digit", minute: "2-digit" }) || "",
    data: prova({ weekday: "short", day: "numeric", month: "short" }) || "",
  };
}

/* Quanto manca al prossimo minuto. Mai zero: un'attesa di zero millisecondi è
 * un cronometro che gira a vuoto. */
export function fraQuantoIlMinuto(adesso = new Date()) {
  const resto = adesso.getSeconds() * 1000 + adesso.getMilliseconds();
  return Math.max(250, 60_000 - resto);
}

function testata() {
  return doc?.querySelector?.("header") || null;
}

function nodo() {
  const header = testata();
  if (!header) return null;
  /* Il riquadro sotto il titolo è del meteo, che ce l'aveva già: l'ora ci si
   * mette dentro invece di disegnarsene un altro accanto — «devono stare nello
   * stesso quadrato». Senza riquadro — nessun meteo configurato — si sta nella
   * testata come prima. */
  const casa = rigaDellaTestata() || header;
  let quadrante =
    casa.querySelector(":scope > .dm-orologio") || header.querySelector(".dm-orologio");
  if (!quadrante) {
    quadrante = doc.createElement("div");
    quadrante.className = "dm-orologio";
    quadrante.setAttribute("role", "group");
    quadrante.setAttribute("aria-label", t("Ora e data", "Time and date"));
    quadrante.innerHTML = `<b class="dm-orologio-ora"></b><small class="dm-orologio-data"></small>`;
  }
  /* Ultimo nel riquadro: il meteo prima, l'ora dopo. */
  if (quadrante.parentElement !== casa || quadrante.nextElementSibling) casa.append(quadrante);
  return quadrante;
}

export function disegnaOrologio() {
  const quadrante = nodo();
  if (!quadrante) return false;
  const acceso = orologioAcceso();
  quadrante.hidden = !acceso;
  if (!acceso) return true;
  const { ora, data } = lettureOrologio();
  const firma = `${ora}|${data}`;
  if (state.firma === firma) return true;
  state.firma = firma;
  const dove = quadrante.querySelector(".dm-orologio-ora");
  const quando = quadrante.querySelector(".dm-orologio-data");
  if (dove) dove.textContent = ora;
  if (quando) quando.textContent = data;
  return true;
}

/* Il prossimo giro si fissa sul minuto che viene, e quando arriva se ne fissa
 * un altro: nessun cronometro acceso in mezzo. */
function alProssimoMinuto() {
  if (state.attesa) root.clearTimeout?.(state.attesa);
  state.attesa =
    root.setTimeout?.(() => {
      state.attesa = 0;
      disegnaOrologio();
      alProssimoMinuto();
    }, fraQuantoIlMinuto()) || 0;
}

function installStyles() {
  installStyle(
    STYLE_ID,
    `
      /* Dentro il riquadro non c'è un secondo riquadro: il bordo e il fondo
         sono del riquadro, e l'ora ci sta dentro nuda, staccata dal meteo da
         un filo e basta. */
      header .dm-orologio{
        flex:0 0 auto;display:grid;justify-items:end;gap:0;margin-left:auto;
        padding:0 0 0 10px;border-left:1px solid var(--card-border,#e8edf3)}
      header .dm-orologio[hidden]{display:none}
      header .dm-orologio-ora{
        font-family:'Oswald',system-ui,sans-serif;font-size:19px;font-weight:700;
        line-height:1.1;letter-spacing:.02em;color:var(--text,#0f172a);
        font-variant-numeric:tabular-nums}
      header .dm-orologio-data{
        font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;
        color:var(--text-dim,#64748b);white-space:nowrap}
      /* Sul telefono l'ora ce l'ha già il sistema in cima allo schermo: qui
         resta il numero e la data se ne va, invece di stringere tutto. */
      @media (max-width:560px){
        header .dm-orologio{padding:0 0 0 8px}
        header .dm-orologio-ora{font-size:16px}
        header .dm-orologio-data{display:none}
      }
    `,
  );
}

export function installOrologio() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  disegnaOrologio();
  alProssimoMinuto();
  /* La testata la rifà il guscio a ogni giro: l'orologio si rimette quando
   * succede, e la firma evita di riscrivere due numeri che non sono cambiati. */
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:locale-changed",
    "pageshow",
  ])
    root.addEventListener?.(evento, () => {
      state.firma = "";
      disegnaOrologio();
    });
  /* Tornando su una scheda lasciata aperta l'ora è vecchia di ore: si rifà
   * subito e si rimette in orario col minuto. */
  doc.addEventListener?.("visibilitychange", () => {
    if (doc.visibilityState !== "visible") return;
    state.firma = "";
    disegnaOrologio();
    alProssimoMinuto();
  });
  return true;
}
