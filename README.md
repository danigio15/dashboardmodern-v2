<p align="center">
  <img src="https://raw.githubusercontent.com/danigio15/dashboardmodern-v2/main/brand/logo.png" alt="DashboardModern" width="420">
</p>

<h1 align="center">DashboardModern</h1>

<p align="center">
  <b>Una plancia smart-home completa, multiutente e responsive per Home Assistant.</b><br>
  Energia · Fotovoltaico · Batteria · EV · Clima · Luci · Sicurezza · Elettrodomestici · Automazioni
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.15.12-0ea5e9" alt="Versione 0.15.12">
  <img src="https://img.shields.io/badge/HACS-custom-41BDF5" alt="HACS custom integration">
  <img src="https://img.shields.io/badge/Home%20Assistant-2025.1%2B-1e3a8a" alt="Home Assistant 2025.1+">
  <img src="https://img.shields.io/badge/UI-Italiano%20%7C%20English-16a34a" alt="Italiano e inglese">
</p>

> **English overview** — DashboardModern is a responsive, multi-instance Home
> Assistant dashboard distributed as a HACS custom integration. Release 0.15.12
> removes conflicting live-update layers and retry loops, makes Energy and
> appliance history semantics single-owner, and rebuilds the shutter popup on
> the shared responsive modal contract.

---

## Novità 0.15.12

La 0.15.12 è un **conflict audit** del runtime. Non aggiunge altri layer sopra quelli esistenti: elimina i proprietari duplicati e i cicli che continuavano a lavorare anche quando la dashboard sembrava ferma.

### Prestazioni e conflitti runtime

- eliminata la catena Data Contracts che poteva ripartire fino a decine di volte dopo ogni cambio stato;
- eliminate le scansioni/polling permanenti delle Tapparelle;
- eliminato il retry ripetuto del runtime EV;
- eliminato il `MutationObserver` globale dell'Editor sul `document.body`;
- Elettrodomestici, EV, Temperature, Tapparelle ed Energia reagiscono solo alle proprie entità configurate;
- Energia non ricarica più Recorder perché è cambiata una luce, una temperatura o un'entità estranea;
- il bilancio Casa viene riconciliato una sola volta nel bundle canonico, senza un secondo correttore post-render.

### Energia, Report ed elettrodomestici

- un sensore mensile `measurement` può alimentare il **periodo corrente**, ma non viene più esposto come sorgente lifetime per i mesi precedenti;
- `history_entity` e `report_entity` vengono considerati storici solo se realmente cumulativi (`total`/`total_increasing`);
- il caso `sensor.energy_mese_microonde` non può più essere ripromosso automaticamente a contatore totale da un altro layer;
- Casa continua a usare lo stesso bilancio dei flussi della dashboard Energia di Home Assistant quando le sorgenti necessarie sono disponibili;
- le card Elettrodomestici non vengono più ricalcolate per stati Home Assistant estranei alla sezione.

### Tapparelle ed Editor

- il popup **Tapparelle aperte** usa ora un solo proprietario visuale;
- aggiunte icona nel titolo e icona nella riga della tapparella;
- header, chiusura, contenuto, scroll e pulsanti seguono il contratto responsive comune;
- i tre comandi Apri/Ferma/Chiudi sono compatti e coerenti anche su mobile;
- eliminato il vecchio layer CSS Tapparelle che stilizzava classi non presenti nel popup reale;
- i contratti Editor vengono applicati solo quando un editor è effettivamente aperto, senza osservare tutte le mutazioni della dashboard.

### HACS e aggiornamento

Dopo un aggiornamento HACS, se compare **In attesa di riavvio**, la nuova versione non va considerata attiva finché Home Assistant non è stato riavviato. Dopo il riavvio chiudi e riapri l'app/browser oppure esegui un refresh completo: il frontend usa asset versionati e una sessione aperta può continuare a mostrare contenuti della release precedente.

Il repository contiene sia `brand/` per HACS sia `custom_components/dashboardmodern/brand/` per le versioni Home Assistant che supportano il branding locale delle custom integration. Su versioni Home Assistant precedenti al supporto del brand locale, l'icona della scheda integrazione può dipendere dal catalogo Brands centrale.

---

## Funzioni principali

- dashboard italiana e inglese;
- configurazione visuale delle entità Home Assistant;
- Energia con viste giornaliera, mensile, annuale e Report;
- fotovoltaico, rete e batteria;
- elettrodomestici con potenza, energia, stato, storico e comando;
- temperatura e umidità associate alle stanze;
- luci, tapparelle, clima, sicurezza, piscina e irrigazione;
- EV e wallbox;
- configurazione persistente per istanza e sincronizzazione multiutente.

## Requisiti

- Home Assistant 2025.1 o successivo;
- HACS per l'installazione e gli aggiornamenti consigliati;
- accesso amministratore per configurare le entità.

## Installazione con HACS

1. Apri **HACS**.
2. Dal menu in alto a destra scegli **Archivi digitali personalizzati**.
3. Inserisci `https://github.com/danigio15/dashboardmodern-v2`.
4. Seleziona il tipo **Integrazione**.
5. Installa **DashboardModern v2**.
6. Riavvia Home Assistant quando HACS lo richiede.
7. Apri **Impostazioni → Dispositivi e servizi → Aggiungi integrazione** e cerca DashboardModern.

## Aggiornamento

Da HACS apri DashboardModern v2, scegli la release più recente e premi **Aggiorna**. Se HACS mostra **In attesa di riavvio**, esegui il riavvio prima di verificare la dashboard. Dopo il riavvio chiudi/riapri l'app Home Assistant oppure ricarica completamente la pagina del browser.

## Prima configurazione

Apri la voce DashboardModern nella barra laterale e usa **Editor Dashboard** per associare:

- stanze e sensori temperatura/umidità;
- flussi Energia e sensori lifetime;
- elettrodomestici e relativi sensori totali;
- luci, tapparelle, clima, EV e sicurezza.

Le configurazioni precedenti vengono migrate senza eliminare le entità lifetime già salvate.

## Energia e Report

Per ottenere giorno, mese, anno e mesi precedenti in modo affidabile, configura preferibilmente un sensore con `device_class: energy` e `state_class: total_increasing` nel campo **Energia totale**. Il runtime calcola i periodi tramite le statistiche Recorder di Home Assistant.

Per gli elettrodomestici, un sensore **mensile** può sostituire il valore del mese corrente ma non sostituisce il contatore **totale/lifetime** necessario per ricostruire i mesi precedenti. Il campo **Energia totale per storico e Report** deve quindi puntare a un contatore cumulativo con `state_class: total` o `total_increasing`.

Quando sono disponibili Fotovoltaico e Rete, DashboardModern ricava il consumo Casa dal bilancio dei flussi per mantenere parità con la dashboard Energia di Home Assistant. Il contatore Casa diretto resta disponibile come fallback quando il bilancio non può essere ricostruito.

## Supporto e problemi

Prima di aprire una segnalazione verifica:

- versione installata mostrata da HACS;
- assenza dello stato **In attesa di riavvio**;
- riavvio completato dopo l'aggiornamento;
- app/browser riaperto o pagina completamente ricaricata;
- entità ancora esistenti in Home Assistant;
- statistiche Recorder disponibili per i sensori energia;
- errori nel registro di Home Assistant.

Le segnalazioni possono essere aperte nella sezione **Issues** del repository includendo versione, browser, variante italiana/inglese e schermate del problema.

## Sviluppo, test e release

Ogni release esegue:

- test Python e Ruff;
- test frontend;
- Browser E2E su entrambe le varianti;
- validazione HACS;
- hassfest;
- generazione di `dashboardmodern.zip` dal commit pubblicato.

La produzione usa entrypoint espliciti e verificati per runtime, bridge Home Assistant, pannello e custom card. L'audit automatico fallisce se un modulo moderno `frontend/src` non è raggiungibile da nessun entrypoint reale, se compare un JavaScript legacy orfano o se vengono reintrodotti proprietari duplicati/polling noti delle sezioni live.

## Licenza

Consulta il file `LICENSE` del repository.