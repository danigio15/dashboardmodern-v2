<p align="center">
  <img src="https://raw.githubusercontent.com/danigio15/dashboardmodern-v2/main/assets/logo@2x.png" alt="DashboardModern" width="420">
</p>

<h1 align="center">DashboardModern</h1>

<p align="center">
  <b>Una plancia smart-home completa, multiutente e responsive per Home Assistant.</b><br>
  Energia · Fotovoltaico · Batteria · EV · Clima · Luci · Sicurezza · Elettrodomestici · Automazioni
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.15.4-0ea5e9" alt="Versione 0.15.4">
  <img src="https://img.shields.io/badge/HACS-custom-41BDF5" alt="HACS custom integration">
  <img src="https://img.shields.io/badge/Home%20Assistant-2025.1%2B-1e3a8a" alt="Home Assistant 2025.1+">
  <img src="https://img.shields.io/badge/UI-Italiano%20%7C%20English-16a34a" alt="Italiano e inglese">
</p>

> **English overview** — DashboardModern is a responsive, multi-instance Home
> Assistant dashboard distributed as a HACS custom integration. Release 0.15.4
> completes the real-UI recovery with stable Energy history, editable existing
> items, corrected EV images, readable Temperature status and theme-aware appliances.

---

## Novità 0.15.4

La 0.15.4 completa la correzione della UI reale di Home Assistant ed è verificata con test Browser E2E su italiano, inglese, desktop, mobile e WebKit/iPad.

### Energia e Report

- mantenuti insieme i sensori **Energia totale** e annuali durante le migrazioni;
- valori giornalieri, mensili e annuali pubblicati come un unico bundle coerente;
- eliminati i valori transitori errati durante il secondo recupero Recorder;
- descrizioni chiare per i contatori `total` e `total_increasing`;
- mesi precedenti ricostruibili anche per gli elettrodomestici tramite il sensore totale;
- editor Report e dettaglio dispositivi resi più completi e leggibili.

### Interfaccia reale

- elementi esistenti modificabili in Azioni, Clima, Tapparelle e Stanze;
- URL auto `/loca/...` normalizzati automaticamente in `/local/...`;
- immagine EV verificata nella pagina pubblica effettiva;
- card Elettrodomestici leggibili e coerenti in modalità chiara e scura;
- badge Temperatura con testo visibile: Freddo, Fresco, Comfort, Tiepido, Caldo o Non disponibile;
- runtime consolidato senza reintrodurre owner numerati o intervalli permanenti.

### HACS e qualità

- manifest, README e contratto release allineati alla versione 0.15.4;
- validazione HACS e hassfest;
- test Python, Ruff, frontend e Browser E2E;
- generazione automatica di `dashboardmodern.zip` dal commit pubblicato.

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

La produzione usa un solo ingresso runtime, `legacy/report-mobile-fixes.js`; le correzioni vengono integrate nei moduli canonici esistenti senza reintrodurre la cascata di owner numerati delle vecchie release.

## Licenza

Consulta il file `LICENSE` del repository.
