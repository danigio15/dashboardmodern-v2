<p align="center">
  <img src="https://raw.githubusercontent.com/danigio15/dashboardmodern-v2/main/brand/logo@2x.png" alt="DashboardModern" width="420">
</p>

<h1 align="center">DashboardModern</h1>

<p align="center">
  <b>Una plancia smart-home completa, multiutente e responsive per Home Assistant.</b><br>
  Energia · Fotovoltaico · Batteria · EV · Clima · Luci · Sicurezza · Elettrodomestici · Automazioni
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.15.11-0ea5e9" alt="Versione 0.15.11">
  <img src="https://img.shields.io/badge/HACS-custom-41BDF5" alt="HACS custom integration">
  <img src="https://img.shields.io/badge/Home%20Assistant-2025.1%2B-1e3a8a" alt="Home Assistant 2025.1+">
  <img src="https://img.shields.io/badge/UI-Italiano%20%7C%20English-16a34a" alt="Italiano e inglese">
</p>

> **English overview** — DashboardModern is a responsive, multi-instance Home
> Assistant dashboard distributed as a HACS custom integration. Release 0.15.11
> reconciles Home energy with Home Assistant's energy-flow balance, fixes
> appliance state/history semantics, unifies editor dialogs and further reduces
> unnecessary live-state rendering.

---

## Novità 0.15.11

La 0.15.11 corregge le regressioni rilevate sull'installazione Home Assistant reale dopo la 0.15.10.

### Energia

- quando Fotovoltaico e Rete sono configurati, il consumo **Casa** viene riconciliato con lo stesso bilancio dei flussi usato dalla dashboard Energia di Home Assistant;
- il contatore Casa diretto resta un fallback quando non esistono sorgenti sufficienti per ricostruire il bilancio;
- i sensori mensili degli elettrodomestici non vengono più interpretati come contatori lifetime per storico e mesi precedenti;
- le righe Report restano entro i bordi dell'Editor anche su viewport stretti.

### Elettrodomestici ed Editor

- un dispositivo a **0 W** con smart plug ancora ON non viene più mostrato come **IN FUNZIONE**;
- la card mostra un solo comando **Accendi/Spegni**;
- `state_entity` e `status_entity` restano separati dall'entità di comando;
- il campo **Energia totale per storico e Report** accetta il ruolo lifetime solo per sorgenti cumulative `total`/`total_increasing`;
- i modal di modifica condividono shell, header, campi, scroll e footer coerenti;
- le informazioni specifiche Energia non rimangono più visibili passando ad Avvisi o ad altre sezioni.

### Prestazioni e pulizia

- gli aggiornamenti Home Assistant non configurati vengono memorizzati senza provocare render della dashboard;
- EV e Temperature reagiscono soltanto alle proprie entità configurate;
- l'observer dell'Editor ignora le mutazioni DOM non appartenenti agli editor;
- le configurazioni legacy, compresi i profili EV, restano incluse nel filtro degli aggiornamenti live;
- rimossi test di vecchie release e copie di asset non necessarie, mantenendo i contratti correnti sotto test.

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

Da HACS apri DashboardModern v2, scegli la release più recente e premi **Aggiorna**. Dopo l'aggiornamento esegui il riavvio richiesto da Home Assistant; quindi ricarica completamente la pagina del browser.

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
- riavvio completato dopo l'aggiornamento;
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

La produzione usa entrypoint espliciti e verificati per runtime, bridge Home Assistant, pannello e custom card. L'audit automatico fallisce se un modulo moderno `frontend/src` non è raggiungibile da nessun entrypoint reale oppure se compare un JavaScript legacy orfano.

## Licenza

Consulta il file `LICENSE` del repository.