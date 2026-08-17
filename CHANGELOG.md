<!-- DM-FIX-20260812B -->
# Changelog

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e le
versioni seguono [Semantic Versioning](https://semver.org/lang/it/).

## 1.0.0-beta.30.4 — 2026-08-17

### Modificato

- La scheda dell'editor Energia si chiama ora **CARICHI E DISPOSITIVI**: dice
  quello che ci si configura — i cerchi del flusso e i dispositivi dentro
  ciascuno — invece della parola interna "carichi".

### Corretto

- La sezione dei carichi compariva anche sotto **Flussi ed entità**: la regola
  di visibilità dell'editor scavalcava l'attributo `hidden` del pannello, che è
  come l'editor Energia nasconde le schede non attive. Ora il pannello resta
  nascosto quando è aperta un'altra scheda.
- L'icona di un carico e il pulsante per sceglierla erano due riquadri vuoti:
  il campo usava le classi legacy, larghe 72px fisse, e il pulsante veniva
  ridipinto dal proprietario canonico delle icone con il proprio markup e il
  font azzerato. Ora la riga è disegnata da questo editor: il campo mostra
  l'icona e il pulsante ne è l'anteprima, e apre lo stesso catalogo di prima.

## 1.0.0-beta.30.2 — 2026-08-17

### Corretto

- Il pannello **Carichi** mostrava ancora la vecchia lista piatta sopra il
  nuovo editor: il renderer legacy riscriveva il pannello e il nuovo si
  accodava sotto, così si vedevano due configurazioni per gli stessi carichi.
  Ora il pannello ha un solo proprietario e la lista vecchia cede il posto.
- Nome, icona e colore di un carico erano tre campi affiancati senza etichetta:
  su telefono non si capiva quale fosse quale, e niente diceva che l'icona si
  potesse scegliere. Ora ognuno ha la sua riga con l'etichetta, e accanto
  all'icona c'è il pulsante che apre il catalogo icone canonico.
- Il popup di un cerchio si intitolava "CARICHI" e non diceva quale cerchio
  fosse stato aperto: ora in alto compaiono icona, nome del carico e periodo.
  Il nome è quello che il flusso mostra davvero, personalizzazione compresa,
  così il titolo non può divergere dal cerchio che hai toccato.
- Un'icona `mdi:` scelta dal catalogo veniva stampata come testo nel popup
  ("mdi:stove") invece che disegnata: titolo, intestazione e card passano ora
  dal renderer icone canonico, e le emoji restano testo.

## 1.0.0-beta.30 — 2026-08-17

### Modificato

- Vista **Energia → Flussi** dinamica: le bolle sotto Casa non sono più le
  cinque fisse disegnate nell'HTML, ma una per ogni carico configurato
  nell'editor Carichi (fino a otto), con nome, icona, colore ed entità presi
  dalla configurazione. Posizioni e connettori sono calcolati: su desktop una
  fila spaziata uniformemente, su mobile due file, e le bolle si rimpiccioliscono
  oltre le cinque invece di sovrapporsi. Vale per Istantaneo, Giorno e Mese.
- Spessore e velocità di ogni connettore seguono la lettura del carico: un
  wallbox a 7 kW disegna una linea più marcata e veloce di un frigo a 60 W. Un
  carico sotto soglia resta visibile ma spento, e un carico senza entità legata
  mostra "—" invece di uno zero inventato.
- Aggiungere, rinominare, riordinare o eliminare un carico ridisegna subito il
  flusso: la topologia si richiude sui carichi rimasti senza lasciare buchi.

- Editor **Carichi** rifatto da zero sulla struttura del flusso: una sola lista,
  una card per ogni cerchio sotto Casa, nell'ordine in cui vengono disegnati.
  Ogni card apre con l'anteprima della bolla che produce — stessa icona, stesso
  nome, stesso colore — e contiene identità, entità, visibilità, riordino e i
  dispositivi che stanno nel suo popup. Sparisce il doppio livello di prima
  (cinque cerchi fissi da una parte, gruppi da collegare a mano dall'altra):
  il gruppo è il carico, e i dispositivi stanno dentro.
- Ogni card dice cosa manca invece di lasciarlo scoprire dal flusso vuoto:
  nessuna entità collegata, potenza assente, nessun contatore energia. Il
  campo del contatore totale spiega che giorno e mese si calcolano da lì, così
  i sensori di periodo restano quello che sono, facoltativi.
- **Il cerchio di un carico con dispositivi dentro vale la somma dei suoi
  dispositivi.** Aggiungerne uno fa crescere il cerchio senza altro da
  configurare; vale per Istantaneo, Giorno e Mese, dove la somma usa gli stessi
  delta Recorder. Un carico con un sensore proprio (una pinza amperometrica
  sull'intera linea) continua a usare quello: è più preciso della somma delle
  prese.
- Nell'editor **Elettrodomestici** c'è ora il campo **Carico energia**: si
  sceglie il cerchio del flusso a cui l'elettrodomestico appartiene e basta.
  Da lì rientra nella somma del cerchio, compare nel popup e viene elencato
  nell'editor Carichi come "da Elettrodomestici", in sola lettura. Nessuna
  configurazione da ripetere: la fa il motore, non l'utente.
- Popup dei sottocarichi ridisegnato: intestazione con il totale del gruppo e
  quanti dispositivi sono in funzione, card ordinate per consumo con barra
  della quota sul gruppo, energia di oggi quando c'è. Lo stato "spento" non è
  più dipinto del rosso degli allarmi — una cucina ferma non è un guasto:
  in funzione ha l'accento verde, standby ambra, spento e non disponibile
  restano neutri.
- La configurazione esistente viene ripresa così com'è: nomi, icone, colori,
  visibilità e dispositivi già inseriti finiscono nella nuova lista senza
  doverli riscrivere. La sezione canonica `loads` resta l'unica verità e le tre
  chiavi legacy vengono riscritte come specchio derivato, così il popup dei
  sottocarichi continua a funzionare.

### Corretto

- Il colore di un carico veniva perso al salvataggio, perché non fa parte dello
  schema canonico del dispositivo: ora viaggia nei metadata e sopravvive.
- Un carico oltre il quinto non è più invisibile nel flusso: la vecchia
  topologia ne poteva mostrare al massimo cinque, mentre l'editor ne accetta
  otto.
- Il consumo di Giorno e Mese non viene più letto dallo **stato del contatore
  totale** del carico: quel valore è l'energia da quando il contatore esiste, e
  mostrarlo come consumo del periodo sarebbe sbagliato di anni. Il periodo
  arriva dal delta Recorder (`sum(fine) − sum(inizio)`, come da
  `docs/ENERGY_RECORDER_PARITY.md`); senza quel dato la bolla mostra "—" invece
  di un numero inventato.
- Il bundle energia calcola ora il delta per dispositivo anche sul **giorno**,
  non solo su mese e anno: un carico misurato solo dal contatore totale ha
  finalmente un valore giornaliero corretto nel flusso.
- La personalizzazione del nodo di flusso (nome, icona, colore, gruppo
  sottocarichi, nodo disattivato) continua a valere e non viene più
  sovrascritta dai nomi legacy di default quando non è mai stata salvata.

## 1.0.0-beta.29 — 2026-08-17

### Modificato

- Pulsante "Aggiungi elettrodomestico" rimosso dalla sezione Elettrodomestici;
  la configurazione avviene interamente dal menu Impostazioni.
- Icona potenza della card showcase: sostituito il simbolo Unicode ⏻ con un'icona
  SVG per garantire il rendering affidabile su tutti i dispositivi mobile.

### Corretto

- Pulsante "← Home" ripristinato quando la skeleton della showcase rimpiazza il
  contenuto della pagina (ensureSkeleton ora lo preserva e reinserisce).
- Popup dettagli elettrodomestici: il render loop legacy non lo sovrascrive più
  con "Nessun elemento attivo" (apriDettagli è stato overridden per 'appliance_view').

## 1.0.0-beta.28 — 2026-08-16

### Modificato

- Sezione **Elettrodomestici** completamente ridisegnata sul riferimento grafico:
  header con "Aggiungi elettrodomestico" e vista griglia/elenco, sidebar con
  Panoramica, stanze e stati con contatori (usabili come filtri) e card
  "Consumo totale" con sparkline, dispositivi attivi ed energia di oggi; chips
  Tutti/In funzione/Standby/Spenti e ordinamento per potenza, nome, stanza o
  stato. I popup KPI, il dettaglio energia giornaliera, lo storico e il popup
  dispositivo restano quelli canonici.

### Aggiunto

- Card elettrodomestico "vetrina": artwork fotorealistico animato per tutti i
  20 tipi a catalogo (cestello che gira, ventola forno con alone di calore,
  getti della lavastoviglie, interno frigo illuminato, vapore, frost…), anello
  countdown del tempo rimanente, barra della potenza scalata sulla potenza
  massima, barra temperatura per frigo/congelatore e striscia ULTIMO CICLO con
  avvio, durata, consumo e costo.
- Calcolo automatico dei cicli dalle transizioni di potenza (delta del sensore
  giornaliero robusto al reset di mezzanotte, oppure integrale della potenza)
  con costo da tariffa Energia o €/kWh per dispositivo.
- Configurazione avanzata della card nell'editor: immagine personalizzata,
  entità stato programma, tempo rimanente, durata ciclo, temperatura con
  min/max barra, potenza massima, €/kWh, soglia standby, entità allarme ed
  entità dell'ultimo ciclo (avvio/durata/consumo/costo). I campi numerici
  vuoti non vengono salvati come 0.

### Corretto

- La lavastoviglie non mostra più l'artwork della lavatrice: la
  canonicalizzazione del tipo ("dishwasher" → "washer" per il suffisso) è ora
  idempotente; il tipo "robot" non degrada più al generico.
- Le soglie In funzione/Standby personalizzate vengono ripersistite anche dove
  le legge il view-model (non solo nei metadata).

## 1.0.0-beta.22 — 2026-08-15

### Corretto

- Testo invisibile con tema Home Assistant scuro: tutte le superfici di proprietà
  della dashboard (editor, card, barra di navigazione) ora usano i token propri
  invece di --primary-text-color del tema host; i nomi stanza nell'editor
  Temperatura tornano visibili (DM-20260815C).

### Aggiunto

- Carichi energia sotto Casa dinamici: configurabili dall'editor (nome, icona,
  entità potenza/energia, colore, max 8) con migrazione automatica dei vecchi slot
  fissi; con zero carichi le bolle e gli archi non vengono più mostrati.
- Campo SOC batteria nella configurazione energia, mostrato nella bolla Batteria
  del flusso istantaneo (DM-20260815C).

## 1.0.0-beta.21 — 2026-08-15

### Modificato

- Ripristinata la pipeline vendor riproducibile end-to-end: ricostruito lo step di split (`scripts/split_legacy.py`), delta upstream→committato versionati e leggibili in `legacy/patches/*.diff`, gate sha256 sull'upstream pinnato e checkout per commit (#127).
- Aggiunto il workflow "Regenerate vendor artifacts" per rigenerare gli artefatti vendor con un click dalla tab Actions (#128).

### Corretto

- **DM-FIX-20260815A** — Corretta la tab stanza di **Elettrodomestici**, che mostrava il token MDI grezzo; ripristinati i nomi stanza assenti nelle righe dell'editor **Temperatura** e normalizzate le stanze durante il ripristino remoto.
- **DM-FIX-20260815B** — Dichiarata correttamente la lingua inglese nella shell vendorizzata e aggiunte protezioni automatiche; completati changelog, badge, validazione HACS, template issue e aggiornamenti Dependabot.

## 1.0.0-beta.20.2 — 2026-08-14

### Corretto

- Ripristinato un unico motore canonico di salvataggio per gli editor, incluso nel build generato e coperto da E2E sui salvataggi reali di Energia ed Elettrodomestici (#116).
- Evitate riconciliazioni di visibilità inutili e conflitti con gli edit canonici.

## 1.0.0-beta.20.1 — 2026-08-14

### Corretto

- Ripristinata la persistenza affidabile su base beta.20, preservando configurazioni locali e remote durante migrazioni e hotfix (#115).

## 1.0.0-beta.20 — 2026-08-14

### Corretto

- Ripristinati nell'editor **Temperatura** i nomi leggibili delle stanze e delle entità, senza alterare le stanze legacy vuote.
- Aggiunta copertura E2E e unitaria dedicata alle etichette Temperatura e alla compatibilità dell'hotfix.

## 1.0.0-beta.19 — 2026-08-14

### Corretto

- Rifinita la sezione **Temperatura**, completata la documentazione README e preparata la release beta.19 (#107).
- Stabilizzati i gate WebKit necessari alla release (#108).

## 1.0.0-beta.18 — 2026-08-13

### Corretto

- Reso il motore icone single-owner per eliminare sfarfallii e scritture concorrenti; stabilizzati i relativi gate WebKit.
- Usato il manifest come unica fonte della versione di release e completata la preparazione beta.18.

## 1.0.0-beta.17 — 2026-08-13

### Corretto

- Eliminato lo sfarfallio delle icone nelle **Azioni rapide**: picker e preview nascono direttamente con il glifo colorato definitivo, senza passaggi SVG intermedi.
- Unificato il picker icone delle **Stanze** tra primo inserimento e modifica usando il catalogo canonico, con ricerca bilingue e nomi accessibili per ogni scelta.
- Rimossa dalla pagina **Temperature** la copia transitoria `Aggiornamento in corso...` senza nascondere il timestamp `Aggiornato alle ...` quando arriva il dato reale.
- Caricato l'owner Beta17 anche dal `legacy/build-info.js` versionato, così checkout sorgente, sviluppo ed E2E usano lo stesso runtime del pacchetto generato.
- Allineati gli E2E storici al picker Beta17 mantenendo i guard architetturali su ownership, cicli, polling e observer confinati al solo `#page-temp`.
- Copertura Browser E2E su italiano/inglese e Chromium/WebKit desktop/mobile per picker stanze, stabilità first-paint e regressioni del runtime editor.

## 1.0.0-beta.16 — 2026-08-13

### Corretto

- Ridotto il selettore mobile **Freddo / Caldo** e consolidati tutti gli owner legacy che forzavano ancora Clima a una singola colonna.
- Le card **Clima** restano ora a **2 per riga su smartphone**, con dimensioni, font, badge, temperature e controlli compatti.
- Gli ID stanza canonici come `room_msqjk307` vengono risolti nel nome leggibile della stanza; su mobile il nome stanza è mostrato dentro la card senza spezzare la griglia.
- Gli editor **Clima** e **Temperature** ricostruiscono le stanze dal `DashboardStore` canonico e mostrano nomi, entità e sensori già configurati.
- Ripristinata nella pagina **Temperature** la barra/tab delle stanze con filtro per `room-id` canonico.
- Ripristinato il nome salvato delle **Azioni rapide** nelle righe dell'editor.
- Ridisegnata la geometria responsive della **Piscina**: vasca contenuta nel viewport, temperatura e descrizione non sovrapposte, comandi compatti e tre chip su una riga mobile.
- Aggiunti test unitari ed E2E real-device per mapping stanza, nomi editor, tab Temperature e layout Clima a due colonne su Chromium desktop/mobile e WebKit/iPad.

## 1.0.0-beta.15 — 2026-08-12

### Corretto

- Impedita la resurrezione delle stanze eliminate, limitando il recupero ai campi mancanti e proteggendo la riconciliazione con un circuit breaker.
- Coalescenti per frame le riparazioni UI beta12/beta14, senza riscritture dei glifi invariati né tick Piscina.
- Recuperati icona e sensori stanza persi da snapshot canonici stantii all'avvio.
- Unificate canonicalizzazione, migrazione e lettura del tipo clima; le etichette Freddo/Caldo ora nascono nel template.
- Ripristinate la scala corretta delle quick-action e le proporzioni esplicite della vasca Piscina su mobile.
- Caricato l'hotfix dopo l'owner definitivo dei glifi beta12.
- Corretto l'abbinamento delle icone Temperatura esclusivamente per id o nome stanza.
- Allineati release metadata, badge e gate Prettier CI; aggiunti test unitari mirati.

## 1.0.0-beta.13 — 2026-08-11

### Corretto

- Canonizzato `termo` negli editor e nel modello dispositivi; corretti layout mobile Irrigazione, chip Piscina e riga icona Temperatura.
- Stabilizzati i glifi con observer limitati ai nodi e aggiunti E2E real-device.

## 1.0.0-beta.12 — 2026-08-11

### Corretto

- Polish real-device, owner definitivo dei glifi, blocco colore stanza e modalità kiosk iOS.

## 1.0.0-beta.11 — 2026-08-11

### Corretto

- Polish real-device, grafico Energia e schema Piscina (#92).

## 1.0.0-beta.10 — 2026-08-11

### Modificato

- Preparazione e metadata della release (#91).

## 1.0.0-beta.9 — 2026-08-11

### Corretto

- Completate le correzioni delle regressioni UI real-device (#90).

## 1.0.0-beta.8 — 2026-08-10

### Corretto

- Consolidati i fix di compatibilità e i contratti della release beta.

## 1.0.0-beta.7 — 2026-08-10

### Corretto

- Risolte regressioni real-device e aggiunta la protezione del brand.

## 1.0.0-beta.6 — 2026-08-10

### Corretto

- Applicati i miglioramenti derivati dal feedback UI.

## 1.0.0-beta.5 — 2026-08-10

### Corretto

- Risolte le cause radice delle regressioni di persistenza e rendering.

## 1.0.0-beta.4 — 2026-08-10

### Corretto

- Rifinito il layout mobile degli editor e delle card.

## 1.0.0-beta.3 — 2026-08-10

### Corretto

- **Aspetto auto** compare soltanto nella Config EV e usa picker distinti per brand e icona vettura, senza riutilizzare il catalogo Stanze/Azioni.
- Stanze e Azioni mostrano anteprime locali visibili; la tavolozza separata viene rimossa e il picker si apre cliccando direttamente sull'icona.
- Il **Rinomina sezione** è integrato accanto all'ordine navbar con una matita e aggiorna anche il nome della relativa scheda Config.
- Le card **Clima** su mobile non ereditano più il rapporto 1:1 che le rendeva enormi; il contenuto torna compatto e ad altezza naturale.
- La Config **MiniPC** mostra esplicitamente nome parametro, riferimento ed entità configurata invece di card apparentemente vuote.
- L'**Andamento giornaliero** del Report Energia ritenta le statistiche Recorder con payload compatibile e, se necessario, usa il renderer storico compatibile prima di mostrare errore.
- Aggiunti contratti automatici ed E2E per scoping EV, picker auto dedicati, icone, rinomina, MiniPC, Clima e compatibilità Recorder.


## 1.0.0-beta.2 — 2026-08-10

### Corretto

- Ripristinata la persistenza reale delle modifiche della Configurazione tramite `frontend/get_user_data` / `frontend/set_user_data`, mantenendo una copia locale autorevole se il backend non è momentaneamente disponibile.
- I profili EV non perdono più mappature `ov`, immagine, brand e icona durante la normalizzazione canonica; il selettore auto usa davvero il brand/icona scelti anche con un solo profilo.
- Le icone personalizzate delle Azioni integrate vengono salvate dal loro editor nativo senza una seconda scrittura concorrente.
- Il flow Energia Giornaliera/Mensile anima Boiler, Wallbox, Clima, Lavanderia e Cucina in base al valore realmente mostrato, preservando direzione e colori dei flussi principali.
- Aggiunti test unitari ed E2E dedicati a persistenza, profili EV, icone azione e animazioni dei carichi.


## 1.0.0-beta.1 — 2026-08-09

### Aggiunto

- Prima beta 1.0 con personalizzazione e persistenza multiutente tramite `frontend/get_user_data` e `frontend/set_user_data`.

## 0.15.20 — 2026-08-08

### Corretto

- Ripristinata nel modal **Modifica elettrodomestico** la stessa illustrazione SVG canonica usata dalla prima configurazione e dalla card.
- Il runtime Energia deriva la versione da `build-info.js` invece di dichiararsi ancora 0.15.12.
- Rimossi duplicati nella allow-list WebSocket e descrizioni fuorvianti sulla selezione utenti.

### Sicurezza, prestazioni e release

- Chart.js 4.5.1, panzoom 9.4.0 e hls.js 1.6.17 sono pinnati e protetti con SRI; `vendor_legacy.py` applica lo stesso contratto ai futuri re-vendoring.
- Il digest degli asset viene calcolato una sola volta via executor per registrazione e riusato da statici, card e pannello.
- Le route statiche espongono soltanto file runtime espliciti, non test/E2E/documentazione interna.
- Una versione già taggata non può essere ripubblicata silenziosamente; gli E2E sono gate della release e girano anche sui push a `main`.
- Rimossi riferimenti di packaging morti e `dashboardmodern.zip` è ignorato; della copia brand installata resta soltanto `brand/icon.png`, richiesto esplicitamente dalla validazione HACS.

## 0.15.19 — 2026-08-08

### Aggiunto

- Confronto settimanale dei consumi Casa basato su Recorder con flow-balance Home Assistant e fallback al contatore totale.
- Migliorata la leggibilità della Config Energia e i layout mobile di Luci e Temperatura.

### Nota

- La preview Modifica Elettrodomestici introdotta come glyph del menu viene sostituita dalla 0.15.20 con l'artwork canonico, coerente con Add e card.

## 0.15.18 — 2026-08-08

### Corretto

- Riallineato Casa al bilancio Energia di Home Assistant quando i flussi completi sono disponibili.
- Inizializzato e aggiornato automaticamente il mese corrente senza cambio manuale del selettore.
- Spostato lo Storico elettrodomestici sul WebSocket autenticato `history/history_during_period`.

## 0.15.17 — 2026-08-08

### Corretto

- Riparato l'overflow mobile della Config Elettrodomestici e la geometria degli input/picker.
- Consolidati i contratti Casa/Report poi ulteriormente corretti in 0.15.18 dopo il confronto con i valori reali Home Assistant.

## 0.15.16 — 2026-08-08

### Corretto

- I riferimenti Giorno/Mese/Anno non più esistenti non bloccano il fallback Recorder; ripristinata la ricostruzione mensile da contatori cumulativi.
- Allineate le preview degli editor a artwork, icone MDI e gruppi canonici.

## 0.15.15 — 2026-08-08

### Corretto

- Rimosso il caching di processo del digest frontend che poteva far apparire invariata una release HACS aggiornata.
- Gli URL immutabili cambiano insieme ai file realmente presenti su disco.

## 0.15.14 — 2026-08-08

### Corretto

- Un campo Energia annuale svuotato resta vuoto dopo salvataggio/reload; la compatibilità annuale/lifetime viene applicata solo ai dati legacy.
- Compattate e corrette su mobile le card Elettrodomestici e Temperature; `[hidden]` resta autorevole.

## 0.15.13 — 2026-08-08

### Corretto

- Stabilizzate regressioni UI/live-state ed Energia con contratti automatici e Browser E2E dedicati.
- Allineati i marker di release e la documentazione del relativo hotfix.

## 0.15.12 — 2026-08-07

### Architettura e prestazioni

- Eliminata la catena Data Contracts che poteva riavviare decine di passaggi di
  normalizzazione dopo ogni `state_changed`; la migrazione ora reagisce soltanto
  a bootstrap, stato iniziale e modifiche reali della configurazione.
- Eliminato il polling permanente Tapparelle a 120/350 ms: la sezione è
  event-driven e reagisce soltanto alle cover configurate.
- Eliminato il retry EV fino a 80 tentativi; profili e immagine auto vengono
  aggiornati su eventi runtime, navigazione e sole entità EV pertinenti.
- Eliminato il `MutationObserver` globale dell'Editor su `document.body` e la
  scansione incrociata delle card Elettrodomestici dal layer Editor.
- Elettrodomestici normalizza le card soltanto per le proprie entità e quando la
  pagina è visibile.
- Energia filtra i refresh Recorder alle sole sorgenti Energia/Report e non
  ricarica più statistiche per luci, clima, tapparelle o altre entità estranee.
- Il consumo Casa viene riconciliato nel bundle canonico prima della proiezione;
  rimosso il secondo listener che correggeva lo stesso bundle dopo il render.

### Corretto

- Il popup **Tapparelle aperte** usa un solo proprietario visuale e il contratto
  modal responsive comune, con icona titolo, icona riga, close coerente e tre
  comandi compatti Apri/Ferma/Chiudi.
- Rimosso `shutter-alert-layout-section.js`, layer CSS separato che stilizzava
  classi non create dal popup reale.
- Un sensore mensile `measurement` può rappresentare il periodo corrente ma non
  viene più esposto come `history` lifetime; mesi precedenti e anno richiedono
  una sorgente cumulativa `total`/`total_increasing`.
- Data Contracts non può più ripromuovere automaticamente mensile/energia a
  `history_entity` o `report_entity`; coperto esplicitamente il caso
  `sensor.energy_mese_microonde`.
- README/HACS allineati alla 0.15.12 e immagine hero semplificata su
  `brand/logo.png`.

### Verifica e diagnostica

- Aggiunti contratti automatici che vietano il ritorno di polling/retry noti,
  owner Energia duplicati, observer globali dell'Editor e storico mensile
  spacciato per lifetime.
- Browser E2E Tapparelle verifica icone, geometria modal e tre pulsanti compatti
  anche su mobile.
- Documentato che, quando HACS mostra **In attesa di riavvio**, il nuovo
  frontend non va considerato attivo finché Home Assistant non è stato
  riavviato e l'app/browser non è stata riaperta o ricaricata completamente.

## 0.15.11 — 2026-08-07

### Corretto

- Il consumo **Casa** viene riconciliato con il bilancio dei flussi usato dalla
  dashboard Energia di Home Assistant quando Fotovoltaico e Rete sono
  configurati; il contatore Casa diretto resta fallback se il bilancio non è
  ricostruibile.
- Le card Elettrodomestici non mostrano più **IN FUNZIONE** a 0 W soltanto
  perché lo switch di comando è ON: `state_entity`/`status_entity`, comando e
  potenza hanno ruoli distinti e 0 W con smart plug ON risulta STANDBY.
- Rimane un solo comando **Accendi/Spegni** nella card, eliminando il doppio
  controllo iconico + testuale.
- Un sensore mensile `measurement` non viene più salvato, precompilato o usato
  come contatore lifetime per Storico/Report; il campo totale richiede una
  sorgente cumulativa `total` o `total_increasing`.
- Le informazioni specifiche Energia vengono rimosse passando ad Avvisi o ad
  altre sezioni dell'Editor.
- Le righe Report sono contenute entro i bordi del modal anche su viewport
  stretti e i modal di modifica condividono shell, header, campi, scroll e
  footer coerenti.

### Prestazioni

- Gli aggiornamenti Home Assistant non riferiti da alcuna configurazione della
  dashboard aggiornano i registri interni senza provocare rendering UI.
- Il filtro live include anche le configurazioni legacy ancora valide, compresi
  profili EV, stanze, luci, clima, tapparelle, energia e override entità.
- EV reagisce soltanto alle entità dei profili auto e Temperature soltanto ai
  sensori temperatura/umidità delle stanze configurate.
- Il `MutationObserver` dell'Editor pianifica lavoro solo per mutazioni che
  riguardano effettivamente `#editor-modal` o i modal di sezione.

### Pulizia e verifica

- Eliminati i quattro duplicati della cartella root `assets/`: README e HACS
  usano ora la cartella canonica `brand/`; resta separata la copia brand
  dell'integrazione installata necessaria al packaging Home Assistant.
- Rimossi test legati nominalmente a vecchie release e mantenuti i relativi
  contratti in test correnti/version-neutral.
- Browser E2E usa fixture che riproducono le regressioni reali: contatore Casa
  diretto discordante dai flussi, elettrodomestico a 0 W con switch ON, overflow
  Report e guida Energia che non deve comparire in Avvisi.
- Validazione HACS, hassfest, Python, Ruff, test frontend e audit orphan restano
  gate obbligatori della release.

## 0.15.10 — 2026-08-07

### Corretto

- Eliminata la tempesta di eventi UI all'apertura: lo snapshot iniziale
  `get_states` continua ad aggiornare tutti gli stati interni ma non emette più
  un `dashboardmodern:state-changed` per ogni entità Home Assistant.
- Gli aggiornamenti live ravvicinati vengono coalescati in batch e la frequenza
  delle notifiche UI viene limitata, evitando raffiche di render su Energia,
  Elettrodomestici, Temperature ed EV.
- Il gate degli eventi viene armato prima della creazione del broker Energia,
  eliminando la race di bootstrap anche con bridge/WebSocket molto rapidi.

### Pulizia

- Esteso l'audit orphan a tutti i moduli moderni `frontend/src` e a tutti gli
  entrypoint reali di produzione (`report-mobile-fixes.js`, `modules-entry.js`,
  `panel.js`, `dashboard-card.js`).
- Rimosso `src/core/energy-total-source.js`, facciata di compatibilità non
  referenziata da alcun entrypoint reale.
- Sostituito il vecchio test versione `release-0152-version.test.js` con un test
  dedicato alla 0.15.10; README e manifest tornano allineati alla release.

### Verificato

- Test di carico con 2.500 stati nello snapshot iniziale: tutti gli stati
  vengono acquisiti con zero notifiche UI di bootstrap.
- Test con 500 aggiornamenti live consecutivi: una sola notifica UI coalescata.
- Audit automatico dei moduli moderni e legacy per impedire nuove facciate o
  runtime orfani nelle release successive.

## 0.15.9 — 2026-08-07

### Corretto

- Il Report Energia e i KPI Casa usano la crescita della `sum` Recorder del
  contatore totale per giorno, mese e anno, compresi i periodi storici; i
  sensori giorno/mese/anno restano override soltanto del periodo corrente.
- La configurazione Energia espone nuovamente il sensore **SOC batteria** e i
  contatori energia totale per Casa, rete, fotovoltaico e carica/scarica
  batteria.
- Gli Elettrodomestici rispettano `state_entity` e il legacy `status_entity`,
  distinguono `unavailable`/`unknown` da **SPENTO/OFF** e conservano le soglie
  RUNNING/STANDBY basate sulla potenza.
- Le card Elettrodomestici mantengono layout e azioni entro il viewport mobile;
  il pulsante Storico resta disabilitato quando non esiste una sorgente valida.
- Gli aggiornamenti `state_changed` di Home Assistant riattivano il refresh
  Energia senza attendere il vecchio intervallo periodico e senza creare loop
  sugli stati virtuali derivati `dm.*`.
- Corrette le asserzioni E2E per formattazione locale dei decimali e sidebar
  off-canvas, mantenendo identica la verifica funzionale tra italiano e inglese.

### Pulizia

- Rimosso il vecchio `energy-config-section.js` ormai sostituito dal renderer
  Energia canonico e rimosso il documento di pianificazione 0.15.9 diventato
  obsoleto dopo l'implementazione.
- Verificato il grafo JavaScript legacy con l'audit automatico degli orphan:
  nessun modulo di produzione non raggiungibile dagli entrypoint.

### Verificato

- Parità Recorder con fixture reset-aware e fallback storico dal contatore
  cumulativo quando è configurato anche un sensore di periodo corrente.
- Test unitari per `state_entity`, `status_entity`, unavailable, refresh live e
  assenza di loop sugli stati derivati.
- Browser E2E italiano/inglese su desktop, mobile e WebKit per Config Energia,
  SOC batteria, Elettrodomestici, storico e KPI mensili.
- HACS, hassfest, test Python, test frontend e Ruff.

## 0.15.0 — 2026-08-03

### Architettura

- Eliminata dal grafo di produzione la catena di patch runtime accumulata tra
  le release 0.14.7 e 0.14.17. I vecchi file restano come storico, ma non
  vengono più caricati dal browser.
- Introdotti un solo broker WebSocket Home Assistant e un solo controller
  event-driven per Energia, Report ed Elettrodomestici.
- Rimossi gli intervalli permanenti e gli observer globali del documento che
  causavano rendering ripetuti, lentezza progressiva e writer concorrenti.
- Le richieste Recorder sono deduplicate, condivise e memorizzate in cache.

### Corretto

- Header, Produzione FV, Consumo totale, Autosufficienza e riepilogo costi ora
  leggono lo stesso bundle mensile atomico; un aggiornamento live non può più
  sostituire il consumo Casa con un valore differente.
- Il riquadro **Totale anno** usa realmente gennaio → fine anno selezionato,
  oppure gennaio → ora per l'anno corrente, senza riutilizzare il totale mese.
- Il Report Elettrodomestici calcola il delta del periodo dal sensore energia
  totale cumulativo e non mostra più il valore lifetime come consumo mensile.
- La consultazione di un mese storico non sovrascrive i valori correnti usati
  dai flow Energia.
- Rimosso il secondo filtro stanze inserito dentro la griglia
  Elettrodomestici; rimane esclusivamente la navigazione canonica superiore.
- I nodi opzionali del flow, compresa Wallbox, e le relative linee non vengono
  renderizzati quando non esiste alcuna entità configurata.
- Gli asset locali usati da Home Assistant e HACS sono ora identici al logo del
  repository, incluse le varianti ad alta densità.

### Verificato

- Invarianti automatiche: un solo broker, zero `setInterval` permanenti, zero
  `MutationObserver` globali e nessun layer release 0.14.x nel loader runtime.
- Test unitari su confini mese/anno, baseline Recorder, reset
  `total_increasing`, totale Casa e sensori energia totale dispositivi.
- Browser E2E italiano e inglese su desktop, mobile e WebKit per coerenza KPI,
  totale anno, Report dispositivi, stanze, flow opzionale e isolamento storico.
- HACS, hassfest, test Python, test frontend, Ruff e artefatto release.

## 0.14.17 — 2026-08-02

### Corretto

- Il cambio mese nel Report Energia mantiene visibili i dati precedenti durante
  il caricamento e sostituisce Produzione, Consumo e Autosufficienza in un unico
  aggiornamento, senza passaggi intermedi a zero.
- Ripristinata l'associazione Elettrodomestico → Stanza usando il modello
  canonico; i filtri stanza mostrano nuovamente solo i dispositivi appartenenti
  alla stanza selezionata.
- Rimossa dalla card Elettrodomestici la vecchia rappresentazione `∑ Totale` e
  sostituita con riquadri leggibili **Consumo totale** e **Adesso**, lasciando
  invariata l'immagine configurata del dispositivo.
- Ridisegnata la card Temperature con gerarchia più chiara per stanza,
  temperatura e umidità. La fiamma non viene più mostrata: al suo posto compare
  uno stato testuale esplicito come **Comfort**, **Caldo** o **Molto caldo**.

### Verificato

- Controllo sintattico del nuovo runtime.
- Browser E2E italiano e inglese per cambio mese senza zero, filtri stanza,
  mantenimento dell'immagine elettrodomestico e card temperatura senza fiamma.

## 0.14.15 — 2026-08-02

### Corretto

- Impedita la sovrascrittura ritardata dei valori Energia già corretti: Casa,
  Fotovoltaico, Rete e Batteria mantengono il dato canonico del periodo durante
  refresh Recorder e aggiornamenti del runtime.
- Temperatura e umidità ora ricevono lo stato iniziale con `get_states` e gli
  aggiornamenti successivi tramite una sottoscrizione autenticata agli eventi
  `state_changed` di Home Assistant.
- Lo stato Elettrodomestici considera finalmente `control_entity`,
  `state_entity`, `switch_entity` e i sensori di potenza W/kW.
- Badge della card e pulsante **Accendi/Spegni** vengono riconciliati con lo
  stato reale senza attendere un nuovo rendering completo della pagina.
- Nuova icona Home Assistant/HACS con safe area trasparente, variante ad alta
  densità e logo locale, per evitare il ritaglio nelle righe compatte.

### Documentazione

- README riscritto e aggiornato alla release 0.14.15 con installazione,
  aggiornamento, priorità Energia, configurazione Temperature,
  Elettrodomestici, branding, sicurezza e diagnostica.
- Aggiunte indicazioni esplicite sul riavvio richiesto dopo un aggiornamento
  HACS e sul confronto con la dashboard Energia nativa.

### Verificato

- Test unitari dedicati a `control_entity` e soglie di potenza.
- Browser E2E italiano e inglese per i tre casi reali: Energia inizialmente
  corretta che non deve cambiare, temperatura dal bridge e dispositivo acceso.
- HACS, hassfest, test Python, test frontend, Ruff e build release.

## 0.14.14 — 2026-08-02

### Aggiunto

- Classificazione dei contatori energetici tramite metadati Home Assistant
  `device_class`, `state_class` e unità reali.
- Nuova famiglia SVG coerente per forno, microonde, frigorifero, scaldabagno,
  lavatrice, asciugatrice, lavastoviglie, piano cottura e TV.
- Guardie per renderer, observer e mutazioni DOM del runtime legacy.

### Corretto

- Calcolo del consumo mensile del Report a partire da contatori cumulativi e
  Long-Term Statistics, senza mostrare il valore lifetime.
- Supporto alle vecchie mappature `dm.*` e ai reset `total_increasing`.
- Stabilità delle card Elettrodomestici e aggiornamento live delle Temperature
  nell'ambiente di test.

## 0.14.13 — 2026-08-01

### Corretto

- Ripristinati i totali mensili della sezione Energia usando richieste Recorder
  compatibili con Home Assistant e senza il parametro non supportato `types`.
- Il Report dispositivi ora calcola i consumi del mese dai contatori cumulativi,
  incluse baseline precedenti al periodo e gestione dei reset `total_increasing`.
- Eliminati i refresh Recorder duplicati quando la pagina Report non è visibile.
- Ripristinate le illustrazioni generate di frigorifero e scaldabagno dopo il
  rendering delle card Elettrodomestici.
- Immagini personalizzate e SVG vengono centrati e contenuti correttamente su
  desktop, mobile e WebKit, senza ritagli o overflow.

### Verificato

- HACS, hassfest, test Python, test frontend, Ruff e Browser E2E completi su
  interfacce italiana e inglese.

## 0.14.10 — 2026-07-31

### Aggiunto

- Campi **contatore totale cumulativo** per consumo casa, prelievo e immissione
  rete, produzione fotovoltaica, carica e scarica batteria.
- Validazione nel Config Energia di unità, `device_class` e `state_class`; i
  sensori W/kW vengono riconosciuti come potenza e rifiutati per i totali.
- Proiezione automatica di un contatore totale sui periodi mancanti. Giorno,
  mese, mesi passati e anno vengono ricavati dalle Long-Term Statistics di Home
  Assistant; i sensori specifici per periodo restano override prioritari.
- Test unitari ed E2E dedicati a contatori cumulativi, report con icone,
  Temperatura e layout WebKit/iPad/Fold.

### Cambiato

- Il Report Energia preferisce l'entità totale o un'altra entità con
  `state_class: total_increasing`/`total` rispetto a sensori mensili o
  giornalieri, così può ricostruire correttamente lo storico per mese e anno.
- Le visuali del Report usano immagine, SVG dell'elettrodomestico o glifo
  leggibile. Le stringhe `mdi:*` non vengono più stampate nell'interfaccia o nel
  selettore dispositivo.
- I pulsanti **Aggiungi**, **Salva** e **Annulla** sono uniformati per altezza,
  raggio, gerarchia cromatica e comportamento responsive.
- README ampliato con configurazione Energia raccomandata, precedenza dei campi,
  requisiti dei contatori e diagnostica dei valori a zero.

### Corretto

- Card Temperatura con nome, icona, valore e umidità sovrapposti a causa di
  `grid-area` applicate a elementi annidati: la struttura interna ora usa una
  griglia stabile e selettori più specifici delle regole legacy.
- Icona forno/frigorifero assente nel Report e testo letterale `mdi:stove`.
- Simbolo batteria associato impropriamente al totale consumato nella card
  Elettrodomestici; sostituito da **∑ Totale**.
- Config Energia privo dell'ingresso necessario per usare direttamente contatori
  lifetime come `sensor.solarman_total_grid_energy`.

## 0.14.9 — 2026-07-31

### Aggiunto

- **Plancia Lovelace associata** a ogni istanza DashboardModern. Viene creata
  alla prima apertura amministrativa, compare in **Impostazioni → Plance** e
  può essere scelta come predefinita globale o personale.
- **Selettore utenti autorizzati** nelle opzioni dell'integrazione.
- Custom card globale `dashboardmodern-card` caricata automaticamente.

### Cambiato

- Report Energia collegato alla visuale canonica dell'elettrodomestico.
- Layout responsive con profili compact/fold/wide e ricalcolo del viewport.
- Associazione manuale Luce → Stanza resa prioritaria.

### Corretto

- Stanze senza luci nascoste.
- Ricalcolo delle card al passaggio fra schermo chiuso e aperto dei Fold.

## 0.14.8 — 2026-07-30

- Consolidate le regressioni UI reali di Tapparelle, Temperatura, Report,
  Irrigazione e Avvisi.
- Resi verdi HACS, hassfest, test applicativi e Browser E2E completi.
- Introdotto il workflow automatico di release con tag e `dashboardmodern.zip`.

## 0.14.7 — 2026-07-30

- Revisione di coerenza grafica e compatibilità sul runtime Home Assistant
  reale, inclusi desktop, mobile e WebKit/iPad.

## 0.13.4 — 2026-07-28

- Rifinitura finale dell'Editor: Salva Telecamere, Report Energia canonico e
  card Costi uniforme.
- Corretti picker entità persistenti, ricerca icone Stanze, visibilità
  immediata e migrazione Lavatrice.

## 0.13.2 — 2026-07-28

- Unificato l'editor Energia con tab Flussi e Impostazioni.
- Consolidati carichi secondari e voci report in un modello canonico migrato.

## 0.13.0 — 2026-07-28

- Introdotti DashboardStore canonico, migrazione schema v2 e coordinamento dei
  renderer reattivi.
- Unificati nomi/visuali dispositivi, CRUD elettrodomestici e telecamere,
  visibilità sezioni e riferimenti stanza stabili.

## 0.12.0 — 2026-07-27

- Prima candidata pubblica come integrazione HACS con plance multiple,
  autorilevamento dai registri Home Assistant, editor visuale e storage isolato
  per istanza.
