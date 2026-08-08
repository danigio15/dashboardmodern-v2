<p align="center">
  <img src="https://raw.githubusercontent.com/danigio15/dashboardmodern-v2/main/brand/logo.png" alt="DashboardModern" width="420">
</p>

<h1 align="center">DashboardModern</h1>

<p align="center">
  <b>Una plancia smart-home completa, multiutente e responsive per Home Assistant.</b><br>
  Energia · Fotovoltaico · Batteria · EV · Clima · Luci · Sicurezza · Elettrodomestici · Automazioni
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.15.15-0ea5e9" alt="Versione 0.15.15">
  <img src="https://img.shields.io/badge/HACS-custom-41BDF5" alt="HACS custom integration">
  <img src="https://img.shields.io/badge/Home%20Assistant-2025.1%2B-1e3a8a" alt="Home Assistant 2025.1+">
  <img src="https://img.shields.io/badge/UI-Italiano%20%7C%20English-16a34a" alt="Italiano e inglese">
</p>

> **English overview** — DashboardModern is a responsive, multi-instance Home
> Assistant dashboard distributed as a HACS custom integration. Release 0.15.15
> fixes stale frontend asset URLs after HACS updates so a valid release cannot
> keep rendering the previous cached UI after an integration reload.

---

## Novità 0.15.15

La 0.15.15 corregge il meccanismo di cache che poteva far sembrare invariata una release realmente aggiornata. Le correzioni funzionali e visuali della 0.15.14 restano invariate; questa hotfix interviene sul modo in cui Home Assistant pubblica gli asset frontend dopo un aggiornamento HACS.

### Cache frontend e aggiornamenti HACS

- il digest usato nell'URL statico versionato non viene più conservato in una `lru_cache` per tutta la vita del processo Home Assistant;
- il digest viene ricalcolato dagli asset runtime realmente presenti su disco quando l'integrazione registra di nuovo il frontend;
- se HACS sostituisce i file della dashboard, il nuovo contenuto produce un URL statico differente invece di riutilizzare quello della release precedente;
- il nome del custom panel e il modulo `dashboard-card.js` usano lo stesso digest aggiornato;
- aggiunto un test di regressione che modifica fisicamente `panel.js` e verifica che digest e URL statico cambino senza svuotare manualmente cache interne;
- nessun nuovo polling, observer o owner visuale è stato introdotto.

### Perché la 0.15.14 poteva sembrare identica

La 0.15.14 contiene realmente le correzioni a Energia, card Elettrodomestici e Temperature. Il problema era nel layer che serve il frontend: `_frontend_asset_version()` veniva memorizzato nel processo Python. Dopo l'aggiornamento HACS, un reload dell'integrazione poteva quindi continuare a registrare lo stesso URL immutabile già presente nella cache del browser, anche se i file su disco erano cambiati.

### Primo aggiornamento alla 0.15.15

La 0.15.15 non può sostituire retroattivamente il codice Python della 0.15.14 già caricato in memoria. Dopo aver installato questa release con HACS, esegui **un riavvio completo di Home Assistant** se compare **In attesa di riavvio**. Dopo quel riavvio, chiudi e riapri l'app/browser oppure esegui un refresh completo. Da quel momento il runtime non mantiene più il digest frontend obsoleto attraverso i reload dell'integrazione.

### Correzioni ereditate dalla 0.15.14

- **Energia:** un campo annuale lasciato intenzionalmente vuoto non viene più ripopolato dal contatore lifetime dopo Salva/reload;
- **Elettrodomestici:** il layout usa il vero body `.appl-info`, card mobile fino a 370 px, artwork almeno 80 × 80 px e pulsanti più compatti;
- **Temperature:** card mobile fino a 350 px con tipografia e spaziature ridotte;
- **Branding HACS:** gli asset locali restano presenti; l'eventuale `icon not available` nella lista HACS dipende dal catalogo esterno Home Assistant Brands, non da copie locali mancanti.

### Conflitti e ownership

- nessun nuovo `MutationObserver` globale;
- nessun nuovo `setInterval`;
- nessun nuovo modulo visuale per Energia, Elettrodomestici o Temperature;
- il test cache-busting si aggiunge ai contratti import-graph/orphan e ai test della persistenza Energia e layout mobile;
- il vecchio contratto release 0.15.14 viene sostituito da quello 0.15.15, non duplicato.

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

Per il **periodo corrente**, i campi Giorno / Mese / Anno possono puntare ai rispettivi sensori di periodo, compresi i `utility_meter` con `state_class: total` o `total_increasing`. Se non disponi di un sensore annuale dedicato, il campo **Energia annuale** può rimanere vuoto: non viene più ripopolato automaticamente dal contatore totale.

Per ottenere in modo affidabile **mesi e anni precedenti**, configura il campo **Energia totale** con un contatore lifetime dotato di `device_class: energy` e `state_class: total` o `total_increasing`: il runtime ricostruisce lo storico tramite le statistiche Recorder di Home Assistant.

Per gli elettrodomestici, un sensore **mensile** può sostituire il valore del mese corrente ma non sostituisce il contatore **totale/lifetime** necessario per ricostruire i mesi precedenti. Il campo **Energia totale per storico e Report** deve quindi puntare a un contatore cumulativo con `state_class: total` o `total_increasing`.

Quando sono disponibili Fotovoltaico, Rete e Batteria, DashboardModern ricava il consumo Casa dal bilancio dei flussi per mantenere parità con la dashboard Energia di Home Assistant. Il contatore Casa diretto resta disponibile come fallback quando il bilancio non può essere ricostruito.

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
