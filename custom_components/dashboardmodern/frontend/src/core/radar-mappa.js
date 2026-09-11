/* Il motore del radar: da un punto sulla terra alle tessere da mettere in fila.
 *
 * «Veniva chiesto di inserire coordinate oppure il comune: pensa a un motore
 * per poter scegliere il posto e il radar funziona.»
 *
 * Un radar a tessere e' una mappa come le altre — Web Mercator, la proiezione
 * che usano tutte — e la domanda vera e' sempre la stessa: dato un punto e
 * quanti chilometri intorno si vogliono vedere, quale livello di zoom serve e
 * quali quadratini vanno scaricati e dove vanno messi. E' aritmetica, si
 * scrive una volta e si prova senza rete: e' per questo che sta qui e non
 * dentro chi disegna.
 *
 * Questo modulo non sa niente di radar, di piogge e di servizi: sa dove
 * cascano i quadratini. L'indirizzo da cui si prendono e' un modello di
 * stringa che gli passa chi disegna, e cambiarlo non tocca una riga di questa
 * matematica — che e' il motivo per cui il servizio si puo' scegliere invece
 * di essere cablato.
 */

/* Il lato di un quadratino, nella convenzione che usano tutti i servizi di
 * tessere: 256 pixel. Chi ne serve da 512 lo dice, e il conto lo segue. */
export const LATO_TESSERA = 256;

/* Quanti metri sta un pixel all'equatore, a zoom zero. E' la circonferenza
 * della terra divisa per i 256 pixel del primo quadratino. */
const METRI_PER_PIXEL_ZERO = 156543.03392804097;

/* Lo zoom oltre il quale un radar non ha piu' niente da dire: le mappe di
 * pioggia hanno una griglia di un chilometro scarso, e ingrandire oltre mostra
 * quadrati sfocati invece di dettaglio. Sotto il tre si vede mezzo mondo, e a
 * quel punto non e' piu' «la zona prescelta». */
export const ZOOM_MINIMO = 3;
export const ZOOM_MASSIMO = 12;

/* Vuoto non e' zero.
 *
 * `Number("")` fa zero, e zero e' una latitudine buonissima: quella
 * dell'equatore. Una casella lasciata vuota diventava cosi' un punto
 * nell'oceano al largo dell'Africa, e il radar ci andava davvero — con la
 * faccia di uno che ha fatto quello che gli era stato chiesto. */
const numero = (valore) => {
  if (valore === null || valore === undefined || String(valore).trim() === "") return null;
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

const stringa = (valore) => String(valore ?? "").trim();

/** Una latitudine valida, o `null`. Web Mercator si ferma a 85,05°. */
export function latitudine(valore) {
  const n = numero(valore);
  return n === null || n < -85.05112878 || n > 85.05112878 ? null : n;
}

/** Una longitudine valida, o `null`. */
export function longitudine(valore) {
  const n = numero(valore);
  return n === null || n < -180 || n > 180 ? null : n;
}

/** Il quadratino che contiene un punto, con la sua parte decimale. */
export function tesseraDelPunto(lat, lon, zoom) {
  const scala = 2 ** zoom;
  const radianti = (lat * Math.PI) / 180;
  const x = ((lon + 180) / 360) * scala;
  const y = ((1 - Math.log(Math.tan(radianti) + 1 / Math.cos(radianti)) / Math.PI) / 2) * scala;
  return { x, y };
}

/** Il punto in cima a sinistra di un quadratino. */
export function puntoDellaTessera(x, y, zoom) {
  const scala = 2 ** zoom;
  const lon = (x / scala) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scala;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lon };
}

/** Quanti metri copre un pixel, a questa latitudine e a questo zoom. */
export function metriPerPixel(lat, zoom) {
  return (METRI_PER_PIXEL_ZERO * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/**
 * Lo zoom che fa entrare un cerchio di `raggioKm` in un riquadro di `latoPx`.
 *
 * Si sceglie il piu' stretto che ci sta ancora tutto: uno zoom in piu' taglia
 * fuori quello che si voleva vedere, e per un radar il bordo e' meta'
 * dell'informazione — la pioggia arriva da li'.
 */
export function zoomPerRaggio(lat, raggioKm, latoPx) {
  const raggio = numero(raggioKm);
  const lato = numero(latoPx);
  const dove = latitudine(lat);
  if (!raggio || raggio <= 0 || !lato || lato <= 0 || dove === null) return ZOOM_MINIMO;
  const metriVoluti = raggio * 2000;
  const ideale = Math.log2(
    (METRI_PER_PIXEL_ZERO * Math.cos((dove * Math.PI) / 180) * lato) / metriVoluti,
  );
  return Math.max(ZOOM_MINIMO, Math.min(ZOOM_MASSIMO, Math.floor(ideale)));
}

/**
 * La finestra di tessere intorno a un punto.
 *
 * Torna i quadratini con la loro posizione in pixel dentro il riquadro, gia'
 * spostati perche' il punto scelto finisca al centro. Chi disegna li mette
 * dove dice `sx`/`sy` e non fa nessun conto.
 */
export function finestraDiTessere(lat, lon, opzioni = {}) {
  const dove = latitudine(lat);
  const quanto = longitudine(lon);
  if (dove === null || quanto === null) return null;
  const lato = Math.max(64, numero(opzioni.latoPx) || 320);
  const alto = Math.max(64, numero(opzioni.altoPx) || lato);
  const tessera = numero(opzioni.lato) || LATO_TESSERA;
  const zoom =
    numero(opzioni.zoom) === null
      ? zoomPerRaggio(dove, numero(opzioni.raggioKm) || 30, Math.min(lato, alto))
      : Math.max(ZOOM_MINIMO, Math.min(ZOOM_MASSIMO, Math.round(numero(opzioni.zoom))));

  const centro = tesseraDelPunto(dove, quanto, zoom);
  /* Dove cade il centro dentro il riquadro, in pixel di mappa. */
  const centroPx = { x: centro.x * tessera, y: centro.y * tessera };
  const origine = { x: centroPx.x - lato / 2, y: centroPx.y - alto / 2 };

  const primaX = Math.floor(origine.x / tessera);
  const primaY = Math.floor(origine.y / tessera);
  const quanteX = Math.ceil((origine.x + lato) / tessera) - primaX;
  const quanteY = Math.ceil((origine.y + alto) / tessera) - primaY;

  const scala = 2 ** zoom;
  const tessere = [];
  for (let ry = 0; ry < quanteY; ry += 1) {
    for (let rx = 0; rx < quanteX; rx += 1) {
      const x = primaX + rx;
      const y = primaY + ry;
      /* Fuori dai poli non c'e' niente da chiedere; in longitudine invece il
       * mondo gira, e il quadratino a est dell'ultimo e' il primo. */
      if (y < 0 || y >= scala) continue;
      tessere.push({
        x: ((x % scala) + scala) % scala,
        y,
        sx: Math.round(x * tessera - origine.x),
        sy: Math.round(y * tessera - origine.y),
        lato: tessera,
      });
    }
  }
  return { zoom, lato, alto, tessera, tessere, metriPerPixel: metriPerPixel(dove, zoom) };
}

/**
 * Fin dove chiedere la pioggia: quello che dice la casella, o quel che si sa
 * del servizio.
 *
 * La casella vuota vale «quello che sappiamo di questo servizio»; uno zero
 * vale «nessun tetto, chiedigliela al livello della mappa» — che e' la strada
 * per chi ha un servizio che a quel livello risponde eccome, e non deve
 * pagare un numero misurato a casa d'altri.
 */
export function zoomDellaPioggia(config = {}, servizio = "") {
  const scritto = numero(config?.zoomPioggia);
  if (scritto !== null)
    return scritto <= 0 ? null : Math.max(ZOOM_MINIMO, Math.min(ZOOM_MASSIMO, Math.round(scritto)));
  return numero(SERVIZI_RADAR[stringa(servizio)]?.zoomMassimo);
}

/**
 * La finestra dei quadratini della PIOGGIA, che puo' guardare piu' largo.
 *
 * «C'e' ancora quella scritta sullo zoom e non mi sembra di vedere le piogge.»
 * Dal campo: mappa di fondo disegnata bene, nota `z9 · RainViewer`, e sopra la
 * mappa i quadratini della pioggia tutti sostituiti dalla scritta «Zoom Level
 * Not Supported». Non e' il fondo — quello arriva — e' il radar, che a quel
 * livello risponde con una scritta stampata invece che con la pioggia.
 *
 * Un servizio che a un certo ingrandimento non ha piu' niente da dare non e' un
 * difetto della plancia; chiederglielo lo stesso, si'. Qui la pioggia si chiede
 * al livello piu' vicino che quel servizio serve, e i suoi quadratini si
 * ingrandiscono per coprire la stessa area: la mappa resta inquadrata com'era,
 * la pioggia diventa un po' piu' grossa. Non si perde niente di vero — la
 * griglia di un radar sta intorno al chilometro, molto piu' larga di un pixel a
 * questi livelli — e si guadagna una mappa senza scritte sopra.
 *
 * `finestra` e' quella gia' calcolata per il fondo. Se il tetto non morde,
 * torna la stessa: chi disegna non deve sapere se e' successo qualcosa.
 */
export function finestraDellaPioggia(lat, lon, finestra, zoomMassimo = null) {
  if (!finestra) return null;
  const tetto = numero(zoomMassimo);
  if (tetto === null || finestra.zoom <= tetto) return finestra;
  const salto = finestra.zoom - Math.max(ZOOM_MINIMO, Math.round(tetto));
  const fattore = 2 ** salto;
  /* Il quadratino si chiede GIA' grande, invece di rimpicciolire il riquadro e
   * moltiplicare dopo.
   *
   * Rimpicciolire e moltiplicare sembrava la stessa cosa e non lo era: il
   * riquadro ha un minimo di sessantaquattro pixel, e quando la divisione
   * scendeva sotto quel minimo i conti venivano fatti per un riquadro piu'
   * alto di quello vero. Moltiplicando dopo, quell'aggiunta si moltiplicava
   * con tutto il resto e la pioggia usciva scentrata — trentacinque pixel su
   * un riquadro 320×198 sceso da z9 a z7, e molto di piu' con un tetto piu'
   * basso: la pioggia disegnata da un'altra parte rispetto alla mappa sotto e'
   * peggio della pioggia che manca.
   *
   * Chiedendo la stessa finestra con il quadratino largo `T×fattore`, il mondo
   * misura `2^Zr × T × fattore = 2^Z × T` pixel: esattamente lo spazio del
   * fondo. Le posizioni escono gia' buone, e non c'e' niente da scalare. */
  const piu = finestraDiTessere(lat, lon, {
    latoPx: finestra.lato,
    altoPx: finestra.alto,
    zoom: finestra.zoom - salto,
    lato: finestra.tessera * fattore,
  });
  return piu || finestra;
}

/**
 * Perche' questo indirizzo non e' un modello di quadratini.
 *
 * «Ho inserito il link con l'indirizzo e non lo legge nemmeno.» L'indirizzo
 * incollato era `https://www.windy.com/?40.964,14.215,9` — la pagina del sito,
 * quella che si apre nel browser — e la plancia rispondeva «scrivi un indirizzo
 * con {z}/{x}/{y} dentro», che e' vero e non serve a niente: chi non sa cos'e'
 * un quadratino legge quella frase e ha ancora lo stesso problema.
 *
 * Sono due errori diversi e vanno detti diversi: l'indirizzo di un SITO, che
 * non diventera' mai un modello per quanto lo si aggiusti, e un indirizzo di
 * quadratini a cui manca un segnaposto, che si sistema aggiungendolo.
 *
 * Torna "" quando l'indirizzo va bene.
 */
export function problemaDellIndirizzo(indirizzo) {
  const testo = stringa(indirizzo);
  if (!testo) return "vuoto";
  if (/\{-?[zxy]\}/.test(testo)) {
    /* Un modello serio li ha tutti e tre: con solo `{z}` si chiederebbe sempre
     * lo stesso quadratino, e si vedrebbe un pezzo di mondo a caso. La riga
     * puo' essere `{y}` o `{-y}` — c'e' chi le conta dal basso — e sono la
     * stessa cosa detta al contrario. */
    return /\{z\}/.test(testo) && /\{x\}/.test(testo) && /\{-?y\}/.test(testo)
      ? ""
      : "segnaposto-a-meta";
  }
  if (/^https?:\/\//i.test(testo)) return "sito";
  return "senza-segnaposto";
}

/**
 * L'indirizzo di un quadratino, dal modello.
 *
 * Il modello e' quello che usano tutti — `{z}`, `{x}`, `{y}` — piu' `{s}` per
 * i servizi che girano su piu' sottodomini e `{-y}` per quelli che contano le
 * righe dal basso. Senza segnaposto non e' un modello: torna stringa vuota,
 * che e' meglio di un indirizzo che chiede sempre lo stesso quadratino.
 */
export function urlDellaTessera(modello, tessera = {}, zoom = 0, sottodomini = "abc") {
  const testo = stringa(modello);
  if (!testo || !/\{[zxy]\}/.test(testo)) return "";
  const scala = 2 ** zoom;
  const lettera = sottodomini
    ? sottodomini[Math.abs((tessera.x || 0) + (tessera.y || 0)) % sottodomini.length]
    : "";
  return testo
    .replaceAll("{z}", String(zoom))
    .replaceAll("{x}", String(tessera.x ?? 0))
    .replaceAll("{y}", String(tessera.y ?? 0))
    .replaceAll("{-y}", String(scala - 1 - (tessera.y ?? 0)))
    .replaceAll("{s}", lettera);
}

/**
 * Dove guardare, deciso in ordine di quanto e' esplicito.
 *
 * Prima le coordinate scritte a mano — chi le ha scritte le vuole. Poi la zona
 * di Home Assistant che si e' scelta: le zone hanno un nome e delle coordinate,
 * e sono la risposta al «oppure il comune» senza tirare dentro un servizio che
 * traduce nomi in punti — quel servizio saprebbe dove abita chi guarda, e per
 * una cosa che Home Assistant sa gia' non vale la pena. Per ultima la casa,
 * che e' il posto giusto per quasi tutti e non chiede niente.
 */
export function luogoDelRadar(config = {}, states = {}, casa = {}) {
  const scritte = {
    lat: latitudine(config.lat),
    lon: longitudine(config.lon),
  };
  if (scritte.lat !== null && scritte.lon !== null)
    return { ...scritte, da: "scritte", nome: stringa(config.nome) };

  const zona = stringa(config.zona);
  if (zona) {
    const stato = states?.[zona];
    const lat = latitudine(stato?.attributes?.latitude);
    const lon = longitudine(stato?.attributes?.longitude);
    if (lat !== null && lon !== null)
      return { lat, lon, da: "zona", nome: stringa(stato?.attributes?.friendly_name) || zona };
  }

  const dellaCasa = states?.["zone.home"]?.attributes || {};
  const lat = latitudine(dellaCasa.latitude ?? casa.latitude);
  const lon = longitudine(dellaCasa.longitude ?? casa.longitude);
  /* Il nome lo da' la zona; quando la casa arriva dalla configurazione di Home
   * Assistant — `get_config`, che porta `location_name` — si usa quello: e' la
   * stessa parola che sta in cima alla plancia. */
  if (lat !== null && lon !== null)
    return {
      lat,
      lon,
      da: "casa",
      nome: stringa(dellaCasa.friendly_name) || stringa(casa.location_name),
    };
  return null;
}

/**
 * Le zone di Home Assistant che si possono scegliere come posto.
 *
 * Casa resta fuori: e' gia' quello che si vede senza scegliere niente, e
 * averla anche in elenco vorrebbe dire la stessa voce scritta due volte.
 */
export function zoneDisponibili(states = {}) {
  return Object.entries(states || {})
    .filter(([id, stato]) => {
      if (!id.startsWith("zone.") || id === "zone.home") return false;
      const a = stato?.attributes || {};
      return latitudine(a.latitude) !== null && longitudine(a.longitude) !== null;
    })
    .map(([id, stato]) => ({
      entity: id,
      nome: stringa(stato?.attributes?.friendly_name) || id.slice(5),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

/* ── i servizi che si possono scegliere ──────────────────────────────────
 *
 * «Il meteo radar non va: se metto casa non si vede nulla.»
 *
 * Non si vedeva niente perche' non c'era niente da cui prendere i quadratini:
 * il posto si sceglieva — casa, una zona, due coordinate — ma l'indirizzo del
 * servizio andava scritto a mano, e chi non lo sa scrivere si trovava un radar
 * che sapeva DOVE guardare e non COSA. Un radar cosi' e' una cornice vuota.
 *
 * Qui ci sono i servizi che si conoscono, come dati: il nome, l'indirizzo a
 * modello e, per chi ne ha bisogno, da dove si prende il fotogramma piu'
 * recente. Sono una tendina nella configurazione, non un ripiego silenzioso:
 * finche' non se ne sceglie uno la plancia non bussa a nessuno di loro, perche'
 * i quadratini che si chiedono dicono a chi li serve quale pezzo di mondo si
 * sta guardando. Chi lo sceglie lo sa, ed e' scritto accanto alla tendina.
 *
 * RainViewer pubblica un elenco di fotogrammi — ogni dieci minuti uno — e i
 * quadratini di ciascuno stanno sotto il percorso che l'elenco indica: senza
 * quell'elenco non c'e' indirizzo, ed e' per questo che il modello porta
 * `{host}` e `{path}` oltre ai soliti `{z}/{x}/{y}`. La tavolozza 2 e' quella
 * blu che usa il suo stesso sito, sfumata e con la neve.
 */
export const SERVIZI_RADAR = Object.freeze({
  rainviewer: Object.freeze({
    nome: "RainViewer",
    elenco: "https://api.rainviewer.com/public/weather-maps.json",
    modello: "{host}{path}/256/{z}/{x}/{y}/2/1_1.png",
    /* Ogni quanto l'elenco vale la pena di rileggerlo: i fotogrammi nascono
     * ogni dieci minuti, e rileggerlo piu' spesso e' chiedere la stessa cosa. */
    ogni: 10 * 60 * 1000,
    /* Fin dove risponde con la pioggia invece che con una scritta.
     *
     * Questo numero non viene da un manuale: viene da una schermata. Una
     * plancia con raggio trenta chilometri chiedeva `z9`, e i quadratini
     * tornavano tutti «Zoom Level Not Supported» — l'elenco dei fotogrammi
     * invece arrivava, quindi il servizio c'era e a quel livello non serviva.
     *
     * Da quella schermata si sa solo che nove e' troppo. Sette e' il massimo
     * che la documentazione di RainViewer dichiara per i quadratini della
     * mappa meteo, ed e' la lettura che ha retto alla revisione: fermarsi a
     * otto avrebbe lasciato la scritta a chi calcola otto — cioe' a schermi di
     * poco piu' stretti di quello della segnalazione — e avrebbe rifatto lo
     * stesso difetto un gradino piu' in basso.
     *
     * Chi ha un servizio che a nove risponde eccome non paga questo numero:
     * la casella nella scheda lo alza, lo abbassa, o lo toglie del tutto. Un
     * numero che nasce da una schermata sola non e' una legge, e sta dove si
     * puo' cambiare. */
    zoomMassimo: 7,
  }),
});

/* Le mappe di fondo fra cui scegliere. Un radar senza una mappa sotto e' una
 * macchia colorata: si vede che piove, non si vede dove. */
export const FONDI_MAPPA = Object.freeze({
  osm: Object.freeze({
    nome: "OpenStreetMap",
    modello: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  }),
});

/* CARTO non c'e' piu': i suoi quadratini gratuiti oggi tornano stampati «API
 * Key Required» e «Zoom Level Not Supported» — una mappa piena di scritte al
 * posto delle strade (visto sul campo). Chi l'aveva scelto passa a
 * OpenStreetMap senza dover toccare niente. */
export const FONDI_RITIRATI = Object.freeze({ carto: "osm" });

/* Ma «carto» non e' solo una parola nella tendina.
 *
 * La tendina e' arrivata dopo: prima si scriveva l'indirizzo a mano, e chi
 * aveva incollato quello di CARTO se lo e' tenuto — dentro `fondo` o dentro
 * `fondoModello` c'e' un indirizzo, non la chiave, e il cambio di sopra non lo
 * tocca. Quelle plance continuano a chiedere quadratini a un servizio che
 * risponde con la scritta al posto della mappa, e chi guarda vede «Zoom Level
 * Not Supported» sopra le sue strade senza sapere perche'. Un indirizzo si
 * riconosce dal suo ospite: se e' quello, si passa alla mappa di serie. */
const OSPITI_RITIRATI = [/(^|\.)cartocdn\.com$/i, /(^|\.)carto\.com$/i];

/** Se un indirizzo di tessere e' di un servizio che abbiamo ritirato. */
export function indirizzoRitirato(modello) {
  const testo = stringa(modello);
  if (!testo) return false;
  /* I segnaposto non fanno un indirizzo valido per `URL`: si tolgono prima. */
  const pulito = testo.replaceAll(/\{-?[a-z]\}/gi, "1");
  let ospite = "";
  try {
    ospite = new URL(pulito).hostname;
  } catch (_errore) {
    const trovato = /^[a-z]+:\/\/([^/?#]+)/i.exec(pulito);
    ospite = trovato ? trovato[1] : "";
  }
  if (!ospite) return false;
  return OSPITI_RITIRATI.some((forma) => forma.test(ospite));
}

/* Quanti fotogrammi si tengono per animare: sei, cioe' l'ultima ora.
 *
 * RainViewer ne pubblica uno ogni dieci minuti e ne tiene un paio d'ore. Sei
 * bastano a vedere da che parte va un fronte — che e' la domanda a cui serve
 * un radar animato — e sono sei giri di quadratini invece di uno: prenderli
 * tutti costerebbe traffico a chi guarda e al servizio, per un pezzo di storia
 * che nessuno sta guardando. */
export const FOTOGRAMMI_ANIMATI = 6;

/**
 * I fotogrammi dell'elenco di RainViewer, dal piu' vecchio al piu' recente.
 *
 * L'elenco ha la forma `{ host, radar: { past: [{ time, path }], nowcast: [...] } }`.
 * Si prendono solo i **passati**, che sono i misurati: i «nowcast» sono
 * previsioni, e un radar che mostra una previsione insieme al presente, senza
 * dirlo, racconta come successa una cosa che non e' successa.
 *
 * Con un elenco storto si torna un elenco vuoto, e chi disegna sa che non c'e'
 * niente da chiedere.
 */
export function fotogrammiRainViewer(elenco, quanti = FOTOGRAMMI_ANIMATI) {
  const host = stringa(elenco?.host);
  if (!host) return [];
  const tetto = Number(quanti);
  const quanti_ = Number.isFinite(tetto) && tetto > 0 ? Math.floor(tetto) : FOTOGRAMMI_ANIMATI;
  const passati = Array.isArray(elenco?.radar?.past) ? elenco.radar.past : [];
  const puliti = passati.filter((voce) => stringa(voce?.path));
  return puliti.slice(-quanti_).map((voce) => {
    const quando = Number(voce.time);
    return {
      host: host.replace(/\/+$/, ""),
      path: stringa(voce.path),
      time: Number.isFinite(quando) ? quando : null,
    };
  });
}

/**
 * Il fotogramma piu' recente dell'elenco di RainViewer, o `null`.
 *
 * E' l'ultimo di quelli sopra: un radar fermo mostra l'adesso, ed e' quello
 * che si vede anche quando l'animazione e' spenta.
 */
export function fotogrammaRainViewer(elenco) {
  const tutti = fotogrammiRainViewer(elenco, FOTOGRAMMI_ANIMATI);
  return tutti.length ? tutti[tutti.length - 1] : null;
}

/**
 * Il modello di indirizzo di un servizio, col suo fotogramma dentro.
 *
 * Torna stringa vuota quando il servizio non si conosce o il fotogramma manca:
 * un modello a meta' chiederebbe quadratini a un indirizzo che non esiste.
 */
export function modelloDelServizio(servizio, fotogramma = null) {
  const scelto = SERVIZI_RADAR[stringa(servizio)];
  if (!scelto) return "";
  let modello = scelto.modello;
  if (modello.includes("{host}") || modello.includes("{path}")) {
    const host = stringa(fotogramma?.host);
    const path = stringa(fotogramma?.path);
    if (!host || !path) return "";
    modello = modello.replaceAll("{host}", host).replaceAll("{path}", path);
  }
  return /\{[zxy]\}/.test(modello) ? modello : "";
}

/**
 * Un modello di indirizzo per ogni fotogramma, nell'ordine in cui sono
 * successi. I fotogrammi che non danno un modello buono restano fuori: un
 * buco in mezzo all'animazione e' un lampo di mappa vuota.
 */
export function modelliDelServizio(servizio, fotogrammi = []) {
  const elenco = Array.isArray(fotogrammi) ? fotogrammi : [];
  return elenco
    .map((fotogramma) => ({ modello: modelloDelServizio(servizio, fotogramma), fotogramma }))
    .filter((voce) => voce.modello);
}

/**
 * Il modello della mappa di fondo, dalla configurazione.
 *
 * `fondo` e' una chiave della tendina — `osm`, `carto` — oppure `modello` con
 * l'indirizzo scritto in `fondoModello`. Chi aveva scritto l'indirizzo dentro
 * `fondo` stesso, com'era prima della tendina, continua a vederlo: un
 * indirizzo con i segnaposto e' un modello, comunque sia arrivato.
 */
/* Quello che c'e' di serie: la pioggia da RainViewer, la mappa sotto da CARTO.
 * «Se metto casa non si vede nulla» era una cornice vuota perche' nessun
 * servizio era scelto; adesso il radar parte con questi, e chi non vuole che
 * la plancia bussi a nessuno sceglie «Nessuno» apposta. */
export const SERVIZIO_DI_SERIE = "rainviewer";
export const FONDO_DI_SERIE = "osm";
export const NIENTE = Object.freeze(["nessuno", "nessuna", "none"]);

export function modelloDelFondo(config = {}) {
  let fondo = stringa(config?.fondo);
  if (NIENTE.includes(fondo.toLowerCase())) return "";
  if (FONDI_RITIRATI[fondo]) fondo = FONDI_RITIRATI[fondo];
  const preset = FONDI_MAPPA[fondo];
  if (preset) return preset.modello;
  const mio = stringa(config?.fondoModello);
  /* Un indirizzo scritto a mano vale finche' il suo servizio risponde: quello
   * di CARTO non risponde piu', e si torna alla mappa di serie invece di
   * disegnare le sue scritte. */
  const dellaSerie = FONDI_MAPPA[FONDO_DI_SERIE].modello;
  if (fondo === "modello") {
    if (!/\{[zxy]\}/.test(mio)) return "";
    return indirizzoRitirato(mio) ? dellaSerie : mio;
  }
  if (/\{[zxy]\}/.test(fondo)) return indirizzoRitirato(fondo) ? dellaSerie : fondo;
  if (!fondo) return dellaSerie;
  return "";
}
