<p align="center">
  <img src="https://raw.githubusercontent.com/danigio15/dashboardmodern-v2/main/brand/logo.png" alt="DashboardModern" width="430">
</p>

<h1 align="center">DashboardModern v2</h1>

<p align="center">
  <strong>La dashboard completa per Home Assistant: si configura a video, funziona su telefono, tablet e desktop.</strong><br>
  Energia · Fotovoltaico · Batteria · Elettrodomestici · Auto elettrica · Clima · Temperatura · Luci · Tapparelle · Sicurezza · Solare termico · Piscina · Irrigazione · Server
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-0ea5e9" alt="Versione 1.0.0">
  <a href="https://github.com/danigio15/dashboardmodern-v2/releases"><img src="https://img.shields.io/github/v/release/danigio15/dashboardmodern-v2?label=release&color=0ea5e9" alt="Release"></a>
  <a href="https://github.com/danigio15/dashboardmodern-v2/actions/workflows/tests.yml"><img src="https://github.com/danigio15/dashboardmodern-v2/actions/workflows/tests.yml/badge.svg" alt="Tests"></a>
  <a href="https://github.com/danigio15/dashboardmodern-v2/releases"><img src="https://img.shields.io/github/downloads/danigio15/dashboardmodern-v2/total?label=download%20dalla%201.0.0&color=8b5cf6&cacheSeconds=1800" alt="Download dalla 1.0.0"></a>
  <a href="https://www.paypal.com/paypalme/giovannidaniello15"><img src="https://img.shields.io/badge/PayPal-sostieni-003087?logo=paypal&logoColor=white" alt="Sostieni il progetto con PayPal"></a>
  <img src="https://img.shields.io/badge/HACS-custom-41BDF5" alt="HACS custom integration">
  <img src="https://img.shields.io/badge/Home%20Assistant-2025.1%2B-18BCF2" alt="Home Assistant 2025.1+">
  <img src="https://img.shields.io/badge/UI-Italiano%20%7C%20English-16a34a" alt="Italiano e inglese">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-64748b" alt="MIT License"></a>
</p>

<p align="center">
  <a href="#installazione">Installazione</a> ·
  <a href="#anteprima-sezione-per-sezione">Anteprime</a> ·
  <a href="#editor-dashboard-tutte-le-configurazioni">Configurazioni</a> ·
  <a href="#potenzialità">Potenzialità</a> ·
  <a href="CHANGELOG.md">Changelog</a> ·
  <a href="#risoluzione-problemi">Problemi</a> ·
  <a href="#supporta-il-progetto">Sostieni il progetto</a>
</p>

<p align="center">
  <img src="docs/preview/home-light.webp" alt="Home di DashboardModern, tema chiaro" width="100%">
  <img src="docs/preview/home.webp" alt="Home di DashboardModern, tema scuro" width="100%">
</p>

<table>
<tr>
<td width="30%"><img src="docs/preview/home-mobile-light.webp" alt="Home su telefono, tema chiaro"></td>
<td width="70%"><img src="docs/preview/energy-flow-light.webp" alt="Flusso energetico live, tema chiaro"></td>
</tr>
</table>

---

## Cos'è DashboardModern

**DashboardModern v2** è una custom integration per Home Assistant che aggiunge alla barra laterale una **plancia completa**, già pronta per l'uso quotidiano, che si configura interamente a video.

Le entità restano entità Home Assistant: DashboardModern si occupa di presentazione, aggregazioni, storico e comandi. Non serve costruire decine di card Lovelace, non serve scrivere YAML.

- **Nessun token da incollare, nessun file da scaricare, nessun `configuration.yaml` da modificare.** Il pannello passa alla plancia la sessione già autenticata di Home Assistant.
- **Tutto si configura dall'editor visuale**, dentro la plancia stessa: diciotto tab, un pulsante di salvataggio per pannello.
- **La configurazione vive dentro Home Assistant**, in un archivio condiviso dell'integrazione: la stessa per tutti gli utenti e per tutti i dispositivi.
- **Italiano e inglese**, scelti dalla lingua del profilo Home Assistant.
- **Più plance indipendenti**, una config entry ciascuna, con filtro utenti.

> **1.0 stabile.** La serie beta è chiusa: la pagina delle release parte da **`v1.0.0`** — beta, rc e `v0.x` non ci sono più — e le correzioni arriveranno come `1.0.x`. Chi arriva da una versione precedente aggiorna da HACS, riavvia Home Assistant e ritrova la propria configurazione. La cronologia completa resta in [`docs/CHANGELOG_PRE_1.0.md`](docs/CHANGELOG_PRE_1.0.md).

---

## Indice

- [Requisiti](#requisiti)
- [Installazione](#installazione)
- [Configurazione dell'integrazione](#configurazione-dellintegrazione)
- [Prima configurazione della plancia](#prima-configurazione-della-plancia)
- [Dove viene salvata la configurazione](#dove-viene-salvata-la-configurazione)
- [Anteprima sezione per sezione](#anteprima-sezione-per-sezione)
  - [Home](#home) · [Navigazione](#navigazione) · [Tema](#tema-chiaro-e-scuro) · [Kiosk](#modalità-kiosk-su-iphone-e-ipad) · [Energia](#energia) · [Elettrodomestici](#elettrodomestici) · [Auto elettrica](#auto-elettrica-e-wallbox) · [Luci](#luci) · [Clima](#clima) · [Temperatura](#temperatura-e-umidità) · [Tapparelle](#tapparelle) · [Sicurezza](#sicurezza-e-telecamere) · [Solare termico](#solare-termico) · [Piscina](#piscina) · [Irrigazione](#irrigazione) · [MiniPC](#minipc-e-rete)
- [Editor Dashboard: tutte le configurazioni](#editor-dashboard-tutte-le-configurazioni)
  - [Autorilevamento entità](#autorilevamento-entità)
- [Catalogo completo degli slot entità](#catalogo-completo-degli-slot-entità)
- [Come vengono calcolati i numeri](#come-vengono-calcolati-i-numeri)
- [Potenzialità](#potenzialità)
- [Architettura in breve](#architettura-in-breve)
- [Sviluppo, test e anteprime](#sviluppo-test-e-anteprime)
- [Risoluzione problemi](#risoluzione-problemi)
- [Documentazione del progetto](#documentazione-del-progetto)
- [Download e diffusione](#download-e-diffusione)
- [Supporta il progetto](#supporta-il-progetto)

---

## Requisiti

| Requisito | Valore |
| --- | --- |
| Home Assistant | **2025.1.0** o successivo |
| Installazione | HACS come *custom repository* (tipo: Integrazione), oppure copia manuale in `custom_components/` |
| Consigliato | `recorder` attivo: serve per storico, report e analisi Energia |
| Browser | qualsiasi browser moderno; app Companion iOS e Android supportate |
| Entità | le tue: DashboardModern **non crea** entità, usa quelle già presenti in Home Assistant |

---

## Installazione

### Con HACS (consigliato)

1. Apri **HACS** in Home Assistant.
2. Menu in alto a destra → **Archivi personalizzati** / *Custom repositories*.
3. Inserisci l'URL del repository e scegli il tipo **Integrazione**:

   ```text
   https://github.com/danigio15/dashboardmodern-v2
   ```

4. Cerca **Dashboard Modern V2** e installa la versione più recente.
5. **Riavvia Home Assistant.**
6. **Impostazioni → Dispositivi e servizi → Aggiungi integrazione → Dashboard Modern V2**.
7. Dai un nome alla plancia e conferma.
8. Apri **DashboardModern** dalla barra laterale.

### Installazione manuale

1. Copia la cartella `custom_components/dashboardmodern/` nella tua `config/custom_components/`.
2. Riavvia Home Assistant e aggiungi l'integrazione dal passo 6 qui sopra.

### Dopo un aggiornamento

Gli asset del frontend sono pubblicati su un URL versionato con il **digest del contenuto** (`/dashboardmodern_static/<digest>/…`): quando aggiorni, l'URL cambia e il browser scarica la versione nuova senza hard refresh. Serve comunque:

1. riavviare Home Assistant quando HACS mostra **In attesa di riavvio**;
2. sull'app Companion, chiuderla e riaprirla se resta visibile la versione precedente.

---

## Configurazione dell'integrazione

### Creazione della plancia

Il config flow chiede una sola cosa: il **nome del pannello**, quello che compare nella barra laterale. La prima plancia è la **principale** e mantiene il percorso `/dashboardmodern`; le successive prendono un percorso derivato dal nome (`/dashboardmodern-<nome>`), così puoi averne più di una senza collisioni.

### Opzioni (Configura)

**Impostazioni → Dispositivi e servizi → Dashboard Modern V2 → Configura**

| Opzione | Cosa fa | Default |
| --- | --- | --- |
| **Utenti consentiti** | filtro di visibilità della plancia: lista vuota = la vedono tutti, altrimenti solo gli utenti scelti | vuoto |
| **Registra come dashboard Home Assistant** | crea la dashboard companion (visibile in *Impostazioni → Dashboard*), costruita con la card `dashboardmodern-card` | attivo |
| **Visibile solo agli amministratori** | usa il filtro nativo `require_admin` del pannello Home Assistant | disattivo |

> Il filtro **Utenti consentiti** è una visibilità di interfaccia: non sostituisce permessi e autorizzazioni di Home Assistant, che continuano a governare l'accesso a dati e servizi.

### Cosa registra l'integrazione

| Elemento | Dettaglio |
| --- | --- |
| Pannello laterale | `custom` panel, icona `mdi:view-dashboard-edit`, uno per config entry |
| Asset statici | `/dashboardmodern_static/<digest>/…`, versionati sul contenuto |
| Comandi WebSocket | `dashboardmodern/config/get`, `/set`, `/restore` per l'archivio condiviso |
| Card companion | `dashboardmodern-card` (richiede `entry_id`), caricata come extra module del frontend |
| Dashboard companion | `dashboardmodern-<primi 8 caratteri dell'entry id>` quando l'opzione è attiva |
| Documenti UI | `dashboard.html` (IT) e `dashboard-en.html` (EN), scelti dalla lingua del profilo |

---

## Prima configurazione della plancia

Apri **DashboardModern** dalla barra laterale, poi **Editor Dashboard**.

> **Scorciatoia consigliata.** In **⚙️ Impostazioni** c'è il pulsante **🪄 Avvia autorilevamento**: analizza tutte le entità di Home Assistant, propone luci, stanze, unità clima, telecamere e collegamenti, e ti mostra cosa ha trovato **prima** di scrivere qualsiasi cosa. È il modo più veloce per partire; poi si rifinisce a mano tab per tab. → [Autorilevamento entità](#autorilevamento-entità)

Ordine consigliato (o revisione dopo l'autorilevamento):

1. **Stanze** — creale per prime: sono il riferimento canonico di tutte le altre sezioni.
2. **Energia** — collega fotovoltaico, rete, batteria e consumo casa.
3. **Carichi** — definisci i cerchi sotto Casa nel flusso (wallbox, clima, cucina…).
4. **Elettrodomestici** — aggiungi gli apparecchi e i loro sensori.
5. **Temperatura** — associa temperatura e umidità alle stanze già create.
6. **Luci, Clima, Tapparelle** — assegna ogni entità alla stanza corretta.
7. **Auto/Wallbox, Sicurezza, Piscina, Irrigazione, MiniPC** — abilita solo ciò che usi.
8. **Azioni rapide, Avvisi, personalizzazione** — icone, ordine navbar, comandi preferiti.

Ogni pannello dell'editor ha il proprio pulsante di salvataggio — **SALVA MODIFICHE**, **Salva sezione**, **Salva energia**, **Salva carichi** — e va premuto prima di cambiare tab o chiudere l'editor.

> **Ogni campo entità è una riga uguale in tutte le maschere**: mostra il nome che Home Assistant dà all'entità con l'id sotto, e si tocca per aprire la ricerca. La ricerca propone per prime le entità adatte a quel campo (contrassegnate con ✨), ignora accenti e maiuscole, resta immediata anche con migliaia di entità e si comanda da tastiera. L'id da scrivere a mano resta dietro la matita accanto alla riga, e il **cestino svuota la riga**: c'è su tutte le righe che chiedono un'entità — Home, Energia, Solare termico, MiniPC, Azioni comprese — e compare solo quando c'è davvero qualcosa da togliere. Il catalogo si apre **davanti** alla maschera che lo ha chiamato, e **uno solo per volta**: aprirne un altro chiude il precedente.

---

## Dove viene salvata la configurazione

La configurazione della plancia sta **dentro Home Assistant**, in un archivio dell'integrazione (`.storage/dashboardmodern.config`), non nel browser. Non c'è nulla da esportare o importare: salvataggio e ripristino sono automatici.

Di conseguenza:

- **è la stessa su tutti i dispositivi e per tutti gli utenti** dell'installazione: aprendo la plancia da un altro browser, da un altro account Home Assistant o dall'app Companion la ritrovi già configurata;
- **sopravvive** agli aggiornamenti, al riavvio di Home Assistant, alla pulizia della cache del browser e anche alla rimozione e riaggiunta dell'integrazione, perché la chiave dell'archivio non contiene l'`entry_id`;
- **non può essere svuotata per sbaglio da un dispositivo**: chi non riesce a leggere la configurazione non ne scrive una vuota al suo posto, e l'archivio rifiuta un salvataggio che sostituirebbe una plancia configurata con una vuota;
- **i conflitti si risolvono sulla revisione dell'archivio**, non sull'orologio del dispositivo: un telefono con l'ora avanti non sovrascrive modifiche più recenti fatte altrove;
- **conserva le ultime cinque revisioni configurate**, quindi una plancia svuotata da una versione precedente viene ripristinata da sola. L'unico svuotamento definitivo è il reset chiesto esplicitamente.

Restano legate al singolo dispositivo solo le preferenze che hanno senso solo lì: **tema**, **modalità della barra di navigazione**, stato del **kiosk** e dati di connessione.

---
# Anteprima sezione per sezione

> Tutte le immagini di questo README sono generate automaticamente da `scripts/capture-previews.mjs` su una **casa demo inventata** (`scripts/preview-fixture.mjs`): nessun dato, nessuna telecamera e nessun consumo appartiene a un impianto reale. Ogni sezione è mostrata in **tema chiaro e in tema scuro**, su desktop e su telefono. Per rigenerarle: [Sviluppo, test e anteprime](#sviluppo-test-e-anteprime).

## Home

La Home riunisce meteo, pillole di stato, **Quadro Avvisi** e **Azioni rapide**.

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/home-light.webp" alt="Home in tema chiaro"> | <img src="docs/preview/home.webp" alt="Home in tema scuro"> |
| <img src="docs/preview/home-mobile-light.webp" alt="Home su telefono, tema chiaro" width="230"> | <img src="docs/preview/home-mobile.webp" alt="Home su telefono, tema scuro" width="230"> |

**Cosa mostra**

- **Meteo**: temperatura, condizione, umidità e vento dall'entità `weather.*`; tocca per aprire il dettaglio con le previsioni.
- **Pillole di stato**: caldaia accesa e stato antifurto, visibili solo quando servono.
- **Quadro Avvisi**: card che appaiono solo se c'è qualcosa da dire — luci accese, clima attivi, riscaldamento, aperture, tapparelle aperte — più gli **avvisi personalizzati** che aggiungi tu. Ogni card apre il popup con le entità coinvolte, e l'animazione dell'icona segue il senso dell'avviso.
- **Azioni rapide**: griglia di comandi preferiti (popup integrati, gruppi di luci, toggle, script, scene).

**Configurazione**: `Editor → Home` (meteo, allarme, antifurto, script cancello), `Editor → Avvisi`, `Editor → Azioni`.

## Navigazione

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/navigation-light.webp" alt="Barra di navigazione in tema chiaro"> | <img src="docs/preview/navigation.webp" alt="Barra di navigazione in tema scuro"> |
| <img src="docs/preview/navigation-mobile-light.webp" alt="Barra di navigazione su telefono, tema chiaro" width="230"> | <img src="docs/preview/navigation-mobile.webp" alt="Barra di navigazione su telefono, tema scuro" width="230"> |

La barra è **flottante e auto-nascosta**: su desktop riappare avvicinando il puntatore al bordo inferiore, su touch con la maniglia, e si comporta allo stesso modo in ogni sezione. Le sezioni non configurate non compaiono, l'**ordine è personalizzabile** (`Editor → Impostazioni → Ordine navbar`) e la sezione attiva è evidenziata.

**Ogni pagina si apre allo stesso modo**: stessa intestazione con titolo e sottotitolo, stesso ritorno alla Home in alto a sinistra.

## Tema chiaro e scuro

Il tema si imposta su **chiaro**, **scuro** o **auto** — e *auto*, il default, segue la preferenza del dispositivo. È una preferenza locale: non viene sincronizzata sugli altri dispositivi, così il tablet in cucina può restare chiaro e il telefono scuro di notte.

## Modalità kiosk su iPhone e iPad

Su un dispositivo iOS che apre la plancia dentro Home Assistant — pannello nella barra laterale, dashboard companion o app Companion — la plancia parte **a schermo intero**: copre la barra di Home Assistant e usa tutta l'altezza dello schermo, aree sicure intorno alla tacca comprese.

- **L'hamburger della plancia apre la barra laterale di Home Assistant**: mentre è aperta, la plancia si abbassa per lasciarla vedere.
- **Tieni premuto l'hamburger** per mezzo secondo per accendere o spegnere il kiosk, con conferma a schermo.
- In alternativa apri la plancia con `?kiosk=1` o `?kiosk=0` (vale anche `dm_kiosk`, in query o nell'hash): **la scelta viene ricordata su quel dispositivo**.

Fuori da quel caso il kiosk resta a richiesta: su desktop, su tablet in orizzontale e sulla plancia aperta da sola serve `?kiosk=1` esplicito.

## Energia

Cinque viste: **Istantanea**, **Giornaliera**, **Mensile**, **Report** e **Temperature**.

### Flusso live (Istantanea)

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/energy-flow-light.webp" alt="Flusso energetico live in tema chiaro"> | <img src="docs/preview/energy-flow.webp" alt="Flusso energetico live in tema scuro"> |
| <img src="docs/preview/energy-flow-mobile-light.webp" alt="Flusso energetico live su telefono, tema chiaro" width="230"> | <img src="docs/preview/energy-flow-mobile.webp" alt="Flusso energetico live su telefono, tema scuro" width="230"> |

Diagramma dinamico dei flussi: **Solare, Rete, Batteria e Casa** più **un cerchio per ogni carico configurato** (fino a otto). Spessore e velocità di ogni connettore seguono la lettura reale del carico: un wallbox a 4 kW disegna una linea più marcata e veloce di un frigo da 80 W. Un carico sotto soglia resta visibile ma spento, uno senza entità mostra `—` invece di uno zero inventato. Toccando un cerchio si apre il popup con i dispositivi che lo compongono — con un'eccezione: il **cerchio della Wallbox apre direttamente l'auto**, con stato di carica, autonomia e sessione di ricarica, perché il cavo è attaccato a una macchina di cui la plancia sa già tutto. La wallbox viene riconosciuta dal carico (dal tipo dichiarato, dalla configurazione, dai sensori che la sezione Auto sta già leggendo e infine dal nome), mai dalla sua posizione nel disegno; senza un'auto configurata il cerchio resta com'era, con il suo storico.

### Giornaliera

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/energy-day-light.webp" alt="Energia giornaliera in tema chiaro"> | <img src="docs/preview/energy-day.webp" alt="Energia giornaliera in tema scuro"> |
| <img src="docs/preview/energy-day-mobile-light.webp" alt="Energia giornaliera su telefono, tema chiaro" width="230"> | <img src="docs/preview/energy-day-mobile.webp" alt="Energia giornaliera su telefono, tema scuro" width="230"> |

### Mensile

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/energy-month-light.webp" alt="Energia mensile in tema chiaro"> | <img src="docs/preview/energy-month.webp" alt="Energia mensile in tema scuro"> |
| <img src="docs/preview/energy-month-mobile-light.webp" alt="Energia mensile su telefono, tema chiaro" width="230"> | <img src="docs/preview/energy-month-mobile.webp" alt="Energia mensile su telefono, tema scuro" width="230"> |

Le stesse bolle del flusso, con i **totali di periodo** ricostruiti dalle statistiche Recorder: produzione, consumo, prelievo, immissione, carica e scarica della batteria, e il contributo di ciascun carico.

### Report

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/energy-report-light.webp" alt="Report energia in tema chiaro"> | <img src="docs/preview/energy-report.webp" alt="Report energia in tema scuro"> |
| <img src="docs/preview/energy-report-mobile-light.webp" alt="Report energia su telefono, tema chiaro" width="230"> | <img src="docs/preview/energy-report-mobile.webp" alt="Report energia su telefono, tema scuro" width="230"> |

Selettore **mese/anno** e, per il periodo scelto: produzione FV, consumo totale, autosufficienza, **quanto hai pagato**, **quanto hai risparmiato grazie al fotovoltaico**, costo reale, energia venduta, **CO₂ evitata**, badge di sintesi, anello di autosufficienza e andamento giornaliero produzione/consumo.

### Analisi

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/energy-analysis-light.webp" alt="Analisi energia in tema chiaro"> | <img src="docs/preview/energy-analysis.webp" alt="Analisi energia in tema scuro"> |

- **Confronto settimanale dei consumi Casa**: settimana corrente contro precedente, sulle statistiche Recorder autenticate e sul bilancio canonico della Casa. I valori dipendono dai tuoi sensori: un riepilogo può riportare **165,1 kWh** senza che quel numero diventi una costante della dashboard.
- **Attività dispositivi** del periodo: classifica di elettrodomestici e carichi con quota FV e quota rete di ciascuno, più il totale monitorato.
- **Dettaglio dispositivo**: kWh del mese, media giornaliera, picco, risparmio e spesa in euro, totale anno e istogramma giornaliero.

### Temperature impianto

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/energy-temperatures-light.webp" alt="Temperature impianto in tema chiaro"> | <img src="docs/preview/energy-temperatures.webp" alt="Temperature impianto in tema scuro"> |
| <img src="docs/preview/energy-temperatures-mobile-light.webp" alt="Temperature impianto su telefono, tema chiaro" width="230"> | <img src="docs/preview/energy-temperatures-mobile.webp" alt="Temperature impianto su telefono, tema scuro" width="230"> |

Temperature di inverter (DC/AC) e batteria, più la ventola di raffreddamento quando è configurata.

## Elettrodomestici

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/appliances-light.webp" alt="Sezione elettrodomestici in tema chiaro"> | <img src="docs/preview/appliances.webp" alt="Sezione elettrodomestici in tema scuro"> |
| <img src="docs/preview/appliances-mobile-light.webp" alt="Sezione elettrodomestici su telefono, tema chiaro" width="230"> | <img src="docs/preview/appliances-mobile.webp" alt="Sezione elettrodomestici su telefono, tema scuro" width="230"> |

Una card per apparecchio con **illustrazione dedicata** (o la tua foto), stato reale (**In funzione / Standby / Spento / Allarme**), anello del **tempo rimanente**, barra di **potenza attuale**, barra **temperatura** per frigo, congelatore e forno, e riepilogo dell'**ultimo ciclo** (avvio, durata, consumo, costo). La colonna di sinistra filtra per **stanza** e per **stato** e somma il consumo istantaneo e giornaliero.

### Vista consumi

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/appliances-consumption-light.webp" alt="Consumi elettrodomestici in tema chiaro"> | <img src="docs/preview/appliances-consumption.webp" alt="Consumi elettrodomestici in tema scuro"> |

### Dettaglio di un apparecchio

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/appliance-detail-light.webp" alt="Dettaglio elettrodomestico in tema chiaro"> | <img src="docs/preview/appliance-detail.webp" alt="Dettaglio elettrodomestico in tema scuro"> |
| <img src="docs/preview/appliance-detail-mobile-light.webp" alt="Dettaglio elettrodomestico su telefono, tema chiaro" width="210"> | <img src="docs/preview/appliance-detail-mobile.webp" alt="Dettaglio elettrodomestico su telefono, tema scuro" width="210"> |

Il dettaglio mostra potenza, contributo percentuale al consumo istantaneo, entità collegate e accesso allo storico.

**Configurazione**: `Editor → Elettrodom.` — catalogo di **20 tipi**, entità di comando/stato/potenza/energia, soglie, immagine e campi dell'ultimo ciclo.

## Auto elettrica e wallbox

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/ev-light.webp" alt="Sezione auto elettrica in tema chiaro"> | <img src="docs/preview/ev.webp" alt="Sezione auto elettrica in tema scuro"> |
| <img src="docs/preview/ev-mobile-light.webp" alt="Sezione auto elettrica su telefono, tema chiaro" width="230"> | <img src="docs/preview/ev-mobile.webp" alt="Sezione auto elettrica su telefono, tema scuro" width="230"> |

Profilo veicolo con **marchio e modello** dal catalogo (38 marchi) o la tua foto, SOC, autonomia, odometro, km dall'ultima ricarica, **sessione di ricarica** con quota solare, tensione e temperatura wallbox, target SOC e **console modalità di ricarica** (Spento / Solar / Min+Sol / Fast) quando l'integrazione le espone. Più veicoli convivono, ognuno con il suo profilo, e **le linguette per passare da un'auto all'altra ci sono anche dentro il popup**: non serve chiudere, tornare in Auto e cambiare veicolo. Sono le stesse linguette che stanno in cima alla pagina, disegnate in un secondo posto, e la fotografia segue la macchina scelta.

DashboardModern non sostituisce l'integrazione del veicolo o della wallbox: ne presenta le entità.

## Luci

Le luci si gestiscono dal popup **Gestione luci**, raggiungibile dalla Home e dalle Azioni rapide: raggruppate per stanza, con accensione singola e di gruppo, e il cursore della luminosità direttamente sulla scheda di chi è dimmerabile.

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/lights-popup-light.webp" alt="Popup gestione luci in tema chiaro"> | <img src="docs/preview/lights-popup.webp" alt="Popup gestione luci in tema scuro"> |
| <img src="docs/preview/lights-popup-mobile-light.webp" alt="Popup gestione luci su telefono, tema chiaro" width="210"> | <img src="docs/preview/lights-popup-mobile.webp" alt="Popup gestione luci su telefono, tema scuro" width="210"> |

### I controlli di una luce

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/light-control-popup-light.webp" alt="Controlli di una luce in tema chiaro"> | <img src="docs/preview/light-control-popup.webp" alt="Controlli di una luce in tema scuro"> |
| <img src="docs/preview/light-control-popup-mobile-light.webp" alt="Controlli di una luce su telefono, tema chiaro" width="210"> | <img src="docs/preview/light-control-popup-mobile.webp" alt="Controlli di una luce su telefono, tema scuro" width="210"> |

Il pannello della singola luce offre **solo i comandi che l'entità dichiara di avere**: luminosità con i valori rapidi 1 / 25 / 50 / 75 / 100 %, colore con dodici colori pronti, cursori di tinta e saturazione, selettore del colore esatto, bianco regolabile in kelvin ed elenco degli effetti. Una luce che non ha una di queste cose non ne vede il comando: non compare un cursore che Home Assistant rifiuterebbe.

Una luce può essere anche uno `switch.`, un `input_boolean.`, un `fan.` o un `group.`: viene comandata con il servizio giusto e non riceve mai luminosità o colore.

Il popup **Avvisi** elenca invece le luci attualmente accese:

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/alerts-popup-light.webp" alt="Popup dettaglio avvisi in tema chiaro"> | <img src="docs/preview/alerts-popup.webp" alt="Popup dettaglio avvisi in tema scuro"> |

**Configurazione**: `Editor → Luci` — entità, nome, stanza, ordine e organizzazione per stanza.

## Clima

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/climate-light.webp" alt="Sezione clima in tema chiaro"> | <img src="docs/preview/climate.webp" alt="Sezione clima in tema scuro"> |
| <img src="docs/preview/climate-mobile-light.webp" alt="Sezione clima su telefono, tema chiaro" width="230"> | <img src="docs/preview/climate-mobile.webp" alt="Sezione clima su telefono, tema scuro" width="230"> |

In testa il riepilogo — **quante unità sono accese**, la **temperatura ambiente media**, e *Accendi tutto / Spegni tutto*. Sotto, le due famiglie **Freddo** e **Caldo** con il loro conteggio: la pagina mostra **solo le famiglie che la casa ha davvero**, quindi con soli condizionatori non compare una sezione Caldo vuota.

Le unità sono raggruppate per piano e ognuna ha il **cursore del target** con la temperatura ambiente segnata sulla scala, lo stato (*Raffresca*, *Spento*…), la modalità e i comandi +/− e accensione.

### Controllo rapido dalla Home

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/climate-popup-light.webp" alt="Popup controllo rapido clima in tema chiaro"> | <img src="docs/preview/climate-popup.webp" alt="Popup controllo rapido clima in tema scuro"> |
| <img src="docs/preview/climate-popup-mobile-light.webp" alt="Popup controllo rapido clima su telefono, tema chiaro" width="210"> | <img src="docs/preview/climate-popup-mobile.webp" alt="Popup controllo rapido clima su telefono, tema scuro" width="210"> |

**Configurazione**: `Editor → Clima` — entità `climate.*`, stanza, tipo (Freddo/Caldo).

## Temperatura e umidità

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/temperature-light.webp" alt="Sezione temperatura in tema chiaro"> | <img src="docs/preview/temperature.webp" alt="Sezione temperatura in tema scuro"> |
| <img src="docs/preview/temperature-mobile-light.webp" alt="Sezione temperatura su telefono, tema chiaro" width="230"> | <img src="docs/preview/temperature-mobile.webp" alt="Sezione temperatura su telefono, tema scuro" width="230"> |

Una card per stanza con nome e icona **ereditati dalle Stanze**, temperatura, umidità e giudizio di comfort. Il comfort **colora tutta la card** (freddo, comfort, caldo), i chip in alto filtrano per **stanza** e per **piano**, e sotto le card l'**andamento** mette a confronto tutte le stanze su **24 ore o 7 giorni**, con la fascia di comfort evidenziata e minimo/massimo di ciascuna.

**Configurazione**: `Editor → Temperatura` — scegli la stanza e associa entità temperatura e umidità.

## Tapparelle

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/shutters-light.webp" alt="Sezione tapparelle in tema chiaro"> | <img src="docs/preview/shutters.webp" alt="Sezione tapparelle in tema scuro"> |
| <img src="docs/preview/shutters-mobile-light.webp" alt="Sezione tapparelle su telefono, tema chiaro" width="230"> | <img src="docs/preview/shutters-mobile.webp" alt="Sezione tapparelle su telefono, tema scuro" width="230"> |

Ogni scheda è una **finestra guardata dalla stanza**, che è da dove si guarda una tapparella davvero. In primo piano c'è l'**infisso**: il telaio, le due ante con il vetro e la maniglia. Dietro il vetro **scende la tapparella**, disegnata a stecche, perché la tapparella sta fuori. Dietro ancora c'è il fuori: il cielo con sole e nuvole di giorno, luna e stelle di notte, il cassonetto e le guide.

- **Il cursore accanto alla finestra si trascina in verticale** come la tapparella vera, e al rilascio la porta esattamente a quella posizione. Chi non accetta una posizione mostra lo stesso indicatore in sola lettura.
- **La finestra si può aprire.** Se assegni alla tapparella un **sensore di apertura dell'infisso** — un contatto sull'anta — quando quel contatto dice aperto **le ante rientrano verso i loro cardini**, si scopre il vano e accanto allo stato compare **«Finestra aperta»**. L'anta aperta prende corpo e **getta ombra** su quello che ha dietro, che sia la tapparella o il cielo, e attorno si vede lo spessore del muro; da chiusa resta trasparente, altrimenti si perderebbe il vetro. Senza sensore, o con un sensore che non risponde, la scheda resta com'era: non viene disegnata un'apertura che nessuno ha misurato.
- **Il cielo segue l'ora del giorno.** Dietro il vetro non c'è un cielo solo: ce ne sono cinque, quelli che si nominano parlando — **alba** (5-8), **mattina** (8-13), **pomeriggio** (13-18), **tramonto** (18-21), **sera** (21-5). Il sole si alza e si abbassa, le nuvole si tingono, di notte arrivano luna e stelle, e al tramonto le colline vanno in controluce. Le immagini qui sopra sono state scattate al **tramonto** — lo script fissa il fuso su `Europe/Rome`, quindi la galleria mostra sempre la fascia dell'ora in cui viene rigenerata.
- La testata riassume quante sono **aperte e chiuse** in questo momento e contiene **Apri tutte / Chiudi tutte**.
- Quando le stanze sono su più piani le tapparelle si raggruppano per piano e stanza, con il titolo del gruppo.

**Configurazione**: `Editor → Tapparelle` — entità `cover.*`, nome, stanza, ordine e **Sensore apertura infisso** (facoltativo).

## Sicurezza e telecamere

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/security-light.webp" alt="Sezione sicurezza in tema chiaro"> | <img src="docs/preview/security.webp" alt="Sezione sicurezza in tema scuro"> |
| <img src="docs/preview/security-mobile-light.webp" alt="Sezione sicurezza su telefono, tema chiaro" width="230"> | <img src="docs/preview/security-mobile.webp" alt="Sezione sicurezza su telefono, tema scuro" width="230"> |

Lo **stato dell'antifurto** in grande, con l'anello che ne segue il colore, e le **modalità disponibili** — Fuori, Notte, Sblocca — ognuna con la sua descrizione. Le modalità offerte sono quelle che la centrale dichiara in `supported_features`. Sotto, la **videosorveglianza**: un riquadro per canale, con badge LIVE e orologio.

> Nelle anteprime i riquadri telecamera mostrano un fermo immagine segnaposto: non esiste alcuno stream reale in questo README.
>
> DashboardModern **non memorizza il codice dell'allarme**: il codice digitato viene passato al servizio Home Assistant, che decide.

## Solare termico

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/solar-thermal-light.webp" alt="Sezione solare termico in tema chiaro"> | <img src="docs/preview/solar-thermal.webp" alt="Sezione solare termico in tema scuro"> |
| <img src="docs/preview/solar-thermal-mobile-light.webp" alt="Sezione solare termico su telefono, tema chiaro" width="230"> | <img src="docs/preview/solar-thermal-mobile.webp" alt="Sezione solare termico su telefono, tema scuro" width="230"> |

L'impianto in vista isometrica: collettore, boiler con le sue sonde, delta di temperatura, pompa solare, centralina, pressione dell'impianto, valvola di sicurezza e resistenza elettrica con il suo consumo.

## Piscina

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/pool-light.webp" alt="Sezione piscina in tema chiaro"> | <img src="docs/preview/pool.webp" alt="Sezione piscina in tema scuro"> |
| <img src="docs/preview/pool-mobile-light.webp" alt="Sezione piscina su telefono, tema chiaro" width="230"> | <img src="docs/preview/pool-mobile.webp" alt="Sezione piscina su telefono, tema scuro" width="230"> |

Una **scena** al posto di un pannello piatto: giardino, bordo in pietra, vasca in prospettiva con l'acqua che scorre, scaletta, gradini e salvagente. La temperatura dell'acqua è un quadrante di vetro sopra la scena; **pompa, riscaldamento e luce** sono tre riquadri della stessa misura sotto la vasca.

- Con la **pompa** in funzione si vedono le bolle nell'acqua.
- Con il **riscaldamento** acceso sale il vapore.
- Con la **luce** accesa la vasca si illumina da sotto.
- **pH e cloro** hanno ognuno la sua barra con la fascia ideale evidenziata e l'indicatore sulla lettura.
- La **filtrazione** mostra in un anello le ore fatte oggi su quelle previste; in modalità automatica le ore sono `temperatura / 2` (minimo 2, massimo 12).

## Irrigazione

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/irrigation-light.webp" alt="Sezione irrigazione in tema chiaro"> | <img src="docs/preview/irrigation.webp" alt="Sezione irrigazione in tema scuro"> |
| <img src="docs/preview/irrigation-mobile-light.webp" alt="Sezione irrigazione su telefono, tema chiaro" width="230"> | <img src="docs/preview/irrigation-mobile.webp" alt="Sezione irrigazione su telefono, tema scuro" width="230"> |

Anche qui una scena: prato rasato a strisce, siepe, alberi, fiori e fili d'erba sul bordo, con **un irrigatore per ogni zona configurata** (le prime otto sul prato, tutte nelle schede sotto).

- Quando una zona parte **l'irrigatore spruzza davvero**: il ventaglio d'acqua oscilla, le gocce ricadono sull'erba aprendo il loro schizzo e il prato sotto si bagna e si scurisce.
- Il **conto alla rovescia** della zona resta sull'etichetta e sulla sua scheda.
- Il **programma** avvia le zone in sequenza, ognuna per la sua durata, e salta quando la probabilità di pioggia supera la soglia; **Forza** ignora la pioggia.
- Se hai attivato *riduci animazioni* nel sistema, la scena resta ferma.

## MiniPC e rete

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/server-light.webp" alt="Sezione MiniPC in tema chiaro"> | <img src="docs/preview/server.webp" alt="Sezione MiniPC in tema scuro"> |
| <img src="docs/preview/server-mobile-light.webp" alt="Sezione MiniPC su telefono, tema chiaro" width="230"> | <img src="docs/preview/server-mobile.webp" alt="Sezione MiniPC su telefono, tema scuro" width="230"> |

La macchina disegnata in 3D con **CPU, RAM e disco** come barre che crescono, il **termometro della CPU** con giudizio e limite, la telemetria (consumo, uptime, Speedtest download e upload), il **carico CPU live** e la riga di rete con connettività e stato dell'inverter.

---
# Editor Dashboard: tutte le configurazioni

L'editor è un'unica finestra con una tab per area. Tutte le configurazioni descritte qui sono **visuali**: nessun YAML.

> Le schermate qui sotto sono in **tema chiaro**; l'editor segue il tema della plancia, quindi in tema scuro le stesse tab appaiono scure — c'è una galleria in fondo al capitolo.

<img src="docs/preview/editor-settings-light.webp" alt="Editor - impostazioni generali" width="100%">

### ⚙️ Impostazioni

| Blocco | Cosa contiene |
| --- | --- |
| **Generali** | nome della plancia e utente amministratore |
| **Auto elettriche** | profili veicolo salvati, con marchio, modello e foto |
| **Ordine navbar** | disponi le sezioni della barra come preferisci |
| **Autorilevamento** | proposta automatica delle entità da collegare → [capitolo dedicato](#autorilevamento-entità) |
| **Diagnosi navbar** | stato di visibilità di ogni sezione, utile per capire perché una tab non appare |
| **Reset totale** | azzera la configurazione della plancia |

La visibilità di ogni sezione si accende e si spegne dal pulsante verde in testa alla tab corrispondente (**Sezione visibile in dashboard — tocca per nascondere**), e una sezione si accende da sola appena riceve dati configurati.

<a id="autorilevamento-entità"></a>

### 🪄 Autorilevamento entità

Dentro **⚙️ Impostazioni** c'è il blocco **Autorilevamento**: un pulsante che legge tutte le entità di Home Assistant e **propone** da solo i collegamenti, le luci, le stanze, le unità clima, le telecamere e i gruppi degli avvisi. È il modo più rapido per passare da una plancia vuota a una plancia già popolata, senza aprire una tab alla volta.

| Tema chiaro | Tema scuro |
| --- | --- |
| <img src="docs/preview/editor-autodetect-light.webp" alt="Autorilevamento entità, tema chiaro"> | <img src="docs/preview/editor-autodetect.webp" alt="Autorilevamento entità, tema scuro"> |

**Come funziona**

1. Premi **🪄 AVVIA AUTORILEVAMENTO**. Una barra di avanzamento mostra le fasi: lettura delle entità, lettura dei registri (piani, aree, dispositivi), analisi.
2. Le entità vengono indicizzate **una volta sola** e messe in liste di ricerca per parola: ogni slot guarda solo le entità che condividono un termine con lui, quindi l'analisi finisce in millisecondi anche con qualche migliaio di entità e **la pagina non si blocca**.
3. Ogni etichetta di slot viene letta come una richiesta precisa: l'**unità di misura** fra parentesi (`kWh`, `W`, `%`, `°C`, `bar`, `Mbit/s`…), la **device class** che quell'unità implica, il **dominio** suggerito da una parola iniziale (`Script…`, `Interruttore…`, `Valvola…`, `Meteo…`) e il **periodo** a cui appartiene (`oggi`, `mese`, `anno`).
4. Tutte le coppie *(slot, entità)* vengono valutate insieme e assegnate **in ordine di confidenza**: vince la corrispondenza più forte, non quella che capita prima nell'elenco.

**Cosa vedi prima di salvare**

Al termine compare il riepilogo **🪄 Ecco cosa ho trovato**, con quante entità sono state analizzate e in quanti millisecondi, seguito da:

| Riga | Significato |
| --- | --- |
| 🔗 **Collegamenti alle entità** | quanti slot verrebbero compilati (i primi 12 sono elencati per esteso, slot ed `entity_id`) |
| 💡 **Luci** | luci individuate e raggruppate per stanza |
| 🌡️ **Stanze** | stanze proposte, una per area di Home Assistant quando i registri sono disponibili |
| ❄️ **Unità clima** | termostati e climatizzatori |
| 📹 **Telecamere** | entità `camera` da mostrare in Sicurezza |
| 🔔 **Entità nei gruppi avvisi** | porte, finestre, allagamenti, fumo e simili, inseriti nei gruppi della Home |

Le categorie **già configurate** non vengono toccate: al posto del numero compare *già configurato*. E se due candidati sono ugualmente plausibili per lo stesso campo, quel campo **non viene indovinato**: il riepilogo dice quanti campi restano da compilare a mano, nelle rispettive tab.

> **Niente è stato ancora salvato.** Il riepilogo è una proposta: la configurazione cambia solo quando premi **✅ APPLICA E RICARICA**. Con **ANNULLA** il riepilogo sparisce e nulla viene scritto.

**Cosa succede all'applicazione**

- I valori vengono scritti **senza mai sovrascrivere** quello che hai già impostato: l'autorilevamento riempie i vuoti, non rimpiazza le tue scelte.
- Gli slot di **Energia** non passano dagli override generici ma finiscono nel modello Energia canonico (schema 4), che è ciò che li rende persistenti fra un salvataggio e l'altro.
- Subito dopo la scrittura, i registri di Home Assistant vengono riapplicati (aree, piani, dispositivi) e la plancia si ricarica con la nuova configurazione.

**Dopo l'autorilevamento** conviene comunque fare un giro nelle tab: l'autorilevamento porta la plancia al 70–90 % in pochi secondi, ma i **contatori totali di Energia**, le **soglie** degli elettrodomestici e le **tariffe** restano scelte tue.

### 🚪 Stanze

<img src="docs/preview/editor-rooms-light.webp" alt="Editor - stanze" width="100%">

Le stanze sono il **registro condiviso**: nome, **icona dal catalogo visuale**, piano e ordine. Rinominare una stanza o spostarla di piano aggiorna insieme Temperatura, Clima, Luci, Tapparelle ed Elettrodomestici, perché tutte le sezioni referenziano l'`id` della stanza, non il suo nome.

### ⚡ Energia

Quattro pannelli interni: **Flussi ed entità**, **Carichi**, **Report**, **Impostazioni**. Ogni pannello vive solo sotto la sua scheda.

<img src="docs/preview/editor-energy-light.webp" alt="Editor - energia, flussi ed entità" width="100%">

**Flussi ed entità** — per ognuna delle sorgenti (**Casa**, **Rete prelevata**, **Rete immessa**, **Fotovoltaico**, **Batteria carica**, **Batteria scarica**):

| Campo | Ruolo |
| --- | --- |
| **Potenza istantanea** (W) | valore live per il flusso |
| **Energia giornaliera** (kWh) | override facoltativo del giorno corrente |
| **Energia mensile** (kWh) | override facoltativo del mese corrente |
| **Energia annuale** (kWh) | override facoltativo dell'anno corrente |
| **Contatore energia totale** (kWh) | il sensore **cumulativo** (`state_class: total` o `total_increasing`): è la sorgente di report, mesi precedenti e grafici |
| **Stato di carica** (%) | solo batteria |

Ogni gruppo mostra un contatore `x/y configurati` e la sua intestazione dice se ha *Storico + periodo* o solo *Fallback*.

<table>
<tr>
<td width="33%"><img src="docs/preview/editor-energy-loads-light.webp" alt="Editor - carichi"></td>
<td width="33%"><img src="docs/preview/editor-energy-report-light.webp" alt="Editor - report"></td>
<td width="33%"><img src="docs/preview/editor-energy-settings-light.webp" alt="Editor - tariffe energia"></td>
</tr>
</table>

**Carichi** — una card per ogni cerchio sotto Casa, nell'ordine in cui viene disegnato: nome, **icona** (dal catalogo di aree della casa e apparecchi), **colore**, potenza istantanea, contatore energia totale, sensori di periodo facoltativi, riordino, eliminazione e i **dispositivi contenuti**, che finiscono nel popup del cerchio. Un carico con dispositivi assegnati vale la **somma** dei suoi dispositivi; un carico con un sensore proprio — per esempio una pinza amperometrica sull'intera linea — usa quello, che è più preciso. Ogni card dice cosa manca: nessuna entità, potenza assente, nessun contatore energia.

**Report** — quali voci compaiono nel Report e nell'Analisi: etichetta, icona, **entità totale per lo storico** e visibilità. Le icone seguono **un disegno solo** per tutte le voci: il tipo lo decide la stessa funzione che lo decide sulle schede, guardando tutti i campi della voce e non solo il primo, e quando non riconosce niente risponde «generico» invece di lasciare la faccina. La **wallbox** ha la sua colonnina disegnata, con la stessa cornice e la stessa griglia degli altri apparecchi.

**Impostazioni** — **costo €/kWh** e **prezzo di immissione**, usati per pagato/risparmiato/venduto, più le viste Energia da mostrare.

### 🌡️ Temperatura

<img src="docs/preview/editor-temperature-light.webp" alt="Editor - temperatura" width="100%">

Per ogni riga: **stanza** (obbligatoria, scelta fra quelle esistenti), **entità temperatura** e **entità umidità** (facoltativa). Nome e icona arrivano dalle Stanze. Puoi spostare i sensori da una stanza all'altra, purché la destinazione non abbia già un'associazione.

### 🧺 Elettrodomestici

<img src="docs/preview/editor-appliances-light.webp" alt="Editor - elettrodomestici" width="100%">

Catalogo con **20 tipi** (lavatrice, lavastoviglie, asciugatrice, forno, microonde, frigorifero, congelatore, piano cottura, cappa, ferro da stiro, aspirapolvere, robot, condizionatore, ventilatore, scaldabagno, TV, caffettiera, tostapane, bollitore, altro) e, per ogni apparecchio:

| Campo | Ruolo |
| --- | --- |
| **Nome**, **Tipo / immagine**, **Stanza** | identità e collocazione |
| **Entità comando** | `switch`, `light`, `fan` o `input_boolean` usato dal pulsante Accendi/Spegni |
| **Potenza istantanea** | sensore W o kW mostrato nella card |
| **Soglia in funzione** (W) | potenza oltre la quale la card risulta accesa |
| **Soglia standby** (W) | sotto la soglia *In funzione* e sopra questa = Standby |
| **Entità stato programma** | sensore con lo stato (`running`, `idle`…): ha **priorità** sulle soglie in watt |
| **Tempo rimanente** | minuti, `hh:mm` o timestamp di fine: alimenta l'anello del conto alla rovescia |
| **Durata programma** / **Durata ciclo fissa** | percentuale dell'anello, da entità o da minuti fissi |
| **Entità temperatura** + **min/max barra** | per frigo, congelatore e forno mostra la barra temperatura al posto della potenza |
| **Entità allarme/anomalia** | `binary_sensor` di problema: accende il contatore Allarme |
| **Energia giornaliera / mensile** | override facoltativi del periodo corrente |
| **Energia totale per storico e Report** | contatore cumulativo kWh: **è questo** che ricostruisce anche i mesi precedenti |
| **Ultimo ciclo**: avvio, durata, consumo, costo | riepilogo in fondo alla card |
| **Carico energia** | il cerchio del flusso in cui rientra; il popup del cerchio lo elenca da solo |
| **Potenza massima** (W) | scala della barra Potenza attuale |
| **Costo energia (€/kWh)** | vuoto = tariffa della sezione Energia |
| **Immagine personalizzata (URL)** | la foto reale al posto dell'illustrazione |

### 💡 Luci · ❄️ Clima · 🪟 Tapparelle

<table>
<tr>
<td width="33%"><img src="docs/preview/editor-lights-light.webp" alt="Editor - luci"></td>
<td width="33%"><img src="docs/preview/editor-climate-light.webp" alt="Editor - clima"></td>
<td width="33%"><img src="docs/preview/editor-shutters-light.webp" alt="Editor - tapparelle"></td>
</tr>
</table>

- **Luci**: entità (`light.`, `switch.`, `input_boolean.`, `fan.`, `group.`), nome visualizzato, stanza, ordine e organizzazione per stanza.
- **Clima**: entità `climate.*`, stanza e assegnazione a **Freddo** o **Caldo**.
- **Tapparelle**: entità `cover.*`, nome, stanza e **Sensore apertura infisso** (facoltativo: il contatto sull'anta che fa aprire le ante nella scheda); apertura, chiusura, stop e posizione seguono ciò che l'entità dichiara di supportare.

### ⚡ Azioni rapide · 🔔 Avvisi

<table>
<tr>
<td width="50%"><img src="docs/preview/editor-quick-actions-light.webp" alt="Editor - azioni rapide"></td>
<td width="50%"><img src="docs/preview/editor-alerts-light.webp" alt="Editor - avvisi"></td>
</tr>
</table>

- **Azioni rapide**: nome, **icona dal catalogo** e, come azione, un popup integrato (luci, clima, antifurto, lavatrice…), un gruppo di luci scelto da te, un toggle su entità, uno script o una scena, con messaggio di conferma facoltativo.
- **Avvisi**: avvisi personalizzati del Quadro Avvisi, con nome, icona ed entità da sorvegliare, oltre ai gruppi di monitoraggio integrati.

### 🚗 EV · 🏊 Piscina · 💧 Irrigazione

<table>
<tr>
<td width="33%"><img src="docs/preview/editor-ev-light.webp" alt="Editor - auto elettrica"></td>
<td width="33%"><img src="docs/preview/editor-pool-light.webp" alt="Editor - piscina"></td>
<td width="33%"><img src="docs/preview/editor-irrigation-light.webp" alt="Editor - irrigazione"></td>
</tr>
</table>

- **EV**: **aspetto** (marchio e modello dal catalogo, con anteprima del logo, o la foto della tua auto) e i 16 slot di veicolo e wallbox.
- **Piscina**: temperatura, pH, cloro, pompa, riscaldamento e luce, più le soglie di qualità e la filtrazione automatica.
- **Irrigazione**: zone (nome, entità, minuti, stanza), sensore pioggia, entità meteo, soglia di pioggia e orario del programma.

### 🩺 Runtime

L'ultima tab è di diagnostica: versione della plancia, stato del bridge di autenticazione, ultimo salvataggio sincronizzato, istanza (utile con più plance) e stato di visibilità delle sezioni. È la prima cosa da guardare quando qualcosa non compare.

### Le 18 tab dell'editor

`Impostazioni` · `Home` · `Energia` · `EV` · `Solare` · `Sicurezza` · `MiniPC` · `Temperatura` · `Azioni` · `Clima` · `Piscina` · `Irrigazione` · `Tapparelle` · `Stanze` · `Luci` · `Elettrodom.` · `Avvisi` · `Runtime`

Ogni etichetta di slot è **rinominabile** (basta scriverci sopra), così la plancia parla la lingua del tuo impianto.

### L'editor in tema scuro

<details>
<summary><strong>Apri la galleria dell'editor in tema scuro</strong></summary>

<table>
<tr><td width="33%"><img src="docs/preview/editor-settings.webp" alt="Editor Impostazioni in tema scuro"><br><sub>Impostazioni</sub></td><td width="33%"><img src="docs/preview/editor-rooms.webp" alt="Editor Stanze in tema scuro"><br><sub>Stanze</sub></td><td width="33%"><img src="docs/preview/editor-energy.webp" alt="Editor Energia · flussi in tema scuro"><br><sub>Energia · flussi</sub></td></tr>
<tr><td width="33%"><img src="docs/preview/editor-energy-loads.webp" alt="Editor Energia · carichi in tema scuro"><br><sub>Energia · carichi</sub></td><td width="33%"><img src="docs/preview/editor-energy-report.webp" alt="Editor Energia · report in tema scuro"><br><sub>Energia · report</sub></td><td width="33%"><img src="docs/preview/editor-energy-settings.webp" alt="Editor Energia · tariffe in tema scuro"><br><sub>Energia · tariffe</sub></td></tr>
<tr><td width="33%"><img src="docs/preview/editor-appliances.webp" alt="Editor Elettrodomestici in tema scuro"><br><sub>Elettrodomestici</sub></td><td width="33%"><img src="docs/preview/editor-temperature.webp" alt="Editor Temperatura in tema scuro"><br><sub>Temperatura</sub></td><td width="33%"><img src="docs/preview/editor-lights.webp" alt="Editor Luci in tema scuro"><br><sub>Luci</sub></td></tr>
<tr><td width="33%"><img src="docs/preview/editor-climate.webp" alt="Editor Clima in tema scuro"><br><sub>Clima</sub></td><td width="33%"><img src="docs/preview/editor-shutters.webp" alt="Editor Tapparelle in tema scuro"><br><sub>Tapparelle</sub></td><td width="33%"><img src="docs/preview/editor-ev.webp" alt="Editor Auto elettrica in tema scuro"><br><sub>Auto elettrica</sub></td></tr>
<tr><td width="33%"><img src="docs/preview/editor-pool.webp" alt="Editor Piscina in tema scuro"><br><sub>Piscina</sub></td><td width="33%"><img src="docs/preview/editor-irrigation.webp" alt="Editor Irrigazione in tema scuro"><br><sub>Irrigazione</sub></td><td width="33%"><img src="docs/preview/editor-quick-actions.webp" alt="Editor Azioni rapide in tema scuro"><br><sub>Azioni rapide</sub></td></tr>
<tr><td width="33%"><img src="docs/preview/editor-alerts.webp" alt="Editor Avvisi in tema scuro"><br><sub>Avvisi</sub></td></tr>
</table>

</details>

---

# Catalogo completo degli slot entità

Oltre alle sezioni con editor dedicato, la plancia espone **slot nominali** che puoi mappare su qualunque entità Home Assistant, con etichetta rinominabile. Sono le voci delle tab **Home, Energia, EV, Solare, Sicurezza, MiniPC** dell'editor.

<details>
<summary><strong>Apri il catalogo completo degli slot</strong></summary>

#### 🏠 Home (`home`)

| Slot | Etichetta |
| --- | --- |
| `dm.home_meteo` | Meteo (entità weather) |
| `dm.security_centrale_allarme` | Allarme (alarm_control_panel) |
| `dm.home_interruttore_antifurto` | Interruttore antifurto (switch) |
| `dm.home_script_apertura_cancello` | Script apertura cancello |


#### ⚡ Energia (`energy`)

| Slot | Etichetta |
| --- | --- |
| `dm.energy_produzione_solare_oggi` | Produzione solare oggi (kWh) |
| `dm.energy_consumo_casa_oggi` | Consumo casa oggi (kWh) |
| `dm.energy_energia_prelevata_oggi` | Energia prelevata oggi (kWh) |
| `dm.energy_energia_immessa_oggi` | Energia immessa oggi (kWh) |
| `dm.energy_batteria_caricata_oggi` | Batteria caricata oggi (kWh) |
| `dm.energy_batteria_scaricata_oggi` | Batteria scaricata oggi (kWh) |
| `dm.energy_stato_carica_batteria` | Stato carica batteria (%) |
| `dm.energy_potenza_batteria` | Potenza batteria (W) |
| `dm.energy_potenza_consumo_casa` | Potenza consumo casa (W) |
| `dm.energy_potenza_scambio_rete` | Potenza scambio rete (W) |
| `dm.energy_potenza_fotovoltaico` | Potenza fotovoltaico (W) |
| `dm.energy_stato_rete` | Stato rete (on/off-grid) |
| `dm.energy_temperatura_dc_inverter` | Temperatura DC inverter (°C) |
| `dm.energy_temperatura_ac_inverter` | Temperatura AC inverter (°C) |
| `dm.energy_temperatura_batteria` | Temperatura batteria (°C) |
| `dm.energy_produzione_solare_anno` | Produzione solare anno (kWh) |
| `dm.energy_consumo_casa_anno` | Consumo casa anno (kWh) |
| `dm.energy_produzione_solare_mese` | Produzione solare mese (kWh) |
| `dm.energy_consumo_casa_mese` | Consumo casa mese (kWh) |
| `dm.energy_rete_acquistata_mese` | Rete acquistata mese (kWh) |
| `dm.energy_rete_venduta_mese` | Rete venduta mese (kWh) |
| `dm.energy_batteria_caricata_mese` | Batteria caricata mese (kWh) |
| `dm.energy_batteria_usata_mese` | Batteria usata mese (kWh) |
| `dm.energy_potenza_carichi_nodo_2_cucina` | Potenza carichi — nodo 2/Cucina (W) |
| `dm.energy_somma_cucina_oggi` | Somma cucina oggi (kWh) |
| `dm.energy_somma_cucina_mese` | Somma cucina mese (kWh) |
| `dm.energy_potenza_carichi_nodo_1_lavanderia` | Potenza carichi — nodo 1/Lavanderia (W) |
| `dm.energy_somma_lavanderia_oggi` | Somma lavanderia oggi (kWh) |
| `dm.energy_somma_lavanderia_mese` | Somma lavanderia mese (kWh) |
| `dm.energy_condizionatori_oggi` | Condizionatori oggi (kWh) |
| `dm.energy_condizionatori_mese` | Condizionatori mese (kWh) |
| `dm.energy_potenza_condizionatori` | Potenza condizionatori (W) |
| `dm.energy_boiler_oggi` | Boiler oggi (kWh) |
| `dm.energy_boiler_mese` | Boiler mese (kWh) |
| `dm.energy_potenza_ventola_inverter` | Potenza ventola inverter (W) |
| `dm.energy_interruttore_ventola_inverter` | Interruttore ventola inverter |


#### 🚗 Auto elettrica (`ev`)

| Slot | Etichetta |
| --- | --- |
| `dm.ev_batteria_auto` | Batteria auto (%) |
| `dm.ev_autonomia` | Autonomia (km) |
| `dm.ev_odometro` | Odometro (km) |
| `dm.ev_autonomia_al_limite_di_carica` | Autonomia al limite di carica (km) |
| `dm.ev_km_dall_ultima_ricarica` | Km dall'ultima ricarica |
| `dm.ev_stato_ricarica` | Stato ricarica (testo) |
| `dm.ev_modalita_ricarica_evcc` | Modalità ricarica EVCC (select) |
| `dm.ev_target_soc` | Target SOC (select) |
| `dm.ev_energia_sessione` | Energia sessione (kWh) |
| `dm.ev_percentuale_solare_sessione` | Percentuale solare sessione (%) |
| `dm.ev_potenza_wallbox` | Potenza wallbox (W) |
| `dm.ev_temperatura_wallbox` | Temperatura wallbox (°C) |
| `dm.ev_tensione_wallbox` | Tensione wallbox (V) |
| `dm.ev_prelievo_ac_totale_auto` | Prelievo AC totale auto (kWh) |
| `dm.ev_energia_wallbox_oggi` | Energia wallbox oggi (kWh) |
| `dm.ev_energia_wallbox_mese` | Energia wallbox mese (kWh) |


#### 🌞 Solare termico (`boiler`)

| Slot | Etichetta |
| --- | --- |
| `dm.boiler_potenza_resistenza_boiler` | Potenza resistenza boiler (W) |
| `dm.boiler_interruttore_boiler` | Interruttore boiler |
| `dm.boiler_interruttore_solare_termico` | Interruttore solare termico |
| `dm.boiler_centralina_solare_termico` | Centralina solare termico |
| `dm.boiler_pompa_solare` | Pompa solare (manuale) |
| `dm.boiler_stato_pompa_solare` | Stato pompa solare |
| `dm.boiler_sensore_pompa_solare` | Sensore pompa solare |
| `dm.boiler_delta_temperatura` | Delta temperatura (°C) |
| `dm.boiler_pressione_acqua` | Pressione acqua (bar) |
| `dm.boiler_valvola_di_sicurezza` | Valvola di sicurezza (cover) |
| `dm.boiler_sonda_temperatura_1` | Sonda temperatura 1 (°C) |
| `dm.boiler_sonda_temperatura_2` | Sonda temperatura 2 (°C) |
| `dm.boiler_sonda_temperatura_3` | Sonda temperatura 3 (°C) |


#### 🛡️ Sicurezza (`security`)

| Slot | Etichetta |
| --- | --- |
| `dm.security_centrale_allarme` | Centrale allarme |


#### 🧺 Lavatrice (slot storici) (`lavatrice`)

| Slot | Etichetta |
| --- | --- |
| `dm.lavatrice_presa_avvio_lavatrice` | Presa/avvio lavatrice (switch) |
| `dm.lavatrice_potenza_presa_lavatrice_per_lavatrici_no` | Potenza presa lavatrice (W) — per lavatrici non smart: >5W = in funzione |
| `dm.lavatrice_avvio_ciclo` | Avvio ciclo (switch dispositivo) |
| `dm.lavatrice_fase_corrente` | Fase corrente (testo) |
| `dm.lavatrice_tempo_rimanente` | Tempo rimanente |
| `dm.lavatrice_programma` | Programma (select) |
| `dm.lavatrice_temperatura` | Temperatura (select) |
| `dm.lavatrice_centrifuga` | Centrifuga (select) |
| `dm.lavatrice_script_programma_rapido_14` | Script programma rapido 14' |
| `dm.lavatrice_script_programma_30` | Script programma 30' |
| `dm.lavatrice_script_programma_59` | Script programma 59' |
| `dm.lavatrice_script_programma_misto_colorati` | Script programma misto/colorati |


#### 🖥️ MiniPC (`server`)

| Slot | Etichetta |
| --- | --- |
| `dm.server_cpu` | CPU (%) |
| `dm.server_ram` | RAM (%) |
| `dm.server_disco` | Disco (%) |
| `dm.server_uptime_minipc` | Uptime MiniPC |
| `dm.server_temperatura_cpu` | Temperatura CPU (°C) |
| `dm.server_uptime_home_assistant` | Uptime Home Assistant |
| `dm.server_potenza_raspberry_server` | Potenza Raspberry/server (W) |
| `dm.server_stato_internet` | Stato Internet (binary) |
| `dm.server_ping_internet` | Ping Internet (binary) |
| `dm.server_raggiungibilita_google` | Raggiungibilità Google (binary) |
| `dm.server_internet_lavanderia` | Internet lavanderia (binary) |
| `dm.server_speedtest_download` | Speedtest Download (Mbit/s) |
| `dm.server_speedtest_upload` | Speedtest Upload (Mbit/s) |
| `dm.server_speedtest_ping` | Speedtest Ping (ms) |

</details>

Uno slot non mappato mostra `—`: la plancia non indovina un'entità dal nome, così un valore non può essere inventato.

---
# Come vengono calcolati i numeri

### Consumo Casa

Quando i flussi necessari sono completi, DashboardModern usa lo **stesso bilancio della distribuzione Energia di Home Assistant**:

```text
Casa = Fotovoltaico + Rete prelevata + Batteria scaricata
       − Rete immessa − Batteria caricata
```

Se il confine dei flussi non è completo, il sensore Casa configurato viene usato come **fallback**.

### Periodi e storico

| Cosa | Da dove viene |
| --- | --- |
| Valore live | stato corrente dell'entità di potenza |
| Giorno / mese / anno correnti | i sensori di periodo configurati, se ci sono; altrimenti il delta del contatore totale |
| Mesi e anni precedenti | **solo** dalle statistiche Recorder del contatore cumulativo |
| Grafici | un bucket per intervallo, come differenza fra due `sum` Recorder adiacenti |

La formula è `sum(fine periodo) − sum(inizio periodo)` su `recorder/statistics_during_period`, quindi i **reset del contatore fisico** e le normalizzazioni di unità già applicate da Recorder vengono rispettati. Un contatore lifetime **non viene sommato** al consumo del giorno.

**In pratica**: per navigare lo storico serve un **contatore totale kWh** con `device_class: energy` e `state_class: total` o `total_increasing`. Un sensore "mensile" non lo sostituisce.

Dettagli e test di parità: [`docs/ENERGY_RECORDER_PARITY.md`](docs/ENERGY_RECORDER_PARITY.md).

### Somma di un carico

Un carico del flusso vale la **somma dei dispositivi assegnati**, con gli stessi delta Recorder usati altrove: aggiungere un elettrodomestico a un carico fa crescere il cerchio senza altro da configurare. Se il carico ha un sensore proprio, quello vince, perché misura anche ciò che nessuna presa vede.

### Costi, risparmio e CO₂

Costo €/kWh e prezzo di immissione si impostano in `Editor → Energia → Impostazioni`; un elettrodomestico può avere una **tariffa propria**. Da lì derivano pagato, costo reale, risparmio grazie al fotovoltaico, venduto e la stima di CO₂ evitata.

### Stato "In funzione"

Un apparecchio è in funzione quando l'**entità di stato programma** lo dice; in assenza di quella, quando la potenza supera la **soglia in funzione**. Fra soglia standby e soglia in funzione l'apparecchio è in **Standby**: una presa alimentata non viene confusa con un ciclo in corso.

### Letture assenti

Un'entità mancante, `unavailable`, `unknown` o non mappata non diventa zero: mostra `—`. È una scelta di progetto, così un grafico non racconta un consumo che non c'è.

---

# Potenzialità

Cosa puoi costruire con DashboardModern, oltre alla configurazione base.

### Una plancia che si adatta alla casa, non il contrario

- **13 sezioni** nella barra di navigazione più i popup (luci, avvisi, clima rapido, dettagli): ognuna si attiva singolarmente, quindi mostri solo quello che hai.
- **Ordine della navbar personalizzabile** e sezioni nascondibili: chi ha la piscina la mette per prima, chi non ha l'auto elettrica non la vede mai.
- **Stanze come registro unico**: le crei una volta e tutte le sezioni le riusano.
- **Etichette degli slot rinominabili** e **catalogo icone visuale** per stanze, azioni e carichi.
- Cambi una presa smart? Rimappi lo slot o l'entità della sezione e la plancia si aggiorna in un punto solo.

### Una configurazione, tutta la casa

- **Archivio condiviso dell'integrazione**: configuri da un dispositivo e la ritrovi identica su tutti gli altri e per tutti gli utenti Home Assistant.
- **Protetta dagli svuotamenti accidentali**, con le ultime cinque revisioni conservate e ripristino automatico.
- **Più plance indipendenti**: puoi tenere una plancia "famiglia" e una "tecnica" con configurazioni separate, ognuna con il suo filtro utenti.
- **Dashboard companion Lovelace** opzionale, e la card `dashboardmodern-card` per usare la plancia dentro Lovelace.

### Energia come strumento di analisi

- Flusso live **dinamico**, costruito sui tuoi carichi: fino a **8 cerchi** con nome, icona, colore ed entità, con spessore e velocità proporzionali alla lettura.
- Un carico può essere una **somma di dispositivi**: assegni gli elettrodomestici e il cerchio cresce da solo.
- **Report mensile e annuale** con costi, risparmio, energia venduta e CO₂ evitata.
- **Confronto settimanale** e **classifica dei dispositivi** con quota fotovoltaico e quota rete.
- **Storico reale** dai contatori cumulativi, con la stessa formula della sezione Energia di Home Assistant.

### Dispositivi trattati per quello che sono

- Elettrodomestici come apparecchi e non come prese: **20 tipi**, ciclo in corso, ultimo ciclo, riconoscimento In funzione / Standby / Spento.
- Luci comandate per **capacità dichiarate**: dimmer, RGB, bianco in kelvin, effetti — e niente cursori che Home Assistant rifiuterebbe.
- Tapparelle con **posizione trascinabile** e stato che non torna indietro mentre il motore si muove.
- Clima diviso in Freddo e Caldo, mostrato **solo per le famiglie presenti**.

### Scene, non pannelli

- **Piscina** e **Irrigazione** sono scene disegnate che reagiscono allo stato reale: bolle quando filtra, vapore quando scalda, luce da sotto la vasca, irrigatori che spruzzano con il conto alla rovescia della zona.
- **Tapparelle** come finestre vere, **flusso energetico** animato sui watt veri, **temperature** con la card colorata dal comfort e l'andamento di tutte le stanze.
- Tutto rispetta *riduci animazioni* del sistema.

### Comodità quotidiane

- **Azioni rapide** in Home: popup integrati, gruppi di luci, toggle, script e scene.
- **Quadro Avvisi** che appare solo quando c'è qualcosa, più i tuoi **avvisi personalizzati**.
- **Popup di dettaglio** con storico per singola entità.
- **Tema chiaro e scuro**, **modalità kiosk** su iPhone e iPad, interfaccia in **italiano e inglese**.

### Robustezza

- Aggiornamenti HACS con **cache versionata sul contenuto**: nessun hard refresh.
- **Rientro nell'app**: la connessione viene ripresa al ritorno dal background e al ritorno della rete.
- **Nessun token a lunga scadenza** e **nessun codice allarme memorizzato**.
- Test automatici su Python, frontend e **Playwright** su desktop, mobile e iPad/WebKit.

---

## Architettura in breve

```text
Home Assistant
   │
   ├─ Config entry lifecycle (una per plancia)
   ├─ Archivio condiviso .storage/dashboardmodern.config
   ├─ Comandi WebSocket dashboardmodern/config/{get,set,restore}
   ├─ API / WebSocket / servizi nativi
   └─ Registrazione pannello + asset versionati sul contenuto
            │
            ▼
     Dashboard Frontend
            │
            ├─ store e modelli canonici (schema versionato + migrazioni)
            ├─ renderer delle sezioni
            ├─ editor visuale
            └─ comandi tramite API/servizi Home Assistant
```

Principi del progetto:

- lo stato Home Assistant è la sorgente dei dati live;
- la configurazione della plancia è separata dagli stati delle entità;
- aggiornamenti event-driven quando possibile;
- un solo proprietario canonico per ogni renderer critico;
- compatibilità con la configurazione persistente delle release precedenti;
- test alle frontiere backend / frontend / browser.

Descrizione completa: [`ARCHITECTURE.md`](ARCHITECTURE.md).

### Struttura della repository

```text
dashboardmodern-v2/
├── .github/                          # workflow CI, validazioni e release
├── brand/                            # logo e icone del progetto
├── custom_components/dashboardmodern/
│   ├── config_flow.py                # configurazione e opzioni Home Assistant
│   ├── config_store.py               # archivio condiviso della configurazione
│   ├── websocket_api.py              # comandi WebSocket get/set/restore
│   ├── frontend.py                   # pannello, asset versionati, card companion
│   └── frontend/
│       ├── panel.js                  # pannello Home Assistant
│       ├── dashboard-card.js         # card companion per Lovelace
│       ├── legacy/                   # documenti plancia vendorizzati + bridge
│       ├── src/core/                 # modelli, store, proiezioni, calcoli
│       ├── src/sections/             # runtime delle sezioni UI
│       ├── tests/                    # test frontend
│       └── e2e/                      # test browser Playwright
├── docs/                             # documentazione tecnica
│   └── preview/                      # anteprime usate da questo README
├── scripts/                          # release, build-info, vendoring, anteprime
└── tests/                            # test Python dell'integrazione
```

---

## Sviluppo, test e anteprime

### Frontend

```bash
npm ci
npm run check:inline-syntax
npm run test:frontend
npm run format:check
```

### Test browser

```bash
npx playwright install --with-deps
npm run test:e2e
```

I progetti Playwright coprono **desktop 1440×900**, **mobile 390×844** e **iPad Pro 11 (WebKit)**.

### Test Python

La CI esegue la suite Python con Ruff, insieme a **hassfest** e alla **validazione HACS**, e verifica l'integrità del pacchetto di release generando `dashboardmodern.zip` dal commit pubblicato.

### Rigenerare le anteprime del README

Le immagini in `docs/preview/` sono generate dalla casa demo di `scripts/preview-fixture.mjs` con un Home Assistant simulato (stati, storico, statistiche Recorder, archivio condiviso e fallback REST):

```bash
npm ci
npm i --no-save chart.js@4.5.1 simple-icons@16.27.1   # facoltativo: grafici e loghi reali

# galleria tema scuro/auto  → docs/preview/<sezione>.webp
node scripts/capture-previews.mjs

# galleria tema chiaro      → docs/preview/<sezione>-light.webp
node scripts/capture-previews.mjs --theme light --keep

# solo alcune sezioni, o la versione inglese
node scripts/capture-previews.mjs --only home,energy-flow
node scripts/capture-previews.mjs --variant dashboard-en.html --out docs/preview-en
```

Opzioni utili: `--format png`, `--quality 0.95`, `--all-mobile`, `--debug`, `--headed`, `--port`, `--fresh`.

> La passata completa senza `--theme` svuota `docs/preview/` prima di ricominciare; una passata parziale (`--theme`, `--only`) non lo fa mai, per non portarsi via la galleria dell'altro tema. Per svuotare davvero anche in quel caso serve `--fresh`.

Lo script avvia un server statico sulla cartella `frontend`, apre il documento della plancia in Chromium contro il finto Home Assistant, attraversa ogni sezione, adatta il viewport al contenuto e salva l'immagine. Le sezioni la cui resa dipende dal movimento — flusso energia, piscina, irrigazione — vengono catturate con le animazioni attive; tutte le altre a scena ferma. Chart.js e i loghi dei marchi auto arrivano dalle copie locali quando presenti, così la generazione funziona anche senza rete.

### Pubblicare una nuova versione

Il workflow `Release` pubblica da solo quando `main` riceve una modifica a `manifest.json` o un tag `v*`, e marca come pre-release solo i tag che contengono un trattino. I passi completi sono in [`docs/RELEASE_1_0.md`](docs/RELEASE_1_0.md).

---

## Risoluzione problemi

Prima di aprire una Issue verifica:

1. la versione realmente installata in HACS;
2. che non sia presente **In attesa di riavvio**;
3. di aver riavviato Home Assistant dopo l'aggiornamento;
4. di aver chiuso e riaperto l'app Companion o ricaricato del tutto il browser;
5. che le entità configurate esistano ancora, e che gli slot puntino ai nuovi `entity_id` se li hai rinominati;
6. per Energia, che i sensori abbiano **statistiche Recorder** utilizzabili;
7. il **Registro** di Home Assistant;
8. la tab **Runtime** dell'editor, che riassume versione, bridge, sincronizzazione e stato delle sezioni.

| Sintomo | Prima cosa da guardare |
| --- | --- |
| Una sezione non compare nella navbar | la sezione è visibile? (`Editor → Impostazioni → Diagnosi navbar`) |
| Una card mostra `—` | lo slot corrispondente non è mappato, oppure l'entità è `unavailable`/`unknown` |
| Report e mesi precedenti vuoti | manca il **contatore energia totale** cumulativo, o Recorder non ha statistiche per quel sensore |
| Consumo Casa incoerente | il confine dei flussi non è completo: manca uno fra fotovoltaico, rete prelevata/immessa, batteria carica/scarica |
| Un apparecchio risulta sempre acceso | soglia **In funzione** troppo bassa, oppure manca l'entità di stato programma |
| La plancia sembra vuota su un dispositivo | la configurazione è nell'archivio condiviso: ricarica la pagina e controlla la tab **Runtime** |
| Su iPhone la plancia copre Home Assistant | è la modalità kiosk: tieni premuto l'hamburger per spegnerla, o apri con `?kiosk=0` |
| Una luce non mostra colore o luminosità | l'entità non li dichiara: la plancia offre solo i comandi che Home Assistant accetta |

Quando apri una Issue indica: versione DashboardModern, versione Home Assistant, dispositivo e browser/app, lingua della plancia, se il problema è su mobile/tablet/desktop, i passaggi per riprodurlo e uno screenshot se utile.

👉 **Issues:** https://github.com/danigio15/dashboardmodern-v2/issues

---

## Documentazione del progetto

- [`CHANGELOG.md`](CHANGELOG.md) — cosa c'è nella 1.0
- [`docs/CHANGELOG_PRE_1.0.md`](docs/CHANGELOG_PRE_1.0.md) — archivio delle versioni precedenti
- [`docs/RELEASE_1_0.md`](docs/RELEASE_1_0.md) — come si pubblica una release
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — architettura e responsabilità dei layer
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — come contribuire
- [`DECISIONS.md`](DECISIONS.md) — decisioni architetturali
- [`docs/ENERGY_RECORDER_PARITY.md`](docs/ENERGY_RECORDER_PARITY.md) — storico Energia e Recorder
- [`docs/SECTION_ROADMAP.md`](docs/SECTION_ROADMAP.md) — stato per sezione
- [`docs/PRODUCT_VISION.md`](docs/PRODUCT_VISION.md) — visione prodotto
- [`docs/STRATEGY.md`](docs/STRATEGY.md) — strategia tecnica
- [`docs/LEGACY_HOSTING.md`](docs/LEGACY_HOSTING.md) — hosting del frontend vendorizzato

---

## Contribuire

Bug report, test su dispositivi reali, traduzioni e pull request sono benvenuti. Prima di inviare modifiche leggi [`CONTRIBUTING.md`](CONTRIBUTING.md) e verifica che i test dell'area modificata passino.

Se il progetto ti è utile, lascia una ⭐ alla repository: aiuta altre persone a trovarlo.

---

## Download e diffusione

Ogni release pubblica un pacchetto `dashboardmodern.zip` ed è quello che HACS scarica quando installi o aggiorni l'integrazione: i contatori qui sotto sono quindi **installazioni reali**, aggiornate da GitHub in tempo reale.

<p align="center">
  <a href="https://github.com/danigio15/dashboardmodern-v2/releases">
    <img src="https://img.shields.io/github/downloads/danigio15/dashboardmodern-v2/total?label=Download%20dalla%201.0.0&color=8b5cf6&style=for-the-badge&cacheSeconds=1800" alt="Download dalla 1.0.0">
  </a>
  <a href="https://github.com/danigio15/dashboardmodern-v2/releases/latest">
    <img src="https://img.shields.io/github/downloads/danigio15/dashboardmodern-v2/latest/total?label=Download%20ultima%20versione&color=0ea5e9&style=for-the-badge&cacheSeconds=1800" alt="Download dell'ultima versione">
  </a>
</p>

<p align="center">
  <a href="https://github.com/danigio15/dashboardmodern-v2/releases"><img src="https://img.shields.io/github/v/release/danigio15/dashboardmodern-v2?label=ultima%20versione&color=0ea5e9" alt="Ultima versione"></a>
  <a href="https://github.com/danigio15/dashboardmodern-v2/stargazers"><img src="https://img.shields.io/github/stars/danigio15/dashboardmodern-v2?label=stelle&color=eab308" alt="Stelle su GitHub"></a>
  <a href="https://github.com/danigio15/dashboardmodern-v2/issues"><img src="https://img.shields.io/github/issues/danigio15/dashboardmodern-v2?label=issue%20aperte&color=f97316" alt="Issue aperte"></a>
  <a href="https://github.com/danigio15/dashboardmodern-v2/commits/main"><img src="https://img.shields.io/github/last-commit/danigio15/dashboardmodern-v2?label=ultimo%20commit&color=64748b" alt="Ultimo commit"></a>
</p>

| Dove guardare | Cosa dice |
| --- | --- |
| [Pagina Releases](https://github.com/danigio15/dashboardmodern-v2/releases) | il numero di download di `dashboardmodern.zip` è indicato sotto ogni release, versione per versione |
| Badge **Download dalla 1.0.0** | somma dei download di tutti i pacchetti pubblicati dalla 1.0.0 in poi |
| Badge **Download ultima versione** | quante installazioni hanno già la versione più recente |
| [Insights → Traffic](https://github.com/danigio15/dashboardmodern-v2/graphs/traffic) | visite e cloni della repository (visibile al proprietario) |

> I download della release contano il pacchetto scaricato da HACS o a mano. Non contano gli aggiornamenti già presenti nella cache di HACS né le installazioni copiate da un backup, quindi il numero reale di impianti è **almeno** quello mostrato.

> **Il conteggio parte dalla 1.0.0.** GitHub tiene i download attaccati alla release che li ha serviti: ripulendo la pagina dalle versioni precedenti alla 1.0 sono spariti anche i loro contatori. Quello che si vede qui è quindi la diffusione della **1.0 in poi**, non la storia del progetto — che invece resta nei commit e in [`docs/CHANGELOG_PRE_1.0.md`](docs/CHANGELOG_PRE_1.0.md).

> **Se il badge mostra un numero che non torna**, è la copia in cache: GitHub non carica le immagini del README direttamente da shields.io, le fa passare dal proprio proxy e le conserva. Il numero vero è quello scritto accanto a `dashboardmodern.zip` nella sezione **Assets** della [pagina della release](https://github.com/danigio15/dashboardmodern-v2/releases/latest), che non passa da nessuna cache.

---

## Supporta il progetto

DashboardModern è un progetto **indipendente e open source**, sviluppato e mantenuto nel tempo libero. Non ha sponsor, non ha abbonamenti, non raccoglie dati.

**Una donazione è gradita e fa la differenza concreta**: più il progetto è sostenuto, più tempo posso dedicare a rispondere alle Issue, ad assistere chi ha problemi di configurazione, a testare su dispositivi reali e a pubblicare correzioni in fretta.

Grazie a chi ha già sostenuto DashboardModern nelle scorse settimane: è **davvero apprezzato**! A chi usa questa integrazione: ci metto parecchia energia e parecchia passione. Se puoi permettertelo, dai anche tu una piccola spinta e diventa sostenitore.

<p align="center">
  <a href="https://www.paypal.com/paypalme/giovannidaniello15"><img src="https://img.shields.io/badge/PAYPAL-ME-1f8fdd?style=for-the-badge&logo=paypal&logoColor=white&labelColor=555555" alt="Sostieni il progetto con PayPal"></a>
</p>

<p align="center">
  👉 <strong><a href="https://www.paypal.com/paypalme/giovannidaniello15">paypal.me/giovannidaniello15</a></strong>
</p>

**Cosa sostiene una donazione**

| Voce | Effetto |
| --- | --- |
| ⏱️ **Tempo di assistenza** | risposte più rapide alle Issue e supporto diretto nella configurazione della plancia |
| 🐛 **Correzioni** | bug risolti e pubblicati in una `1.0.x` senza aspettare il fine settimana successivo |
| 📱 **Test su dispositivi reali** | iPhone, iPad, tablet Android e pannelli a muro: le prove che gli emulatori non sostituiscono |
| ⚡ **Nuove sezioni e integrazioni** | il tempo di sviluppo per quello che ancora manca |
| 🔄 **Compatibilità** | adeguamento a ogni nuova versione di Home Assistant |

**Anche senza donare puoi aiutare parecchio:** lascia una ⭐ alla repository, segnala i bug con una Issue ben descritta, prova le nuove versioni sul tuo impianto e racconta com'è andata, oppure proponi una traduzione o una correzione al README.

Grazie a chi sostiene il progetto: è ciò che tiene DashboardModern gratuito e in sviluppo. 💙

> Lo stesso blocco apre le note di **ogni nuovo aggiornamento**, sopra l'elenco di cosa è cambiato: la sorgente è unica, [`.github/SUPPORT_BADGES.md`](.github/SUPPORT_BADGES.md), e il workflow `Release` la unisce alle note generate automaticamente. Per cambiare il testo o aggiungere un canale si modifica lì e in questa sezione.

---

## Licenza

DashboardModern v2 è distribuito secondo i termini del file [`LICENSE`](LICENSE).

---

<p align="center">
  <strong>DashboardModern v2</strong><br>
  Costruito per Home Assistant, con attenzione a mobile, dati reali e configurazione visuale.
</p>
