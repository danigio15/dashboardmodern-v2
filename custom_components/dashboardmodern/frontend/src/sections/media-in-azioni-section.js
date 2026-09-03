/* Un lettore fra le Azioni rapide, con la copertina per sfondo (#269).
 *
 * «La possibilità di aggiungerli anche nelle Azioni rapide, sarebbe figo se lo
 * sfondo fosse l'anteprima di ciò che viene riprodotto (la copertina del
 * disco).»
 *
 * Le Azioni rapide le disegna il guscio, e sono tutte uguali: un simbolo
 * colorato e un nome. Per un lettore quello è meno di quanto si sa — la
 * copertina la manda Home Assistant a ogni brano — e una fila di tasti in cui
 * uno porta la copertina del disco che sta girando dice, a colpo d'occhio,
 * l'unica cosa che si voleva sapere.
 *
 * Qui si fanno due cose sole. La prima: offrire «lettore multimediale» fra i
 * tipi di azione, perché scrivere a mano `media_player.salotto` dentro una
 * casella che si chiama «Toggle entità» è possibile ma non è un'offerta. La
 * seconda: posare la copertina addosso al tasto, dopo che il guscio l'ha
 * disegnato.
 *
 * Cosa succeda al tocco non si decide qui: lo decide chi già sceglie il
 * servizio giusto per ogni entità, che per un lettore è mettere in pausa o far
 * ripartire — e non `toggle`, che spegnerebbe la cassa.
 */
import { allStates, clean, doc, installStyle, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_MEDIA_AZIONI__";
const STYLE_ID = "dm-media-azioni-style";
const state = (root[KEY] ||= { installed: false, frame: 0 });

/* Il tipo che si aggiunge alla tendina del guscio. Il guscio non lo conosce e
 * non ha bisogno di conoscerlo: salva `{type, name, entity}` come per gli
 * altri, e al tocco decide il dominio dell'entità. */
export const TIPO_MEDIA = "media";

function azioni() {
  try {
    const lette = root.getQuickActions?.();
    if (Array.isArray(lette)) return lette;
  } catch (_error) {}
  try {
    return JSON.parse(root.localStorage?.getItem("cd_quick_actions") || "[]") || [];
  } catch (_error) {
    return [];
  }
}

/** L'entità di un'azione, risolta come la risolve il guscio. */
export function entitaDellAzione(azione) {
  const scritta = clean(azione?.entity);
  if (!scritta) return "";
  try {
    return clean(root.resolveEntity?.(scritta) || scritta);
  } catch (_error) {
    return scritta;
  }
}

/** Se questa azione comanda un lettore multimediale. */
export function eUnLettore(azione) {
  return entitaDellAzione(azione).startsWith("media_player.");
}

/* ── la copertina addosso al tasto ────────────────────────────────────── */

export function vestiLeAzioni() {
  const griglia = doc?.getElementById?.("qa-grid");
  if (!griglia) return 0;
  const tasti = [...griglia.querySelectorAll(".qa-btn")];
  if (!tasti.length) return 0;
  const lista = azioni();
  const states = allStates();
  let vestiti = 0;
  tasti.forEach((tasto, indice) => {
    const azione = lista[indice];
    if (!azione || !eUnLettore(azione)) {
      if (tasto.dataset.dmQaMedia) {
        delete tasto.dataset.dmQaMedia;
        delete tasto.dataset.dmQaArte;
        tasto.style.removeProperty("--dm-qa-arte");
      }
      return;
    }
    const stato = states?.[entitaDellAzione(azione)] || null;
    const copertina = clean(stato?.attributes?.entity_picture);
    const suona = clean(stato?.state).toLowerCase() === "playing";
    tasto.dataset.dmQaMedia = copertina ? "arte" : "spoglio";
    tasto.dataset.dmQaSuona = String(suona);
    /* L'indirizzo della copertina è firmato e cambia a ogni brano: riscriverlo
     * quando non è cambiato farebbe rifare la richiesta al browser, e il tasto
     * lampeggerebbe fra un'immagine e la stessa immagine. */
    if (tasto.dataset.dmQaArte !== copertina) {
      tasto.dataset.dmQaArte = copertina;
      if (copertina) tasto.style.setProperty("--dm-qa-arte", `url("${copertina}")`);
      else tasto.style.removeProperty("--dm-qa-arte");
    }
    vestiti += 1;
  });
  return vestiti;
}

/* ── l'offerta nella tendina della configurazione ─────────────────────── */

export function ensureVoceNellaTendina() {
  const tendina = doc?.getElementById?.("ed-qa-type");
  if (!tendina || tendina.querySelector(`option[value="${TIPO_MEDIA}"]`)) return false;
  const voce = doc.createElement("option");
  voce.value = TIPO_MEDIA;
  voce.textContent = `🔊 ${t("Lettore multimediale", "Media player")}`;
  /* Accanto a «Toggle entità»: sono la stessa famiglia — un'entità che si
   * comanda — e chi cerca l'una guarda dov'è l'altra. */
  const toggle = tendina.querySelector('option[value="toggle"]');
  if (toggle) toggle.after(voce);
  else tendina.append(voce);
  return true;
}

/* Il guscio decide se mostrare la casella dell'entità da un elenco chiuso di
 * tre tipi: il quarto gli è sconosciuto, e la casella restava nascosta —
 * cioè il tipo si poteva scegliere e poi non si poteva compilare. */
function insegnaLaCasella() {
  const originale = root.edQaTypeChanged;
  if (typeof originale !== "function" || originale.__dmMediaAzioni) return false;
  const nostra = function edQaTypeChanged(...argomenti) {
    const esito = originale.apply(this, argomenti);
    try {
      const scelto = clean(doc?.getElementById?.("ed-qa-type")?.value);
      if (scelto !== TIPO_MEDIA) return esito;
      const riga = doc?.getElementById?.("ed-qa-ent-row");
      if (riga) riga.style.display = "flex";
      const aiuto = doc?.getElementById?.("ed-qa-hint");
      if (aiuto)
        aiuto.textContent = t(
          "🔊 Scegli il lettore: il tasto prenderà la copertina di quello che sta suonando, e al tocco mette in pausa o fa ripartire.",
          "🔊 Pick the player: the tile takes the artwork of whatever is playing, and tapping it pauses or resumes.",
        );
    } catch (_error) {}
    return esito;
  };
  nostra.__dmMediaAzioni = true;
  root.edQaTypeChanged = nostra;
  return true;
}

/* ── impianto ─────────────────────────────────────────────────────────── */

function schedule() {
  if (state.frame) return;
  state.frame =
    root.requestAnimationFrame?.(() => {
      state.frame = 0;
      try {
        vestiLeAzioni();
        ensureVoceNellaTendina();
      } catch (errore) {
        root.console?.warn?.("[DashboardModern] media nelle azioni", errore);
      }
    }) || 0;
}

function avvolgiLaCostruzione() {
  const originale = root.buildQuickActions;
  if (typeof originale !== "function" || originale.__dmMediaAzioni) return false;
  const nostra = function buildQuickActions(...argomenti) {
    const esito = originale.apply(this, argomenti);
    try {
      vestiLeAzioni();
    } catch (_error) {}
    return esito;
  };
  nostra.__dmMediaAzioni = true;
  root.buildQuickActions = nostra;
  return true;
}

function installStyles() {
  installStyle(
    STYLE_ID,
    `
      /* Il tasto con la copertina: l'immagine riempie il riquadro e un velo
         scuro, piu' fitto in basso dove sta la scritta, tiene leggibili nome e
         simbolo. Senza il velo un nome scuro su una copertina scura sparisce,
         e su una chiara sparisce quello bianco. */
      /* Il vassoio delle Azioni rapide dipinge lo sfondo dei tasti con un
         !important e una fila di identificatori: qui si scrive la stessa
         fila piu' un attributo, o la copertina non arriverebbe mai a vedersi.
         Non e' una gara di specificita' per sport — e' che quel foglio ha
         ragione su tutti gli altri tasti, e su questo no. */
      /* Il velo scuro e' un secondo strato dello stesso sfondo, non un
         ::before: il nome del tasto e' un nodo di testo nudo — lo scrive il
         guscio senza avvolgerlo — e un pseudo-elemento posizionato gli
         passerebbe sopra, sbiadendo proprio la parola che deve restare
         leggibile. */
      .qa-btn[data-dm-qa-media="arte"],
      html body #page-home .dm-vassoio #qa-grid .qa-btn[data-dm-qa-media="arte"]{
        position:relative;overflow:hidden;
        background-color:#0f172a!important;
        background-image:
          linear-gradient(180deg,rgba(2,6,23,.16),rgba(2,6,23,.86)),
          var(--dm-qa-arte)!important;
        background-size:cover!important;background-position:center!important;
        background-repeat:no-repeat!important;
        color:#f8fafc!important;border-color:rgba(248,250,252,.24)!important;
        text-shadow:0 1px 6px rgba(2,6,23,.75)}
      /* Il disco di smalto del vassoio, sopra una copertina, e' un quadrato di
         colore in mezzo alla foto: qui diventa un vetro scuro, e dentro resta
         il simbolo bianco. */
      .qa-btn[data-dm-qa-media="arte"] .icon,
      html body #page-home .dm-vassoio #qa-grid .qa-btn[data-dm-qa-media="arte"] .icon{
        background:rgba(2,6,23,.42)!important;
        border:1px solid rgba(248,250,252,.28)!important;
        box-shadow:none!important;filter:none!important;color:#f8fafc!important}
      .qa-btn[data-dm-qa-media="arte"] .icon::after{display:none!important}
      .qa-btn[data-dm-qa-media]{position:relative}
      /* Il puntino che dice «sta suonando»: piccolo, in un angolo, fermo.
         Un'onda che pulsa su ogni tasto sarebbe la stessa animazione infinita
         che si e' appena tolta da dietro le finestre. */
      .qa-btn[data-dm-qa-suona="true"]::after{
        content:"";position:absolute;top:9px;right:9px;width:8px;height:8px;border-radius:50%;
        background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.24)}
    `,
  );
}

export function installMediaInAzioni() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  const aggancia = () => {
    avvolgiLaCostruzione();
    insegnaLaCasella();
    schedule();
  };
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:editor-rendered",
  ])
    root.addEventListener?.(evento, aggancia);
  aggancia();
  return true;
}
