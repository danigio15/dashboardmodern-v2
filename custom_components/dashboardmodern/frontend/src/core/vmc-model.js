/* La ventilazione meccanica controllata (#371).
 *
 * «Sarebbe bellissimo avere nei climate la possibilita' di inserire i dati
 * delle 4 temperature delle macchine VMC per la ventilazione meccanica…
 * compresi i bypass, modalita' estate/inverno ecc.»
 *
 * Una VMC non e' un termostato e non si racconta come tale: non ha un target e
 * non ha un acceso/spento che dica qualcosa. Ha DUE flussi d'aria che si
 * incrociano dentro uno scambiatore, e quattro temperature che li descrivono:
 *
 *   fuori ──[esterna]──▶ scambiatore ──[immissione]──▶ dentro casa
 *   fuori ◀─[espulsione]── scambiatore ◀──[ripresa]── dentro casa
 *
 * Le quattro non sono quattro numeri qualunque: messe cosi' dicono da sole se
 * la macchina sta facendo il suo lavoro. D'inverno l'aria entra a meno cinque e
 * arriva in casa a diciotto perche' se l'e' scaldata con quella che esce a
 * ventidue: la differenza fra quelle due e' il RECUPERO, ed e' l'unico numero
 * che dice se la macchina vale quello che costa. Nessuna card lo mostra, e si
 * calcola con i numeri che ci sono gia'.
 *
 * E' puro: entrano la configurazione e gli stati, esce la lettura. Le parole
 * per dirlo a schermo stanno nella sezione.
 */

const pulito = (valore) => String(valore ?? "").trim();
/* Gli stati con cui Home Assistant dice «non lo so». */
const MUTI = /^(unknown|unavailable|none|null|)$/i;

/** La chiave in cui vive la configurazione della VMC. */
export const CHIAVE_VMC = "cd_vmc";

/* Un tetto: quattro macchine sono gia' un palazzo, non una casa. */
export const MASSIMO_VMC = 4;

/* Le quattro temperature, nell'ordine in cui si leggono: da fuori verso casa e
 * da casa verso fuori. `verso` dice a quale dei due flussi appartiene, ed e'
 * quello che permette di disegnarle incrociate invece che in colonna. */
export const TEMPERATURE = Object.freeze([
  Object.freeze({ chiave: "esterna", verso: "entra", posto: "prima", glifo: "🌡️" }),
  Object.freeze({ chiave: "immissione", verso: "entra", posto: "dopo", glifo: "➡️" }),
  Object.freeze({ chiave: "ripresa", verso: "esce", posto: "prima", glifo: "🏠" }),
  Object.freeze({ chiave: "espulsione", verso: "esce", posto: "dopo", glifo: "⬅️" }),
]);

/* Le pastiglie che dicono in che modo sta lavorando: sono `binary_sensor`, e
 * ognuna ha un verso — il bypass APERTO e' una notizia, il filtro DA CAMBIARE
 * e' un avviso, l'estate accesa e' solo la stagione. */
export const INTERRUTTORI = Object.freeze([
  Object.freeze({ chiave: "bypass", glifo: "🔀" }),
  Object.freeze({ chiave: "estate", glifo: "☀️" }),
  Object.freeze({ chiave: "filtri", glifo: "🧽", avvisa: true }),
]);

/* Le ventole e i livelli: numeri che si leggono e basta. */
export const NUMERI = Object.freeze([
  Object.freeze({ chiave: "ventola_immissione", glifo: "🌀" }),
  Object.freeze({ chiave: "ventola_espulsione", glifo: "🌀" }),
  Object.freeze({ chiave: "livello_immissione", glifo: "📶" }),
  Object.freeze({ chiave: "livello_ripresa", glifo: "📶" }),
]);

/** Tutte le caselle di una macchina, in un elenco solo. */
export const CAMPI_VMC = Object.freeze([
  "clima",
  ...TEMPERATURE.map((voce) => voce.chiave),
  ...INTERRUTTORI.map((voce) => voce.chiave),
  ...NUMERI.map((voce) => voce.chiave),
]);

const numero = (valore) => {
  const letto = Number.parseFloat(valore);
  return Number.isFinite(letto) ? letto : null;
};

export function normalizzaVmc(input = {}, indice = 0) {
  const grezzo = input && typeof input === "object" ? input : {};
  const unita = {
    id: pulito(grezzo.id) || `vmc-${indice + 1}`,
    nome: pulito(grezzo.nome ?? grezzo.name),
    stanza: pulito(grezzo.stanza ?? grezzo.room ?? grezzo.room_id),
  };
  for (const campo of CAMPI_VMC) unita[campo] = pulito(grezzo[campo]);
  return unita;
}

/** L'elenco delle macchine, senza doppioni di identificativo. */
export function normalizzaVmcTutte(input = []) {
  const elenco = Array.isArray(input) ? input : input && typeof input === "object" ? [input] : [];
  const visti = new Set();
  const fuori = [];
  for (const [indice, voce] of elenco.entries()) {
    const unita = normalizzaVmc(voce, indice);
    let id = unita.id;
    let scarto = 2;
    while (visti.has(id)) id = `${unita.id}-${scarto++}`;
    visti.add(id);
    fuori.push({ ...unita, id });
    if (fuori.length >= MASSIMO_VMC) break;
  }
  return fuori;
}

/** Le macchine che hanno qualcosa da mostrare: almeno una casella piena. */
export function vmcDisegnabili(input = []) {
  return normalizzaVmcTutte(input).filter((unita) =>
    CAMPI_VMC.some((campo) => pulito(unita[campo])),
  );
}

/** Tutte le entita' nominate, senza doppioni. */
export function entitaDellaVmc(input = []) {
  const viste = new Set();
  for (const unita of normalizzaVmcTutte(input))
    for (const campo of CAMPI_VMC) if (unita[campo].includes(".")) viste.add(unita[campo]);
  return [...viste];
}

/* ── quello che si legge ──────────────────────────────────────────────── */

function letturaNumero(entita, states) {
  const id = pulito(entita);
  if (!id) return null;
  const stato = states?.[id];
  const grezzo = pulito(stato?.state);
  const muto = !stato || MUTI.test(grezzo);
  return {
    entita: id,
    muto,
    valore: muto ? null : numero(grezzo),
    unita: pulito(stato?.attributes?.unit_of_measurement),
  };
}

function letturaInterruttore(entita, states) {
  const id = pulito(entita);
  if (!id) return null;
  const stato = states?.[id];
  const grezzo = pulito(stato?.state);
  const muto = !stato || MUTI.test(grezzo);
  return { entita: id, muto, acceso: muto ? null : /^(on|true|open|aperto|si|yes)$/i.test(grezzo) };
}

/**
 * Il recupero di calore, in centesimi.
 *
 * E' quanto della differenza fra dentro e fuori la macchina riesce a
 * riprendersi: `(immissione - esterna) / (ripresa - esterna)`. Vale d'inverno
 * come d'estate, perche' e' un rapporto fra differenze e non guarda il segno.
 *
 * Torna `null` quando il conto non vuol dire niente, e sono due casi veri:
 * un dato che manca, e mezza stagione. A ottobre dentro e fuori stanno a due
 * gradi di distanza, il denominatore e' quasi zero e il risultato salta fra il
 * dieci e il duecento per cento a ogni aggiornamento: un numero che balla non
 * e' un'informazione, e' rumore. Sotto i tre gradi di differenza non si dice.
 */
export const SALTO_MINIMO = 3;

export function recuperoDiCalore(esterna, immissione, ripresa) {
  const fuori = numero(esterna);
  const dentro = numero(ripresa);
  const mandata = numero(immissione);
  if (fuori === null || dentro === null || mandata === null) return null;
  const salto = dentro - fuori;
  if (Math.abs(salto) < SALTO_MINIMO) return null;
  const quota = ((mandata - fuori) / salto) * 100;
  if (!Number.isFinite(quota)) return null;
  /* Oltre il cento per cento non e' recupero: e' una batteria che scalda, o un
   * sensore messo nella casella sbagliata. Si taglia invece di stampare 140. */
  return Math.max(0, Math.min(100, Math.round(quota)));
}

/**
 * Quello che una macchina deve dire, adesso.
 *
 * Le temperature escono nell'ordine dei due flussi, cosi' chi disegna le mette
 * incrociate senza doverci pensare.
 */
export function letturaVmc(unita = {}, states = {}) {
  const sua = normalizzaVmc(unita, 0);
  const temperature = {};
  for (const voce of TEMPERATURE) {
    const lettura = letturaNumero(sua[voce.chiave], states);
    if (lettura) temperature[voce.chiave] = { ...lettura, ...voce };
  }
  const interruttori = {};
  for (const voce of INTERRUTTORI) {
    const lettura = letturaInterruttore(sua[voce.chiave], states);
    if (lettura) interruttori[voce.chiave] = { ...lettura, ...voce };
  }
  const numeri = {};
  for (const voce of NUMERI) {
    const lettura = letturaNumero(sua[voce.chiave], states);
    if (lettura) numeri[voce.chiave] = { ...lettura, ...voce };
  }
  const gradi = (chiave) =>
    temperature[chiave] && !temperature[chiave].muto ? temperature[chiave].valore : null;
  const recupero = recuperoDiCalore(gradi("esterna"), gradi("immissione"), gradi("ripresa"));
  const avvisi = [];
  if (interruttori.filtri && !interruttori.filtri.muto && interruttori.filtri.acceso === true)
    avvisi.push({ chiave: "filtri_da_cambiare", gravita: "attenzione" });
  return {
    id: sua.id,
    nome: sua.nome,
    stanza: sua.stanza,
    clima: sua.clima,
    temperature,
    interruttori,
    numeri,
    recupero,
    /* Il bypass aperto vuol dire che l'aria salta lo scambiatore: d'estate e'
     * quello che si vuole, e la card lo dice invece di lasciar credere che il
     * recupero sia crollato. */
    bypassAperto: interruttori.bypass?.acceso === true,
    estate: interruttori.estate?.acceso === true,
    avvisi,
  };
}

/** Se una macchina ha davvero qualcosa da mostrare, adesso. */
export function vmcParla(lettura) {
  const voci = [
    ...Object.values(lettura?.temperature || {}),
    ...Object.values(lettura?.interruttori || {}),
    ...Object.values(lettura?.numeri || {}),
  ];
  return voci.some((voce) => voce && !voce.muto);
}
