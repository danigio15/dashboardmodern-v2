/* Di chi sono le due foto dell'auto.
 *
 * La plancia tiene le foto in due caselle sole — quella con il cavo staccato e
 * quella con il cavo attaccato — perche' quando le auto erano una sola bastava
 * cosi'. Con due profili quelle caselle non sono piu' un posto dove abitare: la
 * foto e' dell'auto, come lo sono il nome e le sue entita', e chi cambia auto
 * deve vedere cambiare la fotografia.
 *
 * Qui non c'e' DOM e non c'e' localStorage: solo di chi sono le foto e cosa
 * mostrare quando un profilo non ne ha. Il resto — leggere, scrivere, disegnare
 * — sta nella sezione.
 */

const clean = (value) => String(value ?? "").trim();

/* Come si chiamano dentro al profilo. `img` e' il nome che la plancia usa da
 * sempre per la prima; la seconda non esisteva e prende il nome della prima. */
export const PROFILE_PHOTO_FIELDS = Object.freeze({ idle: "img", plugged: "imgPlugged" });

/** Le foto che questo profilo si porta dietro. */
export function profilePhotos(car = {}) {
  return {
    idle: clean(car?.[PROFILE_PHOTO_FIELDS.idle]),
    plugged: clean(car?.[PROFILE_PHOTO_FIELDS.plugged]),
  };
}

/* Cosa mostrare per l'auto appena scelta.
 *
 * Con una macchina sola le due caselle sono ancora casa sua: un profilo senza
 * foto tiene quella che c'era, che e' esattamente quello che ogni
 * configurazione a una macchina ha sempre fatto, e nessuno si vede sparire una
 * foto passando a questa versione.
 *
 * Da due in su no: se il profilo non ha una foto, quell'auto non ha una foto —
 * mostrarle quella dell'altra e' come scriverle il nome dell'altra. Era questo
 * che faceva sembrare le due auto la stessa. */
export function photosForProfile(car, current = { idle: "", plugged: "" }, profileCount = 1) {
  const proprie = profilePhotos(car);
  if (profileCount > 1) return proprie;
  return {
    idle: proprie.idle || clean(current.idle),
    plugged: proprie.plugged || clean(current.plugged),
  };
}

/** L'elenco delle auto con le foto scritte dentro a quella scelta. */
export function withProfilePhotos(cars, index, photos = {}) {
  if (!Array.isArray(cars) || !cars.length) return cars;
  const posizione = Number.isInteger(index) ? Math.max(0, Math.min(cars.length - 1, index)) : 0;
  const attuale = profilePhotos(cars[posizione]);
  const prossime = { idle: clean(photos.idle), plugged: clean(photos.plugged) };
  if (attuale.idle === prossime.idle && attuale.plugged === prossime.plugged) return cars;
  return cars.map((car, posto) =>
    posto === posizione
      ? {
          ...car,
          [PROFILE_PHOTO_FIELDS.idle]: prossime.idle,
          [PROFILE_PHOTO_FIELDS.plugged]: prossime.plugged,
        }
      : car,
  );
}

/* Le foto che c'erano prima, date all'auto che le stava mostrando.
 *
 * Una configurazione fatta con le versioni precedenti ha le foto nelle due
 * caselle della plancia e i profili vuoti: da qui in avanti le foto sono
 * dell'auto, e senza questo passaggio quella configurazione se le vedrebbe
 * sparire da tutte e due le macchine. Le prende l'auto che era selezionata,
 * perche' e' quella a cui appartenevano davvero — l'altra resta senza, ed e'
 * corretto: una foto sua non l'ha mai avuta.
 *
 * Succede una volta: appena un profilo ha una foto, non c'e' piu' niente da
 * adottare. */
export function adoptLoosePhotos(cars, index, current = { idle: "", plugged: "" }) {
  if (!Array.isArray(cars) || cars.length < 2) return cars;
  if (cars.some((car) => profilePhotos(car).idle || profilePhotos(car).plugged)) return cars;
  const foto = { idle: clean(current.idle), plugged: clean(current.plugged) };
  if (!foto.idle && !foto.plugged) return cars;
  return withProfilePhotos(cars, index, foto);
}
