/* Piu' momenti di irrigazione nella stessa giornata (#325).
 *
 * «Vorrei impostare piu' momenti di irrigazione. Ad esempio una alle 05:30 del
 * mattino e alle 20:30 dopo una giornata di caldo intenso se la % del sensore
 * umidita' terreno e' inferiore ad una certa % parte una seconda irrigazione di
 * tot minuti definiti dall'utente. Se invece la % e' superiore ad un certo dato
 * viene saltata.»
 *
 * Il primo orario resta quello del runtime (`cd_irrigazione.time`, un campo
 * solo, con un padrone solo): qui si aggiungono gli altri, e si mettono tutti
 * in fila cosi' che a decidere «tocca a questo» ci sia un conto unico. Ogni
 * orario porta con se' due cose facoltative: quanti minuti deve durare quella
 * corsa e sotto quale umidita' del terreno ha senso farla.
 *
 * Qui non c'e' DOM ne' localStorage ne' orologio di sistema: entra l'ora,
 * escono le decisioni, cosi' si prova a secco.
 */

const clean = (value) => String(value ?? "").trim();

/** L'ora scritta come la scrive un `<input type="time">`. */
export const FORMA_ORARIO = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** L'orario di sempre, quello che il runtime mette se non c'e' niente. */
export const ORARIO_PREDEFINITO = "06:30";

/** La chiave del primo orario: e' quella che il runtime scrive da sempre. */
export const CHIAVE_PRINCIPALE = "principale";

/* Quanto tardi si puo' ancora partire.
 *
 * L'orologio del browser di un telefono non e' un timer di sistema: la scheda
 * sospesa si sveglia in ritardo, e un confronto secco «sono le 20:30» perde la
 * corsa per sempre. Dieci minuti di tolleranza recuperano il risveglio tardivo
 * senza far partire l'acqua a mezzanotte. */
export const FINESTRA_MINUTI = 10;

/** Quanti minuti sono passati da mezzanotte, o `null` se non e' un'ora. */
export function minutiDelGiorno(ora) {
  const testo = clean(ora);
  const pezzi = FORMA_ORARIO.exec(testo);
  if (!pezzi) return null;
  return Number(pezzi[1]) * 60 + Number(pezzi[2]);
}

function numero(value) {
  if (value === null || value === undefined || clean(value) === "") return null;
  const convertito = Number(value);
  return Number.isFinite(convertito) ? convertito : null;
}

function percentuale(value) {
  const convertito = numero(value);
  if (convertito == null) return null;
  return Math.max(0, Math.min(100, convertito));
}

function durata(value) {
  const convertito = numero(value);
  if (convertito == null || convertito <= 0) return null;
  // Mezzo minuto non e' un'irrigazione, otto ore non e' una plancia: la
  // forbice tiene fuori lo zero-virgola e il refuso da tastiera.
  return Math.max(1, Math.min(480, Math.round(convertito)));
}

/* Un orario in piu', ripulito. Senza ora valida non esiste. */
export function orarioNormalizzato(riga, principale = false) {
  const ora = clean(riga?.ora ?? riga?.time ?? riga);
  // Mezzanotte vale zero minuti: il controllo e' su «non e' un'ora», non sul
  // valore, o le 00:00 sparirebbero dall'elenco.
  if (minutiDelGiorno(ora) == null) return null;
  return costruisci(ora, riga, principale);
}

function costruisci(ora, riga, principale) {
  return {
    ora,
    minuti: durata(riga?.minuti ?? riga?.mins),
    seSottoA: percentuale(riga?.seSottoA ?? riga?.soilBelow),
    principale: Boolean(principale),
    chiave: principale ? CHIAVE_PRINCIPALE : ora,
  };
}

/* Tutti i momenti della giornata, in ordine e senza doppioni.
 *
 * Il primo e' quello del runtime; gli altri stanno in `orari`, che e' roba
 * nostra. Se qualcuno riscrive lo stesso orario due volte ne resta uno: due
 * corse identiche allo stesso minuto sono un errore di battitura, non una
 * richiesta. */
export function orariDelProgramma(config = {}) {
  const principale = orarioNormalizzato({ ora: clean(config.time) || ORARIO_PREDEFINITO }, true);
  const elenco = principale ? [principale] : [];
  const righe = Array.isArray(config.orari) ? config.orari : [];
  for (const riga of righe) {
    const orario = orarioNormalizzato(riga);
    if (orario && !elenco.some((altro) => altro.ora === orario.ora)) elenco.push(orario);
  }
  return elenco.sort((uno, altro) => minutiDelGiorno(uno.ora) - minutiDelGiorno(altro.ora));
}

/** Solo le ore, per scriverle in card: `["06:30", "20:30"]`. */
export function elencoDegliOrari(orari) {
  return (Array.isArray(orari) ? orari : []).map((orario) => orario.ora);
}

/* Tocca a qualcuno, adesso?
 *
 * Si guarda in ordine di orologio e si risponde al primo che ha qualcosa da
 * dire. `corse` dice quali chiavi hanno gia' avuto il loro giro oggi, e
 * `giorno` e' la giornata di riferimento (una stringa qualunque, purche' la
 * stessa che si e' scritta dopo la partenza).
 *
 * Gli esiti:
 *   avvia            — si parte
 *   terreno-bagnato  — l'umidita' e' sopra la soglia della riga: oggi si salta
 *   senza-lettura    — la riga ha una condizione ma il sensore tace: si aspetta
 *
 * Il chiamante scrive la giornata SOLO su «avvia» e «terreno-bagnato»: la
 * decisione e' presa in entrambi i casi. Su «senza-lettura» no, perche' la
 * lettura puo' ancora arrivare dentro la finestra. */
export function orarioDaAvviare({
  orari = [],
  adesso = 0,
  giorno = "",
  corse = {},
  umidita = null,
  finestra = FINESTRA_MINUTI,
} = {}) {
  const minutiAdesso = Number(adesso);
  if (!Number.isFinite(minutiAdesso)) return null;
  for (const orario of orari) {
    const suo = minutiDelGiorno(orario.ora);
    if (suo == null) continue;
    if (corse?.[orario.chiave] === giorno && giorno !== "") continue;
    // Non ancora, o troppo tardi: la finestra e' quella del risveglio, non un
    // recupero a fine giornata.
    if (minutiAdesso < suo || minutiAdesso > suo + finestra) continue;
    if (orario.seSottoA != null) {
      const lettura = percentuale(umidita);
      if (lettura == null) return { orario, esito: "senza-lettura" };
      if (lettura >= orario.seSottoA) return { orario, esito: "terreno-bagnato", lettura };
      return { orario, esito: "avvia", lettura };
    }
    return { orario, esito: "avvia" };
  }
  return null;
}

/* Fra quanti minuti tocca al prossimo, per dormire fino a li'.
 *
 * Serve a non tenere un timer che si sveglia ogni mezzo minuto per non fare
 * niente: se il prossimo momento e' fra sei ore, si dorme. Se e' gia' passato
 * (nessun altro oggi) si risponde con l'attesa fino al primo di domani. */
export function minutiAlProssimo(orari, adesso) {
  const minutiAdesso = Number(adesso);
  if (!Array.isArray(orari) || !orari.length || !Number.isFinite(minutiAdesso)) return null;
  let migliore = null;
  for (const orario of orari) {
    const suo = minutiDelGiorno(orario.ora);
    if (suo == null) continue;
    const attesa = suo >= minutiAdesso ? suo - minutiAdesso : suo + 1440 - minutiAdesso;
    if (migliore == null || attesa < migliore) migliore = attesa;
  }
  return migliore;
}
