# Changelog

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e le
versioni seguono [Semantic Versioning](https://semver.org/lang/it/).

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
