<p align="center">
  <img src="https://raw.githubusercontent.com/danigio15/dashboardmodern-v2/main/brand/logo.png" alt="DashboardModern" width="420">
</p>

<h1 align="center">DashboardModern</h1>

<p align="center">
  <b>Una plancia smart-home completa, multiutente e responsive per Home Assistant.</b><br>
  Energia · Fotovoltaico · Batteria · EV · Clima · Luci · Sicurezza · Elettrodomestici · Automazioni
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.15.16-0ea5e9" alt="Versione 0.15.16">
  <img src="https://img.shields.io/badge/HACS-custom-41BDF5" alt="HACS custom integration">
  <img src="https://img.shields.io/badge/Home%20Assistant-2025.1%2B-1e3a8a" alt="Home Assistant 2025.1+">
  <img src="https://img.shields.io/badge/UI-Italiano%20%7C%20English-16a34a" alt="Italiano e inglese">
</p>

> **English overview** — DashboardModern is a responsive, multi-instance Home
> Assistant dashboard distributed as a HACS custom integration. Release 0.15.16
> fixes monthly Energy fallback when an old period entity no longer exists and
> aligns editor previews with the visuals actually rendered by the dashboard.

---

## Novità 0.15.16

La 0.15.16 interviene sui due problemi verificati dopo la 0.15.15: **Energia mensile** che poteva restare vuota/non aggiornata nonostante il giornaliero funzionasse, e **icone/anteprime degli editor** non coerenti con le sezioni reali.

### Energia mensile: fallback Recorder reale

- un riferimento mensile salvato in passato ma non più presente in Home Assistant non può più bloccare il calcolo del mese;
- i riferimenti di periodo inesistenti vengono ignorati soltanto nella proiezione runtime: la configurazione salvata dall'utente non viene riscritta automaticamente;
- se il campo Totale/lifetime è vuoto, DashboardModern può usare come sorgente storica un helper Giorno/Mese/Anno realmente esistente con `state_class: total` o `total_increasing`;
- il valore mensile viene ricostruito dalle **Long-Term Statistics / Recorder** usando la crescita del `sum`, quindi resta compatibile con i reset degli `utility_meter`;
- un sensore mensile esplicito e valido continua invece ad avere precedenza per il mese corrente;
- aggiunti test che riproducono il caso reale: giornaliero cumulativo funzionante, vecchio `sensor.monthly_energy` inesistente e nessun lifetime configurato.

Questo rende il comportamento del mese coerente con quello del giorno: la presenza di un vecchio ID non deve trasformarsi in un valore mancante quando Home Assistant possiede già statistiche utilizzabili.

### Editor e icone coerenti con le sezioni

- **Elettrodomestici:** la preview Tipo/immagine usa ora lo stesso `applianceArtwork()` SVG usato nella card; Microonde, Lavatrice, Forno, Frigorifero, Lavastoviglie, Asciugatrice, Boiler, Piano cottura e TV non sono più rappresentati da un'emoji diversa dall'immagine reale;
- **Azioni:** le azioni integrate (Gestione Luci, Clima, Antifurto, Lavatrice) ricevono automaticamente l'icona canonica del tipo; il campo entità viene nascosto quando non è pertinente e la preview segue la scelta effettuata;
- **Stanze:** il campo Icona mostra una preview tramite lo stesso renderer `cdIconMarkup` usato dalla dashboard, compresi gli identificatori `mdi:*`;
- **Avvisi:** l'icona dell'editor segue il gruppo reale (Luci, Tapparelle, Sicurezza, Clima, Elettrodomestici, Altro) invece di mostrare sempre un simbolo generico non collegato alla sezione;
- gli editor continuano a usare gli owner già esistenti: non sono stati aggiunti polling o `MutationObserver` globali.

### 0.15.15: cache frontend

La 0.15.15 ha rimosso il caching di processo del digest frontend. Dopo un aggiornamento HACS, DashboardModern ricalcola l'URL statico dai file realmente presenti su disco, evitando che browser/app continuino a mostrare gli asset della release precedente.

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

Per ottenere in modo affidabile **mesi e anni precedenti**, il percorso preferito resta configurare il campo **Energia totale** con un contatore lifetime dotato di `device_class: energy` e `state_class: total` o `total_increasing`: il runtime ricostruisce lo storico tramite le statistiche Recorder di Home Assistant. Quando quel campo manca, la 0.15.16 può riutilizzare un helper cumulativo di periodo esistente come sorgente Recorder, senza confondere il suo stato corrente con il consumo storico.

Per gli elettrodomestici, un sensore **mensile** può sostituire il valore del mese corrente ma non sostituisce il contatore **totale/lifetime** necessario per ricostruire in modo stabile i mesi precedenti. Il campo **Energia totale per storico e Report** resta quindi la scelta raccomandata quando disponibile.

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
