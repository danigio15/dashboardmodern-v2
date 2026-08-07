<p align="center">
  <img src="https://raw.githubusercontent.com/danigio15/dashboardmodern-v2/main/assets/logo@2x.png" alt="DashboardModern" width="420">
</p>

<h1 align="center">DashboardModern</h1>

<p align="center">
  <b>Una plancia smart-home completa, multiutente e responsive per Home Assistant.</b><br>
  Energia · Fotovoltaico · Batteria · EV · Clima · Luci · Sicurezza · Elettrodomestici · Automazioni
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.15.10-0ea5e9" alt="Versione 0.15.10">
  <img src="https://img.shields.io/badge/HACS-custom-41BDF5" alt="HACS custom integration">
  <img src="https://img.shields.io/badge/Home%20Assistant-2025.1%2B-1e3a8a" alt="Home Assistant 2025.1+">
  <img src="https://img.shields.io/badge/UI-Italiano%20%7C%20English-16a34a" alt="Italiano e inglese">
</p>

> **English overview** — DashboardModern is a responsive, multi-instance Home
> Assistant dashboard distributed as a HACS custom integration. Release 0.15.10
> fixes a startup event storm on real Home Assistant installations, bounds live
> UI refreshes and strengthens production orphan-file auditing.

---

## Novità 0.15.10

La 0.15.10 è una release correttiva per la regressione di avvio introdotta nella 0.15.9 su installazioni Home Assistant reali con molte entità.

### Stabilità runtime

- lo snapshot iniziale `get_states` aggiorna tutti gli stati interni senza generare un evento UI per ogni entità;
- gli aggiornamenti live ravvicinati vengono coalescati e la frequenza delle notifiche UI è limitata;
- Energia, Elettrodomestici, Temperature ed EV non ricevono più una tempesta di rendering durante l'apertura;
- aggiunti test di carico con 2.500 entità iniziali e 500 aggiornamenti live consecutivi.

### Pulizia e verifica

- l'audit dei file non si limita più ai JavaScript legacy ma copre anche tutti i moduli `frontend/src` raggiungibili dagli entrypoint reali;
- rimosso `energy-total-source.js`, facciata di compatibilità non referenziata dal runtime;
- i moduli caricati da `modules-entry.js`, `panel.js` e `dashboard-card.js` vengono riconosciuti correttamente come produzione;
- test, E2E e strumenti di sviluppo restano nel repository sorgente ma sono esclusi dal pacchetto HACS quando non servono a runtime.

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

Per ogni elettrodomestico, il campo **Energia totale** alimenta anche il Report storico quando non sono disponibili sensori giornalieri o mensili dedicati.

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