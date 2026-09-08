/* La finestra di Assist (#360).
 *
 * «Vorrei avere la possibilita di aprire assist per chiedere delle cose sia
 * scrivendo che parlando.»
 *
 * Una finestra sola, con dentro la conversazione e in fondo la casella: si
 * scrive, oppure si tiene premuto il microfono e si parla. La frase la capisce
 * Home Assistant — la plancia non rifa' un assistente — e la risposta torna
 * qui, e se lo si e' chiesto viene anche letta ad alta voce.
 *
 * Il microfono e' quello del browser. Non e' un ripiego: la trascrizione ce
 * l'ha gia', e mandare l'audio a Home Assistant vorrebbe dire una pipeline, un
 * formato e un pezzo di protocollo binario per arrivare alla stessa frase.
 * Dove il browser non sa ascoltare — Firefox, per dirne uno — il microfono non
 * compare e la casella resta: meglio un tasto in meno che un tasto che non fa
 * niente.
 *
 * I conti non stanno qui: cosa si manda, cosa torna e quando il filo della
 * conversazione e' scaduto lo dice `core/assist-model.js`, che e' puro.
 */
import {
  CHIAVE_ASSIST,
  assistAcceso,
  domandaPerHomeAssistant,
  filoDaMandare,
  linguaPerIlMicrofono,
  normalizzaAssist,
  rispostaDi,
} from "../core/assist-model.js";
import {
  activeLocale,
  chiediAHomeAssistant,
  clean,
  doc,
  esc,
  installStyle,
  readJson,
  root,
  t,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ASSIST__";
const state = (root[KEY] ||= {
  installed: false,
  aperta: false,
  /* Le battute della conversazione: `{chi, testo, errore}`. Vivono finche' la
   * finestra e' aperta — una conversazione con la casa non e' una chat da
   * conservare, e tenerla vorrebbe dire decidere per quanto. */
  battute: [],
  filo: "",
  ultimo: 0,
  inVolo: false,
  ascolto: null,
});

function configurazione() {
  return normalizzaAssist(readJson(CHIAVE_ASSIST, {}));
}

/** Se Assist e' acceso, secondo l'elenco delle sezioni. */
function acceso() {
  return assistAcceso(readJson("cd_sections", {}), readJson(CHIAVE_ASSIST, {}));
}

/* ── la voce ─────────────────────────────────────────────────────────────
 *
 * `SpeechRecognition` e' ancora col prefisso su quasi tutti: si prende quello
 * che c'e'. Dove non c'e' niente, `null`, e il microfono non si disegna. */
function motoreDellaVoce() {
  return root.SpeechRecognition || root.webkitSpeechRecognition || null;
}

export function siPuoParlare() {
  return Boolean(motoreDellaVoce());
}

/** Legge la risposta ad alta voce, se e' stato chiesto. */
function leggi(testo) {
  if (!configurazione().voce || !clean(testo)) return;
  try {
    const voce = new root.SpeechSynthesisUtterance(testo);
    voce.lang = linguaPerIlMicrofono(activeLocale());
    root.speechSynthesis?.cancel?.();
    root.speechSynthesis?.speak?.(voce);
  } catch (_errore) {}
}

/* ── la conversazione ───────────────────────────────────────────────────── */

function aggiungi(chi, testo, extra = {}) {
  state.battute = [...state.battute, { chi, testo: clean(testo), ...extra }];
  disegna();
}

/**
 * Manda la frase a Home Assistant e aspetta la risposta.
 *
 * Una sola domanda alla volta: due frasi in volo insieme tornerebbero in
 * ordine sparso, e il filo della conversazione e' uno.
 */
export async function chiedi(testo) {
  const frase = clean(testo);
  if (!frase || state.inVolo) return false;
  const config = configurazione();
  const adesso = Date.now();
  const richiesta = domandaPerHomeAssistant({
    testo: frase,
    lingua: config.lingua || activeLocale(),
    agente: config.agente,
    conversazione: filoDaMandare(state.filo, state.ultimo, adesso),
  });
  if (!richiesta) return false;
  aggiungi("io", frase);
  state.inVolo = true;
  disegna();
  try {
    const risultato = await chiediAHomeAssistant(richiesta, 20000);
    const risposta = rispostaDi(risultato);
    state.filo = risposta.conversazione || state.filo;
    state.ultimo = Date.now();
    const parola = risposta.muta
      ? t("Fatto.", "Done.")
      : risposta.testo;
    aggiungi("casa", parola, { errore: risposta.errore });
    leggi(parola);
    return !risposta.errore;
  } catch (errore) {
    /* Il messaggio di Home Assistant e' la sola spiegazione che chi guarda
     * puo' capire; senza, si dice almeno che la casa non ha risposto. */
    aggiungi("casa", clean(errore?.message) || t("La casa non ha risposto.", "The house did not answer."), {
      errore: true,
    });
    return false;
  } finally {
    state.inVolo = false;
    disegna();
  }
}

/* ── il microfono ───────────────────────────────────────────────────────── */

/** Comincia ad ascoltare; il secondo tocco smette. */
export function ascolta() {
  const Motore = motoreDellaVoce();
  if (!Motore) return false;
  if (state.ascolto) {
    try {
      state.ascolto.stop();
    } catch (_errore) {}
    state.ascolto = null;
    disegna();
    return false;
  }
  let riconoscimento = null;
  try {
    riconoscimento = new Motore();
  } catch (_errore) {
    return false;
  }
  riconoscimento.lang = linguaPerIlMicrofono(activeLocale());
  /* Una frase per volta: si parla, si smette, si manda. Ascoltare in
   * continuazione vorrebbe dire un microfono aperto in casa, e nessuno l'ha
   * chiesto. */
  riconoscimento.continuous = false;
  riconoscimento.interimResults = true;
  riconoscimento.onresult = (evento) => {
    let frase = "";
    for (const voce of evento.results) frase += voce[0]?.transcript || "";
    const casella = doc?.querySelector?.("[data-dm-assist-testo]");
    if (casella) casella.value = frase;
    /* Solo quando il browser dice «questa e' definitiva»: mandare a ogni
     * risultato provvisorio vorrebbe dire tre domande per una frase. */
    if (evento.results[evento.results.length - 1]?.isFinal) {
      state.ascolto = null;
      if (casella) casella.value = "";
      chiedi(frase);
    }
  };
  riconoscimento.onerror = () => {
    state.ascolto = null;
    disegna();
  };
  riconoscimento.onend = () => {
    state.ascolto = null;
    disegna();
  };
  try {
    riconoscimento.start();
  } catch (_errore) {
    return false;
  }
  state.ascolto = riconoscimento;
  disegna();
  return true;
}

/* ── la finestra ────────────────────────────────────────────────────────── */

function battutaMarkup(battuta) {
  const mia = battuta.chi === "io";
  return `<div class="dm-assist-riga" data-chi="${mia ? "io" : "casa"}" data-errore="${battuta.errore === true}">
    <span class="dm-assist-bolla">${esc(battuta.testo)}</span>
  </div>`;
}

function corpoMarkup() {
  if (!state.battute.length)
    return `<div class="dm-assist-vuoto">
      <span aria-hidden="true">🗣️</span>
      <strong>${esc(t("Chiedi pure", "Just ask"))}</strong>
      <p>${esc(t("«Accendi la luce del salone», «quanti gradi ci sono in camera», «spegni tutto».", "“Turn on the living room light”, “how warm is the bedroom”, “turn everything off”."))}</p>
    </div>`;
  return state.battute.map(battutaMarkup).join("");
}

function finestra() {
  let modale = doc?.getElementById?.("dm-assist-modal");
  if (modale) return modale;
  if (!doc?.body) return null;
  modale = doc.createElement("div");
  modale.className = "modal-wrapper";
  modale.id = "dm-assist-modal";
  modale.innerHTML = `
    <div class="modal-card dm-assist-pannello" role="dialog" aria-modal="true" aria-labelledby="dm-assist-titolo">
      <div class="cfg-hero dm-assist-hero">
        <div class="cfg-hero-ico" aria-hidden="true">🗣️</div>
        <div class="cfg-hero-txt">
          <div class="cfg-hero-title" id="dm-assist-titolo">Assist</div>
          <div class="cfg-hero-sub">${esc(t("Chiedi a casa, scrivendo o parlando", "Ask the house, by typing or speaking"))}</div>
        </div>
        <button class="ev-waw-close" type="button" data-dm-assist-chiudi>${esc(t("Chiudi", "Close"))}</button>
      </div>
      <div class="dm-assist-corpo" data-dm-assist-corpo></div>
      <form class="dm-assist-riga-testo" data-dm-assist-form>
        <input class="ed-input dm-assist-casella" data-dm-assist-testo autocomplete="off"
          placeholder="${esc(t("Scrivi la tua domanda…", "Type your question…"))}"
          aria-label="${esc(t("La tua domanda", "Your question"))}">
        <button type="button" class="dm-assist-mic" data-dm-assist-mic hidden
          aria-label="${esc(t("Parla", "Speak"))}" title="${esc(t("Parla", "Speak"))}">🎙️</button>
        <button type="submit" class="dm-assist-manda" aria-label="${esc(t("Manda", "Send"))}" title="${esc(t("Manda", "Send"))}">➤</button>
      </form>
    </div>`;
  modale.addEventListener("click", (evento) => {
    if (evento.target === modale) chiudiAssist();
  });
  modale.querySelector("[data-dm-assist-chiudi]")?.addEventListener("click", () => chiudiAssist());
  modale.querySelector("[data-dm-assist-mic]")?.addEventListener("click", () => ascolta());
  modale.querySelector("[data-dm-assist-form]")?.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const casella = modale.querySelector("[data-dm-assist-testo]");
    const frase = clean(casella?.value);
    if (casella) casella.value = "";
    chiedi(frase);
  });
  doc.body.append(modale);
  return modale;
}

function disegna() {
  const modale = doc?.getElementById?.("dm-assist-modal");
  if (!modale) return;
  const corpo = modale.querySelector("[data-dm-assist-corpo]");
  if (corpo) {
    corpo.innerHTML =
      corpoMarkup() +
      (state.inVolo
        ? `<div class="dm-assist-riga" data-chi="casa"><span class="dm-assist-bolla dm-assist-attesa">…</span></div>`
        : "");
    /* L'ultima battuta e' quella che interessa: la finestra scorre da sola
     * invece di lasciare la risposta appena arrivata fuori dallo schermo. */
    corpo.scrollTop = corpo.scrollHeight;
  }
  const mic = modale.querySelector("[data-dm-assist-mic]");
  if (mic) {
    mic.hidden = !siPuoParlare();
    mic.dataset.ascolta = String(Boolean(state.ascolto));
  }
}

/** Apre la finestra di Assist. */
export function apriAssist() {
  const modale = finestra();
  if (!modale) return false;
  state.aperta = true;
  modale.classList.add("show");
  disegna();
  root.setTimeout?.(() => modale.querySelector("[data-dm-assist-testo]")?.focus?.(), 60);
  return true;
}

/** Chiude la finestra, e smette di ascoltare. */
export function chiudiAssist() {
  state.aperta = false;
  if (state.ascolto) {
    try {
      state.ascolto.stop();
    } catch (_errore) {}
    state.ascolto = null;
  }
  try {
    root.speechSynthesis?.cancel?.();
  } catch (_errore) {}
  doc?.getElementById?.("dm-assist-modal")?.classList.remove("show");
}

/* ── il tasto che la apre ───────────────────────────────────────────────── */

/* Assist non e' una pagina in cui si va: e' una cosa che si chiama, da dove si
 * e'. Il tasto galleggia in basso, sopra la barra, e sta zitto — un cerchio e
 * un'icona — perche' non deve rubare la scena a quello che c'e' sotto. */
function ensureTasto() {
  if (!doc?.body) return null;
  let tasto = doc.getElementById("dm-assist-tasto");
  if (!acceso()) {
    tasto?.remove();
    return null;
  }
  if (tasto) return tasto;
  tasto = doc.createElement("button");
  tasto.type = "button";
  tasto.id = "dm-assist-tasto";
  tasto.className = "dm-assist-tasto";
  tasto.textContent = "🗣️";
  tasto.setAttribute("aria-label", t("Apri Assist", "Open Assist"));
  tasto.title = t("Apri Assist", "Open Assist");
  tasto.addEventListener("click", () => apriAssist());
  doc.body.append(tasto);
  return tasto;
}

function installStyles() {
  installStyle(
    "dm-assist-style",
    `
    .dm-assist-tasto{position:fixed;right:16px;bottom:calc(96px + env(safe-area-inset-bottom,0px));z-index:9000;
      width:52px;height:52px;border:none;border-radius:50%;font-size:23px;cursor:pointer;
      background:linear-gradient(145deg,#0ea5e9,#0369a1);color:#fff;
      box-shadow:0 14px 30px -12px rgba(2,132,199,.7)}
    .dm-assist-tasto:hover{transform:translateY(-1px)}
    .dm-assist-tasto:focus-visible{outline:3px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 40%,transparent);outline-offset:3px}
    .dm-assist-pannello{max-width:520px;width:min(520px,100%);display:flex;flex-direction:column;max-height:min(78vh,720px)}
    .dm-assist-corpo{flex:1 1 auto;overflow-y:auto;display:grid;gap:8px;padding:14px 4px;min-height:180px}
    .dm-assist-vuoto{display:grid;gap:6px;justify-items:center;text-align:center;padding:26px 18px;color:var(--secondary-text-color,#64748b)}
    .dm-assist-vuoto span{font-size:32px}
    .dm-assist-vuoto strong{font-size:15px;font-weight:900;color:var(--text,#0f172a)}
    .dm-assist-vuoto p{margin:0;font-size:12px;font-weight:700;line-height:1.5}
    .dm-assist-riga{display:flex}
    .dm-assist-riga[data-chi="io"]{justify-content:flex-end}
    .dm-assist-bolla{max-width:82%;padding:10px 13px;border-radius:16px;font-size:13.5px;font-weight:650;line-height:1.45;
      background:var(--secondary-background-color,#eef3f8);color:var(--text,#0f172a);white-space:pre-wrap}
    .dm-assist-riga[data-chi="io"] .dm-assist-bolla{background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff}
    .dm-assist-riga[data-errore="true"] .dm-assist-bolla{background:color-mix(in srgb,#dc2626 12%,transparent);color:#b91c1c}
    .dm-assist-attesa{letter-spacing:3px;font-size:18px;opacity:.6}
    .dm-assist-riga-testo{display:flex;gap:8px;align-items:center;padding:10px 4px 4px;border-top:1px solid var(--divider-color,#dbe4ee)}
    .dm-assist-casella{flex:1 1 auto;min-width:0;margin:0}
    .dm-assist-mic,.dm-assist-manda{flex:0 0 44px;width:44px;height:44px;border:none;border-radius:14px;font-size:18px;cursor:pointer;
      background:var(--secondary-background-color,#eef3f8);color:var(--text,#0f172a)}
    .dm-assist-manda{background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff}
    .dm-assist-mic[data-ascolta="true"]{background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;animation:dm-assist-battito 1.1s ease-in-out infinite}
    @keyframes dm-assist-battito{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
    @media(prefers-reduced-motion:reduce){.dm-assist-mic[data-ascolta="true"]{animation:none}}
    `,
  );
}

export function installAssistSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  /* La fascia verde che accende e spegne Assist e' quella del guscio, e il
   * guscio dopo averla toccata chiama `cdApplyNavVis`: e' li' che si sente il
   * cambio, senza aspettare un ridisegno della plancia.
   *
   * Si prova a ogni avviso e non una volta sola: quando questo modulo si
   * installa il guscio puo' non aver ancora scritto quella funzione, e
   * `wrapFunction` in quel caso si rifiuta — come si rifiuta di avvolgere due
   * volte, che e' quello che rende innocuo riprovarci. */
  const senti = () => {
    wrapFunction("cdApplyNavVis", "__dmAssistTasto", () => ensureTasto());
    ensureTasto();
  };
  senti();
  /* Il tasto compare e sparisce con la sua fascia, e la configurazione puo'
   * arrivare da un altro dispositivo. */
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:config-changed",
  ])
    root.addEventListener?.(evento, senti);
  root.DashboardModernAssist = { apri: apriAssist, chiudi: chiudiAssist, chiedi };
  return true;
}
