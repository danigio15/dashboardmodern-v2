<p align="center">
  <img src="https://raw.githubusercontent.com/danigio15/dashboardmodern-v2/main/brand/logo.png" alt="DashboardModern" width="420">
</p>

<h1 align="center">DashboardModern</h1>

<p align="center">
  <b>Una plancia smart-home completa, multiutente e responsive per Home Assistant.</b><br>
  Energia · Fotovoltaico · Batteria · EV · Clima · Luci · Sicurezza · Elettrodomestici · Automazioni
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.15.13-0ea5e9" alt="Versione 0.15.13">
  <img src="https://img.shields.io/badge/HACS-custom-41BDF5" alt="HACS custom integration">
  <img src="https://img.shields.io/badge/Home%20Assistant-2025.1%2B-1e3a8a" alt="Home Assistant 2025.1+">
  <img src="https://img.shields.io/badge/UI-Italiano%20%7C%20English-16a34a" alt="Italiano e inglese">
</p>

> **English overview** — DashboardModern is a responsive, multi-instance Home
> Assistant dashboard distributed as a HACS custom integration. Release 0.15.13
> restores live light/camera updates without reintroducing global rendering,
> fixes current-period Energy semantics, and repairs the affected mobile layouts.

---

## Novità 0.15.13

La 0.15.13 corregge le regressioni visuali e live emerse dopo il conflict audit della 0.15.12, mantenendo il runtime event-driven e i proprietari delle sezioni separati.

### Energia

- i sensori esplicitamente configurati per **Giorno / Mese / Anno** sono autorevoli per il periodo corrente anche quando Home Assistant li espone come `total` o `total_increasing` (caso tipico dei `utility_meter`);
- per i periodi precedenti continua a essere preferito il contatore **Totale/lifetime** tramite Recorder;
- il bilancio Casa usa la stessa relazione dei flussi della dashboard Energia di Home Assistant: produzione + prelievo + scarica batteria − immissione − carica batteria;
- ripristinata nell'Editor l'opzione per mostrare/nascondere **Energia** dalla navbar;
- la configurazione Energia distingue più chiaramente sensori del periodo corrente e contatori totali per lo storico.

### Aggiornamenti live

- il contatore **Luci accese** della Home viene aggiornato sugli `state_changed` delle sole luci configurate;
- il popup Gestione Luci riflette lo stato nuovo senza dover essere chiuso e riaperto;
- le telecamere hanno un proprietario event-driven: le anteprime vengono aggiornate entrando in Sicurezza o quando cambia una camera configurata;
- il vecchio refresh periodico delle telecamere viene disattivato dal proprietario canonico invece di essere sostituito con un altro polling.

### Interfaccia mobile

- corretta la geometria delle card Elettrodomestici senza modificare immagini o logica artwork;
- selettore EV reso compatto e dimensionato sul nome del veicolo;
- popup **Tapparelle aperte** riallineato al contratto modal usato dagli altri avvisi;
- card Temperature rese più compatte e leggibili;
- aumentato il contrasto della navbar in modalità scura;
- ripristinata la lente 🔍 dell'Editor anche quando accanto al campo è già presente un altro pulsante, ad esempio la matita ✏️.

### Conflitti e ownership

- nessun nuovo `MutationObserver` globale;
- `live-ui` gestisce soltanto luci e telecamere, mentre la navbar ha un unico owner visuale dedicato;
- i test automatici verificano owner singoli, assenza di moduli moderni orfani e assenza di polling nei moduli `frontend/src`.

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

Per il **periodo corrente**, i campi Giorno / Mese / Anno possono puntare ai rispettivi sensori di periodo, compresi i `utility_meter` con `state_class: total` o `total_increasing`. Per ottenere in modo affidabile **mesi e anni precedenti**, configura anche il campo **Energia totale** con un contatore lifetime dotato di `device_class: energy` e `state_class: total` o `total_increasing`: il runtime ricostruisce lo storico tramite le statistiche Recorder di Home Assistant.

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