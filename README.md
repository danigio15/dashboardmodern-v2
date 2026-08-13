<!-- DM-FIX-20260812B -->
<p align="center">
  <img src="https://raw.githubusercontent.com/danigio15/dashboardmodern-v2/main/brand/logo.png" alt="DashboardModern" width="420">
</p>

<h1 align="center">DashboardModern</h1>

<p align="center">
  <b>Una plancia smart-home completa, multiutente e responsive per Home Assistant.</b><br>
  Energia · Fotovoltaico · Batteria · EV · Clima · Luci · Sicurezza · Elettrodomestici · Automazioni
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0--beta.17-0ea5e9" alt="Versione 1.0.0-beta.17">
  <img src="https://img.shields.io/badge/HACS-custom-41BDF5" alt="HACS custom integration">
  <img src="https://img.shields.io/badge/Home%20Assistant-2025.1%2B-1e3a8a" alt="Home Assistant 2025.1+">
  <img src="https://img.shields.io/badge/UI-Italiano%20%7C%20English-16a34a" alt="Italiano e inglese">
</p>

> **English overview** — DashboardModern is a responsive, multi-instance Home
> Assistant dashboard distributed as a HACS custom integration. Release 0.15.25
> adds running and instant-power appliance details, removes the obsolete Alerts
> KPI and keeps appliance popups centered across desktop and mobile.

---

## Novità 0.15.25

La 0.15.25 rifinisce i KPI della sezione **Elettrodomestici** senza modificare il motore Energia.

- **Dispositivi accesi** diventa **In funzione** e conta soltanto gli elettrodomestici realmente in stato `running`, non una presa semplicemente accesa;
- cliccando **In funzione** si apre un popup con i soli apparecchi realmente attivi, artwork, stanza, potenza e stato;
- **Consumo istantaneo** è cliccabile e mostra il dettaglio Watt per apparecchio, ordinato per assorbimento, con percentuale sul totale;
- la KPI **Avvisi** viene rimossa dalla sezione Elettrodomestici;
- i popup In funzione, Consumo istantaneo ed Energia giornaliera restano centrati anche su mobile;
- il popup Energia giornaliera usa un raggio angoli di 12 px;
- la sincronizzazione dei KPI segue lo stesso lifecycle dei renderer Elettrodomestici, senza introdurre polling periodico o nuovi `MutationObserver`;
- Browser E2E verifica italiano/inglese, desktop/mobile/WebKit, conteggi, potenze, artwork e centratura dei popup.

### 0.15.24 — artwork popup e brand

La 0.15.24 rifinisce l'identità visiva del popup **Energia giornaliera** e il packaging del brand dell'integrazione.

- ogni riga del popup usa **la stessa immagine o lo stesso SVG realmente associato alla card dell'elettrodomestico**: Frigorifero mostra il frigorifero, Microonde il microonde e le immagini personalizzate restano identiche alla card;
- il fulmine generico non viene più usato come icona delle singole righe del dettaglio;
- nome, kWh giornalieri e percentuale restano gli unici dati tecnici visibili nel popup;
- il calcolo giornaliero introdotto nella 0.15.22 resta invariato;
- il pacchetto installato include `icon.png`, `dark_icon.png`, le varianti `@2x` e i logo locali dell'integrazione;
- il builder della release fallisce se manca `brand/icon.png` nello ZIP HACS;
- Browser E2E verifica che il popup riusi gli artwork canonici Frigorifero/Microonde e che il fulmine non torni come pseudo-elemento delle righe.

### 0.15.23 — popup Energia elettrodomestici

La 0.15.23 rifinisce il popup **Energia giornaliera** degli Elettrodomestici senza cambiare i calcoli introdotti nella 0.15.22.

- il popup usa lo stesso linguaggio visivo della dashboard: superfici chiare, accenti azzurri, card arrotondate, ombre leggere e layout mobile a bottom sheet;
- nel dettaglio sono visibili soltanto il **nome dell'elettrodomestico**, i **kWh consumati oggi** e la **percentuale sul totale**;
- `entity_id`, nome del sensore, tipo sorgente e diciture tecniche Recorder non vengono più mostrati;
- il totale giornaliero resta invariato e continua a usare sensori giornalieri o delta Recorder dei contatori cumulativi;
- il popup mantiene l'apertura dello storico dalla riga dell'elettrodomestico senza esporre l'entità tecnica;
- Browser E2E verifica che le entità non siano presenti nel testo visibile e che il layout resti coerente su italiano, inglese, mobile e WebKit/iPad.

### 0.15.22 — energia giornaliera e dettaglio consumi

La 0.15.22 corregge i valori **Energia giornaliera** e il totale giornaliero degli **Elettrodomestici** verificati contro i dati reali dell'impianto.

- i contatori cumulativi usati per il giorno corrente vengono letti con statistiche Recorder a breve intervallo, evitando che FV, rete, batteria e Casa restino indietro dell'ora ancora aperta;
- il bilancio Casa resta quello canonico: `FV + Rete prelevata + Batteria scaricata − Rete immessa − Batteria caricata`;
- un sensore totale/lifetime di un elettrodomestico non viene mai più sommato direttamente nel KPI **Energia giornaliera**;
- se esiste un sensore giornaliero esplicito viene usato direttamente; altrimenti un contatore `total` / `total_increasing` viene trasformato nel delta di oggi tramite Recorder;
- sensori energia non cumulativi e non dichiarati come giornalieri non entrano nel totale;
- cliccando il totale **Energia giornaliera** degli Elettrodomestici si apre un popup responsive con il dettaglio dei consumi del giorno;
- dal dettaglio è possibile passare allo storico della singola entità quando disponibile;
- Browser E2E e test unitari coprono esplicitamente il caso in cui un contatore lifetime da 20 kWh non deve diventare consumo di oggi.

### 0.15.21 — catalogo Elettrodomestici e runtime frontend

La 0.15.21 completa la correzione Elettrodomestici e del runtime frontend emersa dopo la 0.15.20.

- **Aggiungi** e **Modifica elettrodomestico** usano lo stesso catalogo canonico completo di 20 tipi e gli stessi SVG;
- i tipi esistenti non vengono più degradati a `generico` quando il record arriva da configurazioni precedenti;
- Modifica conserva e ricostruisce correttamente comando, potenza e collegamenti delle entità già associate;
- il picker dei tipi resta sopra il modal di modifica e riceve correttamente gli eventi pointer anche su mobile e WebKit;
- il companion non conserva più un digest statico obsoleto e il runtime può ripiegare sulla route stabile quando un vecchio asset versionato risponde 404;
- il builder verifica che i documenti dashboard e i runtime necessari siano realmente presenti nello ZIP della release;
- la suite Browser E2E copre la parità Add/Edit in italiano e inglese su desktop, mobile e WebKit/iPad.

### 0.15.20 — hardening release e artwork

La 0.15.20 corregge la regressione dell'anteprima **Modifica elettrodomestico** e chiude i problemi emersi dall'audit della pipeline e del runtime.

- l'anteprima Modifica usa di nuovo lo stesso `applianceArtwork()` della prima configurazione e della card, non l'emoji del menu;
- Chart.js, panzoom e hls.js sono versionati esattamente e protetti da SRI;
- il digest frontend viene calcolato una sola volta fuori dall'event loop e riusato da statici, custom card e pannello;
- i file statici pubblici sono limitati agli asset runtime realmente raggiungibili;
- la release fallisce se il tag della versione esiste già e gli E2E girano anche su push a `main` e nel gate di release;
- il marker Energia usa `build-info.js` e non una versione hardcoded obsoleta;
- `strings.json` torna alla sorgente inglese prevista da Home Assistant e la selezione utenti è documentata correttamente come filtro UI;
- rimossi duplicati bridge e riferimenti di packaging morti; il brand installato è verificato esplicitamente dalla pipeline di release.

### 0.15.19 — Analisi settimanale e polish Editor

La 0.15.19 parte dal motore Energia della 0.15.18, già allineato alla distribuzione Energia di Home Assistant, e interviene soltanto su **Analisi** e sull'esperienza grafica dell'Editor Dashboard.

### Confronto settimanale dei consumi Casa

La scheda **Analisi → Confronto Settimanale** non mostra più trattini: confronta ora il consumo **Casa** della settimana corrente con quello della settimana precedente.

- la settimana parte da lunedì;
- **Questa settimana** copre da lunedì a questo momento;
- **Settimana scorsa** copre il precedente intervallo completo lunedì → lunedì;
- lo storico viene ricostruito dai contatori cumulativi tramite Recorder;
- quando FV + Rete import/export e l'eventuale coppia Batteria sono completi, Casa usa lo **stesso bilancio Home Assistant** del Report;
- il contatore totale Casa resta fallback se il confine dei flussi è incompleto;
- viene mostrata anche la variazione percentuale rispetto alla settimana precedente.

I sensori Giorno/Mese/Anno non vengono riutilizzati impropriamente come storico settimanale: per il confronto vengono preferiti i contatori `total` / `total_increasing`.

### Config Energia più leggibile

La guida delle sorgenti Energia è stata riorganizzata in tre concetti visivi:

1. **Storico e mesi precedenti** → usa il **contatore totale kWh** tramite Recorder.
2. **Giorno / Mese / Anno** → sono override facoltativi del singolo periodo.
3. **Consumo Casa** → usa il bilancio Home Assistant quando i flussi sono completi; il sensore Casa resta fallback.

Le entità possono andare a capo invece di essere troncate e, soprattutto su mobile, Giorno/Mese/Anno/Storico sono separati in righe più leggibili.

### Config Elettrodomestici

Nel modal **Modifica elettrodomestico** l'icona di anteprima segue ora esattamente il simbolo della voce selezionata nel menu a tendina. La card continua a usare l'illustrazione coordinata dello stesso tipo, ma nell'Editor non c'è più discordanza tra menu e riquadro di anteprima.

### Config Luci

Le righe Luci su mobile usano una geometria compatta: nome, modifica ed elimina restano nella prima riga; stanza e ordinamento hanno aree dedicate sotto. Viene eliminato il grande spazio vuoto che separava i controlli e tutte le righe rimangono dentro la larghezza del modal.

### Config Temperatura

Temperatura adotta lo stesso linguaggio visivo degli altri editor canonici:

- sensori già configurati in card compatte;
- form Aggiungi racchiuso in un pannello coerente;
- campi a due colonne su desktop e una colonna su mobile;
- modalità **Modifica** evidenziata;
- il pulsante mostra **ASSOCIA SENSORI** in aggiunta e **SALVA MODIFICHE** durante la modifica, senza essere riscritto dal contratto globale dell'Editor.

### Verifica 0.15.19

La suite copre esplicitamente:

- intervalli settimanali lunedì → lunedì;
- consumo Casa settimanale con lo stesso flow-balance del Report;
- fallback al contatore totale Casa se i flussi sono incompleti;
- uso dei contatori cumulativi Recorder per il confronto storico;
- preview Elettrodomestico sincronizzata col menu;
- layout Luci mobile senza overflow;
- Temperatura add/edit con etichette corrette;
- leggibilità della guida Energia su viewport stretti.

Nessun nuovo polling globale viene introdotto dalla 0.15.19.

### 0.15.18 — stabilizzazione Energia e Storico

La 0.15.18 ha corretto insieme **Casa diversa dalla dashboard Energia di Home Assistant**, **ricalcolo che partiva solo cambiando mese** e **popup Storico degli elettrodomestici in errore**.

Quando sono disponibili i flussi completi, DashboardModern usa il bilancio canonico:

`Casa = FV + Rete prelevata + Batteria scaricata − Rete immessa − Batteria caricata`

Con i dati reali osservati ad agosto (`270,6 + 19,7 + 42,9 − 118,8 − 49,3`) il risultato è **165,1 kWh**, coerente con i circa **165 kWh** mostrati dalla dashboard Energia di Home Assistant. Il valore diretto Casa resta fallback quando il confine dei flussi non è completo.

La stessa release ha inoltre:

- inizializzato Mese/Anno prima della prima richiesta Recorder, eliminando il cambio mese manuale necessario al ricalcolo;
- mantenuto Report e Mensile sullo stesso bundle canonico;
- spostato lo Storico elettrodomestici su `history/history_during_period` tramite il WebSocket Home Assistant autenticato;
- dato priorità alla potenza istantanea nei grafici 1 / 6 / 12 / 24 ore, lasciando il totale kWh a Report e storico energetico.

---

## Funzioni principali

- dashboard italiana e inglese;
- configurazione visuale delle entità Home Assistant;
- Energia con viste giornaliera, mensile, annuale, Report e Analisi;
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

Per ottenere in modo affidabile **mesi, anni e settimane precedenti**, configura preferibilmente i contatori lifetime dotati di `device_class: energy` e `state_class: total` o `total_increasing`: il runtime ricostruisce lo storico tramite le statistiche Recorder di Home Assistant.

Per gli elettrodomestici, un sensore **mensile** può alimentare il mese corrente ma non sostituisce un contatore **totale/lifetime** per ricostruire stabilmente i mesi precedenti. Il campo **Energia totale per storico e Report** resta quindi la scelta raccomandata quando disponibile.

Per **Casa**, quando FV + Rete import/export e l'eventuale coppia Batteria charge/discharge sono disponibili, viene usato il bilancio dei flussi coerente con la distribuzione Energia di Home Assistant. Il sensore Casa diretto resta il fallback per configurazioni incomplete. Lo stesso criterio viene usato dal confronto settimanale in Analisi.

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
