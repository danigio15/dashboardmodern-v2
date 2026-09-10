/* La tendina dei dispositivi del Report, con le icone di casa.
 *
 * «Le icone dei dispositivi nella sezione Report Analisi energia non sono del
 * nostro catalogo.» Ed e' vero, ma non perche' qualcuno abbia scelto le emoji:
 * quella lista era un `<select>` nativo, e un `<option>` non puo' contenere
 * niente di disegnato. La lista che si apriva la disegnava il telefono — su
 * Android una fila di righe grigie — e dentro ci stava l'unica cosa che ci puo'
 * stare, il carattere grezzo. Percio' lo stesso apparecchio portava l'icona
 * vestita di casa dappertutto e un'emoji nuda li'.
 *
 * Qui il `<select>` resta dov'e', e resta lui il padrone del valore: e' il
 * guscio storico a leggerlo — `document.getElementById('ed-dev-selector').value`
 * — e ad ascoltare il suo `change` per ricaricare il dettaglio. Non si tocca
 * niente di tutto quello. Sopra ci si mette un tasto disegnato da noi, che apre
 * il foglio di scelta della plancia con le icone del motore di casa; scegliere
 * scrive nel `<select>` e gli fa dire `change`, cioe' esattamente quello che
 * succedeva prima quando lo si toccava.
 *
 * E la faccia di ogni voce si va a prendere dal dispositivo, non dall'opzione:
 * l'emoji che sta scritta li' dentro il guscio ce l'ha gia' schiacciata lui,
 * proprio perche' in una `<option>` non ci sta altro, e ridisegnarla darebbe
 * un'altra emoji.
 *
 * Il `<select>` non si nasconde con `display:none`: resta al suo posto, largo
 * quanto il tasto, ma trasparente e senza eventi. Cosi' chi lo cerca con gli
 * strumenti di Home Assistant lo trova ancora, e la scheda mantiene la sua
 * altezza anche prima che il tasto sia disegnato.
 */
import { canonicalReportDevices } from "../core/energy-projection.js";
import { apriIlFoglioDiScelta, chiudiIlFoglioDiScelta } from "./foglio-di-scelta-section.js";
import { iconGlyphMarkup } from "./icon-engine-section.js";
import { clean, doc, esc, installStyle, root, section, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_REPORT_TENDINA__";
const state = (root[KEY] ||= { installed: false });

const SELETTORE = "ed-dev-selector";
const TASTO = "dm-report-tendina";
const STILE = "dm-report-tendina-style";

function installaLoStile() {
  installStyle(
    STILE,
    `
    .dm-report-tendina-cornice{position:relative!important;display:block!important;width:100%!important;min-width:0!important}
    .dm-report-tendina-cornice>#${SELETTORE}{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;opacity:0!important;pointer-events:none!important}
    .${TASTO}{display:grid!important;grid-template-columns:34px minmax(0,1fr) 20px!important;align-items:center!important;gap:10px!important;width:100%!important;min-height:52px!important;box-sizing:border-box!important;padding:8px 14px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:16px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important;color:var(--text,#0f172a)!important;font:inherit!important;font-weight:800!important;text-align:left!important;cursor:pointer!important}
    .${TASTO}-icona{display:grid!important;place-items:center!important;width:32px!important;height:32px!important;color:#0ea5e9!important}
    .${TASTO}-nome{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
    .${TASTO}-freccia{justify-self:end!important;font-size:18px!important;opacity:.55!important}
    .${TASTO}-elenco{display:flex!important;flex-direction:column!important;gap:6px!important}
    .${TASTO}-voce{display:grid!important;grid-template-columns:34px minmax(0,1fr)!important;align-items:center!important;gap:12px!important;width:100%!important;min-height:52px!important;padding:8px 12px!important;border:1px solid transparent!important;border-radius:14px!important;background:transparent!important;color:inherit!important;font:inherit!important;font-weight:750!important;text-align:left!important;cursor:pointer!important}
    .${TASTO}-voce[aria-selected="true"]{border-color:#0ea5e9!important;background:rgba(14,165,233,.10)!important}
    .${TASTO}-voce-icona{display:grid!important;place-items:center!important;width:32px!important;height:32px!important;color:#0ea5e9!important}
    html[data-theme="dark"] .${TASTO}{background:var(--card-background-color,#111827)!important;color:var(--text,#e5e7eb)!important}
    `,
  );
}

/* Le voci, con la faccia che quell'apparecchio ha in tutta la plancia.
 *
 * Il valore lo comanda sempre il `<select>`: le sue opzioni sono, alla lettera,
 * quello che si puo' scegliere. Quello che il `<select>` non puo' portare e' il
 * disegno, e la faccia si va a prendere da dove la prende la scheda — cioe' dal
 * `visual` del dispositivo.
 *
 * `ED_DEVICES.icon` non basta: e' gia' un'emoji, schiacciata li' dal guscio
 * perche' dentro una `<option>` non ci puo' stare altro. Ridisegnarla darebbe
 * di nuovo l'emoji, che e' esattamente la segnalazione. Il motore vuole il
 * NOME della cosa — `mdi:dishwasher`, `lavastoviglie` — e quello sta nel
 * `visual` che `canonicalReportDevices` gia' calcola per ogni voce del Report:
 * la stessa funzione che il guscio chiama per costruire questa lista, quindi
 * non c'e' una seconda regola da tenere allineata. L'emoji resta il ripiego
 * per una configurazione che non dice altro. */
function facceDeiDispositivi() {
  const facce = new Map();
  try {
    const dispositivi = canonicalReportDevices(section("appliances", []), section("loads", []));
    for (const voce of dispositivi) {
      const entita = clean(voce?.entity);
      if (!entita) continue;
      facce.set(entita, {
        nome: clean(voce?.name),
        /* L'ordine e' quello che il motore sa leggere: il nome scelto, poi il
         * tipo del disegno di casa, poi l'emoji. */
        icona: clean(
          (voce?.visual?.kind === "icon" && voce.visual.value) || voce?.visual_key || voce?.icon,
        ),
        foto: voce?.visual?.kind === "image" ? clean(voce.visual.value) : "",
      });
    }
  } catch (_errore) {
    /* Senza store — una prova, un guscio a meta' — restano le opzioni. */
  }
  return facce;
}

/* L'emoji che il guscio ha incollato davanti al nome, staccata dal nome.
 *
 * «Nel menù a tendina dei dispositivi la lavastoviglie ha due icone, una non
 * e' nostra: devi eliminarla da dove la pesca.» Da qui: l'opzione la scrive il
 * guscio come `<option>${d.icon} ${d.name}</option>`, quindi il suo testo
 * PORTA DENTRO l'emoji. Finche' il nome pulito si trova — nello store o in
 * `ED_DEVICES` — quel testo non lo legge nessuno; quando non si trova si
 * ricade su di lui, e allora accanto alla nostra icona ne compariva una
 * seconda, del telefono.
 *
 * Il ripiego resta, ma pulito: l'emoji si stacca e il nome va nel testo. E il
 * glifo staccato non si butta — e' l'ultima cosa che dice che apparecchio sia,
 * e il motore delle icone sa leggerlo — quindi diventa il suggerimento per
 * disegnare la NOSTRA.
 *
 * Si stacca solo un pittogramma vero, coi suoi modificatori: un nome che
 * comincia per cifra («3 Camere») non e' un'emoji e non si tocca. */
const EMOJI_DAVANTI = /^(?:\p{Extended_Pictographic}[\uFE0E\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]*)+\s*/u;

export function nomeSenzaEmoji(testo) {
  const scritto = clean(testo);
  const glifo = scritto.match(EMOJI_DAVANTI)?.[0] || "";
  return { glifo: clean(glifo), nome: clean(scritto.slice(glifo.length)) || scritto };
}

/* L'elenco vecchio del guscio, quando lo store non risponde: nome e sensore
 * separati, senza dover ritagliare l'emoji dal testo di una `<option>`. */
function vociDelGuscio() {
  const elenco = Array.isArray(root.ED_DEVICES) ? root.ED_DEVICES : [];
  const facce = new Map();
  for (const voce of elenco) {
    const entita = clean(voce?.sensor);
    if (entita) facce.set(entita, { nome: clean(voce?.name), icona: clean(voce?.icon), foto: "" });
  }
  return facce;
}

function vociDelSelettore(select) {
  const dalloStore = facceDeiDispositivi();
  const dalGuscio = vociDelGuscio();
  return [...(select?.options || [])]
    .map((opzione) => {
      const valore = clean(opzione.value);
      const faccia = dalloStore.get(valore) || dalGuscio.get(valore) || {};
      const dallOpzione = nomeSenzaEmoji(opzione.textContent);
      const nome = faccia.nome || dallOpzione.nome;
      return {
        valore,
        nome,
        icona: faccia.icona || nome || dallOpzione.glifo,
        foto: faccia.foto || "",
      };
    })
    .filter((voce) => voce.valore);
}

/* Il disegno di una voce: la foto scelta se ce n'e' una — la stessa che porta
 * la scheda — altrimenti il glifo del motore. */
function facciaDaScrivere(voce, misura) {
  if (voce?.foto)
    return `<img src="${esc(voce.foto)}" alt="" style="width:${misura}px;height:${misura}px;border-radius:8px;object-fit:cover">`;
  return iconGlyphMarkup("load", voce?.icona || voce?.nome, { size: misura });
}

function voceScelta(select) {
  const valore = clean(select?.value);
  return vociDelSelettore(select).find((voce) => voce.valore === valore) || null;
}

function disegnaIlTasto(select, tasto) {
  const scelta = voceScelta(select);
  /* Anche qui il ripiego e' il testo dell'opzione, e anche qui porta dentro
   * l'emoji del guscio: il tasto chiuso e la riga aperta dicono lo stesso
   * nome, quindi si puliscono nello stesso modo. */
  const nome = scelta?.nome || nomeSenzaEmoji(select?.selectedOptions?.[0]?.textContent).nome;
  tasto.querySelector(`.${TASTO}-icona`).innerHTML = facciaDaScrivere(scelta || { nome }, 30);
  tasto.querySelector(`.${TASTO}-nome`).textContent =
    nome || t("Seleziona un dispositivo", "Select a device");
  tasto.setAttribute(
    "aria-label",
    `${t("Dispositivo", "Device")}: ${nome || t("nessuno", "none")}`,
  );
}

function apriLElenco(select, tasto) {
  const corpo = apriIlFoglioDiScelta({
    titolo: t("Scegli il dispositivo", "Choose the device"),
    id: "dm-report-tendina-foglio",
  });
  if (!corpo) return;
  const scelto = clean(select.value);
  const elenco = doc.createElement("div");
  elenco.className = `${TASTO}-elenco`;
  elenco.setAttribute("role", "listbox");
  for (const voce of vociDelSelettore(select)) {
    const riga = doc.createElement("button");
    riga.type = "button";
    riga.className = `${TASTO}-voce`;
    riga.setAttribute("role", "option");
    riga.setAttribute("aria-selected", String(voce.valore === scelto));
    riga.innerHTML = `<span class="${TASTO}-voce-icona">${facciaDaScrivere(voce, 30)}</span><span>${esc(
      voce.nome || voce.valore,
    )}</span>`;
    riga.addEventListener("click", () => {
      chiudiIlFoglioDiScelta();
      if (clean(select.value) === voce.valore) return;
      select.value = voce.valore;
      /* Il valore lo legge il guscio, e il guscio si sveglia sul `change`: e'
       * lo stesso che succedeva toccando la tendina nativa. */
      select.dispatchEvent(new Event("change", { bubbles: true }));
      disegnaIlTasto(select, tasto);
    });
    elenco.append(riga);
  }
  corpo.append(elenco);
}

function vestiIlSelettore() {
  const select = doc?.getElementById?.(SELETTORE);
  if (!select) return false;
  installaLoStile();

  let tasto = select.parentElement?.querySelector?.(`.${TASTO}`);
  if (!tasto) {
    const cornice = doc.createElement("div");
    cornice.className = "dm-report-tendina-cornice";
    select.replaceWith(cornice);
    tasto = doc.createElement("button");
    tasto.type = "button";
    tasto.className = TASTO;
    tasto.setAttribute("aria-haspopup", "listbox");
    tasto.innerHTML = `<span class="${TASTO}-icona"></span><span class="${TASTO}-nome"></span><span class="${TASTO}-freccia" aria-hidden="true">⌄</span>`;
    cornice.append(tasto, select);
    tasto.addEventListener("click", () => apriLElenco(select, tasto));
    /* Il guscio riscrive le opzioni quando la configurazione cambia, e da li'
     * il `<select>` puo' portare un altro dispositivo: il tasto lo si rifa'
     * agganciando quella funzione — `buildReportSelect` — non
     * sorvegliando il documento. Un sorvegliante che guarda per sempre e' il
     * lavoro fatto senza che nessuno lo chieda, ed e' quello che questa plancia
     * non fa. */
    select.addEventListener("change", () => disegnaIlTasto(select, tasto));
  }
  disegnaIlTasto(select, tasto);
  return true;
}

export function installReportTendinaDispositiviSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  vestiIlSelettore();
  /* Chi riscrive le opzioni e' `buildReportSelect`: ci si mette in coda dopo di
   * lui e si rifa' il tasto. E' la stessa strada con cui tutti i moduli di
   * questa plancia stanno dietro al guscio — la sua funzione, non un
   * sorvegliante sul documento. */
  wrapFunction("buildReportSelect", "__dmReportTendina", vestiIlSelettore);
  /* La scheda del Report nasce quando si apre l'editor, non all'avvio: si
   * riprova quando la plancia dice che qualcosa e' cambiato. Quando il tasto
   * c'e' gia', questa e' una passata che non scrive niente. */
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, vestiIlSelettore);
  doc.addEventListener("click", () => root.queueMicrotask?.(vestiIlSelettore), true);
  return true;
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installReportTendinaDispositiviSection, { once: true });
} else {
  installReportTendinaDispositiviSection();
}
