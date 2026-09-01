# Il relay delle segnalazioni

L'unico pezzo del sistema che non gira in casa di chi usa la plancia. Riceve i
ticket, li conserva, e li fa rileggere alla console del manutentore.

Finche' non esiste, tutto il resto funziona lo stesso: le segnalazioni si
scrivono, si conservano e si rileggono in casa, e la plancia dice che il
servizio non e' configurato invece di mostrare un tasto «invia» che non
spedisce niente.

## Cosa serve

Un account Cloudflare — il piano gratuito basta e avanza: 100.000 richieste al
giorno, e una segnalazione ne costa una — e `wrangler` installato.

## Primo deploy

```bash
cd services/ticket-relay
npx wrangler d1 create dashboardmodern-tickets
# copia l'id stampato dentro database_id in wrangler.toml
npx wrangler d1 execute dashboardmodern-tickets --remote --file=./schema.sql

npx wrangler secret put MAINTAINER_TOKEN   # la chiave della console
npx wrangler secret put IP_SALT            # una stringa casuale, e basta
npx wrangler secret put GITHUB_TOKEN       # facoltativo, vedi sotto

npx wrangler deploy
```

`wrangler deploy` stampa l'indirizzo. Da li' in poi:

* **nell'integrazione**, Impostazioni → Dispositivi e servizi →
  DashboardModern → Configura: incolla l'indirizzo in «Indirizzo del servizio
  segnalazioni». Oppure, per farlo valere per tutti senza che nessuno debba
  incollare niente, scrivilo in `TICKET_RELAY_URL` dentro `const.py` e
  pubblica una release;
* **sulla tua installazione**, nello stesso posto, incolla `MAINTAINER_TOKEN`
  in «Chiave della console manutentore». Da quel momento la finestra delle
  segnalazioni mostra una terza linguetta, **Console**, con la coda di tutte
  le case.

## I segreti

| Nome | Serve a | Obbligatorio |
| --- | --- | --- |
| `MAINTAINER_TOKEN` | Aprire la console. Senza, `/queue` e `/answer` rispondono 401 a chiunque. | si' |
| `IP_SALT` | Rendere l'impronta dell'indirizzo non ricalcolabile da fuori. | si' |
| `GITHUB_TOKEN` | Promuovere un ticket a issue pubblica. Fine-grained, permesso *Issues: write* sulla sola repository. | no |

Senza `GITHUB_TOKEN` la promozione non fa niente e il ticket resta privato, che
e' il comportamento giusto finche' non si decide il contrario.

## I quattro percorsi

```
POST /ticket   pubblico    una segnalazione nuova        -> { id }
POST /sync     pubblico    lo stato dei PROPRI ticket    -> { tickets }
POST /queue    con chiave  la coda del manutentore       -> { tickets }
POST /answer   con chiave  stato, risposta, promozione   -> { ok, issue_url }
```

«I propri» in `/sync` non e' un modo di dire: la richiesta porta
l'identificativo dell'installazione e la risposta contiene solo i ticket di
quella. E' la regola che rende un percorso pubblico non una finestra sulle
segnalazioni altrui, ed e' provata
(`tests/relay.test.js`, «la sync risponde solo con i ticket dell'installazione
che chiede»).

## Le difese

L'indirizzo sta dentro codice sorgente pubblico, quindi e' pubblico, e chi lo
chiama puo' non essere una plancia affatto.

* tetto di 64 KB sul corpo, e tetti per campo uguali a quelli di
  `ticket_store.py` — ripetuti apposta, il relay non si fida;
* sei segnalazioni all'ora per installazione, venti per rete;
* dell'indirizzo si conserva un'impronta, mai l'indirizzo;
* la chiave si confronta senza uscire alla prima differenza, cosi' non la si
  ricostruisce misurando i tempi;
* nessuna intestazione CORS: il servizio lo chiama il backend di Home
  Assistant, e una pagina qualunque non ne puo' leggere le risposte;
* `DISABLED = "1"` in `wrangler.toml` spegne tutto senza toccare le plance.

## Le prove

```bash
npm run test:relay
```

Girano con un D1 finto, senza `wrangler` e senza rete.

## Cosa NON fa

Non manda notifiche. La coda si guarda, non arriva. Se un giorno servisse un
avviso sul telefono, la strada breve e' una chiamata al webhook di un'app di
notifiche dentro `creaTicket`, non un secondo servizio.
