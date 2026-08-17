<p align="center">
  <a href="https://github.com/danigio15/dashboardmodern-v2/releases"><img src="https://img.shields.io/github/v/release/danigio15/dashboardmodern-v2?include_prereleases" alt="GitHub release"></a>
  <a href="https://github.com/danigio15/dashboardmodern-v2/actions/workflows/tests.yml"><img src="https://github.com/danigio15/dashboardmodern-v2/actions/workflows/tests.yml/badge.svg" alt="Tests"></a>
  <img src="https://img.shields.io/badge/HACS-custom-41BDF5" alt="HACS custom">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/danigio15/dashboardmodern-v2" alt="Licenza"></a>
</p>

<!-- TODO screenshot: panoramica della dashboard su desktop e mobile -->

<p align="center">
  <img src="https://raw.githubusercontent.com/danigio15/dashboardmodern-v2/main/brand/logo.png" alt="DashboardModern" width="430">
</p>

<h1 align="center">DashboardModern v2</h1>

<p align="center">
  <strong>Una dashboard moderna, completa e responsive per Home Assistant.</strong><br>
  Energia · Fotovoltaico · Batteria · Elettrodomestici · EV · Clima · Temperatura · Luci · Sicurezza · Piscina · Irrigazione
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0--beta.19-0ea5e9" alt="Versione 1.0.0-beta.19">
  <img src="https://img.shields.io/badge/HACS-custom-41BDF5" alt="HACS custom integration">
  <img src="https://img.shields.io/badge/Home%20Assistant-2025.1%2B-18BCF2" alt="Home Assistant 2025.1+">
  <img src="https://img.shields.io/badge/UI-Italiano%20%7C%20English-16a34a" alt="Italiano e inglese">
  <img src="https://img.shields.io/badge/license-MIT-64748b" alt="MIT License">
</p>

<p align="center">
  <a href="https://github.com/danigio15/dashboardmodern-v2/releases">Release</a> ·
  <a href="https://github.com/danigio15/dashboardmodern-v2/issues">Segnala un problema</a> ·
  <a href="CHANGELOG.md">Changelog</a> ·
  <a href="ROADMAP.md">Roadmap</a> ·
  <a href="CONTRIBUTING.md">Contribuire</a>
</p>

<p align="center">
  <a href="https://www.paypal.com/paypalme/giovannidaniello15">
    <img src="https://img.shields.io/badge/PayPal-Supporta%20DashboardModern-003087?logo=paypal&logoColor=white" alt="Supporta DashboardModern con PayPal">
  </a>
</p>

---

<!-- TODO screenshot: editor di configurazione e principali sezioni -->

## Cos'è DashboardModern

**DashboardModern v2** è una custom integration per Home Assistant che registra una plancia dedicata e aggiunge un'interfaccia visuale per configurare e controllare le principali aree di una smart home.

L'obiettivo è avere una dashboard pronta per l'uso quotidiano su **telefono, tablet e desktop**, senza dover costruire manualmente decine di card Lovelace. Le entità restano entità Home Assistant: DashboardModern si occupa di presentazione, configurazione della plancia, aggregazioni, storico e comandi.

La UI è disponibile in **italiano e inglese**, supporta più istanze della plancia e mantiene separati frontend, persistenza e lifecycle dell'integrazione.

> **Stato del progetto:** la serie `1.0.0-beta.x` è una beta pubblica. Le configurazioni sono già persistenti e le release passano test automatici, ma durante la fase beta possono ancora cambiare dettagli di UI o compatibilità.

---

## Funzioni principali

| Area | Cosa offre |
| --- | --- |
| 🏠 **Home** | meteo, avvisi, stato casa, dispositivi e azioni rapide |
| ⚡ **Energia** | potenza istantanea, giornaliero, mensile, report, analisi e storico |
| ☀️ **Fotovoltaico** | produzione FV, autoconsumo e flussi energetici |
| 🔋 **Batteria** | SOC, carica, scarica e contributo al bilancio Casa |
| 🧺 **Elettrodomestici** | stato, comando, potenza, energia giornaliera e storico per apparecchio |
| 🚗 **Auto / EV** | dati veicolo, batteria, autonomia e informazioni di ricarica quando configurate |
| 🔌 **Wallbox** | potenza e dati di ricarica tramite le entità disponibili in Home Assistant |
| 🌡️ **Temperatura** | temperatura e umidità associate alle stanze canoniche |
| 🔥❄️ **Clima** | gestione separata delle unità **Caldo** e **Freddo** |
| 💡 **Luci** | luci per stanza, stato e controllo |
| 🪟 **Tapparelle** | apertura, chiusura, stop e posizione quando supportata |
| 🛡️ **Sicurezza** | allarme, sensori e telecamere configurate |
| 🏊 **Piscina** | temperatura, stato e comandi configurabili |
| 💧 **Irrigazione** | zone, programmi e controlli disponibili |
| 🎨 **Personalizzazione** | icone, stanze, azioni rapide, ordine e visibilità delle sezioni |
| 👥 **Più utenti / più plance** | filtri di visibilità per utenti e più config entry indipendenti |

---

## Installazione con HACS

### Metodo consigliato

1. Apri **HACS** in Home Assistant.
2. Vai in **Integrazioni**.
3. Apri il menu in alto a destra e scegli **Archivi digitali personalizzati** / **Custom repositories**.
4. Inserisci:

   ```text
   https://github.com/danigio15/dashboardmodern-v2
   ```

5. Tipo repository: **Integrazione**.
6. Cerca **Dashboard Modern V2** e installa la release desiderata.
7. Riavvia Home Assistant.
8. Vai in **Impostazioni → Dispositivi e servizi → Aggiungi integrazione**.
9. Cerca **Dashboard Modern V2**.
10. Assegna un nome alla plancia e completa la configurazione.

### Dopo un aggiornamento

Quando HACS mostra **In attesa di riavvio**, riavvia Home Assistant prima di verificare la nuova versione. Se l'app Companion continua a mostrare asset precedenti, chiudila e riaprila; da browser esegui un ricaricamento completo della pagina.

---

## Prima configurazione

Dopo l'installazione apri **DashboardModern** dalla barra laterale e usa **Editor Dashboard**.

Un ordine pratico di configurazione è:

1. **Stanze** — crea prima le stanze canoniche.
2. **Energia** — collega FV, rete, batteria e gli eventuali sensori Casa.
3. **Elettrodomestici** — aggiungi apparecchi e relativi sensori.
4. **Temperatura** — associa temperatura/umidità alle stanze già create.
5. **Clima, Luci e Tapparelle** — assegna ogni entità alla stanza corretta.
6. **EV / Wallbox, Sicurezza, Piscina e Irrigazione** — abilita solo le sezioni realmente usate.
7. **Azioni rapide e personalizzazione** — scegli icone, ordine e comandi preferiti.

Quando modifichi una configurazione usa il pulsante **SALVA MODIFICHE** dell'editor prima di chiudere la finestra. DashboardModern salva la configurazione della plancia e mantiene le entità Home Assistant come sorgente dello stato reale.

### Dove viene salvata la configurazione

La configurazione della plancia è salvata dentro Home Assistant, in un archivio dell'integrazione (`.storage/dashboardmodern.config`), non nel browser. Non c'è niente da esportare o importare: il salvataggio e il ripristino sono automatici.

Di conseguenza:

- **è la stessa su tutti i dispositivi e per tutti gli utenti** dell'installazione: aprendo la plancia da un altro browser, da un altro account Home Assistant o dall'app Companion la ritrovi già configurata;
- **sopravvive agli aggiornamenti**, al riavvio di Home Assistant, alla pulizia della cache del browser e anche alla rimozione e riaggiunta dell'integrazione;
- **non può essere svuotata per sbaglio da un dispositivo**: un dispositivo che non riesce a leggere la configurazione non ne scrive una vuota al suo posto, e l'archivio rifiuta un salvataggio che sostituirebbe una plancia configurata con una vuota;
- **conserva le ultime cinque versioni configurate**, quindi una plancia svuotata da una versione precedente viene ripristinata automaticamente. L'unico svuotamento definitivo è quello chiesto esplicitamente con il reset della configurazione.

Restano legate al singolo dispositivo solo le preferenze che hanno senso solo lì: tema, modalità della barra di navigazione e dati di connessione.

---

# Guida alle configurazioni

## 🏠 Stanze

Le **Stanze** sono il riferimento canonico usato dalle altre sezioni.

Per ogni stanza puoi configurare:

- nome;
- icona;
- piano, quando utile;
- ordine di visualizzazione.

Il nome e l'icona della stanza vengono riutilizzati nelle viste che la referenziano. Per esempio, la sezione **Temperatura** non crea una seconda stanza: associa semplicemente i sensori alla stanza esistente.

### Suggerimento

Configura le stanze prima di Temperatura, Clima, Luci e Tapparelle. In questo modo tutti i selettori lavorano sugli stessi riferimenti e non si creano duplicati logici.

---

## 🌡️ Temperatura e umidità

La configurazione Temperatura usa una stanza già presente in **Stanze**.

Campi principali:

- **Stanza** — obbligatoria;
- **Entità temperatura** — per esempio `sensor.camera_temperature`;
- **Entità umidità** — facoltativa, per esempio `sensor.camera_humidity`.

Nome e icona si modificano dalla sezione **Stanze**. Durante la modifica è possibile spostare i sensori da una stanza a un'altra, purché la stanza di destinazione non abbia già un'associazione Temperatura.

La dashboard mostra il **nome della stanza accanto all'icona**, la temperatura corrente, l'umidità e un'indicazione sintetica di comfort.

---

## ⚡ Energia

La sezione Energia distingue tra **valori del periodo corrente** e **storico ricostruito tramite Recorder**.

### Sorgenti consigliate

Per lo storico affidabile di mesi, anni e settimane precedenti usa preferibilmente sensori energia cumulativi con:

- `device_class: energy`;
- unità coerente, tipicamente `kWh`;
- `state_class: total` oppure `total_increasing`.

In pratica, quando disponibile, configura un **contatore totale kWh**: è il riferimento migliore per ricostruire correttamente i periodi storici tramite le statistiche di Home Assistant.

I campi **Giorno / Mese / Anno** possono invece essere usati come override del periodo corrente, ad esempio con `utility_meter` dedicati.

### Fotovoltaico

Configura, quando disponibili:

- potenza FV istantanea;
- energia FV totale/lifetime;
- eventuali contatori di periodo.

### Rete

Per ottenere un bilancio completo sono raccomandati:

- energia prelevata dalla rete;
- energia immessa in rete;
- relative potenze quando disponibili.

### Batteria

Per accumulo domestico puoi configurare:

- stato di carica / SOC;
- potenza batteria;
- energia caricata;
- energia scaricata.

### Consumo Casa

Quando i flussi necessari sono completi, DashboardModern usa lo stesso criterio di bilancio della distribuzione Energia di Home Assistant:

```text
Casa = FV + Rete prelevata + Batteria scaricata
       - Rete immessa - Batteria caricata
```

Se il confine dei flussi non è completo, un sensore Casa configurato può essere usato come fallback.

### Confronto settimanale

Il **Confronto settimanale dei consumi Casa** usa le statistiche Recorder autenticate e il bilancio canonico della Casa per confrontare il periodo corrente con quello precedente. I valori mostrati dipendono naturalmente dai tuoi sensori: per esempio un riepilogo può riportare **165,1 kWh** senza trasformare quel valore in una costante della dashboard.

### Storico

I periodi precedenti vengono ricostruiti dalle statistiche Recorder dei contatori cumulativi. Per questo motivo un semplice sensore mensile non sostituisce un vero contatore lifetime quando si vuole navigare lo storico nel tempo.

Per dettagli tecnici consulta [`docs/ENERGY_RECORDER_PARITY.md`](docs/ENERGY_RECORDER_PARITY.md).

---

## 🧺 Elettrodomestici

Ogni elettrodomestico può essere associato a una stanza e a più entità Home Assistant.

I campi disponibili dipendono dal tipo di apparecchio, ma il modello supporta tipicamente:

- nome e tipo;
- stanza;
- entità di stato;
- entità di comando ON/OFF, se applicabile;
- potenza istantanea in W;
- energia giornaliera;
- energia mensile;
- energia totale/lifetime.

### Energia totale per storico e Report

Quando il dispositivo dispone di un contatore cumulativo, configura il sensore **totale/lifetime**. DashboardModern può usarlo con Recorder per ricostruire i consumi dei periodi precedenti.

Un contatore lifetime **non viene sommato direttamente** al consumo del giorno: il runtime usa il delta statistico del periodo oppure un sensore giornaliero esplicito quando presente.

### Stato "In funzione"

Le KPI degli elettrodomestici distinguono un apparecchio realmente in esecuzione da una presa semplicemente alimentata quando i dati configurati consentono di farlo. La vista di dettaglio può mostrare potenza e contributo percentuale al consumo istantaneo.

---

## 🔥❄️ Clima

Le unità clima possono essere associate alle stanze e presentate nelle due aree operative:

- **Freddo**;
- **Caldo**.

Configura l'entità `climate.*` e la stanza corretta. Il runtime usa gli stati e i servizi nativi di Home Assistant per visualizzazione e comandi.

---

## 💡 Luci

Per ogni luce puoi configurare:

- entità `light.*`;
- nome visualizzato;
- stanza;
- ordine.

La dashboard mantiene il controllo tramite i servizi Home Assistant e presenta le luci organizzate secondo la configurazione della plancia.

---

## 🪟 Tapparelle

La sezione Tapparelle usa le entità `cover.*` configurate e, quando supportato dall'entità, può visualizzare o comandare:

- apertura;
- chiusura;
- stop;
- posizione.

Associa ogni tapparella alla stanza corretta per mantenere coerenti editor e dashboard.

---

## 🚗 EV e Wallbox

La sezione Auto/EV può usare le entità già esposte a Home Assistant dalla tua integrazione veicolo o dal sistema di ricarica.

A seconda delle entità disponibili puoi collegare dati come:

- SOC batteria;
- autonomia;
- stato veicolo;
- stato collegamento/ricarica;
- potenza di carica;
- energia della sessione;
- eventuali comandi o modalità esposti dall'integrazione sorgente.

DashboardModern non sostituisce l'integrazione del veicolo o della wallbox: ne utilizza le entità presenti in Home Assistant.

---

## 🛡️ Sicurezza e telecamere

La sezione Sicurezza può raccogliere allarme, sensori e telecamere configurati. Le sorgenti restano le entità e i flussi già disponibili in Home Assistant.

Per le telecamere verifica sempre che lo stream funzioni correttamente in Home Assistant prima di collegarlo alla plancia.

---

## 🏊 Piscina

La sezione Piscina è pensata per raggruppare in una vista dedicata i sensori e i comandi dell'impianto, ad esempio:

- temperatura acqua;
- pompa;
- filtrazione;
- luci;
- altri switch o sensori configurati.

Abilita solo i controlli realmente presenti nel tuo impianto.

---

## 💧 Irrigazione

La sezione Irrigazione può essere usata per rappresentare zone e comandi disponibili in Home Assistant. Il comportamento effettivo dipende dalle entità configurate e dalle automazioni già presenti nell'impianto.

---

## ⚡ Azioni rapide

Le Azioni rapide permettono di portare nella Home della dashboard i comandi usati più spesso.

Puoi associare nome, icona e azione/entità. Le icone vengono gestite dal catalogo visuale della dashboard e la configurazione resta persistente tra i riavvii.

---

## 👥 Utenti, visibilità e più plance

Ogni config entry rappresenta una plancia. La prima viene marcata come principale; è possibile creare altre istanze con nomi differenti.

Nelle opzioni dell'integrazione sono disponibili:

- **Utenti consentiti** — filtro di visibilità della plancia per gli utenti selezionati;
- **Solo amministratori** — limita la visualizzazione secondo l'opzione dell'integrazione;
- **Registra dashboard Lovelace** — abilita/disabilita la registrazione della dashboard companion.

> Le opzioni di visibilità della plancia non sostituiscono il sistema di autenticazione e autorizzazione di Home Assistant.

---

# Come è fatta la repository

```text
dashboardmodern-v2/
├── .github/                         # workflow CI, validazioni e release
├── brand/                           # logo e icone del progetto
├── custom_components/
│   └── dashboardmodern/
│       ├── __init__.py              # lifecycle della custom integration
│       ├── config_flow.py           # configurazione e opzioni Home Assistant
│       ├── config_store.py          # archivio condiviso della configurazione plancia
│       ├── const.py                 # costanti del dominio
│       ├── frontend.py              # registrazione e servizio degli asset frontend
│       ├── websocket_api.py         # comandi WebSocket della configurazione condivisa
│       ├── manifest.json            # metadati/versione integrazione
│       ├── strings.json             # stringhe base Home Assistant
│       ├── translations/            # traduzioni config flow
│       ├── brand/                   # asset brand inclusi nel pacchetto HACS
│       └── frontend/
│           ├── panel.js             # pannello Home Assistant
│           ├── dashboard-card.js    # companion/custom card
│           ├── legacy/              # documenti dashboard vendorizzati e bridge runtime
│           ├── src/
│           │   ├── core/            # modelli, store, proiezioni e logica condivisa
│           │   ├── sections/        # runtime delle singole sezioni UI
│           │   └── transport/       # guard/bridge di comunicazione
│           ├── tests/               # test frontend/unitari
│           └── e2e/                 # Browser E2E Playwright
├── docs/                            # documentazione tecnica e strategica
├── scripts/                         # build release, build-info e vendoring
├── tests/                           # test Python dell'integrazione
├── ARCHITECTURE.md                  # architettura del progetto
├── CHANGELOG.md                     # cronologia release
├── CONTRIBUTING.md                  # guida per contribuire
├── ROADMAP.md                       # roadmap
├── hacs.json                        # metadati HACS
├── package.json                     # tool/test frontend
└── pyproject.toml                   # configurazione Python/tooling
```

---

## Architettura in breve

Il backend Home Assistant e il frontend sono mantenuti separati:

```text
Home Assistant
   │
   ├─ Config Entry Lifecycle
   ├─ Storage / runtime per istanza
   ├─ API / WebSocket / servizi
   └─ Registrazione pannello
            │
            ▼
     Dashboard Frontend
            │
            ├─ store e modelli canonici
            ├─ renderer delle sezioni
            ├─ editor visuale
            └─ comandi tramite API/servizi Home Assistant
```

Principi del progetto:

- stato Home Assistant come sorgente dei dati live;
- configurazione della plancia separata dagli stati delle entità;
- aggiornamenti preferibilmente event-driven;
- un solo proprietario canonico per i renderer critici;
- compatibilità con la configurazione persistente delle release precedenti;
- test alle principali frontiere backend/frontend/browser.

Per la descrizione completa consulta [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

# Sviluppo

## Requisiti

- Python compatibile con la versione Home Assistant target;
- Node.js **22 o successivo** per il tooling frontend;
- dipendenze di sviluppo installate dal progetto.

## Frontend

```bash
npm ci
npm run check:inline-syntax
npm run test:frontend
npm run format:check
```

Per i test browser:

```bash
npx playwright install --with-deps
npm run test:e2e
```

## Test Python

La CI esegue la suite Python e Ruff insieme alle validazioni Home Assistant/HACS previste dal repository.

---

## CI e release

La pipeline controlla, a seconda del workflow:

- test Python;
- Ruff;
- test frontend;
- Browser E2E Playwright;
- formattazione;
- sintassi inline dei documenti legacy;
- hassfest;
- validazione HACS;
- integrità del pacchetto di release;
- generazione di `dashboardmodern.zip` dal commit pubblicato.

Le release sono disponibili nella pagina **GitHub Releases** e possono essere installate/aggiornate tramite HACS.

Consulta [`CHANGELOG.md`](CHANGELOG.md) per la cronologia dettagliata invece di usare il README come registro delle singole patch.

---

# Risoluzione problemi

Prima di aprire una Issue verifica:

1. la versione realmente installata in HACS;
2. che non sia presente **In attesa di riavvio**;
3. di aver riavviato Home Assistant dopo l'aggiornamento;
4. di aver chiuso/riaperto l'app Companion o ricaricato completamente il browser;
5. che le entità configurate esistano ancora;
6. per Energia, che i sensori abbiano statistiche Recorder utilizzabili;
7. il **Registro** di Home Assistant;
8. se il problema è grafico, dispositivo, browser/WebView e uno screenshot.

Quando apri una Issue indica almeno:

- versione DashboardModern;
- versione Home Assistant;
- dispositivo e browser/app;
- lingua della dashboard;
- se il problema compare su mobile, tablet o desktop;
- passaggi per riprodurlo;
- screenshot, se utile.

👉 **Issues:** https://github.com/danigio15/dashboardmodern-v2/issues

---

# Documentazione del progetto

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — architettura e responsabilità dei layer;
- [`CHANGELOG.md`](CHANGELOG.md) — cronologia delle release;
- [`ROADMAP.md`](ROADMAP.md) — roadmap generale;
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — sviluppo e contributi;
- [`docs/ENERGY_RECORDER_PARITY.md`](docs/ENERGY_RECORDER_PARITY.md) — storico Energia e Recorder;
- [`docs/LEGACY_HOSTING.md`](docs/LEGACY_HOSTING.md) — note sul frontend legacy/hosting;
- [`docs/PRODUCT_VISION.md`](docs/PRODUCT_VISION.md) — visione prodotto;
- [`docs/SECTION_ROADMAP.md`](docs/SECTION_ROADMAP.md) — roadmap delle sezioni;
- [`docs/STRATEGY.md`](docs/STRATEGY.md) — strategia tecnica/prodotto.

---

# Contribuire

Bug report, test su dispositivi reali, traduzioni e pull request sono benvenuti.

Prima di inviare modifiche leggi [`CONTRIBUTING.md`](CONTRIBUTING.md) e verifica che i test relativi all'area modificata passino.

Se il progetto ti è utile, puoi anche lasciare una ⭐ alla repository: aiuta altre persone a trovarlo.

---

# 💙 Supporta il progetto

DashboardModern è un progetto indipendente e open source. Se vuoi sostenere sviluppo, test su dispositivi reali, manutenzione e nuove funzionalità, puoi effettuare una donazione tramite il PayPal ufficiale del progetto.

<p align="center">
  <a href="https://www.paypal.com/paypalme/giovannidaniello15">
    <img src="https://img.shields.io/badge/PayPal-Fai%20una%20donazione-003087?logo=paypal&logoColor=white" alt="Fai una donazione con PayPal">
  </a>
</p>

👉 **PayPal:** https://www.paypal.com/paypalme/giovannidaniello15

Ogni contributo è facoltativo e aiuta a sostenere il tempo dedicato a sviluppo, test su dispositivi reali, documentazione e manutenzione della compatibilità con Home Assistant.

---

## Licenza

DashboardModern v2 è distribuito secondo i termini indicati nel file [`LICENSE`](LICENSE) della repository.

---

<p align="center">
  <strong>DashboardModern v2</strong><br>
  Costruito per Home Assistant, con attenzione a mobile, dati reali e configurazione visuale.
</p>
