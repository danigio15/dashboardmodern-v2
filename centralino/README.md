# Il centralino

La buca delle lettere fra la casa di chi chiede aiuto e chi mantiene la
plancia. Un Worker e un database, e niente altro. Il perche' e la forma stanno
in [`../docs/CHAT.md`](../docs/CHAT.md); qui c'e' solo come si mette su.

## Due strade, stesso risultato

Il centralino finisce comunque sui server di Cloudflare: quello che cambia e'
solo da dove si premono i pulsanti.

* **Dal browser**, sul sito di Cloudflare: nessun programma da installare,
  nessun comando da digitare. Sta [piu' sotto](#la-stessa-cosa-dal-browser-senza-installare-niente),
  ed e' la strada da prendere se `node --version` non risponde niente.
* **Dal terminale**, con `wrangler`: qui sotto. Piu' rapida, ma vuole Node
  installato sul computer da cui si parte.

## Metterlo su dal terminale

Serve un account Cloudflare. La fascia gratuita basta e avanza: 100.000
richieste al giorno, e una plancia ne fa **dodici all'ora**.

```bash
cd centralino
npm install
npx wrangler login
```

**1. L'archivio.**

```bash
npx wrangler d1 create centralino
```

Il comando stampa un `database_id`: incollalo in `wrangler.toml`, al posto di
`DA-INCOLLARE-DOPO-wrangler-d1-create`. E' l'unica riga di quel file che cambia
da persona a persona.

**2. Le due tabelle.**

```bash
npx wrangler d1 execute centralino --remote --file=schema.sql
```

**3. La chiave della console.** E' quella con cui tu — e nessun altro — leggi le
conversazioni e rispondi. Falla lunga e casuale, e non scriverla in nessun file:

```bash
openssl rand -hex 32              # copia quello che esce
npx wrangler secret put CHIAVE_CONSOLE
```

**4. Su.**

```bash
npx wrangler deploy
```

L'ultima riga stampa l'indirizzo, del tipo
`https://centralino.<tuo-nome>.workers.dev`. Da controllare subito:

```bash
curl https://centralino.<tuo-nome>.workers.dev/salute
# {"vivo":true}
```

**5. Dirlo alla plancia.** Quell'indirizzo va scritto in
`custom_components/dashboardmodern/const.py`, alla voce `CHAT_CENTRALINO`. E la
chiave della console va nella configurazione del **tuo** Home Assistant, non in
quella degli altri: e' la stessa che hai messo al punto 3.

## La stessa cosa dal browser, senza installare niente

Serve solo un account Cloudflare e questa pagina aperta di fianco. Nessun
terminale, nessun programma da scaricare: i nomi dei pulsanti su
`dash.cloudflare.com` cambiano ogni tanto, quindi qui sono descritti anche per
quello che fanno.

**1. L'archivio.** Barra a sinistra → **Storage & Databases** → **D1 SQL
Database** → **Create** (o *Create database*). Nome: `centralino`.

Nella stessa schermata c'e' **Specifica giurisdizione**: scegliendo **EU**,
Cloudflare garantisce che i dati restino su server europei. Qui dentro
finiscono le conversazioni di chi chiede aiuto — testo scritto da persone — e
quella garanzia si puo' dare **solo adesso**: dopo, per cambiarla, il database
va rifatto da capo. L'alternativa (*Luogo*, la posizione automatica) funziona
identica, e' solo una garanzia in meno.

Poi **Crea**.

**2. Le due tabelle.** Dentro il database appena creato, linguetta **Console**
(la casella dove si scrivono query). Apri
[`schema.sql`](schema.sql), copia **tutto** il contenuto, incollalo nella
casella ed esegui. Alla fine, nella linguetta **Tables**, devono comparire
`linee` e `messaggi`.

**3. Il Worker.** Barra a sinistra → **Workers & Pages** (o **Compute**) →
**Create** → **Start with Hello World** → nome: `centralino` → **Deploy**.
Nasce vuoto, col codice di esempio: va bene, si sostituisce dopo.

Il nome decide l'indirizzo: `centralino` diventa
`https://centralino.<tuo-nome>.workers.dev`.

**4. Attaccare l'archivio al Worker.** Nel Worker → **Settings** →
**Bindings** → **Add** → **D1 database**.

* Variable name: **`DB`** — esattamente questo, in maiuscolo. E' il nome con
  cui il codice lo cerca: sbagliarlo vuol dire un Worker che parte e non trova
  niente.
* Database: `centralino`.

**5. La chiave della console.** Sempre in **Settings** → **Variables and
Secrets** → **Add** → tipo **Secret**.

* Nome: **`CHIAVE_CONSOLE`**
* Valore: una stringa lunga e casuale, **solo lettere e numeri**, almeno
  quaranta caratteri. Va bene quella che genera un gestore di password. Se
  preferisci farla al volo: nel browser premi `F12`, linguetta **Console**,
  incolla questa riga e premi Invio —

  ```js
  [...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,"0")).join("")
  ```

  Stampa 64 caratteri: quelli.

**Copiala e tienila da parte: serve due volte** — qui, e nelle opzioni della
plancia sul tuo Home Assistant. Dopo il salvataggio Cloudflare non la mostra
piu'.

**6. Il codice.** Nel Worker → **Edit code** (o *Quick edit*). Cancella tutto
quello che c'e' nell'editor, apri [`src/index.js`](src/index.js), copia tutto,
incolla, e premi **Deploy**.

**7. La pulizia automatica.** **Settings** → **Triggers** (o *Trigger Events*)
→ **Cron Triggers** → **Add** → `0 4 * * *`. E' il giro che cancella le linee
ferme da sei mesi. Si puo' anche saltare: senza, quelle linee restano.

**8. La prova.** Apri in una scheda del browser:

```
https://centralino.<tuo-nome>.workers.dev/salute
```

Deve rispondere `{"vivo":true}`. Se risponde quello, il centralino c'e'.

**9. Le due cose che restano.** L'indirizzo del punto 8 va scritto in
`custom_components/dashboardmodern/const.py`, alla voce `CHAT_CENTRALINO`; la
chiave del punto 5 va nelle opzioni del **tuo** Home Assistant, in
*Impostazioni → Dispositivi e servizi → DashboardModern → Configura →*
«Chiave della console assistenza».

## Prima di aprirlo al mondo

Il centralino ha i suoi limiti scritti dentro — 4.000 caratteri per messaggio,
venti messaggi all'ora per casa, duecento messaggi conservati, e una linea nasce
solo quando qualcuno **scrive**, mai quando legge. Sono i limiti che impediscono
a una conversazione di diventare un archivio e a un identificativo di
moltiplicarsi.

Quello che non puo' fare da solo e' fermare chi bussa mille volte al secondo da
un indirizzo solo. Per quello c'e' Cloudflare: nella dashboard, **Security →
WAF → Rate limiting rules**, una regola sulla rotta del Worker basta. Nella
fascia gratuita se ne puo' avere una, ed e' quella che serve.

## I due sportelli

| | | |
|---|---|---|
| `GET /salute` | — | dice solo che e' vivo |
| `POST /casa/messaggi` | segreto della casa | manda un messaggio, e la prima volta apre la linea |
| `GET /casa/messaggi?dopo=N` | segreto della casa | i messaggi dopo il numero N |
| `DELETE /casa/messaggi` | segreto della casa | cancella la conversazione, davvero |
| `GET /console/conversazioni` | chiave della console | l'elenco, con i non letti |
| `GET /console/conversazioni/<linea>?dopo=N` | chiave della console | un filo |
| `POST /console/conversazioni/<linea>` | chiave della console | rispondi |

La casa si presenta con due intestazioni: `X-Casa` col proprio identificativo
(`casa_` e trentadue cifre esadecimali) e `Authorization: Bearer <segreto>`. Il
segreto non lascia mai la casa: qui ne arriva solo l'impronta, ed e' quella che
viene conservata.

## Guardarci dentro

```bash
npx wrangler tail                                    # cosa sta succedendo adesso
npx wrangler d1 execute centralino --remote \
  --command "SELECT id, nome, versione, vista_il FROM linee ORDER BY vista_il DESC LIMIT 20"
```

Le conversazioni si leggono meglio dal Cruscotto della plancia, che e' il posto
per cui sono state fatte.

## Le prove

```bash
npm test
```

Girano senza rete e senza Cloudflare: il Worker riceve una `Request` vera e un
D1 finto, e si guarda cosa risponde.
