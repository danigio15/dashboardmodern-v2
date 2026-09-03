# La chat di assistenza: una porta che non passa da GitHub

## Cosa si e' chiesto, e cosa era stato consegnato

> «Io avevo chiesto una chat di assistenza che non deve passare per GitHub. E'
> come se fosse una chat Teams.»

Quello che c'era prima era un'altra cosa. La finestra delle Segnalazioni apre
una issue di questa repository e sotto quella issue si scrivono commenti: un
filo, non una conversazione. Per scriverci serve un account GitHub, e quello
che si scrive resta **pubblico per sempre**, indicizzato, col nome di chi l'ha
scritto sopra.

Va benissimo per un difetto — un difetto e' esattamente una cosa che deve
restare scritta, pubblica e ritrovabile. Non va per chi vuole chiedere aiuto:
chi chiede aiuto incolla un pezzo di configurazione, il nome delle proprie
entita', a volte una foto della propria casa. E chi guarda la plancia non e'
sempre chi l'ha installata: e' anche chi vive in quella casa e su GitHub non ci
e' mai stato.

## L'errore che c'era in `TICKETS.md`

Quel documento ha una sezione, «Perche' non c'e' un servizio di mezzo», che
diceva: un relay non serve, perche' chiunque abbia questa plancia ha gia' fatto
il giro dell'autorizzazione GitHub per installare HACS.

E' vero, e non c'entra. Quella frase rispondeva alla domanda **«riusciamo a
raggiungere quella persona?»**, che non era la domanda. La domanda e' **«e'
giusto che una richiesta di aiuto diventi un cartello pubblico?»**, e la
risposta e' no. Una conversazione privata ha bisogno di un posto privato, e un
posto privato bisogna tenerlo su.

Le due cose convivono, e ognuna fa il suo:

| | Segnalazioni | Chat |
|---|---|---|
| a cosa serve | un difetto, un'idea | chiedere aiuto |
| dove finisce | issue pubblica su GitHub | conversazione privata |
| serve un account | si', GitHub | no |
| resta scritto | per sempre, e cosi' deve essere | finche' serve |

## Il vincolo che decide la forma

La plancia gira dentro **Home Assistant di casa d'altri**. Il Home Assistant di
chi chiede aiuto e quello di chi risponde non si conoscono e non si parlano: non
c'e' nessun canale fra due case.

Percio' serve un **punto d'incontro** che entrambe possano raggiungere. GitHub
faceva quel mestiere: era gratis, era gia' li', e sapeva gia' chi fosse chi.
Toltolo, il punto d'incontro va messo da qualche parte.

Non esiste un modo di evitarlo. Ogni alternativa che non ha un servizio in mezzo
finisce con **una credenziale del manutentore dentro le case degli altri** — un
token di bot, una chiave d'API — e una credenziale distribuita a centinaia di
installazioni e' una credenziale pubblica: viene letta il primo giorno da chi
apre il file, e da quel momento chiunque puo' scrivere a nome di chi la plancia
la mantiene.

## La forma scelta: il centralino

Un servizio minuscolo su Cloudflare Workers, con un database D1. Sta in
`centralino/`, si mette su con un comando, e nella fascia gratuita non costa
niente: 100.000 richieste al giorno, e una plancia ne fa **dodici all'ora**.

```text
   Casa di chi chiede                Cloudflare              Casa di chi risponde
 ┌──────────────────────┐    ┌──────────────────────┐   ┌──────────────────────┐
 │ Home Assistant       │    │  centralino (Worker) │   │ Home Assistant       │
 │  └ dashboardmodern   │───▶│   • /casa/messaggi   │◀──│  └ dashboardmodern   │
 │      • chat_client   │◀───│   • /console/...     │──▶│      • Cruscotto     │
 │      • id della casa │    │  D1: case, messaggi  │   │      • chiave console│
 └──────────────────────┘    └──────────────────────┘   └──────────────────────┘
        anonima                   niente di piu'              una persona sola
```

**La chiamata la fa Python, non il browser.** Come per le segnalazioni: la
plancia non ha nessun token, parla solo col BridgeSocket, e il segreto della
casa resta nel backend invece che dentro un bundle JavaScript che chiunque puo'
leggere.

## Chi e' chi, senza sapere chi e'

Alla prima apertura della chat la casa si fabbrica da sola due numeri casuali e
li tiene su disco:

* un **nome di casa** — 128 bit, `casa_9f3a…` — che non dice niente di nessuno;
* un **segreto** — 256 bit — che dimostra al centralino di essere la stessa
  casa di ieri.

Al primo messaggio il centralino vede quel nome per la prima volta, si scrive
l'impronta del segreto (`sha256`) e da li' in poi apre solo a chi la sa. Nessuna
registrazione, nessuna email, nessun account: chi chiede aiuto non deve fare
niente prima di scrivere.

**Cosa vuol dire davvero, e cosa no.** Il segreto non finisce nel browser e non
finisce nell'archivio: la plancia non lo vede mai — parla col proprio Home
Assistant, che e' quello che lo custodisce — e nel database c'e' solo la sua
impronta, quindi chi si trovasse in mano l'archivio non potrebbe scrivere a nome
di nessuno.

Ma il segreto **viaggia**. Ogni richiesta lo porta al centralino come
`Authorization: Bearer`, ed e' li' che viene confrontato: dentro TLS, e a un
servizio che e' lo stesso a cui si sta scrivendo, ma ci va. Dire «non esce mai
dalla casa» — come diceva questa pagina fino a ieri — era comodo e falso. Per
non farlo viaggiare servirebbe una firma invece di una password, ed e' una cosa
che si puo' fare: non e' stata fatta, e finche' non lo e' va detto cosi'.

Il nome della casa e' irrobustito da 128 bit di caso: indovinarlo per prendersi
la conversazione di un altro non e' una cosa che si prova.

Chi vuole farsi chiamare per nome puo' scriverlo — e' un campo libero, sta alla
persona. Il centralino non lo chiede.

## Chi risponde

Una chiave sola, `CHIAVE_CONSOLE`, che sta come segreto del Worker e nella
configurazione del Home Assistant di chi mantiene la plancia. Con quella si
vede l'elenco delle conversazioni e si risponde; senza, non si vede niente.

Non e' un ruolo, e' una chiave: se un giorno i manutentori sono due, sono due
chiavi.

## Cosa viaggia, e cosa non viaggia

Viaggia **solo quello che la persona ha scritto**, piu' tre cose che servono a
capirla senza doverle chiedere: la versione della plancia, la versione di Home
Assistant, la lingua.

Non viaggia niente altro. Nessuna entita', nessuno stato, nessun token, nessun
indirizzo, nessun identificativo del Home Assistant, nessun IP tenuto in
archivio. Il centralino non e' un posto dove si guarda dentro le case: e' una
buca delle lettere con due sportelli.

## I limiti, scritti prima che servano

Un servizio aperto al mondo senza limiti e' un servizio che qualcuno riempie.

* **4.000 caratteri** per messaggio.
* **20 messaggi all'ora** per casa. Chi ne scrive di piu' non sta chiedendo
  aiuto.
* **200 messaggi** conservati per conversazione: oltre, i piu' vecchi se ne
  vanno. Una chat di assistenza non e' un archivio.
* **Una casa ferma da 180 giorni** viene cancellata, conversazione compresa.
  Tenere per sempre le parole di chi non torna piu' non serve a nessuno dei due.

## Il prezzo da dire, e la plancia lo dice

Chi apre la chat per la prima volta legge, prima di scrivere:

> Quello che scrivi qui arriva a chi mantiene la plancia, e a nessun altro.
> Viaggia su un servizio suo, non su GitHub, e non diventa pubblico. Insieme al
> messaggio partono solo la versione della plancia, quella di Home Assistant e
> la lingua. Puoi cancellare la conversazione quando vuoi.

E il tasto per cancellarla c'e' davvero: cancella la casa dal centralino, non
solo dallo schermo.

## Quello che questa chat non e'

* **Non e' assistenza garantita.** Dall'altra parte c'e' una persona sola, che
  la plancia la scrive nel tempo libero. La chat dice quando e' stata letta, non
  promette quando avra' risposta.
* **Non e' un posto per i difetti.** Un difetto va nelle Segnalazioni, dove
  diventa una issue e non si perde. Se in chat arriva un difetto, chi risponde
  lo sposta di la'.
* **Non e' cifrata da capo a capo.** Chi tiene il centralino puo' leggere: e'
  la stessa persona a cui stai scrivendo, ma va detto invece che lasciato
  intendere.
