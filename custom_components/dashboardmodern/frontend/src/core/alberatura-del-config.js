/* L'alberatura del Config: chi sta con chi, e in che ordine.
 *
 * «Per cortesia mi organizzi le sezioni del config con criterio, vedo cose
 * mischiate in sezioni che non c'entrano nulla.»
 *
 * Il Config non aveva un'alberatura: aveva una fila sola di linguette. Diciotto
 * le scrive a mano il guscio storico, in un blocco di pulsanti; le altre
 * quattordici se le aggiungono i moduli da soli, e ognuno fa la stessa identica
 * cosa — si infila subito prima di «Runtime». Nessuno decideva l'ordine:
 * l'ordine era quello con cui i moduli si installano. Per questo si vedevano
 * cose mischiate — non c'era nessuno il cui mestiere fosse metterle in ordine.
 *
 * Questo elenco è quel qualcuno. Dice a quale famiglia appartiene ogni scheda
 * e in che posizione sta dentro la sua famiglia, e da qui lo legge chi disegna.
 * È l'unica risposta alla domanda «in che ordine si leggono», e sta scritta in
 * un posto solo: sparpagliata nei moduli, la risposta la si ricavava aprendoli
 * tutti e quattordici.
 *
 * ── Il criterio ──────────────────────────────────────────────────────────
 *
 * Una scheda è un luogo della casa o una cosa della plancia, mai due mestieri
 * nello stesso cassetto. Le famiglie sono sei della casa più una che casa non
 * è: il homelab, che è l'unica cosa qui dentro che non parla di stanze.
 *
 * Le posizioni sono distanziate di dieci apposta: una scheda nuova si infila
 * in mezzo senza toccare le altre.
 *
 * ── Cosa questo elenco NON fa ────────────────────────────────────────────
 *
 * Non sposta niente e non nasconde niente. Le linguette restano quelle che
 * sono, con i loro identificativi — `sez6` resta `sez6` — perché quegli
 * identificativi li conoscono i moduli, il guscio, le prove e i collegamenti
 * che la gente si è salvata. Qui si dice soltanto in che ordine stanno e sotto
 * quale insegna: il resto del riordino — gli editor innestati nelle schede
 * altrui, l'elenco unico degli interruttori — è lavoro che cambia il codice,
 * non l'ordine, e si fa un passo alla volta.
 *
 * È puro: nessun DOM, nessuna memoria, nessun orologio.
 */

const pulito = (valore) => String(valore ?? "").trim();

/**
 * Le famiglie, nell'ordine in cui si leggono.
 *
 * Prima la plancia — è la cosa che si configura per prima e quella a cui si
 * torna — poi la casa dal più grande al più piccolo, e in fondo il homelab.
 */
export const FAMIGLIE = Object.freeze([
  /* Tutto ciò che riguarda la plancia, non la casa. */
  Object.freeze({
    chiave: "plancia",
    glifo: "⚙️",
    it: "Plancia",
    en: "Dashboard",
  }),
  /* Tutto ciò che misura o muove kWh. */
  Object.freeze({
    chiave: "energia",
    glifo: "⚡",
    it: "Energia",
    en: "Energy",
  }),
  /* L'aria che si respira e l'acqua che scorre. */
  Object.freeze({
    chiave: "clima",
    glifo: "🌡️",
    it: "Clima e acqua",
    en: "Climate and water",
  }),
  /* Le stanze e quello che ci sta dentro. */
  Object.freeze({
    chiave: "casa",
    glifo: "🛋️",
    it: "Casa",
    en: "House",
  }),
  /* Chi entra, chi esce, cosa sorveglia. */
  Object.freeze({
    chiave: "sicurezza",
    glifo: "🛡️",
    it: "Sicurezza",
    en: "Security",
  }),
  /* Quello che la casa ti viene a dire. */
  Object.freeze({
    chiave: "avvisi",
    glifo: "🔔",
    it: "Avvisi",
    en: "Alerts",
  }),
  /* Il homelab: l'unica famiglia che non parla della casa. */
  Object.freeze({
    chiave: "macchine",
    glifo: "🖥️",
    it: "Macchine e rete",
    en: "Machines and network",
  }),
]);

/* Dove finisce una scheda che questo elenco non conosce — un modulo nuovo, o
 * uno che arriva da fuori. Non sparisce e non si mette in mezzo: va in fondo,
 * dietro a tutto quello che ha un posto. */
export const FAMIGLIA_IGNOTA = "casa";

/**
 * Ogni scheda del Config: a quale famiglia appartiene e in che posizione.
 *
 * Gli identificativi sono quelli veri, quelli che stanno in `data-tab`. I
 * commenti dicono cosa c'è dentro, perché `sez3` da solo non lo dice a nessuno.
 */
export const SCHEDE = Object.freeze({
  /* ── ⚙️ Plancia ─────────────────────────────────────────────────────── */
  visib: { famiglia: "plancia", posizione: 10 }, // Impostazioni, lingua, Assist
  sez0: { famiglia: "plancia", posizione: 20 }, // Home: i blocchi e il loro ordine
  todo: { famiglia: "plancia", posizione: 30 }, // 🧩 Widget della Home
  entita: { famiglia: "plancia", posizione: 40 }, // ⭐ Le tue entità
  mie: { famiglia: "plancia", posizione: 50 }, // ⭐ Le tue sezioni
  backup: { famiglia: "plancia", posizione: 60 }, // 💾 Backup e ripristino
  runtime: { famiglia: "plancia", posizione: 70 }, // 🩺 Diagnostica

  /* ── ⚡ Energia ─────────────────────────────────────────────────────── */
  sez1: { famiglia: "energia", posizione: 10 }, // Contatori, fasce, tariffe
  sez2: { famiglia: "energia", posizione: 20 }, // Auto elettrica, colonnina, evcc
  ups: { famiglia: "energia", posizione: 30 }, // UPS (#390)

  /* ── 🌡️ Clima e acqua ──────────────────────────────────────────────── */
  sez9: { famiglia: "clima", posizione: 10 }, // Clima: termostati, VMC
  sez7: { famiglia: "clima", posizione: 20 }, // Temperature delle stanze
  /* La scheda che il guscio chiama «Solare» ma che il suo modulo rinomina
   * «Gestione termica»: pompa solare, boiler, scaldabagno, caldaia, pressione
   * dell'acqua, valvola di sicurezza. Era finita sotto Energia al primo giro,
   * perche' la parola «solare» fa pensare ai pannelli sul tetto — ma li' non
   * ci sono kWh: c'e' l'acqua calda, che sta con l'aria che si respira. */
  sez3: { famiglia: "clima", posizione: 25 }, // Gestione termica: solare, scaldabagno, caldaia
  pool: { famiglia: "clima", posizione: 30 }, // Piscina
  irr: { famiglia: "clima", posizione: 40 }, // Irrigazione

  /* ── 🛋️ Casa ───────────────────────────────────────────────────────── */
  stanze: { famiglia: "casa", posizione: 10 },
  luci: { famiglia: "casa", posizione: 20 },
  tapp: { famiglia: "casa", posizione: 30 }, // Finestre e tapparelle
  appliances: { famiglia: "casa", posizione: 40 }, // Elettrodomestici
  media: { famiglia: "casa", posizione: 50 }, // Musica
  robot: { famiglia: "casa", posizione: 60 },
  /* Le stampanti (#469): stanno accanto al robot, che e' l'altra macchina di
   * casa che si guarda per sapere se ha finito. */
  stampanti: { famiglia: "casa", posizione: 65 },
  animali: { famiglia: "casa", posizione: 70 },
  people: { famiglia: "casa", posizione: 80 }, // Persone
  sez8: { famiglia: "casa", posizione: 90 }, // Azioni rapide e scene
  /* Le batterie (#398) stanno con la casa e non con gli avvisi: sono la
   * manutenzione delle cose che ci sono dentro — la serratura, il sensore, il
   * telecomando — non una notizia che arriva. */
  batterie: { famiglia: "casa", posizione: 100 },

  /* ── 🛡️ Sicurezza ──────────────────────────────────────────────────── */
  sez4: { famiglia: "sicurezza", posizione: 10 }, // Telecamere, sensori, centrali
  varchi: { famiglia: "sicurezza", posizione: 20 }, // Contatti di porte e finestre
  presenza: { famiglia: "sicurezza", posizione: 25 }, // Movimento e presenza
  doors: { famiglia: "sicurezza", posizione: 30 }, // Apri porte/cancelli

  /* ── 🔔 Avvisi ─────────────────────────────────────────────────────── */
  avvisi: { famiglia: "avvisi", posizione: 10 }, // Notifiche della plancia
  allerte: { famiglia: "avvisi", posizione: 20 }, // Meteo e protezione civile
  agenda: { famiglia: "avvisi", posizione: 30 },
  rifiuti: { famiglia: "avvisi", posizione: 40 },

  /* ── 🖥️ Macchine e rete ────────────────────────────────────────────── */
  sez6: { famiglia: "macchine", posizione: 10 }, // Server, container, rete
});

/** Di che famiglia è questa scheda. Una che non si conosce va in fondo. */
export function famigliaDellaScheda(id) {
  return SCHEDE[pulito(id)]?.famiglia || FAMIGLIA_IGNOTA;
}

/** Come si chiama una famiglia, nella lingua chiesta. */
export function famiglia(chiave) {
  return FAMIGLIE.find((voce) => voce.chiave === pulito(chiave)) || null;
}

/* Il peso di una scheda: prima la famiglia, poi il posto dentro la famiglia.
 *
 * Quello che questo elenco non conosce pesa più di tutto, e fra due sconosciute
 * decide l'ordine in cui sono arrivate — che è quello che c'era prima, e per
 * loro va ancora bene: meglio in fondo che in mezzo, e meglio ferme che a
 * saltare da un giro all'altro. */
const PESO_IGNOTO = 100000;

export function pesoDellaScheda(id, arrivo = 0) {
  const voce = SCHEDE[pulito(id)];
  if (!voce) return PESO_IGNOTO + arrivo;
  const famigliaIndice = FAMIGLIE.findIndex((riga) => riga.chiave === voce.famiglia);
  return (famigliaIndice < 0 ? FAMIGLIE.length : famigliaIndice) * 1000 + voce.posizione;
}

/**
 * Le schede date, rimesse in ordine di alberatura.
 *
 * `schede` è un elenco di identificativi nell'ordine in cui si trovano adesso.
 * Torna lo stesso elenco riordinato: stesse schede, nessuna persa e nessuna
 * inventata — riordinare non è filtrare.
 */
export function inOrdine(schede = []) {
  const arrivo = new Map();
  const ids = [];
  for (const voce of schede) {
    const id = pulito(voce);
    if (!id || arrivo.has(id)) continue;
    arrivo.set(id, arrivo.size);
    ids.push(id);
  }
  return ids
    .slice()
    .sort((a, b) => pesoDellaScheda(a, arrivo.get(a)) - pesoDellaScheda(b, arrivo.get(b)));
}

/**
 * Le famiglie che hanno davvero qualche scheda fra quelle date, in ordine, con
 * dentro le loro schede.
 *
 * Una famiglia senza schede non si disegna: un'insegna sopra il vuoto è una
 * promessa che non si mantiene. È quello che succede su una plancia dove metà
 * delle sezioni sono spente.
 */
export function famiglieConSchede(schede = []) {
  const ordinate = inOrdine(schede);
  const perFamiglia = new Map();
  for (const id of ordinate) {
    const chiave = famigliaDellaScheda(id);
    if (!perFamiglia.has(chiave)) perFamiglia.set(chiave, []);
    perFamiglia.get(chiave).push(id);
  }
  return FAMIGLIE.filter((voce) => perFamiglia.has(voce.chiave)).map((voce) => ({
    ...voce,
    schede: perFamiglia.get(voce.chiave),
  }));
}
