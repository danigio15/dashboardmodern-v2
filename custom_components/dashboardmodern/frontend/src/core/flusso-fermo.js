/* Un flusso che non si muove piu' (#294).
 *
 * «Rispetto alla versione precedente non e' cambiato molto: si blocca la
 * visione.» Un MJPEG e' una risposta che non finisce, e quando la telecamera
 * smette di spingere fotogrammi — Arlo lo fa dopo un po' che nessuno la
 * guarda dal suo telefono — l'`<img>` non riceve nessun errore: resta
 * sull'ultimo fotogramma, fermo, con la scritta LIVE accesa sopra. Non c'e'
 * evento del browser che lo dica: un'immagine multipart carica una volta sola
 * e poi tace.
 *
 * L'unico modo di accorgersene e' guardare i pixel. Ogni tanto si disegna
 * l'immagine su una tela minuscola, se ne prende un'impronta, e se l'impronta
 * non cambia per mezzo minuto il flusso e' fermo: lo si lascia, si torna alle
 * istantanee, e fra un po' si riprova. Mezzo minuto e non dieci secondi,
 * perche' una telecamera puntata su un corridoio vuoto di notte puo' mandare
 * lo stesso fotogramma per dieci secondi e stare benissimo.
 *
 * Qui non c'e' DOM: l'impronta e' aritmetica sui byte, la sorveglianza e' una
 * memoria di impronte con la loro ora. Chi disegna passa i pixel e legge il
 * verdetto.
 */

/* Dopo quanto un'impronta che non cambia vuol dire «fermo». */
export const FERMO_DOPO_MS = 30_000;

/* Ogni quanto si guarda: piu' fitto di cosi' e' lavoro per niente. */
export const OGNI_SGUARDO_MS = 10_000;

/* Il lato della tela su cui si disegna: sedici pixel bastano a dire se un
 * fotogramma e' cambiato, e costano nulla. */
export const LATO_IMPRONTA = 16;

/* Quanto cresce la pazienza, al massimo, con una scena che non si muove.
 *
 * I pixel uguali non distinguono un flusso morto da un corridoio vuoto: una
 * telecamera che manda fotogrammi solo col movimento, o punta su un muro,
 * produce gli stessi pixel per minuti stando benissimo. Condannarla ogni
 * mezzo minuto vorrebbe dire riaprirle il flusso in continuazione. Allora
 * ogni condanna raddoppia la pazienza — trenta secondi, uno, due, quattro
 * minuti — finche' un fotogramma non cambia, che azzera tutto. Il flusso
 * morto davvero si riconosce comunque alla prima, come prima. */
export const PAZIENZA_MASSIMA = 8;

/**
 * L'impronta di un blocco di pixel RGBA.
 *
 * Due somme incrociate, cosi' due fotogrammi con gli stessi colori in ordine
 * diverso non si scambiano per uguali. Non e' crittografia: serve a dire
 * «diverso da prima», non «unico al mondo».
 */
export function improntaDeiPixel(dati) {
  const pixel = dati && typeof dati.length === "number" ? dati : [];
  let a = 0;
  let b = 0;
  for (let at = 0; at + 2 < pixel.length; at += 4) {
    a = (a + (pixel[at] | 0) + (pixel[at + 1] | 0) * 3 + (pixel[at + 2] | 0) * 7) % 1000003;
    b = (b + a) % 1000003;
  }
  return `${pixel.length}:${a}:${b}`;
}

/**
 * La memoria delle impronte, una per immagine.
 *
 * `osserva` risponde «vivo» finche' l'impronta cambia, e «fermo» quando e' la
 * stessa da piu' di `fermoDopo`. Un'immagine appena vista e' viva per
 * definizione: non si condanna nessuno al primo sguardo.
 */
export function creaSorveglianza(fermoDopo = FERMO_DOPO_MS) {
  const viste = new Map();
  /* Quante volte ogni immagine e' stata detta ferma senza che un fotogramma
   * cambiasse: sopravvive a `dimentica`, perche' e' proprio dopo il riavvio
   * che serve ricordarsi che quella scena non si muove. */
  const condanne = new Map();
  return {
    osserva(chiave, impronta, adesso = Date.now()) {
      const prima = viste.get(chiave);
      if (!prima || prima.impronta !== impronta) {
        if (prima && prima.impronta !== impronta) condanne.delete(chiave);
        viste.set(chiave, { impronta, da: adesso });
        return "vivo";
      }
      const volte = condanne.get(chiave) || 0;
      const pazienza = fermoDopo * Math.min(PAZIENZA_MASSIMA, 2 ** volte);
      if (adesso - prima.da < pazienza) return "vivo";
      condanne.set(chiave, volte + 1);
      prima.da = adesso;
      return "fermo";
    },
    pazienza(chiave) {
      return fermoDopo * Math.min(PAZIENZA_MASSIMA, 2 ** (condanne.get(chiave) || 0));
    },
    dimentica(chiave) {
      viste.delete(chiave);
    },
    quante() {
      return viste.size;
    },
  };
}
