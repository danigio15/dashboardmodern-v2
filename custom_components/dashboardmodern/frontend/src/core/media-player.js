/* Cosa sta suonando in casa (#269).
 *
 * «Sarebbe carino una sezione dedicata ai dispositivi Media Player… sarebbe
 * figo se lo sfondo fosse l'anteprima di ciò che viene riprodotto (la
 * copertina del disco).»
 *
 * Un lettore multimediale è l'unica cosa della casa che ha una faccia sua: il
 * disco che sta girando. Tutto il resto — la temperatura, i watt, una porta
 * aperta — sono numeri e parole, e la plancia li disegna; qui invece
 * l'immagine c'è già, la manda Home Assistant, ed è quella che dice cosa sta
 * succedendo meglio di qualunque scritta.
 *
 * Questo modulo è puro: entrano le voci configurate e gli stati, escono le
 * letture. In particolare esce che cosa quel lettore SA fare — Home Assistant
 * lo dice in un numero, `supported_features`, e da lì si decide quali tasti
 * disegnare. Un tasto «brano precedente» su una radio non è un dettaglio
 * grafico: è un tasto che non fa niente, e chi lo preme pensa sia rotto.
 */

const pulito = (valore) => String(valore ?? "").trim();

export const CHIAVE_MEDIA = "cd_media_player";

/* Quello che Home Assistant impacchetta dentro `supported_features`.
 *
 * Sono i valori di `MediaPlayerEntityFeature`, e non cambiano: sono parte del
 * protocollo, non una convenzione di questa plancia. Qui ci sono solo quelli
 * che si guardano — gli altri esistono e non servono a chi disegna dei tasti. */
export const SA = Object.freeze({
  PAUSA: 1,
  CERCA: 2,
  VOLUME: 4,
  MUTO: 8,
  PRECEDENTE: 16,
  SUCCESSIVO: 32,
  ACCENDI: 128,
  SPEGNI: 256,
  PASSI_VOLUME: 1024,
  SORGENTE: 2048,
  FERMA: 4096,
  SUONA: 16384,
});

const STATI_VIVI = new Set(["playing", "paused", "buffering", "idle", "on", "standby"]);

/** Una voce configurata, ripulita. Senza entità non è una voce. */
export function normalizzaLettore(stored, indice = 0) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  return {
    id: pulito(dato.id) || `lettore-${indice + 1}`,
    entity: pulito(dato.entity),
    nome: pulito(dato.nome || dato.name),
    icona: pulito(dato.icona || dato.icon),
    room_id: pulito(dato.room_id || dato.room),
  };
}

/** I lettori configurati, nell'ordine in cui sono stati messi. */
export function lettoriConfigurati(stored) {
  const righe = Array.isArray(stored) ? stored : [];
  return righe.map((riga, i) => normalizzaLettore(riga, i)).filter((riga) => riga.entity);
}

/** Le entità da tenere d'occhio: serve a chi decide se ridisegnare. */
export function entitaDeiLettori(stored) {
  return [...new Set(lettoriConfigurati(stored).map((riga) => riga.entity))];
}

const numero = (valore) => {
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

/** Un istante ISO in millisecondi, o null se non è un istante. */
export function istante(valore) {
  const testo = pulito(valore);
  if (!testo) return null;
  const quando = Date.parse(testo);
  return Number.isFinite(quando) ? quando : null;
}

/**
 * Cosa dice un lettore adesso.
 *
 * `muto` vuol dire che Home Assistant non lo conosce o non risponde — una cosa
 * diversa da «spento», che invece è una risposta.
 */
export function letturaDelLettore(voce, states = {}, resolve = (valore) => valore) {
  const entity = pulito(voce?.entity);
  let risolta = entity;
  try {
    risolta = pulito(resolve(entity)) || entity;
  } catch (_error) {
    risolta = entity;
  }
  const stato = states?.[risolta] || states?.[entity] || null;
  const grezzo = pulito(stato?.state).toLowerCase();
  const attributi = stato?.attributes || {};
  const muto = !stato || grezzo === "" || grezzo === "unavailable" || grezzo === "unknown";
  const bandiere = Number(attributi.supported_features) || 0;
  const sa = (bandiera) => Boolean(bandiere & bandiera);
  const volume = numero(attributi.volume_level);
  return {
    id: voce?.id || entity,
    entity: risolta || entity,
    nome: pulito(voce?.nome) || pulito(attributi.friendly_name) || entity,
    icona: pulito(voce?.icona),
    room_id: pulito(voce?.room_id),
    muto,
    stato: grezzo,
    acceso: !muto && STATI_VIVI.has(grezzo),
    suona: grezzo === "playing" || grezzo === "buffering",
    inPausa: grezzo === "paused",
    fermo: grezzo === "idle" || grezzo === "on" || grezzo === "standby",
    spento: grezzo === "off",
    titolo: pulito(attributi.media_title),
    artista: pulito(attributi.media_artist || attributi.media_album_artist),
    album: pulito(attributi.media_album_name || attributi.media_series_title),
    applicazione: pulito(attributi.app_name),
    copertina: pulito(attributi.entity_picture),
    volume: volume === null ? null : Math.min(1, Math.max(0, volume)),
    mutato: attributi.is_volume_muted === true,
    sorgente: pulito(attributi.source),
    sorgenti: (Array.isArray(attributi.source_list) ? attributi.source_list : [])
      .map(pulito)
      .filter(Boolean),
    durata: numero(attributi.media_duration),
    posizione: numero(attributi.media_position),
    posizioneAggiornata: istante(attributi.media_position_updated_at),
    puo: {
      pausa: sa(SA.PAUSA) || sa(SA.SUONA),
      precedente: sa(SA.PRECEDENTE),
      successivo: sa(SA.SUCCESSIVO),
      volume: sa(SA.VOLUME),
      passiVolume: sa(SA.PASSI_VOLUME),
      muto: sa(SA.MUTO),
      sorgente: sa(SA.SORGENTE),
      accendi: sa(SA.ACCENDI),
      spegni: sa(SA.SPEGNI),
    },
  };
}

/** Le letture di tutti i lettori configurati. */
export function lettureDeiLettori(stored, states = {}, resolve) {
  return lettoriConfigurati(stored).map((voce) => letturaDelLettore(voce, states, resolve));
}

/**
 * A che punto è il brano, adesso.
 *
 * Home Assistant manda la posizione e l'istante in cui l'ha misurata: mentre
 * suona il tempo continua a scorrere senza che arrivi un nuovo stato, e una
 * barra ferma su un brano che va avanti è peggio di nessuna barra. In pausa
 * invece la posizione è quella e resta quella.
 */
export function posizioneOra(lettura, adesso = Date.now()) {
  const durata = lettura?.durata;
  const posizione = lettura?.posizione;
  if (!Number.isFinite(durata) || durata <= 0 || !Number.isFinite(posizione)) return null;
  let secondi = posizione;
  if (lettura.suona && Number.isFinite(lettura.posizioneAggiornata))
    secondi += Math.max(0, (adesso - lettura.posizioneAggiornata) / 1000);
  const dentro = Math.min(durata, Math.max(0, secondi));
  return { secondi: dentro, durata, quota: durata ? dentro / durata : 0 };
}

/** Minuti e secondi, come li scrive qualunque lettore. */
export function orologio(secondi) {
  if (!Number.isFinite(secondi) || secondi < 0) return "";
  const tutti = Math.floor(secondi);
  const ore = Math.floor(tutti / 3600);
  const minuti = Math.floor((tutti % 3600) / 60);
  const resto = tutti % 60;
  const due = (n) => String(n).padStart(2, "0");
  return ore ? `${ore}:${due(minuti)}:${due(resto)}` : `${minuti}:${due(resto)}`;
}

/**
 * Il servizio da chiamare per il comando chiesto.
 *
 * Il tasto centrale è uno solo e fa tre cose diverse a seconda di com'è messo
 * il lettore: acceso e fermo si fa suonare, spento si accende. Chiamare
 * `media_play_pause` su un lettore spento non dà errore e non fa niente — che
 * da fuori è un tasto rotto.
 */
export function comandoDelLettore(comando, lettura) {
  if (comando === "centro") {
    if (!lettura || lettura.spento) return "turn_on";
    return "media_play_pause";
  }
  if (comando === "precedente") return "media_previous_track";
  if (comando === "successivo") return "media_next_track";
  if (comando === "muto") return "volume_mute";
  if (comando === "volume") return "volume_set";
  if (comando === "sorgente") return "select_source";
  if (comando === "spegni") return "turn_off";
  if (comando === "accendi") return "turn_on";
  return "";
}
