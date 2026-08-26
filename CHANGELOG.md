<!-- DM-FIX-20260812B -->

# Changelog

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e le
versioni seguono [Semantic Versioning](https://semver.org/lang/it/).

## 1.2.0

### Aggiunto

- **Il ritratto delle persone e' un personaggio 3D, e i pezzi si combinano
  liberamente.** Il disegno costruito a mano se n'e' andato: al suo posto ci
  sono i render 3D di Fluent Emoji (Microsoft, licenza MIT), vendorizzati
  nell'integrazione — 255 immagini, 2,1 MB, nessuna rete a runtime. Si
  scelgono quattro cose: **persona** (uomo, donna, neutro, ragazzo, ragazza,
  anziano), **capelli** (lisci, barba, ricci, rossi, bianchi, calvo),
  **carnagione** (cinque, nessun giallo) e **vestito** (ufficio, medico,
  cuoco, smoking, velo, pompiere, poliziotto, muratore, operaio, meccanico,
  contadino, pilota, astronauta, giudice, supereroe). Sono **1.600
  combinazioni**, e sono libere davvero: «ricci» e «cuoco» insieme si possono,
  perche' la testa scelta viene riscalata e incollata sul busto scelto. Le
  misure che servono a incastrarle — dove sta la testa in ogni immagine — le
  prende lo script di build una volta sola. Nel costruttore ogni pastiglia e'
  il TUO ritratto con quel pezzo addosso, non un'icona; e c'e' il 🎲.

- **I ritratti respirano e sbattono le ciglia.** Il respiro e' CSS, quindi
  gratis. Il battito no: gli occhi in un render non stanno su un livello a
  parte, quindi lo script di build li **trova** — sono le due macchie chiare e
  desaturate nella meta' alta della testa — e la plancia ci disegna sopra la
  palpebra, prendendo il colore dalla guancia della persona stessa cosi' che
  combaci con qualunque carnagione. Il battito dura trecento millisecondi e
  poi la tela torna a dormire: ferma, una plancia con quattro persone non
  disegna niente. L'espressione la decide quello che la plancia sa gia': chi
  e' a casa ha gli occhi che ridono, chi ha la batteria agli sgoccioli o il
  telefono fermo da ore ha le palpebre pesanti.

  Le facce disegnate con la versione precedente non si perdono: carnagione,
  capelli, barba e vestito vengono tradotti nei tratti nuovi.


- **Backup e ripristino della configurazione.** La scheda «💾 Backup» in
  configurazione raccoglie tutta la configurazione condivisa — sezioni,
  stanze, entità, persone, auto, tutto — in un file JSON da scaricare, o da
  copiare negli appunti dove i download non passano. Il ripristino accetta il
  file o il testo incollato, dice quante voci porta e chiede conferma inline
  prima di scrivere; le chiavi che il backup non porta restano come sono, e
  un file manomesso non può scrivere chiavi fuori dal perimetro condiviso.

- **L'irrigazione guarda il terreno.** Accanto al sensore di umidità ci sono
  due soglie nuove: col terreno già bagnato (≥ soglia alta) il programma
  delle ore fisse salta, con l'avviso in card come per la pioggia — e il
  tasto «forza» passa comunque; sotto la soglia bassa (es. 5%) il programma
  parte da solo al primo cambio di stato, una volta al giorno, con l'avviso.
  Lo skip non brucia il giorno dell'avvio automatico: contano solo le
  partenze vere.

- **Il meteo in Home legge la stazione personale.** (#205) Chi ha una stazione
  meteo (Ecowitt e simili) mappa i suoi sensori nella scheda Home della
  configurazione — temperatura esterna, umidità, temperatura percepita,
  velocità e direzione del vento — e il widget mostra quei numeri, con
  l'unità del sensore: l'entità weather resta per lo stato e l'icona, e per
  ogni dato non mappato. La percepita compare come riga sua solo quando c'è,
  e la direzione in gradi diventa la rosa dei venti (N, NNE, …); un sensore
  testuale si mostra com'è. La stazione da sola basta a far vivere il widget,
  anche senza un'entità weather.

- **«In primo piano»: il ponte dei widget della Home.** (#201) Una parte
  della Home dedicata ai widget: tessere piccole ed eleganti — un numero,
  un anello, una parola — una per sezione della plancia, e al tocco la
  tessera si espande in una card larga col dettaglio vivo di quella sezione.
  Otto widget, ognuno con il suo colore: le **cose da fare** con le voci
  spuntabili e la scadenza rossa con ⚠️ quando è passata; le **luci** accese
  con l'interruttore a pillola per spegnerle da lì; il **clima** con la media
  ambiente e il tasto di accensione per zona; le **tapparelle** aperte con le
  frecce ▲■▼; la **sicurezza** con lo stato dell'antifurto e le aperture;
  l'**energia** con la potenza di casa (in kW sopra il migliaio) e i kWh di
  oggi; gli **elettrodomestici** in funzione coi loro watt; la
  **temperatura** media con l'umidità. Ogni widget legge la configurazione
  che la sua sezione ha già e compare solo se c'è qualcosa da mostrare;
  niente polling, e il markup si rifà solo quando cambia la struttura, così
  l'apertura non riparte mai da sola. Le liste ToDo arrivano da
  `todo.get_items` sulla presa WebSocket della plancia, spuntarle chiama
  `todo.update_item`, e la scheda «🧩 Widget» in configurazione governa
  tutto: le liste ToDo — con «🪄 Rileva da Home Assistant», in `cd_todo` — e
  le tessere stesse, quali vederne e in che ordine (`cd_widgets`, revisione 7
  della configurazione condivisa).

- **Le telecamere, in miniatura sul ponte.** La tessera «📹 Telecamere» dice
  quante sono e, aperta, mostra le miniature di tutte — lo stesso letterbox
  scuro del muro della Sicurezza, col pallino live — aggiornate ogni dieci
  secondi finché la tessera è aperta su uno schermo visibile: chiusa, il
  timer muore e la memoria viene restituita. I fotogrammi passano dalla
  stessa strada autenticata del muro, con un registro degli object URL
  separato perché nessuno revochi i blob dell'altro.

- **Il ponte è vivo.** Le tessere entrano in cascata, il riflesso attraversa
  la tessera al passaggio, l'icona si anima, le tessere-avviso respirano con
  l'onda del loro accento, le righe del dettaglio entrano in sequenza e le
  miniature zoomano al tocco — tutto spento da `prefers-reduced-motion` per
  chi il movimento non lo vuole.

- **I dettagli comandano, e ogni riga ha la sua icona.** L'antifurto si
  governa dalla tessera Sicurezza: Fuori 🏠, Notte 🌙 e Sblocca 🔓 passano
  dallo stesso tastierino PIN della pagina Sicurezza, con la modalità attiva
  evidenziata. E le righe dei dettagli parlano per immagini: la lavatrice ha
  il suo disegno vero (lo stesso tratto SVG della sua pagina), la luce la
  lampadina che si spegne in grigio, il clima fiamma o fiocco secondo quel
  che sta facendo, le tapparelle la finestra, le batterie 🔋 o 🪫 quando sono
  da cambiare, porte e cancelli 🚪, gli avvisi personalizzati la loro icona
  scelta.

- **Il Quadro Avvisi esce dalla Home, e il ponte prende il suo posto.** Le
  card del Quadro — aperture, batterie scariche, allagamenti, avvisi
  personalizzati — sono diventate tessere del ponte, con le STESSE liste
  sorvegliate e le stesse regole di conteggio del runtime, così numero e voci
  combaciano sempre; come le card di prima compaiono da sole solo quando
  hanno qualcosa da dire, e al tocco elencano chi è aperto, chi è scarico (in
  ordine di carica), chi è bagnato. Il vecchio riquadro non viene più
  nascosto a disegno fatto — si vedeva comparire e sparire sotto gli occhi:
  è uscito dal documento, così non c'è più niente da nascondere. Con lui se
  n'è andata la card «Tapparelle aperte» che ci abitava dentro, e il suo
  popup: la tessera «Tapparelle» dice le stesse cose e porta gli stessi
  comandi, tendina della posizione compresa. Due strade per la stessa stanza
  erano una di troppo.

- **Quali entità vanno nei widget, entità per entità.** Le tessere leggono
  la configurazione della sezione che raccontano, tutta: va bene finché uno
  le vuole tutte, ma in Home si guarda di sfuggita e non c'era modo di dire
  «questa no». Adesso la parola in contrario sta accanto all'entità stessa,
  in ogni scheda della configurazione, sulla riga in cui quell'entità è già
  scritta — un interruttore 🧩 che dice se va in Home. Le righe le disegna il
  runtime, ognuna a modo suo, ma tutte scrivono l'entity_id in chiaro: è
  quello il gancio, così l'interruttore compare in Luci, Clima, Tapparelle,
  Telecamere, Stanze, Elettrodomestici, Aperture, negli avvisi e ovunque
  un'entità sia nominata. Chi non mostra un entity_id non riceve niente,
  perché non c'è niente da escludere. La scelta viaggia in `cd_widgets`
  insieme all'ordine delle tessere: chi non è nell'elenco è dentro, così chi
  non tocca niente vede quello che vedeva.

- **Niente detto due volte: la Sicurezza non conta più le telecamere.** La
  didascalia della tessera «Sicurezza» diceva «2 telecamere» mentre accanto
  c'era la tessera «Telecamere» con le miniature: due tessere per la stessa
  cosa. Adesso la Sicurezza parla di quello che comanda — l'antifurto e le
  aperture — e senza antifurto né aperture non compare affatto, perché le
  telecamere da sole sono già la loro tessera.

- **I gruppi sorvegliati che non alimentavano più niente sono spariti.** Il
  Quadro Avvisi aveva una card per le luci accese, una per il clima, una per
  il riscaldamento, alimentate da elenchi di entità scritti a mano nella
  scheda degli avvisi. Quelle card non ci sono più e le tessere che le hanno
  sostituite leggono la sezione vera — le luci sono quelle della scheda Luci,
  il clima quelle della scheda Clima — quindi quegli elenchi si potevano
  riempire senza che cambiasse niente da nessuna parte. Restano i gruppi che
  una tessera ce l'hanno ancora: aperture, batterie, allagamenti e gli avvisi
  personalizzati. Con loro se n'è andata anche la card «Allagamenti» che
  cercava ancora il Quadro per posarsi, e il suo popup.

- **La configurazione degli avvisi si trasferisce nella scheda Widget.** La
  linguetta «🔔 Avvisi» non aveva più una sezione dietro: quegli avvisi sono
  diventati tessere. Quello che c'era da configurare — quali sensori
  sorvegliare, gli avvisi personalizzati con condizione e icona — sta sotto
  le tessere che governa, nella scheda «🧩 Widget», ed è la stessa scheda di
  prima con i suoi accordion e i suoi pulsanti: cambia la stanza, non i
  mobili. Chi la chiamava per nome ci arriva lo stesso.

- **Lo stato della connessione torna accanto alla rotella.** L'intestazione
  distribuisce i suoi figli agli estremi: da quando c'è l'ingranaggio in
  fondo, la pillola «Connesso» restava sospesa in mezzo al vuoto. Adesso lo
  spazio libero va tutto alla sua sinistra e le due cose stanno insieme,
  dalla parte in cui si va a cercarle.

- **La tapparella comandata da due relè.** (#194) «Ho due tende su due Shelly
  2PM e non riesco a inserire l'entità corretta: l'entità cover che chiede la
  sezione non la trovo.» Uno Shelly lasciato in modalità interruttore non
  espone una copertura — espone due prese, una che manda su e una che manda
  giù — e la casella accettava sì un relè singolo, ma un motore a due fili non
  funziona così: chiudere non è spegnere la salita, è accendere la discesa.
  Ogni riga porta adesso la casella **«Relè di discesa»**, e con lei Apri
  accende la salita, Chiudi accende la discesa e Ferma le spegne entrambe —
  il verso opposto si spegne sempre per primo, perché due contatti chiusi
  insieme su un motore a due fili non devono succedere mai. La pastiglia dice
  «In apertura» e «In chiusura» leggendo i relè, e a relè fermi dice «Ferma»
  senza inventare a che punto sia arrivata: un motore a due fili non lo
  racconta, e il disegno la mette a metà. La casella vale solo dove ha senso,
  cioè quando anche il primo comando è un relè: accanto a una `cover.*` vera
  non si salva, e la scheda lo dice invece di perderla in silenzio. E il
  vicolo cieco della segnalazione si chiude alla radice: la riga in cima alla
  scheda diceva «tapparelle (entità cover)» e il segnaposto solo
  `cover.tapparella_x`, così chi ha la tapparella dietro un relè cercava una
  copertura che il suo impianto non espone. Adesso dicono tutte e tre le
  strade: una `cover.*`, un relè, o due. E la tessera «Tapparelle» in Home
  comanda anche queste: le frecce sono le stesse, cambia solo la lingua in cui
  parlano — la traduzione sta scritta una volta sola, in un posto solo, perché
  una regola di sicurezza scritta due volte prima o poi vale a metà.

- **La percentuale della tapparella si sceglie, non è più fissa.** (#200)
  «Non voglio la chiusura completa ma tipo al 95%, per lasciar passare un po'
  d'aria»: sotto Apri/Ferma/Chiudi la card ha una tendina con tutte le
  percentuali, dal 100% aperta allo 0% chiusa di cinque in cinque, e quella
  scelta parte subito verso ogni copertura della card che accetta una
  posizione — stesso `set_cover_position`, stessa presa ottimistica del
  cursore. Poi la tendina torna alla sua voce d'invito: è un comando, non lo
  specchio di dov'è la tapparella. La stessa tendina è nelle righe del popup
  «Tapparelle aperte» in Home. La posizione preferita della configurazione non
  è più l'unica scelta possibile: resta come scorciatoia di casa, segnata con
  la stella al suo posto in scala anche quando non cade sui passi da cinque.
  La casella sta in tutti e tre gli editor: il modulo legacy, la matita sulle
  righe salvate e il modale moderno.

- **Le aperture, nella sezione Sicurezza.** (#195) Il portone del condominio e
  la porta di casa stanno fra la centrale d'allarme e le telecamere: una card
  per porta — serratura, pulsante del citofono, relè, cancello o script — il
  tocco chiede conferma e, con un PIN configurato (4-8 cifre), il codice, con
  lo stesso tastierino della centrale. È un cancello locale contro le aperture
  accidentali: la serratura che dichiara di sapersi aprire riceve `lock.open`,
  le altre `lock.unlock`, e ogni dominio apre col suo servizio. La scheda
  «🚪 Aperture» in configurazione scrive `cd_security_doors`, che viaggia con
  la configurazione condivisa.

- **La pompa di calore raffresca e riscalda.** (#195) Il tipo dell'unità clima
  ha una terza voce — «♨️ Pompa di calore» — per i condizionatori che fanno
  anche il caldo: l'unità compare in tutti e due gli elenchi, Freddo e Caldo,
  e il tasto di accensione del tab Caldo la mette in `heat` mentre quello del
  tab Freddo la mette in `cool`, invece di riaccenderla com'era. La voce sta
  nel modale moderno, nell'editor legacy e nel wizard; le card gemelle non
  duplicano l'id storico `card-<entità>` che il runtime cerca per nome.

- **La % di umidità del terreno, nell'Irrigazione.** Il sensore di umidità del
  terreno si configura nella scheda Irrigazione — con le soglie facoltative
  della banda ideale — e la card del programma mostra il misuratore, lo stesso
  disegno di pH e cloro della piscina: valore, spillo sulla scala e verdetto
  («nella norma», «troppo basso», «troppo alto»). La lettura si aggiorna a ogni
  giro senza ridisegnare il prato, e un sensore muto è «nessuna lettura», mai
  0%.

- **Il ritardo di fine ciclo degli elettrodomestici.** (#195) La lavastoviglie
  che asciuga consuma 0 W ma il ciclo non è finito: la card diceva «spenta» a
  metà lavoro. Il campo «Ritardo fine ciclo (minuti)» nella card avanzata
  tiene l'elettrodomestico IN FUNZIONE per quei minuti dopo l'ultima potenza
  sopra soglia — una lettura di nuovo sopra soglia riparte da capo, e lo
  spegnimento esplicito (lo stato dice off, o l'interruttore viene spento)
  vince subito. Il ciclo registrato include così anche l'asciugatura.
- **La card della persona si apre.** Toccare la persona in Home apre la sua
  scheda intera: il ritratto grande con l'anello del colore di presenza, la
  zona, l'indirizzo con «Apri in mappa», e ogni dato del telefono come
  mattonella — batteria e carica, orologio, WiFi, attività, distanza con la
  direzione, tempo di rientro, ultimo aggiornamento. Finché è aperta si
  aggiorna da sola, e con più persone le frecce passano dall'una all'altra.

- **L'avatar è un personaggio in stile 3D, con corporatura, colore degli
  occhi e vestiti.** Il motore disegna come i personaggi da cartone
  renderizzati: occhi grandi con l'iride sfumata del suo colore (nuova fila
  «Colore occhi»), l'ombra della palpebra dentro il bianco, sopracciglia
  piene, il naso con la sua luce, la pelle modellata dalla luce radiale, i
  capelli con gradiente e ciocche — e il sorriso coi denti. La fila
  Corporatura (magra, normale, robusta) stringe o allarga viso e spalle. E
  con la fila «Abbigliamento» si sceglie il vestito: maglietta, camicia coi
  bottoni, felpa col cappuccio, o giacca col completo — camicia bianca e
  cravatta che prende il colore della persona.

- **L'avatar si modifica al massimo: venti tratti, e una faccia che si
  riconosce.** «Il personaggio lo vedo sempre uguale»: i tratti erano dieci e
  cambiavano poco. Adesso sono venti, raccolti in cinque gruppi che si aprono
  uno alla volta — Viso, Occhi, Capelli e barba, Naso e bocca, Corpo e
  vestiti. Le scelte nuove: **forma del viso** (ovale, tondo, squadrato, a
  cuore, affilato, lungo — è la mascella a cambiare, non solo il cranio che i
  capelli coprono), **età** (giovane, adulto, maturo: la piega naso-bocca, le
  righe sulla fronte, le zampe di gallina), **orecchie** (normali, sporgenti,
  piccole), **segni particolari** (lentiggini, neo, fossette),
  **sopracciglia** (sei forme, dall'arcuata alla corrucciata), **naso**
  (dritto, piccolo, pronunciato, largo, all'insù), **colore delle labbra**,
  **colore della barba** — che può ingrigire senza i capelli —, **copricapo**
  (berretto, cappello, bandana, fascia) e **colore del vestito**, che può
  smettere di seguire il colore della card. Occhi e bocca hanno due varianti
  in più a testa (assonnati e stretti; imbronciata e aperta) e gli occhiali
  due montature nuove (lettura e aviatore). Il disegno è più vero: l'iride ha
  il cerchio limbare e le fibre, la palpebra ha la sua piega, il naso ha
  dorso e narici, le orecchie la conca, le labbra il volume, e le due metà
  del viso sono la stessa ribaltata invece di due disegni a mano. Il tasto
  **🎲 Sorteggia una faccia** ne compone una a caso da cui partire. Le facce
  già costruite restano identiche a com'erano: ogni tratto nuovo parte dalla
  scelta che riproduce il disegno di prima.

### Corretto

- **Le pillole delle stanze parlavano un font che sulla plancia non esiste.**
  Un `<button>` non eredita il font del documento: nessuno gliel'aveva mai
  detto, e le pillole delle stanze in Temperature cadevano sul font di
  sistema — diverso su ogni telefono, e su nessuno uguale al resto della
  plancia. Adesso lo ereditano, come tutte le altre pillole della casa. E da
  schermo largo un nome lungo ha lo spazio per starci, invece di diventare
  «Camera mat…».

- **Le card delle Luci da desktop: nomi troncati e mezzo schermo di bianco.**
  «Lampadario C…», «Salone - Farett…»: la tessera era larga 258px fissi e il
  titolo stava su una riga sola, quindi il nome moriva prima di dire quale
  lampadario fosse. Adesso il titolo ha due righe e le tessere, da schermo
  largo, crescono fino a riempire la riga — con un tetto, perche' una stanza
  con una luce sola non diventi un cartellone. Il comando della stanza, che
  finiva all'altro capo dello schermo a un metro dal conteggio che lo
  riguarda, gli e' tornato accanto.

- **Auto da desktop: la foto tagliata e i tag che spingevano tutto in fondo.**
  La cornice della foto e' larga quanto lo schermo e bassa come su un
  telefono: ritagliando la foto per riempirla, di un'auto si perdevano il
  tetto e le ruote e restava una fascia di fiancata. Adesso la foto ci sta
  dentro tutta e il vuoto ai lati lo riempie una copia sfocata di se stessa —
  funziona con qualunque proporzione senza doverla sapere. E le linguette dei
  modelli, che sono nate come bersagli per il pollice, su schermo largo si
  stringono su una riga sola accanto alla marca, invece di essere una fascia
  alta che spinge il resto sotto la piega.


- **Le soglie del terreno sparivano appena salvate.** Il salvataggio
  dell'Irrigazione finisce ridisegnando la scheda: i campi dell'umidità del
  terreno venivano riletti *dopo* quel ridisegno, quindi dalle caselle appena
  ristampate col valore vecchio. Si scriveva la soglia, si premeva Salva, e la
  soglia tornava com'era senza dire niente. Adesso si leggono prima.

- **Il ritardo di fine ciclo scadeva in silenzio.** Un elettrodomestico che ha
  smesso di consumare non manda più nessun cambio di stato — è per questo che
  il ritardo esiste — e la scadenza si accorgeva di sé stessa solo al primo
  ridisegno capitato per altri motivi: la card poteva restare IN FUNZIONE per
  ore a ciclo finito. Ora la scadenza suona da sola, per la card e per la
  tessera in Home.

- **La prima configurazione non conosceva la pompa di calore.** Il tipo
  «♨️ Pompa di calore» compariva nei due editor ma non nel wizard, il cui
  elenco nasce quando il wizard si apre: chi configurava la casa la prima
  volta poteva scegliere solo condizionatore o termosifone.

- **Una lista ToDo irraggiungibile chiedeva le voci a ogni fotogramma.** Col
  collegamento giù la richiesta falliva, il fallimento faceva ridisegnare e il
  disegno richiedeva di nuovo. Dopo un errore adesso si aspetta.

- **Il tasto di accensione del clima non chiamava niente.** «Impostando
  correttamente le entità non si accendono», segnalato da un utente: la
  sezione provava tre strade per parlare a Home Assistant — `cdCallServiceJson`,
  `callService`, `hass` — e nessuna delle tre esiste nella plancia. La prima
  non è definita da nessuna parte, la seconda nemmeno, e `hass` c'è solo
  dentro il pannello: il comando cadeva nel vuoto, in silenzio, e la zona
  restava com'era. Adesso passa da `dmCallHaService`, la stessa presa delle
  luci, delle tapparelle e del robot — e chi non trova nessuno lo dice, così
  la strada di riserva parte davvero invece di credersi riuscita.

- **Un condizionatore acceso dal tab Freddo partiva a scaldare.** Senza una
  modalità da ricordare si scendeva in una scala generale che mette «heat»
  prima di «cool». L'elenco da cui si preme il tasto dice già cosa ci si
  aspetta — Freddo raffresca, Caldo scalda — e adesso vale più di una
  graduatoria scritta a tavolino. Non batte però la modalità di ieri: chi
  lasciava il condizionatore in deumidificazione lo ritrova così.


- **Col tema scuro il testo dell'editor era illeggibile.** (#206) Decine di
  regole delle sezioni leggevano le variabili del tema di Home Assistant
  (`--card-background-color`, `--secondary-background-color`, …) che dentro
  la plancia non esistono: vinceva sempre il ripiego chiaro, e col tema scuro
  il testo — che invece segue il tema — finiva chiaro su bianco. La
  fondazione del tema ora dichiara quei nomi come alias dei token della
  plancia: chiaro col chiaro, scuro con lo scuro, ovunque.

- **Il config delle auto ha una sessione, e ogni auto la sua chiave.** La
  matita apre QUELLA auto (e da lì salvare con un nome nuovo la rinomina:
  stessa chiave, stesse entità, stesso posto), «＋ Aggiungi auto» apre la
  bozza, e digitare il nome non tocca più le caselle delle entità. Il nome di
  un'altra auto non si salva — un avviso spiega di usare la matita: era il
  gesto da cui una vettura si prendeva i dati dell'altra. I tab della plancia
  mostrano il nome dato all'auto (il modello sta nel tooltip) e restano
  agganciati alla vettura anche se la lista cambia.

- **La console EVCC comanda davvero.** I pulsanti modalità e la tendina del
  target parlavano coi riferimenti interni invece che con le entità mappate:
  Home Assistant rifiutava ogni chiamata. Ora risolvono il riferimento e
  derivano il dominio dall'entità vera (un number si comanda con set_value).
  E i km al limite di carica, senza il sensore dedicato, si calcolano da
  autonomia attuale / batteria attuale × target: cambiando il target il
  numero si muove subito.

- **Il valore del mese non balla più.** In Energia · Mensile il totale Casa
  usciva prima da un ripiego (348,7) e un attimo dopo dal sensore vero
  (443,0). Nel periodo corrente l'entità di periodo configurata è l'unica
  autorità: il ripiego dal contatore totale resta per i mesi passati, e uno
  stato non ancora arrivato non dipinge un numero sporco.

- **«Rileva dal telefono» si vede.** I sensori trovati finivano nel campo
  nascosto dietro la pastiglia, che continuava a dire «Scegli entità»: ora il
  campo avvisa la pastiglia e i sei sensori compaiono davvero.

- **I tab stanza delle Temperature vestono come il resto.** La stessa pillola
  maiuscola e spaziata delle altre sezioni, non un font proprio.

- **Le card delle luci vestono meglio anche da spente.** Gradiente, angolo
  tinto, binario d'accento, la mattonella dell'icona che da accesa torna
  tonda e luminosa del colore vero, e l'interruttore a pillola al posto del
  puntino grigio.

- **Il badge version del README legge il manifest.** Era un numero scritto a
  mano fermo alla 1.0.1: ora non può più restare indietro. (La «v1.1.8» che
  HACS mostrava accanto alla release 1.1.9 era la sua cache: si aggiorna da
  sola o con «Aggiorna informazioni» sulla scheda del repository.)

## 1.1.9

### Aggiunto

- **Le luci hanno la loro sezione nella barra.** Finora si comandavano solo
  dal popup sopra la Home; adesso c'è la pagina intera, come Clima e
  Tapparelle: in alto il conto di quante sono accese e i due pulsanti
  «Accendi tutte» e «Spegni tutte», sotto le stanze nell'ordine scelto nella
  scheda Luci dell'editor, ognuna con il suo conto e il suo comando di
  gruppo. Ogni luce ha una card con il colore che sta davvero emettendo — il
  bagliore, il bordo e il LED sono i suoi, mai un ambra fisso — il dimmer
  direttamente sulla card per chi ce l'ha, e il pulsante dei controlli che
  apre la stessa scheda del popup: colore, bianco, effetti. Cosa una luce sa
  fare lo decide l'entità, mai il dominio: una lampada dietro un relè accende
  e spegne soltanto, e la card non le offre cursori che rifiuterebbe.

- **La scheda Luci del Config ha la fascia visibile/nascondi.** Lo stesso
  interruttore verde delle altre sezioni, con la stessa logica sotto: tocca e
  la voce Luci sparisce dalla barra, tocca di nuovo e torna — la preferenza
  viaggia in `cd_sections` come per tutte le altre.

- **Aggiungere una luce chiede subito la stanza.** Il form di inserimento ha
  la tendina delle stanze accanto a entità e nome: la luce nasce già al suo
  posto, senza doverla riassegnare dopo. E l'errore di un'entità sbagliata si
  scrive nel form, non in un `alert()` che l'app di Home Assistant blocca.

- **L'avatar si costruisce come i Memoji.** La casella dell'emoji nella scheda
  Persone non era «creare un avatar»: era scegliere da un elenco. Adesso c'è
  il costruttore — carnagione, taglio e colore dei capelli, occhi, bocca,
  barba, occhiali — con l'anteprima davanti e i campioncini disegnati sulla
  propria faccia: un paio di occhiali si giudica addosso, non su quella di un
  altro. La foto resta regina, l'emoji resta la via veloce, le iniziali
  l'ultima parola.

### Corretto

- **La configurazione non rimbalza più fra le plance — la foto dell'auto che
  «oscilla da sola» è questo.** Ogni plancia accesa si faceva scrittore della
  configurazione condivisa: il negozio riscrive le proprie chiavi anche senza
  gesti — all'avvio, dopo un ripristino — e quelle riscritture venivano
  scambiate per modifiche dell'utente. Una plancia rimasta aperta col runtime
  vecchio rispingeva così per sempre i suoi dati stantii, il telefono
  aggiornato li accettava e poi li ricopriva, avanti e indietro, una volta
  ogni pochi secondi. Tre regole chiudono il rimbalzo: le scritture di
  proiezione non sono gesti e non spingono niente; un salvataggio vero che
  passa dal negozio si annuncia da sé; e il **recinto di generazione** — uno
  scatto scritto da un runtime vecchio non vince più su un dispositivo
  aggiornato e configurato, finché quella plancia non viene ricaricata.
  **Dopo l'aggiornamento, ricarica (o chiudi) le altre plance aperte**: sono
  loro a rispingere i dati vecchi.

- **I flussi energetici dicono quello che succede.** Le linee dell'istantanea
  si accendevano guardando un numero alla volta: qualunque produzione solare
  accendeva «solare → casa» anche quando finiva tutta in batteria, la carica
  era sempre attribuita al solare anche di notte, e l'arco «rete → batteria»
  non esisteva proprio — di notte, con la rete che alimenta casa e ricarica
  la batteria, il disegno mostrava la batteria che alimenta casa. I quattro
  numeri ora si spartiscono insieme: il solare copre prima la carica, poi
  l'immissione, e solo il resto va verso casa; la carica non coperta dal
  solare arriva dalla rete sull'arco nuovo; la scarica va a casa. E la bolla
  della batteria dice grandezza e verso (▼ in carica, ▲ in scarica) invece
  del numero grezzo col segno.

- **Il config delle auto parla chiaro.** «＋ Salva attuale» — il bottone che
  fotografava la mappatura viva, il gesto da cui le auto si rubavano i dati a
  vicenda — sparisce dietro un flusso leggibile: **＋ Aggiungi auto** svuota
  la scheda per una vettura nuova (nome, marca, modello e tutte le entità qui
  sotto), la **matita** sulla riga apre quella auto nella scheda col suo nome,
  **💾 Salva auto** salva quella che si sta compilando. Il distintivo
  «✓ attiva» se ne va: attive lo sono tutte, quale si mostra lo decide la
  plancia. E la card «Brand e modello» smette di cambiare impaginazione da
  sola: i suoi tre proprietari dicevano tre geometrie, ora ne dicono una —
  anche appena ridisegnata, prima che l'ultima passata di stile la raggiunga.

- **«Nessuna entità EV mappata da salvare» a chi l'aveva appena mappata.** Su
  un dispositivo lento l'editor è toccabile prima che i moduli della plancia
  finiscano di caricare: un'entità digitata in quella finestra non veniva
  segnata come «scritta a mano», e al primo nome dato all'auto la protezione
  contro i dati ereditati la scambiava per un residuo e la svuotava — il
  salvataggio rispondeva che non c'era niente da salvare. Ora la protezione
  svuota solo la dote dell'auto applicata (i valori messi lì da un profilo):
  ciò che è diverso è stato scritto a mano e si tiene, comunque sia arrivato.
  Il ＋ Aggiungi auto invece svuota tutto per scelta, com'è giusto per una
  vettura che riparte da zero.

- **Tre cose che la scheda Persone sbagliava sul telefono vero.** Il campo
  dell'entità persona restava una casella nuda finché era vuoto: i domini
  `person.` e `device_tracker.` non erano nell'elenco che la guardia dei campi
  riconosce — ora il campo vuoto ha la veste (e la ricerca) di tutti gli
  altri. «🪄 Rileva dal telefono» diceva «nessun sensore riconosciuto» anche
  quando mancava solo l'entità (ora lo dice) o quando il tracker somigliava
  ai sensori senza esserne il prefisso esatto: il rilevamento prova il nome
  esatto, poi la somiglianza, e il candidato unico solo in una casa con una
  persona sola. E il picker dell'avatar apriva quello delle icone della
  plancia — prese, lampadine, pentole: per una persona servono persone, e il
  suo ha facce, gente di casa, mestieri e qualche animale.

- **Cancellare una riga non richiude più il gruppo aperto.** In ogni scheda
  del Config, ogni gesto — eliminare un sensore, aggiungere un'entità,
  toccare la fascia di visibilità — ridisegna la scheda intera, e ogni
  fisarmonica rinasceva chiusa: dentro Avvisi si apriva Aperture, si
  cancellava una riga e Aperture si richiudeva sopra la mano. Lo stato
  aperto/chiuso ora è dell'utente: viene ricordato scheda per scheda e
  riapplicato dopo ogni ridisegno, in tutte le sezioni del Config.

- **Il cestino delle luci cancella davvero.** Chiedeva conferma con il
  `confirm()` del browser, che dentro l'app di Home Assistant non si apre e
  risponde sempre no: si premeva e la riga restava lì. La domanda ora è un
  dialogo nella pagina, e cancellare toglie la luce da ogni mappa —
  configurazione, stanza, ordinamento e gruppo avvisi — non solo dalle prime
  due.

## 1.1.8

### Aggiunto

- **La card della persona racconta tutto quello che il telefono sa.** Oltre a
  zona, batteria e «da quanto tempo»: il fulmine quando il telefono è in
  carica, la batteria dell'orologio, la rete WiFi a cui è collegato. E di chi
  è fuori, il viaggio: la distanza da casa con la freccia della direzione
  (si avvicina, si allontana), il tempo di rientro da Waze o Google,
  l'indirizzo per esteso, e l'attività — l'auto, la bici, i passi — nel
  pallino di stato del ritratto, che quando la persona si muove smette di
  essere un pallino e dice come si sta muovendo. Il viaggio e l'indirizzo
  compaiono solo quando la persona è fuori: a casa sarebbero rumore.

- **I sensori del telefono si trovano da soli.** Nella scheda Persone ogni
  riga ha il gruppo «📡 Sensori del telefono» con otto caselle facoltative —
  in carica, orologio, distanza, tempo di rientro, direzione, indirizzo,
  attività, WiFi — e il pulsante «🪄 Rileva dal telefono», che le riempie
  leggendo i sensori che la Companion App pubblica accanto al device_tracker
  della persona (e riconoscendo per nome quelli di Waze e Proximity). Anche
  «Importa da Home Assistant» fa lo stesso giro: ogni persona importata
  arriva già coi sensori del suo telefono.

- **Le persone di casa, in cima alla Home.** Home Assistant sa già chi c'è e
  chi no — `person.*` cambia zona, si porta dietro la foto del profilo e spesso
  la batteria del telefono — ma la plancia non lo mostrava da nessuna parte.
  Adesso ogni persona configurata ha la sua card sotto il meteo: il ritratto
  con l'anello del colore di dove si trova, la zona (Casa, Fuori, o la zona col
  suo nome), da quanto tempo, e la batteria del telefono nell'angolo. Le card
  seguono lo stato vivo, e il «16 ore fa» invecchia da solo anche su una
  plancia a muro che nessuno tocca.

- **La scheda Persone in configurazione.** Si aggiunge una persona con la sua
  entità (`person.*`, o `device_tracker.*` per chi traccia direttamente il
  telefono) e si sceglie il ritratto in due modi: una foto vera — presa dalle
  cartelle di Home Assistant o caricata dal telefono, con lo stesso selettore
  della foto dell'auto — oppure un avatar fatto lì: un'emoji o le iniziali del
  nome, su un colore a scelta. Quando la foto c'è vince lei; togliendola
  ricompare l'avatar. Il pulsante «Importa da Home Assistant» evita di
  scrivere a mano ciò che Home Assistant sa già: prende ogni `person.*` non
  ancora in elenco, col suo nome e la sua foto del profilo. Le persone
  viaggiano con la configurazione condivisa (`cd_people`, revisione 5), quindi
  compaiono uguali su ogni dispositivo.

### Corretto

- **La plancia disegnava la foto dalle caselle del dispositivo, non dal
  profilo.** Il pannello di configurazione leggeva il profilo e mostrava le
  foto giuste; il disegno dell'eroe leggeva le due caselle piatte — che sono
  per-dispositivo e dalla 1.1.7 non viaggiano più con la configurazione — e su
  un dispositivo che non aveva rifatto la scelta dell'auto restavano quelle di
  mesi fa: «le foto le ho cambiate ma esce ancora quella vecchia», con il
  pannello a dare ragione e la plancia a dare torto. La fonte del disegno è
  adesso il profilo attivo, la stessa del pannello e del popup wallbox, e le
  caselle si riseminano a ogni disegno: derivate, mai più fonte.

- **«SALVA SEZIONE» non salvava le foto.** Il bottone verde in fondo alla
  sezione Auto raccoglie i campi entità e nient'altro: un percorso scritto
  nelle caselle delle foto restava a video con l'anteprima giusta sotto, e
  spariva alla riapertura — salvato non era mai stato. Le foto le salvava
  soltanto il tasto «Salva foto» del pannello. Un campo toccato adesso si
  salva anche dal bottone grande, che è quello che chiunque preme.

- **All'avvio la copia canonica riscriveva l'ultima modifica salvata — in
  ogni sezione.** Il documento canonico è una fotografia scritta dall'ultimo
  salvataggio del negozio e può restare indietro di un giro: ogni gesto scrive
  prima la sua chiave legacy e solo un istante dopo la copia, e chi ricaricava
  subito — il messaggio dice proprio «ricarica per applicare», e l'app del
  telefono si chiude quando vuole lei — riapriva con la copia vecchia, che
  veniva ripersistita sopra le chiavi: spariva sempre e solo l'**ultima**
  modifica, mai le precedenti. È il «Potenza rete non me lo salva, gli altri
  sì» segnalato sull'Energia, ed è la strada da cui un'auto cancellata poteva
  risorgere. La 1.1.7 aveva chiuso questa strada al ripristino della
  configurazione condivisa; adesso a ogni avvio le chiavi legacy dettano e la
  copia segue, per ogni sezione fedele (le luci restano fuori: la loro forma
  legacy perde stanza e ordinamento per costruzione).

- **Cancellata l'ultima auto, non se ne andava tutto.** Le caselle del disegno
  tenevano le sue foto e `cd_ev_car_active` il suo posto: la vettura spariva
  dall'elenco ma la sua fotografia restava sull'eroe, per sempre. L'ultima
  auto adesso porta via con sé caselle e indice; una configurazione a caselle
  sole del formato vecchio — dove le caselle sono l'unica casa della foto —
  non viene toccata.

- **Il nome sulla scheda decide di chi sono i campi.** La scheda dell'auto
  mostra le caselle `dm.ev_*` con la mappatura viva — quella dell'auto attiva
  — e salvare una scheda col nome di un'auto nuova la catturava tale e quale:
  la nuova nasceva con le entità dell'altra addosso. Scrivere un nome che non
  è di nessuno adesso svuota le caselle — l'auto nuova parte da zero, e le sue
  entità si mappano prima di salvarla — mentre il nome di un'auto esistente le
  ricarica dai dati suoi, così risalvarla non le scrive addosso la mappatura
  di quella attiva.

- **L'avviso «Tapparella aperta» era l'unico fermo del quadro.** Le icone
  degli avvisi animano per vocabolario — la porta oscilla, la batteria si
  svuota — ma il ramo delle tapparelle si muoveva solo mentre una tapparella
  era fisicamente in corsa: un avviso acceso restava immobile accanto agli
  altri che si muovevano, e sembrava un'animazione dimenticata. Da fermo il
  telo adesso si riavvolge piano verso il cassonetto, con la stessa regola in
  due dimensioni di porta e finestra; quando una tapparella si muove davvero,
  resta il movimento suo.

## 1.1.7

### Corretto

- **Un'auto nuova nasceva con la foto di quella attiva.** Il runtime battezza
  la scheda appena salvata con le due caselle da cui la plancia disegna — che
  in quel momento portano le foto dell'auto *attiva* — e nessuna protezione
  poteva accorgersene: un'auto che prima non c'era non ha un «prima» da
  ripristinare. Con una vettura già configurata, la seconda nasceva con la
  foto della prima addosso, ed è il seme da cui le foto «si mescolavano da
  sole» a ogni giro successivo. Un'auto nuova adesso nasce senza foto: le sue
  si scelgono dal pannello, che dichiara a chi sta scrivendo.

- **Il pannello foto leggeva le caselle del disegno, non il profilo.** Le due
  caselle piatte seguono l'auto attiva con un giro di ritardo: subito dopo un
  salvataggio o una cancellazione portano ancora le foto della vettura di
  prima, e il pannello che le mostrava — e le risalvava — era il ponte con cui
  la foto di un'auto finiva sull'altra, col titolo giusto a fare da alibi. La
  fonte ora è il profilo attivo; dopo «salva scheda» e dopo una cancellazione
  le caselle si riseminano subito dalla vettura che la plancia mostra; e con
  l'auto attiva appena cancellata non si salva più niente sulla prima della
  lista.

- **La lista delle auto viaggiava due volte, e la seconda copia vinceva in
  silenzio.** `cd_ev_cars` e la copia dentro lo stato canonico arrivano
  entrambe dalla configurazione condivisa, ma al ripristino venivano
  riconciliate solo le stanze: due righe dopo aver scritto la lista, il
  negozio la ripersisteva dalla copia canonica — che quando divergeva riportava
  le foto vecchie. È «c'è qualche sezione che sovrascrive», alla lettera. La
  copia canonica ora si allinea alla lista prima che chiunque la ripersista, e
  la Personalizzazione legge le auto nello stesso ordine di precedenza della
  sezione EV invece che al contrario.

- **Le caselle della finestra accettano anche uno switch.** Molte tapparelle
  vere sono comandate da un relè: l'entità è `switch.*`, on la apre, off la
  chiude, e una posizione non esiste. La casella lo accetta, la card lo disegna
  nella lingua delle coperture — aperta, chiusa — e i bottoni gli parlano nella
  sua: apri è `turn_on`, chiudi è `turn_off`, e lo stop per un relè non parte
  proprio. Il cursore di posizione non c'è, perché non c'è una posizione.

- **La stessa entità in tre caselle salvava in silenzio, e usciva un cursore
  solo.** La pagina accorpa apposta i duplicati — la stessa tapparella scritta
  tre volte è una copertura, non tre — ma il modale lasciava salvare senza dire
  niente, e chi provava «i 3 cursori» ripetendo l'unica cover che ha si trovava
  una card sola senza spiegazione. Adesso il salvataggio si ferma e lo dice:
  per più cursori sulla stessa finestra servono entità cover diverse.

- **Il tema scuro non aveva mai posseduto il fondo.** «Scuro» scuriva le card
  una per una, ma le variabili di base — il fondo della pagina, i testi, i
  bordi — non avevano una versione notturna: card scure su pagina bianca, come
  negli screenshot. E nella cornice dell'app il fondo leggeva una variabile del
  tema di Home Assistant che dentro la plancia non esiste, quindi vinceva
  sempre il ripiego chiaro. Le variabili hanno ora la loro versione scura — 
  tutto ciò che già le legge si scurisce da solo — e il fondo della cornice
  segue il tema della plancia. Il tema chiaro non cambia di una virgola.

## 1.1.6

### Corretto

- **La foto dell'auto risorgeva da sola, ancora.** Il profilo normalizzato nel
  negozio canonico porta anche `image` e `image_url`, e componendo
  `img || image` una foto svuotata apposta tornava in vita dall'alias rimasto
  pieno al giro prima: a ogni risalvataggio della sezione la foto vecchia si
  ripiazzava sull'auto sbagliata, qualunque cosa si facesse dal pannello. Era
  «c'è qualche sezione che sovrascrive», alla lettera. Adesso `img` comanda,
  anche vuota, e gli alias la seguono invece di farle da memoria ombra.

- **Il pannello foto dice a quale auto sta scrivendo.** Le foto caricate in
  configurazione finiscono sull'auto attiva, che non è per forza quella che si
  sta guardando: chi apriva il pannello con l'altra vettura attiva se le
  ritrovava sull'auto sbagliata, senza che niente lo dicesse. Il titolo ora
  porta il nome dell'auto di destinazione e segue il cambio in tempo reale. Salvare
  le foto di un'auto riguarda quell'auto e basta: l'altra non si tocca mai, e
  una bozza scritta e non salvata si scarta quando l'auto di destinazione
  cambia.

- **«Dal dispositivo» rispondeva Caricamento non riuscito (HTTP 401).** La
  plancia servita dall'integrazione non possiede nessun token: il suo
  WebSocket si autentica lato server, e la chiamata REST all'archivio immagini
  di Home Assistant non poteva che essere rifiutata. La foto viaggia adesso
  sullo stesso WebSocket dell'integrazione — l'unico canale davvero
  autenticato — e il backend la scrive sotto `config/www/dashboardmodern`,
  rispondendo con un `/local/...` come quelli scritti a mano. Nomi sanificati,
  solo immagini, tetto a 10 MB, e un nome già preso si numera invece di
  sovrascrivere. Il vecchio archivio REST resta come ripiego per chi un token
  vero ce l'ha.

- **Le tapparelle erano rimaste senza animazioni da desktop.** Stessa causa
  degli elettrodomestici: «riduci il movimento» del sistema operativo spegneva
  anche il telo che scende e il rullo che gira, che sono lo stato della
  finestra, non un ornamento. Restano fermi solo i fregi: il sollevamento della
  card e le transizioni dei bottoni.

- **Una finestra con tre coperture usciva come tre card.** E sotto la foto
  della finestra il cursore era sempre uno. Adesso una riga di configurazione è
  una card sola: la finestra disegna tutti i teli insieme — tapparella,
  tenda, tenda da sole — e sotto ci sono i cursori, uno per copertura, ognuno
  con la sua etichetta, la sua percentuale e il suo comando. I bottoni
  apri/ferma/chiudi della card muovono l'infisso intero.

## 1.1.5

### Corretto

- **Una finestra con la sola tenda non si poteva aggiungere.** La scheda dice
  «su una finestra ci stanno tutte e tre: compila le caselle che hai», e poi
  premendo «Aggiungi tapparella» usciva «Inserisci una entità cover valida»: il
  runtime guarda la sua casella, quella della tapparella, e di tenda e tenda da
  sole non sa niente. La riga la scriveva comunque il giro successivo, quindi si
  finiva con un errore in faccia _e_ la riga creata lo stesso — il modo peggiore
  di dire che ha funzionato. Lo stesso rifiuto arrivava dalla finestra della
  matita, che pretendeva la casella della tapparella per salvare.

- **Il riquadro diceva «1 chiusa» e la card accanto «Aperta».** Sulla stessa
  tapparella, con la finestra disegnata tutta coperta. Il conteggio e il disegno
  partono dalla posizione, la pastiglia diceva invece lo stato che manda Home
  Assistant — e certe coperture restano su «aperta» anche a zero per cento.
  Dove una posizione c'è, comanda lei: è quella che si sta guardando.

- **Una marca fuori dal catalogo prendeva il marchio di un'altra casa.** Il
  ripiego era Leapmotor: chi scriveva una marca che il catalogo non conosce si
  ritrovava addosso quel logo, senza che niente glielo dicesse. Non è un
  dettaglio estetico — è la plancia che afferma una cosa falsa sulla macchina di
  qualcuno. Adesso, quando non sa, mostra le iniziali di quello che è stato
  scritto.

- **Il quadratino dell'icona nel Report tornava a vestirsi da solo.** Il filo
  chiaro del tema glielo dava una regola generale, mentre quel bottone è già
  governato da una regola più forte che il bordo non lo nominava: bastava un
  ordine di caricamento diverso perché tornasse quello di serie del browser.
  Adesso il vestito è scritto dove il bottone è già descritto.

- **Le icone del Report non erano dello stesso catalogo delle altre.** Accanto a
  ogni voce c'era la faccina scritta nel campo, mentre le schede degli
  elettrodomestici — e il Report stesso sulla plancia — usano da sempre i disegni
  stilizzati del catalogo. Nella stessa schermata convivevano due stili. Adesso
  il quadratino porta lo stesso disegno della scheda, deciso dalla stessa
  funzione, che quando non riconosce l'apparecchio risponde «generico» invece di
  non rispondere: così sono disegnate allo stesso modo anche le voci fuori
  catalogo. Il disegno restava però solo un istante, perché il decoratore
  generale dei selettori d'icona ripassava subito dopo e rimetteva la faccina:
  due padroni sullo stesso pixel, e vinceva l'ultimo. Adesso una casella può
  dichiarare di avere già un padrone, e il decoratore la lascia stare.

- **La foto dell'auto cambiava da sola, restando sulla stessa vettura.** Il
  cavo è attaccato, l'auto è in ricarica, e la fotografia torna comunque a
  quella di riposo per poi ricambiare un istante dopo — senza che nessuno
  tocchi niente. Un wallbox vero perde la connessione un istante durante una
  riconnessione WiFi, cosa che capita più volte al minuto, e in quella
  finestra il sensore riporta "unavailable": veniva letto come "cavo
  staccato" tanto quanto un wallbox davvero spento. Adesso quel silenzio non
  decide niente, e resta il verdetto di prima.

- **Con due auto configurate, la foto di una finiva sull'altra — e viceversa.**
  Rimappare l'entità di un'auto ferma, mentre l'altra era quella in mostra
  sulla plancia, faceva scivolare la foto dell'auto in mostra dentro al
  profilo di quella che si stava modificando: il runtime cattura le due foto
  dalle stesse due caselle che seguono l'auto attiva, e la configurazione
  lascia modificare un'auto diversa senza prima averla resa attiva. Adesso si
  tiene conto di chi era davvero attiva prima del salvataggio: un'auto
  risalvata mentre non era lei in mostra tiene le sue foto, non quelle
  dell'altra.

- **Da desktop le animazioni di elettrodomestici e avvisi non si vedevano.**
  Tre rami CSS rispettavano «riduci il movimento» del sistema operativo
  spegnendo tutto — il cestello che gira, il vapore, il led, la goccia
  dell'allagamento. Su molti desktop Windows quell'impostazione è attiva senza
  che nessuno l'abbia mai scelta, e Chrome la passa alle pagine: gli
  elettrodomestici in funzione sembravano fermi, e gli avvisi pure. Ma questi
  movimenti sono informazione, non decorazione — dicono che la macchina sta
  lavorando adesso, che l'acqua sta gocciolando adesso — e adesso restano
  accesi. Le transizioni puramente decorative continuano a rispettare
  l'impostazione.

- **Due sensori di potenza, uno per verso (#184).** Chi ha prelievo e
  immissione — o carica e scarica — come due sensori separati, sempre
  positivi, non aveva dove mettere il secondo: la casella della potenza è una,
  e nel riquadro del verso opposto c'era soltanto il rimando «è una sola, si
  imposta in…», che sembrava la spunta della sorgente unica ancora accesa. Il
  secondo sensore adesso si dichiara lì — «Potenza immessa» per la rete,
  «Potenza scaricata» per la batteria — e il numero col segno si ricava da
  solo: prelievo meno immissione, scarica meno carica. Con la sorgente unica
  con segno dichiarata le due caselle si spengono, perché sono due modi di
  dire la stessa cosa. E togliere quella spunta riaccende le caselle dei due
  versi, che era l'altra metà della segnalazione.

## 1.1.4

### Corretto

- **Dopo aver salvato una sezione non compariva più «Modifica»**, e le tre
  caselle in più di un infisso — tenda, tenda da sole, sensore dell'apertura —
  sparivano insieme a lei. La matita e le caselle le aggiungiamo noi dopo che il
  runtime ha stampato la scheda, e ci si agganciava al cambio di linguetta. Ma
  il corpo della configurazione lo rifà anche il modello, a ogni salvataggio, e
  quel giro non passa di lì: restava la riga col solo cestino, senza modo di
  riaprirla, e per rivedere le caselle bisognava uscire dalla linguetta e
  rientrarci.

- **Una tenda salvata non compariva sulla pagina.** È la stessa cosa vista da
  un'altra parte: la sua casella spariva _prima_ che si premesse «Aggiungi
  tapparella», quindi quell'entità non veniva proprio salvata — e una card che
  non esiste non si può disegnare, né aperta né chiusa.

- **Con due auto configurate compariva la foto dell'altra vettura.** Le due
  caselle da cui il disegno legge la foto viaggiavano nella configurazione
  condivisa, ma non sono una configurazione: sono il disegno di adesso,
  ricavato dall'auto scelta su _questo_ dispositivo. Si apriva la plancia,
  compariva la foto giusta, e un istante dopo arrivava il salvataggio con dentro
  la foto dell'auto attiva altrove. Adesso ogni auto si porta le sue dentro
  `cd_ev_cars`, dove stanno già il nome e le entità.

- **Risalvare un profilo auto lo svuotava.** «Salva attuale» cerca un profilo
  con lo stesso nome e ci scrive sopra un oggetto nuovo: marca, modello e foto
  col cavo attaccato se ne andavano senza che nessuno l'avesse chiesto, e chi
  rimappava un'entità si ritrovava l'auto senza logo.

- **Aspirapolvere: la fascia della visibilità non cambiava scritta.** Toccandola
  la preferenza cambiava davvero — la voce spariva dalla barra — ma la fascia
  restava verde: la scheda si ridisegna solo quando la sua firma è cambiata, e
  la firma diceva soltanto quali robot fossero configurati.

- **Le icone della configurazione avevano il bordo di serie del browser.** Al
  quadratino dell'icona si diceva quanto grande e quanto arrotondato, mai di che
  colore: restava `2px outset` nero su un grigio che non è di nessun tema,
  mentre i pulsanti accanto — nella stessa riga del Report — hanno il filo
  chiaro del tema. Adesso porta il vestito del riquadro grande che già esisteva,
  in piccolo, e anche nella versione scura.

### Modificato

- **Un avviso solo per «la scheda è nuova, rimetti la tua roba».** Il ridisegno
  della configurazione si annunciava già, ma quasi nessuno ascoltava:
  `onEditorRedraw` mette insieme il cambio di linguetta e il ridisegno del
  modello, e i quattordici moduli che decorano la configurazione passano tutti
  di lì. Una prova guarda tutte le sezioni senza conoscerne nessuna: chi si
  aggancia ancora al solo cambio di linguetta viene trovato, anche se arriva
  domani.

- **Un'auto ha un'identità, non solo una posizione.** Un profilo si indicava con
  la sua riga nell'elenco, e una riga cambia significato appena si cancella o si
  riordina una vettura. `src/core/vehicle-identity.js` dice cosa appartiene a
  un'auto — marca, modello, icona, foto col cavo — e come si riconosce quando
  l'elenco viene riscritto, che è il momento in cui le cose si perdono. Quale
  auto è scelta continua a dirlo la riga, come ha sempre fatto.

- Il travaso delle foto dalle vecchie caselle dentro al profilo è una migrazione
  e adesso se ne segna: potendo ripartire, annullava una cancellazione fatta su
  un altro dispositivo.

### Sviluppo

- **La costruzione delle informazioni di versione non partiva da un worktree.**
  `generate_build_info.py` cercava il ramo solo nella cartella che ha davanti,
  ma in un worktree i rami stanno nel deposito condiviso: si fermava su «unable
  to resolve git ref» pur essendo su un ramo perfettamente valido. Adesso segue
  `commondir`.

## 1.1.3

### Aggiunto

- **Gli allagamenti, accanto agli altri avvisi.** Il Quadro Avvisi sorvegliava
  cinque liste, e chi ha un sensore di allagamento sotto il lavello non aveva
  dove metterlo: restava un avviso «personalizzato», con l'icona da scegliere a
  mano e fuori dal conteggio. Adesso è una lista come le altre — la sua card col
  contatore, il suo popup con l'elenco di cosa è bagnato, la sua voce in
  configurazione. Il primo avvio si serve da solo dai `binary_sensor` che Home
  Assistant dichiara `device_class: moisture`; chi non li vuole li toglie, e la
  rimozione resta.

### Corretto

- **«Inserisco il prelievo dalla rete e mi modifica anche l'immissione».** Rete
  e batteria si configurano in due riquadri, uno per verso, e la casella
  «Potenza» compariva in tutti e due. Ma il modello ne ha una sola — la potenza
  scambiata con la rete, col segno a dire da che parte va — quindi le due
  caselle erano la stessa casella disegnata due volte. Adesso ogni campo del
  modello ha una casella sola, e il secondo riquadro dice dov'è andata invece di
  ripeterla.

- **Scegliendo «i positivi sono la carica» la sezione si richiudeva all'infinito
  e il verso tornava indietro.** La scheda mette il verso prima delle caselle
  del sensore, quindi lo si sceglie quando di entità non ce n'è ancora nessuna;
  il salvataggio filtrava via quella scelta, si ritrovava zero entità e
  cancellava l'intera dichiarazione. Con «scarica» succedeva lo stesso senza
  vedersi, perché si riazzerava su un valore identico a quello scelto.

- **Le tre caselle di un infisso finivano sotto «Salva sezione»**, staccate
  dalla riga che stanno descrivendo: ci si ancorava alla stanza, che nel markup
  del runtime è un `select` nudo, e la ricerca del contenitore acchiappava il
  riquadro che avvolge tutto il pannello.

- **Cambiando auto restava addosso la foto col cavo dell'altra vettura.** Gli
  involucri che insegnano alla plancia la seconda foto non possono installarsi
  finché il runtime non ha dichiarato le sue funzioni, e il tentativo successivo
  arrivava col primo disegno: in quella finestra un profilo catturato nasceva
  senza quella foto, e chi ci finiva dentro non la recuperava più da sé. Dura
  poco e ci vuole sfortuna per infilarcisi, ma quello che si perdeva era perso.

- **Il bianco su iOS non era finito con la 1.1.2.** Quello che il modo chiosco
  scrive nel documento di Home Assistant lo toglieva la plancia, chiamata
  attraverso la sua cornice. Ma lo smontaggio parte _dopo_ che la cornice è già
  stata staccata: Chrome rimanda quella distruzione e la chiamata fa in tempo,
  WebKit la fa subito e la chiamata non arrivava a nessuno. Adesso ogni elemento
  toccato porta scritto addosso com'era prima, e chi smonta rimette a posto
  leggendo il documento che ha davanti.

### Sicurezza

- **Chi può usare una plancia lo decide il server, non il browser.** I comandi
  che leggono e scrivono la configurazione condivisa erano aperti a qualsiasi
  utente autenticato: la lista degli utenti abilitati viaggia dentro la
  configurazione del pannello e la applica il browser, quindi un utente fuori
  dalla lista non vedeva la plancia nella barra laterale ma poteva chiamare quei
  comandi direttamente e riscrivere la configurazione di tutti — che è una sola
  per l'installazione. In una casa con un utente solo non cambia niente; con più
  utenti è la differenza fra una preferenza e un permesso. Una plancia che il
  proprietario non ha ristretto resta aperta a tutta la casa, e un utente
  abilitato non amministratore può ancora salvare.

## 1.1.2

### Corretto

- **Cambiando la barra da fissa a scomparsa diventava tutto bianco**, plancia e
  Home Assistant insieme, e per tornare a posto bisognava chiudere e riaprire
  l'app. Il velo che manda la plancia a tutto schermo, per togliersi, rimetteva
  gli stili in linea del documento «com'erano prima» — tutti insieme. Ma Home
  Assistant il suo tema lo tiene esattamente li', come stili in linea, e se li
  ritrovava cancellati senza potersene accorgere: per lui il tema era ancora
  applicato, quindi non lo riscriveva. Adesso il velo rimette soltanto quello
  che ha scritto lui, e il tema di chiunque altro non lo tocca.

- **La fascia «sezione visibile / nascosta» non cambiava scritta.** La
  preferenza cambiava davvero, ma per vederlo bisognava cambiare scheda: il
  testo si scriveva una volta sola, quando la fascia nasceva.

- **La foto dell'auto cambiava da sola aggiornando la pagina**, e usciva quella
  dell'altra vettura o l'immagine generica. Le caselle da cui la plancia legge
  la foto si riempivano soltanto quando si toccava un'auto; a un ricaricamento
  nessuno la tocca, e restava dentro l'ultimo valore finitoci. Adesso all'avvio
  seguono l'auto scelta. Con una macchina sola non cambia niente.

### Cambiato

- **Un infisso, quattro caselle.** Sulla stessa finestra ci stanno insieme la
  tapparella, la tenda e la tenda da sole, e la configurazione ne chiedeva una
  sola piu' un menu per dire di che tipo fosse: chi le aveva tutte non poteva
  dirlo. Adesso c'e' una casella per funzione — tapparella, tenda, tenda da
  sole, sensore apertura infisso — e il menu del tipo non serve piu', perche' il
  tipo lo dice la casella in cui hai scritto. Quello che era gia' configurato
  continua a funzionare com'era.

## 1.1.1

### Aggiunto

- **La plancia parla quindici lingue.** Oltre a italiano e inglese sono
  tradotte per intero spagnolo, francese, tedesco, portoghese, olandese,
  polacco, russo, turco, arabo, hindi, giapponese, coreano e cinese
  semplificato: 1102 stringhe per lingua, cioè tutto il vocabolario visibile
  della plancia, editor e testi di aiuto compresi.
- **Nessuna configurazione.** La lingua è quella del profilo Home Assistant di
  chi apre la plancia, quindi due persone della stessa casa vedono ognuna la
  propria. Le varianti regionali si risolvono da sole (`pt-BR` legge il
  portoghese, `zh-TW` il cinese tradizionale), e `?lang=` forza una lingua su un
  singolo dispositivo, come il tema.
- **L'arabo è da destra a sinistra** dal primo disegno: direzione e lingua
  vengono scritte sul documento prima che venga letto, non corrette dopo.
- **Le lingue dell'integrazione**: anche le finestre di configurazione e opzioni
  di Home Assistant sono tradotte, non solo la plancia.

### Modificato

- **La lingua non è più una biforcazione.** `t(it, en)` mantiene la stessa forma
  a tutti i punti di chiamata, ma l'inglese è ora la chiave di ricerca nel
  catalogo della lingua attiva. Una stringa senza traduzione ripiega
  sull'inglese, mai sull'italiano: prima un utente francese leggeva italiano.
- **Si scarica una lingua sola.** Il catalogo attivo viene richiesto a runtime,
  quindi quindici lingue pesano quanto una.
- Numeri e date seguono la lingua attiva invece di essere fissati a `it-IT` o
  `en-GB`.

### Corretto

- **Il tipo di una copertura si leggeva in italiano in tutte le lingue.**
  Tapparella, tenda e tenda da sole passavano da un «inglese si'/no»: chi non
  era inglese leggeva l'italiano nel menu a tendina di quella scelta.
- **Un'ottantina di stringhe non entravano in nessun catalogo.** Le didascalie
  dei campi dell'editor, i nomi dei colori delle luci, i sottotitoli delle
  pagine, le sonde della piscina e i totali dell'Energia vivono in tabelle
  invece che ai punti di chiamata, e chi raccoglie il vocabolario dal sorgente
  non le vedeva. Ora le legge, e una prova nuova impedisce che una tabella
  aggiunta domani torni a sparire in silenzio.

- **Le cartelle non si aprivano piu', dentro Home Assistant.** La finestra
  «Scegli la foto» rispondeva «Message type not permitted through the bridge» e
  restava vuota. Il ponte fra la plancia e Home Assistant lascia passare un
  elenco fisso di messaggi, e i tre che servono a sfogliare non c'erano: aperta
  da sola la pagina funzionava, dentro il pannello no.

- **La stessa finestra era anche impaginata male**, con una fascia bianca in
  mezzo e i pulsanti schiacciati in fondo: aveva una sezione di troppo rispetto
  a come sono fatte le altre finestre della configurazione.

- **Config non era piu' l'ultima voce della barra.** Chi aveva sistemato
  l'ordine prima che esistesse l'Aspirapolvere se la ritrovava dopo Config.
  Adesso Config resta in fondo comunque, senza toccare il resto dell'ordine.

- **L'interruttore della sezione Aspirapolvere non nascondeva niente.** La
  fascia verde su quella scheda scriveva una preferenza che nessuno leggeva.

- **Negli Avvisi il campo si chiamava «binary_sensor.finestra_x_contact».** Era
  l'esempio, usato per sbaglio come nome del campo. Cinque campi in giro per la
  configurazione avevano lo stesso problema e adesso dicono cosa vogliono.

- **Nel Report «Modifica» finiva tagliato dal bordo dello schermo.** Il pulsante
  era tenuto in un quadrato pensato per quando c'era solo la matita, senza
  parole accanto.

- **L'icona dell'integrazione, per i temi scuri.** Il file `dark_icon@2x.png`
  era corrotto da mesi: l'ultimo quinto dell'immagine era illeggibile. Da Home
  Assistant 2026.3 e' proprio quel file che il pannello chiede quando il tema e'
  scuro e lo schermo e' ad alta densita', e lo prende da dentro l'integrazione
  installata. Ricostruito, e adesso una prova impedisce che ne rientri uno rotto.

- **Nello zip partono tutte e sei le immagini del marchio**, non piu' la sola
  `icon.png`. Da HA 2026.3 Home Assistant serve l'icona dell'integrazione dalla
  cartella `brand/` che trova sul disco, prima di chiedere al catalogo: quelle
  che non partono non ci sono.

- **Un nome solo.** L'integrazione si chiamava «Dashboard Modern V2» in Home
  Assistant e «DashboardModern v2» in HACS e nel codice. Adesso e'
  «DashboardModern v2» dappertutto.

### Cambiato

- **Con piu' di una piscina si sceglie la vasca dalle schede in alto**, invece
  di scorrere una pagina sotto l'altra. Con una piscina sola non cambia niente.

- **Il tipo di una tapparella si dichiara anche dalla sua scheda.** Tapparella,
  tenda o tenda da sole: prima quella scelta esisteva solo nella finestra della
  matita, e chi aggiungeva una tenda dalla scheda Tapparelle non aveva modo di
  dirlo.

### Documentazione

- [`docs/TRANSLATIONS.md`](docs/TRANSLATIONS.md): come funziona il sistema e
  cosa serve per aggiungere una lingua.

## 1.1.0

### Aggiunto

- **Sezione nuova: robot aspirapolvere, con la mappa.** Pagina propria e voce
  nella barra: stato, batteria, potenza di aspirazione e i comandi che il robot
  dichiara di avere — avvio, pausa, stop, rientro alla base, «trovalo», pulizia
  localizzata. La mappa arriva dalla telecamera o dall'immagine che il robot
  pubblica, e se non riesce a caricarla ci riprova invece di restare vuota per
  sempre. Si configura come le altre sezioni.

- **Piu' di una piscina.** Prima ne stava una sola. Adesso se ne aggiungono
  quante servono, ognuna con i suoi comandi e la sua filtrazione; la prima resta
  dov'era, quindi chi ne ha una non deve rifare niente.

- **Le tende, accanto alle tapparelle.** Riconosciute da come Home Assistant le
  classifica: `shutter` resta tapparella, `blind`, `curtain` e `shade`
  diventano tenda, `awning` tenda da sole. Ognuna si apre e si chiude col suo
  disegno, che una tenda non scorre come una tapparella.

- **La foto dell'auto si sfoglia, non si scrive.** Si aprono le cartelle di Home
  Assistant, comprese quelle in `/config/www` (`/local`), e si sceglie il file;
  oppure si carica una foto dal telefono. Il percorso a mano continua a
  funzionare per chi lo preferisce.

- **Energia: una sola entita' con segno.** Chi ha un sensore che passa da
  positivo a negativo — prelievo e immissione in rete, carica e scarica della
  batteria — lo dichiara una volta e la plancia ricava i due versi dal segno,
  invece di chiedere due entita' separate. Chi le ha gia' divise coi template
  continua come prima.

- **Una porta sempre aperta per la configurazione.** Un ingranaggio fisso
  nell'intestazione, sempre in vista. Prima, chiuso il banner iniziale, l'unica
  via era la voce nella barra: chi non la trovava si ritrovava senza modo di
  rientrare.

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

- **La barra parte ferma, e la scelta vale su tutti i dispositivi.** Prima
  partiva a scomparsa dappertutto e il modo scelto restava sul dispositivo che
  l'aveva scelto. Sul computer le due cose insieme chiudevano la porta a chiave:
  la barra a riposo sta fuori dallo schermo e si chiama avvicinando il mouse al
  fondo, ma il comando per tenerla ferma sta nella pagina Config, e a quella
  pagina ci si arriva dalla barra. Adesso c'e' senza doverla chiamare, e chi
  preferisce il dock a scomparsa lo sceglie una volta sola: la scelta viaggia con
  la configurazione e vale anche sugli altri dispositivi.

- **Il chiosco si accende da solo anche su Android.** Era nato guardando
  l'iPhone e chiedeva iOS: dentro l'app di Home Assistant per Android nessuno
  puo' scrivere `?kiosk=1` a mano, e la plancia si apriva sotto la barra di
  Lovelace. Adesso conta il dito, non la marca; la finestra stretta di un
  computer, che la barra degli indirizzi ce l'ha, resta fuori.

- **Le lingue che non parliamo prendono l'inglese.** `it` e `it-*` restano in
  italiano, tutto il resto apre in inglese invece di ripiegare sull'italiano.

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
