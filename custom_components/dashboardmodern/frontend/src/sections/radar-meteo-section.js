/* Il radar meteo accanto alle previsioni (#266).
 *
 * «Visualizzare il radar meteo riferito alla zona prescelta (tramite
 * longitudine e latitudine o comune) e nel relativo raggio di 30km… metterlo
 * assieme al meteo, affianco al meteo dei 7 giorni.»
 *
 * Il radar sta dove è stato chiesto: dentro la finestra delle previsioni,
 * sopra i sette giorni — si legge nell'ordine in cui passa il tempo, prima
 * dove piove adesso e poi cosa dicono i prossimi giorni.
 *
 * Il posto si sceglie, e in tre modi che coprono la domanda senza tirare
 * dentro nessuno:
 *
 *   · le coordinate scritte a mano, per chi le ha;
 *   · una zona di Home Assistant — hanno un nome e delle coordinate, e sono la
 *     risposta al «oppure il comune»: chi vuole vedere il paese dei suoceri ci
 *     crea una zona e la sceglie qui. Tradurre un nome di comune in un punto
 *     vorrebbe dire mandare a un servizio di terzi il nome del posto che
 *     interessa a chi guarda, per una cosa che Home Assistant sa gia' fare;
 *   · e se non si dice niente, casa — che e' il posto giusto per quasi tutti.
 *
 * Il raggio e' quello che si vuole vedere intorno, trenta chilometri di serie
 * come chiedeva la segnalazione. Da posto e raggio il motore in
 * `core/radar-mappa.js` ricava zoom e quadratini: e' aritmetica, e si prova
 * senza rete.
 *
 * Da dove arrivano i quadratini invece e' una scelta di chi installa, e ci
 * sono due strade.
 *
 * La prima non esce di casa: un'entita' `camera.*` o `image.*` del proprio
 * Home Assistant. Chi ha portato dentro il radar della Protezione Civile con
 * la sua integrazione ha gia' quell'entita', il fotogramma passa dal proprio
 * server col proprio token, e fuori non va niente.
 *
 * La seconda e' un servizio di tessere, con il suo indirizzo a modello —
 * `{z}/{x}/{y}`, la convenzione che usano tutti. Qui l'indirizzo lo mette chi
 * installa e non lo mettiamo noi, per un motivo che vale la pena scrivere:
 * cablare l'indirizzo di un servizio che non abbiamo potuto interrogare
 * nemmeno una volta vorrebbe dire spedire una promessa. Al posto della
 * promessa c'e' un pulsante che scarica un quadratino e dice se e' arrivato:
 * chi incolla un indirizzo sa in un secondo se funziona, invece di scoprirlo
 * la prima volta che piove.
 */
import {
  finestraDiTessere,
  luogoDelRadar,
  urlDellaTessera,
  zoneDisponibili,
} from "../core/radar-mappa.js";
import { loadCameraFrame } from "./live-ui-section.js";
import { allStates, clean, doc, esc, installStyle, readJson, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_RADAR_METEO__";
const state = (root[KEY] ||= { installed: false, timer: 0, provando: false });

export const CHIAVE_RADAR = "cd_radar_meteo";
const BLOCCO = "dm-radar-blocco";
const IMMAGINE = "dm-radar-img";

/* Ogni quanto si ripiglia il radar. I servizi nazionali si aggiornano ogni
 * cinque o dieci minuti: un minuto e' abbastanza fitto da non far aspettare
 * nessuno e abbastanza largo da non pesare. */
const OGNI = 60_000;

/* Il raggio di serie e' quello della segnalazione. */
export const RAGGIO_DI_SERIE = 30;

/* I domini che portano un'immagine. `entity_picture` ce l'hanno anche altri —
 * una persona, un media player — ma nessuno di quelli e' un radar. */
const CON_IMMAGINE = new Set(["camera", "image"]);

const configurazione = () => {
  const grezzo = readJson(CHIAVE_RADAR, {});
  return grezzo && typeof grezzo === "object" ? grezzo : {};
};

function salva(prossima) {
  try {
    root.localStorage?.setItem?.(CHIAVE_RADAR, JSON.stringify(prossima));
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  } catch (_errore) {}
}

/** Cosa e' stato scelto, ripulito. */
export function radarScelto(stored = configurazione()) {
  const grezzo = stored && typeof stored === "object" ? stored : {};
  const entity = clean(grezzo.entity);
  const modello = clean(grezzo.modello);
  const raggio = Number(grezzo.raggio);
  const scelto = {
    entity,
    modello,
    fondo: clean(grezzo.fondo),
    zona: clean(grezzo.zona),
    lat: clean(grezzo.lat),
    lon: clean(grezzo.lon),
    raggio: Number.isFinite(raggio) && raggio > 0 ? Math.min(500, raggio) : RAGGIO_DI_SERIE,
    nome: clean(grezzo.nome),
  };
  /* L'entita' vince quando c'e': non esce di casa, e chi l'ha compilata ha
   * gia' il radar dentro Home Assistant. */
  if (entity.includes(".") && CON_IMMAGINE.has(entity.split(".")[0]))
    return { ...scelto, modo: "entita" };
  if (/\{[zxy]\}/.test(modello)) return { ...scelto, modo: "mappa" };
  return null;
}

/** Se il radar a entita' sta rispondendo adesso. */
export function radarVivo(scelto, states = allStates()) {
  if (scelto?.modo !== "entita") return false;
  return Boolean(clean(states?.[scelto.entity]?.attributes?.entity_picture));
}

/* ── il blocco dentro la finestra del meteo ───────────────────────────── */

const finestra = () => doc?.getElementById?.("weather-modal") || null;

function finestraAperta() {
  const modale = finestra();
  if (!modale) return false;
  if (modale.classList.contains("show") || modale.classList.contains("active")) return true;
  return modale.offsetParent !== null;
}

function blocco() {
  const modale = finestra();
  if (!modale) return null;
  let nodo = modale.querySelector(`.${BLOCCO}`);
  if (nodo) return nodo;
  const elenco = modale.querySelector("#weather-forecast-list");
  if (!elenco) return null;
  nodo = doc.createElement("div");
  nodo.className = BLOCCO;
  nodo.innerHTML = `<div class="dm-radar-testa">
      <span aria-hidden="true">📡</span>
      <strong class="dm-radar-nome"></strong>
      <small class="dm-radar-nota"></small>
    </div>
    <div class="dm-radar-quadro">
      <div class="dm-radar-tessere"></div>
      <img class="${IMMAGINE}" alt="${esc(t("Radar meteo", "Weather radar"))}" decoding="async">
      <span class="dm-radar-mirino" aria-hidden="true"></span>
      <span class="dm-radar-muto">${esc(
        t("Il radar non sta rispondendo.", "The radar is not reporting."),
      )}</span>
    </div>`;
  /* Sopra le previsioni: il radar dice adesso, le previsioni dicono dopo. */
  elenco.before(nodo);
  return nodo;
}

/* ── il radar a entita' ───────────────────────────────────────────────── */

async function daEntita(scelto, nodo) {
  const immagine = nodo.querySelector(`.${IMMAGINE}`);
  if (!immagine) return;
  const preso = await loadCameraFrame({ entity: scelto.entity }, immagine);
  nodo.dataset.dmRadar = preso ? "vivo" : "muto";
}

/* ── il radar a tessere ───────────────────────────────────────────────── */

/* Il riquadro e' largo quanto la finestra e alto quanto basta a non mangiarsi
 * le previsioni: due terzi della larghezza, che su un telefono resta un
 * quadrato schiacciato e su un tablet una striscia. */
function misureDelQuadro(quadro) {
  const largo = Math.round(quadro.getBoundingClientRect().width) || 320;
  return { latoPx: largo, altoPx: Math.max(160, Math.round(largo * 0.62)) };
}

function daTessere(scelto, nodo) {
  const quadro = nodo.querySelector(".dm-radar-quadro");
  const dove = nodo.querySelector(".dm-radar-tessere");
  if (!quadro || !dove) return;
  const luogo = luogoDelRadar(scelto, allStates(), root.hass?.config || {});
  if (!luogo) {
    nodo.dataset.dmRadar = "muto";
    dove.replaceChildren();
    return;
  }
  const misure = misureDelQuadro(quadro);
  const finestraTessere = finestraDiTessere(luogo.lat, luogo.lon, {
    ...misure,
    raggioKm: scelto.raggio,
  });
  if (!finestraTessere) {
    nodo.dataset.dmRadar = "muto";
    return;
  }
  quadro.style.height = `${finestraTessere.alto}px`;

  /* Si ridisegna solo se il quadro e' cambiato davvero: rifare le immagini a
   * ogni giro le farebbe lampeggiare mentre si guarda. */
  const firma = `${luogo.lat},${luogo.lon},${finestraTessere.zoom},${misure.latoPx}x${misure.altoPx},${scelto.modello},${scelto.fondo}`;
  if (dove.dataset.dmFirma !== firma) {
    dove.dataset.dmFirma = firma;
    const pezzi = [];
    for (const strato of [scelto.fondo, scelto.modello]) {
      if (!strato) continue;
      for (const tessera of finestraTessere.tessere) {
        const url = urlDellaTessera(strato, tessera, finestraTessere.zoom);
        if (!url) continue;
        const immagine = doc.createElement("img");
        immagine.className = strato === scelto.fondo ? "dm-radar-t dm-radar-fondo" : "dm-radar-t";
        immagine.src = url;
        immagine.alt = "";
        immagine.decoding = "async";
        immagine.loading = "eager";
        immagine.style.cssText = `left:${tessera.sx}px;top:${tessera.sy}px;width:${tessera.lato}px;height:${tessera.lato}px`;
        /* Un quadratino che non arriva e' un buco, non un errore: il servizio
         * non copre tutto il mondo, e ai bordi manca per costruzione. */
        immagine.addEventListener("error", () => immagine.remove(), { once: true });
        pezzi.push(immagine);
      }
    }
    dove.replaceChildren(...pezzi);
    nodo.dataset.dmRadar = pezzi.length ? "vivo" : "muto";
  }

  const nota = nodo.querySelector(".dm-radar-nota");
  if (nota) {
    const posto = luogo.nome || `${luogo.lat.toFixed(3)}, ${luogo.lon.toFixed(3)}`;
    nota.textContent = `${posto} · ${scelto.raggio} km`;
  }
}

export function disegnaRadar() {
  const scelto = radarScelto();
  const nodo = blocco();
  if (!nodo) return false;
  if (!scelto) {
    nodo.hidden = true;
    return false;
  }
  nodo.hidden = false;
  nodo.dataset.dmModo = scelto.modo;
  const nome = nodo.querySelector(".dm-radar-nome");
  if (nome) nome.textContent = scelto.nome || t("Radar meteo", "Weather radar");
  if (scelto.modo === "entita") {
    const nota = nodo.querySelector(".dm-radar-nota");
    if (nota) nota.textContent = t("Dove piove adesso", "Where it is raining now");
    daEntita(scelto, nodo);
  } else daTessere(scelto, nodo);
  return true;
}

/* ── il giro, solo mentre si guarda ───────────────────────────────────── */

function ferma() {
  if (!state.timer) return;
  root.clearInterval?.(state.timer);
  state.timer = 0;
}

function avvia() {
  if (state.timer) return;
  state.timer =
    root.setInterval?.(() => {
      if (!finestraAperta()) {
        ferma();
        return;
      }
      disegnaRadar();
    }, OGNI) || 0;
}

function guarda() {
  if (!finestraAperta()) {
    ferma();
    return;
  }
  disegnaRadar();
  avvia();
}

/* ── la prova dell'indirizzo ──────────────────────────────────────────── */

/* Un quadratino solo, scaricato davvero, e la risposta a schermo.
 *
 * E' il pezzo che sostituisce la promessa: chi incolla l'indirizzo di un
 * servizio sa subito se arriva, invece di scoprire che non arriva la prima
 * volta che piove. Si usa un'immagine e non `fetch` apposta: le tessere si
 * caricano come immagini, e un servizio che non manda le intestazioni per le
 * chiamate incrociate passa lo stesso — provarlo con `fetch` direbbe «non
 * funziona» di una cosa che funziona. */
export function provaLIndirizzo(modello, luogo, raggio = RAGGIO_DI_SERIE) {
  return new Promise((risolvi) => {
    const finestraTessere = luogo && finestraDiTessere(luogo.lat, luogo.lon, { raggioKm: raggio });
    const tessera = finestraTessere?.tessere?.[0];
    const url = tessera ? urlDellaTessera(modello, tessera, finestraTessere.zoom) : "";
    if (!url) {
      risolvi({ ok: false, motivo: "senza-indirizzo" });
      return;
    }
    const prova = new root.Image();
    const fine = (esito) => {
      prova.onload = null;
      prova.onerror = null;
      risolvi(esito);
    };
    prova.onload = () => fine({ ok: prova.naturalWidth > 0, motivo: "", url });
    prova.onerror = () => fine({ ok: false, motivo: "non-arriva", url });
    root.setTimeout?.(() => fine({ ok: false, motivo: "troppo-lenta", url }), 8000);
    prova.src = url;
  });
}

/* ── la casella dove si sceglie ───────────────────────────────────────── */

function zoneMarkup(scelta) {
  const zone = zoneDisponibili(allStates());
  const voci = [
    `<option value=""${scelta ? "" : " selected"}>${esc(t("Casa", "Home"))}</option>`,
    ...zone.map(
      (zona) =>
        `<option value="${esc(zona.entity)}"${zona.entity === scelta ? " selected" : ""}>${esc(
          zona.nome,
        )}</option>`,
    ),
  ];
  return voci.join("");
}

function casellaMarkup(config) {
  return `<span class="ed-slot-lbl">${esc(t("Radar meteo", "Weather radar"))}</span>
    <span class="ed-form-row"><input id="dm-radar-entita" class="ed-input mono"
      data-dm-radar-campo="entity" value="${esc(clean(config.entity))}"
      placeholder="camera.radar" autocomplete="off" spellcheck="false"><button type="button"
      class="dm-entity-picker" data-dm-radar-pick="dm-radar-entita"
      aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>
    <small>${esc(
      t(
        "Un'entità camera o image del tuo Home Assistant: il fotogramma passa dal tuo server e da casa non esce niente. Chi ha portato dentro il radar con la sua integrazione ha già l'entità qui sotto.",
        "A camera or image entity of your own Home Assistant: the frame comes from your own server and nothing leaves the house. If you brought a radar in with its integration, the entity is already there.",
      ),
    )}</small>
    <div class="dm-radar-oppure">${esc(t("oppure, da un servizio di tessere", "or, from a tile service"))}</div>
    <span class="ed-form-row"><input id="dm-radar-modello" class="ed-input mono"
      data-dm-radar-campo="modello" value="${esc(clean(config.modello))}"
      placeholder="https://…/{z}/{x}/{y}.png" autocomplete="off" spellcheck="false"><button
      type="button" class="dm-radar-prova" data-dm-radar-prova>${esc(t("Prova", "Test"))}</button></span>
    <small class="dm-radar-esito" data-dm-radar-esito>${esc(
      t(
        "L'indirizzo è quello che pubblica il servizio che vuoi usare, con {z}/{x}/{y} al posto dei numeri del quadratino. Il tasto Prova ne scarica uno e ti dice se arriva.",
        "The address is the one your service publishes, with {z}/{x}/{y} standing in for the tile numbers. Test downloads one and tells you whether it arrives.",
      ),
    )}</small>
    <div class="dm-radar-dove">
      <label><span class="dm-radar-lbl">${esc(t("Dove", "Where"))}</span>
        <select class="ed-input" data-dm-radar-campo="zona">${zoneMarkup(clean(config.zona))}</select>
      </label>
      <label><span class="dm-radar-lbl">${esc(t("Raggio (km)", "Radius (km)"))}</span>
        <input class="ed-input" type="number" min="1" max="500" data-dm-radar-campo="raggio"
          value="${esc(String(config.raggio ?? RAGGIO_DI_SERIE))}"></label>
    </div>
    <div class="dm-radar-dove">
      <label><span class="dm-radar-lbl">${esc(t("Latitudine", "Latitude"))}</span>
        <input class="ed-input mono" data-dm-radar-campo="lat" value="${esc(clean(config.lat))}"
          placeholder="41.9028" autocomplete="off"></label>
      <label><span class="dm-radar-lbl">${esc(t("Longitudine", "Longitude"))}</span>
        <input class="ed-input mono" data-dm-radar-campo="lon" value="${esc(clean(config.lon))}"
          placeholder="12.4964" autocomplete="off"></label>
    </div>
    <small>${esc(
      t(
        "Le coordinate scritte a mano vincono su tutto; se le lasci vuote vale la zona qui sopra, e se non scegli niente vale casa. Per un posto che non è casa tua, creagli una zona in Home Assistant: comparirà nella tendina col suo nome.",
        "Coordinates typed by hand win over everything; leave them empty and the zone above is used, and with no choice at all it is home. For somewhere that is not your house, give it a zone in Home Assistant: it shows up in the list under its own name.",
      ),
    )}</small>`;
}

/* La casella sta accanto a quelle del meteo, dentro la stessa fisarmonica: e'
 * la stessa domanda — che tempo fa — e chiederla in due schede diverse
 * vorrebbe dire farla cercare. */
function montaLaCasella() {
  const slotMeteo = doc?.querySelector?.('input[data-ref="dm.home_meteo"]');
  const riquadro = slotMeteo?.closest?.(".ed-slot");
  if (!riquadro) return false;
  const fisarmonica = riquadro.closest("details.ed-acc");
  if (!fisarmonica || fisarmonica.querySelector("[data-dm-radar-campo]")) return false;
  const casella = doc.createElement("label");
  casella.className = "ed-slot dm-radar-ed";
  casella.innerHTML = casellaMarkup(radarScelto() || configurazione());
  riquadro.after(casella);
  return true;
}

function raccogli(dentro) {
  const prossima = { ...configurazione() };
  for (const campo of dentro.querySelectorAll("[data-dm-radar-campo]"))
    prossima[clean(campo.dataset.dmRadarCampo)] = clean(campo.value);
  return prossima;
}

function onCambio(event) {
  const campo = event.target?.closest?.("[data-dm-radar-campo]");
  if (!campo) return;
  const dentro = campo.closest(".dm-radar-ed");
  if (!dentro) return;
  salva(raccogli(dentro));
  disegnaRadar();
}

async function onClick(event) {
  const pick = event.target?.closest?.("[data-dm-radar-pick]");
  if (pick) {
    event.preventDefault();
    const input = doc?.getElementById?.(clean(pick.dataset.dmRadarPick));
    if (input) root.wzPickEntity?.(input);
    return;
  }

  const prova = event.target?.closest?.("[data-dm-radar-prova]");
  if (prova) {
    event.preventDefault();
    if (state.provando) return;
    const dentro = prova.closest(".dm-radar-ed");
    const esito = dentro?.querySelector("[data-dm-radar-esito]");
    if (!dentro || !esito) return;
    const config = raccogli(dentro);
    salva(config);
    state.provando = true;
    esito.dataset.dmEsito = "prova";
    esito.textContent = t("Provo…", "Testing…");
    const luogo = luogoDelRadar(radarScelto(config) || config, allStates(), root.hass?.config || {});
    const risposta = await provaLIndirizzo(clean(config.modello), luogo, Number(config.raggio));
    state.provando = false;
    esito.dataset.dmEsito = risposta.ok ? "bene" : "male";
    esito.textContent = risposta.ok
      ? t("Arriva: il quadratino c'è.", "It arrives: the tile is there.")
      : risposta.motivo === "senza-indirizzo"
        ? t(
            "Manca l'indirizzo, o non ha {z}/{x}/{y} dentro.",
            "The address is missing, or has no {z}/{x}/{y} in it.",
          )
        : risposta.motivo === "troppo-lenta"
          ? t("Nessuna risposta in otto secondi.", "No answer within eight seconds.")
          : t(
              "Non arriva. Controlla l'indirizzo, e che il servizio si lasci leggere da qui.",
              "It does not arrive. Check the address, and that the service lets this page read it.",
            );
    disegnaRadar();
    return;
  }

  /* Un tocco qualunque puo' essere quello che apre la finestra del meteo: si
   * riguarda dopo, che e' meno di un timer acceso tutto il giorno. */
  root.setTimeout?.(guarda, 120);
}

function installStyles() {
  installStyle(
    "dm-radar-meteo",
    `
      #weather-modal .dm-radar-blocco{display:grid;gap:8px;margin-bottom:14px}
      #weather-modal .dm-radar-testa{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
      #weather-modal .dm-radar-testa strong{
        font-size:13px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;
        color:var(--text,#0f172a)}
      #weather-modal .dm-radar-nota{font-size:11px;color:var(--text-dim,#64748b)}
      #weather-modal .dm-radar-quadro{
        position:relative;display:grid;place-items:center;min-height:170px;overflow:hidden;
        border-radius:16px;background:var(--bg-sculpted,#0b1220);
        border:1px solid var(--card-border,#1e293b)}
      #weather-modal .dm-radar-tessere{position:absolute;inset:0}
      #weather-modal .dm-radar-t{position:absolute;display:block;image-rendering:auto}
      /* Il fondo sotto, la pioggia sopra: due strati, un ordine solo. */
      #weather-modal .dm-radar-fondo{opacity:.85;filter:saturate(.7)}
      #weather-modal .dm-radar-img{width:100%;height:auto;display:block;position:relative}
      /* Il mirino al centro: senza, un radar e' una macchia e non si sa dove
         si sta guardando. */
      #weather-modal .dm-radar-blocco[data-dm-modo="mappa"] .dm-radar-mirino{
        position:absolute;left:50%;top:50%;width:13px;height:13px;margin:-7px 0 0 -7px;
        border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 2px rgba(15,23,42,.55);
        pointer-events:none}
      #weather-modal .dm-radar-blocco[data-dm-modo="entita"] .dm-radar-mirino{display:none}
      #weather-modal .dm-radar-blocco[data-dm-modo="mappa"] .dm-radar-img{display:none}
      #weather-modal .dm-radar-blocco[data-dm-radar="muto"] .dm-radar-img{display:none}
      #weather-modal .dm-radar-muto{
        font-size:12px;font-weight:700;color:var(--text-dim,#64748b);position:relative}
      #weather-modal .dm-radar-blocco[data-dm-radar="vivo"] .dm-radar-muto{display:none}
      #ed-body .dm-radar-ed small{
        display:block;margin:3px 2px 6px;font-size:11px;line-height:1.45;
        color:var(--text-dim,#64748b)}
      #ed-body .dm-radar-oppure{
        margin:10px 2px 4px;font-size:10.5px;font-weight:800;letter-spacing:.05em;
        text-transform:uppercase;color:var(--text-dim,#64748b)}
      #ed-body .dm-radar-prova{
        flex:0 0 auto;padding:0 14px;height:38px;border:1px solid var(--card-border,#e2e8f0);
        border-radius:10px;background:var(--card-background-color,#fff);cursor:pointer;
        font:inherit;font-size:12px;font-weight:800;color:var(--primary-color,#0ea5e9)}
      #ed-body .dm-radar-esito[data-dm-esito="bene"]{color:#059669;font-weight:700}
      #ed-body .dm-radar-esito[data-dm-esito="male"]{color:#dc2626;font-weight:700}
      #ed-body .dm-radar-dove{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:4px 0}
      #ed-body .dm-radar-dove label{display:block;min-width:0}
      /* Le etichette qui dentro non sono caselle da rinominare: il foglio del
         guscio appende una matita a ogni ed-slot-lbl, e la matita direbbe
         «questo si puo' ribattezzare» di un campo che si compila e basta. */
      #ed-body .dm-radar-lbl{
        display:block;margin:0 2px 4px;font-size:11px;font-weight:800;letter-spacing:.04em;
        text-transform:uppercase;color:var(--text-dim,#64748b)}
      #ed-body .dm-radar-dove .ed-input{width:100%}
    `,
  );
}

export function installRadarMeteo() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("change", onCambio);
  doc.addEventListener("input", onCambio);
  doc.addEventListener("click", onClick);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:editor-rendered",
    "dashboardmodern:states-ready",
  ])
    root.addEventListener?.(evento, () => {
      montaLaCasella();
      guarda();
    });
  montaLaCasella();
  guarda();
  return true;
}
