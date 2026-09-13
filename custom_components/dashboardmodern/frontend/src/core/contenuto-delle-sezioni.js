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
import { CHIAVE_PRESENZA } from "./presenza-in-casa.js";
import { CHIAVE_VARCHI } from "./varchi-di-casa.js";

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
  /* Gli animali (#358): una riga qualsiasi basta, perche' un animale puo'
   * vivere di solo nome e foto — la ciotola e la lettiera arrivano dopo, e la
   * sua scheda esiste gia' prima. */
  animali: Object.freeze({ chiavi: ["cd_animali"], righe: rigaQualsiasi }),
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

/* ── Le tre sezioni che non si compilano ──────────────────────────────────
 *
 * «Quando si parte da zero le sezioni sotto non devono rilevare
 *  automaticamente le cose e inserirle, per questo c'è la funzione in config
 *  che rileva automaticamente. Tutto deve partire senza nulla e le sezioni che
 *  non hanno entità valorizzate devono essere nascoste.»
 *
 * Varchi, Presenza e Batterie non hanno un elenco da riempire: l'elenco lo fa
 * Home Assistant col `device_class`, e la loro scheda del Config serve a
 * correggerlo — togliere un contatto che porta non è, aggiungerne uno che
 * nessuno ha etichettato, dare un nome a «Contact 4B». Per questo la regola
 * qui sopra non le governa: «cosa c'è dentro» per loro non vuol dire «cosa ha
 * scritto l'utente», perché non c'è niente da scrivere.
 *
 * E per questo comparivano nella barra di una plancia appena installata,
 * insieme alla Home e alla Configurazione e a nient'altro: la casa ha le porte
 * anche quando la plancia è vuota. Tre voci che nessuno ha chiesto, su una
 * plancia che doveva essere ancora tutta da fare.
 *
 * La regola che le riguarda è una sola, e sta nella semina: **nascono spente**.
 * Nascere è una cosa che succede una volta — a una plancia mai configurata —
 * e infatti una plancia già in uso non nasce: le sue voci restano dove sono,
 * perché chi ha i varchi in barra da mesi non deve perderli aggiornando.
 *
 * Da spente si riaccendono come si accende qualunque sezione: dicendo la
 * propria nella sua scheda del Config — un contatto aggiunto, uno tolto, un
 * nome dato, una soglia scelta — oppure con la fascia verde dell'elenco delle
 * sezioni. È `sceltaSullaSezione` a rispondere alla prima delle due.
 */

/** Le tre sezioni il cui elenco lo fa Home Assistant, non l'utente. */
export const SEZIONI_CHE_LEGGONO_LA_CASA = Object.freeze(["varchi", "presenza", "batterie"]);

/* I tre campi con cui si corregge un elenco rilevato: chi sta fuori, chi sta
 * dentro lo stesso, e come si chiama. Varchi e Presenza hanno la stessa
 * scheda perché è lo stesso problema, e quindi la stessa forma. */
function haCorrezioni(valore) {
  if (!valore || typeof valore !== "object" || Array.isArray(valore)) return false;
  const elenco = (campo) => Array.isArray(valore[campo]) && valore[campo].some(paresEntita);
  if (elenco("escluse") || elenco("aggiunte")) return true;
  const nomi = valore.nomi;
  return Boolean(nomi && typeof nomi === "object" && Object.keys(nomi).length);
}

/* Le batterie si correggono altrove: aggiunte e tolte stanno nei gruppi degli
 * avvisi — `cd_gruppi_extra`, `cd_gruppi_removed` — perché è lì che stavano
 * già, e un secondo elenco per la stessa casa si sarebbe scollato dal primo.
 * La soglia invece è tutta loro. */
function haCorrezioniSulleBatterie(leggi) {
  const nelGruppo = (mappa) =>
    Boolean(mappa && typeof mappa === "object" && Array.isArray(mappa.batt)) &&
    mappa.batt.some(paresEntita);
  if (nelGruppo(leggi("cd_gruppi_extra")) || nelGruppo(leggi("cd_gruppi_removed"))) return true;
  const soglia = leggi("cd_batterie");
  return Boolean(soglia && typeof soglia === "object" && Object.keys(soglia).length);
}

/**
 * Se l'utente ha detto la sua su una di queste tre sezioni.
 *
 * È la porta da cui una sezione nata spenta si riaccende: toccare la sua
 * scheda del Config è chiedere di vederla. Per ogni altra chiave risponde
 * `false`, che è la verità — di quelle non parla.
 */
export function sceltaSullaSezione(sezione, leggi) {
  if (sezione === "batterie") return haCorrezioniSulleBatterie(leggi);
  if (sezione === "varchi") return haCorrezioni(leggi(CHIAVE_VARCHI));
  if (sezione === "presenza") return haCorrezioni(leggi(CHIAVE_PRESENZA));
  return false;
}

/* E le sezioni che si governano da sé.
 *
 * Nel magazzino qui sopra non ci sono — la loro voce se la accendono e se la
 * spengono da sole, e due padroni sulla stessa voce litigherebbero — ma la
 * loro configurazione è configurazione lo stesso. Senza guardarle, chi ha solo
 * le sue sezioni, o solo i rifiuti, o solo l'UPS, risultava appena installato:
 * e allora le tre che leggono la casa gli sparivano aggiornando, che è
 * esattamente il danno che questa regola esiste per evitare.
 *
 * Chi dà una sezione nuova a se stessa scrive anche qui la sua chiave. */
const CHIAVI_DELLE_SEZIONI_CHE_SI_GOVERNANO = Object.freeze([
  "cd_allerte",
  "cd_assist",
  "cd_calendari",
  "cd_citofono",
  "cd_media_player",
  "cd_rifiuti",
  "cd_security_doors",
  "cd_sezioni_mie",
  "cd_stampanti",
  "cd_todo",
  "cd_ups",
]);

/* Qualcosa scritto, senza chiedere cosa: qui la domanda non è «questa sezione
 * ha entità dentro» — a quella risponde chi la governa — ma «qualcuno ha mai
 * messo mano a questa plancia». Una riga qualsiasi basta. `metadata` no: quello
 * se lo scrive il magazzino anche su una chiave vuota. */
function qualcosaScritto(valore) {
  if (Array.isArray(valore)) return valore.length > 0;
  if (valore && typeof valore === "object")
    return Object.keys(valore).some((chiave) => chiave !== "metadata");
  return typeof valore === "string" && valore.trim() !== "";
}

/**
 * Se questa plancia è già stata configurata da qualcuno.
 *
 * Serve a distinguere la plancia che nasce — dove le tre sezioni non devono
 * comparire — da quella che si sta solo aggiornando, dove sparire sarebbe una
 * perdita. La domanda non si può fare alla casa: le porte di Home Assistant
 * ci sono sempre, appena installata o da tre anni. Si fa alla plancia, ed è la
 * stessa risposta che accende le voci: c'è qualcosa, da qualche parte, che
 * qualcuno ha messo lì.
 */
export function planciaGiaConfigurata(leggi) {
  if (contenutoDelleSezioni(leggi).piene.size) return true;
  const luci = leggi("cd_luci");
  if (luci && typeof luci === "object" && Object.keys(luci).length) return true;
  const caselle = leggi("cd_entity_overrides");
  if (caselle && typeof caselle === "object" && Object.values(caselle).some(paresEntita))
    return true;
  if (CHIAVI_DELLE_SEZIONI_CHE_SI_GOVERNANO.some((chiave) => qualcosaScritto(leggi(chiave))))
    return true;
  return SEZIONI_CHE_LEGGONO_LA_CASA.some((sezione) => sceltaSullaSezione(sezione, leggi));
}
