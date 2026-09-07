/* Le macchine del server e la rete di casa (#382).
 *
 * «Volevo chiedere se nei prossimi aggiornamenti si può aggiungere i controlli
 * del server proxmox dove gira HA con tutti i suoi container e controllare lo
 * stato del fritbox e i suoi ripeter.»
 *
 * Sono due elenchi, e li dichiara Home Assistant senza che nessuno debba
 * scriverli a mano:
 *
 *   · le MACCHINE — le VM e i container di Proxmox — sono `binary_sensor` con
 *     `device_class: running`, ed è l'integrazione Proxmox VE a metterceli;
 *   · la RETE — il router e i suoi ripetitori — sono `binary_sensor` con
 *     `device_class: connectivity`, ed è l'integrazione FritzBox (come ogni
 *     altra integrazione di rete) a metterceli.
 *
 * Due classi, due elenchi, e nessuna casella da compilare per cominciare: è la
 * stessa scelta del fumo, dell'aria e dei varchi. La configurazione serve solo
 * a correggere — togliere quello che non c'entra, aggiungere quello che nessuno
 * ha etichettato, dare un nome leggibile a «pve_qemu_103».
 *
 * Il COMANDO è la parte delicata. Un container si accende e si spegne solo se
 * Home Assistant offre qualcosa che sappia farlo, e nessuno può dedurlo dal
 * sensore: qui si guarda se esiste un interruttore o una coppia di pulsanti
 * che si chiamano come lui, e solo allora si offrono i tasti. Se non c'è, si
 * mostra lo stato e basta — un tasto che non fa niente è peggio di nessun
 * tasto.
 */

const clean = (valore) => String(valore ?? "").trim();

/** Dove si scrive la configurazione. */
export const CHIAVE_MACCHINE = "cd_macchine";

/** Le due famiglie, con la classe che Home Assistant usa per dichiararle. */
export const FAMIGLIE = Object.freeze({
  macchine: { classe: "running", glifo: "📦" },
  rete: { classe: "connectivity", glifo: "📶" },
});

const MUTI = new Set(["unavailable", "unknown", "none", ""]);
const ACCESI = new Set(["on", "true", "home", "connected", "running", "open"]);

/** La configurazione, ripulita: escluse, aggiunte (con la loro famiglia), nomi. */
export function normalizzaMacchine(stored) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const escluse = (Array.isArray(dato.escluse) ? dato.escluse : [])
    .map(clean)
    .filter((entity) => entity.includes("."));
  const aggiunte = {};
  for (const [entity, famiglia] of Object.entries(
    dato.aggiunte && typeof dato.aggiunte === "object" ? dato.aggiunte : {},
  )) {
    const id = clean(entity);
    const quale = clean(famiglia);
    if (id.includes(".") && FAMIGLIE[quale]) aggiunte[id] = quale;
  }
  const nomi = {};
  for (const [entity, nome] of Object.entries(
    dato.nomi && typeof dato.nomi === "object" ? dato.nomi : {},
  )) {
    const id = clean(entity);
    const scritto = clean(nome);
    if (id.includes(".") && scritto) nomi[id] = scritto;
  }
  return { escluse: [...new Set(escluse)], aggiunte, nomi };
}

/**
 * A quale famiglia appartiene questa entità: `"macchine"`, `"rete"` o `""`.
 *
 * Lo dice la classe che Home Assistant le ha dato, e lo dice chi ha la casa:
 * una esclusa non è di nessuna famiglia, una aggiunta è di quella che le si è
 * detta anche se Home Assistant non la dichiara.
 */
export function famigliaDi(entity, stato, config) {
  const id = clean(entity);
  const scelte = normalizzaMacchine(config);
  if (scelte.escluse.includes(id)) return "";
  if (scelte.aggiunte[id]) return scelte.aggiunte[id];
  if (!id.startsWith("binary_sensor.")) return "";
  const classe = clean(stato?.attributes?.device_class);
  for (const [famiglia, dato] of Object.entries(FAMIGLIE))
    if (dato.classe === classe) return famiglia;
  return "";
}

/* Come sta: `"su"`, `"giu"` o `""` quando non risponde. Un container che non
 * risponde non è un container fermo — potrebbe essere il server a essere giù,
 * e dire «fermo» sarebbe una diagnosi inventata. */
export function comeSta(stato) {
  const grezzo = clean(stato?.state).toLowerCase();
  if (MUTI.has(grezzo)) return "";
  return ACCESI.has(grezzo) ? "su" : "giu";
}

/* Il nome dell'oggetto dentro l'entity_id, senza il suo dominio. */
const oggetto = (entity) => clean(entity).split(".").slice(1).join(".");

/**
 * I comandi di una macchina, se Home Assistant ne offre.
 *
 * Si cerca qualcosa che si chiami come lei: un `switch` con lo stesso nome
 * d'oggetto, oppure la coppia di pulsanti `_start` / `_stop` che l'integrazione
 * Proxmox crea accanto al sensore. Il nome del sensore spesso finisce per
 * `_status` o `_running`: quella coda si toglie prima di confrontare, perché
 * il pulsante non ce l'ha.
 *
 * Niente si inventa: se l'entità non esiste fra gli stati, il tasto non esce.
 */
export function comandiDellaMacchina(entity, states = {}) {
  const nome = oggetto(entity).replace(/_(status|state|running|acceso)$/i, "");
  if (!nome) return null;
  const c1 = `switch.${nome}`;
  if (states[c1]) return { tipo: "switch", entity: c1 };
  const avvia = `button.${nome}_start`;
  const ferma = `button.${nome}_stop`;
  if (states[avvia] && states[ferma]) return { tipo: "button", avvia, ferma };
  return null;
}

/**
 * Gli elenchi: le macchine e la rete, letti e ordinati.
 *
 * Prima quello che è giù — è la ragione per cui uno apre questa pagina — poi i
 * muti, e in fondo quello che va. Dentro ogni gruppo, per nome.
 */
export function macchineERete(states = {}, config, nomeDi = (entity) => entity) {
  const scelte = normalizzaMacchine(config);
  const elenchi = { macchine: [], rete: [] };
  for (const [entity, stato] of Object.entries(states || {})) {
    const famiglia = famigliaDi(entity, stato, config);
    if (!famiglia) continue;
    elenchi[famiglia].push({
      entity,
      famiglia,
      name: scelte.nomi[entity] || clean(nomeDi(entity)) || entity,
      glifo: FAMIGLIE[famiglia].glifo,
      stato: comeSta(stato),
      comandi: famiglia === "macchine" ? comandiDellaMacchina(entity, states) : null,
    });
  }
  const peso = (riga) => (riga.stato === "giu" ? 0 : riga.stato === "" ? 1 : 2);
  for (const famiglia of Object.keys(elenchi))
    elenchi[famiglia].sort((a, b) => peso(a) - peso(b) || a.name.localeCompare(b.name));
  return elenchi;
}

/** Il conto di un elenco: quanti su, quanti giù, quanti non rispondono. */
export function contoDelleMacchine(righe = []) {
  const tutte = Array.isArray(righe) ? righe : [];
  const su = tutte.filter((riga) => riga?.stato === "su");
  const muti = tutte.filter((riga) => !clean(riga?.stato));
  return {
    su: su.length,
    giu: tutte.length - su.length - muti.length,
    muti: muti.length,
    totale: tutte.length,
    fermi: tutte.filter((riga) => riga?.stato === "giu").map((riga) => clean(riga.name)),
  };
}

/** Se c'è qualcosa da mostrare in almeno una delle due famiglie. */
export function macchineConfigurate(states = {}, config) {
  const elenchi = macchineERete(states, config);
  return elenchi.macchine.length > 0 || elenchi.rete.length > 0;
}
