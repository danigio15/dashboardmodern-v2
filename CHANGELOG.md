<!-- DM-FIX-20260812B -->
# Changelog

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e le
versioni seguono [Semantic Versioning](https://semver.org/lang/it/).

## 1.0.1

### Corretto

- **Le due auto mostravano la stessa foto.** Le fotografie stavano in due
  caselle della plancia, non nell'auto: il profilo la imparava solo se si
  risalvava la scheda della macchina, cosa che nessuno fa dopo aver scritto un
  percorso. Da li' in poi cambiare auto non cambiava niente, perche' il profilo
  nuovo non aveva foto e teneva quella dell'altro. Adesso la foto e' dell'auto,
  come il nome e le sue entita': si salva nel profilo scelto, e cambiando
  macchina cambia la fotografia. Chi arriva dalle versioni precedenti se le
  ritrova sull'auto che le stava mostrando — l'altra resta senza, ed e'
  corretto: una foto sua non l'ha mai avuta. Con una macchina sola non cambia
  niente.

- **Le animazioni degli elettrodomestici sembravano ferme.** La scheda si
  ridisegna a ogni cambio di stato — e la potenza di un elettrodomestico acceso
  cambia di continuo — e veniva rifatta da capo, disegno compreso: un'animazione
  su un elemento appena nato riparte da zero. Misurato, il cronometro tornava a
  mezzo secondo a ogni giro: il cestello non completava un giro, i getti non
  finivano la passata. Adesso il disegno non viene mai staccato dalla pagina e
  la sua animazione continua da dove era.

- **Un avviso con un nome inatteso restava immobile.** Le animazioni degli
  avvisi vanno a categorie — porta, finestra, batteria, perdita, fiamma,
  movimento — e un avviso battezzato "Garage" o "Cantina" non rientrava in
  nessuna, quindi restava fermo accanto a uno che si muoveva. Adesso prende un
  battito discreto: non racconta cosa succede, ma dice che qualcosa succede.

- **MiniPC: la scena finiva in fondo alla pagina.** Le righe della sezione erano
  numerate a mano da quando la pagina cominciava con la sua scena; con
  l'intestazione che si prende la prima riga, il pezzo piu' grosso veniva
  sbattuto in coda, sotto la telemetria. E le tre pastiglie stavano su due
  colonne, con la terza sola su una riga mezza vuota.

- **Il caricabatterie del telefono si vedeva assegnata una colonnina di
  ricarica.** Bastava la parola "charger" nel nome per farne una wallbox: adesso
  serve che si parli di wallbox, di stazione di ricarica o di un'auto.

- **Nel popup dell'auto la pastiglia "Aut. Prevista" restava a "—"** per chi non
  ha evcc, mentre sulla pagina era gia' sparita.

- **Il cielo dietro la tapparella mostrava le stelle di giorno**, con il tema
  scuro: le fasce del mattino e del pomeriggio ridefinivano solo il cielo e il
  sole, e stelle, nuvole e colline restavano quelle della notte.

- **Ogni sezione si apriva a una larghezza diversa.** Sette misure sparse fra la
  plancia, i moduli e il foglio di stile del runtime: Energia ed Elettrodomestici
  prendevano tutto lo schermo, Auto e MiniPC si fermavano a mille pixel. Adesso
  la misura sta in un posto solo e le sezioni aprono tutte allo stesso modo.

### Cambiato

- **Chi non gestisce la ricarica con evcc non vede piu' la sua console.** Il
  target di carica con la percentuale, l'autonomia calcolata su quel target e i
  quattro tasti delle modalita' esistono solo se quelle entita' sono mappate:
  senza, restavano un target fermo su "—" e quattro tasti che non fanno niente.
  Ognuno dei tre sparisce insieme all'entita' che lo regge, sulla pagina e nel
  popup, e torna appena la si configura.

### Licenza

- **DashboardModern v2 non è più distribuito con licenza MIT.** Da questa
  versione vale una licenza proprietaria a sorgente visibile: il codice resta
  leggibile e installabile per uso personale e non commerciale, mentre
  ridistribuzione, copie pubbliche, versioni derivate e usi commerciali non sono
  più consentiti senza permesso scritto. Il fork su GitHub è ammesso solo come
  passaggio tecnico per aprire una pull request.
- Le versioni **fino alla 1.0.0 inclusa** restano coperte dalla licenza MIT con
  cui sono state pubblicate: il testo è riportato in appendice a `LICENSE`.

### Repository

- Aggiunti in `.github/rulesets/` i ruleset che vincolano i nomi dei rami e
  proteggono `main`, documentati in
  [`docs/REPOSITORY_PROTECTION.md`](docs/REPOSITORY_PROTECTION.md).

## 1.0.0 — 2026-08-20

La prima versione stabile di DashboardModern v2.

È la stessa plancia che la serie beta ha costruito e che quattro release
candidate hanno messo alla prova su dispositivi veri: quello che cambia è che da
qui in poi la numerazione significa qualcosa. Chi arriva da una `1.0.0-beta.x` o
da una `0.15.x` aggiorna da HACS, riavvia Home Assistant e ritrova la propria
configurazione dov'era.

### La plancia

- **Sedici sezioni**, ognuna accesa solo se la configuri: Home, Energia,
  Elettrodomestici, Auto elettrica e wallbox, Luci, Clima, Temperatura,
  Tapparelle, Sicurezza, Solare termico, Piscina, Irrigazione e MiniPC.
- **Ogni pagina si apre allo stesso modo**: nome della sezione in gradiente, una
  riga che dice di cosa si tratta, il disco colorato in alto a destra. Prima
  ogni sezione stampava il proprio titolo a modo suo.
- **Energia** con flusso live animato, giornaliera, mensile, report, analisi e
  temperature d'impianto. I numeri vengono dalle statistiche di Recorder con la
  stessa aritmetica di Home Assistant, e il consumo Casa si ricava dal confine
  dei flussi quando non c'è un sensore dedicato.
- **La tapparella ha la sua finestra, e la finestra guarda fuori.** Si guarda
  dalla stanza: in primo piano il telaio con le due ante e la maniglia, e la
  tapparella che scende dietro, perché sta fuori. Con un sensore di apertura
  configurato le ante rientrano verso i cardini, l'anta aperta prende corpo e
  getta ombra su quello che ha dietro, e accanto allo stato compare «Finestra
  aperta».
- **Il cielo dietro la finestra segue l'ora del giorno**, in cinque fasce —
  alba, mattina, pomeriggio, tramonto, sera — con il sole che si alza e si
  abbassa, le nuvole che si tingono, le stelle e la luna la notte e le colline
  in controluce al tramonto.
- **Il cerchio della Wallbox apre l'auto**, non lo storico di un sensore: il
  cavo è attaccato a una macchina di cui la plancia sa già tutto. Nel Report la
  wallbox ha la sua colonnina disegnata, con la stessa cornice e la stessa
  griglia degli altri apparecchi.
- **Pizzicare un grafico** per stringere l'intervallo non sposta più il grafico:
  la pastiglia con il periodo e il «↺ Tutto» sta appoggiata sopra, e gli orari
  restano dentro il riquadro.
- **Elettrodomestici** con stato «In funzione», ultimo ciclo, consumi e
  dettaglio per apparecchio; **Luci** con i soli comandi che l'entità dichiara;
  **Clima** che mostra solo le famiglie che la casa ha davvero.
- **Italiano e inglese**, scelti dalla lingua del profilo Home Assistant.
- **Modalità kiosk** su iPhone e iPad, tema chiaro e scuro, barra di navigazione
  riordinabile.

### La configurazione

- **Tutto si configura a video**, dentro la plancia: diciotto tab, un pulsante
  di salvataggio per pannello. Niente YAML, nessun token da incollare.
- **Autorilevamento entità**: un pulsante analizza tutte le entità di Home
  Assistant e propone luci, stanze, unità clima, telecamere e collegamenti,
  mostrando cosa ha trovato **prima** di scrivere qualsiasi cosa. Non
  sovrascrive mai ciò che hai già impostato, e i campi con due candidati
  ugualmente plausibili li lascia a te invece di tirare a indovinare.
- **Un'unica card per il campo entità**, uguale in tutte le maschere: pallino di
  stato, nome del campo, ricerca che ignora accenti e maiuscole, matita per
  scrivere l'id a mano e cestino per svuotare la riga. Il catalogo delle entità
  si apre **davanti** alla finestra che lo chiama, e uno solo per volta.
- **Le stanze sono il registro condiviso**: rinominarne una aggiorna insieme
  Temperatura, Clima, Luci, Tapparelle ed Elettrodomestici.
- **Il contatore totale dell'energia comanda sui campi di periodo**: ogni
  periodo si ricava dal totale con Recorder, e la maschera dice quali entità
  vengono scavalcate.

### La piattaforma

- **La configurazione vive dentro Home Assistant**, nell'archivio
  dell'integrazione: la stessa per tutti gli utenti e per tutti i dispositivi.
  Sopravvive ad aggiornamenti, riavvii, pulizia della cache e perfino alla
  rimozione e riaggiunta dell'integrazione. Conserva le ultime cinque revisioni
  configurate e rifiuta un salvataggio che sostituirebbe una plancia configurata
  con una vuota.
- **I conflitti si risolvono sulla revisione dell'archivio**, non sull'orologio
  del dispositivo.
- **Più plance indipendenti**, una config entry ciascuna, con filtro utenti.
- **Prestazioni su telefono e tablet**: le animazioni si muovono su `transform` e
  `opacity`, le finestre chiuse non tengono più lo sfondo sfocato, e rientrare
  nell'app non lascia la plancia a «CONNECTING…».

### Nota sulle versioni precedenti

La pagina delle release parte da qui: le `0.14.x`, le `0.15.x`, la serie
`1.0.0-beta.x` e le quattro release candidate sono state rimosse. La loro
cronologia resta in [`docs/CHANGELOG_PRE_1.0.md`](docs/CHANGELOG_PRE_1.0.md) e
nei commit del repository.
