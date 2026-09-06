/* Dove succede: la sezione e la parte, scelte da due tendine.
 *
 * «Puoi mettere nella creazione di ticket per bug un menu a tendina che
 * seleziona quale sezione della dashboard è incriminata e quale funzione, così
 * è più diretta la segnalazione.» Chi segnala descrive quello che ha visto, e
 * fa bene: dove sta la cosa vista lo sa la plancia, e chiederglielo con due
 * tendine costa un tocco a lui e risparmia un giro di domande a chi risponde.
 *
 * Le sezioni non si scrivono qui. Sono quelle che la persona ha davvero nella
 * barra — coi nomi che legge lei, nella sua lingua, comprese quelle che si e'
 * fatta da se' — e si leggono da li'. Un secondo elenco scritto a mano
 * direbbe «Piscina» a chi la piscina non ce l'ha, e prima o poi si
 * scorderebbe una sezione nuova.
 *
 * Le parti invece sono un vocabolario, e sta qui: per le sezioni che ne hanno
 * di proprie quelle, e per tutte le altre le cinque che valgono ovunque —
 * i dati, il disegno, un comando che non risponde, la configurazione, la
 * lentezza. In fondo c'e' sempre «Altro», perche' una tendina che non ha la
 * voce giusta fa scegliere quella sbagliata.
 *
 * Qui non c'e' DOM ne' parole: entra la chiave della sezione, escono gli
 * identificativi delle parti. Le parole che si leggono sullo schermo le mette
 * chi disegna, con le sue tredici lingue. Cosi' questo conto si prova a
 * secco.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** La voce che si sceglie quando nessuna delle altre e' quella giusta. */
export const ALTRO = "altro";

/** La voce che si sceglie quando non si sa dove sia successo. */
export const NON_LO_SO = "";

/* Le parti che valgono per qualunque sezione: sono i modi in cui una cosa
 * puo' andare storta, non le cose di quella sezione. */
const COMUNI = Object.freeze(["dati", "disegno", "comando", "configurazione", "lentezza"]);

/* E quelle di casa loro, per le sezioni che ne hanno. La chiave e' quella
 * della voce nella barra (`data-tab`), che e' la stessa che il guscio usa per
 * la pagina. */
const PROPRIE = Object.freeze({
  home: ["tessere", "persone", "azioni", "meteo"],
  energy: ["flussi", "report", "carichi", "costi"],
  ev: ["foto", "ricarica", "colonnina", "gomme"],
  clima: ["temperature", "comandi", "programmi"],
  tapparelle: ["apertura", "soglie", "verso"],
  luci: ["accensione", "colori", "gruppi"],
  security: ["allarme", "telecamere", "porte"],
  "appliances-main": ["programma", "consumi", "comandi"],
  irrigazione: ["programma", "terreno", "zone"],
  piscina: ["filtrazione", "valori"],
  allerte: ["fonti", "livelli"],
  calendario: ["eventi", "liste", "persone"],
  robot: ["pulizia", "stanze", "comandi"],
  animali: ["ciotola", "lettiera", "acqua"],
  server: ["risorse", "rete"],
  config: ["entita", "sezioni", "aspetto"],
});

/* Le parti di una sezione, in ordine: le sue, poi quelle che valgono per
 * tutte, poi «Altro». Qui escono gli identificativi: le parole che si leggono
 * sullo schermo le mette chi disegna, con le sue tredici lingue. */
export function partiDellaSezione(sezione) {
  const chiave = pulito(sezione).toLowerCase();
  const sue = PROPRIE[chiave] || [];
  return [...sue, ...COMUNI, ALTRO];
}

/** Se una parte scelta ha ancora senso per la sezione scelta. */
export function parteValida(sezione, parte) {
  const scelta = pulito(parte);
  if (!scelta) return true;
  return partiDellaSezione(sezione).includes(scelta);
}

/* Le sezioni da offrire, lette dalla barra.
 *
 * Entra l'elenco delle voci come le disegna il guscio — chiave e nome — e
 * escono ripulite e senza doppioni. Una voce senza chiave non esiste; una
 * senza nome prende la sua chiave, che e' brutto ma vero. */
export function sezioniOfferte(voci) {
  const viste = new Set();
  const fuori = [];
  for (const voce of Array.isArray(voci) ? voci : []) {
    const id = pulito(voce?.id).toLowerCase();
    if (!id || viste.has(id)) continue;
    viste.add(id);
    fuori.push({ id, nome: pulito(voce?.nome) || id });
  }
  return fuori;
}
