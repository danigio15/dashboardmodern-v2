/* DashboardModern custom panel and companion Lovelace dashboard registration. */
import { LEGACY_VARIANTS, legacyVariantForLocale, mountLegacyHost } from "./src/legacy/host.js";


/* ── il parcheggio della plancia ─────────────────────────────────────────── */

/* Home Assistant e' una pagina sola, e quando si va su una sua altra pagina il
 * pannello viene tolto dal documento: con lui moriva la cornice, cioe' la
 * plancia intera. Ogni ritorno era un avvio da capo — il runtime riletto, gli
 * stati richiesti di nuovo, il pacchetto dell'Energia, lo storico dei widget,
 * le miniature delle telecamere — ed e' esattamente il «si carica lentamente»
 * che si sente tornando sulla plancia.
 *
 * Quindi la cornice non si butta: si mette da parte. Nascosta, ma ancora
 * attaccata al documento di Home Assistant, perche' una cornice staccata il
 * suo documento lo perde e allora tanto varrebbe ricostruirla.
 *
 * Il parcheggio sta sul modulo e non sull'elemento perche' l'elemento Home
 * Assistant lo butta davvero: al ritorno ne costruisce uno nuovo, che qui
 * ritrova la plancia di prima e se la riprende. Ce n'e' una sola: un profilo
 * diverso — altra variante, altro entry, altra configurazione — e' un'altra
 * plancia, e quella di prima si smonta per davvero. */
const RICOVERO_ID = "dashboardmodern-ricovero";

/* Dopo mezz'ora nessuno sta tornando: la plancia parcheggiata continua a
 * ricevere gli stati della casa, e tenerla viva per una pagina che non si
 * riapre e' memoria e lavoro regalati. */
export const OBLIO_MS = 30 * 60 * 1000;

const parcheggio = { chiave: "", host: null, timer: 0 };
/* Il pannello che ha la plancia in scena adesso: e' quello che il cambio di
 * pagina deve mettere da parte, e ce n'e' al piu' uno. */
let attivo = null;

/* Il profilo della plancia: due chiavi uguali sono la stessa plancia, e allora
 * quella parcheggiata si puo' riprendere invece di ricostruirla. */
export function profiloDellaPlancia(panel, variant, staticBase) {
  const config = panel?.config || {};
  return JSON.stringify([
    config.entry_ids?.[0] || config.instance_id || "integration",
    variant,
    staticBase,
    config.config_profile || "",
    config.primary !== false,
  ]);
}

/* Si resta sulla plancia?
 *
 * Home Assistant annuncia il cambio di pagina prima di rifare il documento, e
 * quello e' l'unico momento in cui la cornice si puo' ancora mettere al
 * riparo. Ma l'indirizzo cambia anche restando qui — una finestra che si apre,
 * un parametro — e li' non c'e' niente da parcheggiare.
 *
 * Senza il nome della nostra pagina non si indovina: si parcheggia lo stesso e,
 * se Home Assistant la plancia se l'e' tenuta, la cornice torna in scena al
 * giro dopo. */
export function restaSullaPlancia(pathname, urlPath) {
  const nostro = String(urlPath || "")
    .split("/")
    .filter(Boolean)[0];
  if (!nostro) return false;
  const dove = String(pathname || "")
    .split("/")
    .filter(Boolean)[0];
  return dove === nostro;
}

function ricovero(documentRef = document) {
  let posto = documentRef.getElementById(RICOVERO_ID);
  if (posto) return posto;
  posto = documentRef.createElement("div");
  posto.id = RICOVERO_ID;
  posto.setAttribute("aria-hidden", "true");
  /* `display:none` e non un angolo trasparente: cosi' il browser non disegna
   * niente e la plancia da parte non chiede fotogrammi. Il documento dentro la
   * cornice resta vivo lo stesso — e' lo staccarla dall'albero che lo
   * ucciderebbe, non il nasconderla. */
  posto.style.display = "none";
  documentRef.body?.append(posto);
  return posto;
}

function dimenticaIlParcheggio() {
  if (parcheggio.timer) clearTimeout(parcheggio.timer);
  parcheggio.timer = 0;
  parcheggio.chiave = "";
  const host = parcheggio.host;
  parcheggio.host = null;
  host?.destroy();
}

function alCambioDiPagina() {
  const pannello = attivo;
  if (!pannello?.host || !pannello.isConnected) return;
  if (restaSullaPlancia(globalThis.location?.pathname, pannello._panel?.url_path)) return;
  if (!pannello.parcheggia()) return;
  /* E se Home Assistant la plancia se l'e' tenuta, la cornice torna al giro
   * dopo — prima che qualcuno abbia il tempo di vedere il vuoto. Il ritorno
   * passa da `bootstrap`, che e' la stessa strada di chi arriva da fuori. */
  setTimeout(() => {
    if (pannello.isConnected) pannello.bootstrap();
  }, 0);
}

function ascoltaLaNavigazione(view = globalThis) {
  if (!view?.addEventListener || view.__DASHBOARDMODERN_PARK_NAV__) return false;
  view.__DASHBOARDMODERN_PARK_NAV__ = true;
  /* `location-changed` e' l'avviso che Home Assistant si manda da solo quando
   * cambia pagina, e arriva prima che il pannello venga tolto; gli altri due
   * coprono il tasto indietro del browser. In fase di cattura, per stare
   * davanti a chi ridisegna. */
  for (const evento of ["location-changed", "popstate", "hashchange"]) {
    view.addEventListener(evento, alCambioDiPagina, true);
  }
  return true;
}

export function resolveLegacyVariant(panel, hass) {
  const variants = panel?.config?.legacy_variants;
  if (!Array.isArray(variants) || variants.length === 0) return null;
  const preferred = legacyVariantForLocale(hass?.locale?.language);
  if (variants.includes(preferred)) return preferred;
  /* Se la plancia giusta non e' stata spedita si ripiega sull'inglese, non
   * sulla prima della lista. La lista arriva ordinata per nome, e finche' le
   * plance sono due il caso non si vede; ma basterebbe aggiungerne una che
   * viene prima in ordine alfabetico — una "dashboard-de.html" — perche' ogni
   * lingua non supportata finisca in tedesco senza che nessuno l'abbia deciso. */
  if (variants.includes(LEGACY_VARIANTS.en)) return LEGACY_VARIANTS.en;
  return variants[0];
}

export function userCanAccess(config = {}, user = {}) {
  const allowed = Array.isArray(config.allowed_user_ids)
    ? config.allowed_user_ids.filter(Boolean)
    : [];
  return allowed.length === 0 || allowed.includes(user?.id);
}

/* La dashboard di appoggio non la scrive piu' il pannello.
 *
 * La scriveva qui: `ensureCompanionDashboard` creava la dashboard Lovelace e ne
 * salvava la vista. Ma il pannello gira solo quando qualcuno apre la plancia
 * dalla barra laterale, e chi la mette come dashboard PREDEFINITA e riavvia
 * apre quella dashboard senza passare di qui. Se il contenuto non era mai stato
 * scritto, Home Assistant rispondeva «Errore di configurazione» — e aprirla
 * dalla barra la riparava, che e' esattamente come e' stato segnalato.
 *
 * Adesso la scrive l'integrazione all'avvio (`frontend.py`,
 * `_ensure_companion_dashboard`), che e' l'unico momento che succede comunque,
 * qualunque cosa si apra per prima. E la vista e' scritta in un posto solo:
 * averla qui e la' voleva dire due verita' sulla stessa dashboard.
 */

export class DashboardModernPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.host = null;
    this.mounted = false;
    this.chiave = "";
    this._smontaggio = 0;
  }

  set hass(value) {
    this._hass = value;
    this.bootstrap();
  }

  set panel(value) {
    this._panel = value;
    this.bootstrap();
  }

  resetHost() {
    if (attivo === this) attivo = null;
    this.host?.destroy();
    this.host = null;
    this.mounted = false;
    this.chiave = "";
  }

  /** Mette la plancia al riparo. Torna `false` se non si e' potuto. */
  parcheggia() {
    if (!this.host || parcheggio.host) return false;
    if (!this.host.parcheggia(ricovero())) return false;
    parcheggio.chiave = this.chiave;
    parcheggio.host = this.host;
    parcheggio.timer = setTimeout(dimenticaIlParcheggio, OBLIO_MS);
    this.host = null;
    this.mounted = false;
    if (attivo === this) attivo = null;
    return true;
  }

  /** La plancia di prima, se e' la stessa plancia e la stessa casa. */
  riprendiDalParcheggio(surface, chiave) {
    if (!parcheggio.host) return false;
    if (parcheggio.chiave !== chiave || parcheggio.host.connection !== this._hass?.connection) {
      /* Un'altra plancia sta per essere montata: quella da parte non serve
       * piu' a nessuno, e due cornici vive per un pannello solo sarebbero due
       * plance che parlano con Home Assistant. */
      dimenticaIlParcheggio();
      return false;
    }
    if (!parcheggio.host.riprendi(surface)) {
      dimenticaIlParcheggio();
      return false;
    }
    if (parcheggio.timer) clearTimeout(parcheggio.timer);
    this.host = parcheggio.host;
    parcheggio.host = null;
    parcheggio.chiave = "";
    parcheggio.timer = 0;
    return true;
  }

  renderDenied() {
    this.resetHost();
    const denied = document.createElement("section");
    denied.setAttribute("role", "alert");
    denied.innerHTML = `<strong>DashboardModern</strong><span>${
      this._hass?.locale?.language?.startsWith("it")
        ? "Questa plancia non è abilitata per il tuo utente."
        : "This dashboard is not enabled for your user."
    }</span>`;
    const style = document.createElement("style");
    style.textContent = `:host{display:grid;min-height:100%;place-items:center;background:var(--primary-background-color)}section{display:grid;gap:12px;max-width:420px;margin:24px;padding:28px;border-radius:22px;background:var(--card-background-color);box-shadow:var(--ha-card-box-shadow);color:var(--primary-text-color);text-align:center}strong{font-size:1.4rem}span{color:var(--secondary-text-color)}`;
    this.shadowRoot.replaceChildren(style, denied);
  }

  bootstrap() {
    if (!this._hass || !this._panel) return;
    if (!userCanAccess(this._panel.config, this._hass.user)) {
      this.renderDenied();
      return;
    }
    const variant = resolveLegacyVariant(this._panel, this._hass);
    const staticBase = this._panel.config?.static_base;
    if (!variant || !staticBase || !this._hass.connection?.sendMessagePromise) return;
    const chiave = profiloDellaPlancia(this._panel, variant, staticBase);
    if (this.mounted) {
      /* Cambiare entry, variante o profilo vuol dire un'altra plancia: quella
       * in scena si smonta, cornice compresa. */
      if (chiave === this.chiave) return;
      this.resetHost();
    }

    this.mounted = true;
    this.chiave = chiave;
    attivo = this;
    ascoltaLaNavigazione();
    this.style.display = "block";
    this.style.height = "100%";
    const surface = document.createElement("div");
    surface.style.cssText = "width:100%;height:100%;min-height:0";
    this.shadowRoot.replaceChildren(surface);
    /* La plancia di prima, se c'e': e' tutto il guadagno del parcheggio, e da
     * qui in poi non c'e' niente da costruire. */
    if (this.riprendiDalParcheggio(surface, chiave)) return;
    this.host = mountLegacyHost(surface, {
      hass: this._hass,
      connection: this._hass.connection,
      staticBase,
      variant,
      instanceId:
        (this._panel.config?.entry_ids && this._panel.config.entry_ids[0]) ||
        "integration",
      // Storage profile of the shared configuration. Unlike the instance id it
      // does not contain the entry_id, so removing and re-adding the
      // integration keeps the plancia configured.
      configProfile: this._panel.config?.config_profile || "",
      primary: this._panel.config?.primary !== false,
    });
  }

  /* Lo smontaggio aspetta un attimo, il rimontaggio no.
   *
   * All'avvio Home Assistant puo' staccare e riattaccare il pannello nel giro
   * di un fotogramma — un riordino del suo stesso documento, non una
   * navigazione vera. Smontare subito butta via l'iframe con tutta la plancia,
   * e il prossimo `set hass` la ricostruisce da zero: il velo d'avvio si
   * vedeva due volte — compare, sparisce col documento, ricompare col nuovo.
   * Se il pannello torna attaccato prima del giro successivo non c'e' niente
   * da smontare; se invece se n'e' andato davvero, lo smontaggio parte. */
  connectedCallback() {
    if (this._smontaggio) {
      clearTimeout(this._smontaggio);
      this._smontaggio = 0;
    }
  }

  disconnectedCallback() {
    if (this._smontaggio) return;
    this._smontaggio = setTimeout(() => {
      this._smontaggio = 0;
      if (!this.isConnected) this.abbandona();
    }, 250);
  }

  /* Il pannello se n'e' andato davvero.
   *
   * Se la plancia era stata messa da parte al cambio di pagina, qui non c'e'
   * piu' niente da smontare: la cornice sta al riparo e aspetta il ritorno.
   * Se invece nessuno ha avvisato — una navigazione che non passa da
   * `location-changed`, oppure un browser senza spostamento atomico — la
   * cornice se n'e' andata col pannello e si smonta come si e' sempre fatto. */
  abbandona() {
    if (!this.host) {
      if (attivo === this) attivo = null;
      this.mounted = false;
      this.chiave = "";
      return;
    }
    this.resetHost();
  }
}

const PANEL_TAG = (() => {
  try {
    const m = /dashboardmodern_static\/([a-z0-9]+)\//.exec(import.meta.url);
    if (m?.[1]) return `dashboardmodern-panel-${m[1].slice(0, 8)}`;
  } catch (_error) {}
  return "dashboardmodern-panel";
})();

if (!customElements.get(PANEL_TAG)) customElements.define(PANEL_TAG, DashboardModernPanel);
