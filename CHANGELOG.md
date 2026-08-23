<!-- DM-FIX-20260812B -->

# Changelog

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e le
versioni seguono [Semantic Versioning](https://semver.org/lang/it/).

## Non rilasciato

## 1.1.9

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
  sola: i suoi tre proprietari dicevano tre geometrie, ora ne dicono una.

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
