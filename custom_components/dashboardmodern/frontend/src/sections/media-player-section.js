/* La pagina dei lettori multimediali (#269).
 *
 * «Sarebbe carino una sezione dedicata ai dispositivi Media Player… sarebbe
 * figo se lo sfondo fosse l'anteprima di ciò che viene riprodotto (la
 * copertina del disco).»
 *
 * Un lettore è l'unica cosa della casa che ha una faccia sua, e la faccia la
 * manda Home Assistant: la copertina del disco. Qui è lei a fare la card —
 * grande e sfocata dietro, netta e quadrata davanti — e il resto ci sta sopra.
 * Le altre pagine disegnano quello che raccontano; questa lo mostra e basta.
 *
 * I tasti che compaiono sono quelli che il lettore sa eseguire davvero: Home
 * Assistant lo dice in `supported_features`, e disegnare «brano precedente»
 * su una radio vorrebbe dire un tasto che non fa niente — che da fuori è un
 * tasto rotto.
 *
 * La voce nella barra compare solo quando un lettore è configurato: portare a
 * una pagina vuota è peggio che non offrirla.
 */
import {
  CHIAVE_MEDIA,
  comandoDelLettore,
  letturaDelLettore,
  lettureDeiLettori,
  lettoriConfigurati,
  orologio,
  posizioneOra,
} from "../core/media-player.js";
import { comandoDelDispositivo } from "../core/comandi-accanto.js";
import { disegnoDelCatalogo } from "../core/catalogo-disegni.js";
import { oggettoWidget } from "../core/oggetti-widget.js";
import { registraPaginaARuntime, renderPageMastheads } from "./page-masthead-section.js";
import {
  activeLocale,
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  readJson,
  root,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_MEDIA_PLAYER__";
const STYLE_ID = "dm-media-player-style";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "", battito: 0, aperto: "" });

export const MEDIA_TAB = "media";
export const PAGINA_MEDIA = "page-media";

export { CHIAVE_MEDIA };

/* ── cosa c'è da guardare ─────────────────────────────────────────────── */

function configurazione() {
  return readJson(CHIAVE_MEDIA, []);
}

function funzioneAccesa() {
  const sezioni = readJson("cd_sections", {});
  return !(sezioni && typeof sezioni === "object" && sezioni[MEDIA_TAB] === false);
}

function letture() {
  return lettureDeiLettori(configurazione(), allStates(), root.resolveEntity || ((v) => v));
}

/* ── la pagina e la sua voce nella barra ──────────────────────────────── */

function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

function ensurePagina() {
  if (!doc) return null;
  let pagina = doc.getElementById(PAGINA_MEDIA);
  if (pagina) return pagina;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = PAGINA_MEDIA;
  pagina.innerHTML = `<div class="dm-mp-wrap"></div>`;
  sorella.after(pagina);
  return pagina;
}

function apri(voce) {
  for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
  for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
  voce.classList.add("active");
  ensurePagina()?.classList.add("active");
  try {
    renderPageMastheads();
  } catch (_error) {}
  root.scrollTo?.({ top: 0, behavior: "instant" });
  schedule();
}

function ensureVoce() {
  if (!doc) return null;
  let voce = doc.querySelector(`.tab[data-tab="${MEDIA_TAB}"]`);
  if (voce) return voce;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = MEDIA_TAB;
  voce.id = `tab-${MEDIA_TAB}`;
  voce.innerHTML = `<span class="icon">${oggettoWidget("media")}</span><span class="text">${esc(
    t("Musica", "Media"),
  )}</span>`;
  /* Dopo le Luci: la musica sta con le cose del salotto, non con gli impianti.
   * Se le Luci non ci sono, prima di Config invece che in fondo a caso. */
  const luci = barra.querySelector('.tab[data-tab="luci"]');
  const config = barra.querySelector('.tab[data-tab="config"]');
  if (luci) luci.after(voce);
  else if (config) config.before(voce);
  else barra.append(voce);
  voce.addEventListener("click", () => apri(voce));
  return voce;
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function sottotitolo(righe) {
  const suona = righe.filter((riga) => riga.suona).length;
  if (suona)
    return suona === 1
      ? t("1 in riproduzione", "1 playing")
      : `${suona} ${t("in riproduzione", "playing")}`;
  return t("Nessuno in riproduzione", "Nothing playing");
}

export function parolaDiStatoDelLettore(riga) {
  if (riga.muto) return t("Non risponde", "Not reporting");
  if (riga.suona) return t("In riproduzione", "Playing");
  if (riga.inPausa) return t("In pausa", "Paused");
  if (riga.spento) return t("Spento", "Off");
  return t("Fermo", "Idle");
}

/* Cosa sta suonando, in due righe: sopra il pezzo, sotto chi lo suona.
 *
 * Quando non c'è un titolo si dice la sorgente o l'applicazione — «Spotify»,
 * «Radio Deejay» — che è comunque un'informazione. Inventare «Sconosciuto»
 * non lo è. */
export function titoloDelLettore(riga) {
  return riga.titolo || riga.sorgente || riga.applicazione || parolaDiStatoDelLettore(riga);
}

export function sottoDelLettore(riga) {
  const pezzi = [riga.artista, riga.album].filter(Boolean);
  if (pezzi.length) return pezzi.join(" · ");
  if (riga.titolo && riga.applicazione) return riga.applicazione;
  /* Quando non c'e' niente in riproduzione il titolo e' gia' la parola di
   * stato: ripeterla qui sotto vorrebbe dire «Spento / Spento», che sembra un
   * errore di stampa. Meglio l'entita', che almeno dice quale cassa e'. */
  return riga.entity;
}

function tastoMarkup(riga, comando, etichetta, glifo, acceso = false) {
  return `<button type="button" class="dm-mp-tasto" data-dm-mp="${esc(comando)}"
    data-dm-mp-entity="${esc(riga.entity)}" data-acceso="${acceso}"
    aria-label="${esc(etichetta)}">${glifo}</button>`;
}

/* I glifi dei comandi: triangoli e barrette, disegnati qui e non presi da una
 * famiglia di simboli. Sono le forme che qualunque lettore ha da cinquant'anni
 * e non c'è niente da inventare — ma vanno disegnate, o su ogni telefono il
 * «play» sarebbe un triangolo diverso. */
const GLIFI = Object.freeze({
  precedente: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M18.5 6.4v11.2a.8.8 0 0 1-1.24.67l-8.4-5.6a.8.8 0 0 1 0-1.34l8.4-5.6a.8.8 0 0 1 1.24.67Z" fill="currentColor"/></svg>`,
  successivo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5.5v13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M5.5 6.4v11.2a.8.8 0 0 0 1.24.67l8.4-5.6a.8.8 0 0 0 0-1.34l-8.4-5.6a.8.8 0 0 0-1.24.67Z" fill="currentColor"/></svg>`,
  suona: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 4.9v14.2a.9.9 0 0 0 1.38.76l11-7.1a.9.9 0 0 0 0-1.52l-11-7.1a.9.9 0 0 0-1.38.76Z" fill="currentColor"/></svg>`,
  pausa: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.6" y="4.8" width="4.2" height="14.4" rx="1.6" fill="currentColor"/><rect x="13.2" y="4.8" width="4.2" height="14.4" rx="1.6" fill="currentColor"/></svg>`,
  spegni: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6v7.6" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/><path d="M6.9 6.7a7.2 7.2 0 1 0 10.2 0" stroke="currentColor" stroke-width="2.1" fill="none" stroke-linecap="round"/></svg>`,
  muto: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.4h3.4L12 5.2v13.6L7.4 14.6H4Z" fill="currentColor"/><path d="m16 9.6 4.4 4.8M20.4 9.6 16 14.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  voce: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.4h3.4L12 5.2v13.6L7.4 14.6H4Z" fill="currentColor"/><path d="M15.6 9.2a4 4 0 0 1 0 5.6M18.3 6.8a7.6 7.6 0 0 1 0 10.4" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round"/></svg>`,
});

/* I comandi di un lettore, in una riga.
 *
 * Li disegna questo modulo e li ascolta questo modulo — il gestore sta sul
 * documento, non sulla pagina — cosi' gli stessi tasti funzionano anche dentro
 * la finestra della tessera in Home, che e' l'altro posto da cui si comanda la
 * musica. Un secondo disegno con un secondo gestore vorrebbe dire due modi di
 * mettere in pausa, e prima o poi due modi diversi. */
export function comandiMediaMarkup(riga) {
  const centro = riga.suona ? GLIFI.pausa : GLIFI.suona;
  return `<div class="dm-mp-comandi">
    ${riga.puo.precedente ? tastoMarkup(riga, "precedente", t("Brano precedente", "Previous track"), GLIFI.precedente) : ""}
    ${tastoMarkup(riga, "centro", riga.suona ? t("Pausa", "Pause") : t("Riproduci", "Play"), centro)}
    ${riga.puo.successivo ? tastoMarkup(riga, "successivo", t("Brano successivo", "Next track"), GLIFI.successivo) : ""}
    ${riga.puo.spegni && !riga.spento ? tastoMarkup(riga, "spegni", t("Spegni", "Turn off"), GLIFI.spegni) : ""}
  </div>`;
}

function copertinaMarkup(riga) {
  if (riga.copertina)
    return `<img class="dm-mp-arte" alt="" aria-hidden="true" loading="lazy">
      <img class="dm-mp-fondo" alt="" aria-hidden="true" loading="lazy">`;
  return `<span class="dm-mp-arte dm-mp-arte-vuota" aria-hidden="true">${
    riga.icona ? esc(riga.icona) : oggettoWidget("media")
  }</span>`;
}

function barraMarkup(riga) {
  const punto = posizioneOra(riga);
  if (!punto) return "";
  return `<div class="dm-mp-tempo">
    <span class="dm-mp-ora" data-dm-mp-ora>${esc(orologio(punto.secondi))}</span>
    <span class="dm-mp-barra"><i data-dm-mp-avanza style="transform:scaleX(${punto.quota.toFixed(
      4,
    )})"></i></span>
    <span class="dm-mp-ora">${esc(orologio(punto.durata))}</span>
  </div>`;
}

function volumeMarkup(riga) {
  if (!riga.puo.volume && !riga.puo.muto) return "";
  const percento = Math.round((riga.volume ?? 0) * 100);
  return `<div class="dm-mp-volume">
    ${
      riga.puo.muto
        ? tastoMarkup(
            riga,
            "muto",
            riga.mutato ? t("Riattiva l'audio", "Unmute") : t("Silenzia", "Mute"),
            riga.mutato ? GLIFI.muto : GLIFI.voce,
            riga.mutato,
          )
        : ""
    }
    ${
      riga.puo.volume
        ? `<input type="range" class="dm-mp-slider" min="0" max="100" step="1"
             value="${percento}" data-dm-mp-volume="${esc(riga.entity)}"
             aria-label="${esc(t("Volume", "Volume"))}">
           <span class="dm-mp-percento" data-dm-mp-percento>${percento}%</span>`
        : ""
    }
  </div>`;
}

function sorgenteMarkup(riga) {
  if (!riga.puo.sorgente || riga.sorgenti.length < 2) return "";
  return `<label class="dm-mp-sorgente"><span>${esc(t("Sorgente", "Source"))}</span>
    <select data-dm-mp-sorgente="${esc(riga.entity)}">${riga.sorgenti
      .map(
        (nome) =>
          `<option value="${esc(nome)}"${nome === riga.sorgente ? " selected" : ""}>${esc(
            nome,
          )}</option>`,
      )
      .join("")}</select></label>`;
}

/* Quello che l'integrazione pubblica accanto al lettore (#451).
 *
 * «Le TV dove vanno messe?» Nella scheda dei lettori — ma una TV di
 * SmartThings porta con sé un interruttore per l'alimentazione, una tendina
 * per la sorgente, e dei sensori che dicono il canale, il volume, il consumo.
 * I comandi si toccano, le letture si guardano: due file, come sul robot. */
function comandiAccantoMarkup(riga) {
  const voci = Array.isArray(riga.comandi) ? riga.comandi : [];
  if (!voci.length) return "";
  const tendine = voci
    .filter((voce) => voce.genere === "tendina" && voce.opzioni.length)
    .map(
      (voce) =>
        `<label class="dm-mp-sorgente"><span>${esc(voce.name)}</span>
      <select data-dm-mp-tendina="${esc(voce.entity)}"${voce.available ? "" : " disabled"}>${voce.opzioni
        .map(
          (opzione) =>
            `<option value="${esc(opzione)}"${opzione === voce.scelta ? " selected" : ""}>${esc(opzione)}</option>`,
        )
        .join("")}</select></label>`,
    )
    .join("");
  const tasti = voci
    .filter((voce) => voce.genere !== "tendina")
    .map(
      (voce) =>
        `<button type="button" class="dm-mp-cmd" data-dm-mp-cmd="${esc(voce.entity)}"${
          voce.genere === "interruttore" ? ` aria-pressed="${voce.acceso === true}"` : ""
        }${voce.available ? "" : " disabled"}>${esc(voce.name)}</button>`,
    )
    .join("");
  return `${tendine}${tasti ? `<div class="dm-mp-cmds">${tasti}</div>` : ""}`;
}

function lettureAccantoMarkup(riga) {
  const voci = Array.isArray(riga.letture) ? riga.letture : [];
  if (!voci.length) return "";
  return `<div class="dm-mp-letture">${voci
    .map(
      (lettura) =>
        `<span class="dm-mp-lettura" data-dm-mp-lettura="${esc(lettura.entity)}" title="${esc(lettura.entity)}">
      ${lettura.disegno ? `<i aria-hidden="true">${disegnoDelCatalogo(lettura.disegno, 20)}</i>` : ""}
      <small>${esc(lettura.name)}</small><b>${esc(lettura.testo)}</b>
    </span>`,
    )
    .join("")}</div>`;
}

/* Cosa deve cambiare perche' una card si rifaccia.
 *
 * Sta in una funzione sola perche' le card disegnate sono due: quelle della
 * pagina Musica e quella dentro la finestra di un lettore solo (#460). Due
 * elenchi di cose da guardare diventerebbero due elenchi diversi al primo
 * campo aggiunto, e una delle due card resterebbe indietro. */
function firmaDelLettore(riga) {
  return [
    riga.entity,
    riga.nome,
    riga.stato,
    riga.titolo,
    riga.artista,
    riga.album,
    riga.sorgente,
    riga.sorgenti.join("~"),
    riga.mutato,
    Math.round((riga.volume ?? 0) * 100),
    Math.round(riga.durata ?? 0),
    Boolean(riga.copertina),
    Object.values(riga.puo).join(""),
    /* Quello che sta accanto (#451): i comandi con la loro scelta, le letture
     * col loro numero. La card e' piccola e si rifa' intera, come gia' fa
     * quando cambia il brano. */
    (riga.comandi || [])
      .map(
        (voce) =>
          `${voce.entity}:${voce.name}:${voce.available}:${voce.acceso}:${voce.scelta}:${voce.opzioni.join("/")}`,
      )
      .join("+"),
    (riga.letture || []).map((lettura) => `${lettura.entity}:${lettura.testo}`).join("+"),
  ].join("|");
}

function cardMarkup(riga) {
  /* «Ha una copertina» sta scritto sulla card e non si deduce con `:has()`:
   * quella regola sui WebView di qualche telefono non c'e', e la card sarebbe
   * rimasta col testo scuro sopra il fondale scuro. */
  return `<article class="dm-mp-card" data-dm-mp-card="${esc(riga.entity)}"
    data-arte="${Boolean(riga.copertina)}"
    data-suona="${riga.suona}" data-muta="${riga.muto}" data-spento="${riga.spento}">
    <div class="dm-mp-arte-box">${copertinaMarkup(riga)}</div>
    <div class="dm-mp-testo">
      <span class="dm-mp-dove">${esc(riga.nome)}${
        riga.stato ? ` · ${esc(parolaDiStatoDelLettore(riga))}` : ""
      }</span>
      <strong class="dm-mp-titolo">${esc(titoloDelLettore(riga))}</strong>
      <span class="dm-mp-sotto">${esc(sottoDelLettore(riga))}</span>
      ${barraMarkup(riga)}
      ${comandiMediaMarkup(riga)}
      ${volumeMarkup(riga)}
      ${sorgenteMarkup(riga)}
      ${comandiAccantoMarkup(riga)}
      ${lettureAccantoMarkup(riga)}
    </div>
  </article>`;
}

/* La copertina si posa dopo, e solo quando cambia.
 *
 * L'indirizzo che manda Home Assistant è firmato e cambia a ogni brano: se lo
 * si riscrivesse a ogni giro di stati, il browser rifarebbe la richiesta e la
 * card lampeggerebbe fra un'immagine e la successiva uguale. */
function posaLeCopertine(nodo, righe) {
  for (const riga of righe) {
    const card = nodo.querySelector(`[data-dm-mp-card="${CSS.escape(riga.entity)}"]`);
    if (!card) continue;
    for (const arte of card.querySelectorAll("img.dm-mp-arte,img.dm-mp-fondo")) {
      if (!riga.copertina) continue;
      if (arte.dataset.dmMpSrc === riga.copertina) continue;
      arte.dataset.dmMpSrc = riga.copertina;
      arte.src = riga.copertina;
    }
  }
}

/* Il tempo che passa non lo manda nessuno.
 *
 * Home Assistant dice a che secondo era il brano quando l'ha misurato, e poi
 * tace finché non cambia qualcos'altro: senza un battito la barra resta ferma
 * su un pezzo che invece va avanti. Il battito c'è solo mentre questa pagina è
 * davanti e qualcosa sta suonando, e muore appena una delle due cose smette. */
function ferma() {
  if (state.battito) {
    root.clearInterval?.(state.battito);
    state.battito = 0;
  }
}

function batti(righe) {
  const aperta = state.aperto ? letturaDiUnLettore(state.aperto) : null;
  const serve =
    (paginaAperta() && righe.some((riga) => riga.suona && posizioneOra(riga))) ||
    Boolean(aperta?.suona && posizioneOra(aperta));
  if (!serve) {
    ferma();
    return;
  }
  if (state.battito) return;
  state.battito = root.setInterval?.(() => {
    if (!paginaAperta() && !state.aperto) {
      ferma();
      return;
    }
    avanzaIlTempo();
  }, 1000);
}

function avanzaIlTempo() {
  /* Le card disegnate sono in due posti: la pagina Musica e la finestra di un
   * lettore solo. La barra del tempo avanza in tutti e due, o nella finestra
   * resterebbe ferma su un brano che invece va avanti. */
  const dove = [
    doc?.querySelector?.(`#${PAGINA_MEDIA} .dm-mp-wrap`),
    doc?.getElementById?.(POPUP_ID),
  ].filter(Boolean);
  if (!dove.length) return;
  for (const riga of letture()) avanzaLaBarra(dove, riga);
  if (state.aperto) {
    const aperta = letturaDiUnLettore(state.aperto);
    if (aperta) avanzaLaBarra(dove, aperta);
  }
}

function avanzaLaBarra(dove, riga) {
  const punto = posizioneOra(riga);
  if (!punto) return;
  for (const nodo of dove) {
    const card = nodo.querySelector(`[data-dm-mp-card="${CSS.escape(riga.entity)}"]`);
    if (!card) continue;
    const ora = card.querySelector("[data-dm-mp-ora]");
    const avanza = card.querySelector("[data-dm-mp-avanza]");
    const scritto = orologio(punto.secondi);
    if (ora && ora.textContent !== scritto) ora.textContent = scritto;
    if (avanza) avanza.style.transform = `scaleX(${punto.quota.toFixed(4)})`;
  }
}

function paginaAperta() {
  return Boolean(doc?.getElementById?.(PAGINA_MEDIA)?.classList?.contains("active"));
}

export function renderMediaPlayer() {
  if (!doc) return false;
  const configurati = lettoriConfigurati(configurazione());
  const accesa = funzioneAccesa();
  const voce =
    configurati.length && accesa
      ? ensureVoce()
      : doc.querySelector(`.tab[data-tab="${MEDIA_TAB}"]`);
  if (voce) voce.style.display = configurati.length && accesa ? "" : "none";
  const pagina = configurati.length ? ensurePagina() : doc.getElementById(PAGINA_MEDIA);
  if (!pagina) return false;
  const righe = letture();
  registraPaginaARuntime(PAGINA_MEDIA, {
    /* Il viola e il rosa della musica: le uniche due tinte che nella plancia
     * non sono ancora di nessuno, ed è giusto così — questa pagina non parla
     * di corrente né di acqua. */
    tint: ["139,92,246", "236,72,153"],
    it: ["Musica", sottotitolo(righe)],
    en: ["Media", sottotitolo(righe)],
  });
  const nodo = pagina.querySelector(".dm-mp-wrap");
  if (!nodo) return false;
  const firma = [activeLocale(), ...righe.map(firmaDelLettore)].join("§");
  if (state.firma !== firma || !nodo.querySelector(".dm-mp-card")) {
    state.firma = firma;
    nodo.innerHTML = righe.length
      ? righe.map(cardMarkup).join("")
      : `<div class="dm-mp-vuoto">${esc(
          t("Nessun lettore configurato.", "No media player configured."),
        )}</div>`;
  }
  posaLeCopertine(nodo, righe);
  avanzaIlTempo();
  batti(righe);
  return true;
}

/* ── la finestra di un lettore solo (#460) ───────────────────────
 *
 * «Il lettore che ho messo fra le Azioni rapide mostra solo la copertina di
 * sfondo, il simbolo della cassa in mezzo e il nome dell'apparecchio. Dovrebbe
 * dire il brano, l'artista, e avere i tre puntini in alto a destra che aprono
 * una finestra con tutti i comandi.»
 *
 * I tre puntini aprono questa. E dentro non c'è un secondo lettore disegnato da
 * capo: c'è la STESSA card della pagina Musica, con i suoi comandi, il suo
 * volume, la sua sorgente e quello che l'integrazione pubblica accanto. Il
 * disegno è uno solo e chi lo ascolta è il gestore che sta sul documento,
 * quindi i tasti funzionano qui come funzionano di là — che è la ragione per
 * cui quel gestore sta sul documento e non sulla pagina.
 */
const POPUP_ID = "dm-mp-popup";

/**
 * La lettura di un lettore solo.
 *
 * Se quel lettore è fra quelli configurati si usa la sua voce — così la card
 * porta anche i comandi e le letture che gli sono stati messi accanto (#451);
 * se non lo è, si legge lo stesso, con quello che Home Assistant dice di lui.
 */
export function letturaDiUnLettore(entity, states = allStates()) {
  const cercato = clean(entity);
  if (!cercato) return null;
  const risolvi = root.resolveEntity || ((valore) => valore);
  const scritta = (valore) => {
    try {
      return clean(risolvi(valore) || valore);
    } catch (_errore) {
      return clean(valore);
    }
  };
  const voce = lettoriConfigurati(configurazione()).find(
    (riga) => scritta(riga.entity) === cercato,
  );
  return letturaDelLettore(voce || { entity: cercato }, states, risolvi);
}

function popupDelLettore() {
  if (!doc?.body) return null;
  const gia = doc.getElementById(POPUP_ID);
  if (gia) return gia;
  const host = doc.createElement("div");
  host.id = POPUP_ID;
  host.hidden = true;
  /* Fuori dalla card si chiude, come in tutte le altre finestre della
   * plancia: il tocco sul fondo è il gesto che tutti provano per primo. */
  host.addEventListener("click", (evento) => {
    if (evento.target === host || evento.target?.closest?.("[data-dm-mp-chiudi]"))
      chiudiIlLettore();
  });
  doc.body.append(host);
  return host;
}

/** Apre la finestra di un lettore. Torna `false` se non c'è niente da aprire. */
export function apriIlLettore(entity) {
  const riga = letturaDiUnLettore(entity);
  if (!riga) return false;
  state.aperto = riga.entity;
  return disegnaIlLettoreAperto();
}

/** Richiude la finestra. Torna `false` se non era aperta. */
export function chiudiIlLettore() {
  if (!state.aperto) return false;
  state.aperto = "";
  const host = doc?.getElementById?.(POPUP_ID);
  if (host) {
    host.hidden = true;
    host.innerHTML = "";
    delete host.dataset.dmMpFirma;
  }
  /* E chiudendo si rifa' il conto: se la pagina Musica non e' davanti, il
   * battito non ha piu' niente da far avanzare e si ferma subito invece di
   * arrivare al giro dopo. */
  batti(letture());
  return true;
}

/* Si ridisegna solo quando cambia qualcosa: la finestra resta aperta mentre il
 * brano va avanti, e riscriverla a ogni giro di stati vorrebbe dire strapparla
 * di sotto al dito di chi sta muovendo il volume. */
function disegnaIlLettoreAperto() {
  if (!state.aperto) return false;
  const riga = letturaDiUnLettore(state.aperto);
  const host = popupDelLettore();
  if (!host || !riga) return chiudiIlLettore();
  const firma = `${activeLocale()}§${firmaDelLettore(riga)}`;
  if (host.dataset.dmMpFirma !== firma || !host.querySelector(".dm-mp-card")) {
    host.dataset.dmMpFirma = firma;
    host.innerHTML = `<div class="dm-mp-popup-box" role="dialog" aria-modal="true">
      <button type="button" class="dm-mp-popup-chiudi" data-dm-mp-chiudi
        aria-label="${esc(t("Chiudi", "Close"))}">✕</button>
      ${cardMarkup(riga)}
    </div>`;
  }
  if (host.hidden) host.hidden = false;
  posaLeCopertine(host, [riga]);
  /* Il tempo che passa non lo manda nessuno — sta scritto sopra `batti`, e
   * vale qui quanto nella pagina Musica. A rimettere in moto il battito fin
   * qui era il solo disegno di quella pagina: chi apre la finestra dai tre
   * puntini di un'azione rapida quella pagina non la sta guardando, e i
   * secondi e la barra restavano fermi su un brano che invece andava avanti,
   * finche' non passava di li' un evento di stato per tutt'altra ragione. */
  batti(letture());
  return true;
}

/* ── i comandi ────────────────────────────────────────────────────────── */

async function chiamaHa(dominio, servizio, payload) {
  try {
    if (typeof root.dmCallHaService === "function")
      return await root.dmCallHaService(dominio, servizio, payload);
    if (typeof root.callService === "function")
      return await root.callService(dominio, servizio, payload);
    return await (root.hass || root._hass)?.callService?.(dominio, servizio, payload);
  } catch (errore) {
    root.console?.warn?.("[DashboardModern] media player", errore);
    return undefined;
  }
}

/* Il lettore che sta sotto un tasto.
 *
 * Fra quelli configurati se c'e'; altrimenti si legge lo stesso. Dalla
 * finestra di un lettore solo (#460) si comanda anche una cassa messa fra le
 * Azioni rapide che nella scheda Musica non c'e', e li' dentro «non lo
 * conosco» finiva per voler dire «e' spento»: il tasto centrale chiamava
 * `turn_on` su una cassa che stava suonando, e il muto invertiva il nulla. */
function letturaDi(entity) {
  return letture().find((riga) => riga.entity === entity) || letturaDiUnLettore(entity);
}

/* Il comando accanto a cui appartiene quell'entità, come sta adesso. */
function comandoAccantoDi(entity) {
  for (const riga of letture())
    for (const voce of riga.comandi || []) if (voce.entity === entity) return voce;
  return null;
}

function onClick(event) {
  /* Un comando accanto (#451): si preme, si accende o si inverte, secondo cosa
   * è. Sta prima dei tasti del lettore perché è un tasto suo, non del brano. */
  const accanto = event.target?.closest?.("[data-dm-mp-cmd]");
  if (accanto) {
    event.preventDefault();
    const voce = comandoAccantoDi(clean(accanto.dataset.dmMpCmd));
    if (!voce) return;
    root.navigator?.vibrate?.(8);
    if (voce.genere === "interruttore")
      accanto.setAttribute("aria-pressed", String(voce.acceso !== true));
    const servizio = comandoDelDispositivo(voce);
    if (servizio) chiamaHa(servizio.domain, servizio.service, servizio.data);
    return;
  }
  const tasto = event.target?.closest?.("[data-dm-mp]");
  if (!tasto) return;
  event.preventDefault();
  const entity = clean(tasto.dataset.dmMpEntity);
  const comando = clean(tasto.dataset.dmMp);
  if (!entity.includes(".")) return;
  root.navigator?.vibrate?.(8);
  const riga = letturaDi(entity);
  const servizio = comandoDelLettore(comando, riga);
  if (!servizio) return;
  if (comando === "muto") {
    chiamaHa("media_player", "volume_mute", {
      entity_id: entity,
      is_volume_muted: !(riga?.mutato === true),
    });
    return;
  }
  chiamaHa("media_player", servizio, { entity_id: entity });
}

function onInput(event) {
  const cursore = event.target?.closest?.("[data-dm-mp-volume]");
  if (!cursore) return;
  const percento = Math.min(100, Math.max(0, Number(cursore.value) || 0));
  const scritta = cursore.parentElement?.querySelector("[data-dm-mp-percento]");
  if (scritta) scritta.textContent = `${percento}%`;
  chiamaHa("media_player", "volume_set", {
    entity_id: clean(cursore.dataset.dmMpVolume),
    volume_level: percento / 100,
  });
}

function onChange(event) {
  /* Una tendina accanto (#451): la scelta va alla sua entità, non al lettore. */
  const accanto = event.target?.closest?.("[data-dm-mp-tendina]");
  if (accanto) {
    const voce = comandoAccantoDi(clean(accanto.dataset.dmMpTendina));
    const servizio = voce && comandoDelDispositivo(voce, accanto.value);
    if (servizio) chiamaHa(servizio.domain, servizio.service, servizio.data);
    return;
  }
  const tendina = event.target?.closest?.("[data-dm-mp-sorgente]");
  if (!tendina) return;
  chiamaHa("media_player", "select_source", {
    entity_id: clean(tendina.dataset.dmMpSorgente),
    source: clean(tendina.value),
  });
}

/* ── impianto ─────────────────────────────────────────────────────────── */

function schedule() {
  if (state.frame) return;
  state.frame =
    root.requestAnimationFrame?.(() => {
      state.frame = 0;
      try {
        renderMediaPlayer();
        /* La finestra di un lettore solo si ridisegna qui e non dentro
         * `renderMediaPlayer`: quella esce presto quando non c'e' nessun
         * lettore configurato, e un lettore messo fra le Azioni rapide puo'
         * benissimo non esserlo. */
        disegnaIlLettoreAperto();
      } catch (errore) {
        root.console?.warn?.("[DashboardModern] media player", errore);
      }
    }) || 0;
}

export function ridisegnaMediaPlayer() {
  state.firma = "";
  schedule();
}

function installStyles() {
  installStyle(
    STYLE_ID,
    `
      #${PAGINA_MEDIA} .dm-mp-wrap{display:grid;gap:14px;padding:0 4px 26px}
      .dm-mp-vuoto{
        padding:26px 18px;border-radius:20px;text-align:center;
        color:var(--text-dim,#64748b);
        background:var(--card-background-color,#fff);border:1px solid var(--card-border,#e2e8f0)}
      /* La card è la copertina: davanti quadrata e netta, dietro grande e
         sfocata a fare da fondo. È la richiesta, e sotto ci sta tutto il
         resto — che quindi si scrive in bianco su scuro. */
      .dm-mp-card{
        position:relative;overflow:hidden;isolation:isolate;
        display:grid;grid-template-columns:auto minmax(0,1fr);gap:16px;align-items:center;
        padding:16px;border-radius:24px;
        background:var(--card-background-color,#fff);border:1px solid var(--card-border,#e2e8f0);
        box-shadow:0 18px 40px -30px rgba(2,6,23,.55)}
      .dm-mp-card[data-muta="true"]{opacity:.6}
      .dm-mp-arte-box{position:relative;width:104px;height:104px;flex:0 0 104px}
      .dm-mp-arte{
        position:relative;z-index:1;width:104px;height:104px;border-radius:18px;object-fit:cover;
        background:var(--bg-sculpted,#f0f4f8);
        box-shadow:0 14px 28px -14px rgba(2,6,23,.6)}
      .dm-mp-arte-vuota{display:grid;place-items:center;font-size:34px}
      .dm-mp-arte-vuota .dm-oggetto{width:56px;height:56px}
      /* Il fondo: la stessa immagine, larga quanto la card, sfocata e scura.
         Non si anima e non si muove — è un fondale, non un effetto. */
      .dm-mp-fondo{
        position:absolute;inset:-40%;z-index:0;width:180%;height:180%;
        object-fit:cover;filter:blur(26px) saturate(1.25);opacity:.5;
        pointer-events:none}
      .dm-mp-card[data-arte="true"]::after{
        content:"";position:absolute;inset:0;z-index:0;pointer-events:none;
        background:linear-gradient(105deg,rgba(2,6,23,.82),rgba(2,6,23,.52))}
      .dm-mp-card[data-arte="true"] .dm-mp-arte-box,
      .dm-mp-card[data-arte="true"] .dm-mp-testo{position:relative;z-index:2}
      .dm-mp-card[data-arte="true"] .dm-mp-titolo,
      .dm-mp-card[data-arte="true"] .dm-mp-ora,
      .dm-mp-card[data-arte="true"] .dm-mp-percento{color:#f8fafc}
      .dm-mp-card[data-arte="true"] .dm-mp-dove,
      .dm-mp-card[data-arte="true"] .dm-mp-sotto,
      .dm-mp-card[data-arte="true"] .dm-mp-sorgente>span{color:rgba(248,250,252,.78)}
      /* I tasti secondari si spengono sul fondale; quello centrale no — e' il
         tasto che si cerca, e sulla copertina deve restare il suo colore. */
      .dm-mp-card[data-arte="true"] .dm-mp-tasto:not([data-dm-mp="centro"]){
        color:#f8fafc;background:rgba(248,250,252,.14);border-color:rgba(248,250,252,.24)}
      .dm-mp-testo{display:grid;gap:5px;min-width:0}
      .dm-mp-dove{
        font-size:10.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;
        color:var(--text-dim,#64748b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dm-mp-titolo{
        font-family:'Oswald',sans-serif;font-size:19px;font-weight:700;line-height:1.15;
        color:var(--text,#0f172a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dm-mp-sotto{
        font-size:12px;font-weight:600;color:var(--text-dim,#64748b);
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dm-mp-tempo{display:flex;align-items:center;gap:9px;margin-top:4px}
      .dm-mp-ora{
        font-size:10.5px;font-weight:700;color:var(--text-dim,#64748b);
        font-variant-numeric:tabular-nums;flex:0 0 auto}
      .dm-mp-barra{
        flex:1 1 auto;height:4px;border-radius:999px;overflow:hidden;
        background:color-mix(in srgb,currentColor 18%,transparent)}
      .dm-mp-barra>i{
        display:block;height:100%;width:100%;transform-origin:left center;
        background:linear-gradient(90deg,#8b5cf6,#ec4899)}
      .dm-mp-comandi{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap}
      .dm-mp-tasto{
        display:grid;place-items:center;width:40px;height:40px;padding:0;
        border-radius:14px;cursor:pointer;color:var(--text,#0f172a);
        background:var(--bg-sculpted,#f0f4f8);border:1px solid var(--card-border,#e2e8f0)}
      .dm-mp-tasto svg{width:21px;height:21px}
      .dm-mp-tasto[data-dm-mp="centro"]{
        width:48px;height:48px;color:#fff;border-color:transparent;
        background:linear-gradient(135deg,#8b5cf6,#ec4899)}
      .dm-mp-tasto[data-dm-mp="centro"] svg{width:24px;height:24px}
      .dm-mp-tasto[data-acceso="true"]{color:#f97316}
      .dm-mp-volume{display:flex;align-items:center;gap:10px;margin-top:8px}
      .dm-mp-slider{flex:1 1 auto;min-width:0;accent-color:#8b5cf6}
      .dm-mp-percento{
        font-size:10.5px;font-weight:800;color:var(--text-dim,#64748b);
        font-variant-numeric:tabular-nums;flex:0 0 34px;text-align:right}
      .dm-mp-sorgente{display:flex;align-items:center;gap:9px;margin-top:8px}
      /* Quello che sta accanto (#451): i tasti dell'integrazione e le sue
         letture, sotto i comandi del brano. */
      .dm-mp-cmds{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
      .dm-mp-cmd{
        padding:6px 11px;border-radius:999px;cursor:pointer;font:inherit;font-size:11.5px;
        font-weight:800;border:1px solid var(--divider-color,#dbe4ee);
        background:var(--card-bg,#fff);color:var(--text,#0f172a)}
      .dm-mp-cmd[aria-pressed="true"]{
        border-color:#8b5cf6;background:color-mix(in srgb,#8b5cf6 16%,transparent);color:#6d28d9}
      .dm-mp-cmd[disabled]{opacity:.45;cursor:default}
      .dm-mp-letture{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
      .dm-mp-lettura{
        display:inline-flex;align-items:center;gap:7px;min-width:0;padding:5px 9px;
        border-radius:11px;border:1px solid var(--divider-color,#dbe4ee);
        background:var(--surface-2,#f8fafc)}
      .dm-mp-lettura>i{flex:0 0 auto;display:grid;place-items:center;line-height:0}
      .dm-mp-lettura>small{
        min-width:0;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
        color:var(--text-dim,#94a3b8)}
      .dm-mp-lettura>b{font-size:12px;font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap}
      .dm-mp-card[data-arte="true"] .dm-mp-cmd{
        border-color:rgba(255,255,255,.28);background:rgba(15,23,42,.34);color:#f8fafc}
      .dm-mp-card[data-arte="true"] .dm-mp-lettura{
        border-color:rgba(255,255,255,.22);background:rgba(15,23,42,.3)}
      .dm-mp-card[data-arte="true"] .dm-mp-lettura>small{color:rgba(248,250,252,.72)}
      .dm-mp-card[data-arte="true"] .dm-mp-lettura>b{color:#f8fafc}
      .dm-mp-sorgente>span{
        font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
        color:var(--text-dim,#64748b)}
      .dm-mp-sorgente select{
        flex:1 1 auto;min-width:0;padding:7px 10px;border-radius:11px;font-size:12px;font-weight:700;
        color:var(--text,#0f172a);
        background:var(--card-background-color,#fff);border:1px solid var(--card-border,#e2e8f0)}
      /* La finestra di un lettore solo (#460): il fondo sfocato e la card in
         mezzo, come le altre finestre della plancia. Dentro non c'e' niente di
         nuovo da vestire — e' la card della pagina Musica. */
      /* Chiusa vuol dire chiusa: un display:grid scritto su un identificativo
         batte la regola del browser che nasconde quello che porta l'attributo
         «hidden», e la finestra richiusa restava un velo a tutto schermo davanti
         alla plancia — invisibile e impenetrabile. Lo dice la prova che la
         richiude toccando fuori. */
      #dm-mp-popup[hidden]{display:none!important}
      #dm-mp-popup{
        position:fixed;inset:0;z-index:2600;display:grid;place-items:center;
        padding:18px;background:rgba(2,6,23,.62);
        backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}
      #dm-mp-popup .dm-mp-popup-box{
        position:relative;width:min(560px,100%);max-height:88vh;overflow:auto}
      #dm-mp-popup .dm-mp-card{width:100%}
      #dm-mp-popup .dm-mp-popup-chiudi{
        position:absolute;top:10px;right:10px;z-index:3;
        display:grid;place-items:center;width:34px;height:34px;padding:0;
        border-radius:50%;cursor:pointer;font:inherit;font-size:15px;font-weight:900;
        color:var(--text,#0f172a);background:var(--card-background-color,#fff);
        border:1px solid var(--card-border,#e2e8f0);
        box-shadow:0 8px 20px -12px rgba(2,6,23,.6)}
      #dm-mp-popup .dm-mp-card[data-arte="true"]+.dm-mp-popup-chiudi,
      #dm-mp-popup .dm-mp-popup-box:has(.dm-mp-card[data-arte="true"]) .dm-mp-popup-chiudi{
        color:#f8fafc;background:rgba(15,23,42,.62);border-color:rgba(248,250,252,.28)}
      @media(max-width:560px){
        .dm-mp-card{grid-template-columns:auto minmax(0,1fr);gap:12px;padding:13px}
        .dm-mp-arte-box,.dm-mp-arte{width:82px;height:82px;flex-basis:82px}
        .dm-mp-titolo{font-size:16.5px}
        .dm-mp-tasto{width:37px;height:37px}
        .dm-mp-tasto[data-dm-mp="centro"]{width:44px;height:44px}
      }
    `,
  );
}

export function installMediaPlayer() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  doc.addEventListener("input", onInput);
  doc.addEventListener("change", onChange);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  /* Chi cambia pagina spegne o riaccende il battito: la barra del tempo non
   * deve correre dietro a una pagina che nessuno sta guardando. */
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.(".tab[data-tab]")) root.queueMicrotask?.(schedule);
  });
  doc.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") chiudiIlLettore();
  });
  root.addEventListener?.("pagehide", ferma);
  schedule();
  return true;
}
