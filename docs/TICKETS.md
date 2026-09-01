# Segnalazioni: dal salotto di chi la usa alla scrivania di chi la scrive

Fino a oggi una segnalazione arriva per una strada sola: l'utente esce da Home
Assistant, apre GitHub, si fa un account se non ce l'ha, e compila un modulo
che gli chiede la versione dell'integrazione — che lui non sa, e che la plancia
invece conosce. Le tre domande che i template fanno per prime
(`integration-version`, `ha-version`, `hacs-category`) esistono proprio perche'
quella strada perde per via le uniche cose che si potevano leggere da sole.

Questo documento descrive la strada corta: il ticket nasce dentro la plancia,
con la diagnostica gia' compilata, e arriva in una console dove lo si lavora.

## Le tre cose che un utente vuole dire

| Tipo | Cos'e' | Dove finisce |
| --- | --- | --- |
| `bug` | Qualcosa non funziona come dovrebbe | Console, poi eventualmente una issue pubblica |
| `feature` | Vorrei che facesse anche questo | Console, poi eventualmente una issue pubblica |
| `assistenza` | Non riesco a configurarlo / non capisco | Console, e basta |

La terza e' quella che oggi non ha casa. Una richiesta di assistenza contiene
il nome delle stanze, gli `entity_id` dell'impianto, spesso una foto della
casa: e' esattamente il materiale che non si mette in un tracker pubblico. Il
sistema quindi non tratta i tre tipi allo stesso modo, e la differenza non e'
un'etichetta ma il posto dove il ticket va a finire.

## Il vincolo che decide la forma

La plancia gira dentro un iframe `about:srcdoc` e **non possiede nessun token
di Home Assistant**: parla con HA solo attraverso il BridgeSocket, che accetta
esclusivamente i tipi elencati in `ALLOWED_MESSAGE_TYPES`
(`frontend/src/legacy/bridge-socket.js`). Il precedente e' gia' scritto in
casa: il caricamento delle foto e' passato dal REST al WebSocket perche' «ogni
chiamata REST del browser rispondeva 401» (`websocket_api.py`).

Da qui discende tutto il resto:

* **La chiamata verso l'esterno la fa Python, non il browser.** Nessun CORS,
  nessuna CSP da negoziare, e un eventuale segreto resta lato server invece che
  dentro un bundle JavaScript che chiunque puo' leggere. E' lo stesso mestiere
  che `update.py` fa gia' per chiedere a GitHub l'ultima release.
* **Il browser vede solo tre comandi WebSocket**, aggiunti all'allowlist:
  `tickets/list`, `tickets/create`, `tickets/sync`.

## Il giro completo

```text
   Plancia dell'utente                 Casa dell'utente            Fuori
 ┌──────────────────────┐        ┌────────────────────────┐   ┌─────────────┐
 │ Configurazione       │        │ Home Assistant         │   │             │
 │  └ Segnalazioni      │        │  └ dashboardmodern     │   │   Relay     │
 │      • nuovo ticket  │──WS───▶│      • ticket_store    │──▶│  (Worker)   │
 │      • i miei ticket │◀───────│      • ticket_client   │◀──│   + D1      │
 └──────────────────────┘        └────────────────────────┘   └──────┬──────┘
                                                                     │
                                                              ┌──────▼──────┐
                                                              │  Console    │
                                                              │ manutentore │
                                                              └─────────────┘
```

Tre proprieta' sono volute:

1. **Il ticket esiste anche se il relay e' spento.** Nasce nello store locale
   con stato `bozza`, e la consegna e' un secondo momento che puo' fallire e
   riprovare. Chi scrive una segnalazione alle due di notte mentre il Worker e'
   in manutenzione non perde quello che ha scritto.
2. **Lo stato torna indietro.** La console cambia lo stato, la plancia lo
   ripesca alla `sync` e chi ha aperto il ticket vede «presa in carico» o
   «risolta in beta.21» senza chiedere niente a nessuno. E' la parte che fa la
   differenza fra un modulo di contatto e un sistema di ticket: senza, la
   stessa segnalazione arriva tre volte.
3. **Il relay e' facoltativo e spento di suo.** Chi tiene la plancia su una
   rete senza uscita non deve accorgersi che questa parte esiste, esattamente
   come per il controllo aggiornamenti (`OPTION_CHECK_UPDATES`).

## Cosa viaggia, e cosa non viaggia

Un ticket che parte porta con se':

* tipo, titolo, corpo scritti dall'utente;
* versione dell'integrazione, versione di Home Assistant, lingua, tipo di
  installazione — le cose che la plancia sa e l'utente no;
* un identificativo di installazione: un UUID casuale generato una volta,
  senza rapporto con l'`entry_id`, con l'utente HA o con la rete. Serve a due
  cose sole: raggruppare i ticket della stessa persona per rispondere, e
  contare le richieste per fermare gli abusi.
* un contatto **solo se l'utente lo scrive**, campo facoltativo e vuoto di suo.

Non viaggia mai: l'URL di Home Assistant, token o credenziali di qualunque
tipo, l'elenco delle entita', la posizione, il nome degli utenti HA,
l'indirizzo e-mail dell'account. La diagnostica e' quella dichiarata sopra e
nient'altro: e' una lista chiusa nel codice, non un `dict` raccolto a runtime.

L'utente vede cosa sta per partire prima di premere invio. Questo non e' un
dettaglio di cortesia: e' la condizione perche' la cosa sia difendibile.

## Il relay

Sta in `services/ticket-relay/`: un Worker Cloudflare (piano gratuito: 100k
richieste al giorno) con un database D1. Tiene il token verso GitHub — se e
quando un ticket viene promosso a issue pubblica — e non lo cede a nessuno.
Istruzioni di deploy nel suo README; finche' non e' in piedi, tutto il resto
funziona lo stesso.

Quattro percorsi:

```text
POST /ticket   pubblico    una segnalazione nuova        -> { id }
POST /sync     pubblico    lo stato dei PROPRI ticket    -> { tickets }
POST /queue    con chiave  la coda del manutentore       -> { tickets }
POST /answer   con chiave  stato, risposta, promozione   -> { ok, issue_url }
```

**«I propri» in `/sync` non e' un modo di dire**, ed e' la regola piu'
importante di tutto il servizio: la richiesta porta l'identificativo
dell'installazione e la risposta contiene solo i ticket di quella. Senza quel
vincolo chiunque conoscesse un identificativo leggerebbe le segnalazioni degli
altri — comprese le richieste di assistenza, che sono quelle che portano il
nome delle stanze e le foto di casa.

L'endpoint sta dentro codice sorgente pubblico, quindi e' pubblico: le difese
non sono un dettaglio da rimandare.

* tetto di 64 KB sul corpo, e tetti per campo uguali a quelli dello store —
  ripetuti apposta, perche' chi chiama puo' non essere una plancia affatto;
* sei segnalazioni all'ora per installazione, venti per rete;
* dell'indirizzo si conserva un'impronta con sale segreto, mai l'indirizzo;
* la chiave della console si confronta senza uscire alla prima differenza;
* nessuna intestazione CORS: lo chiama il backend di Home Assistant, non un
  browser, e cosi' una pagina qualunque non ne puo' leggere le risposte;
* interruttore generale, per spegnere tutto senza ridistribuire l'integrazione;
* nessuna scrittura su GitHub automatica: la promozione a issue pubblica e' un
  gesto che si fa dalla console, a ticket letto — e un `assistenza` non si
  promuove mai, per costruzione.

## La console

Sta dentro la plancia, in una sezione che si accende solo quando l'opzione
`maintainer_token` e' valorizzata nel config entry: chi non e' il manutentore
non la vede e, soprattutto, non la puo' chiamare — il token viaggia dal
backend, non dal browser, e non compare mai nella configurazione condivisa che
tutti gli utenti della plancia possono leggere.

Mostra la coda per stato, permette di rispondere, di cambiare stato, e di
promuovere un `bug` o una `feature` a issue pubblica quando merita di essere
discussa in piazza.

## Fasi

| Fase | Contenuto | Stato |
| --- | --- | --- |
| 1 | Store locale, comandi WS, modulo nella plancia, elenco dei propri ticket | fatta |
| 2 | Client di trasporto, `sync` dello stato | fatta |
| 3 | Worker + D1, console manutentore | scritta, da mettere in piedi |
| 4 | Promozione a issue GitHub dalla console | scritta, chiede `GITHUB_TOKEN` |

Le prime due funzionano da sole: senza indirizzo configurato la plancia
conserva le segnalazioni in casa e lo dice, invece di mostrare un tasto
«invia» che non spedisce niente. La terza e la quarta chiedono un account
Cloudflare e un `wrangler deploy`.

## Il limite da dire subito

La classe di segnalazione per cui i template GitHub sono stati scritti —
«scaricata, riavviato, non compare» — **non potra' mai arrivare da qui**: chi
non vede la plancia non ha un modulo da compilare. I template restano dove
sono, e questa strada intercetta i problemi d'uso, non quelli d'installazione.
