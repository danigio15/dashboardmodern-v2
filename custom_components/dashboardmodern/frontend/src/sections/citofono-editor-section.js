/* Dove si dichiarano il citofono e la cassetta della posta (#449).
 *
 * «Avendo un intercom ho un button.cancello per aprire, inoltre volevo chiedere
 * una sezione per la cassetta della posta.»
 *
 * Due elenchi in una scheda sola, perché sono la stessa porta: sopra i
 * citofoni — il tasto che apre, il campanello, la telecamera — e sotto le
 * cassette, con i due sensori che dicono quando è arrivata e quando è stata
 * svuotata.
 *
 * Tutte le caselle sono facoltative sul serio: chi ha solo il tasto del
 * cancello ha una riga con un tasto, chi ha solo il PIR dentro la cassetta ha
 * una riga che dice quando qualcosa si è mosso. Una casella vuota è una cosa
 * che non si mostra, non un errore.
 */
import {
  CAMPI_DELLA_CASSETTA,
  CAMPI_DEL_CITOFONO,
  CASSETTE_MASSIME,
  CHIAVE_CITOFONO,
  CITOFONI_MASSIMI,
  LUCE_CHE_APRE,
  bindCassettaToDevice,
  bindCitofonoToDevice,
  normalizzaCassette,
  normalizzaCitofoni,
} from "../core/citofono-e-posta.js";
import { apriMenuIntegrazioni } from "./appliance-integration-section.js";
import { CITOFONO_TAB, renderCitofono } from "./citofono-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_CITOFONO_EDITOR__";
const state = (root[KEY] ||= { installed: false, aperto: { citofoni: -1, cassette: -1 } });

export const CITOFONO_EDITOR_TAB = CITOFONO_TAB;

/* Le due liste hanno la stessa forma, e qui sta tutto quello che le distingue:
 * l'icona, il tetto, le caselle, e come si compilano da un'integrazione. */
const LISTE = () => ({
  citofoni: {
    glifo: "🔔",
    tetto: CITOFONI_MASSIMI,
    campi: CAMPI_DEL_CITOFONO,
    lega: bindCitofonoToDevice,
    normalizza: normalizzaCitofoni,
    titolo: t("Citofono", "Intercom"),
    nuovo: t("Citofono nuovo", "New intercom"),
    aggiungi: t("Aggiungi citofono", "Add intercom"),
    esempioNome: "Cancello",
  },
  cassette: {
    glifo: "📬",
    tetto: CASSETTE_MASSIME,
    campi: CAMPI_DELLA_CASSETTA,
    lega: bindCassettaToDevice,
    normalizza: normalizzaCassette,
    titolo: t("Cassetta della posta", "Mailbox"),
    nuovo: t("Cassetta nuova", "New mailbox"),
    aggiungi: t("Aggiungi cassetta", "Add mailbox"),
    esempioNome: "Cassetta",
  },
});

const ETICHETTE = () => ({
  apri: [t("Tasto che apre", "Button that opens"), "button.cancello"],
  campanello: [t("Campanello", "Doorbell"), "binary_sensor.citofono_ding"],
  telecamera: [t("Telecamera", "Camera"), "camera.citofono"],
  posta: [t("È arrivato qualcosa", "Something arrived"), "binary_sensor.vallhorn_motion"],
  ritiro: [t("Sportello aperto", "Flap opened"), "sensor.vallhorn_illuminance"],
  contatore: [t("Contatore lettere", "Letter counter"), "counter.lettere"],
});

function configurazione() {
  const salvato = readJson(CHIAVE_CITOFONO, {});
  const dato = salvato && typeof salvato === "object" && !Array.isArray(salvato) ? salvato : {};
  return {
    citofoni: Array.isArray(dato.citofoni) ? dato.citofoni : [],
    cassette: Array.isArray(dato.cassette) ? dato.cassette : [],
  };
}

function salva(prossima) {
  writeJsonIfChanged(CHIAVE_CITOFONO, {
    citofoni: normalizzaCitofoni(prossima.citofoni),
    cassette: normalizzaCassette(prossima.cassette),
  });
  renderCitofono();
  try {
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  } catch (_error) {}
}

function activeTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmCitofonoEditor;
  ensureCitofonoEditor();
}

/* ── il disegno della scheda ──────────────────────────────────────────── */

function campoMarkup(lista, indice, campo, valore) {
  const [etichetta, esempio] = ETICHETTE()[campo];
  const id = `dm-citofono-${lista}-${indice}-${campo}`;
  return `<label class="ed-slot dm-cit-ed-campo"><span class="ed-slot-lbl">${esc(etichetta)}</span>
    <span class="ed-form-row"><input id="${esc(id)}" class="ed-input mono" data-dm-cit-campo="${esc(campo)}" value="${esc(valore)}" placeholder="${esc(esempio)}" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-dm-cit-pick="${esc(id)}" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span></label>`;
}

function sogliaMarkup(voce) {
  const valore = Number.isFinite(Number(voce?.soglia)) ? Number(voce.soglia) : LUCE_CHE_APRE;
  return `<label class="ed-slot dm-cit-ed-campo"><span class="ed-slot-lbl">${esc(
    t("Da quanta luce è aperta (lux)", "How much light means open (lux)"),
  )}</span>
    <span class="ed-form-row"><input class="ed-input" type="number" min="0" step="1" data-dm-cit-campo="soglia" value="${esc(String(valore))}"></span></label>`;
}

function rigaMarkup(lista, voce, indice) {
  const regole = LISTE()[lista];
  const aperto = state.aperto[lista] === indice;
  const quante = regole.campi.filter((campo) => clean(voce?.[campo])).length;
  return `<article class="ed-row dm-cit-ed-riga" data-dm-cit-lista="${esc(lista)}" data-dm-cit-indice="${indice}" data-open="${aperto}">
    <div class="dm-cit-ed-head">
      <span class="dm-cit-ed-ic" aria-hidden="true">${esc(regole.glifo)}</span>
      <span class="ed-row-main">
        <strong class="ed-row-new">${esc(clean(voce?.nome) || regole.nuovo)}</strong>
        <small class="ed-row-old mono">${esc(clean(voce?.[regole.campi[0]]) || `${quante}/${regole.campi.length}`)}</small>
      </span>
      <button type="button" class="ed-del" data-dm-cit-apri aria-label="${esc(t("Modifica", "Edit"))}">✏️</button>
      <button type="button" class="ed-del" data-dm-cit-togli aria-label="${esc(t("Elimina", "Remove"))}">🗑️</button>
    </div>
    <div class="dm-cit-ed-body"${aperto ? "" : " hidden"}>
      <label class="ed-slot dm-cit-ed-campo"><span class="ed-slot-lbl">${esc(t("Nome", "Name"))}</span>
        <span class="ed-form-row"><input class="ed-input" data-dm-cit-campo="nome" value="${esc(clean(voce?.nome))}" placeholder="${esc(regole.esempioNome)}"></span></label>
      ${regole.campi.map((campo) => campoMarkup(lista, indice, campo, clean(voce?.[campo]))).join("")}
      ${lista === "cassette" ? sogliaMarkup(voce) : ""}
      <button type="button" class="ed-save-btn" data-dm-cit-salva>💾 ${esc(t("Salva", "Save"))}</button>
    </div>
  </article>`;
}

function invitoMarkup(lista) {
  const regole = LISTE()[lista];
  const spiega =
    lista === "citofoni"
      ? t(
          "Ring, Doorbird, 2N, un relè su un cancello… scegli il dispositivo del citofono e le caselle si compilano da sole: il tasto che apre, il campanello e la telecamera, quelli che quell'integrazione pubblica.",
          "Ring, Doorbird, 2N, a relay on a gate… pick the intercom's device and the fields fill themselves in: the button that opens, the doorbell and the camera — whichever that integration publishes.",
        )
      : t(
          "Il Vallhorn di IKEA, un contatto Zigbee, un sensore di luce… scegli il dispositivo dentro la cassetta e le due caselle si compilano da sole.",
          "IKEA's Vallhorn, a Zigbee contact, a light sensor… pick the device inside the mailbox and the two fields fill themselves in.",
        );
  return `<div class="dm-cit-ed-invito">
    <button type="button" class="ed-btn-add dm-cit-ed-integ" data-dm-cit-integ="${esc(lista)}">🔗 ${esc(
      t("Aggiungi da un'integrazione", "Add from an integration"),
    )}</button>
    <small>${esc(spiega)}</small>
  </div>
  <button type="button" class="ed-btn-add" data-dm-cit-aggiungi="${esc(lista)}"${
    (configurazione()[lista] || []).length >= regole.tetto ? " disabled" : ""
  }>＋ ${esc(regole.aggiungi)}</button>`;
}

function elencoMarkup(lista) {
  const regole = LISTE()[lista];
  const righe = configurazione()[lista];
  return `<div class="ed-sec-title">${esc(regole.glifo)} ${esc(regole.titolo)}</div>
    <div class="ed-list dm-cit-ed-list">${
      righe.length
        ? righe.map((voce, indice) => rigaMarkup(lista, voce, indice)).join("")
        : `<div class="ed-empty">${esc(t("Niente, per ora", "Nothing yet"))}</div>`
    }</div>
    ${invitoMarkup(lista)}`;
}

function schedaMarkup() {
  return `<div class="ed-intro">${esc(
    t(
      "Chi suona alla porta e cosa c'è in cassetta. Del citofono servono il tasto che apre — un button, uno script, una serratura, un cancello motorizzato — e, se c'è, il campanello. Della cassetta servono il sensore che dice che è arrivato qualcosa e quello che dice che lo sportello è stato aperto: dal confronto fra i due momenti la plancia sa se la posta è ancora dentro.",
      "Who is at the door and what is in the mailbox. The intercom needs the button that opens — a button, a script, a lock, a motorised gate — and the doorbell if there is one. The mailbox needs the sensor that says something arrived and the one that says the flap was opened: from the two moments the dashboard knows whether the mail is still inside.",
    ),
  )}</div>
  ${elencoMarkup("citofoni")}
  ${elencoMarkup("cassette")}`;
}

export function ensureCitofonoEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== CITOFONO_EDITOR_TAB) return false;
  if (body.dataset.dmCitofonoEditor === "true") return false;
  body.dataset.dmCitofonoEditor = "true";
  body.innerHTML = `<div class="dm-cit-ed">${schedaMarkup()}</div>`;
  return true;
}

export function ensureCitofonoEditorTab() {
  const tabs = doc?.querySelector(".ed-tab")?.parentElement;
  if (!tabs || tabs.querySelector(`.ed-tab[data-tab="${CITOFONO_EDITOR_TAB}"]`)) return false;
  const tab = doc.createElement("button");
  tab.className = "ed-tab";
  tab.dataset.tab = CITOFONO_EDITOR_TAB;
  tab.textContent = `📮 ${t("Citofono e posta", "Intercom and mail")}`;
  tab.addEventListener("click", () => root.editorSwitch?.(CITOFONO_EDITOR_TAB));
  const prima = tabs.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(tab);
  else tabs.append(tab);
  return true;
}

/* ── i gesti ──────────────────────────────────────────────────────────── */

function leggiLaRiga(riga, voce) {
  const letto = { ...(voce || {}) };
  for (const campo of riga.querySelectorAll("[data-dm-cit-campo]"))
    letto[clean(campo.dataset.dmCitCampo)] = clean(campo.value);
  return letto;
}

function anteprima(lista, { device, entities }) {
  const regole = LISTE()[lista];
  const nato = regole.lega({ device, entities, states: allStates() });
  const etichette = ETICHETTE();
  const casella = (campo) =>
    `<div class="dm-integ-casella"><span>${esc(etichette[campo][0])}</span><b class="mono">${esc(nato[campo]) || "—"}</b></div>`;
  return {
    etichetta: regole.titolo,
    corpo: `<div class="dm-integ-caselle">${regole.campi.map(casella).join("")}</div>`,
  };
}

function creaDaDispositivo(lista, { device, entities, integration }) {
  const regole = LISTE()[lista];
  const tutte = configurazione();
  const righe = tutte[lista];
  if (righe.length >= regole.tetto) {
    /* Il numero sta nella frase per esteso, non interpolato: una chiave
     * costruita con un valore dentro cambia col valore, e nessuna di quelle
     * chiavi sta nei tredici cataloghi. */
    root.alert?.(
      t(
        "La scheda ne tiene quattro, e ci sono tutti: togline uno per farci stare questo.",
        "This tab holds four of them and they are all taken: remove one to make room.",
      ),
    );
    return;
  }
  const nato = regole.lega({
    device,
    entities,
    states: allStates(),
    indice: righe.length,
  });
  /* Un dispositivo che non porta nessuna delle caselle non è quello che si sta
   * cercando: la finestra mostra TUTTI i dispositivi, e da lì può arrivare una
   * lampadina. */
  if (!regole.campi.some((campo) => clean(nato[campo]))) {
    root.alert?.(
      t(
        "Da questo dispositivo non si riconosce niente di utile: servono almeno un tasto che apra, un campanello o un sensore della cassetta.",
        "Nothing useful can be recognised from this device: at least a button that opens, a doorbell or a mailbox sensor is needed.",
      ),
    );
    return;
  }
  state.aperto[lista] = righe.length;
  salva({ ...tutte, [lista]: [...righe, nato] });
  ridisegna();
  const daChi = clean(integration?.name) || t("un'integrazione", "an integration");
  root.edToast?.(`${nato.nome || device.name} — ${t("aggiunto da", "added from")} ${daChi}`);
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== CITOFONO_EDITOR_TAB || !body.contains(event.target)) return;
  const tutte = configurazione();

  const integ = event.target.closest("[data-dm-cit-integ]");
  if (integ) {
    event.preventDefault();
    const lista = clean(integ.dataset.dmCitInteg);
    apriMenuIntegrazioni({
      titolo:
        lista === "citofoni"
          ? t("Aggiungi un citofono da un'integrazione", "Add an intercom from an integration")
          : t("Aggiungi una cassetta da un'integrazione", "Add a mailbox from an integration"),
      intro: t(
        "Le integrazioni di Home Assistant, ufficiali o da HACS, con i dispositivi che portano. Scegli il dispositivo: le caselle entrano da sole.",
        "Home Assistant integrations, official or from HACS, with the devices they bring. Pick the device: the fields come along by themselves.",
      ),
      anteprima: (scelta) => anteprima(lista, scelta),
      onScelto: (scelta) => creaDaDispositivo(lista, scelta),
    });
    return;
  }

  const piu = event.target.closest("[data-dm-cit-aggiungi]");
  if (piu) {
    event.preventDefault();
    const lista = clean(piu.dataset.dmCitAggiungi);
    const righe = tutte[lista];
    if (righe.length >= LISTE()[lista].tetto) return;
    state.aperto[lista] = righe.length;
    const seme = lista === "citofoni" ? "citofono" : "cassetta";
    salva({
      ...tutte,
      [lista]: [...righe, { id: `${seme}-${Date.now().toString(36)}`, nome: "" }],
    });
    ridisegna();
    return;
  }

  const lente = event.target.closest("[data-dm-cit-pick]");
  if (lente) {
    event.preventDefault();
    const campo = body.querySelector(`#${CSS.escape(clean(lente.dataset.dmCitPick))}`);
    if (campo) root.wzPickEntity?.(campo);
    return;
  }

  const riga = event.target.closest("[data-dm-cit-indice]");
  if (!riga) return;
  const lista = clean(riga.dataset.dmCitLista);
  const indice = Number(riga.dataset.dmCitIndice);
  const righe = tutte[lista];
  if (!Number.isFinite(indice) || !righe?.[indice]) return;

  if (event.target.closest("[data-dm-cit-apri]")) {
    event.preventDefault();
    /* Quello che è nelle caselle si mette al sicuro prima di ridisegnare: la
     * matita di un'altra riga rifà l'elenco, e senza questo il nome appena
     * battuto se ne andrebbe in silenzio (#439). */
    const prossime = righe.slice();
    prossime[indice] = leggiLaRiga(riga, righe[indice]);
    state.aperto[lista] = state.aperto[lista] === indice ? -1 : indice;
    salva({ ...tutte, [lista]: prossime });
    ridisegna();
    return;
  }

  if (event.target.closest("[data-dm-cit-togli]")) {
    event.preventDefault();
    state.aperto[lista] = -1;
    salva({ ...tutte, [lista]: righe.filter((_voce, posizione) => posizione !== indice) });
    ridisegna();
    return;
  }

  if (event.target.closest("[data-dm-cit-salva]")) {
    event.preventDefault();
    const prossime = righe.slice();
    prossime[indice] = leggiLaRiga(riga, righe[indice]);
    salva({ ...tutte, [lista]: prossime });
    ridisegna();
    root.edToast?.(t("💾 Salvato", "💾 Saved"));
  }
}

function installStyles() {
  installStyle(
    "dm-citofono-editor-style",
    `
    #ed-body .dm-cit-ed{display:grid!important;gap:12px!important}
    #ed-body .dm-cit-ed-list{display:grid!important;gap:8px!important;margin-bottom:10px!important}
    #ed-body .dm-cit-ed-riga{display:block!important;padding:0!important;overflow:hidden}
    #ed-body .dm-cit-ed-head{display:flex!important;align-items:center!important;gap:10px!important;padding:10px 12px!important}
    #ed-body .dm-cit-ed-ic{font-size:18px!important}
    #ed-body .dm-cit-ed-body{display:grid!important;gap:8px!important;padding:0 12px 12px!important}
    #ed-body .dm-cit-ed-body[hidden]{display:none!important}
    #ed-body .dm-cit-ed-campo{display:grid!important;gap:4px!important;margin:0!important}
    #ed-body .dm-cit-ed-campo .ed-form-row{display:flex!important;gap:8px!important;min-width:0!important}
    #ed-body .dm-cit-ed-campo .ed-form-row>input{flex:1 1 auto!important;min-width:0!important}
    #ed-body .dm-cit-ed-invito{
      display:grid!important;gap:6px!important;margin:0 0 12px!important;padding:12px!important;
      border-radius:14px!important;border:1px dashed color-mix(in srgb,#0ea5e9 45%,transparent)!important;
      background:color-mix(in srgb,#0ea5e9 7%,transparent)!important}
    #ed-body .dm-cit-ed-invito .dm-cit-ed-integ{
      margin:0!important;background:linear-gradient(135deg,#0369a1,#075985)!important;color:#fff!important}
    #ed-body .dm-cit-ed-invito small{
      font-size:11px!important;line-height:1.45!important;color:var(--text-dim,#64748b)!important;font-weight:600!important}
    `,
  );
}

export function installCitofonoEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  ensureCitofonoEditorTab();
  onEditorRedraw("__dmCitofonoEditor", () => {
    root.queueMicrotask?.(() => {
      ensureCitofonoEditorTab();
      ensureCitofonoEditor();
    });
  });
  doc.addEventListener("click", onClick);
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => {
        ensureCitofonoEditorTab();
        ensureCitofonoEditor();
      });
    });
  return true;
}

installCitofonoEditor();
