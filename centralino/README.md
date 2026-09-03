# Il centralino

La buca delle lettere fra la casa di chi chiede aiuto e chi mantiene la
plancia. Un Worker e un database, e niente altro. Il perche' e la forma stanno
in [`../docs/CHAT.md`](../docs/CHAT.md); qui c'e' solo come si mette su.

## Metterlo su, la prima volta

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
