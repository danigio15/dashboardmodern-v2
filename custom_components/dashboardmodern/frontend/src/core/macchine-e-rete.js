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
 * La classe da sola però non basta, ed è il difetto che questa parte corregge:
 * «la sezione mini pc porta in automatico tutte queste entità sotto che non si
 * eliminano e che non c'entrano nulla con quella sezione». `running` lo mette
 * Proxmox, ma anche la lavatrice, la stampante e il tagliaerba; `connectivity`
 * lo mette il FritzBox, ma anche ogni telefono, ogni tracker e ogni presa
 * Wi-Fi. In una casa vera sono decine, e toglierle una per una è un lavoro che
 * non finisce mai — appena si aggiunge un dispositivo, ricomincia.
 *
 * Quello che distingue un container dal ferro da stiro non sta nello stato:
 * sta in CHI ha creato l'entità. La classe dice di che tipo è, l'integrazione
 * dice di che cosa parla, e solo la seconda risponde alla domanda «è roba del
 * mio server?». Lo stato non la porta — la porta il registro di Home
 * Assistant, e la plancia se la fa dire dal comando `integrations/catalog`.
 *
 * Quindi: due classi per trovare i candidati, e le integrazioni scelte per
 * adottarli. Si spuntano una volta — «Proxmox VE», «FritzBox» — invece di
 * escludere trenta entità una alla volta, e un container nuovo entra da solo
 * mentre una lavatrice nuova resta fuori da sola. Finché non si è scelto
 * niente non si adotta niente: una sezione vuota si riempie in un gesto, una
 * piena di roba d'altri si svuota in trenta.
 *
 * Resta tutto il resto della configurazione, che serve a correggere: togliere
 * quello che non c'entra anche dentro un'integrazione scelta, aggiungere a
 * mano quello che nessuno ha etichettato, dare un nome leggibile a
 * «pve_qemu_103».
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

/**
 * La configurazione, ripulita: integrazioni scelte, escluse, aggiunte, nomi.
 *
 * `integrazioni` sono i domini da cui si adotta — `proxmoxve`, `fritz` — e
 * l'elenco vuoto vuol dire «nessuna»: è la differenza fra una sezione che
 * aspetta una spunta e una che si riempie di tutta la casa.
 */
export function normalizzaMacchine(stored) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const integrazioni = (Array.isArray(dato.integrazioni) ? dato.integrazioni : [])
    .map(clean)
    .filter(Boolean);
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
  return {
    integrazioni: [...new Set(integrazioni)].sort(),
    escluse: [...new Set(escluse)],
    aggiunte,
    nomi,
  };
}

/**
 * Le entità di cui bisogna sapere l'integrazione prima di decidere.
 *
 * Sono i `binary_sensor` con una delle due classi: quelli e nessun altro. La
 * plancia ne chiede il registro in una volta sola — chiederlo per tutta la
 * casa sarebbe leggere migliaia di righe per guardarne trenta.
 */
export function candidateDaChiedere(states = {}) {
  const classi = new Set(Object.values(FAMIGLIE).map((dato) => dato.classe));
  return Object.entries(states || {})
    .filter(
      ([entity, stato]) =>
        clean(entity).startsWith("binary_sensor.") &&
        classi.has(clean(stato?.attributes?.device_class)),
    )
    .map(([entity]) => clean(entity));
}

/**
 * A quale famiglia appartiene questa entità: `"macchine"`, `"rete"` o `""`.
 *
 * Lo dicono in tre: la classe che Home Assistant le ha dato, l'integrazione da
 * cui arriva — `piattaforme[entity]`, che viene dal registro — e chi ha la
 * casa. Una esclusa non è di nessuna famiglia; una aggiunta a mano è di quella
 * che le si è detta, anche se Home Assistant non la dichiara e anche se la sua
 * integrazione non è fra le scelte; tutte le altre entrano solo se la classe e
 * l'integrazione dicono di sì tutte e due.
 *
 * Integrazione sconosciuta vuol dire fuori: finché il registro non ha
 * risposto, la plancia non tira a indovinare. Meglio una fascia che compare un
 * attimo dopo che una piena di roba da togliere.
 */
export function famigliaDi(entity, stato, config, piattaforme) {
  const id = clean(entity);
  const scelte = normalizzaMacchine(config);
  if (scelte.escluse.includes(id)) return "";
  if (scelte.aggiunte[id]) return scelte.aggiunte[id];
  if (!id.startsWith("binary_sensor.")) return "";
  const dominio = clean(piattaforme?.[id]);
  if (!dominio || !scelte.integrazioni.includes(dominio)) return "";
  const classe = clean(stato?.attributes?.device_class);
  for (const [famiglia, dato] of Object.entries(FAMIGLIE))
    if (dato.classe === classe) return famiglia;
  return "";
}

/**
 * Le integrazioni fra cui scegliere, con quante entità porterebbe ognuna.
 *
 * È il menù dell'editor: «Proxmox VE — 12 macchine», «FritzBox — 4 di rete».
 * Si contano i candidati veri, quelli che quella spunta adotterebbe davvero,
 * perché un numero che promette più di quello che arriva è peggio di nessun
 * numero. Le escluse a mano non si contano: sono già state guardate e messe
 * fuori.
 */
export function integrazioniDaScegliere(states = {}, piattaforme, config, nomi = {}) {
  const scelte = normalizzaMacchine(config);
  const conti = new Map();
  for (const entity of candidateDaChiedere(states)) {
    if (scelte.escluse.includes(entity)) continue;
    const dominio = clean(piattaforme?.[entity]);
    if (!dominio) continue;
    const classe = clean(states[entity]?.attributes?.device_class);
    const famiglia = Object.keys(FAMIGLIE).find((quale) => FAMIGLIE[quale].classe === classe);
    if (!famiglia) continue;
    const riga = conti.get(dominio) || { dominio, nome: "", macchine: 0, rete: 0, totale: 0 };
    riga[famiglia] += 1;
    riga.totale += 1;
    conti.set(dominio, riga);
  }
  return [...conti.values()]
    .map((riga) => ({
      ...riga,
      nome: clean(nomi?.[riga.dominio]) || riga.dominio,
      scelta: scelte.integrazioni.includes(riga.dominio),
    }))
    .sort((a, b) => b.totale - a.totale || a.nome.localeCompare(b.nome));
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
export function macchineERete(
  states = {},
  config,
  nomeDi = (entity) => entity,
  piattaforme = null,
) {
  const scelte = normalizzaMacchine(config);
  const elenchi = { macchine: [], rete: [] };
  for (const [entity, stato] of Object.entries(states || {})) {
    const famiglia = famigliaDi(entity, stato, config, piattaforme);
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
export function macchineConfigurate(states = {}, config, piattaforme = null) {
  const elenchi = macchineERete(states, config, undefined, piattaforme);
  return elenchi.macchine.length > 0 || elenchi.rete.length > 0;
}
