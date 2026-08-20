# Uscire dalla beta: pubblicare la 1.0

Cosa serve per trasformare l'ultima beta nella prima release stabile, e cosa
cambia per chi la installa. Il repository è già predisposto: questo documento
descrive i passi rimasti e il perché di ognuno.

## Cosa è già pronto in questo branch

| Elemento | Stato |
| --- | --- |
| `custom_components/dashboardmodern/manifest.json` | `"version": "1.0.0"` |
| `CHANGELOG.md` | una sola voce, **1.0.0**; la cronologia beta è archiviata in [`CHANGELOG_PRE_1.0.md`](CHANGELOG_PRE_1.0.md) |
| `README.md` | riscritto senza linguaggio da beta, con le anteprime di ogni sezione in tema chiaro e scuro |
| Contratti di versione nei test | accettano già una versione stabile (`1.0.0`) oltre a `-beta.N` e `-rc.N`: nessuna modifica necessaria |
| Punto di partenza | `1.0.0-rc.2`, l'ultima release candidate pubblicata |
| `scripts/purge_pre_1_0_releases.sh` | pulizia di release e tag pre-1.0, in anteprima per impostazione predefinita |

## Prima di pubblicare

1. **Decidi cosa entra nella 1.0.** Ogni branch o PR che deve esserci va unito a
   `main` prima del tag: dopo la pubblicazione diventa materiale per una 1.0.1.
2. **Chiudi le segnalazioni aperte sulla rc.2.** Una release candidate serve a
   questo: quello che è emerso sul dispositivo entra nella 1.0, il resto diventa
   1.0.1.
3. **Fai girare i gate in locale**, gli stessi della CI:

   ```bash
   ruff check . && ruff format --check .
   python scripts/generate_build_info.py --expected-commit "$(git rev-parse HEAD)"
   python -m pytest -q
   npm ci
   npm run check:inline-syntax
   npm run format:check
   npm run test:frontend
   npx playwright test
   ```

4. **Prova un'installazione pulita**: aggiungi l'integrazione su un Home
   Assistant senza configurazione precedente e verifica che la plancia parta, che
   l'editor salvi e che la configurazione si ritrovi da un secondo dispositivo.
5. **Prova un aggiornamento dalla rc**: parti da una `1.0.0-beta.30.x` già
   configurata, aggiorna e verifica che la configurazione sia intatta. È il
   percorso che farà quasi tutta l'utenza.

## Pubblicare

La pubblicazione è automatica: il workflow `Release` parte quando `main` riceve
una modifica a `manifest.json`, oppure quando viene spinto un tag `v*`.

1. Unisci questo branch in `main`.
2. Il workflow verifica lint, test Python, test frontend e i tre progetti
   Playwright, poi calcola il tag dal manifest: **`v1.0.0`**.
3. Pubblica la release con `dashboardmodern.zip` allegato.

> Il workflow marca come *pre-release* solo i tag che contengono un trattino
> (`v1.0.0-beta.30.8`). `v1.0.0` non ne ha: viene pubblicata come **release
> stabile**, ed è esattamente ciò che serve per uscire dalla beta.

Se il tag `v1.0.0` esistesse già, il workflow si ferma invece di sovrascrivere
una release pubblicata: in quel caso si passa a `1.0.1`.

## Cosa vedono gli utenti

- **HACS mostra le release stabili**; le pre-release restano nascoste a chi non
  ha attivato *Show beta versions*. Dopo la 1.0.0, un'installazione normale vede
  la 1.0.0 e non più le beta.
- Chi era su una beta riceve l'aggiornamento come qualunque altro: HACS mostra
  **In attesa di riavvio**, si riavvia Home Assistant e la configurazione resta
  dov'era, nell'archivio dell'integrazione.

## Lasciare visibile solo la 1.0

La scelta è già fatta: **si parte da `v1.0.0` e sulla pagina Releases resta solo
quella.** Le pubblicazioni precedenti — 46 release (`v0.15.25`, 43 beta, rc.2 e rc.3) e
90 tag in tutto, contando `v0.14.*` (18), `v0.15.*` (26), `v1.0.0-beta.*` (43) e
`v1.0.0-rc.*` (3) — vanno rimosse insieme ai loro tag.

### Cosa si perde e cosa no

| Si perde | Non si perde |
| --- | --- |
| Le pagine `releases/tag/v0.15.x` e i loro pacchetti scaricabili | Il **codice**: ogni commit resta nella cronologia di `main` |
| I link diretti a una vecchia release citati in una issue | Le **note**: archiviate in [`CHANGELOG_PRE_1.0.md`](CHANGELOG_PRE_1.0.md) e nel JSON che lo script salva prima di cancellare |
| Il download di una versione precedente da HACS (*Redownload → versione specifica*) | Le **installazioni esistenti**: chi è già su una beta continua a funzionare e vede l'aggiornamento alla 1.0 |
| I contatori di download delle vecchie release | Il contatore della 1.0 e quelli futuri |

> Chi è fermo su una `v0.15.x` o su una beta **non viene toccato**: HACS legge le
> release per proporre aggiornamenti, non per far funzionare quello che è già
> installato. All'apertura successiva vedrà la 1.0.0 come unica versione
> disponibile, che è esattamente l'effetto voluto.

### Perché non si comincia da `v0.15.25`

`v0.15.25` è **l'unica release non marcata come pre-release** di tutto il
repository: 43 beta e 3 rc sono tutte pre-release. Finché la 1.0.0 non è
pubblicata, togliere la v0.15.25 lascerebbe la repository **senza nessuna
versione stabile**, e chi installa da HACS senza *Show beta versions* non
vedrebbe più niente da installare.

La pulizia va quindi fatta in due tappe:

| Tappa | Quando | Cosa si toglie | Cosa resta |
| --- | --- | --- | --- |
| **1** | anche subito | le 43 beta e i tag `v0.14.*` / `v0.15.0`–`v0.15.24` senza release | `v0.15.25` (stabile) e le rc |
| **2** | dopo aver pubblicato la 1.0.0 | `v0.15.25` e le rc | solo `v1.0.0` |

```bash
# tappa 1 — le beta e i vecchi tag, si tiene la 0.15.25 come stabile e le rc
./scripts/purge_pre_1_0_releases.sh \
  --keep v0.15.25 --keep v1.0.0-rc.1 --keep v1.0.0-rc.2 --keep v1.0.0-rc.3

# tappa 2 — dopo la pubblicazione della 1.0.0
./scripts/purge_pre_1_0_releases.sh
```

Lo script si rifiuta di procedere se dopo la pulizia non resterebbe nessuna
release stabile: per forzare comunque serve `--allow-no-stable`.

### Ordine dei passi

1. **Pubblica prima la 1.0.** Non si svuota la pagina finché non c'è qualcosa al
   suo posto: lo script si rifiuta di partire se `v1.0.0` non esiste.
2. **Verifica** che la 1.0.0 sia marcata *Latest* e **non** come pre-release
   (il workflow lo fa da solo: `v1.0.0` non contiene trattini).
3. **Anteprima della pulizia** — non cancella nulla, elenca soltanto:

   ```bash
   ./scripts/purge_pre_1_0_releases.sh
   ```

4. **Esecuzione**, dopo aver riletto l'elenco. Serve `gh` autenticato con
   permessi di scrittura sul repository, e va digitato `ELIMINA` alla richiesta
   di conferma:

   ```bash
   ./scripts/purge_pre_1_0_releases.sh --apply
   ```

   Lo script, in ordine: salva nome, data e note di ogni release in
   `docs/archive/releases-pre-1.0.json`, cancella le release con il relativo tag
   (`gh release delete --cleanup-tag`), poi rimuove i tag rimasti senza release.

5. **Allinea i tag locali**, altrimenti un `git push --tags` distratto li
   rimetterebbe tutti al loro posto:

   ```bash
   git fetch --prune --prune-tags origin
   git tag           # deve restare solo v1.0.0
   ```

6. **Controlla il risultato**: la pagina Releases mostra una sola voce, e
   `hacs.json` continua a puntare a `dashboardmodern.zip`, allegato alla 1.0.

### Se preferisci non cancellare

L'alternativa conservativa esiste e non richiede nessuno script: tutte le beta e
le rc sono già marcate come *pre-release*, quindi GitHub evidenzia solo la 1.0
come *Latest* e HACS propone solo quella a chi non ha attivato *Show beta
versions*. La differenza è che le vecchie pagine restano raggiungibili. Le
`v0.14.*` e `v0.15.*`, però, sono release **stabili**: se scegli questa strada
vanno almeno riclassificate come pre-release, una per una, altrimenti continuano
a comparire nell'elenco accanto alla 1.0.

## Dopo la 1.0

- **1.0.x** per le correzioni, **1.x** per le funzioni nuove: la numerazione
  torna a significare qualcosa quando non c'è più il suffisso beta.
- Il contratto di versione nei test accetta anche `1.1.0-rc.1`, così una
  candidata si può pubblicare come pre-release senza toccare i test.
- La configurazione salvata ha uno schema versionato con migrazioni: alzare lo
  schema resta possibile senza chiedere all'utente di riconfigurare.
