<p align="center">
  <img src="https://raw.githubusercontent.com/danigio15/dashboardmodern-v2/main/brand/logo.png" alt="DashboardModern" width="420">
</p>

<h1 align="center">DashboardModern</h1>

<p align="center">
  <b>Una plancia smart-home completa, multiutente e responsive per Home Assistant.</b><br>
  Energia · Fotovoltaico · Batteria · EV · Clima · Luci · Sicurezza · Elettrodomestici · Automazioni
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.15.14-0ea5e9" alt="Versione 0.15.14">
  <img src="https://img.shields.io/badge/HACS-custom-41BDF5" alt="HACS custom integration">
  <img src="https://img.shields.io/badge/Home%20Assistant-2025.1%2B-1e3a8a" alt="Home Assistant 2025.1+">
  <img src="https://img.shields.io/badge/UI-Italiano%20%7C%20English-16a34a" alt="Italiano e inglese">
</p>

> **English overview** — DashboardModern is a responsive, multi-instance Home
> Assistant dashboard distributed as a HACS custom integration. Release 0.15.14
> fixes Energy configuration persistence and refines the appliance and
> temperature layouts on real mobile screens without duplicating runtime owners.

---

## Novità 0.15.14

La 0.15.14 è una hotfix mirata ai problemi rilevati su dispositivo reale dopo la 0.15.13. Mantiene il runtime event-driven e non introduce nuovi owner, polling o copie di artwork.

### Energia: il campo annuale resta davvero vuoto

- corretto il problema per cui, dopo aver eliminato **Energia annuale** e premuto Salva, il contatore **Energia totale** veniva reinserito automaticamente nel campo annuale al caricamento successivo;
- il salvataggio del DashboardStore era già corretto: la causa era una migrazione di compatibilità che veniva applicata ripetutamente;
- la compatibilità annuale/lifetime ora viene applicata una sola volta ai dati vecchi e passa a `semantics_version: 4`;
- dopo la migrazione, un campo annuale lasciato intenzionalmente vuoto resta vuoto attraverso salvataggio, reload e snapshot multi-dispositivo;
- i contatori lifetime continuano a essere usati da Recorder per ricostruire periodi precedenti senza trasformarsi in falsi sensori annuali.

### Elettrodomestici

- corretto il selettore CSS sul DOM reale: il corpo della card legacy è `.appl-info`, non `.appl-wide-body`;
- card mobile centrata e limitata a 370 px;
- artwork mantenuto a 80 × 80 px e lasciato al proprietario esistente `appliance-artwork.js`;
- nome, stato, consumo e kWh hanno spaziatura coerente;
- pulsanti Storico e comando sono più compatti e non dominano più la card;
- nessuna modifica alle immagini configurate o alla logica di scelta artwork.

### Temperature

- card mobile centrata e limitata a 350 px;
- altezza, icona, badge, temperatura e umidità ridimensionati per eliminare l'effetto “card enorme” visto sui telefoni;
- il layout resta nel solo `temperature-layout-section.js` già esistente.

### Branding HACS

Il repository continua a distribuire gli asset locali `brand/` e `custom_components/dashboardmodern/brand/`. La schermata elenco HACS può però mostrare **icon not available** finché il dominio `dashboardmodern` non è registrato anche nel catalogo esterno Home Assistant Brands usato dal frontend HACS. Non vengono aggiunte ulteriori copie dell'icona nel repository perché non risolverebbero quel lookup esterno. La registrazione nel catalogo Brands è un passaggio separato dall'aggiornamento dell'integrazione.

### Conflitti e ownership

- nessun nuovo `MutationObserver` globale;
- nessun nuovo `setInterval`;
- nessun nuovo modulo visuale per Energia, Elettrodomestici o Temperature: le correzioni sono nei rispettivi owner esistenti;
- test dedicati verificano che un annuale vuoto non venga ripopolato e che i layout mobile usino il DOM reale;
- i contratti import-graph/orphan continuano a impedire moduli moderni scollegati e proprietari duplicati.

### HACS e aggiornamento

Dopo un aggiornamento HACS, se compare **In attesa di riavvio**, la nuova versione non va considerata attiva finché Home Assistant non è stato riavviato. Dopo il riavvio chiudi e riapri l'app/browser oppure esegui un refresh completo: il frontend usa asset versionati e una sessione aperta può continuare a mostrare contenuti della release precedente.

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