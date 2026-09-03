/* Il motore di analisi delle finestre.
 *
 * Cosa risolve. Fino a ieri la finestra di una tessera diceva una frase presa
 * da un ripiego generico: contava le righe, contava quante erano «accese» e
 * scriveva «4 cose, nessuna in funzione». Su una sezione fatta di cose che si
 * accendono e si spengono ha un senso; sulle altre no, e le altre erano dieci
 * su diciassette. L'Energia scriveva «4 cose, nessuna in funzione» mentre il
 * fotovoltaico faceva 2,16 kW — le sue quattro righe sono casa, solare, rete
 * e batteria, che non sono cose accese o spente. La Sicurezza scriveva «Qui
 * non c'e' ancora niente» con l'antifurto elencato subito sotto, perche' il
 * suo antifurto non e' una riga. Non erano frasi imprecise: erano frasi che
 * parlavano di un'altra cosa.
 *
 * Come funziona. Ogni sezione ha la sua lettura, scritta sui dati che quella
 * sezione ha davvero: l'Energia ragiona sul bilancio fra produzione, consumo,
 * batteria e rete; la Temperatura sulla distanza fra la stanza piu' calda e
 * la piu' fredda; l'Irrigazione su quali zone stanno bagnando e da quanto.
 * Dove il dato non c'e' non si inventa niente e non si scrive una riga vuota:
 * si dice di meno.
 *
 * Cosa restituisce: un tono, una frase e dei punti. La frase e' la riga
 * grande, quella che si legge; i punti sono le cose precise che la
 * sostengono, e stanno sotto in piccolo. Il tono decide il colore della
 * pillola — verde quando non c'e' niente da fare, ambra quando qualcosa sta
 * lavorando adesso, rosso quando qualcuno deve guardarci.
 *
 * Perche' e' qui e non nel modulo che disegna. Non tocca il documento: si
 * prova con i numeri, senza browser. Una frase che conta male e' sbagliata
 * senza rompersi, e a occhio non si vede — l'unico modo di accorgersene e'
 * pretendere il testo giusto a partire da dati noti, ed e' quello che fa
 * `tests/lanalisi-delle-sezioni.test.js`.
 *
 * Sulla parola «intelligenza». Qui non c'e' un modello di linguaggio e non ci
 * si parla: e' un motore di regole che legge i numeri. La scelta e'
 * deliberata e vale la pena dirla. Una finestra si apre e deve rispondere
 * subito, sempre uguale a se stessa e senza sbagliare un conto; un modello
 * remoto ci mette secondi, costa a ogni apertura, manda fuori casa i dati
 * della casa e sui numeri e' proprio dove sbaglia. Le frasi qui sotto sono
 * scritte a mano ma i numeri dentro sono calcolati, quindi dicono sempre la
 * cosa vera. Se un giorno si vorra' un commento in prosa da un agente di
 * conversazione di Home Assistant, il posto dove innestarlo e'
 * `commentoInPiu`: arriva dopo, e se non arriva la finestra sta in piedi
 * lo stesso.
 */

import { daQuanto, fraQuanto, numero, VERDETTI } from "./racconto-tessera.js";
import { letturaNelTempo, SOGLIE_INSOLITO } from "./modello-nel-tempo.js";

const IN_ITALIANO = (italiano) => italiano;

/* ── attrezzi ──────────────────────────────────────────────────────────── */

/* `Number(null)` fa zero, e uno zero e' una misura: senza questo controllo una
 * stanza senza sensore di umidita' entrava nella media come 0%, e un'auto senza
 * lettura della carica diventava un'auto al 12% da guardare. Un dato che manca
 * non e' un dato che vale zero. */
const num = (valore) => {
  if (valore == null || valore === "") return null;
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

const pulito = (valore) => String(valore ?? "").trim();

/* Watt leggibili: sotto il migliaio l'intero, sopra i kW con due decimali. */
function watt(valore, lingua = "it-IT") {
  const n = num(valore);
  if (n == null) return "—";
  const assoluto = Math.abs(n);
  if (assoluto >= 1000) return `${numero(n / 1000, 2, lingua)} kW`;
  return `${numero(n, 0, lingua)} W`;
}

/* La lingua per i numeri arriva da fuori, non si indovina.
 *
 * Qui si chiedeva a `tr("it","en")` chi fosse: in italiano torna «it», in
 * inglese «en», e in tedesco torna quello che c'e' nel catalogo — quindi si
 * finiva su «en-US», e una finestra tedesca mescolava un titolo «1,25 kW» con
 * un'analisi «1.25 kW». Chi chiama la lingua ce l'ha: la passa. */
const lingua = (tr, dichiarata) => dichiarata || (tr("it", "en") === "en" ? "en-US" : "it-IT");

/* Il piu' grande e il piu' piccolo di un elenco, per campo. */
function estremi(righe, campo) {
  const buone = righe.filter((r) => num(r?.[campo]) != null);
  if (!buone.length) return null;
  const ordinate = [...buone].sort((a, b) => num(a[campo]) - num(b[campo]));
  return { minimo: ordinate[0], massimo: ordinate[ordinate.length - 1] };
}

const media = (valori) => {
  const buoni = valori.map(num).filter((v) => v != null);
  return buoni.length ? buoni.reduce((s, v) => s + v, 0) / buoni.length : null;
};

const nomeDi = (riga) =>
  pulito(riga?.name) || pulito(riga?.nome) || pulito(riga?.entity) || pulito(riga?.id);

/* Un elenco di nomi che non diventa mai un muro: due e poi «e altri». */
function elenco(nomi, tr) {
  const buoni = nomi.filter(Boolean);
  if (!buoni.length) return "";
  if (buoni.length === 1) return buoni[0];
  if (buoni.length === 2) return buoni.join(tr(" e ", " and "));
  return `${buoni.slice(0, 2).join(", ")}${tr(" e altri", " and others")}`;
}

/* Da quanto va avanti, quando il dato c'e'. */
function daQuandoDelleRighe(righe, adesso) {
  const momenti = righe
    .map((r) => Number(r?.daQuando))
    .filter((q) => Number.isFinite(q) && q > 0 && q <= adesso);
  return momenti.length ? (adesso - Math.max(...momenti)) / 60000 : null;
}

/* Quando finisce la carica dell'auto, con la STESSA formula della pagina EV:
 * i punti percentuali che mancano al traguardo, la capacita' assunta di 70
 * kWh, la potenza del caricatore. Cosi' la finestra del widget e la pagina
 * dicono la stessa ora. La potenza arriva com'e' scritta nel sensore: sopra
 * 100 la si legge in watt, altrimenti in kilowatt — e' la lettura del guscio. */
const CAPACITA_ASSUNTA_KWH = 70;

function oraDelPieno(tessera, adesso, linguaDeiNumeri) {
  const carica = num(tessera?.ring);
  const potenza = num(tessera?.ricaricaKw);
  if (carica == null || potenza == null || potenza <= 0) return null;
  const grezzo = num(tessera?.targetSoc);
  const traguardo = grezzo != null && grezzo > 0 && grezzo <= 100 ? Math.round(grezzo) : 100;
  if (carica >= traguardo) return null;
  const kw = potenza > 100 ? potenza / 1000 : potenza;
  const ore = ((traguardo - carica) * CAPACITA_ASSUNTA_KWH) / 100 / kw;
  /* Oltre due giorni non e' una previsione, e' un numero a caso: si tace. */
  if (!Number.isFinite(ore) || ore <= 0 || ore > 48) return null;
  const fine = new Date(adesso + ore * 3600 * 1000);
  let ora;
  try {
    ora = new Intl.DateTimeFormat(linguaDeiNumeri || "it", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(fine);
  } catch (_errore) {
    ora = `${String(fine.getHours()).padStart(2, "0")}:${String(fine.getMinutes()).padStart(2, "0")}`;
  }
  return { ora, traguardo };
}

/* ── le letture, una per sezione ───────────────────────────────────────── */

/* Ognuna riceve (tr, tessera, adesso) e torna {tono, frase, punti}.
 * `punti` puo' essere vuoto: sotto la frase non compare niente. */
const LETTURE = Object.freeze({
  /* L'Energia non e' un elenco di cose accese: e' un bilancio. Chi produce,
   * chi consuma, e dove finisce la differenza. */
  energia: (tr, tessera) => {
    const l = lingua(tr, tessera?.lingua);
    const di = (gruppo) => num(tessera?.rows?.find((r) => r?.group === gruppo)?.watts);
    const casa = di("house");
    const sole = di("solar");
    const rete = di("grid");
    const batteria = di("battery");
    const punti = [];

    if (casa == null && sole == null)
      return {
        tono: VERDETTI.bene,
        frase: tr("Non c'e' ancora niente da leggere.", "Nothing to read yet."),
        punti,
      };

    const oggi = num(tessera?.today);
    if (oggi != null)
      punti.push(
        tr(`Da mezzanotte ${numero(oggi, 1, l)} kWh`, `${numero(oggi, 1, l)} kWh since midnight`),
      );

    /* La batteria: positiva vuol dire che sta dando corrente a casa,
     * negativa che si sta caricando. E' la convenzione del flusso, e detta
     * a parole toglie l'ambiguita' del segno — nella finestra si leggeva
     * «Batteria -1,47 kW» e nessuno e' tenuto a sapere cosa vuol dire. */
    if (batteria != null && Math.abs(batteria) >= 10)
      punti.push(
        batteria < 0
          ? tr(
              `La batteria si carica a ${watt(-batteria, l)}`,
              `Battery charging at ${watt(-batteria, l)}`,
            )
          : tr(`La batteria copre ${watt(batteria, l)}`, `Battery covering ${watt(batteria, l)}`),
      );

    if (rete != null && Math.abs(rete) >= 10)
      punti.push(
        rete < 0
          ? tr(`In rete vanno ${watt(-rete, l)}`, `${watt(-rete, l)} exported to the grid`)
          : tr(`Dalla rete arrivano ${watt(rete, l)}`, `${watt(rete, l)} drawn from the grid`),
      );

    /* La frase grande e' il rapporto fra quello che si produce e quello che
     * si consuma: e' la cosa che si vuole sapere aprendo l'Energia. */
    if (sole != null && sole > 20 && casa != null) {
      if (sole >= casa) {
        const avanzo = sole - casa;
        return {
          tono: VERDETTI.bene,
          frase:
            avanzo < 50
              ? tr(
                  `Il sole copre esattamente la casa: ${watt(sole, l)}.`,
                  `Solar exactly covers the house: ${watt(sole, l)}.`,
                )
              : tr(
                  `Il sole fa ${watt(sole, l)} e la casa ne usa ${watt(casa, l)}: ne avanzano ${watt(avanzo, l)}.`,
                  `Solar is making ${watt(sole, l)} against ${watt(casa, l)} used: ${watt(avanzo, l)} to spare.`,
                ),
          punti,
        };
      }
      const quota = Math.round((sole / casa) * 100);
      return {
        tono: VERDETTI.corso,
        frase: tr(
          `Il sole copre ${quota}% dei ${watt(casa, l)} che sta usando la casa.`,
          `Solar covers ${quota}% of the ${watt(casa, l)} the house is using.`,
        ),
        punti,
      };
    }

    /* Manca la lettura della casa, non quella del sole.
     *
     * Qui si diceva «il sole non produce» ogni volta che il sensore della casa
     * era irraggiungibile — anche col fotovoltaico a due chilowatt, perche' il
     * ramo del bilancio piu' sopra pretende di conoscere tutti e due i numeri e
     * questo raccoglieva quello che avanzava. Dire che il sole e' fermo quando
     * si sa che non lo e' e' la bugia peggiore fra quelle possibili qui: chi
     * legge chiude la finestra convinto di avere un impianto guasto. */
    if (casa == null)
      return {
        tono: VERDETTI.bene,
        /* Qui `sole` c'e' sempre: se mancasse anche lui, il ramo piu' in alto
         * avrebbe gia' detto che non c'e' niente da leggere. */
        frase:
          sole > 20
            ? tr(
                `Il sole fa ${watt(sole, l)}. Il consumo della casa non si legge.`,
                `The sun is making ${watt(sole, l)}. The house consumption is unavailable.`,
              )
            : tr("Il sole non produce.", "No solar production."),
        punti,
      };
    return {
      tono: VERDETTI.bene,
      frase:
        sole == null || sole <= 20
          ? tr(
              `La casa usa ${watt(casa, l)}, senza sole.`,
              `The house is using ${watt(casa, l)}, no sun.`,
            )
          : tr(`La casa usa ${watt(casa, l)}.`, `The house is using ${watt(casa, l)}.`),
      punti,
    };
  },

  /* Il fotovoltaico dentro il solare termico: sonde e pompa. */
  solare: (tr, tessera, adesso) => {
    const l = lingua(tr, tessera?.lingua);
    const righe = Array.isArray(tessera?.rows) ? tessera.rows : [];
    const pompa = tessera?.attiva === true;
    /* Il grado si legge dal campo grezzo, non dal testo: il testo e' «68°», e
     * `Number("68°")` non e' un numero. Le righe di questa sezione portano
     * `raw` accanto a `value` proprio per questo. */
    const gradoDi = (r) => num(r?.raw ?? r?.temperature);
    /* Il Delta non e' una sonda: e' gia' una differenza, e a -3° farebbe da
     * «piu' fredda» a ogni lettura. Ne' lo sono la pressione o la potenza, che
     * un numero grezzo ce l'hanno. Chi costruisce le righe marchia le sonde
     * vere con `sonda: true`; una riga senza marchio si tratta da sonda,
     * perche' e' cosi' che sono fatte le righe semplici delle prove e delle
     * tessere costruite a mano — dove di misure ce n'e' una sola. */
    const gradi = righe.filter((r) => gradoDi(r) != null && r?.sonda !== false);
    const punti = [];
    const estremo = estremi(
      gradi.map((r) => ({ ...r, gradi: gradoDi(r) })),
      "gradi",
    );
    if (estremo && estremo.massimo !== estremo.minimo) {
      punti.push(
        tr(
          `La piu' calda e' ${nomeDi(estremo.massimo)} a ${numero(estremo.massimo.gradi, 1, l)}°`,
          `Hottest is ${nomeDi(estremo.massimo)} at ${numero(estremo.massimo.gradi, 1, l)}°`,
        ),
      );
      punti.push(
        tr(
          `La piu' fredda ${nomeDi(estremo.minimo)} a ${numero(estremo.minimo.gradi, 1, l)}°`,
          `Coldest ${nomeDi(estremo.minimo)} at ${numero(estremo.minimo.gradi, 1, l)}°`,
        ),
      );
    }
    if (!gradi.length)
      return {
        tono: pompa ? VERDETTI.corso : VERDETTI.bene,
        frase: pompa
          ? tr("La pompa sta girando.", "The pump is running.")
          : tr("La pompa e' ferma.", "The pump is idle."),
        punti,
      };
    if (!estremo)
      return {
        tono: VERDETTI.bene,
        frase: tr("Nessuna sonda risponde.", "No probe responding."),
        punti,
      };
    const salto = estremo.massimo.gradi - estremo.minimo.gradi;
    if (pompa) {
      /* «La pompa e' accesa» e' gia' scritto nel colore del cerchio. Quello che
       * aggiunge qualcosa e' da quanto: Home Assistant sa da quando quello
       * stato non cambia, e quel momento cambia solo quando la pompa parte o
       * si ferma. */
      const minuti = daQuandoDelleRighe(
        righe.filter((r) => r?.on === true),
        adesso,
      );
      return {
        tono: VERDETTI.corso,
        frase:
          minuti == null
            ? tr(
                `La pompa gira: ${numero(salto, 1, l)}° di salto fra il pannello e l'accumulo.`,
                `Pump running: ${numero(salto, 1, l)}° between panel and store.`,
              )
            : tr(
                `La pompa gira ${daQuanto(minuti, tr)}: ${numero(salto, 1, l)}° di salto fra il pannello e l'accumulo.`,
                `Pump running ${daQuanto(minuti, tr)}: ${numero(salto, 1, l)}° between panel and store.`,
              ),
        punti,
      };
    }
    return {
      tono: VERDETTI.bene,
      frase: tr(
        `Pompa ferma, ${numero(salto, 1, l)}° di salto fra la sonda piu' calda e la piu' fredda.`,
        `Pump idle, ${numero(salto, 1, l)}° between the hottest and coldest probe.`,
      ),
      punti,
    };
  },

  /* La Sicurezza non ha righe: ha un antifurto e degli ingressi. */
  sicurezza: (tr, tessera) => {
    const porte = Array.isArray(tessera?.doors) ? tessera.doors : [];
    const punti = [];
    if (porte.length)
      punti.push(
        tr(
          `${porte.length} ingress${porte.length === 1 ? "o sorvegliato" : "i sorvegliati"}`,
          `${porte.length} monitored entrance${porte.length === 1 ? "" : "s"}`,
        ),
      );
    if (tessera?.triggered)
      return {
        tono: VERDETTI.guarda,
        frase: tr("L'antifurto sta suonando.", "The alarm is going off."),
        punti,
      };
    if (!tessera?.alarm)
      return {
        tono: VERDETTI.bene,
        frase: porte.length
          ? tr(
              `Nessun antifurto configurato, ${porte.length} ingressi sorvegliati.`,
              `No alarm configured, ${porte.length} entrances monitored.`,
            )
          : tr("Non c'e' un antifurto configurato.", "No alarm configured."),
        punti: [],
      };
    if (tessera?.armed)
      return {
        tono: VERDETTI.corso,
        frase: tr("L'antifurto e' inserito.", "The alarm is armed."),
        punti,
      };
    return {
      tono: VERDETTI.bene,
      frase: tr("L'antifurto e' disinserito.", "The alarm is disarmed."),
      punti,
    };
  },

  /* La Temperatura: la media da sola non dice niente, la differenza si'. */
  temperatura: (tr, tessera) => {
    const l = lingua(tr, tessera?.lingua);
    const righe = (Array.isArray(tessera?.rows) ? tessera.rows : []).filter(
      (r) => num(r?.temperature) != null,
    );
    if (!righe.length)
      return {
        tono: VERDETTI.bene,
        frase: tr("Nessuna sonda risponde.", "No probe responding."),
        punti: [],
      };
    const estremo = estremi(righe, "temperature");
    const mediaGradi = media(righe.map((r) => r.temperature));
    const punti = [];
    const umidita = media(righe.map((r) => r.humidity));
    if (umidita != null)
      punti.push(
        tr(`Umidita' media ${Math.round(umidita)}%`, `Average humidity ${Math.round(umidita)}%`),
      );
    if (righe.length === 1)
      return {
        tono: VERDETTI.bene,
        frase: tr(
          `${nomeDi(righe[0])} e' a ${numero(righe[0].temperature, 1, l)}°.`,
          `${nomeDi(righe[0])} is at ${numero(righe[0].temperature, 1, l)}°.`,
        ),
        punti,
      };
    const salto = num(estremo.massimo.temperature) - num(estremo.minimo.temperature);
    punti.push(
      tr(
        `La piu' fredda e' ${nomeDi(estremo.minimo)} a ${numero(estremo.minimo.temperature, 1, l)}°`,
        `Coldest is ${nomeDi(estremo.minimo)} at ${numero(estremo.minimo.temperature, 1, l)}°`,
      ),
    );
    return {
      tono: VERDETTI.bene,
      frase: tr(
        `Media ${numero(mediaGradi, 1, l)}° su ${righe.length} stanze, ${numero(salto, 1, l)}° fra la piu' calda (${nomeDi(estremo.massimo)}) e la piu' fredda.`,
        `${numero(mediaGradi, 1, l)}° average across ${righe.length} rooms, ${numero(salto, 1, l)}° between the warmest (${nomeDi(estremo.massimo)}) and the coldest.`,
      ),
      punti,
    };
  },

  elettrodomestici: (tr, tessera, adesso) => {
    const l = lingua(tr, tessera?.lingua);
    const righe = Array.isArray(tessera?.rows) ? tessera.rows : [];
    const accesi = righe.filter((r) => pulito(r?.mode) === "running");
    const punti = [];
    const potenza = accesi.reduce((s, r) => s + (num(r?.watts) || 0), 0);
    if (potenza > 10)
      punti.push(tr(`Insieme fanno ${watt(potenza, l)}`, `Together they draw ${watt(potenza, l)}`));
    const minuti = daQuandoDelleRighe(accesi, adesso);
    if (minuti != null)
      punti.push(
        tr(`Il piu' recente da ${daQuanto(minuti, tr)}`, `Latest one ${daQuanto(minuti, tr)}`),
      );
    if (!righe.length)
      return {
        tono: VERDETTI.bene,
        frase: tr("Non ce n'e' nessuno configurato.", "None configured."),
        punti: [],
      };
    if (!accesi.length)
      return {
        tono: VERDETTI.bene,
        frase: tr(`Tutti fermi, ${righe.length} in tutto.`, `All idle, ${righe.length} in total.`),
        punti: [],
      };
    return {
      tono: VERDETTI.corso,
      frase: tr(
        `${elenco(accesi.map(nomeDi), tr)} in funzione, su ${righe.length}.`,
        `${elenco(accesi.map(nomeDi), tr)} running, out of ${righe.length}.`,
      ),
      punti,
    };
  },

  telecamere: (tr, tessera) => {
    const righe = Array.isArray(tessera?.rows) ? tessera.rows : [];
    if (!righe.length)
      return {
        tono: VERDETTI.bene,
        frase: tr("Nessuna telecamera configurata.", "No cameras configured."),
        punti: [],
      };
    return {
      tono: VERDETTI.bene,
      frase: tr(
        `${righe.length} telecamer${righe.length === 1 ? "a" : "e"}: ${elenco(righe.map(nomeDi), tr)}.`,
        `${righe.length} camera${righe.length === 1 ? "" : "s"}: ${elenco(righe.map(nomeDi), tr)}.`,
      ),
      punti: [],
    };
  },

  /* Con piu' di un'auto la tessera dice due cose che non parlano della stessa
   * macchina: `ring` e' la carica piu' bassa fra tutte, `attiva` dice che
   * QUALCUNA e' attaccata. Messe insieme diventano «quella al 10% e' in
   * carica» mentre in carica c'e' l'altra, che sta all'80%. Con una sola auto
   * le due cose coincidono e si puo' dire; con piu' d'una si dice di meno, che
   * e' meglio di dire il falso. */
  ev: (tr, tessera, adesso = Date.now()) => {
    const l = lingua(tr, tessera?.lingua);
    const righe = Array.isArray(tessera?.rows) ? tessera.rows : [];
    const allaPresa = tessera?.attiva === true;
    const carica = num(tessera?.ring);
    const piuAuto = (Number(tessera?.quante) || righe.length) > 1;
    if (piuAuto && carica != null)
      return {
        tono: allaPresa ? VERDETTI.corso : carica < 20 ? VERDETTI.guarda : VERDETTI.bene,
        frase: allaPresa
          ? tr(
              `Una e' in carica; la piu' scarica e' al ${Math.round(carica)}%.`,
              `One is charging; the lowest is at ${Math.round(carica)}%.`,
            )
          : tr(
              `Nessuna attaccata; la piu' scarica e' al ${Math.round(carica)}%.`,
              `None plugged in; the lowest is at ${Math.round(carica)}%.`,
            ),
        punti: [],
      };
    const punti = [];
    const km = righe.map((r) => num(r?.km)).filter((v) => v != null);
    if (km.length)
      punti.push(
        tr(`${numero(km[0], 0, l)} km di autonomia`, `${numero(km[0], 0, l)} km of range`),
      );
    if (carica == null)
      return {
        tono: allaPresa ? VERDETTI.corso : VERDETTI.bene,
        frase: allaPresa
          ? tr("E' in carica.", "It is charging.")
          : tr("Non e' attaccata.", "Not plugged in."),
        punti,
      };
    if (allaPresa) {
      /* «Ora l'auto e' in carica ma non dice quando finisce»: se si sa a che
       * potenza sta caricando, si dice l'ora d'arrivo — predittiva, come
       * «l'acqua e' calda verso le 16:30» del solare termico. */
      const pieno = oraDelPieno(tessera, adesso, l);
      return {
        tono: VERDETTI.corso,
        frase: pieno
          ? tr(
              `In carica al ${Math.round(carica)}%: di questo passo arriva al ${pieno.traguardo}% verso le ${pieno.ora}.`,
              `Charging at ${Math.round(carica)}%: at this rate it reaches ${pieno.traguardo}% around ${pieno.ora}.`,
            )
          : tr(`In carica, al ${Math.round(carica)}%.`, `Charging, at ${Math.round(carica)}%.`),
        punti,
      };
    }
    if (carica < 20)
      return {
        tono: VERDETTI.guarda,
        frase: tr(
          `E' al ${Math.round(carica)}% e non e' attaccata.`,
          `At ${Math.round(carica)}% and not plugged in.`,
        ),
        punti,
      };
    return {
      tono: VERDETTI.bene,
      frase: tr(`E' al ${Math.round(carica)}%, ferma.`, `At ${Math.round(carica)}%, idle.`),
      punti,
    };
  },

  robot: (tr, tessera) => {
    const righe = Array.isArray(tessera?.rows) ? tessera.rows : [];
    /* La tessera dice gia' quanti ne stanno lavorando, col suo conto: se le
     * righe non portano il campo grezzo — puo' succedere con dati vecchi — si
     * ricade su quello invece di dire che sono tutti fermi. */
    const attivi = righe.filter((r) => r?.cleaning === true || pulito(r?.state) === "cleaning");
    if (!attivi.length && tessera?.attiva === true)
      return {
        tono: VERDETTI.corso,
        frase: tr("Qualcuno sta pulendo.", "One is cleaning."),
        punti: [],
      };
    const cariche = righe.map((r) => num(r?.battery)).filter((v) => v != null);
    const piuScarico = cariche.length ? Math.min(...cariche) : null;
    const punti = [];
    if (piuScarico != null && !attivi.length)
      punti.push(
        tr(
          `La carica piu' bassa e' ${Math.round(piuScarico)}%`,
          `Lowest charge is ${Math.round(piuScarico)}%`,
        ),
      );
    if (!righe.length)
      return {
        tono: VERDETTI.bene,
        frase: tr("Nessun robot configurato.", "No vacuum configured."),
        punti: [],
      };
    if (attivi.length)
      return {
        tono: VERDETTI.corso,
        frase: tr(
          `${elenco(attivi.map(nomeDi), tr)} sta pulendo.`,
          `${elenco(attivi.map(nomeDi), tr)} is cleaning.`,
        ),
        punti: [],
      };
    if (piuScarico != null && piuScarico < 20)
      return {
        tono: VERDETTI.guarda,
        frase: tr(
          `Fermi, e il piu' scarico e' al ${Math.round(piuScarico)}%.`,
          `Idle, and the lowest is at ${Math.round(piuScarico)}%.`,
        ),
        punti: [],
      };
    return {
      tono: VERDETTI.bene,
      frase: tr(`Tutti fermi, ${righe.length} in tutto.`, `All idle, ${righe.length} in total.`),
      punti,
    };
  },

  piscina: (tr, tessera) => {
    const l = lingua(tr, tessera?.lingua);
    const righe = Array.isArray(tessera?.rows) ? tessera.rows : [];
    const trova = (nome) => righe.find((r) => pulito(r?.name).toLowerCase() === nome);
    const acqua = num(trova(tr("acqua", "water"))?.raw ?? trova(tr("acqua", "water"))?.value);
    const ph = num(trova("ph")?.raw ?? trova("ph")?.value);
    const punti = [];
    if (ph != null) {
      const fuori = ph < 7 || ph > 7.6;
      punti.push(
        fuori
          ? tr(
              `Il pH e' ${numero(ph, 1, l)}, fuori dai 7,0–7,6`,
              `pH is ${numero(ph, 1, l)}, outside 7.0–7.6`,
            )
          : tr(`Il pH e' ${numero(ph, 1, l)}, nella norma`, `pH is ${numero(ph, 1, l)}, in range`),
      );
      if (fuori)
        return {
          tono: VERDETTI.guarda,
          frase:
            acqua == null
              ? tr("Il pH e' fuori norma.", "pH is out of range.")
              : tr(
                  `Acqua a ${numero(acqua, 1, l)}°, ma il pH e' fuori norma.`,
                  `Water at ${numero(acqua, 1, l)}°, but pH is out of range.`,
                ),
          punti,
        };
    }
    /* «Non c'e' ancora una lettura» dopo aver appena scritto il pH.
     *
     * Questo ramo guardava la sola temperatura dell'acqua: una vasca con la
     * sonda del pH e senza termometro si sentiva dire che il pH e' 7,3 e, riga
     * sotto, che non c'e' ancora una lettura. Due frasi che si smentiscono
     * nella stessa finestra valgono meno di una sola. Se qualcosa si e' letto,
     * si dice cosa manca; se non si e' letto niente, allora si', non c'e'
     * ancora una lettura. */
    if (acqua == null)
      return {
        tono: VERDETTI.bene,
        frase: punti.length
          ? tr("La temperatura dell'acqua non si legge.", "The water temperature is unavailable.")
          : tr("Non c'e' ancora una lettura.", "No reading yet."),
        punti,
      };
    return {
      tono: VERDETTI.bene,
      frase: tr(`L'acqua e' a ${numero(acqua, 1, l)}°.`, `Water is at ${numero(acqua, 1, l)}°.`),
      punti,
    };
  },

  irrigazione: (tr, tessera, adesso) => {
    const righe = Array.isArray(tessera?.rows) ? tessera.rows : [];
    const bagnano = righe.filter((r) => r?.on === true || r?.running === true);
    if (!bagnano.length && tessera?.attiva === true)
      return {
        tono: VERDETTI.corso,
        frase: tr("Sta irrigando.", "Watering."),
        punti: [],
      };
    const umidita = num(tessera?.ring);
    const punti = [];
    if (umidita != null && !bagnano.length)
      punti.push(tr(`Terreno al ${Math.round(umidita)}%`, `Soil at ${Math.round(umidita)}%`));
    const minuti = daQuandoDelleRighe(bagnano, adesso);
    if (minuti != null)
      punti.push(tr(`Va avanti da ${daQuanto(minuti, tr)}`, `Running ${daQuanto(minuti, tr)}`));
    if (!righe.length)
      return {
        tono: VERDETTI.bene,
        frase: tr("Nessuna zona configurata.", "No zone configured."),
        punti: [],
      };
    if (bagnano.length)
      return {
        tono: VERDETTI.corso,
        frase: tr(
          `${elenco(bagnano.map(nomeDi), tr)} sta bagnando, su ${righe.length} zone.`,
          `${elenco(bagnano.map(nomeDi), tr)} watering, of ${righe.length} zones.`,
        ),
        punti,
      };
    return {
      tono: VERDETTI.bene,
      frase: tr(
        `${righe.length} zon${righe.length === 1 ? "a ferma" : "e ferme"}.`,
        `${righe.length} zone${righe.length === 1 ? "" : "s"} idle.`,
      ),
      punti,
    };
  },

  /* La musica (#269) e' la sola sezione in cui la lettura ha gia' le parole
   * pronte: il titolo del brano. Non c'e' niente da dedurre da una soglia — o
   * sta suonando qualcosa, e allora si dice cosa, o non sta suonando niente. */
  media: (tr, tessera) => {
    const righe = Array.isArray(tessera?.lettori) ? tessera.lettori : [];
    if (!righe.length)
      return {
        tono: VERDETTI.bene,
        frase: tr("Nessun lettore configurato.", "No player set up."),
        punti: [],
      };
    const suonano = righe.filter((r) => r?.suona === true);
    const spenti = righe.filter((r) => r?.spento === true).length;
    const muti = righe.filter((r) => r?.muto === true).length;
    const punti = [];
    if (muti)
      punti.push(
        muti === 1
          ? tr("Uno non risponde", "One is not reporting")
          : tr(`${muti} non rispondono`, `${muti} are not reporting`),
      );
    if (spenti && !suonano.length)
      punti.push(
        spenti === 1
          ? tr("Uno e' spento", "One is off")
          : tr(`${spenti} spenti`, `${spenti} are off`),
      );
    if (!suonano.length) {
      const pausa = righe.filter((r) => r?.inPausa === true);
      if (pausa.length)
        return {
          tono: VERDETTI.bene,
          frase:
            pausa.length === 1
              ? tr(`${pulito(pausa[0]?.nome)} e' in pausa.`, `${pulito(pausa[0]?.nome)} is paused.`)
              : tr(`${pausa.length} lettori in pausa.`, `${pausa.length} players paused.`),
          punti,
        };
      return {
        tono: VERDETTI.bene,
        frase: tr("Non sta suonando niente.", "Nothing is playing."),
        punti,
      };
    }
    /* Quello che si voleva sapere: cosa sta suonando, e dove. Con una cassa
     * sola il posto e' superfluo — c'e' una cassa; con due il titolo da solo
     * non basta a capire da che stanza arriva. */
    const primo = suonano[0];
    const pezzo = [pulito(primo?.titolo), pulito(primo?.artista)].filter(Boolean).join(" — ");
    if (suonano.length === 1)
      return {
        tono: VERDETTI.corso,
        frase: pezzo
          ? tr(
              `${pulito(primo?.nome)} sta suonando ${pezzo}.`,
              `${pulito(primo?.nome)} is playing ${pezzo}.`,
            )
          : tr(`${pulito(primo?.nome)} sta suonando.`, `${pulito(primo?.nome)} is playing.`),
        punti,
      };
    /* Con piu' di una cassa il titolo non lo dice questa frase: la didascalia
     * della tessera li elenca tutti — e' il suo mestiere, ed e' quello che si
     * era chiesto — e ripeterli qui vorrebbe dire la stessa riga due volte a
     * due dita di distanza. */
    return {
      tono: VERDETTI.corso,
      frase: tr(
        `${suonano.length} casse stanno suonando.`,
        `${suonano.length} speakers are playing.`,
      ),
      punti,
    };
  },
});

/* ── la porta d'ingresso ───────────────────────────────────────────────── */

/* Chi non ha una lettura sua non riceve una frase sbagliata: riceve niente, e
 * chi disegna sa che sotto il verdetto non va scritto nulla. E' meglio di una
 * riga che parla di un'altra sezione. */
export function analisiDellaSezione(
  tessera,
  traduci = IN_ITALIANO,
  adesso = Date.now(),
  storia = null,
  linguaDeiNumeri = null,
) {
  const lettura = LETTURE[tessera?.key];
  if (!lettura) return null;
  const conLingua = { ...(tessera || {}), lingua: linguaDeiNumeri || tessera?.lingua || null };
  const esito = lettura(traduci, conLingua, adesso);
  if (!esito?.frase) return null;
  const dalModello = puntiDelModello(conLingua, storia, traduci, adesso);
  return {
    tono: dalModello.tono || esito.tono || VERDETTI.bene,
    frase: esito.frase,
    punti: [...(esito.punti || []), ...dalModello.punti].filter(Boolean),
  };
}

/* ── quello che il modello aggiunge, quando c'e' una storia ────────────── */

/* Come si scrive il numero di questa sezione, e verso cosa sta andando.
 *
 * Il modello conta e basta: non sa se quei numeri sono watt o gradi, e non
 * deve saperlo. Il verso — il pieno di una batteria, l'obiettivo di un
 * termostato — e' invece una cosa della sezione, e sta scritta qui. */
const FORMA = Object.freeze({
  /* La sezione Energia ha due soggetti. Di solito e' la potenza della casa, e
   * allora si scrive in watt e non c'e' un traguardo. Mentre la batteria si
   * carica il soggetto diventa lo stato di carica: si scrive in percentuale, e
   * il traguardo e' il pieno — cosi' la finestra puo' dire quando ci arriva
   * invece di ripetere un numero che si legge gia' sopra. */
  energia: {
    unita: (v, l, tessera) => (tessera?.soggetto === "carica" ? `${Math.round(v)}%` : watt(v, l)),
    bersaglio: (tessera) => (tessera?.soggetto === "carica" ? 100 : null),
  },
  temperatura: { unita: (v, l) => `${numero(v, 1, l)}°`, bersaglio: () => null },
  solare: { unita: (v, l) => `${numero(v, 1, l)}°`, bersaglio: () => null },
  piscina: { unita: (v, l) => `${numero(v, 1, l)}°`, bersaglio: () => null },
  /* Quando la frase dice gia' l'ora del pieno (dalla potenza del caricatore),
   * il modello non aggiunge il SUO arrivo dalla pendenza: due orari diversi
   * per la stessa carica sono una contraddizione, non un'informazione. */
  ev: {
    unita: (v) => `${Math.round(v)}%`,
    bersaglio: (t) => (t?.attiva && !(Number(t?.ricaricaKw) > 0) ? 100 : null),
  },
  robot: { unita: (v) => `${Math.round(v)}%`, bersaglio: () => null },
  irrigazione: { unita: (v) => `${Math.round(v)}%`, bersaglio: () => null },
  elettrodomestici: { unita: (v, l) => watt(v, l), bersaglio: () => null },
});

/* Al massimo due righe.
 *
 * Il modello sa dire cinque cose; scriverle tutte trasforma la finestra in un
 * bollettino, e chi legge smette a meta'. Si tengono le due che rispondono
 * alle domande vere: «e' normale?» e «dove sta andando?». */
function puntiDelModello(tessera, storia, tr, adesso) {
  const forma = FORMA[tessera?.key];
  if (!forma || !storia) return { punti: [], tono: null };
  const l = lingua(tr, tessera?.lingua);
  const scrivi = (v) => forma.unita(v, l, tessera);
  const lettura = letturaNelTempo(storia, { adesso, bersaglio: forma.bersaglio(tessera) });
  if (!lettura) return { punti: [], tono: null };

  const punti = [];
  let tono = null;

  /* «E' normale?» — e la risposta ha senso solo con un riferimento: il solito
   * a quest'ora se la storia copre piu' giorni, altrimenti il solito e basta.
   * Sotto la soglia non si dice niente: «e' nella norma» e' una riga sprecata,
   * perche' e' il caso di quasi sempre. */
  const riferimento = lettura.abituale || lettura.solito;
  if (lettura.insolito != null && lettura.insolito >= SOGLIE_INSOLITO.notevole && riferimento) {
    const sopra = lettura.valore > riferimento.centro;
    const quando = lettura.abituale
      ? tr("per quest'ora", "for this time of day")
      : tr("delle ultime ore", "over the last few hours");
    punti.push(
      sopra
        ? tr(
            `Piu' alto del solito ${quando}: ${scrivi(lettura.valore)} contro ${scrivi(riferimento.centro)}`,
            `Higher than usual ${quando}: ${scrivi(lettura.valore)} against ${scrivi(riferimento.centro)}`,
          )
        : tr(
            `Piu' basso del solito ${quando}: ${scrivi(lettura.valore)} contro ${scrivi(riferimento.centro)}`,
            `Lower than usual ${quando}: ${scrivi(lettura.valore)} against ${scrivi(riferimento.centro)}`,
          ),
    );
    /* Un valore molto fuori dal solito e' una cosa da guardare, qualunque
     * cosa dica il conteggio delle righe. E' il caso per cui questo modello
     * esiste: nessuno sta «facendo» niente, eppure c'e' qualcosa. */
    if (lettura.insolito >= SOGLIE_INSOLITO.forte) tono = VERDETTI.guarda;
  }

  /* «Dove sta andando?» — l'arrivo se il modello sa dire quando, altrimenti
   * il passo. L'arrivo e' la risposta migliore delle due: «piena fra un'ora»
   * dice piu' di «sale del dodici per cento all'ora». */
  if (lettura.arrivo) {
    const quando = fraQuanto((lettura.arrivo - adesso) / 60000, tr);
    punti.push(
      tessera?.soggetto === "carica"
        ? tr(`La batteria e' piena ${quando}`, `Battery full ${quando}`)
        : tr(`Ci arriva ${quando}`, `Getting there ${quando}`),
    );
  } else if (lettura.tendenza && lettura.tendenza.verso !== "ferma") {
    const passo = Math.abs(lettura.tendenza.perOra);
    punti.push(
      lettura.tendenza.verso === "sale"
        ? tr(`Sale di ${scrivi(passo)} all'ora`, `Rising ${scrivi(passo)} per hour`)
        : tr(`Scende di ${scrivi(passo)} all'ora`, `Falling ${scrivi(passo)} per hour`),
    );
  }

  return { punti, tono };
}

/* Le sezioni che questo motore sa leggere. Serve alla prova che pretende che
 * non ne manchi nessuna, e a chi disegna per sapere in anticipo se c'e' da
 * fare spazio all'analisi. */
export const SEZIONI_LETTE = Object.freeze(Object.keys(LETTURE));

/* Il posto dove innestare un commento in prosa, se un giorno lo si vorra'.
 *
 * Torna sempre niente: e' un innesto dichiarato, non una funzione a meta'.
 * Chi lo riempira' dovra' tenere due cose. La prima: arriva dopo, e la
 * finestra dev'essere gia' completa e leggibile senza. La seconda: i numeri
 * restano quelli calcolati qui sopra — un commento puo' aggiungere il perche',
 * non rifare il conto. */
export function commentoInPiu() {
  return null;
}
