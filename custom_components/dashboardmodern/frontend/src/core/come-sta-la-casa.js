/* Come sta la casa, in una riga sotto il meteo (#356, #357).
 *
 * «Una barra sotto la parte meteo che mostra le indicazioni principali. Icona
 * + organico. Lampadina con luci accese. Tapparella con tapparelle aperte
 * ecc.»
 *
 * Il titolo della richiesta diceva «Raccolta Differenziata», ma il corpo
 * chiedeva un'altra cosa: non una scheda in piu', una RIGA. Chi passa davanti
 * alla plancia guarda il meteo e poi vuole sapere, senza toccare niente, se
 * stasera esce l'organico, se e' rimasta una luce accesa, se una finestra e'
 * aperta. Le tessere lo dicono gia', ma una tessera occupa mezzo schermo e va
 * cercata: qui bastano una pastiglia e due parole.
 *
 * Questo modulo non legge nessuna entita'. Le tessere della Home hanno gia'
 * fatto quel lavoro — quali luci esistono, quali sono accese, quando passa il
 * ritiro — e rifarlo qui vorrebbe dire due conti sugli stessi stati, che prima
 * o poi non tornano uguali. Entrano i modelli delle tessere cosi' come sono,
 * esce l'elenco delle pastiglie da mostrare; le parole per dirle stanno nella
 * sezione, come in tutto il nucleo.
 *
 * La posta (#357) e' l'unica voce che non viene da una tessera: e' un contatto
 * sulla cassetta, e nessun'altra parte della plancia lo guarda. Nemmeno qui lo
 * si legge — arriva gia' letto — ma qui sta la regola che conta: «deve restare
 * visibile finche' uno non l'ha vista». Un lampo di due secondi mentre non si
 * guarda non serve a niente.
 */

const pulito = (valore) => String(valore ?? "").trim();

/* Le voci della barra, nell'ordine in cui si vedono.
 *
 * Prima quello che e' successo — la posta e' arrivata, il ritiro e' domani,
 * l'antifurto sta suonando — poi quello che e' rimasto acceso. Chi passa
 * davanti alla plancia legge da sinistra, e la prima pastiglia e' la notizia.
 *
 * `tessera` e' la chiave del modello della Home da cui la voce prende il suo
 * conto, ed e' anche la tessera che si apre toccando la pastiglia. La posta
 * non ne ha una: e' roba sua.
 */
export const VOCI_DELLA_BARRA = Object.freeze([
  Object.freeze({ chiave: "posta", tessera: "" }),
  Object.freeze({ chiave: "rifiuti", tessera: "rifiuti" }),
  Object.freeze({ chiave: "sicurezza", tessera: "sicurezza" }),
  Object.freeze({ chiave: "luci", tessera: "luci" }),
  Object.freeze({ chiave: "tapparelle", tessera: "tapparelle" }),
  Object.freeze({ chiave: "clima", tessera: "clima" }),
  Object.freeze({ chiave: "prese", tessera: "prese" }),
  Object.freeze({ chiave: "media", tessera: "media" }),
  /* Le due misure stanno in fondo, e non e' un dettaglio (#461).
   *
   * «Sarebbe possibile inserire temperatura e umidita' di sensori personali?
   * Io ho un sensore esterno all'abitazione con cui mi regolo con i clima
   * interni.» Sono due letture, non due notizie: non succedono, ci sono
   * sempre. Chi legge la fascia da sinistra deve trovare per prima la cosa
   * che e' successa — la posta, il ritiro, l'antifurto — e queste due dopo,
   * dove si guardano quando si vogliono. Aprono la tessera Temperature, che
   * e' dove la stessa domanda ha la risposta lunga. */
  Object.freeze({ chiave: "temperatura", tessera: "temperatura" }),
  Object.freeze({ chiave: "umidita", tessera: "temperatura" }),
  /* E la pioggia, per chi ha una stazione meteo (#478).
   *
   * «Sarebbe utile vedere il rain rate e la pioggia caduta nella giornata.»
   * Sono due letture come le altre due, e stanno nello stesso posto: sotto il
   * meteo, che e' dove uno le cerca. Una tessera non ce l'hanno — la pioggia
   * caduta non e' una sezione — quindi la pastiglia si guarda e basta. */
  Object.freeze({ chiave: "pioggia", tessera: "" }),
  Object.freeze({ chiave: "pioggiaOggi", tessera: "" }),
]);

const NOTE = new Set(VOCI_DELLA_BARRA.map((voce) => voce.chiave));

/* Ogni pastiglia porta la tinta della SUA tessera: sono la stessa notizia detta
 * due volte, una in breve e una per esteso, e due colori diversi per lo stesso
 * fatto sono due fatti. La posta una tessera non ce l'ha — nasce da un
 * contatto, non da una sezione — e tiene il blu degli avvisi. */
export const TINTA_POSTA = "#2563eb";

/* Le due misure una tessera ce l'hanno — Temperature — ma la sua tinta parla
 * delle stanze di casa, e queste due parlano di un sensore scelto a mano, che
 * spesso e' fuori. Portano il colore della cosa che misurano: il caldo e
 * l'acqua. */
export const TINTA_TEMPERATURA = "#f97316";
export const TINTA_UMIDITA = "#0ea5e9";
/* La pioggia e' l'acqua che cade: il blu dell'umidita' sarebbe la stessa cosa
 * detta due volte, e queste due pastiglie stanno accanto a quella. */
export const TINTA_PIOGGIA = "#4f46e5";

/* Le voci che non vengono da una tessera ma da un sensore scelto: quale
 * disegno portano e di che colore. Il valore lo legge la sezione — questo
 * modulo non guarda nessuna entita' — e arriva gia' letto, come la posta. */
const MISURE = Object.freeze({
  temperatura: Object.freeze({ icona: "🌡️", mdi: "mdi:thermometer", tinta: TINTA_TEMPERATURA }),
  umidita: Object.freeze({ icona: "💧", mdi: "mdi:water-percent", tinta: TINTA_UMIDITA }),
  pioggia: Object.freeze({ icona: "🌧️", mdi: "mdi:weather-pouring", tinta: TINTA_PIOGGIA }),
  pioggiaOggi: Object.freeze({ icona: "☔", mdi: "mdi:weather-rainy", tinta: TINTA_PIOGGIA }),
});

/* Quante ne sono accese, aperte, in funzione.
 *
 * Il conto lo ha gia' fatto la tessera: le luci accese stanno in `on`, le
 * aperture in `open`, le casse che suonano in `suonano`. Qui si legge quel
 * campo e basta — rifiltrare le righe vorrebbe dire scrivere una seconda volta
 * la regola di cosa conta come «accesa», e due regole sulla stessa cosa
 * divergono al primo caso strano: una presa che non risponde, una tapparella
 * socchiusa che in casa conta chiusa.
 */
const ACCESE = Object.freeze({
  luci: "on",
  tapparelle: "open",
  clima: "on",
  prese: "on",
  media: "suonano",
});

/** La configurazione della barra, ripulita: quali voci si vedono e la cassetta. */
export function normalizzaBarra(salvato) {
  const dato = salvato && typeof salvato === "object" && !Array.isArray(salvato) ? salvato : {};
  const scelte = dato.voci && typeof dato.voci === "object" ? dato.voci : {};
  const voci = {};
  /* Di serie ci sono tutte: una voce che non ha niente da dire non si vede
   * comunque, quindi partire con tutte accese non riempie niente di inutile e
   * fa trovare la barra gia' fatta a chi non apre mai la configurazione. */
  for (const voce of VOCI_DELLA_BARRA) voci[voce.chiave] = scelte[voce.chiave] !== false;
  return {
    voci,
    posta: pulito(dato.posta),
    /* I due sensori scelti a mano. Vuoti di serie: una misura che nessuno ha
     * indicato non si indovina, e senza la pastiglia non c'e'. */
    temperatura: pulito(dato.temperatura),
    umidita: pulito(dato.umidita),
    /* I due della pioggia (#478): quanto sta venendo giu' adesso e quanto ne
     * e' caduta oggi. Sono gli stessi che legge l'irrigazione, e si scrivono
     * qui una volta sola: chiederli due volte vorrebbe dire due caselle che
     * possono discordare sulla stessa stazione meteo. */
    pioggia: pulito(dato.pioggia),
    pioggiaOggi: pulito(dato.pioggiaOggi),
  };
}

/* Il ritiro che riguarda adesso: oggi o domani, non fra sei giorni.
 *
 * Sono i due momenti in cui la risposta serve — stasera metto fuori qualcosa,
 * o domattina — ed e' la stessa soglia con cui si accende la tessera dei
 * rifiuti. Le righe della tessera arrivano gia' in ordine di urgenza. */
function ritiroVicino(modello) {
  const righe = Array.isArray(modello?.rows) ? modello.rows : [];
  return righe.find((riga) => riga?.quando === "oggi" || riga?.quando === "domani") || null;
}

/**
 * Le pastiglie da mostrare, in ordine.
 *
 * `modelli` sono i modelli delle tessere della Home, quelli veri, prima che le
 * preferenze ne nascondano qualcuna: chi nasconde la tessera delle luci perche'
 * gli basta la riga non deve perdere anche la riga.
 *
 * Esce solo quello che ha qualcosa da dire: zero luci accese, nessuna
 * pastiglia. Una barra che dice «0 luci accese» occupa spazio per non dire
 * niente.
 */
export function pastiglieDellaCasa(modelli, { barra, posta, misure } = {}) {
  const config = normalizzaBarra(barra);
  const perChiave = new Map(
    (Array.isArray(modelli) ? modelli : [])
      .filter((modello) => modello && NOTE.has(pulito(modello.key)))
      .map((modello) => [pulito(modello.key), modello]),
  );
  const fuori = [];
  for (const voce of VOCI_DELLA_BARRA) {
    if (!config.voci[voce.chiave]) continue;
    if (voce.chiave === "posta") {
      if (posta?.arrivata)
        fuori.push({
          chiave: "posta",
          icona: "📬",
          mdi: "mdi:email",
          tinta: TINTA_POSTA,
          avviso: true,
        });
      continue;
    }
    const misura = MISURE[voce.chiave];
    if (misura) {
      const letta = misure?.[voce.chiave];
      /* Un sensore che non risponde non scrive «—»: la pastiglia non c'e', come
       * per tutte le altre voci che non hanno niente da dire. */
      if (!Number.isFinite(Number(letta?.valore))) continue;
      fuori.push({
        chiave: voce.chiave,
        tessera: voce.tessera,
        icona: misura.icona,
        mdi: misura.mdi,
        tinta: misura.tinta,
        valore: Number(letta.valore),
        unita: pulito(letta.unita),
        nome: pulito(letta.nome),
      });
      continue;
    }
    const modello = perChiave.get(voce.chiave);
    if (!modello) continue;
    if (voce.chiave === "rifiuti") {
      const riga = ritiroVicino(modello);
      if (!riga) continue;
      fuori.push({
        chiave: "rifiuti",
        tessera: voce.tessera,
        icona: pulito(riga.glyph) || pulito(modello.icon) || "♻️",
        tinta: pulito(modello.accent),
        quando: riga.quando,
        nome: pulito(riga.name),
      });
      continue;
    }
    if (voce.chiave === "sicurezza") {
      /* Disinserito non e' una notizia: la pastiglia dice che l'antifurto e'
       * inserito, o che sta suonando. */
      if (!modello.armed && !modello.triggered) continue;
      fuori.push({
        chiave: "sicurezza",
        tessera: voce.tessera,
        icona: pulito(modello.icon) || "🛡️",
        tinta: pulito(modello.accent),
        valore: pulito(modello.value),
        avviso: Boolean(modello.triggered),
      });
      continue;
    }
    const righe = modello[ACCESE[voce.chiave]];
    const conto = Array.isArray(righe) ? righe.length : 0;
    if (conto < 1) continue;
    fuori.push({
      chiave: voce.chiave,
      tessera: voce.tessera,
      icona: pulito(modello.icon),
      tinta: pulito(modello.accent),
      conto,
      /* I nomi di cio' che e' acceso: la pastiglia non li scrive — non ci
       * starebbero — ma li mette nel titolo, che e' quello che legge chi si
       * ferma sopra col dito o chi ascolta il lettore di schermo. */
      nomi: righe.map((riga) => pulito(riga?.name)).filter(Boolean),
    });
  }
  return fuori;
}

/* ── la cassetta della posta (#357) ──────────────────────────────────────── */

/**
 * Il passo della cassetta: cosa dice adesso, cosa se ne ricordava.
 *
 * «Animazione quando arriva Posta attivato da un sensore contact.» Il contatto
 * scatta quando il postino apre lo sportello e torna a riposo quando lo
 * richiude: l'apertura dura pochi secondi, e in quei pochi secondi non c'e'
 * nessuno davanti alla plancia. Guardare soltanto com'e' adesso vorrebbe dire
 * non accorgersene mai.
 *
 * La memoria serve a questo, e sono due numeri: com'era l'ultima volta che si
 * e' guardato, e da quando stava cosi'. Home Assistant dice `last_changed`,
 * cioe' il momento in cui lo stato e' diventato quello che e': una cassetta
 * chiusa che dichiara un momento PIU' RECENTE di quello che ci ricordavamo si
 * e' aperta e richiusa mentre non guardavamo. Non serve stare a vedere — si
 * legge dopo, ed e' esattamente il caso che conta.
 *
 * `memoria` e' `{ aperto, cambiatoIl, arrivo, vista }`; `lettura` e'
 * `{ aperto, cambiatoIl }`, oppure niente quando la cassetta non e'
 * configurata o l'entita' non risponde. L'orologio non si tocca: chi chiama
 * passa i momenti gia' letti.
 */
export function passoDellaPosta(memoria, lettura) {
  const prima = memoria && typeof memoria === "object" ? memoria : {};
  const vista = Number(prima.vista) || 0;
  const primaAperto = typeof prima.aperto === "boolean" ? prima.aperto : null;
  const primaCambiatoIl = Number(prima.cambiatoIl) || 0;
  const primaArrivo = Number(prima.arrivo) || 0;
  const quando = Number(lettura?.cambiatoIl);
  if (!lettura || !Number.isFinite(quando))
    return {
      arrivata: primaArrivo > 0 && primaArrivo > vista,
      arrivo: primaArrivo,
      memoria: prima,
      cambiata: false,
    };

  const aperto = Boolean(lettura.aperto);
  let arrivo = primaArrivo;
  if (primaAperto === null) {
    /* Il primo sguardo: di prima non si sa niente. Una cassetta aperta adesso
     * e' posta che aspetta; una chiusa non racconta il suo passato, e
     * annunciarla vorrebbe dire salutare con «e' arrivata la posta» chiunque
     * finisca di configurare il sensore. */
    if (aperto) arrivo = quando;
  } else if (aperto && (!primaAperto || quando > primaCambiatoIl)) {
    arrivo = quando;
  } else if (!aperto && !primaAperto && quando > primaCambiatoIl) {
    arrivo = quando;
  }

  const dopo = { aperto, cambiatoIl: quando, arrivo, vista };
  return {
    arrivata: arrivo > 0 && arrivo > vista,
    arrivo,
    memoria: dopo,
    cambiata:
      dopo.aperto !== primaAperto ||
      dopo.cambiatoIl !== primaCambiatoIl ||
      dopo.arrivo !== primaArrivo,
  };
}

/** «L'ho ritirata»: la pastiglia torna a riposo fino al prossimo arrivo. */
export function postaRitirata(memoria, adesso) {
  const prima = memoria && typeof memoria === "object" ? memoria : {};
  /* Non basta segnare adesso: se l'orologio del dispositivo e' indietro
   * rispetto a quello di Home Assistant, «adesso» sarebbe piu' vecchio
   * dell'arrivo e la pastiglia resterebbe li' a ripetere la stessa cosa. */
  return { ...prima, vista: Math.max(Number(adesso) || 0, Number(prima.arrivo) || 0) };
}
