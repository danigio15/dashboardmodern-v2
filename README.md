<p align="center">
  <img src="https://raw.githubusercontent.com/danigio15/dashboardmodern-v2/main/brand/logo.png" alt="DashboardModern" width="420">
</p>

<h1 align="center">DashboardModern</h1>

<p align="center">
  <b>Una plancia smart-home completa, multiutente e responsive per Home Assistant.</b><br>
  Energia · Fotovoltaico · Batteria · EV · Clima · Luci · Sicurezza · Elettrodomestici · Automazioni
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.15.18-0ea5e9" alt="Versione 0.15.18">
  <img src="https://img.shields.io/badge/HACS-custom-41BDF5" alt="HACS custom integration">
  <img src="https://img.shields.io/badge/Home%20Assistant-2025.1%2B-1e3a8a" alt="Home Assistant 2025.1+">
  <img src="https://img.shields.io/badge/UI-Italiano%20%7C%20English-16a34a" alt="Italiano e inglese">
</p>

> **English overview** — DashboardModern is a responsive, multi-instance Home
> Assistant dashboard distributed as a HACS custom integration. Release 0.15.18
> restores Home Assistant Energy flow-balance parity, initializes/refreshes the
> selected month automatically, and moves popup history to the authenticated HA
> WebSocket transport.

---

## Novità 0.15.18

La 0.15.18 corregge insieme i tre problemi emersi sul dispositivo reale: **Casa diversa dalla dashboard Energia di Home Assistant**, **ricalcolo che partiva solo cambiando mese** e **popup Storico degli elettrodomestici in errore**.

### Casa allineata al bilancio Energia di Home Assistant

Il contatore diretto dell'inverter può rappresentare un confine elettrico diverso dalla distribuzione Energia di Home Assistant. Quando sono disponibili i flussi completi, DashboardModern usa quindi il bilancio canonico:

`Casa = FV + Rete prelevata + Batteria scaricata − Rete immessa − Batteria caricata`

Con i dati reali osservati ad agosto (`270,6 + 19,7 + 42,9 − 118,8 − 49,3`) il risultato è **165,1 kWh**, coerente con i circa **165 kWh** mostrati dalla dashboard Energia di Home Assistant. Il valore diretto Casa (`sensor.solarman_total_load_consumption` nel caso verificato) resta un **fallback** quando il confine dei flussi non è completo.

Per evitare calcoli parziali:

- FV, Rete prelevata e Rete immessa devono essere tutti disponibili;
- carica e scarica batteria sono usate soltanto come coppia completa;
- un impianto senza batteria può comunque usare il bilancio FV + Rete;
- se manca una direzione indispensabile, DashboardModern conserva il contatore Casa configurato invece di assumere zero.

### Mese corrente inizializzato e ricalcolato automaticamente

L'HTML legacy nasce con gennaio come prima voce del selettore e imposta il mese corrente solo durante il primo `renderEnergyDashboard()`. Il runtime moderno poteva iniziare la richiesta Recorder pochi istanti prima, caricando un periodo differente e poi lasciando sullo schermo l'etichetta del mese corrente. Per questo cambiare mese manualmente faceva comparire valori diversi.

La 0.15.18:

- inizializza sincronicamente Mese/Anno al periodo corrente prima della prima richiesta Recorder;
- non sovrascrive un periodo già scelto dall'utente;
- rilancia il caricamento quando arriva `dashboardmodern:states-ready`;
- aggiorna i dati quando si entra in Energia, Report o Mensile e al ritorno della pagina;
- mantiene Report e Mensile sullo stesso bundle canonico.

### Storico elettrodomestici via WebSocket Home Assistant

Il vecchio `apriStorico()` usava `/api/history/period/...` con `LONG_LIVED_TOKEN`. Nel pannello hosted/HACS questo percorso non usa la stessa sessione/trasporto già stabilita dall'integrazione e poteva terminare con **Errore caricamento storico**.

La 0.15.18 introduce un owner moderno dello Storico che:

- usa `history/history_during_period` sullo stesso WebSocket Home Assistant già autenticato dal runtime;
- non dipende da un Long-Lived Access Token separato;
- supporta gli stati compressi restituiti dall'API WebSocket e i formati history completi;
- continua a gestire intervalli 1 / 6 / 12 / 24 ore;
- funziona per sensori numerici e stati categoriali;
- riusa il modal e il grafico esistenti senza introdurre polling globali.

### Test di regressione

La suite include ora contratti espliciti per:

- i numeri reali di agosto: Casa deve risultare circa `165,1 kWh`, non `134,0 kWh`;
- il fallback Casa quando il confine dei flussi è incompleto;
- l'inizializzazione automatica agosto 2026 invece del gennaio predefinito del markup;
- il popup Microonde che deve effettuare `history/history_during_period`, mostrare il grafico e non visualizzare l'errore;
- il browser E2E deve caricare il mese corrente senza richiedere un cambio manuale del selettore.

### 0.15.17

La 0.15.17 ha corretto l'overflow mobile della Configurazione. La regola che rendeva autorevole il contatore Casa diretto è stata invece superata dalla 0.15.18 dopo il confronto con i valori reali della distribuzione Energia di Home Assistant e l'individuazione della race sul mese iniziale.

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

Per il **periodo corrente**, i campi Giorno / Mese / Anno possono puntare ai rispettivi sensori di periodo, compresi gli `utility_meter` con `state_class: total` o `total_increasing`. Se un vecchio riferimento di periodo non esiste più, non viene usato come sorgente runtime.

Per ottenere in modo affidabile **mesi e anni precedenti**, configura preferibilmente i contatori lifetime dotati di `device_class: energy` e `state_class: total` o `total_increasing`: il runtime ricostruisce lo storico tramite le statistiche Recorder di Home Assistant. Quando un totale manca, DashboardModern può riutilizzare un helper cumulativo compatibile come sorgente Recorder.

Per gli elettrodomestici, un sensore **mensile** può alimentare il mese corrente ma non sostituisce un contatore **totale/lifetime** per ricostruire stabilmente i mesi precedenti. Il campo **Energia totale per storico e Report** resta quindi la scelta raccomandata quando disponibile.

Per **Casa**, quando FV + Rete import/export e l'eventuale coppia Batteria charge/discharge sono disponibili, viene usato il bilancio dei flussi coerente con la distribuzione Energia di Home Assistant. Il sensore Casa diretto resta il fallback per configurazioni incomplete.

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
