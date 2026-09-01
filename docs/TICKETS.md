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

| Tipo | Cos'e' | Titolo della issue |
| --- | --- | --- |
| `bug` | Qualcosa non funziona come dovrebbe | `[Bug]: …` |
| `feature` | Vorrei che facesse anche questo | `[Feature]: …` |
| `assistenza` | Non riesco a configurarlo / non capisco | `[Aiuto]: …` |

Tutte e tre diventano una issue pubblica, e il prefisso e' lo stesso che i
moduli su GitHub gia' usano. La terza e' quella su cui vale la pena tornare
dopo le prime segnalazioni vere: una richiesta di assistenza porta il nome
delle stanze e a volte le foto di casa, e finisce su una pagina che chiunque
puo' leggere. Oggi la scelta e' **dirlo forte prima di spedire**, non
nasconderlo — e il recapito, che e' l'unica cosa davvero personale, non parte
comunque.

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
* **Il browser vede solo i comandi elencati nell'allowlist**: i sei delle
  segnalazioni (`list`, `create`, `delete`, `sync`, `queue`, `answer`) e i tre
  dell'autorizzazione (`auth/start`, `auth/poll`, `auth/forget`). Nessuno di
  essi porta un segreto: il gettone GitHub sta nel backend e non passa di qui.

## Il giro completo

```text
   Plancia dell'utente              Casa dell'utente              github.com
 ┌──────────────────────┐    ┌──────────────────────────┐   ┌────────────────┐
 │ Configurazione       │    │ Home Assistant           │   │                │
 │  └ Segnalazioni      │    │  └ dashboardmodern       │   │   Issue #42    │
 │      • nuova         │─WS▶│      • ticket_store      │──▶│   (pubblica,   │
 │      • le mie        │◀───│      • github_tokens     │◀──│    a suo nome) │
 │      • console       │    │      • github_client     │   │                │
 └──────────────────────┘    └──────────────────────────┘   └───────┬────────┘
                                                                    │ commento
   Plancia del manutentore                                          │
 ┌──────────────────────┐                                           │
 │  └ Segnalazioni      │───────────── risponde ────────────────────┘
 │      • console       │
 └──────────────────────┘
```

Tre proprieta' sono volute:

1. **Il ticket esiste anche prima di partire.** Nasce nello store locale con
   stato `bozza`, e la consegna e' un secondo momento che puo' fallire e
   riprovare. Chi scrive alle due di notte con la rete che va e viene — o senza
   aver ancora collegato GitHub — non perde quello che ha scritto.
2. **Lo stato torna indietro.** La console cambia lo stato, la plancia lo
   ripesca alla `sync` e chi ha aperto il ticket vede «presa in carico» o
   «risolta in beta.21» senza chiedere niente a nessuno. E' la parte che fa la
   differenza fra un modulo di contatto e un sistema di ticket: senza, la
   stessa segnalazione arriva tre volte.
3. **L'invio e' facoltativo.** Chi tiene la plancia su una rete senza uscita
   non deve accorgersi che questa parte esiste, esattamente come per il
   controllo aggiornamenti (`OPTION_CHECK_UPDATES`).

## Cosa viaggia, e cosa non viaggia

Un ticket che parte porta con se':

* tipo, titolo, corpo scritti dall'utente;
* versione dell'integrazione, versione di Home Assistant, lingua, pagina da
  cui e' stata scritta, browser — le cose che la plancia sa e l'utente no.

Non viaggia mai: l'URL di Home Assistant, token o credenziali di qualunque
tipo, l'elenco delle entita', la posizione, il nome degli utenti HA,
l'indirizzo e-mail dell'account. E **non viaggia il recapito**, anche quando
l'utente lo scrive: quello resta in casa, per la console.

La diagnostica e' quella dichiarata sopra e nient'altro: e' una lista chiusa
nel codice, non un `dict` raccolto a runtime.

L'utente vede cosa sta per partire prima di premere invio. Questo non e' un
dettaglio di cortesia: e' la condizione perche' la cosa sia difendibile.

## Perche' non c'e' un servizio di mezzo

La prima versione di questo progetto prevedeva un relay: un piccolo servizio da
tenere in piedi, con un database, un segreto da custodire e una superficie da
difendere dagli abusi. Serviva a raggiungere le persone che su GitHub non
c'erano.

Quelle persone non esistono. **La plancia si scarica da HACS, e HACS un account
GitHub lo chiede gia'** — chiede anche la stessa identica autorizzazione, il
codice da digitare su `github.com/login/device`. Chi ha questa plancia
installata quel giro l'ha gia' fatto una volta, e lo riconosce.

Quindi la segnalazione va dritta dove deve andare: diventa una issue di questa
repository, aperta a nome di chi l'ha scritta. Niente servizio, niente
database, niente segreto, niente antispam da scrivere: quello di GitHub e' gia'
li'. E il manutentore le riceve dove riceve tutto il resto.

## Il giro dell'autorizzazione

```text
  plancia            backend                 github.com
     │                  │                        │
     │ «collega» ──────▶│  POST /login/device/code
     │                  │───────────────────────▶│
     │◀── ABCD-1234 ────│◀───────────────────────│
     │                  │
   l'utente digita il codice su github.com/login/device
     │                  │  POST /login/oauth/access_token
     │                  │───────────────────────▶│   (ogni `interval` secondi)
     │◀── collegato ────│◀──── gho_… ────────────│
```

**Il gettone non arriva mai al browser.** Nasce nel backend, resta nel suo
deposito (`github_tokens.py`, un file separato da quello dei ticket perche'
sono credenziali e hanno una vita loro) e viaggia solo verso `api.github.com`.
Verso la plancia torna indietro chi ha autorizzato e se e' lui a tenere la
repository: quello serve a disegnare la finestra, il gettone no.

Uno per utente di Home Assistant, non uno per casa: chi apre una segnalazione
la apre a suo nome, e in una casa con quattro persone sarebbe sbagliato che le
segnalazioni di tutte comparissero sotto l'account di chi ha installato
l'integrazione.

## Lo stato non si tiene allineato a mano

Non c'e' uno stato da sincronizzare fra due posti: lo sa gia' GitHub, e la
plancia lo deduce.

| Sulla issue | In plancia |
| --- | --- |
| non ancora aperta | `bozza` |
| aperta, nessun commento del manutentore | `inviato` |
| aperta, con un commento del manutentore | `in-carico` |
| chiusa come *completed* | `risolto` |
| chiusa come *not planned* | `chiuso` |

«Del manutentore» lo dice GitHub stesso su ogni commento, con
`author_association`: nessuna chiamata in piu' e nessuna lista di nomi da
tenere aggiornata.

## Foto e video

**GitHub non ha un'API per allegare file a una issue**, e non e' una svista: e'
una scelta loro, dichiarata, per contenere gli abusi. Gli aggiri che circolano
replicano il flusso del browser su `uploads.github.com/user-attachments`, un
endpoint non documentato che GitHub non espone di proposito. Spedirlo a
migliaia di installazioni HACS vorrebbe dire che il giorno in cui viene chiuso
si rompono tutte insieme, in silenzio.

Quindi la plancia non finge di spedirli: manda dove il flusso ufficiale esiste.
Appena la segnalazione e' aperta compare un riquadro col suo numero e un tasto
che porta alla sua pagina, dove foto e video si trascinano nel riquadro della
risposta. Il momento e' quello giusto — chi ha appena scritto ha ancora il file
sotto mano — e nel modulo c'e' gia' una riga che lo anticipa, perche' non sia
una sorpresa.

**Da li' in poi pero' l'allegato torna dentro la plancia.** Una volta
trascinato, vive nel testo del commento come un indirizzo, e quel testo l'API
lo restituisce: la coda mostra `📎 2` e `💬 3` sulla scheda — il conto arriva
dall'elenco, senza chiedere niente in piu' — e «Vedi tutto» apre il filo
intero: il testo della segnalazione, ogni commento con chi l'ha scritto e
quando, e gli allegati come schede. Delle immagini si tenta l'anteprima; se la
CSP di Home Assistant non le lascia passare, la scheda diventa un rimando,
che e' sempre meglio di un riquadro rotto.

Gli indirizzi non portano l'estensione — da `…/assets/<uuid>` non si capisce se
sia una foto o un video — quindi si guarda la sintassi intorno: `![](…)` e'
un'immagine, tutto il resto resta «allegato» senza inventargli una faccia.

Le tre strade che porterebbero l'allegato su GitHub da sole, e perche' non sono
state prese:

| Strada | Costa |
| --- | --- |
| L'endpoint non documentato | Si rompe tutto insieme quando GitHub lo chiude |
| Una repository dell'utente che ospita i file | Obbliga allo scope `public_repo` — scrittura su tutte le sue repository pubbliche — e crea una repository a casa sua senza che l'abbia chiesto |
| Un servizio proprio per i soli allegati | E' il relay che si e' tolto, con in piu' spazio da pagare e una superficie d'abuso peggiore: il testo si legge, un file no |

Se un giorno una di queste diventasse accettabile, il punto in cui innestarla e'
uno solo: `github_client.async_create_issue`.

## Il prezzo da dire, e la plancia lo dice

Una issue e' **una pagina pubblica**. Chi apre una segnalazione la pubblica a
suo nome, e chiunque potra' leggerla. La finestra lo scrive sopra il tasto
«invia», accanto a cosa esattamente viene mandato — non e' una cosa da far
scoprire dopo.

Una sola cosa non passa mai di la': il **recapito**. Chi ha scritto il proprio
indirizzo lo ha scritto a una persona, non a una pagina indicizzata dai motori
di ricerca: resta in casa, dove il manutentore lo legge dalla console.

Questo pesa soprattutto sul tipo `assistenza`, che e' quello che porta il nome
delle stanze e a volte le foto. Vale la pena rivederlo dopo le prime
segnalazioni vere: la scelta di oggi e' dirlo forte, non nasconderlo.

## La console

Sta dentro la plancia, ed e' la terza linguetta della stessa finestra. Si
accende da sola quando chi guarda e' insieme **amministratore di Home
Assistant** e un account GitHub che **sulla repository puo' scrivere**.

La seconda meta' non e' una chiave da incollare da qualche parte: e' GitHub a
dirla. Cosi' la console compare sulla plancia giusta senza che nessuno
configuri niente, e il giorno in cui la repository cambia mano non resta una
chiave scritta a dare un permesso che non c'e' piu'.

Mostra le segnalazioni nate dalle plance — si riconoscono da una riga
invisibile nel corpo, non da un'etichetta, perche' GitHub le etichette le
scarta quando a scriverle e' chi i permessi non li ha, cioe' esattamente chi
apre le segnalazioni. Da li' si risponde: la risposta e' un commento sotto la
issue, quindi la legge chi ha segnalato — dentro la sua plancia, al primo giro
di sync — e la legge chiunque passi da GitHub. Un posto solo, non due da tenere
allineati.

## L'applicazione, e com'e' registrata

E' una **GitHub App** — «DashboardModern Segnalazioni», di @danigio15 — con un
permesso solo: *Issues: Read and write*. Il suo `client_id` sta in `const.py`,
in chiaro, ed e' giusto cosi': nel device flow non esiste un `client_secret` da
spedire, e lo stesso identificativo compare gia' nella pagina pubblica
dell'App.

**Non c'e' nessuna chiave privata**, da nessuna parte. Servirebbe per
autenticarsi *come* l'App — generare installation token, ricevere webhook — e
qui non succede mai: si parla sempre e solo a nome di chi ha autorizzato. Al
primo salvataggio GitHub avvisa che «devi generare una chiave privata per
installare l'App»: e' vero per chi la installa, e questa non ha bisogno di
essere installata da nessuno.

Le tre caselle che contano, nella registrazione:

| Casella | Come | Perche' |
| --- | --- | --- |
| **Enable Device Flow** | accesa | senza, il codice non viene mai generato |
| **Expire user authorization tokens** | **spenta** | il codice non gestisce il `refresh_token`. Accesa, il gettone morirebbe dopo otto ore e ognuno rifarebbe il codice quasi ogni volta — e non basterebbe implementare il refresh, perche' anche quello scade dopo sei mesi, e chi segnala un bug ogni tanto lo troverebbe gia' morto |
| **Webhook · Active** | spenta | non ne serve nessuno: la plancia interroga GitHub, non viceversa |

L'alternativa scartata era un'**applicazione OAuth** con scope `public_repo`.
Funziona identica — gli endpoint del device flow sono gli stessi, cambia solo
`GITHUB_SCOPE` — ma quello scope da' accesso in scrittura a *tutte* le
repository pubbliche di chi autorizza, per aprire una segnalazione. La App
chiede quello che serve e nient'altro, e non viene installata sulle repository
di nessuno.

## Il limite da dire subito

La classe di segnalazione per cui i template GitHub sono stati scritti —
«scaricata, riavviato, non compare» — **non potra' mai arrivare da qui**: chi
non vede la plancia non ha un modulo da compilare. I template restano dove
sono, e questa strada intercetta i problemi d'uso, non quelli d'installazione.
