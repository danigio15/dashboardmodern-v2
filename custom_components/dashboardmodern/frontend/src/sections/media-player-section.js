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
  lettureDeiLettori,
  lettoriConfigurati,
  orologio,
  posizioneOra,
} from "../core/media-player.js";
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
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "", battito: 0 });

export const MEDIA_TAB = "media";
export const PAGINA_MEDIA = "page-media";

export { CHIAVE_MEDIA };

/* ── cosa c'è da guardare ─────────────────────────────────────────────── */

function configurazione() {
  return readJson(CHIAVE_MEDIA, []);
}

/** Se almeno un lettore è stato dichiarato. */
export function mediaConfigurato() {
  return lettoriConfigurati(configurazione()).length > 0;
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

function parolaDiStato(riga) {
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
function titoloDi(riga) {
  return riga.titolo || riga.sorgente || riga.applicazione || parolaDiStato(riga);
}

function sottoDi(riga) {
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

function cardMarkup(riga) {
  const centro = riga.suona ? GLIFI.pausa : GLIFI.suona;
  /* «Ha una copertina» sta scritto sulla card e non si deduce con `:has()`:
   * quella regola sui WebView di qualche telefono non c'e', e la card sarebbe
   * rimasta col testo scuro sopra il fondale scuro. */
  return `<article class="dm-mp-card" data-dm-mp-card="${esc(riga.entity)}"
    data-arte="${Boolean(riga.copertina)}"
    data-suona="${riga.suona}" data-muta="${riga.muto}" data-spento="${riga.spento}">
    <div class="dm-mp-arte-box">${copertinaMarkup(riga)}</div>
    <div class="dm-mp-testo">
      <span class="dm-mp-dove">${esc(riga.nome)}${
        riga.stato ? ` · ${esc(parolaDiStato(riga))}` : ""
      }</span>
      <strong class="dm-mp-titolo">${esc(titoloDi(riga))}</strong>
      <span class="dm-mp-sotto">${esc(sottoDi(riga))}</span>
      ${barraMarkup(riga)}
      <div class="dm-mp-comandi">
        ${riga.puo.precedente ? tastoMarkup(riga, "precedente", t("Brano precedente", "Previous track"), GLIFI.precedente) : ""}
        ${tastoMarkup(riga, "centro", riga.suona ? t("Pausa", "Pause") : t("Riproduci", "Play"), centro)}
        ${riga.puo.successivo ? tastoMarkup(riga, "successivo", t("Brano successivo", "Next track"), GLIFI.successivo) : ""}
        ${riga.puo.spegni && !riga.spento ? tastoMarkup(riga, "spegni", t("Spegni", "Turn off"), GLIFI.spegni) : ""}
      </div>
      ${volumeMarkup(riga)}
      ${sorgenteMarkup(riga)}
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
  const serve = paginaAperta() && righe.some((riga) => riga.suona && posizioneOra(riga));
  if (!serve) {
    ferma();
    return;
  }
  if (state.battito) return;
  state.battito = root.setInterval?.(() => {
    if (!paginaAperta()) {
      ferma();
      return;
    }
    avanzaIlTempo();
  }, 1000);
}

function avanzaIlTempo() {
  const nodo = doc?.querySelector?.(`#${PAGINA_MEDIA} .dm-mp-wrap`);
  if (!nodo) return;
  for (const riga of letture()) {
    const card = nodo.querySelector(`[data-dm-mp-card="${CSS.escape(riga.entity)}"]`);
    const punto = posizioneOra(riga);
    if (!card || !punto) continue;
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
  const firma = [
    activeLocale(),
    ...righe.map((riga) =>
      [
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
      ].join("|"),
    ),
  ].join("§");
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

function letturaDi(entity) {
  return letture().find((riga) => riga.entity === entity) || null;
}

function onClick(event) {
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
      .dm-mp-sorgente>span{
        font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
        color:var(--text-dim,#64748b)}
      .dm-mp-sorgente select{
        flex:1 1 auto;min-width:0;padding:7px 10px;border-radius:11px;font-size:12px;font-weight:700;
        color:var(--text,#0f172a);
        background:var(--card-background-color,#fff);border:1px solid var(--card-border,#e2e8f0)}
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
  root.addEventListener?.("pagehide", ferma);
  schedule();
  return true;
}
