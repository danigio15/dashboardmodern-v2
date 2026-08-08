<p align="center">
  <img src="https://raw.githubusercontent.com/danigio15/dashboardmodern-v2/main/brand/logo.png" alt="DashboardModern" width="420">
</p>

<h1 align="center">DashboardModern</h1>

<p align="center">
  <b>Una plancia smart-home completa, multiutente e responsive per Home Assistant.</b><br>
  Energia · Fotovoltaico · Batteria · EV · Clima · Luci · Sicurezza · Elettrodomestici · Automazioni
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.15.17-0ea5e9" alt="Versione 0.15.17">
  <img src="https://img.shields.io/badge/HACS-custom-41BDF5" alt="HACS custom integration">
  <img src="https://img.shields.io/badge/Home%20Assistant-2025.1%2B-1e3a8a" alt="Home Assistant 2025.1+">
  <img src="https://img.shields.io/badge/UI-Italiano%20%7C%20English-16a34a" alt="Italiano e inglese">
</p>

> **English overview** — DashboardModern is a responsive, multi-instance Home
> Assistant dashboard distributed as a HACS custom integration. Release 0.15.17
> keeps an explicitly configured Home period sensor authoritative in Monthly and
> Report, and repairs horizontal overflow in the mobile configuration editor.

---

## Novità 0.15.17

La 0.15.17 corregge due regressioni verificate su dispositivo reale: **Casa mensile/Report sovrascritta dal bilancio dei flussi** e **sezioni Configurazione più larghe del viewport su mobile**.

### Casa mensile e Report: il sensore configurato è autorevole

Il runtime continua a caricare Giorno / Mese / Anno da `sourcePlans()` e dalle statistiche Recorder, ma cambia la regola finale per Casa:

- se per Casa esiste una sorgente valida del periodo, quel valore resta autorevole;
- il bilancio `FV + Rete importata + Batteria scaricata − Rete immessa − Batteria caricata` viene usato **solo come fallback** quando Casa non è configurata;
- Mensile e Report continuano a condividere lo stesso bundle canonico, quindi non possono divergere fra loro dopo il caricamento;
- il Report non effettua una seconda correzione del consumo Casa;
- il test browser usa una fixture in cui Casa mensile diretta vale `28,2 kWh` mentre i flussi bilanciano a `39,9 kWh`: il risultato atteso è ora `28,2`, non il valore ricostruito;
- aggiunto anche il caso numerico riprodotto dallo screenshot reale: `288,8 + 222,0 + 136,3 − 5,8 − 142,4 = 498,9 kWh`; quel `498,9` non può più sostituire un sensore Casa mensile configurato.

### Configurazione mobile riallineata

- `ed-shell`, `ed-body`, form, liste e righe sono vincolati alla larghezza reale del modal;
- gli input `width:100%` dentro righe flex possono ora restringersi con `min-width:0`;
- i campi Nome, Stanza ed Entità degli Elettrodomestici non possono più allargare il modal oltre il viewport;
- i pulsanti a larghezza piena (visibilità sezione, aggiunta entità, salvataggio) restano dentro la schermata;
- testo introduttivo e righe con entity id lunghi non impongono più la larghezza del contenuto;
- il contratto è applicato al Config editor comune, quindi protegge anche le altre sezioni che riusano `.ed-form`, `.ed-form-row` ed `.ed-row`;
- Browser E2E mobile verifica ora la geometria del vero tab **Config → Elettrodomestici**, oltre alle card della dashboard.

### 0.15.16

La 0.15.16 ha introdotto il fallback Recorder per riferimenti di periodo obsoleti e ha riallineato le anteprime visuali di Elettrodomestici, Azioni, Stanze e Avvisi con i renderer effettivi delle sezioni.

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

Per ottenere in modo affidabile **mesi e anni precedenti**, configura preferibilmente il campo **Energia totale** con un contatore lifetime dotato di `device_class: energy` e `state_class: total` o `total_increasing`: il runtime ricostruisce lo storico tramite le statistiche Recorder di Home Assistant. Quando quel campo manca, DashboardModern può riutilizzare un helper cumulativo di periodo esistente come sorgente Recorder.

Per gli elettrodomestici, un sensore **mensile** può alimentare il mese corrente ma non sostituisce un contatore **totale/lifetime** per ricostruire stabilmente i mesi precedenti. Il campo **Energia totale per storico e Report** resta quindi la scelta raccomandata quando disponibile.

Per **Casa**, una sorgente Giorno / Mese / Anno o Totale risolta correttamente è autorevole per quel periodo. Il bilancio dei flussi viene calcolato soltanto quando non esiste alcuna sorgente Casa disponibile per il periodo richiesto.

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
