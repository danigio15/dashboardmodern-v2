/* Una sezione vuota non sta nella barra.
 *
 * «tutte le sezioni devono nascere come nascoste, solo se si inserisce
 * entita' in una sezione diventa visibile.»
 *
 * Meta' della regola c'era gia' e funzionava: alla prima accensione il guscio
 * deriva `cd_sections` dal contenuto — undici voci spente su una plancia
 * appena installata — e la riparazione al salvataggio riaccende la sezione in
 * cui si e' appena messo qualcosa. Mancava l'altra meta'. Quella derivazione
 * corre **una volta sola per chiave**: una voce gia' scritta nella mappa non
 * viene piu' riguardata, e una sezione svuotata — o accesa da una versione che
 * accendeva tutto — resta nella barra per sempre, pagina vuota compresa.
 *
 * Qui sta il giudizio, in un posto solo: cosa riempie una sezione. Lo usano
 * tutti e due i versi — accendere quella piena, spegnere quella vuota — perche'
 * due elenchi che rispondono alla stessa domanda prima o poi rispondono in modo
 * diverso, e allora una sezione configurata sparisce.
 *
 * ── Le tre righe che non si toccano ──────────────────────────────────────
 *
 * **Home no.** E' la pagina dove si atterra e la strada per la
 * Configurazione: spegnerla su una casa non ancora configurata vuol dire una
 * plancia senza nessun posto dove arrivare.
 *
 * **Agenda, Continuita', Cruscotto e le sezioni che si fa l'utente no.**
 * Quelle quattro non hanno bisogno di questa regola perche' sono gia' cosi':
 * ognuna nasconde la propria voce da se' quando non ha niente dentro. Metterle
 * anche qui vorrebbe dire due padroni sulla stessa voce.
 *
 * **Una chiave che non sappiamo giudicare no.** Il pericolo di questa regola
 * non e' lasciare in barra una sezione vuota — quello si vede e si toglie. E'
 * spegnere una sezione **piena** perche' il suo contenuto sta in un posto che
 * questo elenco non conosce. Percio' `giudizio()` risponde `null` — «non lo
 * so» — per ogni chiave fuori dalla mappa, e chi non sa non spegne.
 */

import { sectionForEditorSlot } from "./editor-slots.js";
import { CHIAVE_ENTITA_MIE, sezioniConEntita } from "./entita-mie.js";

/** Un valore che somiglia a un'entita': `dominio.oggetto`. */
const paresEntita = (valore) => typeof valore === "string" && valore.trim().includes(".");

/* Qualcosa dentro: un'entita' scritta da qualche parte, a qualunque
 * profondita'. Le liste e gli oggetti si aprono; `metadata` no, perche' e'
 * roba che il magazzino scrive da se' anche quando la sezione e' vuota. */
export function qualcosaDentro(valore) {
  if (Array.isArray(valore)) return valore.some(qualcosaDentro);
  if (valore && typeof valore === "object")
    return Object.entries(valore).some(([chiave, figlio]) =>
      chiave === "metadata" ? false : qualcosaDentro(figlio),
    );
  return paresEntita(valore);
}

/** Una stanza che misura: e' questa la stanza che riempie Temperature. */
const stanzaCheMisura = (stanza) => paresEntita(stanza?.temp) || paresEntita(stanza?.hum);

/** Una riga qualsiasi: una stanza puo' vivere di solo nome e icona. */
const rigaQualsiasi = (riga) =>
  Boolean(riga && (typeof riga !== "object" || Object.keys(riga).length));

/* Cosa riempie ogni sezione: le chiavi del magazzino condiviso, e dove serve
 * la regola che dice quali righe contano.
 *
 * Chi aggiunge una chiave di configurazione a una di queste sezioni la scrive
 * anche qui. Dimenticarsene non rompe niente di visibile subito: rompe il
 * giorno in cui qualcuno configura **solo** quella chiave e si vede la sezione
 * sparire. La prova `una-sezione-piena-non-si-spegne` prende ogni riga di
 * questa mappa e verifica proprio quello. */
export const MAGAZZINO_DELLE_SEZIONI = Object.freeze({
  energy: Object.freeze({
    chiavi: [
      "cd_loads",
      "cd_energy_model",
      "cd_flow_nodes",
      "cd_subloads_extra",
      "cd_subload_groups",
      "cd_gruppi_extra",
      "cd_report_devices",
    ],
  }),
  appliances: Object.freeze({ chiavi: ["cd_appliances", "cd_lavatrice_programmi"] }),
  ev: Object.freeze({
    chiavi: ["cd_ev_cars", "cd_ev_visual", "cd_ev_meta"],
    testi: ["cd_ev_image"],
  }),
  boiler: Object.freeze({ chiavi: ["cd_caldaia", "cd_scaldabagni", "cd_impianti_termici"] }),
  /* Le porte non stanno piu' qui: dalla 1.4.5 si disegnano nella loro pagina,
   * che si accende e si spegne da sola. Contarle ancora come contenuto di
   * Sicurezza teneva in barra una scheda vuota a chi ha solo le porte. */
  security: Object.freeze({ chiavi: ["cd_cameras"] }),
  /* Il MiniPC si configura solo dalle caselle dell'editor: nessuna chiave sua,
   * e le entita' arrivano tutte da `cd_entity_overrides`. */
  server: Object.freeze({ chiavi: [] }),
  clima: Object.freeze({ chiavi: ["cd_clima_units", "cd_termico_caldo"] }),
  temp: Object.freeze({ chiavi: [], stanze: stanzaCheMisura }),
  tapparelle: Object.freeze({ chiavi: ["cd_tapparelle"] }),
  piscina: Object.freeze({ chiavi: ["cd_piscina"] }),
  irrigazione: Object.freeze({ chiavi: ["cd_irrigazione"] }),
  stanze: Object.freeze({ chiavi: ["cd_stanze_entita"], stanze: rigaQualsiasi }),
  luci: Object.freeze({ chiavi: ["cd_luci"] }),
  prese: Object.freeze({ chiavi: ["cd_prese"], righe: rigaQualsiasi }),
  robot: Object.freeze({ chiavi: ["cd_robot"], righe: rigaQualsiasi }),
});

/** Le sezioni su cui questa regola ha voce in capitolo. */
export const sezioniGovernate = () => Object.keys(MAGAZZINO_DELLE_SEZIONI);

function chiaveHaRoba(valore, regola) {
  if (valore === null || valore === undefined) return false;
  if (Array.isArray(valore)) return valore.some(regola?.righe || qualcosaDentro);
  if (typeof valore === "object") {
    if (regola?.righe) return Object.values(valore).some(regola.righe);
    /* `cd_luci` e' `{ "light.salone": "Salone" }`: la luce sta nella chiave,
     * non nel valore, e cercarla solo fra i valori direbbe «vuota». */
    return Object.keys(valore).some(paresEntita) || qualcosaDentro(valore);
  }
  return paresEntita(valore);
}

/* Le sezioni piene e quelle vuote, lette dal magazzino.
 *
 * `leggi(chiave)` restituisce il valore gia' interpretato, o `null`. E' un
 * argomento e non una lettura diretta perche' cosi' la regola si puo' provare
 * su un magazzino finto senza montare mezza plancia. */
export function contenutoDelleSezioni(leggi) {
  const piene = new Set();
  const stanze = leggi("cd_stanze");
  const righeStanze = Array.isArray(stanze) ? stanze : [];

  for (const [sezione, regola] of Object.entries(MAGAZZINO_DELLE_SEZIONI)) {
    if (regola.stanze && righeStanze.some(regola.stanze)) piene.add(sezione);
    for (const chiave of regola.chiavi) if (chiaveHaRoba(leggi(chiave), regola)) piene.add(sezione);
    for (const chiave of regola.testi || [])
      if (String(leggi(chiave) || "").trim()) piene.add(sezione);
  }

  /* Le caselle dell'editor: la mappa casella → sezione e' la stessa che usano
   * il disegno e il salvataggio, cosi' una casella nuova non ha bisogno di
   * essere ricordata due volte. */
  const caselle = leggi("cd_entity_overrides");
  if (caselle && typeof caselle === "object")
    for (const [casella, valore] of Object.entries(caselle)) {
      if (!paresEntita(valore)) continue;
      const sezione = sectionForEditorSlot(String(casella));
      if (sezione && MAGAZZINO_DELLE_SEZIONI[sezione]) piene.add(sezione);
    }

  /* Le entita' che uno si aggiunge dove vuole: stanno in una chiave sola, con
   * dentro la sezione a cui appartengono. Senza questo giro una sezione che
   * vive solo di quelle risultava vuota, e il salvataggio dell'entita' appena
   * aggiunta la toglieva dalla barra — proprio la sezione dove la si era
   * appena messa. */
  for (const sezione of sezioniConEntita(leggi(CHIAVE_ENTITA_MIE)))
    if (MAGAZZINO_DELLE_SEZIONI[sezione]) piene.add(sezione);

  const vuote = new Set(sezioniGovernate().filter((sezione) => !piene.has(sezione)));
  return { piene, vuote };
}

/** Piena, vuota, o «non lo so» per una chiave che questa regola non governa. */
export function giudizio(sezione, leggi) {
  if (!MAGAZZINO_DELLE_SEZIONI[sezione]) return null;
  return contenutoDelleSezioni(leggi).piene.has(sezione);
}
