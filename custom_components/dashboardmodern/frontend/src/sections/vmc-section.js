/* La ventilazione meccanica controllata, dentro il Clima (#371).
 *
 * «Sarebbe bellissimo avere nei climate la possibilita' di inserire i dati
 * delle 4 temperature delle macchine VMC… compresi i bypass, modalita'
 * estate/inverno ecc.»
 *
 * Le quattro temperature non sono quattro numeri da mettere in colonna: sono
 * due flussi d'aria che si incrociano, e messi cosi' si leggono da soli —
 * l'aria entra a meno cinque e arriva in casa a diciotto, quella di casa esce a
 * ventidue e se ne va a due. Disegnarle in fila avrebbe voluto dire quattro
 * numeri di cui bisogna ricordarsi il ruolo.
 *
 * La pagina del Clima ha UN padrone — `climate-thermal-section.js` — e resta
 * lui: qui ci sono il markup e la mano che lo dipinge, e li chiama lui insieme
 * al resto. Due moduli che scrivono sulla stessa pagina e' il difetto che
 * questa plancia ha gia' pagato altrove.
 *
 * I conti non stanno qui: quanto recupera la macchina lo dice
 * `core/vmc-model.js`, che e' puro e si prova a secco.
 */
import {
  CHIAVE_VMC,
  letturaVmc,
  vmcDisegnabili,
  vmcParla,
} from "../core/vmc-model.js";
import { allStates, clean, esc, readJson, roomLabel, t } from "./shared.js";

/** Le macchine configurate, come le salva la scheda della configurazione. */
export function vmcConfigurate() {
  return vmcDisegnabili(readJson(CHIAVE_VMC, []));
}

function parolaTemperatura(chiave) {
  switch (chiave) {
    case "esterna":
      return t("Aria esterna", "Outside air");
    case "immissione":
      return t("Immissione", "Supply");
    case "ripresa":
      return t("Ripresa", "Return");
    default:
      return t("Espulsione", "Exhaust");
  }
}

function parolaNumero(chiave) {
  switch (chiave) {
    case "ventola_immissione":
      return t("Ventola immissione", "Supply fan");
    case "ventola_espulsione":
      return t("Ventola espulsione", "Exhaust fan");
    case "livello_immissione":
      return t("Livello immissione", "Supply level");
    default:
      return t("Livello ripresa", "Return level");
  }
}

function parolaInterruttore(voce) {
  if (voce.chiave === "bypass")
    return voce.acceso ? t("Bypass aperto", "Bypass open") : t("Bypass chiuso", "Bypass closed");
  if (voce.chiave === "estate")
    return voce.acceso ? t("Estate", "Summer") : t("Inverno", "Winter");
  return voce.acceso ? t("Filtri da cambiare", "Filters need changing") : t("Filtri a posto", "Filters fine");
}

function gradi(voce) {
  if (!voce || voce.muto || voce.valore === null) return "--°";
  return `${Math.round(voce.valore * 10) / 10}°`;
}

function numeroScritto(voce) {
  if (!voce || voce.muto || voce.valore === null) return "—";
  const tondo = Math.round(voce.valore * 10) / 10;
  return voce.unita ? `${tondo} ${voce.unita}` : String(tondo);
}

/* Un braccio del flusso: da dove viene, a che temperatura, dove va.
 *
 * La freccia sta in mezzo e non ai lati perche' e' li' che succede la cosa —
 * lo scambio — e i due numeri che la circondano sono il prima e il dopo.
 *
 * ── Perche' fuori sta sempre a sinistra (#401) ───────────────────────────
 *
 * «Nella riga in basso dovresti invertire la freccia in modo che l'aria da
 *  casa vada verso fuori casa, o ancora meglio invertire e mettere fuori a
 *  sinistra e da casa a destra lasciando la freccia cosi', rispettando la
 *  logica della macchina che incrocia i flussi.»
 *
 * Prima le due righe mettevano tutte e due l'origine a sinistra: «Da fuori,
 * freccia a destra, In casa» sopra, e sotto «Da casa, freccia a SINISTRA,
 * Fuori». La seconda si contraddiceva da sola: la freccia puntava indietro,
 * verso la parola «Da casa» — cioe' diceva che l'aria entrava, mentre le
 * etichette dicevano che usciva.
 *
 * Adesso le colonne sono fisse: fuori a sinistra e casa a destra, in tutte e
 * due le righe. Quello che cambia e' la freccia, ed e' l'unica cosa che deve
 * cambiare, perche' e' l'unica informazione che distingue una riga dall'altra.
 * Incolonnate cosi', le due frecce si incrociano: che e' esattamente quello
 * che fa lo scambiatore. */
function flussoMarkup(lettura, verso) {
  const prima = Object.values(lettura.temperature).find(
    (voce) => voce.verso === verso && voce.posto === "prima",
  );
  const dopo = Object.values(lettura.temperature).find(
    (voce) => voce.verso === verso && voce.posto === "dopo",
  );
  if (!prima && !dopo) return "";
  const entra = verso === "entra";
  /* L'aria che entra va da fuori a casa, quella che esce da casa a fuori:
   * incolonnate allo stesso modo, il capo di sinistra e' il «prima» di una e
   * il «dopo» dell'altra. */
  const sinistra = entra ? prima : dopo;
  const destra = entra ? dopo : prima;
  return `<div class="dm-vmc-flusso" data-dm-vmc-verso="${esc(verso)}">
    <span class="dm-vmc-capo">
      <small>${esc(entra ? t("Da fuori", "From outside") : t("Fuori", "Outside"))}</small>
      <b data-dm-vmc-t="${esc(sinistra?.chiave || "")}">${esc(gradi(sinistra))}</b>
      <em>${esc(sinistra ? parolaTemperatura(sinistra.chiave) : "")}</em>
    </span>
    <span class="dm-vmc-freccia" aria-hidden="true">${entra ? "→" : "←"}</span>
    <span class="dm-vmc-capo">
      <small>${esc(entra ? t("In casa", "Into the house") : t("Da casa", "From the house"))}</small>
      <b data-dm-vmc-t="${esc(destra?.chiave || "")}">${esc(gradi(destra))}</b>
      <em>${esc(destra ? parolaTemperatura(destra.chiave) : "")}</em>
    </span>
  </div>`;
}

function pastiglieMarkup(lettura) {
  const voci = Object.values(lettura.interruttori).filter((voce) => voce && !voce.muto);
  if (!voci.length) return "";
  return `<div class="dm-vmc-pastiglie">${voci
    .map(
      (voce) =>
        `<span class="dm-vmc-pastiglia" data-dm-vmc-int="${esc(voce.chiave)}" data-acceso="${voce.acceso === true}" data-avvisa="${voce.avvisa === true && voce.acceso === true}"><span aria-hidden="true">${esc(voce.glifo)}</span>${esc(parolaInterruttore(voce))}</span>`,
    )
    .join("")}</div>`;
}

function numeriMarkup(lettura) {
  const voci = Object.values(lettura.numeri).filter((voce) => voce && !voce.muto);
  if (!voci.length) return "";
  return `<div class="dm-vmc-numeri">${voci
    .map(
      (voce) =>
        `<span class="dm-vmc-numero" data-dm-vmc-n="${esc(voce.chiave)}"><small>${esc(parolaNumero(voce.chiave))}</small><b>${esc(numeroScritto(voce))}</b></span>`,
    )
    .join("")}</div>`;
}

/* Il recupero: l'unico numero che dice se la macchina vale quello che costa.
 *
 * A mezza stagione non si dice — dentro e fuori sono a due gradi di distanza e
 * il conto salta fra il dieci e il duecento per cento — e col bypass aperto
 * nemmeno: li' l'aria salta lo scambiatore APPOSTA, e un recupero a zero
 * sembrerebbe un guasto invece della cosa giusta. */
function recuperoMarkup(lettura) {
  if (lettura.bypassAperto)
    return `<span class="dm-vmc-recupero" data-dm-vmc-recupero data-stato="bypass"><small>${esc(t("Recupero", "Recovery"))}</small><b>${esc(t("Escluso", "Bypassed"))}</b></span>`;
  if (lettura.recupero === null)
    return `<span class="dm-vmc-recupero" data-dm-vmc-recupero data-stato="muto"><small>${esc(t("Recupero", "Recovery"))}</small><b>--</b></span>`;
  return `<span class="dm-vmc-recupero" data-dm-vmc-recupero data-stato="${lettura.recupero >= 70 ? "buono" : "scarso"}"><small>${esc(t("Recupero", "Recovery"))}</small><b>${lettura.recupero}%</b></span>`;
}

function schedaMarkup(lettura) {
  const sotto = [roomLabel(lettura.stanza)].filter(Boolean).join(" · ");
  const nome = lettura.nome || t("Ventilazione", "Ventilation");
  return `<article class="dm-vmc-card" data-dm-vmc="${esc(lettura.id)}" data-avvisa="${lettura.avvisi.length > 0}">
    <div class="dm-vmc-head">
      <span class="dm-vmc-ic" aria-hidden="true">🔄</span>
      <span class="dm-vmc-titolo"><strong>${esc(nome)}</strong>${sotto ? `<small>${esc(sotto)}</small>` : ""}</span>
      ${recuperoMarkup(lettura)}
    </div>
    <div class="dm-vmc-flussi">
      ${flussoMarkup(lettura, "entra")}
      ${flussoMarkup(lettura, "esce")}
    </div>
    ${pastiglieMarkup(lettura)}
    ${numeriMarkup(lettura)}
  </article>`;
}

/** Le letture di adesso, per le macchine che hanno qualcosa da dire. */
export function letturaDelleVmc(states = allStates()) {
  return vmcConfigurate()
    .map((unita) => letturaVmc(unita, states))
    .filter(vmcParla);
}

/**
 * La fascia della ventilazione, o stringa vuota se non c'e' niente da dire.
 *
 * La chiama il padrone della pagina del Clima insieme al resto: qui non si
 * tocca il documento.
 */
export function vmcMarkup(letture = letturaDelleVmc()) {
  if (!letture.length) return "";
  return `<section class="dm-vmc" data-dm-vmc-fascia>
    <h3 class="dm-vmc-titolo-fascia">🔄 ${esc(t("Ventilazione meccanica", "Mechanical ventilation"))}</h3>
    <div class="dm-vmc-griglia">${letture.map(schedaMarkup).join("")}</div>
  </section>`;
}

/** L'impronta di quello che cambia la FORMA della fascia, non i numeri. */
export function firmaDelleVmc(letture) {
  return letture
    .map((lettura) =>
      [
        lettura.id,
        lettura.nome,
        Object.keys(lettura.temperature).join("+"),
        Object.values(lettura.interruttori)
          .filter((voce) => !voce.muto)
          .map((voce) => voce.chiave)
          .join("+"),
        Object.values(lettura.numeri)
          .filter((voce) => !voce.muto)
          .map((voce) => voce.chiave)
          .join("+"),
        lettura.avvisi.length,
        lettura.bypassAperto,
        lettura.recupero === null ? "" : "n",
      ].join("~"),
    )
    .join("|");
}

/** I numeri che cambiano dentro una fascia gia' disegnata. */
export function sincronizzaLeVmc(host, letture) {
  for (const lettura of letture) {
    const card = host?.querySelector?.(`[data-dm-vmc="${CSS.escape(lettura.id)}"]`);
    if (!card) continue;
    for (const voce of Object.values(lettura.temperature)) {
      const nodo = card.querySelector(`[data-dm-vmc-t="${CSS.escape(voce.chiave)}"]`);
      const testo = gradi(voce);
      if (nodo && nodo.textContent !== testo) nodo.textContent = testo;
    }
    for (const voce of Object.values(lettura.numeri)) {
      const nodo = card.querySelector(`[data-dm-vmc-n="${CSS.escape(voce.chiave)}"] b`);
      const testo = numeroScritto(voce);
      if (nodo && nodo.textContent !== testo) nodo.textContent = testo;
    }
    for (const voce of Object.values(lettura.interruttori)) {
      const nodo = card.querySelector(`[data-dm-vmc-int="${CSS.escape(voce.chiave)}"]`);
      if (!nodo) continue;
      nodo.dataset.acceso = String(voce.acceso === true);
      nodo.dataset.avvisa = String(voce.avvisa === true && voce.acceso === true);
      const parola = parolaInterruttore(voce);
      if (clean(nodo.textContent) !== `${voce.glifo}${parola}`)
        nodo.innerHTML = `<span aria-hidden="true">${esc(voce.glifo)}</span>${esc(parola)}`;
    }
    const recupero = card.querySelector("[data-dm-vmc-recupero] b");
    if (recupero) {
      const testo = lettura.bypassAperto
        ? t("Escluso", "Bypassed")
        : lettura.recupero === null
          ? "--"
          : `${lettura.recupero}%`;
      if (recupero.textContent !== testo) recupero.textContent = testo;
    }
  }
}

/** Il foglio di stile della fascia: lo installa il padrone della pagina. */
export const STILE_VMC = `
.dm-vmc{display:grid;gap:10px;margin-top:6px}
.dm-vmc-titolo-fascia{margin:0;font-size:11px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
.dm-vmc-griglia{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))}
.dm-vmc-card{display:grid;gap:10px;padding:14px;border:1px solid var(--divider-color,#dbe4ee);border-radius:20px;background:var(--card-bg,#fff);box-shadow:0 18px 34px -28px rgba(15,23,42,.55)}
.dm-vmc-card[data-avvisa="true"]{border-color:color-mix(in srgb,#f59e0b 55%,transparent)}
.dm-vmc-head{display:flex;align-items:center;gap:10px;min-width:0}
.dm-vmc-ic{flex:0 0 38px;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;font-size:19px;background:var(--secondary-background-color,#eef3f8)}
.dm-vmc-titolo{display:grid;min-width:0;flex:1 1 auto}
.dm-vmc-titolo strong{font-size:14px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dm-vmc-titolo small{font-size:11px;font-weight:750;color:var(--secondary-text-color,#64748b)}
.dm-vmc-recupero{display:grid;justify-items:end;gap:1px;flex:0 0 auto}
.dm-vmc-recupero small{font-size:9.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
.dm-vmc-recupero b{font-size:19px;font-weight:900;font-variant-numeric:tabular-nums}
.dm-vmc-recupero[data-stato="buono"] b{color:#16a34a}
.dm-vmc-recupero[data-stato="scarso"] b{color:#f59e0b}
.dm-vmc-recupero[data-stato="bypass"] b{font-size:14px;color:#0ea5e9}
.dm-vmc-flussi{display:grid;gap:8px}
.dm-vmc-flusso{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;padding:9px 11px;border-radius:14px;background:color-mix(in srgb,var(--secondary-background-color,#eef3f8) 55%,transparent)}
.dm-vmc-flusso[data-dm-vmc-verso="entra"]{background:color-mix(in srgb,#0ea5e9 10%,transparent)}
.dm-vmc-flusso[data-dm-vmc-verso="esce"]{background:color-mix(in srgb,#f97316 10%,transparent)}
.dm-vmc-capo{display:grid;gap:1px;min-width:0}
.dm-vmc-flusso .dm-vmc-capo:last-of-type{justify-items:end;text-align:right}
.dm-vmc-capo small{font-size:9.5px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
.dm-vmc-capo b{font-size:18px;font-weight:900;font-variant-numeric:tabular-nums}
.dm-vmc-capo em{font-size:10.5px;font-style:normal;font-weight:750;color:var(--secondary-text-color,#64748b);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dm-vmc-freccia{font-size:17px;font-weight:900;color:var(--secondary-text-color,#94a3b8)}
.dm-vmc-pastiglie{display:flex;flex-wrap:wrap;gap:6px}
.dm-vmc-pastiglia{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border:1px solid var(--divider-color,#dbe4ee);border-radius:999px;font-size:11px;font-weight:800;color:var(--secondary-text-color,#64748b)}
.dm-vmc-pastiglia[data-acceso="true"]{border-color:transparent;background:color-mix(in srgb,#0ea5e9 14%,transparent);color:#0369a1}
.dm-vmc-pastiglia[data-avvisa="true"]{background:color-mix(in srgb,#f59e0b 16%,transparent);color:#b45309}
.dm-vmc-numeri{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:7px}
.dm-vmc-numero{display:grid;gap:1px}
.dm-vmc-numero small{font-size:9.5px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
.dm-vmc-numero b{font-size:13px;font-weight:900;font-variant-numeric:tabular-nums}
`;
