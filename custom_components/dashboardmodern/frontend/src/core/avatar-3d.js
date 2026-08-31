/* Il ritratto della persona: quali pezzi, quali file, e quali ritocchi.
 *
 * Il modulo e' puro. Non sa cos'e' una canvas ne' cos'e' una pagina: prende
 * le scelte — chi sei, che taglio e che barba porti, di che colore, che
 * carnagione, com'e' vestito, cosa ha addosso — e dice quali immagini
 * servono, come vanno incastrate e quali OPERAZIONI restano da fare a
 * runtime. Chi disegna sta di la'.
 *
 * Le immagini sono i render 3D di Fluent Emoji (Microsoft, licenza MIT),
 * preparati da `scripts/costruisci-avatar-3d.mjs`. A monte non c'e' tutto:
 * i lisci biondi o rossi sono render veri, i ricci biondi no. La regola e'
 * una sola — quando la combinazione esiste come render nativo la si usa
 * com'e'; quando non esiste si parte dalla base piu' vicina e si dichiara
 * il ritocco: una tinta a luminanza preservata, una barba trapiantata dal
 * ritratto barbuto della stessa carnagione, un abito ricolorato dentro la
 * sua finestra di tinta, un colletto dipinto, un paio d'occhiali ancorato
 * agli occhi misurati in build.
 */
import {
  AVATAR_CARNAGIONI,
  AVATAR_LATO,
  AVATAR_MISURE,
  AVATAR_BUSTI,
  AVATAR_PERSONE,
  AVATAR_TESTE,
  AVATAR_VESTITI,
} from "./avatar-catalog.js";

export { AVATAR_LATO };

const chiavi = (elenco) => elenco.map((voce) => voce.key);

export const PERSONE = Object.freeze(chiavi(AVATAR_PERSONE));
export const CARNAGIONI = Object.freeze(chiavi(AVATAR_CARNAGIONI));
/* «nessuno» non e' un vestito: e' il ritratto della sola testa. */
export const VESTITI = Object.freeze(["nessuno", ...chiavi(AVATAR_VESTITI)]);

/* ── Le file tra cui si sceglie ─────────────────────────────────────────
 * Il catalogo elenca le VARIANTI renderizzate a monte (lisci, barba, ricci,
 * rossi, bianchi, biondi, calvo); qui invece stanno le SCELTE: il taglio,
 * la barba e i colori sono file separate dell'editor, e la traduzione da
 * scelta a variante la fa `risolviAvatar3d`. */
export const CAPELLI = Object.freeze(["lisci", "ricci", "calvo"]);
export const BARBE = Object.freeze(["nessuna", "rasata", "corta", "lunga"]);
export const COLORI_CAPELLI = Object.freeze([
  "naturale",
  "biondo",
  "rosso",
  "bianco",
  "castano",
  "rame",
  "grigio",
  "rosa",
]);
export const COLORI_BARBA = Object.freeze(["naturale", "grigia", "bionda", "rame", "castana"]);
export const COLORI_OCCHI = Object.freeze(["marrone", "verde", "azzurro", "grigio", "nero"]);
export const OCCHIALI = Object.freeze(["nessuno", "tondi", "quadrati", "sole"]);
export const COLLANE = Object.freeze(["nessuna", "catenina", "pendente"]);
export const COLORI_VESTITO = Object.freeze(["blu", "verde", "rosso", "giallo", "viola", "grigio"]);

/* Ragazzi e anziani non hanno le varianti di capelli: a monte non sono state
 * renderizzate. Per loro le file «Capelli» e «Colore capelli» non si
 * applicano, e dirlo qui evita che l'editor le mostri per finta. */
const CON_CAPELLI = new Set(AVATAR_PERSONE.filter((voce) => voce.capelli).map((voce) => voce.key));
export const personaHaCapelli = (persona) => CON_CAPELLI.has(persona);

/* La fila «Colore vestito» vale solo per i busti che il compositore sa
 * ricolorare: tessuti a tinta piena, dichiarati dallo script di build. Per
 * gli altri la scelta non ha effetto, e l'editor non la mostra. */
const RICOLORABILI = new Set(AVATAR_VESTITI.filter((voce) => voce.ricolorabile).map((v) => v.key));
export const vestitoRicolorabile = (vestito) => RICOLORABILI.has(vestito);

/* Gli abiti sintetici — polo e camicia — non hanno un busto loro: si
 * dipingono sul busto di un altro vestito (la maglietta del casual). */
const SINTETICI = Object.fromEntries(
  AVATAR_VESTITI.filter((voce) => voce.sintetico).map((voce) => [voce.key, voce.sintetico]),
);

/* Il busto e' disegnato su un corpo maschile o femminile: la persona scelta
 * decide quale, e per quelle senza un genere si prende il maschile — che nei
 * ritratti Fluent e' anche il piu' neutro dei due. */
const FEMMINILI = new Set(["donna", "ragazza", "anziana"]);
export const genereDi = (persona) => (FEMMINILI.has(persona) ? "donna" : "uomo");

const dentro = (valore, elenco) => (elenco.includes(valore) ? valore : elenco[0]);

/** Le scelte, riportate dentro i cataloghi. `null` per chi non ha un ritratto.
 *
 * Il normalizzatore e' anche il traduttore delle facce salvate prima della
 * v7, quando barba e colori vivevano dentro la fila dei capelli: chi aveva
 * scelto «barba» ha lisci e barba corta, chi aveva «rossi» o «bianchi» ha
 * lisci di quel colore. Nessuno riapre la plancia e trova un'altra faccia. */
export function normalizeAvatar3d(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const persona = dentro(String(input.persona ?? ""), [...PERSONE]);
  let capelli = String(input.capelli ?? "");
  let barba = String(input.barba ?? "");
  let coloreCapelli = String(input.coloreCapelli ?? "");
  if (capelli === "barba") {
    capelli = "lisci";
    if (!barba) barba = "corta";
  } else if (capelli === "rossi") {
    capelli = "lisci";
    if (!coloreCapelli) coloreCapelli = "rosso";
  } else if (capelli === "bianchi" || capelli === "biondi") {
    coloreCapelli = coloreCapelli || (capelli === "biondi" ? "biondo" : "bianco");
    capelli = "lisci";
  }
  return {
    persona,
    capelli: personaHaCapelli(persona) ? dentro(capelli, [...CAPELLI]) : CAPELLI[0],
    barba: dentro(barba, [...BARBE]),
    coloreCapelli: personaHaCapelli(persona)
      ? dentro(coloreCapelli, [...COLORI_CAPELLI])
      : COLORI_CAPELLI[0],
    coloreBarba: dentro(String(input.coloreBarba ?? ""), [...COLORI_BARBA]),
    occhi: dentro(String(input.occhi ?? ""), [...COLORI_OCCHI]),
    carnagione: dentro(String(input.carnagione ?? ""), [...CARNAGIONI]),
    vestito: dentro(String(input.vestito ?? ""), [...VESTITI]),
    coloreVestito: dentro(String(input.coloreVestito ?? ""), [...COLORI_VESTITO]),
    occhiali: dentro(String(input.occhiali ?? ""), [...OCCHIALI]),
    collana: dentro(String(input.collana ?? ""), [...COLLANE]),
  };
}

/* ── Le tavolozze dei ritocchi ──────────────────────────────────────────
 * I numeri vengono dal laboratorio che li ha provati a occhio, tinta per
 * tinta: rgb e' il colore pieno, lift schiarisce la resa complessiva —
 * serve alle tinte chiare stese su una base scura. */
const TINTE_CAPELLI = {
  biondo: { rgb: [236, 190, 100], lift: 0.28 },
  rosso: { rgb: [178, 62, 40], lift: 0.14 },
  bianco: { rgb: [232, 233, 238], lift: 0.34 },
  castano: { rgb: [141, 92, 47], lift: 0.1 },
  rame: { rgb: [190, 92, 46], lift: 0.12 },
  grigio: { rgb: [176, 178, 184], lift: 0.22 },
  rosa: { rgb: [208, 106, 158], lift: 0.12 },
};
const TINTE_BARBA = {
  grigia: { rgb: [176, 178, 184], lift: 0.22 },
  bionda: { rgb: [236, 190, 100], lift: 0.28 },
  rame: { rgb: [190, 92, 46], lift: 0.12 },
  castana: { rgb: [141, 92, 47], lift: 0.1 },
};
const IRIDI = {
  verde: [58, 107, 72],
  azzurro: [63, 116, 181],
  grigio: [125, 135, 148],
  nero: [38, 34, 31],
};

/* Gli abiti, colore per colore. Ogni vestito ricolorabile ha la sua
 * tavolozza — una maglietta rossa e' un rosso pieno, un completo «rosso» e'
 * un bordeaux, una camicia vive in tinte chiare — e la sua finestra di
 * tinta: quali pixel sono tessuto. La prima voce, «blu», e' SEMPRE il
 * colore di fabbrica del render (`null` = nessun ritocco): e' il valore di
 * default, e chi ha salvato un medico prima di questa fila deve ritrovare
 * il suo camice bianco, non uno tinto a sua insaputa. Fa eccezione la
 * camicia, che di fabbrica non esiste: il suo «blu» e' la classica bianca.
 * `desatura` fissa la saturazione del tessuto invece di ereditarla dalla
 * maglietta satura di partenza. */
const FINESTRA_MAGLIA = {}; /* la finestra di serie: maglietta blu satura */
const FINESTRA_COMPLETO = { hueHi: 0.78 };
const FINESTRA_CAMICE = { satMin: 0, hueLo: 0, hueHi: 1, yMin: 0.55 };
const FINESTRA_ABITO = { hueLo: 0.62, hueHi: 0.92 };
const MAGLIE = {
  blu: null,
  verde: [46, 158, 107],
  rosso: [201, 79, 79],
  giallo: [217, 164, 65],
  viola: [124, 92, 214],
  grigio: [106, 116, 130],
};
const CAMICIE = {
  blu: { rgb: [238, 240, 244], desatura: 0.04 },
  verde: { rgb: [168, 214, 186], desatura: 0.22 },
  rosso: { rgb: [232, 178, 178], desatura: 0.22 },
  giallo: { rgb: [238, 222, 168], desatura: 0.22 },
  viola: { rgb: [206, 190, 235], desatura: 0.22 },
  grigio: { rgb: [150, 190, 228], desatura: 0.25 } /* l'azzurra dei colletti */,
};
const COMPLETI = {
  blu: null,
  verde: { rgb: [44, 94, 72] },
  rosso: { rgb: [128, 48, 62] },
  giallo: { rgb: [146, 116, 58] },
  viola: { rgb: [84, 60, 130] },
  grigio: { rgb: [95, 102, 115], desatura: 0.1 },
};
/* Il camice di fabbrica e' bianco; gli altri sono divise da ospedale. */
const CAMICI = {
  blu: null,
  verde: { rgb: [120, 196, 150] },
  rosso: { rgb: [214, 140, 140] },
  giallo: { rgb: [224, 200, 140] },
  viola: { rgb: [178, 160, 214] },
  grigio: { rgb: [86, 156, 214] } /* l'azzurro classico delle corsie */,
};
/* L'abito dell'attesa di fabbrica e' violetto. */
const ABITI_ATTESA = {
  blu: null,
  verde: { rgb: [60, 140, 110] },
  rosso: { rgb: [176, 62, 72] },
  giallo: { rgb: [196, 150, 70] },
  viola: { rgb: [124, 92, 214] },
  grigio: { rgb: [120, 126, 138] },
};

/* Che ricolore tocca a un busto, per un colore scelto. `null` = com'e'. */
function ricoloreAbito(vestito, colore) {
  const scelta = (tavolozza, finestra) => {
    const voce = tavolozza[colore];
    if (!voce) return null;
    const { rgb, desatura } = Array.isArray(voce) ? { rgb: voce } : voce;
    return { tipo: "ricoloraAbito", rgb, ...finestra, ...(desatura != null ? { desatura } : {}) };
  };
  if (vestito === "casual" || vestito === "saluto" || vestito === "polo")
    return scelta(MAGLIE, FINESTRA_MAGLIA);
  if (vestito === "camicia") return scelta(CAMICIE, FINESTRA_MAGLIA);
  if (vestito === "ufficio") return scelta(COMPLETI, FINESTRA_COMPLETO);
  if (vestito === "medico") return scelta(CAMICI, FINESTRA_CAMICE);
  if (vestito === "attesa") return scelta(ABITI_ATTESA, FINESTRA_ABITO);
  return null;
}

/* Il colletto della polo e della camicia si dipinge in una tonalita' vicina
 * al tessuto: per la polo blu di fabbrica e' il blu della maglietta. */
const POLO_BLU = [43, 122, 204];
function colletto(vestito, colore) {
  if (vestito === "polo") {
    const rgb = colore === "blu" || !MAGLIE[colore] ? POLO_BLU : MAGLIE[colore];
    return { tipo: "colletto", rgb, bottoni: 2 };
  }
  if (vestito === "camicia") {
    /* Sulla bianca il colletto e' grigio chiaro, o sparirebbe nel tessuto. */
    const tela = CAMICIE[colore] || CAMICIE.blu;
    const rgb = colore === "blu" ? [200, 204, 212] : tela.rgb;
    return { tipo: "colletto", rgb, bottoni: 3 };
  }
  return null;
}

/* ── La testa giusta ────────────────────────────────────────────────────
 * Quale variante renderizzata portare, e cosa resta da ritoccare. Il render
 * nativo vince sempre: lisci biondi sono «blonde hair», lisci con la barba
 * corta al naturale sono «beard». Il resto e' base piu' vicina + ritocchi. */
const VARIANTE_COLORE = { biondo: "biondi", rosso: "rossi", bianco: "bianchi" };

function testaEOperazioni(scelte) {
  const cerca = (variante) =>
    AVATAR_TESTE[`${scelte.persona}|${variante ?? ""}|${scelte.carnagione}`];
  const operazioni = [];
  const tintaBarba = TINTE_BARBA[scelte.coloreBarba] || null;

  if (!personaHaCapelli(scelte.persona)) {
    /* Testa unica: ragazzi e anziani. La barba, se scelta, si trapianta. */
    const testa = cerca(null);
    if (scelte.barba !== "nessuna")
      operazioni.push({
        tipo: "barba",
        foggia: scelte.barba,
        donatrice: AVATAR_TESTE[`${genereDi(scelte.persona)}|barba|${scelte.carnagione}`] || null,
        ...(tintaBarba ? { rgb: tintaBarba.rgb, lift: tintaBarba.lift } : {}),
      });
    return { testa, operazioni };
  }

  let variante = scelte.capelli; /* lisci, ricci o calvo: esistono tutte */
  let barbaNativa = false;
  if (scelte.capelli === "lisci") {
    if (scelte.coloreCapelli === "naturale" && scelte.barba !== "nessuna") {
      /* Il render barbuto porta capelli scuri e barba piena gia' incisi:
       * per la corta al naturale non resta niente da fare, per le altre
       * fogge e per i colori si lavora sulla barba che c'e' gia'. */
      variante = "barba";
      barbaNativa = true;
    } else if (
      VARIANTE_COLORE[scelte.coloreCapelli] &&
      cerca(VARIANTE_COLORE[scelte.coloreCapelli])
    )
      variante = VARIANTE_COLORE[scelte.coloreCapelli];
  }
  const testa = cerca(variante) || cerca(scelte.capelli) || cerca("lisci");

  /* La tinta dei capelli: solo quando il colore non e' gia' nel render, e
   * solo dove ci sono capelli da tingere — sul calvo non c'e' niente. */
  const tinta = TINTE_CAPELLI[scelte.coloreCapelli];
  const colorePronto =
    scelte.coloreCapelli === "naturale" ||
    (scelte.capelli === "lisci" && variante === VARIANTE_COLORE[scelte.coloreCapelli]);
  if (tinta && !colorePronto && scelte.capelli !== "calvo" && !barbaNativa)
    operazioni.push({ tipo: "tintaCapelli", rgb: tinta.rgb, lift: tinta.lift });

  if (scelte.barba !== "nessuna") {
    const gia = barbaNativa && scelte.barba === "corta" && !tintaBarba;
    if (!gia)
      operazioni.push({
        tipo: "barba",
        foggia: scelte.barba,
        /* Sul render gia' barbuto la barba e' la sua: la maschera a
         * mandibola si calcola li'. Altrove arriva dal ritratto barbuto
         * della stessa carnagione, per genere. */
        donatrice: barbaNativa
          ? null
          : AVATAR_TESTE[`${genereDi(scelte.persona)}|barba|${scelte.carnagione}`] || null,
        ...(tintaBarba ? { rgb: tintaBarba.rgb, lift: tintaBarba.lift } : {}),
      });
  }
  return { testa, operazioni };
}

const nomeBusto = (scelte) => {
  if (scelte.vestito === "nessuno") return null;
  const chiave = SINTETICI[scelte.vestito] || scelte.vestito;
  /* Il genere mancante ricade sull'altro con grazia: l'abito «In attesa»
   * esiste solo al femminile, e un ritratto maschile che lo sceglie porta
   * quel busto invece di una casella rotta. */
  return (
    AVATAR_BUSTI[`${chiave}|${genereDi(scelte.persona)}|${scelte.carnagione}`] ||
    AVATAR_BUSTI[`${chiave}|donna|${scelte.carnagione}`] ||
    AVATAR_BUSTI[`${chiave}|uomo|${scelte.carnagione}`] ||
    null
  );
};

/* La barba lunga sborda dal render: il mento si allunga di un pezzo di tela
 * in piu', e senza busto la testa si rimpicciolisce per farcelo stare. */
export const BARBA_LUNGA_EXTRA = 0.18;

/**
 * Le immagini, il modo di incastrarle, e le operazioni da fare a runtime.
 *
 * Senza busto c'e' solo la testa, com'e'. Col busto la testa va riscalata:
 * i ritratti di sola testa sono inquadrati piu' grandi di quelli che stanno
 * sopra un corpo vestito, e `scala` e' il rapporto fra le due larghezze.
 * `x` e `y` sono l'angolo da cui disegnarla.
 *
 * `operazioni.testa` si applicano alla testa prima dell'incastro (tinte,
 * barba, iridi, occhiali), `operazioni.busto` al busto prima che la testa
 * ci arrivi sopra (ricolore, colletto, collana). Ognuna e' un dato, non una
 * funzione: il compositore le sa leggere, e questo modulo resta provabile a
 * tavolino.
 *
 * @returns {null|{testa:string,busto:string|null,scala:number,x:number,y:number,
 *   occhi:Array,operazioni:{testa:Array,busto:Array}}}
 */
export function risolviAvatar3d(input) {
  const scelte = normalizeAvatar3d(input);
  if (!scelte) return null;
  const { testa, operazioni } = testaEOperazioni(scelte);
  if (!testa) return null;

  if (IRIDI[scelte.occhi]) operazioni.push({ tipo: "iride", rgb: IRIDI[scelte.occhi] });
  if (scelte.occhiali !== "nessuno") operazioni.push({ tipo: "occhiali", stile: scelte.occhiali });

  const misuraTesta = AVATAR_MISURE[testa];
  /* La barba trapiantata arriva da un'altra testa: l'innesto dice come la
   * tela della donatrice si riscala su quella scelta — le inquadrature
   * Fluent sono quasi uguali, ma «quasi» sulla faccia si vede. */
  for (const op of operazioni)
    if (op.tipo === "barba" && op.donatrice) {
      const misuraDonatrice = AVATAR_MISURE[op.donatrice];
      if (misuraDonatrice && misuraTesta) {
        const rapporto = misuraTesta.testa.w / misuraDonatrice.testa.w;
        op.innesto = {
          scala: rapporto,
          x: misuraTesta.testa.cx - misuraDonatrice.testa.cx * rapporto,
          y: misuraTesta.testa.alto - misuraDonatrice.testa.alto * rapporto,
        };
      } else op.innesto = { scala: 1, x: 0, y: 0 };
    }
  const busto = nomeBusto(scelte);
  const misuraBusto = busto ? AVATAR_MISURE[busto] : null;

  const perBusto = [];
  if (busto) {
    const ricolore = vestitoRicolorabile(scelte.vestito)
      ? ricoloreAbito(scelte.vestito, scelte.coloreVestito)
      : null;
    if (ricolore) perBusto.push(ricolore);
    const cucito = colletto(scelte.vestito, scelte.coloreVestito);
    if (cucito) perBusto.push(cucito);
    /* La collana sta al girocollo del busto: senza busto non c'e' un collo
     * su cui appoggiarla, e la scelta non ha effetto. */
    if (scelte.collana !== "nessuna") perBusto.push({ tipo: "collana", stile: scelte.collana });
  }

  const lunga = operazioni.some((op) => op.tipo === "barba" && op.foggia === "lunga");
  const risultato = (scala, x, y) => ({
    testa,
    busto: busto && misuraBusto ? busto : null,
    scala,
    x,
    y,
    /* Le misure della testa nel SUO spazio, non in quello della tela: le
     * operazioni — iridi, occhiali, maschera della barba — lavorano sulla
     * testa prima dell'incastro, ed e' li' che gli servono gli occhi. */
    misura: misuraTesta || null,
    /* Con gli occhiali da sole gli occhi non si vedono: le palpebre sopra
     * le lenti sarebbero pelle dipinta sul vetro, e non si battono. */
    occhi:
      scelte.occhiali === "sole"
        ? []
        : (misuraTesta?.occhi || []).map((occhio) => ({
            cx: occhio.cx * scala + x,
            cy: occhio.cy * scala + y,
            w: occhio.w * scala,
            h: occhio.h * scala,
            pelle: occhio.pelle,
          })),
    operazioni: { testa: operazioni, busto: perBusto },
  });

  if (!busto || !misuraBusto || !misuraTesta) {
    if (lunga) {
      /* La tela della testa si allunga in basso per la coda della barba:
       * per restare nel quadrato la si riduce, centrata. */
      const scala = 1 / (1 + BARBA_LUNGA_EXTRA);
      return risultato(scala, (AVATAR_LATO * (1 - scala)) / 2, 0);
    }
    return risultato(1, 0, 0);
  }
  const scala = misuraBusto.testa.w / misuraTesta.testa.w;
  const x = misuraBusto.testa.cx - misuraTesta.testa.cx * scala;
  const y = misuraBusto.testa.alto - misuraTesta.testa.alto * scala;
  /* Gli occhi si spostano con la testa: e' li' che andranno le palpebre. */
  return risultato(scala, x, y);
}

/** I nomi dei file di tutti i pezzi, per chi deve precaricarli: la testa, il
 * busto, e l'eventuale immagine donatrice della barba. */
export function fileAvatar3d(input) {
  const risolto = risolviAvatar3d(input);
  if (!risolto) return [];
  const donatrici = risolto.operazioni.testa
    .filter((op) => op.tipo === "barba" && op.donatrice)
    .map((op) => op.donatrice);
  return [risolto.testa, risolto.busto, ...donatrici].filter(Boolean);
}

/** Una faccia a caso: e' da li' che si parte, invece che dal solito uomo.
 * Gli accessori a caso restano rari: un sorteggio che consegna a meta' delle
 * persone gli occhiali da sole non e' un punto di partenza, e' un carnevale. */
export function avatar3dACaso(sorteggio = Math.random) {
  const uno = (elenco) => elenco[Math.floor(sorteggio() * elenco.length)];
  const raro = (elenco) => (sorteggio() < 0.25 ? uno(elenco.slice(1)) : elenco[0]);
  return normalizeAvatar3d({
    persona: uno([...PERSONE]),
    capelli: uno([...CAPELLI]),
    barba: raro([...BARBE]),
    coloreCapelli: uno([...COLORI_CAPELLI]),
    coloreBarba: COLORI_BARBA[0],
    occhi: uno([...COLORI_OCCHI]),
    carnagione: uno([...CARNAGIONI]),
    vestito: uno([...VESTITI]),
    coloreVestito: uno([...COLORI_VESTITO]),
    occhiali: raro([...OCCHIALI]),
    collana: raro([...COLLANE]),
  });
}
