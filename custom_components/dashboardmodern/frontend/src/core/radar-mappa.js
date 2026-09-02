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
  if (lat !== null && lon !== null)
    return { lat, lon, da: "casa", nome: stringa(dellaCasa.friendly_name) };
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
