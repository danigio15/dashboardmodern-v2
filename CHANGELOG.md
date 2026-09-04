<!-- DM-FIX-20260812B -->

# Changelog

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e le
versioni seguono [Semantic Versioning](https://semver.org/lang/it/).

## 1.4.7

Le cose viste sul campo dopo la 1.4.6, e i comandi del robot che lava. La
sezione Energia che restava su «Caricamento dati Energia…» dentro il pannello
di Home Assistant, lo storico di un mese che diceva «Nessuno storico
disponibile», la soglia di chiusura che ora e' di ogni finestra, la pagina che
spiega il progetto prima del tasto PayPal, il radar leggibile, i sensori dei
rifiuti letti come li scrivono le integrazioni, i seguiti di #292, #286 e
#281, l'inferriata che si modifica, le grate grigie, i modelli di auto a
benzina e i tasti del robot lavapavimenti (#306).

### Aggiunto

- **I comandi a parte del robot (#306).**

      «Le varie entita' del robot continuano a non essere visibili. Da solo
       la modalita' aspirazione. Comandi mancanti:
       button.roborock_qrevo_edge_series_asp_e_lav, …_pulizia_completa,
       …_solo_aspirazione, …_solo_lavaggio.»

  Un robot che lava non e' solo un `vacuum`: l'integrazione pubblica accanto
  a lui i suoi programmi come tasti, le sue regolazioni — il mocio, l'acqua —
  come tendine, le sue funzioni come interruttori. Nella scheda Robot della
  configurazione c'e' «Altri comandi del robot»: quelli trovati accanto al
  robot si propongono da soli e un tocco li aggiunge, qualunque altro si cerca
  con la lente (button, select, switch, e input_*, script, scene). Sulla
  scheda del robot i tasti stanno sotto i comandi di sempre, le tendine
  accanto all'aspirazione, e ognuno chiama il servizio che e' suo: press,
  select_option, toggle.

- **Le auto a benzina hanno il loro modello.** «Se seleziono Jeep mi da' solo
  veicoli ibridi ed elettrici.» Il catalogo dei modelli ha, per ogni marca,
  anche le famiglie a benzina, diesel e GPL; la tendina le mostra in un gruppo
  a parte e mette in cima il gruppo del motore che la vettura dichiara.

- **La soglia di chiusura e' di ogni finestra.** «Ognuno puo' avere una
  percentuale differente.» La casella «Chiusa sotto il (%)» sta nella riga
  della finestra, sia quando nasce sia in modifica; vuota, vale quella di casa
  in cima alla scheda, che resta il valore di serie.

- **«Sostieni il progetto» spiega prima di chiedere.** La pastiglia e la
  tessera aprono una finestra che dice cosa e' il progetto e come si fa, e
  solo in fondo c'e' il tasto che porta su PayPal, in una scheda nuova.

- **Il radar ha una legenda.** Pioggia leggera → forte, e «dove non c'e'
  colore non piove».

- **Gli elettrodomestici si prendono da un'integrazione, interi.**

      «La sezione elettrodomestici la possiamo rivedere e far in modo che
       le persone possano integrare i loro elettrodomestici sfruttando le
       integrazioni? Non solo switch on/off ma proprio le integrazioni, sia
       ufficiali che presenti su HACS, creando un menu. Io ho la lavatrice
       Hoover con hOn e mi espone tutti i dati: dalla sezione voglio prendere
       tutte le integrazioni, cosi' ogni elettrodomestico avra' tutte le sue
       informazioni.»

  In cima alla scheda Elettrodomestici, «🔗 Aggiungi da un'integrazione» apre
  una finestra a due colonne: a sinistra le integrazioni installate col segno
  Ufficiale o HACS / personalizzata, a destra i loro dispositivi con marca,
  modello, stanza e quante entita' portano. Alla conferma l'apparecchio nasce
  gia' compilato — tipo dal catalogo, stanza dall'area di Home Assistant,
  potenza, tempo rimanente, fase, contatore, tasto d'avvio e allarme
  assegnati. Le entita' si riconoscono da id, nome e chiave di traduzione,
  cosi' hOn si capisce in qualunque lingua sia Home Assistant, e le caselle
  scritte a mano non si toccano mai.

  Un apparecchio puo' essere due dispositivi: quando quello scelto non ha un
  contatore, il menu cerca fra le entita' che portano il suo nome — la presa
  smart sotto la macchina — e le propone con una spunta accesa. Il comando no,
  mai: pescare un interruttore per somiglianza di nome vuol dire prima o poi
  accendere l'apparecchio sbagliato.

- **La card dice cosa sta facendo, e senza sensore di potenza lo capisce dal
  programma.** Sotto il ritratto, la fase del ciclo in parole — Lavaggio,
  Risciacquo, Centrifuga, Asciugatura, Pesatura — e accanto i gradi, i giri e
  il programma, dalle parole che le integrazioni pubblicano davvero
  (`washing`, `spin`, `weighting`), tradotte in tutte le lingue della plancia.
  Per lo stato, tre gruppi di parole: chi lavora, chi aspetta — pausa, avvio
  ritardato, programmata — che e' STANDBY e non SPENTO, e chi e' ferma. Una
  parola che nessun gruppo conosce lascia parlare i watt, come prima. Un
  apparecchio su una presa smart non ha niente da raccontare e la sua card
  resta quella di prima.

- **La finestra del dettaglio apre con la stessa card della sezione**, e sotto
  tutto il resto del dispositivo diviso per famiglie: lo stato, le letture, i
  comandi coi loro tasti veri — interruttori, menu dei programmi, numeri,
  pulsanti — e in fondo la diagnostica, chiusa. Quello che la card dice gia'
  non si ripete. La finestra della tessera in Home porta una pastiglia per
  ogni apparecchio, acceso o spento, nel suo ordine; toccandone una si apre la
  sua card intera, una alla volta.

### Corretto

- **La pagina Mini PC sfarfallava, e la plancia scaldava il mini PC.**

      «Nella sezione Mini PC c'e' un continuo sfarfallio. Quando e' avviata
       la dashboard il processore del mini PC schizza di utilizzo e sale la
       temperatura.»

  Due padroni sulla stessa pastiglia: a ogni evento di stato il guscio
  scriveva OFFLINE sulla casella della rete non compilata, e la lettura
  onesta arrivata con la 1.4.5 la correggeva in NON CONFIGURATO un
  fotogramma dopo — due parole alternate, dipinte tutte e due. La
  correzione ora parte nello stesso giro del guscio, prima che il browser
  dipinga. Nello stesso passaggio si e' misurato tutto quello che gira da
  solo, e si e' alleggerito quello che costava senza dare niente: il
  ricalcolo dei periodi dell'Energia — cinque domande al Recorder, una
  sull'anno intero — non piu' ogni quindici secondi ma al piu' una volta al
  minuto (le statistiche di Home Assistant si compilano ogni cinque); la
  scansione della pagina Temperature solo quando e' a schermo e un giro per
  fotogramma; l'osservatore della pagina Mini PC che non si sveglia per le
  proprie scritture e lavora solo a pagina aperta; i colori dei tubi e del
  punto della rete che non si riscrivono a ogni passata; lo sfondo animato
  su un livello suo, fermo per chi ha chiesto al sistema di ridurre le
  animazioni. E le letture REST di periodi lunghi — la derivazione dei
  totali dall'inizio dell'anno, i popup di una settimana — passano dalle
  statistiche del Recorder invece che dalla storia grezza: decine di righe
  invece di decine di migliaia.

- **Energia ferma su «Caricamento dati Energia…» nel pannello, e le
  notifiche «Login attempt failed».** Dentro il pannello di Home Assistant
  la plancia non possiede nessun gettone, e le chiamate REST allo storico che
  il guscio fa per conto suo rispondevano 401 — una notifica di accesso
  fallito ogni dieci minuti, e la sezione che restava dietro il velo ad
  aspettare. Quelle chiamate ora passano dal socket autenticato del pannello,
  come tutto il resto. Il velo si toglie dopo due tentativi e al suo posto
  compare la ragione, e i tentativi successivi si diradano invece di
  insistere ogni secondo.

- **Storico di un mese o da…a: «Nessuno storico disponibile».** Oltre le
  settantadue ore lo storico grezzo e' troppo per una casa e per il tempo che
  si e' disposti ad aspettare: si chiedono le statistiche del Recorder, per
  ora o per giorno, con la pazienza che il periodo merita e la storia grezza
  come ripiego.

- **Radar illeggibile, con «API Key Required» stampato sulle tessere.** Il
  fondo CARTO chiede una chiave che la plancia non ha: il fondo e'
  OpenStreetMap, e chi aveva CARTO salvato passa a OpenStreetMap da solo.

- **Rifiuti: i sensori letti come li scrivono le integrazioni.** Date nella
  forma gg-mm-aaaa, nomi dei giorni della settimana in piu' lingue, gli
  attributi delle integrazioni comuni (data, giorni mancanti, prossimi
  ritiri), e il materiale preso dal sensore quando la riga dice «altro».

- **Seguito di #292: i carichi sono di un impianto.** Passando da un
  impianto all'altro la scheda dei carichi si ricarica, e salvare i carichi di
  uno non cancella piu' quelli dell'altro: gli identificativi non si pestano
  fra impianti, e nel modello di un impianto non entrano gli elettrodomestici
  dell'altro. Le modifiche non ancora salvate non si perdono cambiando
  impianto: restano da parte, e tornandoci si ritrovano.

- **Seguito di #286: le tessere Energia per impianto.** Tutte seguono
  l'ordine scelto per «Energia», tutte hanno «Apri sezione», e il tasto apre
  la scheda dell'impianto giusto.

- **Seguito di #281: la seconda caldaia non si selezionava.** La fila dei
  nomi stava sotto la scena, che e' assoluta e copre tutto il palco: i nomi si
  vedevano attraverso, ma il tocco arrivava alla scena. La fila sta sopra.

- **Finestre: in modifica mancavano l'inferriata e la soglia.** La finestra
  di modifica di una riga ha le due caselle, col cercatore e le stesse regole
  della riga che nasce; svuotare l'inferriata la toglie.

- **Allagamento: la tessera in Home non compariva nemmeno col sensore
  bagnato.** «Quando attivo non segnala lo stato allagamento nei widget.» La
  tessera leggeva l'elenco dei sensori dal posto sbagliato — l'oggetto intero
  invece dell'elenco che porta dentro — e per lei non c'era mai nessun
  sensore. Ora legge l'elenco, e con un sensore bagnato la tessera c'e'.

- **Le grate sono di un grigio chiaro e sfumato.** «Essendo molto scure,
  quando sono chiuse e la finestra e' aperta visivamente non e' il massimo.»
  Il ferro e' grigio, e dove il browser sa mascherare la sbarra va dal chiaro
  in alto al pieno in basso, con un filo di luce sul bordo.

- **Il ritiro di oggi non e' un trattino (#309).**

      «Ho un calendario con i giorni configurati per ogni rifiuto; mi
       aspettavo di vedere il rifiuto di oggi "Umido" ma vedo un trattino.»

  Un evento di tutto il giorno non e' un istante, e' una casella sul
  calendario. Home Assistant pero' gli scrive accanto il fuso —
  `2026-09-04T00:00:00+02:00` — e la lettura lo prendeva alla lettera: da un
  fuso piu' indietro scivolava al giorno prima, il conto lo scartava perche'
  tiene solo i giorni da zero in su, e restava un trattino proprio il giorno
  in cui il bidone va messo fuori. Ora un evento di tutto il giorno si legge
  come la data che dice, mentre un orario vero conserva il suo fuso; con lo
  stesso giro torna anche il ritiro cominciato ieri e non ancora finito, che
  spariva dal conto mentre il bidone era fuori.

## 1.4.6

Tre sezioni in piu', la Home che si personalizza, e una decina di cose viste
sul campo. Le sezioni sono le Allerte (#296), i Rifiuti (#293) e l'auto che va
a benzina (#208). La Home sceglie cosa mostrano le sue tessere e ne fa una per
ogni entita' in evidenza (#303), avvisa quando l'assistenza risponde, e ogni
storico si sceglie il periodo (#302); il clima dice quanto sono aperte le
valvole (#300). Le cose viste sul campo sono il radar che con «Casa» non
mostrava niente, le telecamere Arlo senza video (#294), la tapparella
socchiusa che contava come aperta (#298), l'inferriata che si perdeva in
modifica (#297), le icone che sparivano (#304), la finestra col solo sensore
contata fra le tapparelle (#299), il cruscotto delle segnalazioni che non
ricaricava, e un apice di troppo in un commento che spegneva mezza plancia
dopo il primo caricamento.

### Aggiunto

- **Le allerte hanno una pagina (#296).**

      «Presenza di allerte varie: terremoti INGV, thermal comfort zona,
       concentrazione pollini, concentrazione fulmini zona, avvisi
       protezione civile, Flightradar24 di zona.»

  Sei fonti, ognuna dal sensore che la sua integrazione ha gia' portato in
  Home Assistant, ridotte a un livello solo: quiete, nota, attenzione,
  allarme. Nessuna casella e' obbligatoria e ognuna basta da sola; la pagina
  mostra solo le fonti che ci sono, e la tessera in Home conta quelle in
  corso e si accende dall'«attenzione» in su. Una fonte muta non e' quiete:
  la pagina lo dice. La plancia non chiama nessun servizio, legge quello che
  c'e'.

- **La raccolta differenziata ha una pagina (#293).** Un bidone per
  materiale, e per ognuno il sensore o il calendario che dice quando passa il
  ritiro. La pagina risponde alla domanda della sera — cosa metto fuori
  stasera — e la tessera in Home si accende il giorno prima. Chi ha un
  calendario solo, con un evento per ritiro, lo mette nella casella in fondo
  e il materiale si indovina dal nome dell'evento.

- **L'auto che va a benzina (#208).**

      «Ho la mia auto che ha i sensori di livello carburante, odometro,
       autonomia e portiere: e' possibile scegliere a monte se
       visualizzare un'auto elettrica o classica con i sensori
       disponibili?»

  Nella scheda dell'auto, sotto il nome, una tendina dice se il motore e'
  elettrico, termico o ibrido. Vale per quella vettura: in un garage possono
  starci tutte e due. Con un motore termico la pagina Auto non mostra piu'
  la ricarica — batteria, wallbox, sessione, target — e al suo posto c'e' il
  serbatoio, con intorno le portiere, il motore, i finestrini, l'allarme, la
  batteria di servizio, l'olio, la temperatura esterna, l'ultimo viaggio, il
  carburante consumato e la pressione dei pneumatici. Le caselle nuove stanno
  fra le entita' dell'auto, con la stessa lente e lo stesso cestino delle
  altre. La tessera in Home legge il carburante quando non c'e' una batteria,
  e lo dice con la pompa al posto della spina.

- **Il radar ha un servizio di serie.** La pioggia arriva da RainViewer e la
  mappa sotto da CARTO senza dover scegliere niente: basta dire dove. Nella
  scheda Home si puo' cambiare — OpenStreetMap, oppure «Un indirizzo mio» con
  {z}/{x}/{y}; «Prova» ne scarica una e dice se arriva — e chi non vuole che
  la plancia bussi a nessun servizio sceglie «Nessuno». Una casa che il radar
  non l'ha mai toccato non se lo trova nelle previsioni.

- **La pagina dell'auto si chiama «Auto».** Da quando ci passano anche le
  vetture a benzina, «Auto elettrica» nel titolo e nella scheda era una
  bugia per meta' del garage.

- **«Sostieni il progetto» nella configurazione.** In fondo alla colonna
  delle schede una pastiglia PayPal, e in «Impostazioni» una card con due
  righe di perche': il progetto e' indipendente e vive di tempo libero. Il
  collegamento e' uno, lo stesso del README, e si apre in una scheda nuova.

- **Una risposta dell'assistenza compare in Home.**

      «Gestisci una sorta di widget avviso che, se si ricevono messaggi
       nella chat assistenza, compare nella home.»

  La chat sta dietro una card della Configurazione, e una risposta arrivata
  mentre nessuno guardava li' era un pallino su una pagina che non si apre
  tutti i giorni. Adesso e' una tessera fra i widget della Home, la prima di
  serie: compare con la prima risposta da leggere, porta il conto e l'ultima
  frase in breve, si accende come un avviso, e la sua finestra ha il tasto
  che apre la chat. Se
  ne va da sola appena la chat si apre, perche' aprirla e' leggerla. La
  pagina lo viene a sapere dal bus di Home Assistant — lo stesso evento
  `dashboardmodern_chat` che il giro dei cinque minuti spara per le
  automazioni — senza nessun battito in piu', e si rimette in ascolto da sola
  dopo una riconnessione. Dalla scheda Widget si ordina e si nasconde come
  le altre.

- **I widget della Home si personalizzano (#303).**

      «Il widget temperatura come il clima visualizzano la temperatura
       media, si potrebbe far scegliere cosa visualizzare. Anche quelle in
       evidenza di potere scegliere se vederle raggruppate oppure come widget
       una ad una.»

  Nella scheda Widget, sotto Temperatura e Clima, la tendina «Cosa mostra»:
  la media di tutte, com'era, oppure una stanza o un'unita' sola — con una
  pompa di calore che d'inverno scalda una stanza a trenta gradi, la media
  non dice niente. E ogni entita' in evidenza ha la spunta «Tessera a se' in
  Home»: invece di stare nel riassunto ha la sua tessera, col suo valore, che
  al tocco si apre su di lei. E' il modo di mettere in Home un'entita'
  qualunque come widget.

- **Le valvole termostatiche dicono quanto sono aperte (#300).**

      «Nella sezione riscaldamento dare la possibilita' di inserire valvole
       TRV mostrando percentuale apertura e percentuale chiusura valvola.»

  Nella scheda di un'unita' clima — il form del guscio e la matita — c'e' la
  casella «Valvola TRV (posizione %)»: il sensore o il number con la
  posizione della valvola. La card del termosifone mostra una barra con
  quanto e' aperta e quanto chiusa. Chi ha un'unita' che espone gia'
  `valve_position` o `pi_heating_demand` fra gli attributi non deve
  compilare niente: la card lo legge da li'.

- **Lo storico si sceglie il periodo (#302).**

      «Nella scheda temperatura il grafico permette solo di scegliere
       24h/7g. Inserire la possibilita' di inserire data inizio e data fine
       oltre a piu' periodi predefiniti (1 ora, 5 ore, 10 ore, 1 mese,
       2 mesi…).»

  In ogni finestra dove si vede uno storico — il popup delle misure, che
  aprono la temperatura, gli elettrodomestici, l'auto e il resto; il grafico
  della stanza nella pagina Temperatura; la cronologia della connettivita' e
  dell'inverter — ci sono sette periodi di serie, da un'ora a due mesi, e
  «Da … a» per scrivere un inizio e una fine. L'asse del tempo cambia grana
  col periodo: le ore su un giorno, i giorni su una settimana, le settimane
  su un mese. Il futuro non ha storia, e un anno e' il massimo che si chiede
  al Recorder.

- **Le tapparelle hanno una soglia di chiusura (#298).** Nella scheda
  Finestre un numero: ferma a quella percentuale o sotto, la tapparella
  conta come chiusa nella pagina, nella scena e nella tessera in Home. Chi
  lascia un 10% per far passare l'aria non si sente dire che e' aperta. Zero
  e' il comportamento di sempre.

### Corretto

- **Nove cose viste in revisione, prima di uscire.** Una sottoscrizione
  WebRTC chiusa si chiude anche nel ponte del pannello, non solo di qua. Una
  vettura dichiarata a benzina mostra il serbatoio in Home anche se ha ancora
  addosso la batteria di quando era elettrica. Il radar e' «vivo» solo se
  arriva la pioggia: il fondo della mappa da solo non basta piu'. Cambiato il
  materiale di un bidone, icona e colore si ricalcolano. Le distanze delle
  allerte si leggono in chilometri anche da un sensore in miglia o in metri.
  Il calendario dei rifiuti concorre al «prossimo ritiro», e un sensore che
  dice unknown o unavailable non risponde — non «data non trovata». La
  tessera delle allerte non dice «tutto tranquillo» sopra una fonte che non
  risponde: dice quante sono. E una telecamera puntata su una scena ferma non
  si condanna ogni mezzo minuto: la pazienza raddoppia a ogni riavvio, fino a
  quattro minuti, e si azzera al primo fotogramma diverso.

- **Barre dei periodi, campo della valvola e pastiglia: in riga.** Nel popup
  dello storico la pillola dei periodi era una griglia da quattro larga al
  massimo 460 pixel: con otto periodi andava a capo, la seconda riga restava
  appesa a sinistra e il fondo diventava una macchia tonda; adesso si prende
  la larghezza che ha, centra le pillole anche su due righe e la riga «Dal /
  Al» sta sotto, per intero. Nella scheda Clima il campo «Valvola TRV» aveva
  la matita su una riga a se': ha la stessa forma di «Entita' clima». Nella
  scheda Widget «Cosa mostra» andava a capo in due righe strette accanto a
  una tendina larga quanto la pagina. E la pastiglia «Sostieni il progetto»
  usciva dalla colonna delle schede: ora va a capo dentro la pillola e sul
  telefono in piedi resta il solo cuore.

- **Il pallino dell'assistenza si spegneva da solo.** All'avvio la plancia
  leggeva anche il filo della chat, e leggere il filo e' averlo letto: il
  segnalibro si spostava a ogni ricarica della pagina, prima che qualcuno
  avesse visto niente. Adesso all'avvio si legge solo lo stato — quante
  risposte aspettano — e il filo quando la finestra si apre davvero.

- **Il radar con «Casa» non mostrava niente.** La plancia sapeva dove sta
  casa solo se il guscio le passava `hass.config`, e nel riquadro ospitato
  non arriva: ora lo chiede al socket con `get_config` e se lo tiene. E senza
  un servizio delle tessere non aveva da chi chiedere la pioggia: da qui la
  tendina.

- **Le telecamere hanno il video vero (#294).**

      «Continuano a non funzionare in live streaming, e nemmeno se metto
       nome webrtc parte.»

  Dentro il pannello di Home Assistant — e quindi da Nabu Casa — il ponte
  verso il socket non lasciava passare il WebRTC di Home Assistant
  (`camera/webrtc/offer`): il popup moriva prima di cominciare, e il campo
  «nome del flusso» non c'entra, e' per chi ha l'estensione go2rtc. Il ponte
  adesso lascia passare l'offerta e i suoi eventi, e la negoziazione usa i
  server ICE che Home Assistant dichiara per la telecamera — i TURN di Nabu
  Casa compresi, che da fuori casa sono la differenza fra il video e il nero.
  Le tessere «dal vivo» fanno lo stesso: quando Home Assistant dichiara
  `web_rtc` o `hls` montano un video, e il MJPEG del proxy — che per una
  telecamera in cloud e' una foto ferma — resta come rete sotto. Uscendo
  dalla pagina i video si spengono.

- **Le telecamere Arlo non lasciano piu' il quadratino azzurro (#294).** Il
  flusso di una telecamera che dorme non parte al primo colpo, e l'immagine
  restava rotta — ritentata ogni quattro secondi. Un flusso caduto ora si
  mette in pausa per un minuto e la tessera torna alle istantanee; allo
  scadere si riprova. E un flusso che si ferma in silenzio — gli stessi pixel
  per trenta secondi — si riconosce e si riapre, invece di restare con la
  vista congelata. Mentre si aspetta il primo fotogramma, la tessera lo
  scrive — ma solo finche' un fotogramma non c'e' stato: da li' in poi un
  flusso che cade lascia a schermo l'ultimo, non un lampo di nero.

- **L'infisso con inferriata si rilegge in modifica (#297).** La seconda
  entita' si perdeva al salvataggio, perche' la normalizzazione del
  dispositivo la lasciava cadere; ora resta. E l'inferriata si anima come una
  grata — le sbarre che si scostano — prima delle ante quando si apre, e
  dopo quando si chiude.

- **Il conto in cima a un gruppo di finestre non inventa tapparelle (#299).**
  Una persiana a mano con il solo sensore di contatto leggeva «1 tapparella»:
  le tapparelle e le finestre si contano a parte, e ognuna compare solo se c'e'.

- **Le icone non spariscono piu' (#304).** «Icone spariscono, e riappaiono
  se ci clicco sopra.» Tre cause, tre rimedi: le animazioni che passano
  dall'invisibile — l'ingresso di una tessera, il battito degli avvisi — non
  si fermano piu' a meta' quando si apre una finestra; il foglio delle
  sfumature non si butta e rifa' a ogni giro, si sposta; e ogni disegno porta
  il colore di ripiego accanto alla sfumatura, cosi' se il browser non la
  ritrova dipinge un disegno pieno invece di niente. La pagina Temperatura
  rilegge i suoi nodi una volta per fotogramma e non a ogni mutazione.

- **Il cruscotto delle segnalazioni ricarica con «Aggiorna».** Il tasto non
  faceva niente: bisognava chiudere e riaprire per vedere le nuove.

- **«Da lavorare» non mostra piu' le segnalazioni prese in carico.** Una
  segnalazione presa in carico sta in lavorazione, e i filtri lo dicono:
  aperte, in lavorazione, chiuse, tutte.

## 1.4.5

Tredici passaggi di prova diventati una versione sola. Dentro ci sono cinque
sezioni nuove — Musica, Agenda, Tapparelle rifatte, Sicurezza, MiniPC — le
segnalazioni che nascono dalla plancia invece che da GitHub, il cruscotto di
chi le riceve, la chat di assistenza privata col suo centralino, le sezioni
vuote che non ingombrano piu' la barra, e una lunga fila di difetti visti su
telefoni e tablet veri.

Le note qui sotto sono quelle delle tredici prove, rimesse in fila per
argomento invece che per data: quello che e' stato aggiunto, quello che e'
cambiato, quello che e' stato tolto, quello che e' stato corretto. In cima a
«Corretto» ci sono anche cinque difetti visti sull'ultima beta e sistemati
senza passare da una beta loro: il radar, i conti degli elettrodomestici e
della Wallbox, lo storico della connettivita' e i filtri del cruscotto.

### Aggiunto

- **Le conversazioni dell'assistenza si possono buttare via.**

      «si ma mi devi dare la possibilita' di eliminare anche la
       conversazione»

  Nella scheda «Conversazioni» ogni riga ha un cestino, e ce n'e' uno anche
  sopra il filo aperto. Cancella davvero e per tutti e due: la linea sparisce
  dal centralino e con lei quello che si erano detti, quindi sparisce anche
  dalla plancia di quella casa.

  Serve perche' una coda dove non si butta via niente si riempie di prove, di
  domande gia' risolte e di righe aperte per sbaglio, finche' quella vera non
  si trova piu'. Ed e' il verso giusto della promessa fatta prima della prima
  riga: quello che si scrive li' non resta in giro per sempre.

  Due tocchi e non uno — il primo arma il cestino e chiede conferma sul tasto
  stesso, il secondo cancella — perche' una conversazione cancellata non si
  rimette a posto, e in un elenco dove si scorre col dito un cestino che
  cancella al primo tocco butta via prima o poi quella sbagliata.

- **La Musica ha la sua sezione, e la copertina fa da sfondo.**

      «sarebbe carino una sezione dedicata ai dispositivi Media Player… la
       possibilita' di aggiungerli anche nelle Azioni rapide, sarebbe figo se
       lo sfondo fosse l'anteprima di cio' che viene riprodotto»

  I lettori dichiarati in configurazione hanno una scheda ciascuno, con titolo,
  artista, la barra del tempo che avanza da sola, il volume e la sorgente. I
  tasti sono quelli che il lettore **sa eseguire davvero**: se non ha il brano
  successivo quel tasto non viene disegnato, e una radio non finge di poterlo
  saltare.

  Da qui si mettono anche fra le Azioni rapide della Home: li' il tasto prende
  la copertina come sfondo, e premerlo mette in pausa o fa ripartire. In Home
  la tessera dice quanti stanno suonando e **cosa** — titolo, artista e in che
  stanza.

- **Le entita' che uno si aggiunge dove vuole.**

      «in alcune schede non e' possibile inserire entita' o sensori
       personalizzati… modificando il nome, icona, stanza di destinazione»

  Alcune schede sono elenchi — Luci, Prese, Telecamere — e li' un'entita' in
  piu' si e' sempre potuta aggiungere. Altre sono fatte di caselle con un ruolo
  preciso: l'Energia ha una rete e un fotovoltaico, la Sicurezza una centrale,
  e per un sensore in piu' non c'era posto. Adesso c'e': si sceglie l'entita',
  in quale scheda farla comparire, come chiamarla e con che icona, e compare in
  fondo a quella pagina.

- **Le aperture sono una sezione a se'** (#275). Portone, porta di casa,
  cancello: uscivano dalla Sicurezza col nome «Aperture», che e' lo stesso dei
  sensori che dicono se una finestra e' aperta — due cose diverse con lo stesso
  nome, e si confondevano. Adesso sono una pagina loro, **Apri
  porte/cancelli**, e si aprono da dove si vedono. La conferma si puo'
  spegnere.

- **L'orologio, nello stesso riquadro del meteo** (#272). «Sarebbe carino avere
  l'orologio, magari vicino al meteo»: ora e giorno, sotto il titolo, dove si
  guarda gia'.

- **Piu' di una centrale d'allarme** (#285), **la tessera Energia per ogni
  impianto** (#286), **il solare termico con piu' impianti**, e **il video dal
  vivo delle telecamere Arlo** invece dell'istantanea ferma.

- **Una chat di assistenza, privata, senza account.**

      «io avevo chiesto una chat di assistenza che non deve passare per
       github. e' come se fosse una chat teams»

  Quello che c'era era un'altra cosa: le Segnalazioni aprono una issue e sotto
  quella si scrivono commenti. Un filo, non una conversazione — e per scriverci
  serve un account GitHub, e quello che si scrive resta pubblico per sempre.
  Per un difetto va bene, anzi e' giusto. Non va per chi chiede aiuto: chi
  chiede aiuto incolla un pezzo di configurazione, il nome delle proprie
  entita', a volte una foto di casa sua. E chi guarda la plancia non e' sempre
  chi l'ha installata.

  Adesso in Configurazione c'e' la tessera **Assistenza**: una finestra con i
  messaggi in fila e la casella sotto, Invio manda e Maiuscolo+Invio va a capo,
  come in qualunque chat. Prima della prima riga si legge dove finisce quello
  che si scrive, e il tasto per cancellare la conversazione cancella davvero —
  anche dall'altra parte, non solo dallo schermo.

  Sotto c'e' il **centralino**, un servizio minuscolo che chi mantiene la
  plancia tiene su: e' il punto d'incontro fra due case che altrimenti non si
  parlerebbero. Non sa chi sia nessuno — una casa e' 128 bit di caso che si e'
  fabbricata da sola, e del suo segreto il centralino tiene solo l'impronta.
  Insieme al messaggio partono tre cose e nessuna in piu': la versione della
  plancia, quella di Home Assistant e la lingua.

  Il campanello e' lo stesso delle segnalazioni ma ha il suo evento,
  `dashboardmodern_chat`: un'automazione puo' voler suonare per una risposta
  dell'assistenza e stare zitta per un commento su una issue.

  Chi non vuole che la plancia parli con nessuno fuori di casa la spegne dalle
  opzioni, come le segnalazioni. Il progetto sta in `docs/CHAT.md`.

- **Quando qualcuno scrive, Home Assistant lo dice.** Ogni cinque minuti la
  plancia va a vedere se sotto una segnalazione e' comparso un messaggio, e se
  c'e' suona in due modi: una notifica di Home Assistant — quella della
  campanella, che non chiede di configurare niente — e un evento sul bus,
  `dashboardmodern_messaggio`, per chi la vuole far finire sul telefono, su un
  altoparlante o su una luce che cambia colore.

  Chi tiene la repository sente tutto, comprese le segnalazioni appena aperte.
  Chi la plancia la usa e basta sente solo le proprie: le altre sono
  conversazioni fra sconosciuti, e riceverle sarebbe stato ricevere lo spam di
  un tracker. Le proprie pero' **tutte**, anche quelle gia' chiuse — una
  risposta arrivata sotto una segnalazione chiusa la settimana prima e'
  esattamente il messaggio che non si vuole perdere.

  Tre cose che il campanello non fa, e sono le tre che l'avrebbero fatto
  spegnere il primo giorno. Non suona al primo avvio, dove tutto quello che
  c'e' e' gia' successo. Non risuona a ogni riavvio di Home Assistant, perche'
  il segno di quello che si e' letto sta su disco e non in memoria. E non suona
  per la frase che si e' appena battuta: quando la plancia scrive un commento,
  alza il segno da se'.

  Costa **una richiesta ogni cinque minuti**, non una per segnalazione:
  l'elenco filtrato per `since` porta gia' il numero dei commenti, e se e'
  cresciuto qualcuno ha scritto. Dodici richieste all'ora contro le cinquemila
  che un account collegato concede.

- **Chi ha segnalato risponde dalla sua plancia.** Sotto la discussione aperta
  c'e' la casella per scrivere, e il messaggio parte a nome suo — mai a nome
  della console. Fino a ieri il filo si poteva leggere ma non scrivere: per
  dire «ho provato, non funziona lo stesso» bisognava aprire github.com, cioe'
  uscire proprio dal posto che quella finestra esiste per non far lasciare.

- **Il widget dice chi aspetta una risposta.** In cima alla finestra, prima dei
  conti, le conversazioni dove qualcuno ha scritto e nessuno ha ancora aperto:
  «💬 2 con messaggi nuovi», con i titoli e quanti messaggi sono. Il campanello
  suona e passa — un evento non lo si puo' guardare mezz'ora dopo — e questo
  invece resta, per chi apre la plancia dopo che il telefono ha vibrato o dopo
  che il telefono non era in tasca.

  Il conto e' di **conversazioni**, non di messaggi: chi guarda vuole sapere
  quante porte ha da aprire; quante frasi ci siano dietro lo dice il filo. Lo
  stesso segno compare sulla riga nel cruscotto e su quella di chi ha
  segnalato, e si spegne aprendo la discussione — su tutte le plance della
  casa, perche' l'elenco lo tiene Home Assistant e non il browser: chi legge
  dal telefono e poi passa davanti al tablet in cucina non ritrova lo stesso
  pallino ad aspettarlo.

- **«Prendo in carico», sul cruscotto.** E' l'assegnazione di GitHub, non
  un'etichetta inventata qui: la segnalazione compare fra le tue, chi passa
  dalla pagina lo vede senza che nessuno glielo scriva, e in testa alla riga
  c'e' il nome di chi l'ha presa. Ci si puo' ripensare con lo stesso tasto.

- **La tessera delle segnalazioni in Home, e c'e' solo per te.** Il numero
  grande e' quello che resta **da lavorare** — non quante ne sono arrivate in
  tutto, che e' storia e non chiede niente — e sotto c'e' la ripartizione: «3
  difetti · 2 idee · 1 aiuto». Si accende quando qualcosa aspetta una
  risposta; toccandola si apre una finestra con la lettura del tempo, i tre
  conti — nuove, in lavorazione, chiuse — e la porta verso il cruscotto, invece
  di rifare la console in miniatura dentro una finestra larga un palmo.

- **La finestra dice cosa e' arrivato oggi, per genere, e quante sono ferme.**
  «Oggi: 🐞 Difetti 1 · 💬 Aiuto 1», e sotto «2 ferme da oltre un mese». Sapere
  che ne sono arrivate due non dice se la giornata e' andata storta o se
  qualcuno ha avuto due idee: un difetto e un'idea chiedono cose diverse a chi
  legge. Il conto sta dopo il nome, come sui filtri del cruscotto — «1 difetti»
  sarebbe sbagliato in italiano e in mezza Europa, e mettere il numero in coda
  toglie il problema invece di raddoppiare le stringhe per il singolare. Anche
  le arrivate oggi **senza tipo** hanno la loro pastiglia: sommare i tre generi
  noti e fermarsi li' vorrebbe dire dire «oggi niente» in una giornata di sole
  issue aperte a mano su GitHub. E' la domanda che dai tre conti non si legge. La seconda meta' e' quella che pesa — un conto fermo non si
  muove da solo, e in una colonna di numeri passerebbe inosservato proprio
  perche' non cambia mai.

  «Oggi» si decide confrontando due date di **calendario**, non due numeri di
  millisecondi: sottrarre ventiquattro ore sbaglia nei giorni in cui l'ora
  cambia — uno ne dura venticinque, un altro ventitre' — ed e' la stessa
  trappola trovata sulla tessera dell'Agenda. Una prova la tiene chiusa.

  Chi non porta la data non si conta ne' fra le nuove di oggi ne' fra le ferme:
  non sapere quando e' nata non la rende vecchia.

  Quella finestra non porta il verdetto delle altre tessere. Quella riga la
  scrive il motore che legge gli stati di casa — «acceso», «in corso», «qui non
  c'e' ancora niente» — e su una coda di segnalazioni non ha niente da leggere:
  usciva «Qui non c'e' ancora niente» sopra sette segnalazioni da lavorare,
  cioe' il contrario di quello che la finestra stessa mostrava due righe sotto.

  «Solo per me» sta scritto in come e' fatta, non in un interruttore: il suo
  modello torna `null` per chiunque non tenga la repository, quindi per gli
  altri la tessera non esiste — non compare vuota, non compare a zero. Un
  interruttore lo si potrebbe accendere per sbaglio, questo no. La riga nel
  catalogo «ordina e accendi» c'e' lo stesso, perche' chi la vede deve poterla
  spostare e spegnere come le altre.

  La coda si va a riprendere da sola al massimo ogni dieci minuti: le
  segnalazioni non arrivano al secondo, e ogni giro e' una chiamata a GitHub.
  Se la rete non risponde la tessera **non compare**, invece di dire zero: «non
  lo so ancora» e «non c'e' niente» sono due cose diverse, e la seconda detta
  al posto della prima e' una bugia con l'aria di un dato.

- **Un giro solo per due mestieri.** La coda la chiedevano due funzioni
  diverse, e due funzioni che chiedono la stessa cosa a GitHub finiscono sempre
  per rispondere in modo diverso. Adesso e' una, con due modi: zitta per la
  Home, ad alta voce per la console — dove qualcuno sta guardando e un guasto
  va detto.

- **Non e' piu' una finestra: e' una pagina, con la sua voce nella barra.** La
  coda del manutentore non e' una cosa che si sbircia — si legge un titolo, si
  apre il filo, si guarda una foto, si scrive una risposta — e tutto questo
  dentro un riquadro largo un palmo vuol dire scorrere per fare qualunque cosa.
  Adesso ci sta tutto a schermo intero.

  La voce c'e' **solo per chi tiene la repository**, e non e' un'impostazione da
  spegnere: per gli altri quella pagina non avrebbe niente dentro. Chi ce l'ha
  la puo' nascondere dalla barra come qualunque altra, dall'interruttore nella
  scheda Segnalazioni — e se il riconoscimento cade, la voce e la pagina se ne
  vanno da sole invece di restare li' vuote.

  La finestra delle segnalazioni torna a due linguette, «Nuova» e «Le mie»: e'
  il posto di chi segnala, e non ha piu' dentro il posto di chi risponde.


- **I tasti che scrivono nascono spenti, e si accendono col testo.** Erano
  sempre premibili, e alla pressione a vuoto rispondevano «Scrivi una
  risposta»: un rimprovero al posto di un invito, per un errore che il tasto
  poteva semplicemente non lasciar commettere. Spento adesso vuol dire spento
  anche per il tasto pieno — la sola trasparenza lasciava un rettangolo azzurro
  che continuava a leggersi come «premimi».

- **E c'e' «Risolvi», che chiude e basta.** Chiudere senza scrivere e' un gesto
  legittimo — «non e' un difetto», «era gia' risolta» — e prima l'unico modo di
  farlo era «Archivia», che pero' dice un'altra cosa: archiviata vuol dire
  lasciata li', risolta vuol dire fatta. Ora la riga ne ha quattro: due che
  scrivono e aspettano il testo, due che chiudono subito.


- **Lo stato e il tipo sono due file di tasti, e si incrociano.** Stavano tutti
  su una riga sola a scelta singola, e quello faceva sembrare «Da lavorare» e
  «Difetti» due risposte alla stessa domanda. Non lo sono: premendo «Difetti»
  si perdeva lo stato e arrivavano anche i difetti gia' chiusi — mentre la cosa
  che si cerca aprendo la console e' quasi sempre «i difetti **aperti**», che
  con una riga sola non si poteva proprio chiedere.

  Adesso sopra c'e' lo stato — Da lavorare, Chiuse, Tutte — e sotto il tipo —
  Ogni tipo, Difetti, Idee, Aiuto. Si accendono insieme, e «Da lavorare» piu'
  «Difetti» da' i difetti da lavorare.

- **E sotto ogni tipo c'e' il suo conto, dentro lo stato scelto.** Con «Da
  lavorare» acceso, «Difetti 3» vuol dire tre difetti da lavorare, non tre
  difetti in tutta la storia della repository: e' il numero che serve a
  decidere cosa premere, e si legge prima di premere.

- **«Ogni tipo» non vuol dire «senza tipo».** Il tasto vuoto significa «non
  filtrare»; se filtrasse davvero sul tipo vuoto, le uniche a passare sarebbero
  le segnalazioni senza tipo — l'esatto contrario. Quelle si riconoscono dalla
  pastiglia grigia, e restano raggiungibili.

- **Il messaggio di coda vuota dice chi sta tagliando.** Col tipo acceso il
  vuoto e' quasi sempre colpa sua, non dello stato: dirlo evita di guardare una
  coda vuota chiedendosi dove siano finite le altre trentanove.

- **Le entità del clima si raggruppano per stanza.** «Ho sette termosifoni con
  valvola smart, ognuna con una o più entità VTherm: almeno si raddoppiano,
  quattordici o più da mostrare nella sezione. Poterle raggruppare per stanza
  aiuta a organizzare il contenuto.» (#261) Si raggruppava per piano soltanto,
  e la ragione era buona: con un'unità per stanza un titolo di stanza vuol dire
  un titolo sopra ogni singola carta, e la stanza sulla carta c'è già scritta.
  Quella ragione cade quando le unità per stanza sono più d'una — lì il titolo
  dice dove finisce una stanza e comincia l'altra, che dalle carte in fila non
  si vede. Quindi la stessa regola del piano, che un titolo lo stampa solo se
  sopra c'è più di un piano: la stanza si intitola quando almeno una ne tiene
  più di una. Chi ne ha una per stanza vede esattamente quello che vedeva.
- **La lingua si sceglie dalle Impostazioni.** «Vorrei poter modificare la
  lingua senza ereditare necessariamente quella di HA: io ho HA in inglese
  perché mi aiuta per lo sviluppo, ma la plancia la vorrei in italiano per
  renderla fruibile agli altri componenti della famiglia.» (#263) Il motore
  c'era già tutto, e in `i18n-section.js` c'era perfino scritto «così la pagina
  delle impostazioni può cambiare lingua senza ricaricare»: mancava la pagina
  delle impostazioni. Adesso c'è, con «Lingua di Home Assistant» che non è una
  quattordicesima lingua ma l'assenza di scelta — sceglierla cancella la
  preferenza e la plancia torna a seguire il profilo di chi guarda.
- **E dentro Home Assistant quella scelta adesso vale.** Non sarebbe bastata la
  tendina: la lingua che l'ospite inietta era il primo candidato, e dentro HA
  c'è sempre, quindi una scelta salvata non avrebbe vinto mai. Una preferenza
  esplicita batte un valore di serie, come dappertutto qui: chi non ne ha una
  ricade esattamente su quello che vedeva prima.

- **Il locale caldaia tiene più di una caldaia.** «Ho due caldaie, la dashboard
  ne configura una sola.» Adesso `cd_caldaia` accetta sia l'oggetto di prima
  sia una lista, e chi ne aveva una la ritrova dov'era senza toccare niente. Da
  lì in su sono diventati plurali insieme i quattro strati che servivano: il
  configuratore mostra una lista con nome, aggiungi e rimuovi; la pagina, con
  più d'una, mette sopra le letture una fila di macchine — «Zona giorno ● |
  Zona notte» — e si tocca per cambiare scena; la tessera in Home le somma e
  prefissa ogni riga col nome della macchina, perché due righe «Mandata» una
  sotto l'altra non dicono di chi sono. Con una caldaia sola la fila non
  compare: sarebbe un interruttore con una posizione.

- **E la testata del Clima le conta tutte.** «La doppia caldaia va inserita
  anche nella sezione clima.» Ne raccontava una — un `.find()` — e con due
  configurate mostrava la prima. Ora c'è una casella per macchina, «Zona giorno
  · Accesa · da 1 h» accanto a «Zona notte · Spenta», e le fonti sono due
  perché nessuna basta: l'elenco libero dello Stato termico, dove una caldaia
  si riconosce dal nome, e la Gestione termica, dove ogni macchina ha il suo
  nome e la casella che dice acceso o spento. L'unione è per entità, non per
  nome: la stessa caldaia dichiarata in tutti e due i posti resta una.

- **L'indirizzo RTSP di una telecamera ha la sua casella.** «Ho una telecamera
  con flusso video su rtsp://…, non c'è possibilità di configurazione.» La
  casella non è un lettore, e non finge di esserlo: **nessun browser apre
  rtsp://**, il flusso deve passare da qualcosa che sta dalla parte del server.
  È il pezzo che mancava per arrivarci — l'indirizzo si scrive e si salva, da
  lì si legge il nome che go2rtc dà a quel flusso e lo si propone nel campo che
  accende WebRTC, e a chi go2rtc non ce l'ha la scheda dice l'unica cosa da
  sapere con il collegamento che la fa. La password non esce: accanto al campo
  si legge cosa se n'è capito — «192.168.5.30:8556 · flusso «Salone» · con
  credenziali» — mentre la riga da copiare, che va in un file di
  configurazione e non a schermo, le credenziali le porta tutte.

- **Le sezioni che si fa l'utente.** «Dare la possibilità di creare sezioni
  custom dove inserire le proprie entità: avrei potuto inserire quelle dell'UPS
  senza attendere la sezione apposita.» Non una sezione «Custom» che le
  contiene tutte, ma una voce nella barra per ognuna, col titolo e l'icona che
  le ha dato chi l'ha fatta. La pagina è onesta su quello che sa: mette le
  righe in fila, dice come stanno, e mette l'interruttore **solo dove c'è
  qualcosa da accendere** — chiamare `toggle` su un sensore non fa niente, e un
  interruttore che non fa niente è peggio di nessun interruttore.
  L'intestazione la disegna chi disegna quella di tutte le altre pagine, o
  sarebbero le uniche a vedersi come pagine di serie B. Il limite è otto: la
  barra ne tiene già sedici, e la trentesima non si vedrebbe più.

- **Il radar meteo, sopra le previsioni dei sette giorni.** «Visualizzare il
  radar riferito alla zona prescelta (tramite longitudine e latitudine o
  comune) e nel relativo raggio di 30 km.» Il motore è aritmetica — Web
  Mercator, la proiezione di tutte le mappe a tessere — e da un punto e da un
  raggio ricava lo zoom e i quadratini da scaricare, col punto scelto al
  centro. Il posto si sceglie in tre modi e nessuno chiama nessuno: le
  coordinate scritte a mano, una **zona di Home Assistant** — hanno un nome e
  delle coordinate, e sono la risposta al «oppure il comune» — oppure, se non
  si dice niente, casa. Raggio trenta chilometri di serie.

  L'immagine può arrivare da un'entità `camera.*` o `image.*` del proprio Home
  Assistant, e allora da casa non esce niente; oppure da un servizio di
  tessere, con il suo indirizzo a modello `{z}/{x}/{y}`. Quell'indirizzo lo
  mette chi installa e non lo mettiamo noi: cablare un servizio che non si è
  potuto interrogare nemmeno una volta sarebbe spedire una promessa. Al suo
  posto c'è un tasto **Prova**, che scarica un quadratino vero e dice se è
  arrivato.

- **Il modulo non chiede piu' niente prima di lasciarti scrivere.** Il blocco
  «Collega GitHub» stava in cima, prima che uno avesse messo giu' una riga. Era
  una serratura davanti alla vetrina: chi la trovava pensava «vabbe', vado su
  GitHub», ed e' esattamente il contrario di quello che questa finestra serve a
  evitare. La segnalazione da fare la si perdeva li'.

  Adesso l'ordine e' l'unico che regge. Tipo, titolo, descrizione, invia — e
  alla pressione la segnalazione **e' gia' salvata in casa**. Solo a quel
  punto, se manca la firma, compare il codice, con scritto perche': «Salvata.
  Manca solo la firma: autorizza GitHub e parte.» L'autorizzazione arriva
  quando ha un motivo, col lavoro gia' al sicuro. Chi si ferma li' non perde
  niente: la bozza resta e parte da sola al primo collegamento.

  Chi vuole collegarsi prima di scrivere puo' ancora farlo: la riga sta in
  fondo a «Le mie», dove si guarda chi si e', non dove si scrive.

- **Il codice si digita una volta sola, e non torna piu'.** Il gettone resta
  nel deposito di Home Assistant — un utente di HA, un account GitHub — e
  sopravvive ai riavvii, alle ricariche e agli aggiornamenti. Non scade,
  perche' l'App e' registrata per non farlo scadere.

- **Il cruscotto guarda tutta la repository.** Mostrava le sole segnalazioni
  nate dalla plancia, riconosciute da una riga invisibile nel corpo. Su questa
  repository sono cinquantuno issue, e quelle nate dalla plancia erano zero: il
  cruscotto era una stanza vuota accanto a una casa piena, e restavano due
  posti da guardare invece di uno.

  Adesso arrivano tutte, e da dove viene ognuna resta scritto — 🏠 dalla
  plancia, 🐙 da GitHub. Non cambia cosa ci si puo' fare: si risponde e si
  chiude identico sulle due. Cambia una cosa sola, ed e' quella che vale la
  pena sapere prima di scrivere: la risposta a una nata dalla plancia torna
  **dentro** la dashboard di chi ha segnalato, quella a una issue aperta su
  GitHub resta dove e' stata scritta.

- **Il filtro «Chiuse», accanto a «Da lavorare».** Due meta' che non perdono
  niente per strada — una prova lo tiene fermo, perche' quello che sfuggisse a
  tutti e due sarebbe uno stato sparito senza che nessuno se ne accorga.

- **Il tipo si legge dal titolo e dall'etichetta.** Non e' un campo di GitHub,
  e si deduce da due posti che qui esistono da prima della plancia: il prefisso
  che i moduli mettono da soli — `[Bug]`, `[Feature]`, `[Aiuto]` — e
  l'etichetta messa a mano, `bug` o `enhancement`. Sulle cinquantuno di oggi
  funzionano tutte e due. Quando nessuno dei due dice niente il tipo resta
  vuoto, con una pastiglia grigia: chiamarle tutte «difetto» sarebbe comodo e
  falso. Il prefisso poi sparisce dal titolo, perche' accanto c'e' gia' la
  pastiglia che lo dice.

- **L'Agenda ha la sua scheda nella configurazione.** «Calendario, per
  configurarlo devi toglierlo dalla parte widget: crea una sezione a se' nel
  menu e metti calendario e cose da fare. Nei widget deve esserci solo
  l'interruttore.» I calendari e le liste ToDo erano finiti nella scheda dei
  widget, che risponde a una domanda sola — quali tessere vedere in Home e in
  che ordine — e per configurare l'agenda bisognava passare di li'. Adesso hanno
  la loro, «📅 Agenda», con i due elenchi uno sotto l'altro; nella scheda dei
  widget restano gli interruttori delle tessere e basta. (#259)
- **E la Continuita' pure.** Le caselle dell'UPS erano una coda della scheda
  «Energia»: «nel config manca completamente la parte per configurare il gruppo
  di continuita'». Non mancava, ma stava dove nessuno la cercava — e senza una
  scheda sua non poteva avere il suo interruttore, perche' la fascia verde
  dell'Energia e' dell'Energia. (#256)
- **La Gestione termica si configura una macchina alla volta.** «La sezione
  solare termico non e' suddivisa con le altre cose aggiunte, caldaia e
  scaldabagno: nel config voglio le sottosezioni per configurare quelle, non
  creare confusione.» Era una colonna sola — tredici caselle di pannelli
  solari, poi lo scaldabagno, poi la caldaia — e chi cercava la sua macchina
  scorreva quelle degli altri. In cima ci sono adesso le stesse linguette che
  ha la pagina, una per macchina spuntata, e sotto c'e' soltanto quella accesa.
  (#253)

- **La finestra puo' avere anche l'inferriata.** «La card delle finestre e'
  fantastica, ma non riesco ad adattarla alla mia situazione perche' non ho le
  tapparelle. Sarebbe possibile una card che consideri due sensori di contatto,
  uno per le inferriate esterne e uno per gli infissi interni?» Accanto al
  sensore dell'infisso c'e' adesso quello dell'inferriata, e la card li disegna
  tutti e due: la grata sta davanti al vetro e si impacchetta di lato, l'infisso
  sta dietro e rientra verso i cardini. I quattro stati si distinguono a colpo
  d'occhio — tutto chiuso, grata aperta, finestra aperta, tutto aperto — e la
  pastiglia dice quale, perche' «Aperta» da solo non rispondeva alla domanda per
  cui si sono messi due sensori. Chi non ha inferriate non vede niente di nuovo:
  la casella vuota lascia la card esattamente com'era. (#254)
- **E una riga con le sole grate si salva.** Valeva gia' per il solo contatto
  dell'infisso — «ho le persiane manuali, pero' ho i sensori di apertura» — e
  vale per lo stesso motivo: la riga non comanda niente, ma ha qualcosa da dire.
- **In Home i due contatti sono due righe.** Una grata lasciata aperta e una
  finestra lasciata aperta non sono la stessa notizia, e uscendo di casa e'
  proprio quella la differenza che si vuole leggere.
- **Il verso girato vale per entrambi.** Chi ha un contatto che sta a ON da
  chiuso (#244) lo elenca come sempre: il verso e' un fatto del filo, non del
  tipo di apertura.
- **Lo scaldabagno elettrico ha la sua tessera.** «Ho un impianto fotovoltaico
  ed ho sfruttato uno scaldabagno per l'acqua calda sanitaria. La card attuale
  e' fantastica ma pensata per il solare termico.» Adesso c'e' la sua: le
  quattro caselle chieste — interruttore, temperatura dell'acqua, obiettivo,
  consumo — piu' l'energia di oggi. Il numero grande e' l'acqua, l'anello dice
  quanto manca all'obiettivo, e la tessera si accende mentre la resistenza
  lavora. La differenza col solare non e' la forma della card: li' il calore
  arriva dal sole e si guarda il salto fra le sonde, qui arriva da una
  resistenza che si paga e si guarda quando ci sara' l'acqua calda. (#253)
- **E con un `water_heater` di Home Assistant non c'e' niente da compilare.**
  Basta la prima casella: stato, temperatura e obiettivo li dichiara l'entita'
  stessa, e «Rileva da Home Assistant» la trova da sola. Le altre restano per
  chi lo scaldabagno se l'e' messo insieme da un rele' e due sonde.
- **L'obiettivo si legge anche da un termostato.** «Target preso dall'entita'
  del termostato»: li' l'obiettivo non e' lo stato — lo stato e' la modalita' —
  ma un attributo, e la casella lo cerca in tutti e due i posti.
- **La sezione termica ha tre anime, non una.** Si chiamava «Solare termico» e
  disegnava un impianto solo: pannello sul tetto, pompa, accumulo. Ma l'acqua
  calda in casa la fanno tre macchine diverse — il sole, una resistenza, una
  caldaia a gas — e quasi nessuno ne ha una sola: chi ha il fotovoltaico e lo
  scaldabagno apriva quella pagina e ci trovava un pannello che non ha. Adesso
  nella scheda Solare si spunta quello che si ha davvero, e la pagina prende la
  forma di quello che si e' spuntato. Con due o tre compaiono in alto le
  linguette, le stesse di Freddo e Caldo nella pagina Clima. (#253)
- **Due scene nuove, nella stessa lingua della prima.** Lo scaldabagno ha il
  suo serbatoio in piedi, con l'acqua calda che sale dal fondo — l'altezza del
  riempimento e' quanto manca all'obiettivo — e le tre spire della resistenza
  che si accendono quando lavora. La caldaia ha la scocca a muro con la fiamma
  nell'oblo', la mandata e il ritorno che corrono al radiatore e il salto fra i
  due, che e' la misura che dice se l'impianto sta davvero cedendo calore.
- **La pressione bassa si vede prima di accorgersene.** Sotto il bar la
  targhetta batte e compare la riga che dice perche': e' l'unica cosa di quella
  pagina che ogni tanto chiede di alzarsi dal divano.
- **La pagina si chiama come la macchina che si sta guardando.** «Impianto
  solare termico» sopra una caldaia era il nome di un'altra macchina.
- **Chi non sceglie non perde niente.** Una plancia gia' configurata col solare
  continua a mostrarlo esattamente come prima: la domanda e' nuova, e le
  risposte di ieri valgono ancora.
- **La sezione si chiama «Gestione termica».** Il nome vecchio era quello di
  una delle tre macchine: chi ha solo la caldaia trovava la sua dentro una voce
  che parlava di pannelli solari. Cambia nella barra in basso e nella scheda
  della configurazione; chi la sezione se l'era rinominata a mano tiene il nome
  che ha scelto.
- **Anche la caldaia ha la sua tessera e la sua finestra.** Il numero grande e'
  la mandata, la didascalia il salto fra mandata e ritorno — che e' la misura
  per cui si guarda una caldaia — e la pressione sotto il bar accende la
  tessera e la fa comparire fra quelle che chiedono attenzione. La finestra
  dice perche': «l'acqua gira senza cedere calore» quando mandata e ritorno
  sono quasi uguali, «sotto il minimo, la caldaia puo' bloccarsi» quando manca
  pressione.
- **Con tutti e tre gli impianti le tessere sono tre**, ognuna con la sua
  finestra, e tutte e tre portano alla stessa sezione: da li' si passa
  dall'una all'altra con le linguette.
- **Senza sonde funziona lo stesso, ed e' una scelta libera.** «Prevedi sia per
  la caldaia che per lo scaldabagno anche il semplice utilizzo senza sonde di
  temperatura.» Nessuna casella e' obbligatoria. Con il solo interruttore lo
  scaldabagno dice acceso e spento, il serbatoio si riempie tutto e parla il
  colore — caldo mentre la resistenza lavora, acciaio quando e' ferma —
  invece di mostrarsi vuoto, che sarebbe dire «non c'e' acqua calda». Con il
  solo stato la caldaia accende il suo oblo' e mostra il circuito che si
  scalda.
- **E le targhette senza numero non si disegnano.** Cinque riquadri con «--»
  non sono una scheda spoglia: sono cinque promesse non mantenute. Le caselle
  che non ci sono non lasciano un buco, lasciano posto.
- **La pastiglia nomina quello che sta davvero leggendo.** Chi mappa il
  bruciatore legge «bruciatore acceso»; chi mappa solo lo stato legge «caldaia
  accesa», perche' un bruciatore che nessuno ha mappato non si puo' citare.

- **Segnala un difetto, proponi un'idea, chiedi aiuto — dalla Configurazione.**
  Fino a ieri, per segnalare qualcosa, bisognava uscire da Home Assistant,
  aprire GitHub, farsi un account se non ce l'aveva, e compilare un modulo che
  chiede la versione dell'integrazione — che chi segnala non sa, e che la
  plancia invece conosce benissimo.

  Adesso c'e' una tessera in Configurazione. Il modulo e' in tre passi, e il
  primo e' la domanda che conta: **di che si tratta**. Tre schede con la loro
  spiegazione — «Non funziona», «Vorrei che facesse», «Non ci riesco» — perche'
  la differenza fra un difetto e un'idea la sa chi scrive solo se gliela si
  racconta, e una segnalazione ben incasellata e' meta' del lavoro di chi la
  legge. Titolo e descrizione cambiano suggerimento col tipo scelto: a chi
  chiede aiuto non si domanda «cosa ti aspettavi».

- **La diagnostica la compila la plancia.** Versione dell'integrazione,
  versione di Home Assistant, lingua, pagina, browser: le cose che lei sa e chi
  segnala no. Si vedono tutte prima di premere invia, sotto «cosa parte» —
  quello che esce di casa non e' una cosa da far scoprire dopo.

- **Serve il tuo account GitHub, ed e' quello che hai gia'.** La plancia si
  scarica da HACS, e HACS un account GitHub lo chiede gia' — con la stessa
  identica autorizzazione, il codice da digitare su `github.com/login/device`.
  Chi e' arrivato fin qui quel giro l'ha gia' fatto una volta.

  Il gettone resta nel backend di Home Assistant e non passa mai dal browser.
  Si scollega dalla plancia, e si revoca del tutto da GitHub.

- **La risposta torna dentro la plancia.** La segnalazione diventa una issue a
  tuo nome; quando arriva una risposta, lo stato cambia da solo — «presa in
  carico», «risolta», «archiviata» — e la risposta si legge da «Le mie», senza
  chiedere niente a nessuno.

- **Foto e video.** GitHub non ha un'API per allegarli a una issue, e non e'
  una svista: e' una scelta loro, per contenere gli abusi. Quindi la plancia
  non finge di spedirli — appena la segnalazione e' aperta, un tasto porta alla
  sua pagina, dove si trascinano nel riquadro della risposta. Il momento e'
  quello giusto: chi ha appena scritto ha ancora il file sotto mano.

- **Una issue e' una pagina pubblica, e la plancia lo dice** sopra il tasto
  invia, non dopo. L'unica cosa che non parte mai e' il recapito: chi scrive il
  proprio indirizzo lo scrive a una persona, non a una pagina indicizzata.

- **La Diagnostica dice quando la plancia e' pronta, e dove va il tempo.** La
  riga «Boot» mostra quanto ci mette il velo ad andarsene, quando e' arrivato
  l'ultimo file, e quanto tempo passa DOPO che la rete ha finito. Se il grosso
  sta prima e' la rete; se sta dopo sono analisi ed esecuzione, dove ne' il
  pacchetto ne' la compressione arrivano. Serve a smettere di tirare a
  indovinare su una macchina che non e' la mia.

- **La plancia arriva in un pacchetto, non in centosettantanove file.** «Impiega
  ancora troppo tempo in caricamento, soprattutto in primo avvio.» Non era il
  velo: al primo avvio il browser scaricava centosettantanove file JavaScript
  per quattro megabyte. Non in fila — il documento li precarica tutti insieme —
  ma su HTTP/1.1 il browser ne serve sei per volta, ed erano una trentina di
  ondate prima di avere tutto. Adesso sono tre file. Restano fuori i tredici
  cataloghi delle lingue, quasi due megabyte a una casa che ne parla una sola:
  arriva solo quella che serve. Se il pacchetto manca, la plancia parte lo
  stesso dai sorgenti — e la Diagnostica runtime dice quale delle due strade sta
  usando.

### Cambiato

- **La finestra di una tessera ha smesso di tremolare.** Non era un difetto di
  disegno ma di composizione: la card e il velo sfocato stavano nello stesso
  strato, e ogni valore che cambiava dietro obbligava il browser a rifare
  l'intero riquadro sfocato. Il velo e' passato a uno pseudo-elemento — la card
  gli e' sorella, non figlia — e le animazioni che restano dietro si mettono in
  pausa mentre la finestra e' aperta.

- **La stanza si mostra col suo nome, mai col suo identificativo.** «Verifica
  inoltre perche' esce sotto room etc»: sotto «Tapparella salone» c'era scritto
  «🏠 room_mt8vpz7m». La tendina salva l'id — e' l'unica cosa che regge un
  rinominamento — ma gli elenchi del guscio stampano quello che trovano. E c'e'
  la meta' che non si vedeva: con un id in mano la domanda «di che piano e'
  questa stanza?» tornava «nessuno», e le tapparelle di una casa a due piani
  finivano tutte nello stesso gruppo.

- **Nella scheda Finestre la stanza sta in alto, accanto al nome**, con la sua
  etichetta: stava in fondo, senza dire cosa fosse.

- **Il MiniPC dice OFFLINE solo quando qualcuno gliel'ha detto.** Con tutto
  configurato e l'internet acceso scriveva OFFLINE: le caselle equivalenti per
  la connettivita' erano quattro e la card ne leggeva una sola. Adesso **ce n'e'
  una**, si chiama Internet, accetta un `binary_sensor`, uno stato a parole o i
  millisecondi di un ping — e quello che stava nelle altre tre e' stato
  travasato dentro, non buttato. Lo stato sta in alto e la card apre lo storico.

- **La pagina Gestione termica mostra le entita' configurate** (#274): solare,
  scaldabagno e caldaia in una pagina sola, ognuna col suo blocco e i comandi
  dove si vedono i valori.

- **Il Cruscotto separa quelle prese in carico da quelle ancora ferme.**

      «voglio un filtro anche con quelle in lavorazione, voglio capire cosa ho
       preso in carico e quelle ancora da prendere in carico»

  Le tre cifre in cima lo dicevano gia', ma erano numeri da leggere e basta:
  l'unico filtro aperto era «Da lavorare», che le mette insieme. Adesso ci sono
  «Nuove» e «In lavorazione», e sono esattamente quelle due cifre — stesso
  nome, cosi' non si dubita che sia lo stesso numero.


- **Una sezione vuota non sta nella barra.** «tutte le sezioni devono nascere
  come nascoste, solo se si inserisce entita' in una sezione diventa visibile.»

  Meta' della regola c'era gia' e funzionava: alla prima accensione le voci
  nascono spente, e salvare in una scheda riaccende la sezione in cui si e'
  appena messo qualcosa. Mancava l'altra meta', perche' quella derivazione
  corre **una volta sola per chiave**: una sezione svuotata restava nella barra
  per sempre, con la sua pagina vuota dentro, e una accesa da una versione che
  accendeva tutto pure.

  Adesso cosa riempie una sezione e' scritto in un posto solo, e lo leggono
  tutti e due i versi. Lo spegnimento ha tre freni: non tocca una chiave che
  non sa giudicare (Home, Agenda, Continuita', Cruscotto e le sezioni che si fa
  l'utente restano dove sono — le ultime quattro si nascondono gia' da sole, e
  Home e' la pagina dove si atterra); non spegne niente finche' la
  configurazione condivisa non e' arrivata da Home Assistant, perche' prima che
  arrivi ogni sezione sembra vuota; e non torna mai su una scelta fatta a mano.

  Nel farlo l'elenco di cosa conta come «configurato» e' diventato piu'
  completo: la caldaia, le porte dell'antifurto, i programmi della lavatrice, i
  gruppi dell'energia. Erano sezioni che si potevano riempire senza che nessuno
  se ne accorgesse, e adesso che il verso dello spegnimento esiste non
  accorgersene vorrebbe dire farle sparire a chi le aveva configurate.

- **Il Cruscotto non ha piu' l'interruttore.** La fascia verde offre una scelta
  fra vedere una voce e non vederla. Quella voce compare solo a chi tiene la
  repository — «solo a me esce il cruscotto nella navbar, ad utenti normali non
  esce e quindi quel pulsante non ha senso» — e chi la tiene la vuole: era un
  interruttore che una persona sola al mondo poteva toccare, per spegnersi da
  sola la pagina che aveva chiesto. Chi la fascia l'aveva gia' toccata tiene la
  sua preferenza: nessuno si ritrova la voce riaccesa dall'aggiornamento.

- **Un secondo e sei decimi in meno all'avvio.** Profilando la partenza con la
  CPU rallentata quattro volte — un telefono di fascia media — **una sola
  funzione si mangiava 789 millisecondi su 6800**, dentro un modulo che scrive
  tre variabili CSS e non disegna niente.

  Non era il suo codice: erano quindici chiamate a cinquantadue millisecondi
  l'una. Il giro era, per ogni pagina: guarda dove va l'intestazione, scrivila,
  rileggi quanto e' larga. Ogni scrittura invalida lo stile, e ogni lettura che
  le viene dietro obbliga il browser a **ricalcolarlo tutto** prima di
  rispondere. Nove pagine, nove ricalcoli completi.

  Adesso i quattro tempi si fanno per tutte le pagine prima di passare al
  successivo — si legge dove vanno tutte, si scrivono tutte, si misurano tutte,
  si applicano tutte: **due ricalcoli invece di nove**, e la spesa non cresce
  piu' col numero delle pagine. Misurato sullo stesso banco, tre giri per parte:
  **da 6693 a 5060 millisecondi**. Il modulo passa da 789 a 53.

- **Il flusso dell'energia tace, quando non c'e' niente da dire.** E' la cosa
  piu' indaffarata della plancia: gira piu' di una volta al secondo, per tre
  viste, e riscriveva gli attributi di ogni bolla e di ogni linea **col valore
  che avevano gia'**. Un `data-` riscritto uguale e' comunque una scrittura:
  sveglia ogni osservatore della pagina e invalida lo stile del nodo.

  Contate col popup dell'Auto aperto e gli stati fermi: **1777 scritture in
  quattro secondi**, tutte dietro il velo. Adesso sono 297, e quelle che restano
  non sono piu' del flusso.

### Rimosso

- **La tessera d'avviso «Porte/Finestre».** «Viene gia' gestito da Finestre, se
  li si mette il sensore finestra dice quale e' aperto, quindi e' un
  duplicato»: la didascalia della tessera Finestre **nomina** le aperte, non le
  conta soltanto. Se ne vanno con lei il suo gruppo negli avvisi, la sua riga
  nel catalogo delle tessere e il rilevamento automatico che la riempiva.

- **Il campo «come ricontattarti».** Diceva il vero — «resta in casa», e nella
  pagina pubblica non finiva davvero — ma in casa non lo leggeva nessuno: la
  console del manutentore legge GitHub, dove quel campo non arriva mai.
  Chiedere un indirizzo e-mail per poi non farne niente e' la peggiore delle
  tre strade possibili: si conserva un dato personale, non serve a nessuno, e
  chi lo scrive crede di essere raggiungibile. La risposta arriva sotto la
  segnalazione, dove adesso si scrive nei due sensi, e il campanello avvisa
  quando c'e'.

  I recapiti gia' scritti spariscono dal disco alla prima accensione: toglierlo
  dal modulo non sarebbe bastato, perche' quello che era gia' stato scritto
  sarebbe rimasto li' finche' quel ticket non cadeva dal fondo dello store.

### Corretto

- **Il radar meteo usciva anche senza essere stato configurato, e
  configurato non diceva la verita'.**

      «radar da errore quando non configurato non deve uscire proprio e anche
       quando configurato da errore»

  Due difetti nello stesso riquadro, e il secondo nascondeva il primo.

  Senza configurazione il blocco nasceva comunque e poi si metteva `hidden` —
  che non basta: `hidden` e' l'ultima riga del foglio del browser, e sopra
  c'era una regola nostra col `display` che la batte. Dentro le previsioni
  restava un rettangolo grigio con l'immagine rotta e scritto «il radar non
  sta rispondendo»: un errore per una cosa che nessuno aveva chiesto. Adesso
  il posto dove disegnare non si fabbrica nemmeno.

  Configurato, il blocco si diceva «vivo» contando le immagini **create**, che
  e' un'altra cosa da quelle **arrivate**: se il servizio non risponde i
  quadratini se ne vanno uno per uno, il riquadro resta vuoto, e la frase che
  spiegherebbe restava nascosta perche' il blocco si dichiarava sano. Adesso
  si contano i caricamenti veri: finche' sono in volo non si mostra ne'
  l'immagine rotta ne' la frase, al primo che arriva il radar e' vivo, e se
  non arriva nessuno lo dice — e si prepara a riprovare al giro dopo.

- **Il cerchio di un carico diceva 0,2 kWh e la sua finestra 12,0.** Lo stesso
  difetto della beta.11, tornato con un numero al posto dello zero.

      «calcolo energia giornaliera e mensile su elettrodomestici di nuovo
       sbagliata»

  La regola scritta allora guardava lo zero, e 0,2 non e' zero. Ma zero non
  era la cosa da guardare: una pinza sulla linea, per come e' fatta, misura
  tutto quello che le passa sotto, e il suo numero **non puo' essere piu'
  piccolo della somma di cio' che ha dentro**. Se lo e', quella casella non
  sta misurando il gruppo — sta misurando altro, di solito un apparecchio solo
  finito li' per sbaglio.

  Adesso vince la somma, che e' il numero che la finestra mostra. Con un
  margine del cinque per cento, perche' la pinza e i contatori dei figli non
  leggono nello stesso istante e senza margine il cerchio ballerebbe avanti e
  indietro per qualche secondo di ritardo.

- **Sulla riga della Wallbox due numeri si contraddicevano guardandosi.**

      «valori wallbox nel report sballati»

  In Attivita' dispositivi: «1188,7 kWh dal sole e 184,0 dalla rete» e, tre
  centimetri a destra sulla stessa riga, «0,0 kWh». Millequattrocento
  chilowattora in un mese, per un'auto che in quel mese non aveva caricato.

  Il guscio disegna il numero a destra e la quota sotto dallo stesso valore, e
  finche' li scrive lui sono d'accordo. Poi la plancia riscriveva **meta'
  riga**: correggeva il numero a destra col valore del Recorder e lasciava la
  quota calcolata sul contatore di vita della colonnina. Adesso chi possiede
  il numero possiede la riga.

- **Lo storico della connettivita' diceva «Failed to fetch».**

      «storico internet da errore»

  «Failed to fetch» non e' una risposta: non e' un 401 e non e' un 404, e' una
  richiesta che non e' mai arrivata da nessuna parte. Sulla stessa richiesta
  c'erano tre guasti, e ognuno da solo bastava.

  Home Assistant ospita la plancia in una cornice che eredita l'origine di chi
  la contiene ma non il suo indirizzo: da li' la plancia **non sa dove sta**, e
  il guscio, per costruire l'indirizzo a cui chiedere, indovina. Misurato
  dentro la cornice: `http://homeassistant.local:8123` — il nome giusto in una
  casa su cento, e in tutte le altre un host che non esiste, o che parla in
  chiaro mentre la pagina viaggia in https, e allora il browser blocca senza
  nemmeno provarci. Poi: la plancia ospitata non ha un gettone ma un segnale
  che dice «i cookie bastano», e spedirlo come credenziale si prende un 401 su
  una richiesta che sarebbe passata da sola. E infine la domanda nominava una
  **casella della plancia** invece dell'entita' che ci sta dentro, che il
  Recorder non conosce.

  Adesso le domande a Home Assistant partono da casa: l'indirizzo si risolve
  contro il documento che ospita — che e' il motivo per cui tutto il resto
  della plancia ha sempre funzionato — l'autorizzazione finta non parte, e la
  casella diventa la sua entita'. Una plancia che il suo indirizzo ce l'ha, o
  che e' stata aperta da un file su disco, non viene toccata.

  Lo stesso rimedio ripara un'altra chiamata rotta dalla stessa causa: quella
  che trasforma i contatori di vita in «oggi» e «questo mese». Falliva in
  silenzio, ed e' da li' che arrivavano i chilowattora della Wallbox.

- **Nel cruscotto i filtri non si selezionavano.**

      «tab nel cruscotto tiket non funziona non mi fa selezionare difetti etc e
       nemmeno in lavorazione»

  I tasti erano collegati e il tocco arrivava. Ma il ridisegno cominciava
  cercando la finestra delle segnalazioni e, non trovandola, tornava indietro
  prima di arrivare alla riga che ridisegna il cruscotto. Quella finestra la
  costruisce chi apre la tessera in Configurazione: chi arriva al cruscotto
  dalla barra non la tocca, quindi nel documento non c'e' — e non ci deve
  essere. Il filtro non rispondeva **mai** a chi usava la pagina per quello per
  cui esiste; rispondeva soltanto a chi, nella stessa sessione, avesse aperto e
  chiuso la finestra almeno una volta.

  E non erano solo i filtri: dietro lo stesso ridisegno ci sono il filo che si
  apre, la risposta appena mandata, la segnalazione chiusa. Sul cruscotto
  nessuna di quelle si vedeva finire. Adesso la finestra e la pagina sono due
  disegni indipendenti, e chi non ha un posto dove stare non impedisce
  all'altro di esistere.

  Le fotografie della galleria non se ne erano accorte perche' seminavano il
  filtro gia' scelto prima di far disegnare la pagina: nella foto il filtro era
  acceso senza che nessuno l'avesse mai premuto. La prova nuova preme davvero.

- **Le foto si caricano in ogni formato tranne SVG.** Un SVG e' un
  documento, non una bitmap, e puo' portare uno script: Home Assistant lo
  serve da `/local/` sulla propria origine, dove stanno i gettoni di chi lo
  apre. Da quello sportello passano solo formati che il browser disegna e non
  esegue; quelli gia' in `www` restano elencati nel selettore.

- **I comandi di configurazione rispettano la lista utenti della plancia
  giusta.** Il profilo e' un campo libero: con due plance e due liste diverse,
  chi era in lista sulla seconda poteva chiamare `config/get` e `config/set` a
  mano col profilo della prima — leggerla, e azzerarla. Adesso il permesso si
  chiede sulla plancia che quel profilo porta davvero.

- **Aprire il filo di una segnalazione chiede lo stesso permesso degli altri
  comandi.** Era l'unico senza: la issue e' pubblica, ma aprire il filo spegne
  il pallino di tutta la casa, e chi non puo' usare la plancia non deve
  spegnere i pallini degli altri.

- **Un'entita' aggiunta a mano non spegne piu' la sua sezione.** La regola
  delle sezioni vuote non leggeva `cd_entita_mie`: una sezione che viveva
  solo di quelle risultava vuota, e il salvataggio dell'entita' appena
  aggiunta la toglieva dalla barra — proprio la sezione dove la si era messa.

- **Le porte non tengono in barra la scheda Sicurezza.** Dalla 1.4.5 si
  disegnano nella loro pagina, che si accende e si spegne da sola; contarle
  ancora come contenuto di Sicurezza lasciava una scheda vuota a chi ha solo
  le porte.

- **Il campanello delle segnalazioni non suona piu' per cose proprie.** Chi
  aveva gia' una segnalazione e ne apriva un'altra si sentiva annunciare
  «Nuova segnalazione» — la sua — perche' la consegna non lo diceva al
  taccuino. E rispondere a una issue che il taccuino non conosceva alzava il
  segno da zero: al giro dopo gli altri commenti suonavano come nuovi, per la
  propria risposta. Adesso la consegna prende nota, chi apre il filo prende
  nota, e chi risponde a una issue sconosciuta chiede il conto vero.

- **Il filo legge gli ultimi commenti, non i primi trenta.** GitHub li da'
  dal primo in poi, trenta per pagina: dal trentunesimo in poi la risposta
  piu' recente non si vedeva mai, e lo stato dedotto dal commento del
  manutentore restava fermo a settimane prima. Si chiede l'ultima pagina, e
  se non basta anche quella prima.

- **La sincronia delle segnalazioni gira su tutte.** Prendeva sempre le prime
  venti: con ventuno aperte la ventunesima non veniva riletta mai. Ogni giro
  riparte da dove si era fermato quello prima.

- **La chat non scrive piu' su disco a ogni battito.** La finestra aperta
  rilegge ogni quindici secondi, e il segnalibro si salvava lo stesso anche
  quando non si era mosso: una scrittura ogni battito per dire quello che
  c'era gia' scritto. Si salva solo quando cambia qualcosa.

- **Il cestino della coda si disarma chiudendo la finestra.** Un cestino
  armato sopravviveva alla chiusura: riaprendo, «Confermi?» era gia' acceso e
  il primo tocco cancellava.

- **«Domani» e la striscia dei sette giorni nel giorno del cambio d'ora.** La
  tessera era gia' stata corretta; l'etichetta dei gruppi dell'Agenda e la
  striscia sommavano ancora ventiquattro ore. Nel giorno che ne dura
  venticinque «Domani» si chiamava con la sua data e la striscia mostrava oggi
  due volte; in quello che ne dura ventitre' domani si saltava.

- **L'ora d'inizio in inglese tiene il PM.** La didascalia della Home
  tagliava l'intervallo al primo spazio: «02:30 PM – 03:30 PM» diventava
  «02:30», e le due e mezza del pomeriggio si leggevano come le due di notte.

- **Un'installazione dallo zip fallita a meta' non lascia una seconda
  integrazione.** Con il disco pieno durante l'estrazione restava
  `.dashboardmodern-nuovo` dentro `custom_components`, col manifest di questo
  stesso dominio: al riavvio il caricatore poteva preferirla a quella vera.
  La cartella d'appoggio se ne va prima dell'errore.

- **Con due plance, togliere la primaria non lascia piu' un errore nel
  registro.** L'erede ripartiva scoprendosi primaria e allo scarico chiedeva
  di smontare l'avviso di aggiornamento che non aveva mai montato: «Config
  entry was never loaded!» nel registro. Si scarica solo da chi l'ha montato.

- **Due piccole cose del backend.** Un byte nullo nel percorso del selettore
  delle foto non e' piu' un traceback ma una risposta come le altre; e
  l'elenco delle plance legacy si legge nell'executor invece che nel loop.

- **La chat aperta si aggiorna da sola.**

      «la risposta non si refresh devo uscire e rientrare»

  La finestra leggeva una volta all'apertura e poi restava ferma: la risposta
  arrivava solo chiudendo e riaprendo. Il giro dei cinque minuti del backend
  c'era gia', ma quello serve al campanello — suona e basta, non ridisegna
  niente.

  Adesso guarda ogni quindici secondi, e ridisegna soltanto quando e' arrivato
  davvero qualcosa: chi sta scrivendo non si vede rifare la casella sotto le
  dita, e se ridisegna il cursore torna dov'era. Chiusa la finestra non chiede
  piu' niente, cosi' una plancia accesa tutto il giorno in cucina non bussa al
  centralino per una conversazione che nessuno sta guardando.

- **Nella coda di chi risponde le bolle stavano dalla parte sbagliata.**

  Le domande della casa comparivano a destra e in verde — come se se le fosse
  scritte da solo chi stava leggendo — e le proprie risposte a sinistra e in
  grigio: una conversazione letta al contrario. «Mio» dipende da chi guarda, e
  questa finestra la guardano in due.

- **Il cruscotto non lo metteva nessuno.** La funzione che crea la voce nella
  barra e la sua pagina era scritta, esportata e appesa a
  `DashboardModernSegnalazioni.sistema` — e da li' la chiamava soltanto lo
  script che fa le fotografie della galleria. Nelle foto il cruscotto c'era; in
  una casa vera non compariva ne' nella barra ne' dentro la finestra delle
  segnalazioni, che intanto la sua scheda «console» l'aveva persa. E' il modo
  peggiore di sbagliare: la galleria che doveva far vedere il lavoro lo faceva
  al posto dell'applicazione, e mostrava una cosa che non esisteva.

  Adesso la mette `ricarica()`, appena sa chi sta guardando — prima di chiedere
  la coda a GitHub, cosi' una rete lenta non la fa comparire in ritardo. E c'e'
  una prova che pretende una chiamata vera dentro il modulo: toglierla di nuovo
  costa una prova rossa invece di un giro di fotografie riuscito.

- **La scheda «Segnalazioni» era illeggibile.** L'interruttore che nasconde il
  cruscotto dalla barra stava dentro la scheda della configurazione, e quel
  markup e' un `<button style="width:100%">` fatto per stare in cima a un
  pannello dell'editor — e' cosi' che lo usano prese, robot, UPS e agenda.
  Dentro una scheda, che e' una riga in orizzontale, quel «100%» diventava una
  pretesa di tutta la larghezza: il testo accanto si stringeva a **una parola
  per riga**. Si vedeva solo sul telefono di chi la console ce l'ha davvero,
  cioe' su un dispositivo solo al mondo.

  L'interruttore adesso sta nella finestra delle segnalazioni, che e' larga e
  si apre dalla scheda: e' l'unico posto sempre raggiungibile anche quando la
  voce e' nascosta. Dentro il cruscotto sarebbe stato un interruttore che,
  spegnendosi, si porta via la strada per riaccenderlo.

- **Il cerchio degli elettrodomestici segnava 0 mentre la sua finestra diceva
  13,7 kWh.** Sullo stesso schermo, a un tocco di distanza. Il cerchio di
  gruppo ha una regola: il contatore suo — la pinza sulla linea — vince sulla
  somma di quello che ha dentro, perche' e' piu' preciso. E ne aveva una
  seconda: nel Giorno e nel Mese uno zero del contatore vale come misura vera.

  La seconda era stata scritta per non inventare numeri che il contatore del
  gruppo non conferma, ed e' una preoccupazione giusta — solo che proteggeva
  dal pericolo sbagliato. Quando il contatore dice zero e dentro ci sono
  apparecchi che hanno consumato, quello zero non e' una misura: e' una casella
  che non risponde, e il cerchio si mette a contraddire la propria finestra.
  Adesso lo zero cede alla somma in tutti e tre i periodi, come gia' faceva nei
  watt.

  Il caso che la vecchia regola difendeva non aveva bisogno di una regola: il
  carico che oggi non e' partito ha i figli a zero anche loro, la somma fa
  zero, e zero resta.

  E il paniere del Recorder adesso risolve anche gli apparecchi **nascosti dal
  Report**. `show_in_report: false` dice «non voglio vederlo nel Report», e per
  il Report va benissimo; ma un apparecchio nascosto li' puo' stare lo stesso
  dentro un cerchio di gruppo, e se il suo unico strumento e' un contatore di
  vita il periodo glielo puo' dare solo il Recorder. Erano due domande diverse
  — «cosa disegna il Report» e «da dove leggo i periodi del flusso» — infilate
  in una risposta sola. Il Report non se ne accorge: quello che si allarga sono
  i valori, indicizzati per entita', non l'elenco che il Report disegna.

  E il paniere del Recorder risolve anche gli apparecchi, non i soli
  carichi: i figli di un cerchio di gruppo sono apparecchi, e cercarli in un
  paniere che contiene solo i carichi voleva dire una somma che non trovava
  niente.

- **La coda che non arriva adesso lo dice.** Il giro zitto — quello che la Home
  fa da sola per la tessera — inghiottiva l'errore per non mettere un avviso
  rosso in faccia a chi non aveva chiesto niente. Giusto, ma «zitto» era
  diventato «fai finta di niente»: il cruscotto restava una pagina vuota e la
  tessera in Home non compariva, tutte e due senza una parola sul perche'.
  Adesso il motivo si scrive comunque, e il cruscotto lo mostra invece di
  restare bianco.

- **La risposta della console non partiva piu'.** Da quando il cruscotto e'
  una pagina della barra invece di una finestra, il campo del testo veniva
  cercato dentro la finestra — dove non c'e' piu' — e «Rispondi» usciva alla
  riga dopo senza dire niente. I tasti che chiudevano e basta continuavano a
  funzionare, il che rendeva il guasto ancora piu' difficile da vedere.

- **«In lavorazione» era una supposizione.** Lo stato si deduceva dal fatto che
  qualcuno avesse commentato, perche' un segno vero non c'era, e sbagliava nel
  verso peggiore: bastava una domanda di chiarimento per far risultare presa in
  carico una segnalazione che nessuno aveva ancora guardato. Adesso il segno lo
  scrive il tasto, e i commenti tornano a essere commenti.

- **Le segnalazioni aperte dalla plancia adesso hanno la loro etichetta.**
  Arrivavano nude accanto a quelle dei moduli di GitHub, che l'etichetta se la
  prendono da sole. Non era una dimenticanza: GitHub le scarta quando a
  scriverle e' chi sulla repository non ha i permessi — cioe' esattamente chi
  segnala — e mandarle sarebbe stato scrivere una riga che non arriva. Adesso
  le mette un workflow della repository, che i permessi ce li ha: legge il
  prefisso del titolo e applica `bug`, `enhancement` o `question`. Chi
  un'etichetta ce l'ha gia' non si tocca.

- **Le risposte si vedono aprendo la finestra, senza premere niente.** Aprirla
  leggeva solo quello che c'era in casa: le risposte scritte su GitHub
  arrivavano premendo «Aggiorna», o al giro di mezz'ora. Chi apriva le proprie
  segnalazioni per vedere se c'era una risposta — cioe' l'unico motivo per cui
  uno le apre — trovava quello che gia' sapeva, e doveva chiudere e riaprire la
  plancia. Adesso l'apertura se le va a riprendere da sola, al massimo una
  volta al minuto, senza rotella e senza avvisi se la rete e' giu': chi ha solo
  aperto una finestra non ha chiesto niente.

- **Quando GitHub rifiuta, adesso si legge perche'.** Un `403` usciva come
  «permessi o limite orario»: due strade opposte dietro una frase sola — una si
  risolve con un'installazione, l'altra aspettando — e a chi legge restava il
  compito di indovinare. Con ogni rifiuto GitHub manda un `message` che quasi
  sempre e' esatto («Resource not accessible by integration»), e veniva buttato
  via. Adesso arriva fino alla riga sotto la segnalazione.

- **La tessera compariva per caso, o non compariva.** La Home si disegna mentre
  la richiesta verso GitHub e' ancora per aria, e a quel punto il sommario e'
  nullo: la tessera non veniva messa, e restava fuori fino al primo evento che
  facesse ridisegnare la griglia per un'altra ragione. Adesso l'arrivo della
  coda e' esso stesso l'evento.

- **E i suoi conti restavano fermi.** La soglia dei dieci minuti era un freno,
  non un orologio: diceva «non richiedere se hai gia' chiesto da poco», e in una
  plancia lasciata aperta su un tablet nessuno chiedeva piu' niente. Adesso c'e'
  un battito che quei dieci minuti li conta — solo per chi ha la console, e
  fermo mentre la pagina non si vede.

- **«Apri il cruscotto» sembrava non fare niente.** Le due finestre stanno sullo
  stesso piano e la piu' giovane copre l'altra: il cruscotto si apriva dietro
  quella della tessera. Adesso la tessera chiude la propria prima che l'altra
  si apra.

- **Le finestre Giornaliera e Mensile mostrano il periodo, non l'istante.** «I
  popup giornaliera e mensile non riportano i dati corretti: portano quelli
  attualmente in consumo.» La finestra sapeva in che periodo era stata aperta —
  lo scriveva perfino in testata, GIORNO, MESE — e poi mostrava i watt di
  adesso, con sotto «kWh oggi» anche guardando il mese: il periodo decideva la
  scritta e non i numeri. Adesso decide i numeri. In Istantaneo resta com'era —
  watt grandi, kilowattora di oggi sotto — e nel Giorno e nel Mese si invertono:
  il numero grande è l'energia di quel periodo, sotto ci sono i watt di adesso.
  Anche il totale in testata, l'ordine delle carte e le barre seguono il periodo
  che si sta guardando.
- **E il cerchio degli elettrodomestici non segna più zero.** «Segna 0, non il
  valore reale giornaliero e mensile» — mentre la sua stessa finestra sommava
  chilowattora veri. Il flusso cercava il contatore del periodo in una casella
  sola (`daily_energy_entity`), la finestra ne guardava anche un'altra
  (`daily`), e un apparecchio nato dal guscio vecchio ha la seconda e non la
  prima: il cerchio non trovava niente da sommare e restava a zero. È la stessa
  disparità già sanata per i watt, dove le caselle guardate sono cinque; qui
  erano rimaste una. Il contatore proprio del gruppo, quando c'è, continua a
  comandare sulla somma — anche quando dice zero, perché nel Giorno e nel Mese
  uno zero è una misura vera.
- **La casella «Entità caldaia» adesso dice a cosa serve.** Il suo titolo dice
  di che tipo è — «switch, facoltativa» — e non a cosa serve. Sotto c'è ora la
  riga che lo dice: è l'entità che rileva il consenso di accensione e
  spegnimento della caldaia.
- **E lo Stato termico dice cosa sono le sue voci.** Parlava di «voci sotto le
  stanze del popup Caldo», cioè del posto in cui vanno a finire, che si scopre
  dopo. Adesso dice quello che serve sapere prima: sono le entità della parte
  termica di cui vuoi sapere se sono accese o spente.
- **E l'icona scelta si vede.** Nella stessa riga la casella dell'icona era
  larga dieci pixel: il tasto del catalogo se ne prendeva quarantadue su
  cinquantadue, e di quello che si era scelto non restava niente da vedere —
  solo il tasto blu, che sembrava dire «icona non impostata».
- **Nel popup dei carichi ogni elettrodomestico ha il suo disegno.** «Le icone
  riportate non sono quelle inserite»: otto apparecchi e otto prese uguali. Il
  tipo — lavatrice, forno, frigorifero — arrivava fin dentro la finestra e
  veniva buttato via, e restava il ripiego. Adesso c'e' il ritratto del
  catalogo, lo stesso che mostrano la sezione Elettrodomestici e l'elenco della
  scheda Carichi: due posti che parlano della stessa lavatrice devono mostrare
  la stessa lavatrice. Chi un tipo non ce l'ha tiene il carattere che aveva.
- **Un'apertura senza entita' adesso dice che non si vedra'.** «Se si creano
  piu' aperture scompare l'interruttore del widget e non compare nel widget.»
  Il meccanismo era sano — provate due aperture con la loro entita', tutte e
  due hanno l'interruttore e tutte e due si vedono — ma una riga senza entita'
  non compare da nessuna parte, e lo diceva soltanto con un «nessuna entita'»
  grigio identico a ogni altro dettaglio. Adesso lo dice per intero, e si vede
  che e' un avviso.

- **La Gestione termica parlava italiano anche in francese.** Scegliendo la
  lingua, la barra passava a Maison, Programme, Énergie — e in mezzo restava
  «Gestione termica». Non era una voce sola: erano nove parole, tutto il
  vocabolario di quella sezione, e nessuna arrivava ai cataloghi. La regola
  scritta nell'architettura presa dalla parte sbagliata — il raccoglitore
  guarda `src/sections/`, e quelle coppie vivevano nel nucleo. Il raccoglitore
  aveva già la valvola per i moduli puri con tabelle bilingui; il modulo
  termico ci entra, e le due coppie che restavano fuori — sciolte, una per
  conto suo — sono andate nelle mappe dei casi che ricoprono.

- **Due cose diverse non si chiamano più tutte e due «Aperture».** «Cambia nome
  ad Aperture nei widget dove si inseriscono i sensori porta: chiamali
  Porte/Finestre, altrimenti si confonde con le altre aperture. Quelle nella
  sezione Sicurezza chiamale comandi apri porte/cancelli.» I contatti che
  dicono se una finestra è aperta e i pulsanti che aprono un cancello portavano
  lo stesso nome. Il nome nuovo arriva anche dove lo stampa il guscio
  vendorizzato — l'intestazione della fisarmonica e la voce del menu del Quadro
  Avvisi — e il nome vecchio resta come **alias**: quella tabella è quello che
  stampiamo *e* quello con cui riconosciamo le righe già salvate, e
  rinominarla e basta faceva perdere il gruppo a ogni riga. Un avviso senza
  gruppo, al riavvio, sparisce.

- **Una finestra che non sa da quando non dice più il primo gennaio 1970.** «6
  aperte su 10… la più vecchia da 20698 giorni.» Chi costruisce le righe mette
  `daQuando: null` quando Home Assistant non dice da quando, e la guardia
  sembrava giusta: finito, e non nel futuro. Ma `Number(null)` fa zero, e zero
  è finito e minore di adesso. Non sapere da quando è una risposta: quella riga
  non entra nel conto, e se nessuna lo sa la frase finisce dopo il conto delle
  aperte.

- **Vuoto non è l'equatore.** Nel radar, `Number("")` fa zero, e zero è una
  latitudine buonissima: quella dell'equatore. Una casella lasciata vuota
  diventava un punto nell'oceano al largo dell'Africa, e il radar ci andava
  davvero — con la faccia di uno che ha fatto quello che gli era stato chiesto.

- **Nella barra le sezioni proprie stanno prima di Config.** Config è la voce
  che si tocca di rado, e lasciarla in mezzo alla fila metteva le sezioni di
  casa dietro l'impostazione: prima le stanze, poi gli attrezzi.

- **E nel menu stretto della configurazione i nomi lunghi non si troncano più a
  metà parola.** «Comandi apri porte/cancelli» diventava «Comandi apri porte/».
  Lì va la stessa cosa detta corta — «Apri porte/cancelli» — come
  «Elettrodom.» sta per «Elettrodomestici»; in testa alla sezione il nome resta
  per esteso.

- **Un appuntamento per domani non e' un trattino.** «Ho creato un appuntamento
  per domani ma sia nel widget che nel popup esce un —.» Il numero grande
  dell'Agenda contava soltanto oggi, e a oggi vuoto si arrendeva: un trattino —
  che vuol dire «non lo so» — sopra una didascalia che diceva «Domani 12:00 ·
  afsfsf». Negava a caratteri grandi quello che affermava a caratteri piccoli.
  Adesso guarda avanti: «1 domani» quando il primo cade domani, «3 in arrivo»
  quando cade piu' in la' — scrivere il giorno vorrebbe dire «venerdi' 4
  settembre» al posto di un numero, e quando cade lo dice gia' la riga sotto. Il
  trattino resta soltanto per quando non c'e' davvero niente, dove e' vero.
- **«TODO.LISTA_DELLA_SPESA» non e' un nome.** Chi non scriveva un nome nella
  scheda si ritrovava l'entity_id crudo in cima al blocco delle cose da fare,
  per giunta gridato in maiuscolo dal vestito del titolo. Il nome ce l'ha gia'
  Home Assistant — `friendly_name` — ed e' quello che l'utente ha scritto di
  la'. Vale per le liste, per i calendari nella legenda e per il calendario
  scritto sotto ogni impegno. Senza nemmeno quello resta l'indirizzo, ma
  ripulito: stanghette in spazi e la prima lettera alzata.
- **La console si apre e mostra le segnalazioni.** Il corpo delle risposte di
  GitHub veniva letto con `StreamReader.read(n)`, che non legge n byte: aspetta
  che il buffer non sia vuoto e restituisce quello che ci trova, cioe' il primo
  pezzo arrivato. Su una risposta corta — una issue, un commento — il primo
  pezzo e' tutto, e per questo ogni altra cosa funzionava. Sull'elenco delle
  issue di una repository viva no: il corpo arrivava mozzato a meta',
  `json.loads` falliva, e la console diceva «Risposta illeggibile» su una
  risposta che GitHub aveva mandato intera.

  Adesso si legge fino alla fine, un pezzo per volta, e il tetto dei 512 KB si
  controlla mentre si legge: chi lo supera lo sente dire, invece di ritrovarsi
  un troncamento travestito da JSON rotto — che e' il modo peggiore di
  superarlo, perche' manda a cercare il guasto dove non e'.

- **E la pagina scende da cento a cinquanta.** Una issue nell'elenco pesa
  qualche kilobyte fra indirizzi, autore, etichette e reazioni: cento sfiorano
  quel tetto, e sfiorarlo vorrebbe dire una console che il giorno delle
  centouno issue smette di aprirsi per un motivo che con le segnalazioni non
  c'entra niente. Il numero di pagine non e' un limite a cosa si vede — il
  ciclo va fino in fondo — quindi una pagina piu' piccola costa una richiesta
  in piu', non una riga in meno.

- **«Domani» resta domani anche nel giorno in cui cambia l'ora.** Era «adesso
  piu' ventiquattro ore», e le due cose coincidono quasi sempre — per questo la
  differenza si scopriva tardi. Il giorno in cui si torna all'ora solare ne
  dura venticinque: a mezzanotte e mezza, sommandone ventiquattro, si resta
  sulla stessa data, «domani» diventava uguale a «oggi», e l'appuntamento di
  domani finiva contato fra quelli piu' in la'. Cioe' proprio il trattino da
  cui questa tessera era partita, che sarebbe ricomparso due volte l'anno.
  Adesso i giorni si contano come li conta il calendario.

- **Le sezioni che non si potevano nascondere.** «Verifica tutta la repository e
  vedi dove nella sezione c'e' il tasto "visibile e nascondi": lo deve
  nascondere dalla navbar, in alcuni casi non funziona.» Aprendo la
  configurazione scheda per scheda e toccando ogni fascia verde, il meccanismo
  si e' rivelato sano: dove la fascia c'era, spegneva. Non funzionava dove la
  fascia non c'era — l'Agenda e la Continuita' avevano una voce nella barra e
  nessuna scheda dove metterla, e quelle due voci non si potevano togliere in
  nessun modo. Adesso ce l'hanno, e una prova nuova bussa a chi domani aggiunge
  una pagina alla barra senza dire dove si spegne.
- **«Solare» che diventa «Gestione termica» sotto gli occhi.** «Appena apro si
  legge solare, poi cambia in gestione termica.» La linguetta la scrive il
  guscio quando costruisce il pannello, e col nome vecchio: la rinominavamo al
  primo ridisegno, cioe' un istante dopo averla mostrata com'era. Adesso la
  riscrittura avviene nel momento esatto in cui il pannello nasce, prima che
  venga disegnato.
- **Il titolo si prende davvero.** «Manca il titolo» anche a chi il titolo
  l'aveva appena scritto: la finestra e il campo si chiamavano tutti e due
  `dm-tkt-titolo`, e `querySelector` restituisce il primo in ordine di
  documento — l'intestazione, che essendo un `<div>` non ha nessun valore da
  leggere. Il campo adesso ha un id suo. Di rimbalzo tornano a posto altre due
  cose che dipendevano dallo stesso equivoco: premere l'etichetta «Titolo» ora
  da' fuoco al campo, e cambiare linguetta non svuota piu' la bozza. Un id
  ripetuto e' HTML non valido, e si rompe cosi': in silenzio, lontano dal punto
  in cui e' stato scritto.
- **La colonna «In lavorazione» non e' piu' sempre zero.** Chi ha commentato,
  nell'elenco, GitHub non lo dice — e chiederlo vorrebbe dire una chiamata per
  ogni riga. Vale allora il segno che c'e': un'aperta su cui si e' gia' parlato
  e' in lavorazione. Nella plancia di chi ha segnalato lo stato resta quello
  esatto, perche' li' il filo si apre per davvero.

- **Gli aperti piu' vecchi non spariscono senza dirlo.** Una pagina sola con
  `state=all` vuol dire che, appena i chiusi passano il centinaio, gli aperti
  di prima escono dall'elenco in silenzio. Adesso gli aperti si chiedono a
  pagine, fino in fondo — e serviva davvero: quell'indirizzo di GitHub
  restituisce anche le pull request, che di li' si scartano ma il posto in
  pagina se lo prendono, quindi il centinaio finisce prima di quanto sembri. I
  chiusi restano una pagina sola: sono storia, e bastano i cinquanta piu'
  freschi.

- **Il segnaposto della risposta non promette piu' la plancia a chi non ce
  l'ha.** Su una issue aperta a mano su GitHub la risposta li' resta, ma il
  riquadro diceva lo stesso «chi l'ha aperta la trova nella sua plancia»: falso
  proprio per le voci che questa versione ha appena aggiunto, e per il
  manutentore vuol dire credere di aver avvisato qualcuno che non e' stato
  avvisato.

- **Se l'autorizzazione non parte, «Salvata» resta scritto.** La segnalazione
  a quel punto e' gia' al sicuro in casa. Dire soltanto «non riuscita» — GitHub
  irraggiungibile, per dire — farebbe credere di aver perso quello che si era
  appena scritto, e la risposta naturale a quel messaggio e' riscrivere tutto
  da capo, per ritrovarsi due segnalazioni uguali.

- **L'allegato che non carica lascia il link, non un riquadro rotto.** Il
  ripiego staccava l'immagine e *poi* cercava il contenitore — che a quel punto
  non c'e' piu' — quindi moriva li' e la riga col rimando non compariva mai.
  Succede tutte le volte che la CSP di Home Assistant blocca l'immagine di
  GitHub, cioe' spesso, e non lo si vedeva: l'eccezione finiva nella console
  del browser.

- **La pastiglia del tipo si fa leggere.** Era `aria-hidden`: chi non distingue
  i colori non aveva modo di sapere se una riga fosse un difetto o un'idea.

- **La scala del clima la dichiara il termostato, non la plancia.** «Ho una
  pompa di calore Samsung, il sensore mi gestisce la temperatura di uscita
  dell'acqua dai 40 gradi fino a 70 massimo. Quando vado a inserire nel menu
  clima l'entita', mi mette in predefinito 10-28 gradi e non sono riuscito a
  capire come si modifica la scala.» Non c'era modo: i due estremi erano scritti
  nel codice — sedici e trenta per il Freddo, dieci e ventotto per il Caldo — e
  valevano per tutti. Con quella barra il pomello restava incollato al fondo e
  quarantacinque gradi non si potevano nemmeno sfiorare. Adesso la barra legge
  `min_temp` e `max_temp` dell'entita', che Home Assistant pubblica gia': quella
  pompa disegna da 40 a 70, e il dito arriva dove serve. Chi non li dichiara
  tiene la scala di prima, identica. (#252)
- **E si muove del passo che l'unita' accetta.** Un termostato che lavora a
  mezzi gradi riceveva comunque gradi interi, perche' il trascinamento
  arrotondava sempre all'unita'. Adesso segue `target_temp_step`; chi non lo
  dichiara resta al grado intero, che e' quello che la plancia ha sempre fatto.
- **Il ritaglio non taglia piu' l'estremo che si stava cercando.** Al rilascio
  il grado veniva riportato dentro i limiti arrotondando il minimo all'intero
  superiore: un'unita' che dichiara 40,5 non arrivava mai al proprio minimo.
- **La stessa regola in un posto solo.** La pagina Clima e il pannello della
  Home tenevano due copie della scala, e si fermavano a numeri diversi: adesso
  la calcola il nucleo, e le due si comportano uguale.
- **Le icone della barra e della configurazione erano mezze, non chiare.** «Le
  icone presenti sia sulla navbar che nel menu config sono poco leggibili,
  troppo chiare.» Non era il colore: meta' di quei disegni non veniva dipinta.
  Ogni oggetto si porta dentro le proprie sfumature e disegni uguali ripetono
  gli stessi identificatori; in una pagina pero' a un identificatore ripetuto
  risponde sempre il PRIMO che lo porta, e per meta' dei disegni quel primo sta
  dentro una voce di barra che la configurazione tiene a `display:none`. Una
  sfumatura in un ramo non disegnato non dipinge niente: del lampadario, del
  termometro, del fulmine e della goccia restava soltanto l'ombra grigia sotto.
  Adesso le sfumature stanno in un foglio unico in cima al documento, sempre
  disegnato, ed e' lui a rispondere a tutti: nella colonna della configurazione
  tornano interi Energia, EV, Sicurezza, MiniPC, Temperatura, Piscina,
  Irrigazione, Luci, Prese, Elettrodomestici e Aperture.
- **E sulla barra il velo era doppio.** Le voci a riposo stavano a `opacity:.78`
  e sopra ci passava un `grayscale(.85) opacity(.72)`: i due si moltiplicano,
  cioe' 0,56 di opacita' su una figura quasi senza colore. Adesso il velo e'
  uno solo e il grigio un accenno; a dire qual e' la pagina aperta ci pensano la
  pastiglia scura e il nome, che sono segnali piu' forti di uno sbiadimento.
- **E il nome sotto il disegno si legge.** Era il grigio tenue al 70% di
  opacita': sul bianco della barra fa 2,7 a uno, sotto la soglia di
  leggibilita'. Adesso ne fa 7,7. Stesso conto per i nomi nella colonna della
  configurazione.

- **La bolla della batteria non sparisce piu' cambiando impianto.** Il guscio
  nasconde e rimostra le bolle del sole e della batteria guardando quali entita'
  sono mappate — ma quella funzione la chiama **una volta sola, su un timer
  all'avvio**. Cambiando impianto le entita' cambiano sotto i piedi e nessuno la
  rifa': chi passava a una casa senza batteria e poi tornava alla propria
  trovava la bolla sparita, e non tornava piu' finche' non ricaricava la pagina.

  E' il «improvvisamente scompare tutto» segnalato. Adesso la decisione la
  prende chi la sa — l'impianto scelto — a ogni passata.

- **Il foglio di ogni finestra sta su un livello suo.** La sfocatura del velo
  rilegge lo sfondo: ogni scrittura dietro la finestra e' una sfocatura da
  rifare, e finche' il contenuto del foglio sta nello stesso livello viene
  ridipinto insieme a lei — e' il lampo bianco che si vede sul telefono. La
  promozione era stata data alla sola finestra dei carichi; il motivo non era
  mai stato suo, e adesso vale per tutte e undici. Nessuna di loro ha figli
  fissi che un livello nuovo strapperebbe alla finestra del browser: verificato
  aprendole una per una.

- **Due sezioni si riavvolgevano a vicenda, all'infinito.** La finestra dei
  carichi e la stabilita' Beta 27 avvolgono tutt'e due `apriSubLoads`, e nessuna
  riconosceva il segno dell'altra sulla funzione esterna: a ogni giro di stati
  ciascuna riavvolgeva quella dell'altra. Misurata, la catena cresceva di due a
  ogni giro — **cinque avvolgimenti all'avvio, venticinque dopo dieci giri,
  sessantacinque dopo trenta** — e continuava a crescere per tutto il tempo che
  la plancia restava aperta. Aprire la finestra faceva girare decine di volte
  due disegnatori che si scrivono sopra a vicenda: e' da li' che veniva
  l'intestazione che cambiava faccia.

- **L'intestazione della finestra ha un proprietario solo.** La finestra moderna
  se la scrive da se' — nome, icona e periodo in tre pezzi; la mano di prima
  scriveva la stessa cosa in un pezzo solo e di un altro colore. Adesso quella
  si tira indietro quando la finestra e' della nuova, e resta per i gruppi che
  la nuova non sa disegnare.

- **La riga «Transfer» non si contraddice piu'.** Diceva «4.9 MB dalla cache —
  non compressi · servito br»: una deduzione dai pesi e una risposta del server,
  opposte, in fila. Quando c'e' la risposta letta, la deduzione si toglie.

- **Il popup non riscrive piu' quello che non e' cambiato.** I due fotogrammi ai
  lati del lampo erano identici: fra prima e dopo non cambiava un pixel. Non
  stava cambiando niente, e il livello si ridipingeva lo stesso — perche' la
  finestra riscriveva lo stesso. Al banco, dieci giri di stati fermi facevano
  **seicentodieci scritture sul DOM**: le carte venivano «rimesse in fila» una
  per una a ogni giro anche quando l'ordine era gia' quello, e attributi, colori
  e testi venivano riassegnati col valore che avevano gia'. Assegnare lo stesso
  valore non e' gratis: il browser non confronta, invalida — e dentro il velo
  sfocato del modale ogni invalidazione e' un livello da ridipingere, che per un
  fotogramma resta bianco. Adesso si confronta prima di scrivere, e in
  classifica si sposta solo la carta che non e' al suo posto: **a stati fermi le
  scritture sono zero.**

- **La plancia non si ricarica piu' da sola.** A quattro secondi dall'apertura
  lo schermo diventa bianco, il velo di avvio torna su, e la plancia riparte
  sulla Home buttando via la pagina che si stava guardando. Non era un disegno
  che sfarfalla: era `location.reload()`. Lo chiamava il tiraggio della
  configurazione da Home Assistant — se il timbro dell'ora di HA era piu'
  recente di quello locale, applicava e ricaricava. Cioe': **ogni volta che si
  e' toccata la configurazione da un'altra parte, la prima apertura costava due
  avvii invece di uno.** E' anche una parte di «impiega troppo tempo in
  caricamento», e sta fuori sia dalla rete sia dai byte — i due assi sbagliati
  delle beta precedenti. Adesso la configurazione nuova si applica dov'e', come
  fa l'editor a ogni salvataggio; e una configurazione identica a quella che
  c'e' gia' non fa muovere niente.

- **Il popup dell'Energia non lampeggia piu'.** A finestra aperta e ferma, la
  griglia delle carte spariva per un fotogramma solo — un lampo bianco — e
  tornava: sei volte in dieci secondi, al passo degli aggiornamenti che arrivano
  da casa. E' quello che si vede in mezzo a un `replaceChildren`: la finestra
  sta dentro un velo sfocato, che sul telefono e' un livello a se', e finche'
  non e' ridipinto resta il bianco del foglio — sul computer non si vede, ed e'
  per questo che il difetto e' sempre sembrato «solo del telefono». A farlo
  scattare bastava la riga dei kWh di oggi che appare o sparisce: un contatore
  giornaliero «non disponibile» per un giro, e otto carte venivano buttate via e
  ristampate. Adesso testata e griglia si fanno una volta e restano, e le carte
  si aggiornano dove sono.

- **Il popup del cerchio dice la stessa parola della carta.** La finestra
  Elettrodomestici segnava «8/8 IN FUNZIONE» con sei apparecchi a zero watt: le
  prese erano accese, gli apparecchi no. La carta dello stesso apparecchio, due
  schermate piu' in la', diceva STANDBY. Erano due regole per la stessa domanda.
  Adesso la fa una funzione sola, quella della sezione Elettrodomestici: a dire
  IN FUNZIONE sono i watt sopra soglia, uno stato che lo dice con parole sue, o
  un sensore di attivita' chiamato per quello che e'. In regalo arrivano le
  soglie per apparecchio e il ritardo di fine ciclo — la lavastoviglie che
  asciuga resta IN FUNZIONE anche qui.

- **Un contatore in kW sono watt.** La finestra del cerchio leggeva il numero e
  basta: 0,27 kW diventavano «0 W», cioe' un apparecchio spento mentre stava
  consumando duecentosettanta watt.

- **«heating» e «cleaning» sono modi di dire che sta lavorando.** Erano due
  parole che conosceva solo la finestra dei sotto-carichi, quando aveva una
  regola sua. Adesso che la regola e' una sola dovevano arrivare anche nel
  modello canonico: senza, un termostato in fase bassa o un aspirapolvere che
  pulisce con la ventola al minimo direbbero SPENTO mentre lavorano — e su
  tutt'e due le schermate.

- **Il tasto dello storico segue il sensore.** L'ascoltatore del clic si mette
  una volta e resta: se a un apparecchio cambia il sensore o il nome mentre la
  finestra e' aperta, la carta mostrava il valore nuovo e apriva lo storico di
  quello vecchio.

- **La sveglia del ritardo di fine ciclo ridisegna anche la finestra.** Quando
  `off_delay_minutes` scade nessuno manda niente — e' il tempo che passa — e una
  finestra lasciata aperta sarebbe rimasta a dire IN FUNZIONE.

- **La riga «Transfer» non dichiara piu' cose che non ha misurato.** Diceva «non
  compressi» di una plancia che arrivava compressa: il peso del corpo com'e'
  arrivato non e' sempre disponibile, e quel vuoto finiva nel ramo sbagliato. E'
  il modo in cui una diagnostica fa cercare il guasto dalla parte sbagliata, che
  e' peggio del non averla. Adesso, quando quel dato manca, lo dice — e
  soprattutto va a CHIEDERE al server come e' arrivato davvero il file, invece
  di dedurlo: la riga si completa da sola con «servito br» o «servito in
  chiaro».

- **La plancia arriva compressa: 4,9 MB diventano 1,2.** La Diagnostica diceva
  «impacchettati (3 file)», quindi il pacchetto funzionava — ma i byte erano
  rimasti gli stessi. Chi apre la plancia da fuori casa passa da un tunnel, e li'
  non contano le richieste: contano i byte, e ne partivano quattro megabyte e
  mezzo in chiaro. Adesso accanto a ogni file ne viaggia una copia gia'
  compressa, e Home Assistant manda quella a chi la accetta. Misurato in pagina:
  da 5142 kB scaricati a 1179. Su un collegamento da 5 Mbit/s la plancia e'
  pronta in 2,8 secondi invece di 4,9. Chi entra da casa, dove la banda non
  manca, non se ne accorgera': e' fuori casa che si sentiva.
- **La Diagnostica dice quanto pesa arrivare.** La riga «Transfer» mostra i byte
  davvero scesi dal filo e se erano compressi. Per sapere che la beta di prima
  non aveva spostato niente sono serviti uno scambio di messaggi e una
  schermata; adesso si legge.
- **Due documenti da centosei kB non partono piu' per il mondo.** Le copie di
  lavoro dei gusci finivano dentro il pacchetto di rilascio.
- **Nemmeno i resti delle prove.** Chi costruiva il pacchetto sulla propria
  macchina, dopo aver eseguito la suite, ci spediva dentro tre megabyte e mezzo
  di schermate di Playwright. Il pacchetto pubblicato non li ha mai avuti — in
  CI il rilascio parte da un checkout pulito — ma adesso non li ha nessuno.

Il pacchetto passa da 7,1 a 10,5 MB: si comprime solo quello che la plancia
chiede davvero all'avvio, non i centosettantanove sorgenti sciolti che servono
al solo ripiego. Si scarica una volta per aggiornamento, e si risparmia a ogni
apertura.

- **Le caselle del popup Lavatrice si scelgono dalla riga.** Nella finestra
  «Modifica azione» ogni casella portava due tasti azzurri con la lente,
  appaiati, e nessuno dei due era il modo giusto: in tutta la plancia
  un'entita' si sceglie dalla riga stessa. Quella passata pero' girava solo
  dentro le fisarmoniche delle Sezioni, e questa carta sta altrove.

### Da sapere

- Due prove nuove percorrono la lettura per davvero, con un corpo che arriva a
  pezzi come arriva sul filo. Nessuna prova poteva prendere questo guasto
  prima: tutte sostituiscono la chiamata di rete in blocco — che e' giusto,
  provano cosa il modulo chiede e cosa ne fa — e cosi' la lettura non veniva
  mai percorsa. Falliscono tutte e due sul codice di prima.

- Le anteprime delle segnalazioni entrano in galleria per davvero. I bersagli
  c'erano gia' nello script, ma gli scatti non erano mai stati committati: chi
  apriva `docs/preview` trovava tutte le sezioni tranne queste. Trentasei file,
  nove schermate per due temi e due formati.
- Una prova prende il ripiego dell'immagine dal markup e lo esegue davvero su
  un'immagine che si stacca: sul codice di prima fallisce.
- 1865 prove frontend, 197 pytest.

Le segnalazioni portano **cinquantasei prove nuove** fra backend e finestra.
Due meritano di essere raccontate, perche' sorvegliano cose che si vedrebbero
tardi e male: che ognuno dei comandi che la finestra manda sia fra quelli che
il ponte lascia passare — un tipo dimenticato la' e' un refuso che si scopre
solo in un browser vero — e che la diagnostica sia una **lista chiusa**, con un
controllo che nessuna delle sue chiavi somigli a un dato di casa. Quella lista
va riletta ogni volta che qualcuno la allarga, ed e' l'unica cosa che decide
cosa esce di casa.

La prova che sorvegliava la bolla della batteria **cadeva due volte su otto gia'
prima di questa versione**, e restava verde solo perche' i controlli hanno due
tentativi di riserva. Non stava aspettando un ritardo: aspettava una passata che
non sarebbe mai arrivata. Chiusa la corsa, passa sedici volte su sedici, e una
prova nuova la sorveglia in modo secco — senza la correzione cade quattro volte
su quattro.

- **Il foglio della finestra su un livello suo.** Dentro la finestra, a riposo,
  le scritture sono zero; dietro sono undici in quattro secondi — l'orologio, il
  puntino della connessione, il flusso. E il velo del modale ha una sfocatura
  che rilegge lo sfondo: ogni scrittura dietro e' una sfocatura da rifare, e le
  due cose stanno nello stesso livello. Promuovendo il foglio a livello suo, il
  suo contenuto non viene ridipinto insieme allo sfondo. E' un fatto del
  telefono, e in prova il disegno lo fa la CPU: qui non si riproduce.

I numeri della Diagnostica dicono dove sta il tempo, e non e' dove si e'
guardato finora: **ultimo file a 2,9 s, velo via a 3,2 s** — cioe' 2,9 secondi
prima che l'ultimo file sia pronto e 0,4 dopo. E il Transfer dice «dalla
cache»: i file non li sta scaricando, li sta **leggendo e interpretando**. Sono
4,9 MB di codice, di cui 2 in un pezzo solo.

E' per questo che ne' meno richieste (beta.1) ne' meno byte sul filo (beta.2)
hanno spostato niente, e non lo sposta nemmeno questa: il tempo se ne va a
interpretare ed eseguire, e l'unica cosa che lo tocca e' **eseguire meno roba
all'avvio** — montare per prime le sezioni della pagina che si vede e lasciare
indietro le altre. E' un lavoro grosso e a se', non un ritocco.

- Le tre chiavi che le legge solo l'avvio — il marchio, i nomi delle luci, le
  unita' clima — quando cambiano da un altro dispositivo fanno ancora ricaricare
  la pagina: scriverle in memoria e lasciare lo schermo a dire la cosa di prima
  sarebbe peggio. Sono i pochi casi rimasti, e la differenza con prima e' che
  adesso il ricaricamento e' l'eccezione invece della regola.
- Un apparecchio il cui unico segnale e' un binary_sensor generico acceso, a
  zero watt, adesso dice STANDBY invece di IN FUNZIONE — la stessa parola che
  dice gia' la sua carta. Per i cicli che passano da zero watt c'e'
  `off_delay_minutes`, che adesso vale in tutt'e due i posti.

## 1.4.4

### Nuovo

- **La barra in basso scansa i tasti del telefono** ([#249](https://github.com/danigio15/dashboardmodern-v2/issues/249)). «Nello smartphone
  la barra inferiore e' parzialmente coperta dai tasti Android.» Non e' stata
  alzata di un tanto fisso — su un telefono a gesti, su un tablet o su un
  computer sarebbe rimasta sospesa per niente: quanto alzarla lo dice il
  dispositivo, ed e' zero dove non c'e' niente da scansare. La barra, la
  maniglia che la tira fuori e lo spazio sotto l'ultima card si adattano
  insieme.

### Corretto

- **Una plancia nuova nasce vuota, non copia di quella che c'era.** «Se aggiungo
  una nuova dashboard da integrazioni mi duplica quella attuale, invece doveva
  crearne una ex novo sciolta dall'altra.» Il nome della cassetta dove sta la
  configurazione veniva dal titolo, e chi ne aggiunge una seconda lascia il nome
  proposto: due plance chiamate allo stesso modo finivano nella stessa cassetta
  e da li' in poi si scrivevano addosso. Adesso i posti si assegnano guardando
  tutte le plance insieme — chi c'era prima non si muove, chi arriva su un nome
  occupato ne riceve uno suo — e una plancia ospitata che non sa di essere la
  principale non si prende piu' la configurazione della principale. E una
  plancia senza niente di configurato non mostra piu' il ponte dei widget: le
  tessere degli avvisi — aperture, batterie, allagamenti — nascono dal
  rilevamento e non dalla configurazione, e su una plancia appena creata
  raccontavano la casa dell'altra proprio sotto il messaggio che diceva il
  contrario. Basta la prima stanza perche' tornino — o la prima finestra
  aggiunta a mano alle Aperture, che e' una scelta come le altre; quello che il
  primo avvio si segna da solo, invece, non conta.
- **Anche la barra in basso e le pillole delle aperture hanno i disegni di
  casa.** Erano gli ultimi due posti con le emoji del sistema — e la barra e' il
  piu' guardato di tutti: la casa di un telefono accanto al fiocco di un altro.
  Le voci a riposo restano spente, quella aperta e' a colori.

- **Il cerchio dell'Energia dice quello che dice la sua finestra.** Il cerchio
  segnava 0 W e la finestra dei sotto-carichi 838 W. Adesso un contatore di
  gruppo fermo a zero non nasconde piu' quello che ha dentro — a zero si guarda
  la somma dei dispositivi — e la casella della potenza la scelgono allo stesso
  modo il cerchio e la finestra, cosi' un apparecchio con due caselle scritte
  non dice piu' due numeri diversi nella stessa schermata. Sparito anche il
  tremolio della finestra: la griglia veniva buttata e rifatta a ogni battito
  degli stati, decine di volte al minuto.
- **Il cestino della «Potenza istantanea» toglie l'entita' davvero.** «Io
  elimino l'entita' inserita per far usare il calcolo ma non la elimina.» Erano
  tre cose in fila: il tasto «Salva carichi» restava spento dopo aver svuotato
  una casella; l'elenco piatto delle entita' si portava dietro il sensore
  appena tolto; e un istante dopo il salvataggio chi indovina le caselle vuote
  dai nomi dei sensori lo rimetteva al suo posto. Ora una casella svuotata
  resta vuota — e il cerchio diventa la somma dei dispositivi che ha dentro,
  che e' esattamente perche' la si svuota.
- **La tessera del MiniPC dice RAM e disco in tutte le lingue.** Sotto il
  numero della CPU sceglieva le altre due quote leggendo l'etichetta scritta:
  dove quelle parole sono tradotte — il giapponese, l'arabo — non ne
  riconosceva nessuna, e la didascalia restava vuota pur avendo le letture in
  mano. Adesso le sceglie dalla misura, che non cambia con la lingua.
- **Rinominare una plancia non la manda nella cassetta di un'altra.** Con due
  plance chiamate allo stesso modo, la seconda teneva un nome con il suffisso;
  se poi si rinominava la prima, il nome liberato veniva ricalcolato e la
  seconda ci finiva dentro. Ogni plancia si ricorda la sua cassetta, e il
  ricordo vale piu' del nome appena scritto.

## 1.4.3

### Nuovo

- **La configurazione della lavatrice sta nelle Azioni rapide.** Scelto «🧺
  Popup Lavatrice» dal menu dell'azione compare la carta intera: i programmi
  — nome, entita', icona, quanti ne vuoi, con l'icona presa dal catalogo di
  casa — e le caselle della finestra (presa, avvio ciclo, fase, tempo,
  programma, temperatura, centrifuga, potenza della presa). Sono gli stessi
  slot della scheda Lavatrice in Sezioni: quello che si scrive di qua si
  ritrova di la'. Il ⚙️ dentro al popup non c'e' piu'.
- **Il catalogo delle icone e' uno solo, e piu' ampio.** Le azioni rapide
  passano da 21 a 81 voci — avvisi, aperture, allagamenti, meteo, stanze,
  apparecchi, persone, promemoria — ognuna col suo disegno nello stile della
  plancia. E ogni casella che chiede un'icona apre quel catalogo: anche le
  stanze, i piani, le temperature e il Report, che fino a ieri aprivano la
  griglia di emoji di sistema del guscio.

### Corretto

- **La plancia non si apre piu' a pezzi.** Il velo si scioglieva nello stesso
  istante in cui i moduli si dicevano installati, mentre una quarantina di
  loro doveva ancora dipingere: si vedeva la pagina ricomporsi. Ora il velo
  aspetta che la plancia sia davvero dipinta, e i conti degli
  elettrodomestici non girano piu' fuori scena.
- **Le telecamere si aprono subito.** A ogni giro il travaso strappava il
  `src` alle immagini gia' scaricate: riquadro nero e nuovo scaricamento,
  all'infinito. Ora l'immagine resta dov'e', le richieste in volo sono al
  massimo due e la spazzata delle chiavi morte passa ogni cinque secondi
  invece che a ogni fotogramma.
- **Il popup Temperatura si legge.** Temperatura e umidita' non stanno piu'
  appiccicate: l'umidita' ha la sua riga sotto il numero grande.
- **Il Chiudi e' lo stesso ovunque.** Tutte le finestre della plancia
  chiudono con la stessa pastiglia scritta «✕ CHIUDI» — niente piu' tondini
  con la crocetta doppia ne' eccezioni per lo storico. E le intestazioni
  restano alte uguali: la pastiglia e' piu' larga del tondino, e da telefono
  i titoli lunghi andavano a capo portandosi dietro una riga in piu'.
- **Il cerchio Elettrodomestici somma davvero, e il popup non sfarfalla.**
  La potenza si cerca anche nei campi espliciti dell'apparecchio, e il popup
  dei sotto-carichi aggiorna le carte al loro posto invece di rifarle da
  capo a ogni battito.
- **Il popup dei carichi resta al passo con quello che mostra.** Aggiornare
  le carte al loro posto voleva dire non toccare piu' la testata: cambiando
  nome, icona, colore o periodo del cerchio restava scritto quello di prima
  fino alla riapertura. E la riga dei kWh di oggi ora compare e sparisce
  davvero, invece di mancare per sempre o restare col numero di ieri.
- **Lo storico non si fa scrivere sopra.** Aprendo una voce non mappata
  mentre una richiesta di prima era ancora per aria, quella arrivava dopo e
  copriva la spiegazione col grafico dell'altra entita'.
- **La presa in solo lettura non si accende nemmeno toccando la card.** Le
  quattro strade che aggiravano il divieto — card delle Luci, pagina Stanze,
  tessera della Home, `toggle` del guscio — sono chiuse: al tocco si apre la
  finestra delle informazioni, col lucchetto e la spiegazione. E anche quella
  finestra ora sa del divieto: mostrava il tasto acceso e il comando partiva
  davvero, perche' il modello della luce dava per buono che si comandasse.
- **Gli elettrodomestici col flag non si spengono, e il tasto non sparisce.**
  La levetta seguiva l'entita' anche a comando nascosto, e la firma della
  card non guardava il flag: da spento il tasto se ne andava.
- **Lo stato della caldaia sta solo nel Caldo.** Fra i condizionatori non
  c'entra niente, e adesso il riquadro li' non c'e' proprio: si spegneva con
  l'attributo `hidden`, che pero' perdeva contro la regola di stile della
  casella, e nel Freddo restava un rettangolo vuoto con dentro «--».
- **Le carte del Clima restano nel Clima.** Non compaiono piu' in tutte le
  schede della configurazione: si ancorano al modulo vivo e si ritirano da
  sole se finiscono fuori posto.
- **Lo storico del MiniPC dice cosa manca.** Disco e temperatura CPU non
  aprivano piu' niente: la guardia leggeva gli stati da un posto che non
  esiste. Ora la finestra si apre e spiega che la voce va mappata.
- **Le porte delle Aperture nascono col disegno di casa.** L'icona di
  partenza e' quella del catalogo, il selettore e' quello unico, e il nome
  della porta non e' piu' incollato al nome dell'entita'.
- **L'icona scelta si vede, non si legge.** Dove il pannello stampa la
  casella come testo nudo — i programmi della lavatrice, lo Stato termico,
  le linguette dei piani — il catalogo scrive il segno invece del nome del
  disegno: prima ci sarebbe finito «mdi:washing-machine» per esteso.

## 1.4.2

### Nuovo

- **La barra del Clima si trascina.** Il target si sceglie prendendo la
  corsia col dito o col mouse — il pomello e il numero seguono in diretta e
  al rilascio parte un solo comando col grado intero scelto. I tasti ➖/➕
  restano.
- **La testata del Clima dice come sta la caldaia.** La caldaia configurata
  nello Stato termico compare fra i numeri della sezione: accesa (e da
  quanto) o spenta. Senza caldaia configurata la casella non c'e'.
- **La lavatrice si personalizza dal popup.** Sotto i programmi rapidi c'e'
  «⚙️ Personalizza programmi»: la stessa carta della configurazione — nome,
  entita', icona, quanti programmi vuoi — con il salvataggio a ogni modifica
  e i tasti che compaiono subito.

### Corretto

- **Le entita' delle Prese non sono porte.** Se la configurazione condivisa
  se le era portate fra le aperture della Sicurezza, ora si scartano ovunque
  — sezione, widget, editor — e l'editor ripulisce la lista salvata.
- **L'icona scelta dal catalogo si vede davvero.** Il catalogo di casa
  scrive token `mdi:*`: stampati come testo l'icona della porta «spariva».
  Ora la disegna il motore — nell'editor, nella pagina Sicurezza e nel
  widget.
- **Il Chiudi della finestra widget si legge intero.** La regola del tondino
  delle tessere schiacciava la pillola scritta della testata e la scritta
  usciva tagliata («✕ CH…»).
- **Le minicard dei popup si leggono.** Le etichette delle misure vanno a
  capo invece di finire nei puntini, e nelle pillole dello stato il nome e
  la parola di stato si distinguono (nome · STATO).
- **Le aperture aperte stanno in testa.** Il popup diceva «2 aperte» ma la
  seconda stava in mezzo alle chiuse, sotto la piega: ora le aperte vengono
  prima.
- **La presa in solo lettura non ha piu' la levetta.** La card resta col
  lucchetto, l'interruttore sparisce proprio — e il comando era gia'
  rifiutato alla radice.
- **Il cerchio Elettrodomestici del flusso porta la somma vera.** Il gruppo
  pescava dalla propria lista un sensore a 0 W e la somma degli apparecchi
  dentro non partiva mai («il popup somma 1,45 kW, il cerchio dice 0 W»);
  e la potenza si trova anche nei campi espliciti dell'apparecchio, con le
  unita' scritte per esteso.
- **Il popup dei carichi si legge.** I nomi vanno a capo invece di
  troncarsi («Condizio…») e i kWh di oggi stanno sotto i watt, non
  accostati.

## 1.4.1

### Nuovo

- **Il verso di sensori e tapparelle si puo' invertire (#244).** Certi
  contatti porta/finestra stanno a ON quando l'infisso e' CHIUSO, e certe
  tapparelle dichiarano 100 quando sono giu': la plancia diceva sempre il
  contrario. Come nelle card Lovelace, ora si gira il verso: per i sensori
  col comando ⇄ accanto a ogni apertura nella scheda Avvisi (la lista
  viaggia con la configurazione), per le tapparelle con la casella
  «Percentuali invertite» della riga (e il ⇄ sulle righe esistenti).
  Tutta la plancia legge col verso vero — Quadro Avvisi, widget, pagine,
  card — e i cursori scrivono tradotto, cosi' «100% · Aperta» apre
  davvero.

- **La casella Batteria del widget Energia dice anche quanto e' piena.**
  Lo stato di carica ha gia' il suo slot nella mappatura: ora la casella
  lo scrive accanto ai watt («-320 W · 78%»), e con la sola percentuale
  mappata basta lei a far esistere la casella.

- **Un cerchio del flusso puo' essere una stanza.** Nella scheda di un
  carico c'e' «Cerchio = stanza»: scelta la stanza, i suoi
  elettrodomestici entrano nel cerchio da soli — anche quelli configurati
  domani — e il cerchio ne mostra il totale; chi sta gia' in un altro
  cerchio non si conta due volte. Il popup del cerchio li elenca tutti.

- **La mappatura del Meteo si sfoltisce.** Nella scheda Home della
  mappatura i cinque campi della stazione — temperatura, umidita',
  percepita, vento, direzione — stanno dietro la casella «Usa entita'
  proprie per la stazione meteo»: spenta, basta l'entita' weather. Chi
  li aveva gia' mappati trova la casella accesa da sola.

- **La card del Clima si puo' girare.** Nella scheda Clima della
  configurazione c'e' il flag «Nelle card mostra grande l'ambiente»:
  col flag acceso il numero grande e' la temperatura della stanza e la
  riga piccola il target — didascalie comprese, che seguono i numeri.

- **Il popup della lavatrice e' tuo.** I quattro programmi rapidi erano
  scritti nel guscio su slot fissi: ora i tasti vivono in una lista libera
  — nome, entita' (script o switch), icona, quanti ne vuoi — nella
  fisarmonica della lavatrice in configurazione, e senza programmi la
  griglia sparisce. L'immagine e' quella della sezione Elettrodomestici
  (la foto scelta nella scheda, o il disegno di casa) invece del file
  /local che quasi nessuno ha; tasti e card vestono come il resto della
  plancia.

- **Il tasto Accendi/Spegni di un elettrodomestico si puo' togliere.**
  Nella scheda dell'apparecchio, sotto l'entita' comando, c'e' la casella
  «Senza tasto Accendi/Spegni»: l'interruttore mappato continua a leggere
  lo stato — la card dice ancora se e' in funzione — ma il tasto sparisce,
  cosi' il frigo non si spegne per sbaglio da una card.

- **Le voci termiche del popup Caldo si configurano, e senza voci
  spariscono.** Sotto le stanze del Caldo c'erano tre righe cablate nel
  guscio — Caldaia (su un'entita' di un impianto specifico), Pompa
  termocamino, Aspiratore canna fumaria — che per chiunque altro dicevano
  «N/D» per sempre. Nella scheda Clima della configurazione arriva il campo
  libero: nome, entita' e icona per ogni voce, quante se ne vogliono, col
  salvataggio a ogni modifica. Chi aveva davvero le tre storiche mappate se
  le ritrova seminate; chi non ne configura nessuna non vede il pannello.

### Corretto

- **Il blocco «Si vede ma non si comanda» della presa si salva davvero.**
  Il salvataggio passava da un nome che nessuno aveva mai messo su root e
  faceva no-op in silenzio: la casella tornava vuota e la presa restava
  comandabile. Ora il blocco si scrive, la casella riaperta si ritrova
  spuntata, e tolta se ne va.

- **Gli avatar sono coerenti: la barba segue i capelli, gli occhi
  dell'uomo non sono piu' truccati.** La barba «naturale» restava nera
  anche su una testa bionda o bianca: ora eredita il colore della chioma
  (bionda sui biondi, grigia sui bianchi, rame sui rossi), e chi un
  colore l'ha scelto apposta vince sempre. Le palpebre dell'espressione
  contenta curvavano uguali su tutti i volti e il bordo-ciglio era una
  riga scura da eyeliner — «l'avatar uomo ha occhi da donna»: sui volti
  maschili la palpebra ora curva poco, e il ciglio e' leggero a occhio
  socchiuso, deciso solo a occhio chiuso. Al secondo giro di scatti:
  l'uomo a riposo tiene gli occhi APERTI del render (la palpebra dipinta
  compare solo nel battito, quasi dritta) — la fascia color pelle a
  occhio socchiuso si leggeva comunque come ombretto; e la barba
  trapiantata segue il viso — la campana della maschera prendeva anche
  le ciocche accanto alle orecchie della donatrice e usciva una lastra
  piu' larga delle guance, col fondo tagliato piatto: ora sta dentro le
  guance, scende sotto gli zigomi e chiude a punta come la nativa. E il
  colletto di polo e camicia — con la collana — sta al collo misurato
  del busto: disegnato a coordinate fisse, galleggiava sul braccio.

- **Il «Salva sezione» delle Aperture salva tutte le porte, non solo la
  prima.** Il tasto verde premeva i salvataggi nascosti riga per riga; il
  primo valido ridisegnava l'editor e i bottoni delle righe dopo restavano
  staccati dal documento — il gestore li ignorava, l'entita' appena scelta
  si perdeva e la pagina Sicurezza mostrava una porta sola. Ora il gesto
  legge tutte le righe e scrive una volta; la riga aggiunta e mai
  compilata non resta in giro come «Porta 2» fantasma, e quella a meta'
  resta scritta, aperta e con l'errore in vista.

- **La caccia ai duplicati e alle sovrascritture delle telecamere.** Cinque
  cose vere trovate e curate. L'«Auto-rileva» della configurazione
  rimpiazzava la lista delle telecamere con tutte le `camera.*` di Home
  Assistant: nomi propri, stanza e nome del flusso go2rtc sparivano (e il
  WebRTC smetteva di funzionare) — ora le esistenti restano come sono e si
  aggiungono solo le entita' nuove. La modifica di una telecamera
  ricostruiva la riga da zero, buttando i campi che il form non conosce
  (la stanza scritta dal registro di HA) — ora li conserva. La procedura
  guidata aveva DUE `wzAddStanza`: quella senza il ramo di modifica
  ombreggiava quella vera, e modificare una stanza la duplicava — la
  doppia e' morta. Il passo finale della procedura scriveva anche le liste
  vuote sopra quelle piene (e tre righe erano copiate due volte) — ora una
  lista vuota non cancella niente. E i gestori delle risposte websocket
  non si buttavano alla riconnessione: si accumulavano a ogni caduta di
  linea, sottoscrizioni WebRTC comprese. In piu' e' morta `renderVideoHls`,
  una seconda filiera video mai chiamata, col suo `#popup-cam-video` che
  non esiste in nessun HTML.

- **Le telecamere parlano anche il WebRTC nativo di Home Assistant.** La
  plancia conosceva solo il dialetto dell'estensione go2rtc: senza il nome
  del flusso compilato la strada WebRTC si saltava, anche quando Home
  Assistant dichiarava di saper negoziare da solo (2024.11+, ad esempio
  le Reolink). Ora, se la telecamera espone il WebRTC nativo, la plancia
  negozia direttamente sulla websocket di HA — offerta, risposta e
  candidati, col vecchio scambio a risposta unica come ripiego per i core
  piu' datati — e il nome del flusso go2rtc resta solo per chi ce l'ha,
  e continua a vincere se compilato.

- **La matita della telecamera riporta l'entita' anche nella veste.** In
  modifica l'entita' «spariva»: la matita riempiva il campo grezzo in
  silenzio e la chip che lo veste — ridipinta solo quando il campo
  annuncia un cambio — continuava a dire «Scegli entita'» sopra un campo
  pieno. Ora la matita annuncia il cambio e la veste dice quello che c'e'.

- **Il cerchio del flusso riempito dagli elettrodomestici porta i loro
  watt.** Scegliendo elettrodomestici nei Carichi il cerchio nasceva ma
  restava senza valore, mentre il popup dell'apparecchio i watt li
  mostrava: gli apparecchi del mondo vecchio portano solo l'elenco di
  entita', senza la casella canonica della potenza, e il cerchio leggeva
  solo quella. Ora fa la stessa domanda del popup: la prima entita' che
  parla in watt e' la potenza.

- **Le Aperture usano il catalogo icone di casa.** La lente dell'icona di
  avvisi, aperture e porte apriva una griglia di emoji nata a parte: ora
  apre il motore delle icone del progetto — porte, cancelli e serrature
  disegnati coi tratti di casa. La griglia di prima resta solo come
  ripiego se il motore non e' ancora in piedi.

- **«Aggiungi persona» non butta piu' la persona che si stava
  scrivendo.** Il tasto ridisegnava la scheda con quello che c'era in
  memoria: il nome appena scritto — su una persona ancora senza entita' —
  spariva. Ora quello che c'e' nelle righe si mette al sicuro prima di
  aggiungere (e prima di importare), e la bozza di una persona nata senza
  entita' vale anche se l'entita' arriva dopo.

- **Le Prese abitano anche la pagina Stanze.** La sezione Prese non veniva
  riportata dentro Stanze: ora ogni presa sta nella sua stanza, subito
  dopo le luci, con la stessa card e lo stesso interruttore — e i Carichi
  hanno lasciato la spina alle Prese, prendendo il fulmine.

- **Gas e monossido entrano nella lista del fumo.** «Rilevatori fumo/gas
  in config sicurezza»: Home Assistant li dichiara con lo stesso
  vocabolario del fumo (`device_class` gas e carbon_monoxide), e ora la
  famiglia sta insieme — stessa lista sorvegliata che si riempie da sola,
  stessa voce in configurazione col cestino, stesso blocco nella pagina
  Sicurezza. La voce si chiama «Rilevatori fumo e gas».

- **Il popup dell'Auto dice quando finisce, e parla in parole.** Accanto
  al tempo che manca («2H 15M RIM.») ora c'e' l'ora a cui si arriva
  («· verso le 10:46»), calcolata dalla stessa formula del guscio; e i
  codici IEC del cavo che il guscio non conosce — minuscole, parole di
  evcc — escono in parole, non piu' «C» nudo nelle caselle. La frase
  d'analisi resta dove sta: nel popup del widget Auto.

- **La finestra aperta di una tessera si aggiorna senza tremare.** Il
  tremolio era ricomparso perche' il corpo del popup veniva buttato via e
  riscritto a ogni valore che cambiava — ogni due secondi su una casa
  viva — e con lui se ne andavano il punto di scorrimento, la corsa
  disegnata e i nodi sotto il dito. Quando la forma non cambia, ora i
  valori nuovi si travasano nei nodi che ci sono gia'; quando cambia
  davvero, la riscrittura almeno tiene il punto di lettura.

- **Il Chiudi dei popup resta in cima, anche a lista scorsa.** Nei popup
  lunghi — il Clima rapido con tante stanze, i dettagli fitti —
  l'intestazione con la croce scorreva via col contenuto: «il tasto Chiudi
  sta troppo in fondo e non si legge». Ora e' incollata al bordo alto del
  foglio che scorre, col fondo pieno, e il foglio non supera mai l'area
  visibile vera dello schermo (misura dvh, dove il browser la capisce).

- **La pillola «Caldaia accesa» segue la caldaia configurata, e il popup
  Clima distingue chi scalda da chi raffresca.** La pillola sotto il meteo
  leggeva `switch.caldaia` cablato: ora segue la voce caldaia di
  `cd_termico_caldo`, e senza una caldaia configurata sparisce. Il popup
  «Clima attivi» mescolava tutto: ora le righe in riscaldamento stanno
  sotto la loro testata e quelle in raffrescamento sotto la loro (quando i
  due mondi convivono), e ogni riga — pillola compresa, e cosi' le voci del
  pannello del popup Caldo — dice da quanto tempo e' accesa.

- **Il popup degli elettrodomestici parla in parole, non in slug.** Le
  caselle delle misure stampavano il friendly name tale e quale —
  «W_KWH_FRIGO», «ENERGY_OGGI_FRIGO» — con la batteria (🔋) sopra i kWh:
  «si capisce poco cosi'» e «non ha senso il simbolo batteria». Ora ogni
  lettura porta la sua parola — Potenza, Energia oggi, Energia del mese,
  Contatore totale, Temperatura — decisa prima di tutto dall'unita' (un
  sensore in watt e' potenza anche se lo slug giura «kwh»), i kWh vestono
  il grafico, e nei nomi restanti gli underscore diventano spazi col nome
  dell'elettrodomestico tolto di mezzo: e' gia' scritto in cima alla
  finestra.

- **I tasti delle Azioni rapide restano tasti, anche su uno schermo largo.**
  La griglia del vassoio era dichiarata apposta senza tetto di larghezza, e
  con due o tre azioni ogni tasto si stirava a mezzo metro — «la sezione non
  si renderizza bene». Ora un tasto arriva al massimo a 220 pixel e la fila
  si centra nel ripiano, senza buchi fantasma ai lati.

- **Il popup del Clima rapido veste le stanze come si deve.** Tre difetti in
  una finestra: le card senza tetto diventavano quadrati da un quarto di
  schermo, il disegno di casa usciva piccolo e sbiadito dal grigio dello
  spento, e l'unita' senza stanza configurata cadeva sulla fiamma gigante di
  sistema — «Bagno e Camera da Letto non sono congrue». Ora le stanze sono
  pastiglie con un tetto di 150 pixel, il disegno e' a 46 e resta leggibile
  anche da spento (lo stato lo dice il colore, non la nebbia), la stanza si
  trova anche per NOME quando il legame non e' configurato, e chi resta
  orfano prende il termosifone del catalogo.

- **Il cancello non e' piu' una sbarra da cantiere.** Il ripiego a emoji
  della voce Cancello — nelle azioni come negli avvisi — era 🚧, la sbarra
  dei lavori stradali. Di norma esce il disegno di casa; quando tocca
  all'emoji ora esce il portale, lo stesso che il guscio usa nella conferma
  «Apri Cancello».

- **La testata di Home si ripara da sola, col meteo vestito.** Il guscio la
  nasconde con uno stile inline quando si apre un'altra sezione e la
  rimostrava SOLO al clic sulla linguetta Home: qualunque strada riportasse
  alla Home senza quel clic la lasciava invisibile per sempre — «scompare la
  scritta in alto, si vede solo il meteo». E se la classe della fascia si
  perdeva col meteo gia' dentro, il meteo tornava alla taglia da card intera
  e sfondava i margini. Ora chiunque passi ripara: a ogni giro di stati, a
  fine scroll, al cambio di visibilita' — e la classe della fascia si
  riafferma sempre. Sulle altre sezioni la testata nascosta resta nascosta,
  come deve.

## 1.4.0

### Nuovo

- **Il guscio inglese non parla piu' italiano.** Il runtime vendorizzato EN
  portava ancora etichette italiane cablate — «ARMATO · FUORI», «DISARMATO»,
  la tessera «Antifurto», i toast di salvataggio, la pillola «In attesa...»,
  le etichette del solare nell'editor. Un modulo se ne fa padrone e le
  traduce alla fonte, finche' la correzione non arriva a monte. Anche il
  guscio statico EN mentiva — le linguette del solare «Istantanea /
  Giornaliera / Mensile», i nodi del flusso «Solare / Casa / Batteria /
  Rete» — quindi il passaggio DOM di traduzione, che prima saltava
  l'inglese dandolo per gia' tradotto, ora gira anche li': l'inglese e' la
  lingua pivot e si risolve dall'indice, senza scaricare cataloghi.

- **Il ritratto delle persone diventa su misura.** Capelli (lisci, ricci,
  calvo), barba con le sue fogge (nessuna, rasata, corta, lunga) e colori di
  capelli e barba sono scelte separate che si combinano liberamente: dove il
  render originale non esiste, il compositore tinge preservando le ombre,
  trapianta la barba sui ricci e sintetizza rasata e lunga. Arrivano gli
  anziani per genere con le cinque carnagioni, i biondi, il colore degli
  occhi, gli occhiali (tondi, quadrati, da sole) e le collane, e un
  guardaroba di 35 capi veri — con polo, camicia, l'abito premaman e la fila
  «Colore vestito» per chi ne regge la tinta. Le facce salvate migrano da
  sole allo schema nuovo.

- **Le temperature dell'inverter e la ventola si configurano dalle
  impostazioni di Energia.** La scheda Temperature (inverter AC/DC, batteria,
  ventola) restava «In attesa...» perche' nessuna maschera sapeva collegare le
  sue entita'. In Energia → Impostazioni arriva il riquadro «Temperature e
  raffreddamento» con i cinque campi — le tre temperature, la potenza e
  l'interruttore della ventola — e ogni campo si salva appena cambia. Chi le
  aveva gia' mappate a mano dal tab Sostituzioni se le ritrova compilate.

- **Il prezzo dell'energia puo' venire da un'entita' (#217).** Nella card
  «Costo energia» il prezzo di acquisto ha il segmentato Numero | Entita':
  chi compra a prezzo di borsa sceglie il suo sensore e sotto legge il
  valore corrente, che si aggiorna da solo. Tutti i lettori — flussi,
  Report, costo del ciclo — passano dalla stessa porta, dove abitano anche i
  default di sempre.

- **Il tagliaerba entra nella sezione Robot (#220).** Un'entita'
  lawn_mower.* e' un robot come un vacuum.*: parla i suoi servizi, dice «Sta
  tagliando» in verde e non offre i comandi che non ha mai avuto; la
  batteria puo' venire da un sensore a parte, come molti la pubblicano.
  Pagina e navigazione ora dicono «Robot».

- **Le tessere della Home si fanno pillole (#224).** La preferenza «Tessere
  compatte» (Mai / Auto / Sempre, nella scheda Widget) stringe la fascia in
  pillole a due colonne con la tacca del colore di sezione: tutta la fascia
  in un colpo d'occhio sul telefono, col tocco che apre il solito popup. Con
  Auto succede solo sotto i 520px.

- **La tessera «In evidenza» (#236).** Le entita' scelte a mano — il quadro
  elettrico, l'armadio di rete, la pompa — arrivano in Home con riassunto in
  didascalia e dettaglio a caselle; si configurano nella scheda Widget col
  selettore vero, stanza facoltativa.

- **I rilevatori di fumo si configurano da soli (#238).** I binary_sensor di
  fumo entrano nel quadro avvisi anche se montati dopo il primo avvio, e la
  pagina Sicurezza guadagna il blocco «Rilevatori di fumo» con l'allarme
  rosso che pulsa. Le porte e le finestre scoperte dopo il primo avvio si
  aggiungono da sole alle Aperture — rispettando quelle tolte a mano — e chi
  non ha scelto un'icona ha quella giusta per la sua classe.

- **Gli elettrodomestici si fanno trovare dal flusso (#214).** Nella modale
  dell'elettrodomestico un suggerimento verde segnala chi ha gia' la potenza
  mappata e nessun cerchio; nell'editor Carichi il bottone «Scegli da
  Elettrodomestici» assegna un apparecchio gia' configurato senza
  riconfigurarlo, e a carico pieno lo dice invece di troncare.

- **Il popup dei widget e' il progetto approvato: tutte card, niente
  elenco.** Sotto l'analisi le letture non fanno piu' la lista di righe: le
  numeriche sono caselle sotto «Le misure» (glifo, valore grande,
  etichetta), gli acceso/spento pillole sotto «Lo stato» — le aperture con
  l'icona scelta e la parola Aperta/Chiusa — e sotto «Comandi» restano solo
  gli interruttori veri. Vale per auto, solare, piscina, energia,
  temperatura, batterie, irrigazione, robot, elettrodomestici e avvisi
  personalizzati. Il tasto Chiudi sta a destra, come negli altri popup.

- **L'auto in carica dice quando finisce.** «In carica al 53%: di questo
  passo arriva al 100% verso le 08:26» — l'ora del pieno viene dalla stessa
  formula della pagina EV (potenza del caricatore e traguardo), cosi' i due
  posti dicono la stessa ora; e quando la potenza parla, il modello non
  aggiunge un secondo orario dalla pendenza.

- **Boiler e Friggitrice ad aria nel catalogo elettrodomestici.** Il
  cilindrone d'accumulo a pavimento (manometro, acqua, tubi) e la
  friggitrice col cestello, disegnati nello stile del catalogo, con gli
  eroi animati per le loro pagine.

- **Anche il popup dell'elettrodomestico parla come il progetto.** Cliccando
  un elettrodomestico si apriva l'elenco di ogni entita' con lo slug sotto il
  nome; ora la stessa finestra apre col verdetto e la frase («Condizionatori
  e' in funzione e sta tirando 1105 W; oggi ha fatto 10.24 kWh»), le letture
  a caselle coi nomi veri, gli acceso/spento a pillole, e sotto «Comandi» gli
  interruttori e gli script coi loro tasti. Ogni casella apre ancora lo
  storico.

- **Il Tasto Clima rapido vale anche sulla parte Caldo.** Nel popup Clima il
  tocco su un'unita' Caldo che e' una vera entita' climate.* (termostato,
  valvola) ora accende coi passi di QUELLA unita' — ripiego: riscaldamento,
  senza toccare altro — e spegne con la stessa regola dei pulsanti della
  pagina; prima passava dal toggle degli input_boolean, che per un termostato
  cadeva nel vuoto. Nel form e nella matita, col Tipo su «Caldo» i campi
  partono dal riscaldamento (niente 26 gradi da condizionatore), e la tendina
  offre sempre la modalita' del preset anche in una casa di soli
  condizionatori. I termosifoni pilotati da un input_boolean restano col loro
  interruttore.

### Corretto

- **La barba sta sul viso, con precisione.** La maschera del pelo prendeva
  tutti i pixel scuri sotto il confine: le ciocche lunghe ai lati del viso
  diventavano barba, e il pelo trapiantato da una testa donatrice sbordava
  oltre guance e mento. Ora la barba vive in una campana centrata sul viso
  — le ciocche restano capelli — e il trapianto aderisce alla sagoma della
  testa che lo riceve; solo la coda della barba lunga resta libera di
  pendere sotto il mento. Sulle carnagioni scure la soglia del pelo ora
  scende con la pelle (prima l'intero basso viso passava per barba e usciva
  un lastrone squadrato), la coda salta la bocca della donatrice (denti e
  labbra stirati erano zanne bianche sotto il mento), aggancia il mento
  vero anche con le chiome larghe e si assottiglia verso la punta.

- **Il Report non parte piu' vuoto quando il runtime batte i moduli.** La
  lista dei dispositivi nasceva da una chiamata sola all'avvio e, se i
  moduli non c'erano ancora, restava vuota fino a un timer di cortesia:
  appena i moduli si annunciano, se quella chiamata era fallita si
  ricostruisce subito.

- **Il vassoio delle Azioni rapide segue il tema scuro.** In dark il ripiano
  restava un lenzuolo bianco in mezzo alla Home nera, coi tasti scuri sopra:
  il fondo leggeva una variabile che non esiste (`--bg`) e cadeva sul
  ripiego chiaro. Ora legge quella vera del tema (`--bg-sculpted`): col
  tema scuro e' un ripiano scuro appena rialzato dal fondo, col chiaro
  resta identico a prima. Stessa pulizia sulle sfumature delle tessere.

- **Il banco del ritratto si aggiorna in loco, senza ricostruirsi.** Ogni
  scelta rifaceva da capo tutte le file e buttava le ottanta pastiglie
  composte: su un dispositivo lento il banco restava in subbuglio per
  decine di secondi dopo ogni tocco, con le caselle vuote che si
  riempivano una alla volta. Ora un tocco cambia solo cio' che cambia —
  la spunta, le file che entrano o escono — e ogni pastiglia tiene il
  disegno vecchio finche' quello nuovo non e' pronto.

- **Le pillole d'avviso respirano anche in compatta.** La modalita' compatta
  spegneva l'alone dietro le tessere — ed era proprio l'alone il respiro
  degli avvisi, quello che li fa muovere anche quando non hanno un disegno
  loro. Nella pillola l'alone si fa velo aderente, appena colorato del
  colore d'avviso, e continua a pulsare piano; le pillole senza avviso
  restano piatte come da progetto.

- **La riga «Ambiente» nella card del Clima si legge.** Il carattere della
  temperatura ambiente sotto lo slider era troppo piccolo: leggermente piu'
  grande, con gli estremi della scala che restano contorno.

- **Il WebRTC delle telecamere dice qual e' la leva.** La strada WebRTC parte
  solo col «Nome stream go2rtc» compilato nella scheda Telecamere — il nome
  della telecamera non c'entra. Ora il campo lo spiega sotto, e quando la
  strada viene saltata il popup dice esattamente cosa compilare.

- **La bolla della wallbox nel flusso legge i kW come kW.** Il sensore
  scriveva 1,61 kW e la bolla diceva «2 W»: l'istantanea leggeva lo stato
  grezzo ignorando l'unita'. Ora i watt li conta chi guarda anche l'unita',
  per ogni carico.

- **Il tasto Clima rapido e' per unita', e si imposta dove si configura
  l'unita'.** Modalita', temperatura e ventola stavano in un blocco globale
  sopra le unita' — «viene attribuito quel valore a tutto» — e la cameretta
  non poteva volere 24 gradi col salone a 26. I tre campi ora stanno nel form
  di aggiunta, prima di «Aggiungi unita' clima», e nella finestra della
  matita: ogni unita' ha i suoi passi, che viaggiano con la configurazione
  (revisione 12). La tendina della Ventola non resta piu' vuota quando
  l'unita' non dichiara i suoi `fan_modes`: si offrono le quattro velocita'
  standard, coi nomi per esteso.

- **Nel popup Clima la tessera della stanza disegna la stanza.** Bastava che
  l'unita' avesse una stanza per ritrovarsi l'icona della porta; ora esce il
  disegno di casa dell'icona della stanza, e la porta e' tornata alle porte.

- **Azioni rapide piu' oneste.** Il campo «Entita' da comandare» compare solo
  per i tipi che la usano (toggle, script, scena): i popup nativi le entita'
  se le prendono da soli. E un popup nativo senza nome scritto dice cosa apre
  — Luci, Clima, Antifurto, Lavatrice — invece di «Azione rapida» ripetuto.

- **I modali di modifica si leggono.** L'entita' inserita stava su una
  pillola blu piena col testo invisibile: il blu resta al bottone-lente, la
  chip col nome torna chiara. «Modifica luce» spiegava il solo-vista con le
  parole delle prese («il frigo, il modem, il congelatore») schiacciate in
  una colonnina: parole sue e riga impaginata. Una luce aggiunta senza nome
  prende il friendly name dell'entita', non lo slug «faretti_cucina». E le
  tendine delle stanze dei modali dicono solo il nome, senza emoji davanti.

- **Le icone dicono la stessa cosa dappertutto.** Nel form delle Stanze
  l'anteprima accanto al campo diceva l'emoji di sistema (🚿) mentre catalogo
  e righe salvate dicono il disegno di casa: ora anche l'anteprima chiede al
  motore dei disegni. Nelle tendine «Seleziona stanza» (Temperatura, Clima,
  Finestre) i nomi uscivano con l'emoji davanti — un catalogo estraneo — e in
  un menu nativo il disegno di casa non si puo' mettere: resta il nome, senza
  icona sbagliata.

- **Nel catalogo icone i risultati della ricerca salgono in testa.** La
  griglia stava ancorata in fondo a una finestra ad altezza fissa — il guscio
  dei dialoghi prevede due figli, il picker ne ha tre, e la riga elastica
  finiva alla barra di ricerca: cercando, l'unica icona trovata restava in
  basso con un vuoto enorme sopra. Ora testata, ricerca e griglia hanno
  ognuna la propria riga e i risultati stanno subito sotto la ricerca.

- **Aggiungere una voce al MiniPC non butta le entita' gia' scritte.** Il
  ridisegno della lista ripartiva dai valori catturati all'apertura del
  pannello: tutto cio' che era digitato ma non ancora salvato spariva — con
  l'Aggiungi come col cestino. Prima di ridisegnare ora si raccoglie quello
  che c'e' scritto.

- **Salvare una scheda accende la sua sezione, anche se era stata nascosta a
  mano.** Salvare contenuto e' esprimersi su quella sezione: il veto manuale
  cade per la sola scheda salvata, le altre scelte restano sacre. Vale anche
  per le sezioni nate dai moduli (Stanze, Luci, Prese, Aspirapolvere). E il
  veto lo fa cadere solo il VERO tasto di salvataggio della scheda: un submit
  qualunque che risale il documento — l'editor ne e' pieno — non riaccende
  una sezione appena nascosta dalla fascia.

- **Una sola icona nella riga della stanza.** Il quadratino grezzo del campo
  icona usciva accanto al selettore del catalogo (da telefono era gia'
  nascosto, da desktop no): a schermo resta solo il selettore, su ogni
  misura.

- **Il Report non balla piu': i numeri hanno un padrone solo.** La Panoramica
  alternava due serie — 473 e 586 kWh, 81% e 84%, gli euro calcolati e
  «0,00 €» — perche' i KPI e la griglia finanziaria avevano tre mani addosso:
  due render del guscio piu' i moduli, ognuno con la sua formula e le sue
  tariffe. Il cartello del padrone ora ferma anche `edSetText` e l'anello
  dell'autosufficienza, e le tariffe dei moduli partono dagli stessi default
  del guscio (0.25 €/kWh comprato, 0.10 venduto): scrive uno solo, con un
  solo calcolo.

- **Dopo il reset totale la barra teneva sezioni accese su una plancia
  vuota.** Stanze, Luci, Prese e Aspirapolvere — le voci nate dai moduli —
  non seguivano la regola d'esordio delle altre: mai decisa e senza contenuto
  = spenta. Ora la seguono, e a plancia azzerata restano Home e Config.

- **Le Stanze non si potevano nascondere.** Era l'unica pagina della barra
  senza il suo interruttore nella scheda dell'editor: ora ce l'ha, come
  tutte le altre.

- **La tessera dell'auto esce anche senza foto.** Con una vettura profilata
  la tessera della Home leggeva solo le chiavi globali — che si riempiono ai
  salvataggi successivi, la foto compresa — e un'auto con la batteria mappata
  nel suo profilo restava invisibile finche' non si toccava altro. Il profilo
  ora comanda appena e' leggibile, anche da solo.

- **Lo stato di carica dice solo la percentuale.** Sotto la freccia e i watt
  della batteria la dicitura «SOC» non aggiungeva niente: via, resta «86%».

- **Stanze e Aperture avevano la stessa porta.** In configurazione — e da
  telefono, dove della linguetta resta il solo simbolo — due 🚪 affiancate
  non si distinguono. La porta resta alle Aperture, che di porte vivono;
  le Stanze prendono il divano 🛋️, lo stesso segno che Home Assistant usa
  per le aree, in configurazione e nella barra della plancia.

- **Il tasto 🎨 delle Aperture apriva la ricerca delle entita'.** Vestiva la
  classe della lente accanto ai campi entita', e per la plancia quella classe
  E' il segno che il campo chiede un'entita': sopra al catalogo delle icone
  si apriva «Scegli l'entita'», e premuto col dito si sceglieva un'entita'
  invece di un'icona. Il tasto ora ha una classe tutta sua — stesso vestito,
  nessun gestore altrui — e apre il catalogo e basta.

## 1.3.11

### Corretto (telecamere)

- **Le telecamere del pannello chiedono davvero il flusso live.** Nel
  documento ospitato il ponte verso Home Assistant fa da WebSocket, ma non
  portava le costanti del WebSocket vero: il controllo «la socket e' aperta?»
  confrontava 1 con niente, falliva sempre, e l'HLS si scartava prima ancora
  di mandare la richiesta. Nessuna telecamera del pannello si svegliava — le
  cam in cloud come Ring e Arlo restavano sulle istantanee vecchie, LED
  spento (#232). Ora il ponte porta le costanti, il controllo passa, e la
  richiesta di flusso parte.

### Corretto (temperature)

- **L'umidita' non si inventa (#242).** Senza entita' di umidita' scelta, la
  gemella si indovina sostituendo _temperature con _humidity nel nome; su un
  id senza «_temperature» la sostituzione restituiva lo stesso id, e la card
  mostrava la temperatura due volte — la seconda col «%» addosso. Ora
  l'indovinello vale solo se il nome cambia davvero, e senza entita' la
  casella dell'umidita' non compare proprio.

### Corretto (mappa del robot)

- **La mappa a schermo intero si rimpicciolisce anche sotto misura.** «Zoom
  in avanti ma non indietro, e non si apre completa»: il divieto di scendere
  sotto la misura d'apertura presumeva che a misura si vedesse tutta, e
  quando non succede rimpicciolire e' l'unica via d'uscita. Sotto misura la
  mappa resta centrata; il tasto ⟳ rimette com'era.

### Cambiato

- **La sezione «Tapparelle» ora si chiama «Finestre»** («Windows» in
  inglese). Ci si configurano tapparelle, tende, tende da sole e sensori di
  apertura sull'infisso: il nome vecchio raccontava solo la prima. Cambiano
  la linguetta nella barra, il titolo della pagina, la scheda dell'editor, la
  tessera della Home e le traduzioni in tutte le lingue; le entita' e i dati
  salvati restano come sono.

### Aggiunto

- **Il riavvio si chiede dal posto standard, col suo tasto.** Dopo
  «Installa» compariva solo una notifica testuale, e chi veniva da HACS
  cercava il tasto di riavvio dove lo aveva sempre trovato — nelle
  Riparazioni — senza trovarlo. Ora a installazione riuscita si apre la
  Riparazione «Riavvio richiesto»: premi, confermi, Home Assistant riparte.
  In tutte le lingue.

- **L'icona di un'apertura si sceglie dal catalogo.** Il campo era una
  casella di testo nuda e l'unica strada era l'emoji dalla tastiera: ora
  accanto al campo c'e' il tasto che apre lo stesso selettore delle icone
  degli avvisi — porte, cancelli e serrature ci sono gia' — e il campo resta
  scrivibile per chi vuole un'emoji fuori catalogo.

### Corretto

- **Il velo d'avvio non si vede piu' due volte.** All'avvio Home Assistant
  puo' staccare e riattaccare il pannello nel giro di un fotogramma: lo
  smontaggio immediato buttava via la plancia intera e il rimontaggio la
  ricostruiva da zero — velo, vuoto, velo di nuovo. Ora lo smontaggio aspetta
  un attimo e si annulla se il pannello torna attaccato.

- **L'ultimo sfarfallio all'apertura dei popup.** Su schermo tattile anche il
  velo sfocato dietro la card entrava in dissolvenza, e ricomporre il fondale
  sfumato a ogni fotogramma faceva vibrare lo sfondo: ora il velo c'e' o non
  c'e', a dissolversi e' solo la card.

- **L'entita' degli aggiornamenti ha un nome.** Senza un dispositivo la
  pagina Aggiornamenti ripiegava sull'entity_id: il dialogo titolava
  «update.dashboardmodern_...» e la riga dell'elenco restava grigia. Ora
  l'entita' appartiene al dispositivo «DashboardModern v2» e si presenta
  cosi'.

## 1.3.10

### Corretto

- **Sul telefono il popup dei widget non trema piu': entra in dissolvenza.**
  Il video della segnalazione mostrava la finestra comparire quasi intera in
  un fotogramma solo e poi assestarsi per un quarto di secondo: la scala con
  la traslazione, sopra il fondale sfocato, sul telefono perde fotogrammi e
  l'ingresso si legge come un tremito. Ora su schermo tattile la card compare
  in dissolvenza pura — niente si muove, niente puo' tremare — e su desktop,
  dove i fotogrammi ci sono, sale come prima. Tolto anche un ingresso a
  sfalsamento delle righe rimasto scritto su un nome che non esiste piu'.

- **Una X sola sul tondo di chiusura dello storico.** La X la disegna la
  regola generica col suo ::before, nascondendo quella scritta nel markup;
  la regola specifica dello storico rimetteva una misura al testo e sul
  tondo se ne vedevano due.

- **Al riavvio il velo nasce col logo, non con la sola rotella.** Il logo
  era un'immagine esterna e arrivava dopo il primo dipinto: prima si vedeva
  la rotella da sola, poi compariva lui. Ora una versione compressa del logo
  viaggia dentro la pagina e il velo e' completo dal primo fotogramma.

## 1.3.9

### Aggiunto

- **L'aggiornamento si installa da Impostazioni → Aggiornamenti.** Prima
  l'avviso c'era ma il tasto no — l'integrazione compariva fra i «non
  installabili», e l'unica strada era la deviazione in due passi dentro HACS.
  Il timore che teneva il tasto spento («due proprietari della stessa cartella
  e' come nasce un aggiornamento a meta'») si risolve nel COME si installa,
  non rifiutando il tasto: lo zip scaricato e' lo stesso identico che
  installerebbe HACS, viene controllato prima che un solo file si muova — i
  percorsi, il manifest, la versione promessa — lo scambio e' un rinomino con
  la cartella di prima tenuta accanto finche' la nuova non e' al suo posto, e
  un fallimento rimette tutto com'era. Alla fine serve un riavvio di Home
  Assistant, e l'entita' lo dice; HACS si riallinea da solo al suo prossimo
  controllo. Chi preferisce la strada di HACS ce l'ha ancora tutta.

- **Prese e Aspirapolvere nell'elenco dei widget.** Le due tessere esistevano
  in Home ma non comparivano nell'elenco ordina/accendi della scheda Widget:
  erano nate dopo il catalogo e nessuno le aveva mai iscritte. Ora ci sono, e
  una prova tiene i due elenchi legati per sempre.

### Corretto

- **La batteria di un impianto non trapela piu' nell'altro.** Passando al
  secondo impianto Energia, la bolla della batteria continuava a mostrare i
  watt e la percentuale di carica del primo: il testo si scriveva solo quando
  c'era una freccia da mostrare, e la percentuale si leggeva dal documento
  grezzo, che e' sempre il primo impianto. Adesso la bolla scrive a ogni giro
  («—» quando la batteria non c'e') e la carica segue l'impianto scelto; la
  stessa prova pretende, al ritorno, i quattro cerchi del flusso tutti
  visibili.

- **Un solo menu per l'icona degli avvisi.** Nella riga dell'icona erano
  rimasti due tasti che aprivano due selettori diversi: resta l'anteprima,
  che apre il catalogo, e il tasto vecchio si ritira.

- **Al riavvio il logo di caricamento esce subito.** Lo schermo restava
  bianco finche' il server, che stava ancora ripartendo, non consegnava tre
  script sincroni rimasti in testa alla pagina: ora stanno sotto il velo
  d'avvio, e sopra di loro non c'e' piu' niente che blocchi il primo dipinto.

- **Le tessere della Home hanno un guardiano contro il tremolio.** Una prova
  automatica apre il popup, scatena trenta giri di stati che cambiano e
  chiude: le tessere devono restare gli stessi nodi negli stessi pixel, e il
  corpo del popup aggiornarsi senza rinascere.

## 1.3.8

### Corretto

- **Aprire un popup dei widget non fa piu' tremare la Home.** «In ogni popup
  che premo dei widget trema tutto»: la firma con cui la griglia decide se
  ridisegnarsi contava anche QUALE tessera fosse aperta — un resto dell'epoca
  in cui il dettaglio era una tendina dentro la griglia. Aprire o chiudere la
  finestra cambiava la firma, e la firma ributtava giu' tutte le tessere mentre
  la finestra saliva: sul telefono la Home si svuotava e si ridisegnava, due
  volte per popup. La struttura adesso e' solo quali tessere ci sono;
  l'evidenza della tessera aperta e' un valore e si scrive addosso al nodo,
  come tutti gli altri valori.

- **Al primo avvio la pagina non resta piu' bianca.** Il velo d'avvio c'era,
  ma stava scritto DOPO i fogli di stile e gli script sincroni in testa: il
  browser non poteva dipingerlo finche' la rete non aveva finito. Adesso il
  velo e' la prima cosa del corpo, col suo stile critico in linea, e si
  dipinge alla prima passata; i fogli grandi si caricano senza bloccare, e gli
  script che non servono prima del runtime sono scesi in fondo.

- **I parametri del MiniPC si chiamano col loro nome.** Le card della
  configurazione dicevano «— Nessuna stanza — Casa Ingresso… Nel widget» al
  posto di «CPU (%)»: il nome sta nel value di un campo rinominabile, che nel
  textContent non compare, e nell'etichetta altri moduli appendono la tendina
  delle stanze e l'interruttore «Nel widget» — leggere il textContent
  raccoglieva solo la loro spazzatura.

- **Due rilevatori di temperatura nella stessa stanza: due card, non una.**
  Le associazioni oltre la prima esistevano gia' — il trend e la pagina Stanze
  le usano — ma la pagina Temperatura aveva due disegnatori in guerra per la
  stessa griglia, e vinceva quello che ne mostrava una sola. Il modello delle
  sonde e' sceso in core, il disegnatore e' rimasto uno, e ogni sonda ha la
  sua card — col titolo che distingue le sorelle («Salone · Comodino») e il
  risveglio sugli eventi anche per la seconda.

- **Il secondo impianto Energia si configura davvero, non addosso al primo.**
  «Ho configurato due impianti ma non legge i dati il secondo»: la maschera
  della scheda mostrava sempre le entita' del primo impianto, e ogni scrittura
  tornava li' — il secondo restava vuoto, e il primo rischiava di perdere i
  suoi sensori. Adesso la maschera si disegna dall'impianto scelto, ogni
  scrittura porta con se' l'impianto aperto, e al cambio di linguetta la
  maschera montata si rifa' subito.

- **La mappa del robot ingrandita si scorre col mouse, e una prova lo tiene
  fermo.** Il visore a schermo pieno c'era gia' — rotella e pizzico
  ingrandiscono, il dito e il mouse trascinano, il doppio tocco rimette
  com'era — ma nessuna prova difendeva il trascinamento: adesso una lo fa.

### Aggiunto

- **L'icona di una presa si sceglie dal catalogo di casa.** Il campo era una
  casella di testo libero col 🔌 dentro; adesso il bottone apre il selettore
  dei carichi — lo stesso catalogo in stile elettrodomestici, nessun catalogo
  nuovo — e il disegno scelto compare nella scheda, sul bottone e nella riga
  della tessera della Home. L'emoji resta il ripiego per le prese configurate
  prima.

## 1.3.7

### Corretto

- **Il cerchio in piu' in fondo al flusso Energia, e quello sopra il Wallbox.**
  Non era uno sfarfallio: erano due serie di bolle disegnate insieme. Nel guscio
  ce ne sono cinque a posto fisso — Boiler, Wallbox, Clima, Lavanderia,
  Cucina — di quando i carichi erano quei cinque e basta; oggi li disegna il
  flusso, in numero e posizione decisi dalla configurazione, e quelle cinque le
  ritira. La scheda dei nodi pero' decideva la stessa cosa da un'altra parte:
  ogni volta che una bolla veniva riaccesa in configurazione le rimetteva a
  posto la proprieta' `display`, e cosi' cancellava proprio il «nascosta» con
  cui il flusso l'aveva ritirata. La bolla vecchia tornava al suo posto fisso,
  addosso a quella nuova. Due padroni per la stessa bolla, ed e' sempre il
  secondo a rovinare il lavoro del primo: adesso su una bolla che il flusso ha
  gia' sostituito la scheda non scrive piu' niente, ne' per nasconderla ne' per
  riaccenderla, e dove scrive rimette il valore che c'era invece di cancellare
  la proprieta' — cancellarla non ripristina, scopre quello che sta sotto.

- **La stessa bolla vecchia riappariva anche in Giorno e in Mese.** La regola
  di stile che le tiene ritirate era scritta per la sola vista Istantanea, ma le
  cinque bolle a posto fisso stanno in tutte e tre le viste, e in tutte e tre
  c'e' qualcun altro che decide di mostrarle — la scheda dei nodi, e il
  completatore degli slot che riaccende la linea del Wallbox quando in casa c'e'
  un'auto. La difesa copriva un terzo del problema; adesso vale su tutte e tre.

- **Una luce assegnata a una stanza per nome adesso la tiene anche se la stanza
  cambia nome.** L'importazione dalle aree di Home Assistant scrive sulle luci
  il nome dell'area, non il suo identificativo; finche' il nome corrispondeva a
  una stanza configurata la plancia lo lasciava com'era, e al primo rinomino la
  luce restava scollegata. Adesso il nome diventa l'identificativo, che non
  cambia mai. Un'assegnazione scritta a mano continua a vincere su quello che si
  indovina dal nome dell'entita': `light.salone_lampada` messa in Cucina resta
  in Cucina.

- **Le bolle vecchie non fanno piu' in tempo a vedersi.** Le nascondeva il
  modulo del flusso nodo per nodo a ogni passata di disegno — seicentotrenta
  scritture in quaranta giri, su nodi gia' nascosti — e fra il momento in cui il
  guscio ne ridisegna una e il fotogramma in cui il modulo la rinasconde c'e'
  una finestra in cui quella bolla si vede. Adesso a spegnerle e' anche una
  regola di stile, che vale dall'istante in cui il nodo esiste e non aspetta
  nessun giro: le scritture passano da seicentotrenta a zero, e quella finestra
  non c'e' piu'.

- **«Temperatura Pannello solare Temperature».** La parola due volte, una per
  lingua, su tre righe della stessa finestra. Non nasce dalla plancia: Home
  Assistant costruisce il nome amichevole di un sensore incastrando il nome del
  dispositivo — scritto in italiano da chi abita la casa — con quello
  dell'entita', che l'integrazione scrive in inglese. Stampato com'e' pero'
  sembra un difetto della plancia. Adesso la parola in coda se ne va quando il
  numero accanto dice gia' la stessa cosa: «80,9 °C» dice «temperatura» meglio
  della parola. I nomi che senza quella parola direbbero di meno restano
  interi — «Delta Solare termico Boiler» non si tocca — perche' un nome
  accorciato troppo smette di dire quale cosa sia, ed e' il difetto peggiore
  dei due.

- **Sei frasi che dicevano il falso.** Tutte con la stessa forma: una finestra
  che afferma una cosa mentre nella stessa finestra ce n'è scritta un'altra. Con
  il sensore della casa irraggiungibile l'Energia diceva «il sole non produce»
  anche col fotovoltaico a due chilowatt. Una vasca con la sonda del pH e senza
  termometro leggeva «il pH è 7,3» e, riga sotto, «non c'è ancora una lettura».
  Un aspirapolvere che non dichiara la carica disegnava la barra rossa vuota,
  cioè annunciava una batteria a terra per dire che non la conosceva. Un'auto
  sola veniva raccontata al plurale, perché si contavano le righe — carica e
  autonomia — invece delle auto. La temperatura in grande è la media delle
  stanze, ma la lettura nel tempo chiedeva la storia della prima e diceva «più
  alto del solito» su un numero diverso da quello scritto sopra. E le righe del
  solare termico portavano solo il testo, così l'analisi delle sonde e la durata
  della pompa non uscivano mai. La regola che le lega: **assente non è zero, e
  assente non è spento.** Un sensore che non risponde non dice che la batteria è
  a terra o che il sole è fermo — dice che non risponde, e adesso la finestra
  dice quello.

- **Ring e Arlo: il video non partiva.** Due motivi opposti fra loro. Il primo:
  si provava sempre WebRTC, perche' la condizione era «il browser sa farlo» — e
  oggi lo sanno fare tutti. Ma quel WebRTC li' non e' quello di Home Assistant,
  e' l'estensione go2rtc, e vuole il nome del flusso che le si e' dato dentro
  go2rtc: chi non ce l'ha installata non ha nessun flusso con quel nome, e il
  nome lo si tirava a indovinare dall'entita'. Tre secondi buttati a ogni
  apertura, per tutti, prima ancora di cominciare — e altri tre subito dopo per
  un MJPEG che una telecamera in cloud non ha. Il secondo motivo e' il contrario
  del primo: si smetteva di aspettare quella che stava per riuscire. Ring, Arlo,
  Blink e Nest non hanno un flusso sempre acceso da agganciare; quando le chiami
  devono svegliare l'apparecchio, e ci mettono piu' dei dieci secondi che erano
  concessi. Si mollava sul piu' bello e si finiva sulle istantanee a due
  fotogrammi al secondo — «si vede, ma a scatti», che e' il modo in cui si vive
  un difetto senza saperlo nominare. Adesso Home Assistant lo dice da se' che
  flusso ha una telecamera, e la plancia gli crede: WebRTC solo se il flusso
  go2rtc c'e' davvero, e a chi deve svegliarsi si da' il tempo di svegliarsi.

- **Quando una telecamera non si apre, adesso si legge perche'.** Il messaggio
  diceva «nessuna strategia di streaming ha funzionato», che non si sa da che
  parte prendere. Adesso c'e' una riga per strada, con il motivo di ciascuna —
  quella tentata e fallita e quella nemmeno tentata.

- **La finestra della Piscina mostrava sempre e solo la prima vasca.** Leggeva
  la configurazione com'è — che sono le caselle della prima — mentre le altre
  vivono in un elenco accanto, e da lì non le ha mai viste. Adesso legge lo
  stesso elenco della scheda di configurazione, e con più di una vasca ogni riga
  porta davanti il nome della sua: «Idromassaggio · Acqua».

- **La luce della piscina non si accendeva dalla finestra.** Era una riga
  scritta — «Luce · Acceso» — come la temperatura dell'acqua, che però non si
  comanda. Chi apre una finestra che dice «Acceso» si aspetta di poterla
  toccare, e aveva ragione: pompa, riscaldamento e luce adesso hanno il loro
  interruttore. Se l'entità è fra quelle che si guardano e basta, l'interruttore
  non c'è: le due cose si parlano.

- **Alla prima vasca non si poteva dare un nome.** La maschera di sopra è quella
  che c'è sempre stata e configura la prima piscina, ma un nome non glielo
  chiedeva: quando la piscina era una sola si chiamava «Piscina» e bastava.
  Dalla seconda in poi serve, e le altre il nome ce l'hanno — la prima restava
  l'unica senza, e con due vasche non si distinguevano.

- **Una zona d'irrigazione non si poteva modificare.** C'era solo il cestino:
  per cambiare il nome o la durata bisognava cancellarla e rifarla, e
  rifacendola si perdeva il posto nella sequenza — che è l'ordine in cui il
  programma le avvia, quindi non è un dettaglio. Adesso c'è la matita, come su
  ogni altro elenco della configurazione, e la zona modificata resta dov'era.

- **L'icona della porta non compariva piu'.** Nelle Azioni rapide una porta
  prendeva il disegno del cancello: «Door Piscina Spa» e «Cancello» finivano
  identici. Non era un difetto del motore delle icone — nel catalogo la porta
  non c'era proprio, e il cancello si teneva per se' anche il suo simbolo, 🚪.
  Chi configurava una porta trovava l'unica cosa che quel simbolo sapesse
  trovare. Adesso la porta c'e', col suo disegno, e il cancello ha il suo. Chi
  aveva gia' un cancello configurato non si ritrova una porta.

- **La croce per chiudere si vedeva poco.** Era un testo grigio chiaro senza
  sfondo, in un angolo di una finestra piena di colori. Adesso ha un fondo, un
  bordo e il colore pieno del testo, e il bersaglio arriva a trentadue pixel —
  la misura sotto la quale un dito manca.

### Aggiunto

- **Le prese hanno una sezione loro.** Si potevano già configurare — la scheda
  Luci accetta anche `switch.`, e una presa messa lì si accende benissimo — solo
  che si chiama luce: finisce nell'elenco delle luci, si conta nel «3 accese»
  del salone, e «spegni tutte le luci» la spegne. Per la TV del salotto può
  anche andare; per il modem no. Il difetto non era che non si potesse fare: era
  doverla chiamare col nome di un'altra cosa. Adesso c'è una scheda Prese in
  configurazione e una pagina sua nella barra, con le prese raggruppate per
  stanza. Quello che NON è cambiato è la parte migliore: si accendono con lo
  stesso motore di tutto il resto e si disegnano con la stessa scheda delle
  luci — quindi il blocco «si vede ma non si comanda» vale anche qui, e la
  presa del frigo si protegge dalla sua stessa riga.

- **Le cose che si guardano e basta.** «Non è meglio oscurare il tasto
  accendi/spegni sulla presa del frigo?» — sì, e non è una preferenza estetica:
  un tasto che non va premuto non dovrebbe esserci. La presa del frigo, quella
  del modem, il congelatore in garage sono interruttori come gli altri, e la
  plancia li disegnava come gli altri; solo che premerli non è mai una cosa che
  si voleva fare, e chi li preme spesso non è chi ha configurato la plancia.
  Adesso nella scheda di una luce o di una presa c'è un interruttore: la riga
  resta dov'è, si legge sempre se è accesa, ma il tasto non risponde. Il grigio
  da solo non sarebbe bastato — un tasto disegnato spento che poi funziona è
  peggio di un tasto normale — quindi il rifiuto sta nel motore, in un punto
  solo per cui passano tutte e quattro le pagine che comandano qualcosa:
  nemmeno «spegni tutte» la tocca. La scelta viaggia con la configurazione,
  perché è una decisione della casa e non del telefono da cui la si è presa.


- **Le finestre dicono quando, e da quanto.** Erano poco informative: dicevano
  che una cosa e' accesa, che si legge gia' dal colore del cerchio. Adesso
  mentre la batteria si carica la sezione Energia cambia soggetto — la domanda
  non e' piu' quanto consuma la casa, ma quando sara' piena — e risponde: «La
  batteria e' piena fra un'ora e venti». La pompa del solare termico dice da
  quanto gira, non solo che gira. Il momento di partenza lo sa Home Assistant,
  e cambia solo quando quella cosa parte o si ferma: non si inventa niente, e
  dove il momento non c'e' non si scrive una durata.

## 1.3.6

### Aggiunto

- **Le finestre leggono i numeri, non li elencano soltanto.** Dentro il motore
  c'e' adesso un modello di una grandezza nel tempo: prende le letture delle ore
  precedenti e ne ricava le quattro cose che servono per dire qualcosa di
  sensato su un numero — da che parte sta andando, quando arrivera' dove deve
  arrivare, quale sia il suo valore abituale, e se quello di adesso sia normale.

  Prima la finestra diceva «574 W» e nient'altro, e un numero da solo non si sa
  se e' tanto o poco: 574 watt sono normali per una casa e tantissimi per un
  frigorifero. Adesso dice «Piu' alto del solito per quest'ora: 900 W contro
  300 W», e quando lo scostamento e' forte la sezione diventa da guardare anche
  se non c'e' niente di acceso — che e' il caso per cui un modello serve, perche'
  contando le cose accese non lo si trova.

  Non c'e' un modello di linguaggio, ed e' una scelta: non si puo' chiedere a chi
  installa una plancia per la propria casa di installare anche un'intelligenza
  artificiale, di pagarla a ogni finestra che apre e di mandare fuori casa le
  letture dei propri sensori. E su questo mestiere — contare — un modello di
  linguaggio e' lo strumento sbagliato: sbaglia i conti, e li sbaglia in modo
  plausibile.

  Tre scelte tengono onesto il modello, e sono anche i tre modi di sbagliarlo. Il
  tempo pesa: Home Assistant registra una lettura quando il valore cambia, non a
  intervalli regolari, e un sensore fermo a zero per sei ore che poi fa tre
  picchi in un minuto, contando le letture, «di solito» sta al picco — contando
  il tempo sta a zero, che e' la verita'. Si usa la mediana e non la media, che
  un inverter capace di leggere sessantamila watt per due secondi sposterebbe
  per un'ora intera. E una tendenza si annuncia solo se c'e': una retta la si
  traccia anche sul rumore, e sotto una certa bonta' la risposta e' «ferma»
  invece di una salita inventata. Stessa prudenza sulle previsioni, che tacciono
  quando l'arrivo cade oltre l'orizzonte: «la batteria sara' piena fra ventisei
  ore» e' un modo raffinato di non dire niente.

  Il modello non sa niente di sezioni, di finestre e di documento — prende numeri
  e restituisce numeri — quindi serve anche per altro: una soglia di avviso, una
  previsione dentro una sezione, il colore di una scheda.

- **Una lettura propria per ogni sezione.** Dieci sezioni su diciassette non
  avevano una frase loro e cadevano su un ripiego che sa contare soltanto cose
  accese e spente. Da li' l'Energia scriveva «4 cose, nessuna in funzione» con il
  fotovoltaico a 2,16 kW — le sue quattro righe sono casa, solare, rete e
  batteria — e la Sicurezza scriveva «Qui non c'e' ancora niente» con l'antifurto
  elencato subito sotto, perche' il suo antifurto non e' una riga. Non erano
  frasi imprecise: parlavano di un'altra cosa.

  Adesso l'Energia ragiona sul bilancio — «Il sole fa 2,16 kW e la casa ne usa
  574 W: ne avanzano 1,59 kW», con sotto «La batteria si carica a 1,47 kW»,
  perche' il segno meno detto a parole toglie un'ambiguita' che nessuno e' tenuto
  a sciogliere. La Temperatura dice la distanza fra la stanza piu' calda e la
  piu' fredda, che e' il dato utile: la media da sola non lo e'. La Piscina col
  pH fuori norma diventa da guardare anche senza niente acceso. Dove il dato non
  c'e' non si inventa niente e non si scrive una riga vuota: si dice di meno.

### Corretto

- **La batteria del flusso Energia sfarfallava fra due formati.** Nel video
  arrivato dalla casa: la bolla diceva «▼ 1796 W / SOC 75%» e due fotogrammi dopo
  «-1796 W / 75 %», avanti e indietro. Non era un'animazione: erano quattro mani
  sullo stesso numero. Il guscio col suo formattatore, il modulo del flusso con
  la freccia, un modulo di rattoppo con una terza forma, e un quarto che teneva
  un MutationObserver sul nodo per rimettere il prefisso «SOC» addosso a quello
  che ci scrivevano gli altri. Sorvegliare un nodo per disfare la scrittura di un
  altro modulo non e' una correzione: e' il secondo padrone che litiga col primo.
  Adesso il padrone e' uno, e si prende il cartello che ferma la mano del guscio
  prima che arrivi il primo stato, cosi' non si vede nemmeno il lampo iniziale.

- **Nelle Stanze la luce si accendeva ma non cambiava stato.** Il comando
  partiva, Home Assistant accendeva la luce, e la scheda restava «SPENTA». La
  scheda e' quella della pagina Luci — le Stanze se la prendono da li', perche'
  due schede per la stessa luce vorrebbe dire mantenerne due — ma il
  riallineamento era rimasto chiuso dentro la pagina Luci, e per giunta si
  fermava quando quella pagina non era quella aperta. Adesso chi possiede il
  disegno possiede anche l'aggiornamento, per tutte le sue schede dovunque siano.
  In piu' il tocco si vede subito, invece di aspettare il giro completo del
  comando: se lo stato che arriva dice il contrario vince lui, e la promessa
  scade da sola, cosi' un comando che non arriva a destinazione non lascia una
  scheda che mente.

- **La finestra del Clima lasciava tre voragini fra le etichette e i comandi.**
  L'etichetta ha una larghezza fissa di ottantadue pixel, che nella riga
  orizzontale e' la colonna di sinistra; sul telefono la riga diventa una colonna
  e quegli ottantadue pixel smettono di essere una larghezza e diventano
  un'altezza — la parola «Modalita'» alta ottantadue pixel, col vuoto sotto. La
  correzione esisteva gia' ma era scritta per una sola delle due finestre: un
  selettore aggiornato e il suo gemello dimenticato. Duecentodieci pixel di vuoto
  in meno.

- **Sotto «Comandi» c'erano cose che non si comandano.** Nella finestra
  dell'Energia stavano Casa, Solare, Rete e Batteria: quattro letture, senza un
  tasto. Lo stesso per Telecamere, Solare termico e Piscina. Un titolo che
  annuncia comandi dove non ce ne sono manda a cercare qualcosa che non c'e', e
  chi cerca pensa che sia rotto. Adesso il titolo guarda cosa c'e' davvero sotto.
  E le percentuali si vedono prima di leggerle: sotto il nome c'e' una barra che
  diventa rossa sotto il venti per cento.

- **Trentatre regole di stile morte sul Clima, e tre conflitti veri.** La scheda
  del Clima aveva due pelli, in due fogli diversi, che si contendevano
  quattordici misure con valori in disaccordo — la scheda alta 248 pixel o senza
  minimo, il numero grande 46 o 28, i bordi 22 o 17. Vinceva chi caricava per
  ultimo, quindi la misura vera non stava scritta da nessuna parte; e nel
  frattempo quella scheda non la disegna piu' nessuno. Se ne vanno tutte e due.
  Restavano tre conflitti veri — il marchio dell'auto, il grassetto di un avviso,
  l'imbottitura di un'intestazione — e adesso ognuna di quelle decisioni ha un
  padrone solo. Una prova rifa' il conto a ogni giro e pretende zero.

- **Lo storico chiesto a Recorder ha un padrone solo.** Il grafico delle
  temperature aveva la sua domanda con la sua cache; quando anche le finestre
  hanno avuto bisogno delle stesse letture, copiarla avrebbe fatto due padroni
  dello stesso traffico — due cache che non si parlano, due domande per la stessa
  entita', e la certezza che prima o poi una scada con una regola diversa
  dall'altra. La domanda non blocca niente: la finestra si apre col numero che
  ha, e si ridisegna quando la risposta arriva.

## 1.3.5

### Aggiunto

- **La finestra di una tessera dice cosa sta succedendo, invece di elencare.**
  Era un elenco: undici righe con un nome e un numero, e toccava a chi guarda
  metterle insieme. Adesso e' una forma sola per tutte le sezioni, sempre nello
  stesso ordine — il verdetto, la frase, la misura con la sua corsa, le caselle,
  i comandi.

  Il **verdetto** e' la pillola in cima: verde quando non c'e' niente da fare,
  ambra quando qualcosa sta lavorando adesso, rossa quando qualcuno deve
  guardarci. Se c'e' qualcosa da guardare vince quello, anche se nel frattempo
  qualcos'altro sta lavorando: una finestra aperta batte una lavatrice in
  funzione.

  La **frase** e' quella che si legge davvero: «2 zone accese su 3, mancano 2,0°
  all'obiettivo», «Nessuna perdita, tutte e sei le sonde hanno risposto», «La
  piu' bassa e' Garage al 12%, su 3». La scrive un modulo a parte che non tocca
  il documento, cosi' si prova senza browser — una frase che conta male e'
  sbagliata senza rompersi, e a occhio non si vede.

  La **corsa** e' la storia delle ultime tre ore sotto il numero grande, chiesta
  a Recorder con lo stesso trasporto che usa gia' il grafico delle temperature:
  non se ne apre un secondo, e finche' non risponde la finestra sta in piedi lo
  stesso — il numero c'e', la linea arriva dopo.

  Le **caselle** sono le stesse misure che la tessera gia' riassumeva: non se ne
  inventano altre. Le pillole dello **stato** dicono in un colpo d'occhio chi e'
  in funzione. I **comandi** sono le righe di prima, con dentro i loro
  interruttori: cambia il posto, non quello che fanno. E «Chiudi» adesso e'
  scritto in cima, non un tondino in un angolo.

### Corretto

- **All'avvio si vedeva la plancia vecchia, e poi cambiava.** Sotto non c'e'
  nessuna versione vecchia: il guscio disegna una sua Home e i moduli gliela
  riscrivono addosso quando sono installati. Il velo di avvio pero' se ne andava
  quando aveva finito il guscio, non quando la plancia era quella vera, e in quel
  buco si vedeva l'altra — misurato, a partire da 727 millisecondi. Adesso il
  velo aspetta i moduli; se non arrivano si toglie lo stesso dopo otto secondi,
  perche' la plancia del guscio e' comunque meglio di una schermata che non
  finisce mai.

- **La sezione Energia sfarfallava, «con qualcosa sotto».** Erano due cose
  insieme. Il guscio e il modulo scrivevano gli stessi numeri presi da due parti
  diverse — il guscio dalle caselle vecchie, il modulo da Recorder — e si
  riscrivevano a vicenda a ogni cambio di stato: quello che si vedeva erano due
  valori che si alternavano. E il controllo «e' gia' scritto?» si faceva
  confrontando con `innerHTML`, che il documento restituisce rinormalizzato — un
  colore scritto `color:var(--x,#fff)` torna indietro come `color: var(--x,
  #fff);` — quindi non tornava mai e si riscriveva sempre. Misurato:
  quindicimila modifiche al documento in tre secondi, con settecentoventi pezzi
  distrutti e rifatti. Adesso zero pezzi rifatti: chi scrive lascia un cartello e
  il guscio quel posto non lo tocca piu'.

- **Le entita' nelle Stanze non si comandavano.** Le luci avevano gia' la card
  vera della pagina Luci; tutto il resto — una presa, un ventilatore, un'entita'
  assegnata a mano a una stanza — era una riga che portava nella sezione e basta:
  si toccava e non succedeva niente. Adesso quello che si accende e si spegne ha
  il suo interruttore li', che si muove appena lo tocchi e che il cambio di stato
  poi conferma o corregge.

## 1.3.4

### Aggiunto

- **La plancia dice da sola quando esce una versione nuova.** L'integrazione
  chiede a GitHub ogni mezz'ora se e' uscita una release, e la mostra in
  *Impostazioni → Aggiornamenti* con le note di versione. Serviva, perche' HACS
  da solo ci mette molto di piu': un repository **personalizzato** — aggiunto
  per URL, che e' il modo in cui si installa questa integrazione — lo
  ricontrolla **ogni quarantotto ore**, e non lo guarda nemmeno al riavvio di
  Home Assistant. Sta scritto nel suo codice:

  ```
  custom_components/hacs/base.py
      async_track_time_interval(
          hass, self.async_update_downloaded_custom_repositories, timedelta(hours=48)
      )
  ```

  Quelli dello store predefinito passano da un'altra strada, ogni sei ore, e
  questo progetto in quello store non puo' entrare: la validazione dello store
  pretende anche i controlli su `topics` e `license`, e la licenza qui e'
  proprietaria. Da quarantotto ore a mezz'ora, quindi, e il tempo di
  installarla lo accorcia il pulsante «Aggiorna informazioni» di HACS, che la
  notifica stessa ricorda di premere.

  L'installazione resta a HACS: i file sono i suoi, e due proprietari della
  stessa cartella e' come nasce un aggiornamento a meta'. E chi la plancia la
  tiene su una rete senza uscita puo' spegnere il controllo dalle opzioni
  dell'integrazione: spento, non contatta piu' nessuno.

- **Dalla finestra di una tessera si va nella sua sezione.** La finestra dice
  cosa sta succedendo; quando non basta si va nella sezione, che e' il posto
  dove quella roba si comanda per intero — e prima da li' si usciva soltanto
  chiudendo e andando a cercare la voce in basso. Adesso in fondo c'e' «Apri
  sezione», e porta davvero: chiude la finestra e preme la voce vera, che e' il
  gesto che il guscio conosce e l'unico che funziona per le pagine nate da un
  modulo. Il tasto non c'e' dove non porterebbe da nessuna parte — batterie,
  allagamenti e cose da fare vivono soltanto in Home — ne' dove la sezione e'
  stata spenta in configurazione: aprire una pagina che l'utente ha deciso di
  non avere sarebbe peggio che non offrirla.

### Corretto

- **L'icona scelta per un'apertura si leggeva `mdi:gate`.** Il selettore delle
  icone e' quello del motore e scrive il nome mdi della voce; chi poi stampava
  quel campo lo stampava come testo. Si vedeva nella riga dell'apertura sulla
  Home e nell'anteprima della finestra di modifica: al posto del disegno, la
  scritta. Adesso il nome mdi lo si da' al motore, che ne tira fuori il disegno
  di casa; chi non ha mai aperto quel selettore ha ancora l'emoji del gruppo e
  continua a vedere quella.

- **L'avviso di aggiornamento teneva fermo l'avvio.** La prima occhiata a GitHub
  si aspettava prima di considerare avviata l'integrazione. Una rete che rifiuta
  subito non si sente; una che ingoia il pacchetto senza rispondere — un
  firewall che scarta invece di respingere — teneva fermo tutto per i venti
  secondi del timeout, a ogni avvio di Home Assistant e a ogni ricarica. Adesso
  quella occhiata si fa da parte: l'entita' senza risposta legge gia' «niente di
  nuovo», e quando la risposta arriva si aggiorna da sola.

- **Togliendo la plancia principale spariva l'avviso di aggiornamento.**
  L'avviso lo porta una plancia sola, e chi lo porta si decide quando quella
  plancia si avvia: tolta quella, le altre erano gia' avviate e nessuna se ne
  accorgeva. Restava senza fino al riavvio di Home Assistant. Adesso la prima
  che resta riparte e se lo riprende.

- **L'interruttore degli aggiornamenti compariva anche dove non comandava
  niente.** Con piu' di una plancia lo si vedeva su tutte, ma a contare e' solo
  quello della prima: spegnerlo su una secondaria non fermava la richiesta a
  GitHub, e accenderlo la' non la faceva partire. Su una scelta che riguarda la
  riservatezza non e' un dettaglio: adesso compare dove ha effetto.

- **Il grafico delle temperature tagliava i numeri con molte stanze.** I numeri
  in coda alle linee si allontanano per non accavallarsi, ma la passata che li
  ridiscendeva dall'orlo alto non guardava piu' quello basso: sul telefono
  bastavano quattordici stanze perche' gli ultimi finissero sull'asse delle ore
  o proprio fuori dall'immagine. Adesso il passo si stringe fino a dove il
  numero si legge ancora, e chi non ci sta il numero non ce l'ha — resta la sua
  linea, col suo colore e il suo tratto, e la legenda che la nomina. Meglio un
  numero in meno che un numero tagliato.

- **La finestra dell'elettrodomestico restava aperta senza croce per
  chiuderla.** Da quando la testata segue la pagina aperta, una riga la nasconde
  quando quella pagina non e' la Home. La riga pero' diceva «intestazione», e
  basta: nel documento di intestazioni ce n'e' una per ogni finestra di
  modifica — quella col titolo e la croce — e le spegneva tutte. La scheda degli
  avvisi, per la stessa ragione, non aveva piu' la forma di quella degli
  elettrodomestici. Adesso quella riga parla solo della fascia della plancia,
  che e' una sola.

- **Le icone nuove potevano bloccare la pagina.** Il motore ridisegna un'icona
  solo se quella che trova non e' gia' quella giusta, e per capirlo confrontava
  il testo del glifo. Con l'emoji funzionava; col disegno del catalogo il testo
  e' vuoto, il paragone non tornava mai, e il motore riscriveva a ogni giro
  senza fermarsi — la plancia restava li'. Adesso ogni disegno si porta addosso
  la sua firma, e chi lo guarda sa riconoscerlo.

- **Tredici voci del catalogo uscivano ancora a emoji.** La configurazione salva
  il nome mdi, i disegni hanno il nome della voce, e in mezzo c'e' il catalogo
  che dal primo risale alla seconda: solo che chi cercava il disegno provava un
  nome solo, e chi risaliva alla voce si accontentava della prima che
  somigliasse. Cosi' `mdi:home` apriva la soffitta e la cucina non si trovava
  affatto. Adesso i nomi si provano tutti, il nome mdi porta alla sua voce e non
  a una che le somiglia, e la prova che pretende il disegno parte da dove parte
  lo schermo — prima partiva da un'altra parte, ed e' per questo che quelle
  tredici erano disegnate sulla carta e a faccina sullo schermo.

- **Elettrodomestici: due disegni morti della stessa scheda.** La sezione si
  costruisce le proprie schede da quando c'e' la vetrina, ma il disegno
  precedente — la scheda alta, con l'immagine grande sopra e i numeri sotto —
  era rimasto in piedi in due fogli diversi, e i due si contendevano
  centoventisei decisioni: quanto e' larga, che angoli ha, quanto e' grande il
  numero. Vinceva chi caricava per ultimo. Solo che quella scheda non la
  disegna piu' nessuno: messa in piedi la plancia e contati i selettori uno per
  uno, dei duecentoquindici del primo foglio ne trovavano qualcosa quattro, e
  uno solo dei quarantanove del secondo. Se ne vanno tutti e due, e con loro
  dieci animazioni per famiglia di elettrodomestico che non hanno mai girato:
  quelle che si vedono sono sempre state le altre, della vetrina, piu' ricche.

- **Centosettantasei regole di stile avevano due padroni; adesso zero.** La
  stessa regola scritta col peso massimo in due fogli che non si parlano:
  finche' i valori coincidono non si vede niente, il giorno che uno cambia
  vince quello che capita di caricare per ultimo e la modifica «non fa
  effetto». Due non erano peso morto ma difetti veri. L'editor scuro cambiava
  colore a seconda del tema di fuori, perche' il secondo padrone usava i nomi
  del tema di Home Assistant, che esistono solo quando la plancia e' gia'
  scura. E le righe delle luci erano rotte fra 761 e 900 pixel — la finestra a
  meta' schermo, il tablet in verticale: un foglio diceva «quattro caselle
  disposte cosi'», un altro ne dava cinque, e il nome della luce finiva
  schiacciato in 140 pixel con un buco da 257 accanto. Una prova apre la
  plancia, legge i fogli nell'ordine vero e dice quale riga di quale foglio non
  fa effetto.

- **Un disegno per fotogramma, non uno per evento.** Home Assistant manda un
  evento per ogni entita' che cambia stato, e in una casa vera sono decine al
  secondo. La plancia rispondeva ridisegnando tutto ogni volta — settecento
  righe di render piu' sedici moduli agganciati, per ogni singolo sensore che
  si muoveva. Misurato: centosettanta cambi di stato facevano centosettanta
  disegni e 1125 millisecondi dentro render, su una plancia quasi vuota e su un
  computer. Adesso la risposta agli eventi si mette in coda e disegna una volta
  sola alla fine della raffica: un disegno, sette millisecondi. Chi chiama il
  disegno a mano — un salvataggio, un cambio di pagina — continua ad averlo
  subito.

- **I carichi comparivano sotto Elettrodomestici, Aperture e Backup.** Un
  blocco «CARICHI / + Aggiungi carico» spoglio, che li' non vuol dire niente.
  Era un secondo editor dei carichi, con lo stesso nome di funzione di quello
  vero: cercava il pannello dei flussi e, se non lo trovava — cioe' ogni volta
  che la configurazione era aperta su un'altra linguetta — ripiegava sulla
  scheda intera, e da li' ti seguiva ovunque. Bastava aprire Energia una volta.

- **Tre configurazioni restavano su un dispositivo solo.** Le icone degli
  avvisi, le entita' assegnate a mano a una stanza e il segno progressivo delle
  auto non erano nell'elenco di cio' che viaggia fra i dispositivi, quindi
  nemmeno nel backup. Le prime due si configuravano sul telefono e sul computer
  non c'erano; la terza e' la guardia contro gli identificativi riusati, e senza
  viaggiare il secondo dispositivo ripartiva da capo col conteggio — la
  prossima auto nasceva con l'identificativo di una cancellata, ereditandone le
  foto. Una prova legge i sorgenti e pretende che ogni casella scritta stia o
  nell'elenco che viaggia o in quello di cio' che resta sul dispositivo, col
  perche' scritto accanto.

- **Stanze: la luce non si accendeva, e il clima non portava sul clima
  giusto.** La card della luce e' la stessa della pagina Luci, ma il gesto era
  rimasto legato a quella pagina: si vedeva l'interruttore, si premeva, non
  succedeva niente. Il clima invece cambiava pagina e finiva li', che in una
  casa con dodici condizionatori vuol dire lasciare chi guarda in cima a un
  elenco. Adesso la luce si comanda da dove e' disegnata, e dopo il cambio di
  pagina si apre la cosa che si e' toccata.

- **Il grafico delle temperature non si leggeva.** Una sola riga orizzontale
  con un numero accanto — quella del comfort — e tutto il resto sospeso nel
  vuoto; due stanze dello stesso azzurro, perche' le tinte erano sei e la
  settima ripartiva dalla prima; e i numeri in coda alle linee tutti impilati
  in dieci pixel. Adesso la scala si prende un passo tondo con quattro-sette
  righe numerate, le tinte restano sei ma cambia il tratto — pieno, a tratti, a
  puntini, quindi diciotto stanze prima che due linee si somiglino — e i numeri
  si allontanano invece di sovrapporsi.

- **«E' un contatore totale?» era una domanda con due risposte.** Da quella
  risposta dipende tutto il calcolo dell'energia: si parte da un contatore che
  sale e non torna mai indietro, e giorno, mese e anno sono la differenza fra
  due letture. La domanda era scritta due volte, con regole diverse. Una
  guardava solo il nome, e cosi' un sensore di potenza chiamato `total_power`,
  che sta in watt, passava per contatore: si prendeva la differenza fra due
  watt e la si chiamava energia. Lo stesso per un contatore dell'acqua in litri
  marcato `total_increasing`. L'altra controllava di avere davvero energia ma
  non conosceva la parola «counter» e non guardava mai il nome amichevole.
  Adesso e' una sola, con l'unione delle due meta' giuste.

- **La plancia chiedeva i suoi moduli a dieci riprese.** Sono
  centosessantacinque, tre megabyte e mezzo, e la catena degli import e'
  profonda dieci livelli: un browser scopre un modulo solo quando ha finito di
  leggere quello che lo importa. In quei secondi si vede la plancia com'e'
  disegnata dal guscio — il meteo grande in mezzo alla pagina, le azioni rapide
  senza il loro ripiano — e poi si sposta tutto sotto gli occhi. Adesso il
  guscio porta l'elenco davanti e il browser li chiede tutti insieme:
  mediana su tre giri a caldo, l'ultimo modulo arriva a 645 millisecondi invece
  di 1500. Resta il pezzo piu' grosso, che non e' rete: durante l'avvio il filo
  principale sta occupato 2,3 secondi a installare i moduli, ed e' li' che vive
  il resto dell'attesa.

- **Sette nomi per quattordici funzioni.** Chi importa a memoria si prende
  l'una per l'altra, e il codice continua a funzionare finche' un giorno non
  funziona. Tre erano copie morte che nessuno importava, due erano cose diverse
  col nome uguale — il filo dei consumi parte da zero, quello della temperatura
  si adatta al minimo e al massimo — e un `formatNumber` era una trappola: due
  versioni con argomenti diversi, e chi importava quella sbagliata vedeva il
  numero uscire con le cifre di serie, senza un errore.

### Aggiunto

- **Un catalogo di icone tutto nostro, cinquantasei disegni nuovi.** Nella
  stessa schermata ne convivevano tre stili: la scocca blu notte degli
  elettrodomestici, il tratto sottile delle stanze, e le emoji del sistema per
  le stanze nel selettore dei carichi, per le azioni rapide e per i carichi —
  che per giunta cambiano faccia da un telefono a un altro, per cui la stessa
  plancia non era uguale nemmeno a se stessa. Adesso i disegni sono tutti della
  stessa famiglia: le ventiquattro stanze, le azioni, e gli impianti — pompa di
  calore, riscaldamento a pavimento, deumidificatore, server, router, stampante,
  fotovoltaico, batteria, pompa, irrigazione, sauna, ascensore, presa, stufa a
  pellet. Contate le voci dei tre cataloghi: centotredici, e nessuna resta senza.
  I colori e i tratti stanno in un modulo a parte, cosi' chi disegnera' la
  cinquantasettesima li chiede li' invece di sceglierli a occhio.

- **La plancia non chiede piu' niente alla rete per aprirsi.** La testata del
  documento apriva quattro connessioni verso l'esterno prima di disegnare
  qualsiasi cosa — il foglio dei caratteri di Google e tre librerie da
  jsdelivr — e nessuna delle quattro era rimandata: bastava che una sola non
  rispondesse perche' la lettura della pagina si fermasse li'. Home Assistant
  sta in casa, e molte case sul quadro non hanno internet, o ce l'hanno lento,
  o hanno un DNS che risponde quando gli pare: su quelle case la plancia non
  era lenta, era ferma, e ripartiva soltanto quando il browser si arrendeva da
  solo — decine di secondi dopo. Adesso le tre librerie e i caratteri li serve
  l'integrazione, dalla stessa cartella di tutto il resto. Su una linea che non
  arriva a Google la plancia passa da tredici secondi e mezzo prima di
  cominciare a uno e sette.

  E' anche la spiegazione piu' credibile del foglio del guscio che ogni tanto
  non arrivava — quello che faceva sparire i flussi finche' non si ricaricava
  la pagina: la sua richiesta stava in coda dietro quattro connessioni ferme.
  La rete di sicurezza messa nella 1.3.3 resta dov'e', ma adesso la coda
  davanti non c'e' piu'.

  Le impronte firmate che stavano negli attributi `integrity` non sono andate
  perse: si controllano sui byte in cartella a ogni giro di prove, e il giro
  che li rifa' — `scripts/porta-in-casa-le-librerie.mjs` — si ferma se il
  registro npm servisse un byte diverso.

- **Il README dichiarava una licenza che non e' la sua.** Il distintivo in
  testa diceva «MIT» e puntava al file `LICENSE`, che dice «DashboardModern v2
  License — All rights reserved». Due affermazioni opposte nella stessa riga, e
  su una licenza proprietaria non e' una svista che si possa lasciare li'.

- **L'ordine delle stanze arriva davvero a tutte le pagine.** Le frecce nella
  scheda Stanze spostavano la riga, la scheda si ridisegnava nell'ordine nuovo
  — la scheda l'elenco lo legge davvero — e Luci, Tapparelle, Clima ed
  Elettrodomestici restavano nell'ordine in cui le stanze erano state create.
  Chi ha messo l'Ingresso per primo continuava a vedere il Soggiorno in cima
  alle tapparelle. Il motivo: il modello canonico porta su ogni stanza un campo
  `order`, e chi lo trova gia' scritto se lo tiene; quel numero nasce alla
  prima migrazione e vale la posizione di allora. Le frecce riscrivevano
  l'elenco e non lo toccavano — due padroni dello stesso ordine, e vinceva
  quello vecchio. Adesso quando l'elenco cambia si riscrive anche il numero, e
  chi l'ordine se l'era gia' scelto se lo ritrova allineato alla prima apertura
  della scheda, senza dover ripremere niente.

- **Un'apertura tolta e rimessa adesso resta.** Le liste sono due — quello che
  hai aggiunto e quello che hai tolto — e il guscio le legge in quest'ordine:
  prima somma le aggiunte, poi toglie le rimozioni. Ma chi aggiungeva non
  ripuliva mai la seconda: un'apertura tolta una volta e rimessa dopo finiva in
  tutte e due, e la sottrazione arrivava per ultima. Nel giro in corso si
  vedeva — l'aggiunta entra anche in memoria — e al riavvio spariva. Da fuori
  si legge «non riesco piu' ad aggiungerne altre»: si aggiungevano davvero, e
  non tornavano piu' su. Le due liste non possono piu' dire il contrario l'una
  dell'altra: se un'entita' sta in tutt'e due ha ragione l'aggiunta, che e'
  l'ultimo gesto fatto apposta.

- **Ogni avviso puo' avere la sua icona.** La decideva il gruppo e basta:
  undici aperture, undici porte uguali, e la finestra del bagno
  indistinguibile dalla portafinestra del salotto. Adesso nella finestra di
  modifica c'e' il campo dell'icona, con lo stesso selettore del resto della
  plancia. Chi non la tocca continua a seguire il gruppo come prima — anche
  cambiando gruppo — e chi la sceglie se la ritrova nella tessera Aperture,
  che e' il posto dove quelle righe si devono distinguere.

- **La fascia della plancia si vede sulla Home, e a dirlo e' la pagina aperta.**
  Chi decideva era l'ultimo che aveva cliccato: il guscio accende e spegne
  quella fascia dentro il gestore delle voci in basso, e quel gestore lo lega
  una volta sola al caricamento. Le tre pagine nate dopo — Stanze, Luci,
  Aspirapolvere — hanno ciascuna il proprio ascolto, e di quella fascia non
  sanno niente: la portavano avanti com'era. Da Home a Stanze restava accesa,
  e sulla stessa pagina si vedevano due intestazioni; nell'altro verso, chi
  arrivava alla Home lasciando la fascia spenta se la ritrovava spenta — la
  Home senza la sua testata, senza aver toccato niente. Adesso la decisione
  non e' di un clic ma della pagina che sta aperta, scritta una volta sola nel
  modulo che le intestazioni gia' le possiede.

- **I numeri delle tessere si vedevano con la testa mozzata.** Il numero e'
  Oswald a quaranta con l'interlinea stretta a .92 — trentasette pixel di riga
  — e il disegno di quel carattere, fra quello che sale e quello che scende, a
  quaranta ne occupa quarantotto. Con la finestra che taglia addosso, quei
  sette pixel non uscivano: venivano tagliati. Non si era mai visto per un
  motivo che non fa onore a nessuno — Oswald arrivava da Google, e dove Google
  non si raggiunge il numero cadeva su un carattere di sistema che nella riga
  stretta ci sta: il difetto c'era per chiunque avesse una linea che arriva a
  Google, e non per la macchina che lo doveva scoprire. L'interlinea stretta
  resta, perche' e' lei che tiene i numeri vicini: a cedere e' soltanto la
  finestra, sette pixel sopra e sotto ripresi da un margine uguale e
  contrario. Il disegno non si sposta di niente.

- **Le linguette che scorrono di lato hanno un padrone solo.** I periodi
  dell'Energia e degli Elettrodomestici, gli impianti e le stanze sono lo
  stesso nastro disegnato in tre posti, e ne veniva lo stesso difetto tre
  volte. Il primo: chi scorre di lato taglia anche in alto e in basso — basta
  che un asse non sia libero perche' il browser ritagli pure l'altro — e il
  nastro dei periodi aveva quattro pixel di spazio contro una pillola che si
  solleva di due e porta un'ombra da ventotto: quella accesa si vedeva mozzata
  contro la testata della sezione. Il secondo: col mouse quel nastro e' una
  trappola, perche' la barra e' nascosta apposta e la rotella sopra una fila
  orizzontale scorre la pagina in giu' — le ultime linguette restavano oltre
  il bordo destro, visibili a meta' e irraggiungibili. Le Stanze la correzione
  ce l'avevano gia', scritta in casa loro; adesso e' una regola sola per
  tutt'e tre.

- **Una delle tre librerie non la usava nessuno.** panzoom arrivava a ogni
  avvio, trentadue chilobyte da scaricare, leggere ed eseguire prima che la
  pagina potesse andare avanti, e in tutta la plancia non c'e' una riga che lo
  chiami: la mappa dell'aspirapolvere si sposta e si ingrandisce con le sue
  trasformazioni. Adesso non arriva piu'. E hls.js — mezzo mega, che serve
  soltanto quando si apre una telecamera — e' passato a `defer`: c'e' lo
  stesso quando serve, ma non ferma piu' la lettura della pagina.

## 1.3.3

### Cambiato

- **La Home ha una grafica sola.** Le tessere dei widget e le card delle Azioni
  rapide erano due idee di card impilate una sotto l'altra — orizzontale e
  colorata la prima, quadrata bianca e spoglia la seconda — e si vedeva. Adesso
  le azioni stanno dentro un ripiano incavato: le tessere sporgono dalla pagina,
  i tasti ci sprofondano dentro. Sopra quello che si legge, sotto quello che si
  preme, e la geometria del tasto ha finalmente un padrone solo invece di due
  che se la scrivevano col peso massimo.

- **Le tessere sono in tre righe, e i nomi ci entrano.** Il nome divideva la
  riga con la misura e la misura vinceva sempre: con «Temperatura» al nome
  restavano zero pixel e finiva coi puntini. Adesso la prima riga e' della
  pastiglia e del nome, la seconda del numero, la terza del dettaglio con la
  misura accanto. E un nome non finisce mai coi puntini: se non entra si
  stringe la spaziatura, poi si scende di corpo, e solo alla fine si va a capo
  — «Elettrodomestici» entra in una riga sola anche su un telefono da 320
  pixel. Provato a 320, 360, 390, 430, 768 e 1240.

- **Le tessere portano oggetti disegnati al posto delle emoji.** Ogni sistema
  disegna le emoji a modo suo, e sei tessere vicine avevano sei stili diversi:
  la lampadina lucida di Android accanto al fiocco piatto. Adesso sono oggetti
  con vetro, riflesso e ombra propria, tutti con la stessa luce che viene
  dall'alto — e la finestra che si apre porta lo stesso oggetto della tessera
  da cui e' partita, con il titolo che si stringe invece di finire sotto il
  tasto di chiusura.

- **E' colorato solo chi ha qualcosa da dire.** Le tessere gridavano tutte allo
  stesso modo, e quando gridano tutte non si sente nessuna. Una tessera adesso
  nasce calma e prende il colore — velo, pastiglia, ombra lunga — solo quando
  il suo stato lo merita: luci accese, clima in funzione, un'apertura da
  chiudere, l'auto attaccata alla presa. Nel momento in cui si accende, una
  lama di luce del suo colore l'attraversa una volta sola.

- **A ogni tessera la misura del suo mestiere.** Al posto della barretta uguale
  per tutti: i segmenti per le cose che si contano (due luci accese su quattro
  si leggono senza il numero), la batteria che si riempie per la carica
  dell'auto, la barra per il resto. Dove una misura che appartiene alla cosa
  non c'e', non si mette niente.

### Corretto

- **Il nome della casa tornava tagliato in testata.** Adesso che la plancia
  tiene davvero le distanze dai bordi, la fascia in alto ha ventotto pixel in
  meno e se li e' presi il meteo. Sui telefoni stretti il meteo si stringe e
  lascia a casa l'ultimo dettaglio — il vento sta comunque nella sua pagina —
  e il nome della casa, che e' l'unica parola che dice dove sei, torna intero.

- **L'auto risultava attaccata alla presa col cavo staccato.** Per accendere la
  tessera si cercava dentro lo stato della ricarica la parola «charging» o
  «plug»: «not_charging», «disconnected» e «unplugged» contengono la stessa
  parola e dicono l'esatto contrario. Adesso si guardano prima le negazioni, e
  le lettere della norma — A nessun veicolo, B collegato, C e D in carica — si
  leggono per quello che sono.

- **In Energia i conflitti dei periodi si contavano su un impianto e si
  svuotavano su un altro.** L'avviso leggeva sempre la prima casa: chi guardava
  la seconda si vedeva elencare campi che non erano suoi, e premendo «Svuota i
  campi di periodo» perdeva i propri, che nell'elenco non c'erano. Chi legge e
  chi scrive adesso guardano lo stesso impianto.

- **La finestra della pagina Clima non sapeva aprire un'unita' tolta dalla
  Home.** Il pannello che legge davvero cosa l'unita' accetta passava dal
  modello della tessera, e quel modello e' filtrato: chi spegneva
  l'interruttore «nel widget» su un termosifone se lo ritrovava, in pagina, coi
  cinque tasti scritti a mano nel guscio. Il filtro e' una faccenda della
  tessera, non della riga.

- **Il Solare termico si diceva «Attivo» con la pompa ferma.** Senza sonda di
  temperatura la tessera scriveva «Attivo» comunque, il contrario di quello che
  diceva la didascalia due righe sotto. Senza sonda adesso parla la pompa.

- **La Piscina annunciava «pH —» dove il pH non c'era.** La didascalia era
  sempre il pH, anche quando quella sonda non era mai stata mappata: annunciava
  un dato per dire di non averlo. Adesso parla la prima riga che ha qualcosa da
  dire, o non parla.

- **Il widget Energia diceva «0 W» con un contatore in kW.** Un misuratore che
  pubblica in kW e' normale quanto uno in watt, e la tessera leggeva il numero
  ignorando l'unita': 0,27 arrotondato all'intero fa zero, cioe' una casa
  spenta mentre sta consumando duecentosettanta watt — col flusso che nella
  stessa pagina, a due dita di distanza, scriveva 0,27 kW.

- **Le finestre col solo sensore di apertura non arrivavano in Home.** Una
  finestra con le persiane manuali e un contatto sull'anta non ha coperture da
  elencare: la pagina Tapparelle la disegna da tempo, la tessera la saltava.
  Chi ha solo i sensori non vedeva quali infissi aveva lasciato aperti, che e'
  la cosa che si vuole sapere uscendo di casa. Adesso entra nel conteggio, e
  non prende i comandi: le frecce su un contatto sarebbero una promessa che
  nessuno mantiene.

- **L'ordine delle stanze non arrivava alle pagine.** La scheda Stanze lascia
  ordinarle, ma Luci, Clima, Tapparelle ed Elettrodomestici se lo riscrivevano
  ognuna a modo suo: due in ordine alfabetico, una nell'ordine in cui le cose
  erano state configurate, una che non ordinava affatto. Spostare una stanza in
  cima sembrava non servire a niente. Adesso la domanda passa da un posto solo.

- **Dal computer, con tante stanze, le ultime non si raggiungevano.** Il nastro
  delle linguette scorre di lato con la barra nascosta apposta: col dito e' il
  gesto giusto, col mouse quel gesto non esiste e la barra non c'e' da
  afferrare. Con quattordici stanze le ultime otto restavano oltre il bordo
  destro, visibili a meta'. Dove si punta col mouse la fila va a capo.

- **Un'azione rapida su un pulsante non faceva niente.** Il servizio si
  sceglieva da una riga sola — `turn_on` per script e scene, `toggle` per tutto
  il resto — ma `toggle` non e' universale: un `button` ha soltanto `press`,
  perche' non ha due stati da scambiare, e una `lock` ha `lock` e `unlock`.
  Home Assistant rispondeva che il servizio non esiste, il messaggio restava in
  console e il portone non si muoveva: da fuori, un tasto rotto.

- **I flussi dell'Energia restavano indietro.** La scena si ridisegnava solo
  agli eventi grossi — l'avvio, i pacchetti dello storico, un salvataggio — ma
  le potenze istantanee le legge dagli stati vivi, che cambiano di continuo.
  Misurato sullo stesso cambio: la bolla della batteria ci metteva 3127
  millesimi ad accorgersene, adesso 308.

- **I cerchi del flusso sparivano finche' non si ricaricava la pagina.** Il
  foglio di stile del guscio a volte non arriva, o arriva tardissimo. Quando
  succede la plancia sembra quasi normale — i moduli portano il proprio stile
  con se' — ma i cerchi del flusso hanno le loro regole solo li' e restano
  invisibili, con due archi tratteggiati appesi al nulla. Adesso quel foglio si
  richiede da solo, tre volte, sempre piu' distanziate.

- **«＋ Nuova auto» non svuotava le foto.** Il gesto e' «riparto da zero» e la
  scheda si svuota in un punto solo: nome, entita', marca, modello. Le foto
  erano l'eccezione, lasciate a una passata successiva. Quando quella arrivava
  tardi, la scheda nuova restava vestita con le foto dell'auto in uso e «Salva
  foto» gliele riscriveva addosso: il percorso battuto per la vettura che sta
  nascendo finiva su un'altra.

## 1.3.2

### Corretto

- **L'interruttore «nel widget» si accendeva e non portava niente.** Nel Solare
  termico le righe erano tre, fisse, chiamate «Sonda 1, 2, 3»: «Sonda 2» non e'
  il nome di niente, e tutto il resto — le pompe, il delta, la pressione — non
  entrava mai in Home. Accendere l'interruttore su quelle righe non faceva
  succedere niente, e un interruttore che non fa succedere niente e' peggio di
  un interruttore che non c'e'. Adesso ogni casella mappata puo' arrivare nella
  tessera, col nome vero dell'entita', e le pompe portano acceso o spento.

- **Auto: col cavo attaccato la foto restava quella a cavo staccato.** Lo stato
  di ricarica di quasi tutte le wallbox e' un codice della norma IEC 61851 — A
  non connessa, B cavo dentro e ferma, C e D in carica, F guasto — e la pillola
  della pagina quelle lettere le legge da sempre: e' per questo che diceva
  «Collegata». Chi sceglie fra le due fotografie cercava invece parole, e «B»
  non assomiglia ne' a «collegato» ne' a «scollegato»: non decideva niente e si
  finiva sulla potenza. Con l'auto attaccata e la batteria piena la potenza e'
  zero, e zero vuol dire cavo staccato.

- **Il popup delle telecamere si rinfrescava a vuoto e restava nero.** Da
  quando il dettaglio vive in un popup, la stessa inquadratura sta a schermo in
  due posti insieme: la miniatura nella tessera e quella grande sopra. Il
  registro delle immagini scaricate era tenuto per telecamera, e le due si
  davano il cambio sulla stessa casella — la seconda che finiva di scaricare
  buttava via il fotogramma della prima, che pero' era ancora appeso al suo
  riquadro. Al giro dopo toccava all'altra.

- **Aprendo una temperatura con la matita sembrava svuotata.** Il campo di
  un'entita' non e' piu' una casella nuda: davanti gli sta la pastiglia che
  dice quale entita' e' scelta, e la casella vera resta dietro la matita. Chi
  apriva in modifica scriveva il valore e basta, senza dirlo a chi lo disegna:
  la pastiglia continuava a invitare a scegliere sopra un campo pieno, e
  salvare avrebbe scritto il vuoto.

- **Una finestra col solo sensore si inseriva ma non si poteva piu'
  modificare.** La regola su cosa basta per una riga era scritta in due posti
  che dicevano due cose: chi inserisce accettava gia' il contatto da solo —
  persiane, scuri, una maniglia — e chi riapre per modificare contava soltanto
  le tre coperture, rifiutando la riga che l'altro aveva appena creato.

- **Nella pagina Stanze una stanza con piu' sonde ne mostrava una sola.** La
  scheda Temperature permette da tempo di selezionare la stessa stanza piu'
  volte, con un nome per ognuna — il comodino, il termostato a muro, la sonda
  della veranda — ma qui si leggeva solo la prima coppia. Adesso ognuna ha la
  sua riga, col suo nome.

- **Nel riepilogo della stanza il termosifone e il condizionatore avevano la
  stessa icona.** Due righe affiancate diventavano due fiocchi di neve identici
  sopra due cose che non fanno la stessa cosa; il tipo la configurazione lo sa
  gia'.

- **La plancia partiva a filo di schermo.** Non c'era nessun margine laterale:
  su un telefono la «P» di PERSONE nasceva sul bordo e sembrava tagliata, e le
  tessere finivano contro il vetro.

- **Il tasto di accensione del Clima era un quadratino vuoto.** Usava un
  carattere che i font di sistema di Android non coprono. Adesso e' disegnato,
  e non dipende piu' da nessun font.

- **In configurazione le ultime schede uscivano fuori misura.** La tabella dei
  simboli non conosceva Widget, Backup, Persone, Aspirapolvere e Aperture, e
  chi non c'era non veniva diviso in simbolo e nome: da telefono, dove la
  colonna si stringe a un simbolo solo, quelle restavano col nome attaccato.
  Adesso la tabella e' il primo posto dove guardare, non l'unico.

- **Nella tessera Sicurezza lo stato non ci stava.** «Disinserito» a ventitre
  pixel si leggeva «Disinse...», che non dice niente: il numero grande resta
  grande finche' e' corto, e a una parola si da' la misura che la fa entrare.

### Aggiunto

- **La pagina Stanze ha la sua intestazione.** Era la sola pagina della plancia
  che partiva dalle linguette, senza dire dove si era arrivati.

- **Sotto «Widget» c'e' scritto quali tessere chiedono attenzione.** Dire
  quante, sopra otto tessere, obbliga a guardarle tutte per scoprire chi sono:
  adesso ci sono i nomi, e se non ci stanno in larghezza la riga scorre.
  L'intestazione, intanto, e' diventata un titolo di sezione come «Azioni
  rapide» e «Persone»: sulla Home i blocchi si annunciano tutti allo stesso
  modo.

## 1.3.1

### Corretto

- **La scelta delle modalita' dell'antifurto e il tasto Clima rapido non
  viaggiavano.** Sono due preferenze nuove di questa versione, e nessuna delle
  due era nell'elenco delle caselle che la configurazione si porta dietro: il
  salvataggio partiva lo stesso ma senza il loro valore. Chi toglieva «Vacanza»
  dal telefono se la ritrovava sul computer, e dal backup non usciva niente.

- **Nascondendo la modalita' con cui l'allarme era inserito si accendeva
  «Fuori».** Il ripiego sul tasto generico serve alle centrali che un
  inserimento non lo dichiarano: la casa e' inserita, il tasto giusto non
  esiste, e accenderne uno e' meglio di niente. Per un tasto tolto a mano non
  vale: il tasto giusto la centrale ce l'ha, e' chi guarda che ha scelto di non
  vederlo, e accendere «Fuori» voleva dire dire che la casa era inserita fuori
  mentre era inserita in casa. Adesso in quel caso non si accende nessuno.

- **Cambiando centrale non si riusciva piu' a nascondere una modalita'.** La
  casella tiene quello che si e' tolto nel tempo, e una centrale sostituita si
  porta dietro nomi che oggi non vuol dire piu' niente. Contandoli si arrivava
  al limite di «almeno una deve restare» con due modalita' ancora in fila.
  Adesso a contare sono solo quelle che la centrale accetta adesso.

- **Le parole del meteo in testata tornavano nella lingua del guscio.** La
  fascia nuova avvolge «💧 Umidità» e «💨 Vento» in un guscio per poterle
  nascondere sul telefono, e le tagliava prima che la traduzione le vedesse: la
  chiave del catalogo e' la frase intera, icona compresa, e due pezzi separati
  non sono chiave di niente. Un francese leggeva «Vento» — lingua sbagliata due
  volte, perche' anche la build inglese la scrive cosi'. Ora si traduce prima e
  si taglia dopo, e la parola si rifa' da sola quando il catalogo arriva.

- **La procedura guidata chiedeva il token in inglese.** Il campo e' una
  `textarea`, e il passaggio di traduzione le saltava per intero — giustamente
  per quello che ci si scrive dentro, che e' roba di chi la usa, ma insieme al
  contenuto saltava anche il segnaposto, che invece e' testo nostro. La
  traduzione c'era in tutti e tredici i cataloghi e non arrivava a schermo.

- **Il gruppo dei tasti griglia/elenco aveva per nome due voci incollate.**
  «Vista griglia / Vista elenco» non e' una stringa che qualcuno abbia scritto,
  quindi nessun catalogo la conosceva e chi si fa leggere la pagina la sentiva
  in inglese. Ne ha una sua.

- **La procedura di primo avvio, gli editor e i loro messaggi erano in inglese
  in tutte le lingue.** Quattrocento stringhe visibili — la connessione a Home
  Assistant, la scelta delle luci, gli editor di elettrodomestici, avvisi e
  telecamere, ogni messaggio che sollevano — vivono nel runtime vendorizzato, e
  il vocabolario della plancia non l'aveva mai letto. Adesso lo legge: sono
  tradotte in tutte e tredici le lingue.

- **Anche chi sceglieva inglese leggeva italiano.** La build inglese del runtime
  e' stata tradotta a forza di sostituzioni e la passata non e' mai finita:
  «Potenza batteria (W)» ne era uscita «Power batteria (W)», e restavano
  «Riconnessione...», «Nome stanza (es. Salone)», «Crea token» scritto
  «Createte token». Trentasei stringhe rimesse a posto, senza toccare un file
  vendorizzato che tornerebbe alla prossima sincronizzazione.

- **Il cartello di benvenuto e la procedura guidata restavano in inglese anche
  quando la traduzione c'era.** Vengono disegnati all'avvio, prima che arrivi
  qualsiasi stato da Home Assistant: la passata di traduzione non aveva motivo
  di guardarli. Ora guarda anche all'avvio e mentre la pagina si assesta.

- **Il testo con una decorazione davanti non si traduceva.** «🧺 Nessun
  elettrodomestico configurato» e «· Potenza istantanea» sono la stessa frase
  del catalogo con un'icona o un punto davanti: adesso la decorazione si toglie,
  si cerca la frase e si rimette dov'era.

- **Nella barra Home e Stanze avevano la stessa icona.** Due case affiancate
  sono due voci che non si distinguono al volo. Stanze porta la porta — la
  stessa che ha già in configurazione.

- **Le icone delle stanze uscivano scritte invece che disegnate.** Nelle
  linguette della pagina Stanze si leggeva «MDI:SOFA» sopra il nome: le stanze
  la loro icona la tengono in quel formato, e lì la si stampava così com'era.
  Adesso si traduce nel simbolo, lo stesso che il resto della plancia disegna
  per quella stanza.

- **Nelle tessere del Colpo d'occhio la didascalia era tagliata a metà.** Stava
  affiancata al nome della sezione, e su un telefono il nome si prende quasi
  tutta la tessera: della didascalia restava una coda che scorreva senza mai
  leggersi — «idità 61%», «tra Bagno Pic». Adesso ha una riga tutta sua.

- **La tessera delle telecamere lampeggiava di nero a ogni aggiornamento.** Si
  dichiarava «in caricamento» a ogni giro, e un'immagine non pronta ha opacità
  zero sopra un fondo quasi nero. Il fotogramma di prima adesso resta a schermo
  finché non arriva quello nuovo.

- **Scegliere una vista dell'Energia spegneva la linguetta dell'impianto.** Una
  classe sola la portano le viste, gli impianti e le stanze degli
  elettrodomestici: spegnendole tutte si spegneva anche l'impianto scelto, e non
  si vedeva più su quale casa si stesse guardando.

- **Il telefono gonfiava da solo i caratteri.** Android ingrandisce il testo
  dentro i contenitori che scorrono in orizzontale: è per questo che il font
  delle linguette delle stanze in Temperature tornava «sballato» ogni volta che
  lo si rimpiccioliva. Adesso le misure scritte valgono quelle che sono.

- **In configurazione la tendina delle stanze mangiava il nome dell'entità.**
  Dichiarata come elemento flessibile, il browser di Android le disegnava le
  opzioni come testo in fila: nel MiniPC la riga diventava l'elenco delle stanze
  appiccicato al nome. E dove la tendina si disegnava bene, era comunque in fila
  col nome e con l'interruttore dei widget, su un telefono largo un dito: adesso
  il nome tiene una riga sua e i due comandi vanno sotto.

- **La tessera Auto in Home mostrava una vettura sola.** Il riferimento della
  batteria ne indica una: quella che «Usa» ha copiato nelle chiavi globali. È
  giusto per la pagina EV, dove si guarda un'auto per volta, ed è sbagliato per
  un colpo d'occhio sulla casa: chi ha due auto vedeva sempre e solo l'ultima
  messa in uso, senza nessun modo di accorgersi che l'altra era a secco. Adesso
  ogni vettura si legge dal suo profilo — la stessa mappatura che «Usa» copia —
  e la tessera le nomina tutte: il numero grande è la più scarica, perché è
  quella che chiede qualcosa. Con una vettura sola non cambia niente.

- **I popup non erano belli, e ognuno a modo suo.** Ogni sezione apre la sua
  finestra e tutte passano dallo stesso foglio, ma erano nate una alla volta e
  si vedeva: un anello bianco cucito dentro il bordo, che sul tema scuro faceva
  da taglio; un'entrata lunga mezzo secondo che le faceva galleggiare; e in
  cima, un tasto di chiusura grande come una pastiglia di comando, che pesava
  più del titolo. Adesso hanno una veste sola — angoli più misurati, un'ombra
  che scende, un filo di colore sul bordo alto, l'intestazione ordinata e la
  chiusura tornata un tondino — e chi ha chiesto meno movimento non lo riceve.
  Non cambia cosa fa nessuna finestra: cambia come si presentano, e cambia per
  tutte insieme. La stessa veste ce l'hanno anche le finestre delle tessere del
  Colpo d'occhio, che non passano da quel foglio — le disegna il modulo dei
  widget — e lì il filo di colore prende il colore della tessera da cui si è
  arrivati: il popup è la tessera che si apre, non un'altra cosa.

- **Il ritratto delle persone ballava, e la faccia stava ferma.** Un respiro in
  CSS alzava e abbassava tutta la tela, mentre chi è in casa — cioè quasi
  sempre tutti — portava l'unica espressione che non batteva le ciglia. Adesso
  il riquadro sta fermo e le ciglia battono in ogni espressione.

- **La finestra di una tessera lunga tagliava la lista.** Il Clima di una casa
  con le valvole ha quindici o venti righe: la finestra si fermava all'altezza
  dello schermo e le ultime restavano fuori, senza modo di arrivarci. A
  scorrere adesso è la lista, con l'intestazione ferma in cima; la barretta di
  scorrimento porta il colore della tessera, così una lista lunga si vede che è
  lunga.

- **Tapparelle: le finestre mostravano ROOM_MT8VPZ7M invece del nome della
  stanza.** La tendina delle stanze salva l'id quando c'è — è l'unica cosa che
  regge un rinominamento — ma chi disegna una card scriveva quello che
  trovava. Adesso l'id torna il nome; una configurazione vecchia che salvava
  il nome continua a funzionare, e una stanza cancellata resta scritta com'era.

- **Il widget Sicurezza mostrava il portoncino ma non lo apriva.** La riga lo
  disegnava e basta: nome, stato, e un lucchetto che diceva soltanto «questa
  vuole il PIN». Adesso c'è il tasto, e porta lo stesso gesto dei tasti della
  pagina Sicurezza: stessa conferma, stesso tastierino del PIN, stessa
  chiamata. Non è una seconda mano che apre: è la stessa.

- **Persone: si modificava solo la prima riga, le altre tornavano com'erano.**
  Il tasto unico in fondo alla scheda preme i salvataggi delle righe uno dopo
  l'altro, e il primo salvataggio ridisegna la scheda — è così che
  l'intestazione prende il nome appena scritto. Il ridisegno riscriveva le
  caselle delle righe seguenti con quello che c'era in memoria: quando
  arrivava il loro turno non avevano più niente da dire. Adesso ogni
  salvataggio legge tutte le righe prima di scrivere, così il ridisegno arriva
  quando ognuna ha già detto la sua. Stessa cosa aprendo un'altra riga con la
  matita: quello che si stava scrivendo non si perde più.

- **Persone: l'avatar scelto perdeva contro la fototessera dell'entità.** La
  card mette la fotografia davanti all'avatar, ed è giusto — una foto vera è
  meglio di un'emoji. Ma la fotografia arriva anche da sola: Home Assistant e
  i tracker se la portano dietro, e quella automatica stava davanti a una
  scelta fatta a mano. Chi si costruiva la faccia pezzo per pezzo continuava a
  vedere la fototessera del telefono. Adesso l'ordine è: la foto scritta a
  mano, poi l'avatar se qualcuno l'ha scelto, poi quella dell'entità.

- **La barra in basso era alta e quasi trasparente.** Con del contenuto sotto,
  le scritte delle sezioni ci si perdevano dentro. Adesso il fondo è quasi
  pieno e il vetro sfoca di più — quello che passa sotto si intuisce e non si
  legge, che è il punto di un vetro smerigliato — e ogni voce costa dodici
  pixel in meno: l'icona e il nome ci stanno lo stesso, il resto era aria.

- **Auto: col cavo attaccato la foto non cambiava.** Le due foto — l'auto ferma
  e l'auto in carica — c'erano e si potevano scegliere, ma la seconda arrivava
  solo riaprendo la pagina. La sezione Auto si ridisegna quando cambia
  un'entità che le interessa, e quali le interessino se lo chiedeva guardando
  dentro i profili delle vetture; le caselle da cui si capisce se il cavo è
  attaccato — stato di ricarica, sensore del cavo, potenza del wallbox — sono
  invece canoniche, e chi ha una macchina sola le riempie nella mappatura
  generale della plancia, non nella scheda dell'auto. Il wallbox che passava a
  «in carica» non risvegliava nessuno. Adesso sì.

- **A barra ferma la seconda fila di tessere non si riusciva a premere.** Da
  computer la barra sta nascosta e si affaccia quando il puntatore le arriva
  vicino: a chiamarla è un rettangolo invisibile che le sborda intorno, e che
  sta sopra la pagina. Con la barra già ferma e alzata quella fascia cadeva
  proprio sulla seconda fila delle tessere della Home. A barra ferma il
  rettangolo non serve — la barra è già lì — e adesso non c'è.

### Aggiunto

- **Il tasto Clima rapido si configura.** Toccando una stanza nel popup Clima
  della Home la plancia accendeva sempre in raffrescamento a 26°C con la
  ventola automatica: tre numeri scritti nel codice. Va benissimo per chi quei
  numeri li voleva; per tutti gli altri era un tasto che faceva una cosa che
  non gli avevano chiesto, e l'unico modo di cambiarla era non usarlo. Adesso
  modalità, temperatura e ventola si scelgono nella scheda Clima. Ci sono solo
  le modalità che le unità configurate accettano davvero — una che il
  condizionatore non ha è un tasto che non fa niente — e temperatura e ventola
  si possono lasciare vuote: vuoto vuol dire che il tasto non le tocca, per chi
  la temperatura la governa dal termostato. La scritta sotto al titolo del
  popup dice quello che il tasto farà davvero, non un esempio.

- **Si sceglie quali modalità dell'antifurto vedere.** La centrale dice cosa
  accetta; quello che serve davvero lo dice chi la usa. Una Ring accetta cinque
  inserimenti, e chi in vacanza non ci va mai si ritrovava due tasti che non
  premerà mai davanti a quello che usa ogni sera. In configurazione, sotto
  Antifurto, la fila si spunta: ci sono solo le modalità che la centrale accetta
  davvero, toglierne una la nasconde e non cambia niente di quello che la
  centrale sa fare, e lo sblocco resta sempre.

- **Il meteo è passato nell'intestazione.** Era una card alta quanto un terzo
  di uno schermo di telefono, e diceva quattro numeri. Adesso sta accanto al
  nome della casa, nella fascia in alto: stessa temperatura, stesso cielo,
  stessa icona, e umidità e vento uno accanto all'altro invece che incolonnati
  all'estremità opposta. Si apre come prima. Quello che si guadagna è la prima
  fila di tessere, che adesso si vede senza scorrere. Da telefono ci sta tutto
  su una riga sola — nome della casa, meteo, stato e configurazione — perché
  ogni pezzo dice la stessa cosa con meno: via il sottotitolo che ripeteva il
  titolo, via il cielo a parole che l'icona dice già, e «Umidità» e «Vento» li
  dicono la goccia e il soffio.

- **Lo stato della connessione è un puntino, non una frase.** «Connesso»
  accanto a un pallino verde era la stessa cosa detta due volte, e su un
  telefono quella frase era la larghezza che mancava al meteo. La parola resta
  scritta per chi la pagina se la fa leggere a voce: sparisce dalla vista, non
  dal documento.

- **Le finestre delle tessere aprono come aprono le pagine.** Il filo di tre
  pixel sul bordo alto era il colore detto a mezza voce: da lontano tutte le
  finestre erano la stessa finestra bianca, e per sapere in quale si era
  bisognava leggere il titolo. Adesso la testata è la stessa fascia con cui si
  apre ogni pagina della plancia — l'alone di colore che entra dall'angolo, il
  titolo in maiuscolo nel colore della sezione, il sottotitolo in
  maiuscoletto, la riga che sfuma in fondo — con in più la pastiglia
  dell'icona, che è quella della tessera da cui si è arrivati. Titolo e
  sottotitolo adesso sono incolonnati: affiancati, il sottotitolo di una
  sezione con sei voci finiva sempre coi puntini.

- **Le stanze si ordinano.** L'elenco della scheda Stanze era l'ordine in cui
  erano state aggiunte, e quello stesso ordine si ritrovava in ogni tendina che
  chiede «in che stanza sta questa cosa» — elettrodomestici, clima, telecamere
  — e nelle linguette della pagina Stanze. Chi aveva aggiunto il bagnetto per
  ultimo se lo ritrovava per ultimo dappertutto, e l'unico modo di spostarlo
  era cancellarlo e riscriverlo, perdendo tutto quello che gli era stato
  attribuito. Adesso ogni riga ha le sue due frecce.

- **La mappa dell'aspirapolvere si apre e si ingrandisce.** Stava dentro la
  tessera, alta quanto una figurina: su una casa di sei stanze i corridoi
  erano tratti di penna e capire dove il robot si fosse fermato voleva dire
  aprire l'app del produttore. Adesso il disegno si tocca e va a schermo
  pieno, si tira per spostarlo, si allarga con la rotella o con due dita — e
  lo zoom insegue il punto che si sta guardando, non il centro del foglio —
  con il tasto che rimette tutto com'era e Esc per chiudere. L'immagine e'
  quella che la tessera ha gia' scaricato: a Home Assistant non si chiede
  niente in piu'.

- **Elettrodomestici: la temperatura si sceglie, e possono essere due.** Un
  frigorifero smart ne pubblica cinque — ambiente, obiettivo e attuale del
  frigo, obiettivo e attuale del congelatore — e la plancia prendeva la prima
  che trovava: «ambiente», cioè la stanza intorno, il numero che di
  quell'apparecchio non dice niente. Adesso i nomi che parlano della stanza o
  di un obiettivo si mettono da parte, e se restano ancora più candidati non si
  sceglie: una casella vuota si nota, un numero sbagliato no. In configurazione
  la casella c'era già; accanto ne è comparsa una seconda, perché un
  frigorifero col congelatore sono due vani e con due caselle piene la card
  disegna due barre.

- **Nel widget «Da fare» si aggiunge e si toglie.** La lista si poteva solo
  spuntare: per segnare la spesa dimenticata, o per togliere una riga finita lì
  per sbaglio, bisognava uscire dalla plancia e aprire Home Assistant. Adesso
  in fondo a ogni lista c'è la riga per scrivere — invio o il tasto ＋, e la
  voce compare subito senza aspettare la rilettura — e ogni voce porta il suo
  cestino, che non è «fatta»: è «non c'entrava».

- **Il Clima ha la rotella: modalità, temperatura e ventola sulla riga.** Sulla
  riga ci stavano il nome, la temperatura e l'acceso/spento; tutto il resto —
  in che modalità sta, a che velocità gira la ventola, alzare l'obiettivo di
  mezzo grado — si poteva fare solo andando nella pagina Clima. Adesso la
  rotella apre un pannello sotto la riga, e ci sono soltanto le modalità e le
  velocità che quell'unità dichiara di accettare: un tasto che l'unità non sa
  eseguire è peggio di un tasto che non c'è. Sotto, cosa sta facendo davvero e
  l'umidità della stanza.

- **In cima a ogni finestra ci sono i numeri che riassumono.** La tessera in
  Home dice un numero solo — la media, quante ne sono accese — e aprendola
  quel numero spariva: restava la lista, e il conto lo doveva fare chi legge.
  Adesso restano tre numeri: quanti in funzione, la media in casa, l'obiettivo
  per il Clima; accese e spente per le Luci; aperte e apertura media per le
  Tapparelle; la più fredda, la media e la più calda per le Temperature.

- **E dentro, ogni riga è la tessera della Home messa in orizzontale.** La
  lista era una fila di pastiglie tutte uguali: un'emoji da quindici pixel, un
  nome, e a destra il comando — chi era acceso e chi era spento lo diceva
  soltanto il comando, in fondo alla riga, e per sapere quante luci erano
  accese bisognava leggere gli interruttori uno per uno. Adesso l'icona sta
  nella stessa pastiglia della tessera da cui si è arrivati, tinta del colore
  della sezione quando la cosa è accesa e neutra quando è spenta, il nome pesa
  più di quello che ha sotto, i numeri sono in Oswald come tutti i numeri
  della plancia, e la riga intera si vela appena del colore quando è accesa:
  da un metro di distanza si contano gli accesi senza leggere niente.

- **«Colpo d'occhio» adesso si chiama «Widget».** È il nome con cui la sezione
  viene chiamata da chi la usa e da chi la configura: due nomi per la stessa
  cosa erano uno di troppo.

- **Le linguette della configurazione stanno in colonna.** Erano diciassette
  voci in una fila che scorreva in orizzontale, tre visibili per volta: per
  arrivare a Stanze si trascinava al buio. Adesso si vedono tutte una sotto
  l'altra e il corpo della scheda si apre accanto invece che sotto. Da telefono
  tenuto in piedi la colonna si stringe al solo simbolo — su trecentonovanta
  pixel una colonna che scrive anche i nomi si porta via un terzo dello schermo
  per dire quello che il simbolo dice già — e il nome ricompare da solo appena
  il telefono si gira. Chi un simbolo non lo riconosce lo legge tenendo premuto:
  il nome resta nel titolo del tasto, e quindi anche per chi si fa leggere la
  pagina a voce. Anche qui la casa era doppia: Stanze prende la porta.

## 1.3.0

### Aggiunto

- **Sezione nuova: Stanze, con una pillola per stanza e le sue scene.** «Sarebbe
  carino avere una sezione dove vedere le entità raggruppate per stanze, tipo
  una sezione divisa a pagine dove ogni pagina è una stanza con tutte le entità
  della stessa.» Ogni sezione della plancia legge la casa per tipo — tutte le
  luci, tutte le tapparelle — ed è il verso giusto quando si cerca una cosa e
  quello sbagliato quando si sta in una stanza. La pagina gira il verso: le
  pillole delle stanze in alto, e sotto tutto quello che quella stanza possiede,
  diviso per tipo. Non sposta e non riscrive niente — le assegnazioni esistono
  già, si leggono soltanto dall'altro lato — e le card non sono nuove dove non
  serve che lo siano: la luce è la card della pagina Luci, la stessa, col suo
  cursore che funziona. In cima a ogni stanza ci sono **Accendi tutto** e
  **Spegni tutto**, con scritto quante luci toccheranno: «tutto» qui vuol dire
  la luce, perché un condizionatore e una tapparella hanno un verso loro e
  decidere al posto di chi guarda quale sia «acceso» sarebbe inventare. Chi non
  ha stanza finisce sotto una pillola sua: non è un errore da nascondere, è la
  sola occasione di accorgersene.

- **La stanza si può dire su qualunque entità, non solo dove la scheda la
  chiede.** Luci, clima, tapparelle, elettrodomestici, telecamere, carichi,
  robot e zone d'irrigazione la stanza ce l'hanno addosso perché la loro
  scheda la chiede. Tutto il resto della casa no — una sonda, un sensore di
  allagamento, la finestra di un avviso, la pompa della piscina, il solare
  termico — e senza di loro la pagina di una stanza ne raccontava metà.
  Aggiungere il campo a dieci schede vorrebbe dire dieci punti in cui
  scriverlo, dieci in cui leggerlo e dieci modi di sbagliarlo: qui ce n'è uno
  solo, la riga in cui l'entità è già scritta prende una tendina — in
  qualunque scheda si trovi, elenco o casella. Dentro ci va l'**id** della
  stanza e non il suo nome, quindi rinominarla non rompe niente. Chi la stanza
  ce l'ha già per mestiere non riceve nessuna tendina: due tendine sulla stessa
  luce sarebbero due padroni della stessa cosa.

- **Energia: più impianti sotto lo stesso tetto.** «Ho una casa che è l'unione
  di due appartamenti, quindi ho 2 misuratori di consumo nei due appartamenti e
  ogni appartamento ha i rispettivi carichi.» Le linguette in cima all'Energia
  scelgono di quale casa si parla, e con un impianto solo non compaiono
  affatto. Ogni impianto ha il suo nome, i suoi carichi — con tetto di otto per
  impianto, non otto in tutto — e i suoi misuratori: Rete, Solare e Casa
  seguono la linguetta scelta invece di restare sui contatori del primo.
  Cancellarne uno porta via i suoi carichi, che altrimenti restavano orfani e
  invisibili. L'id di un impianto nasce una volta e non si ricava mai dal nome:
  rinominare «Casa Giovanni» non sposta niente.

- **L'antifurto mostra i tasti che la centrale ha davvero.** La plancia dava
  per scontato che ogni centrale fosse fatta come quella di casa: tre tasti
  fissi — Fuori, Notte, Sblocca — qualunque cosa ci fosse dietro. Con Ring via
  ring-mqtt il tasto Notte chiedeva il PIN e poi non faceva niente, perché Ring
  quella modalità non ce l'ha. Adesso i tasti si costruiscono da
  `supported_features`, che è l'entità stessa a dichiarare, e ogni stato
  accende il suo — `armed_home` accendeva l'inserimento totale. Il tastierino
  compare solo se un codice esiste davvero (`code_format`) e serve anche per
  inserire (`code_arm_required`): dove non c'è, si premeva OK a vuoto e il
  comando partiva uguale.

- **Il ritratto delle persone e' un personaggio 3D, e i pezzi si combinano
  liberamente.** Il disegno costruito a mano se n'e' andato: al suo posto ci
  sono i render 3D di Fluent Emoji (Microsoft, licenza MIT), vendorizzati
  nell'integrazione — 390 immagini, 3,2 MB, nessuna rete a runtime. Si
  scelgono quattro cose: **persona** (uomo, donna, neutro, ragazzo, ragazza,
  anziano), **capelli** (lisci, barba, ricci, rossi, bianchi, calvo),
  **carnagione** (cinque, nessun giallo) e **vestito** (ufficio, medico,
  cuoco, smoking, velo, pompiere, poliziotto, muratore, operaio, meccanico,
  contadino, pilota, astronauta, giudice, supereroe, scienziato, insegnante,
  studente, informatico, artista, cantante, guardia, detective, turbante,
  supercattivo, mago, fata, vampiro, elfo). Sono **oltre tremila
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

- **Il ponte dei widget: la tessera degli aspirapolvere, e un'intestazione che
  dice qualcosa.** Mancava la tessera dei robot, che c'era per ogni altra
  sezione. E la riga sotto il titolo spiegava come si tocca una tessera — lo si
  capisce da solo la prima volta: adesso dice quante sezioni ci sono e quante
  chiedono attenzione, con la fascia che si scalda quando ce n'è almeno una.

- **L'interruttore dei widget su ogni sezione, e con scritto cosa fa.** Stava
  solo sulle righe che mostrano l'entity_id sotto il nome, e saltava tutte le
  sezioni fatte a caselle: EV, solare termico, MiniPC, antifurto — proprio
  quelle con dieci sensori di cui in Home ne interessano due. E diceva «In
  Home», che dice dove ma non cosa: adesso dice se quell'entità è dentro la
  tessera o ne sta fuori, e cambia parola quando cambia stato.

- **I marchi delle auto stanno in casa, col loro colore vero.** Arrivavano da
  un CDN: una plancia Home Assistant vive su una rete domestica, spesso senza
  uscita verso internet, e un'immagine che non arriva non fa rumore. I **38
  marchi** stanno in `frontend/brands/`, serviti da Home Assistant come già si
  fa con gli avatar, e portano i colori ufficiali letti dai metadati di
  simple-icons.

- **Il cavo dell'auto si può dichiarare.** La plancia lo deduceva dal testo
  dello stato e dalla potenza del wallbox, e un wallbox fermo a zero watt col
  cavo dentro veniva letto come staccato. Adesso c'è la sua casella.

### Corretto

- **Una stanza scritta ma non risolta veniva buttata via.** Il modello canonico
  ricava `room_id` dall'*id* della stanza trovata: se quella stanza un id non ce
  l'ha — una configurazione scritta a mano, o un salvataggio più vecchio degli
  id — il campo restava vuoto e l'assegnazione spariva in silenzio, lasciando il
  dispositivo senza stanza pur avendone una scritta accanto. Adesso il
  riferimento originale resta, accanto all'id: mezza dozzina di sezioni lo
  leggevano già così (`item.room || item.room_id`), aspettandosi che ci fosse.

- **La finestra che si apre a mano non si poteva inserire.** «Io non ho le
  tapparelle, ho le persiane e sono manuali, però ho sensori di apertura,
  volevo inserirli ma chiede obbligatoriamente l'entità tapparella.» Aveva
  ragione: la scheda offriva la casella del sensore e poi rifiutava di salvare
  la riga che conteneva solo quello — una promessa e un dietrofront. Adesso il
  sensore da solo basta: ne esce una card che disegna lo stesso serramento
  degli altri, con le ante che si scostano quando il contatto dice che è
  aperta, e sotto niente da toccare — perché su una persiana manuale
  Apri/Ferma/Chiudi sarebbe un comando che non arriva da nessuna parte. Nel
  conteggio in cima quelle finestre hanno una voce loro: contarle fra le
  «aperte» avrebbe detto che c'è una tapparella su, e non c'è.

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

- **La sezione EV aveva sei padroni.** «Di chi è questa scheda» aveva due
  funzioni a rispondere e nella bozza si contraddicevano; il pannello mostrava
  le foto della vettura precedente e «Salva foto» ce le riscriveva sopra; `＋
  Nuova auto` apriva una scheda già compilata Leapmotor B10 per via di un
  ripiego scritto nel codice; l'ascoltatore del cambio marca era appeso a un
  pezzo di disegno invece che alla tendina, quindi scegliere una marca non
  riempiva i modelli; l'interruttore toglieva l'auto dalle linguette ma la
  lasciava in plancia. La card del marchio adesso ha un padrone solo: uno la
  costruiva, un secondo teneva una seconda copia del catalogo marche-modelli, un
  terzo riallineava le tendine.

- **I marchi delle auto erano scritti a colori e mostrati in grigio.** Una
  regola marcata importante — dell'epoca del CDN, quando le immagini andavano
  normalizzate a un inchiostro solo — li ridipingeva tutti dello stesso grigio
  un istante dopo. Il colore giusto scritto e mai mostrato è come non averlo.

- **Le tessere della Home tremavano.** Nella firma che decide se ridisegnarle
  c'era anche il fatto che una tessera avesse o no la barra, e la barra dipende
  da un valore: un sensore che per un giro dice «non disponibile» faceva
  sparire la barra, cambiare la firma e riscrivere in blocco tutte le tessere.
  A ogni evento di stato che passasse di lì. Nello stesso giro se ne va la
  misura del testo scorrevole a ogni evento: leggere `scrollWidth` obbliga il
  browser a rifare i conti dell'impaginazione, e lo si faceva più volte al
  secondo per niente.

- **L'animazione d'ingresso delle tessere non è mai partita.** Il segno «già
  vista» si metteva prima di stampare il markup, che lo legge: ogni tessera
  nasceva marcata, compresa quella appena arrivata.

- **Gli avvisi del ponte stavano fermi.** Due selettori su tre puntavano a nomi
  che la tessera ha smesso di usare, e una terza copia teneva viva l'illusione
  sul Quadro. Quaranta righe di selettori sono diventate quattordici.

- **Gli elettrodomestici nei Carichi avevano due facce.** Portavano il
  carattere del campo invece del ritratto del catalogo: la stessa lavatrice
  aveva un disegno nella sua pagina e un altro nell'Energia.

- **La stanza del robot si sceglie da una tendina.** Era l'ultima casella dove
  si poteva scrivere un nome che non esiste e vedere l'oggetto sparire in
  silenzio.

- **Il quadratino della stanza aveva due padroni**: il motore delle icone
  disegnava il glifo e la Personalizzazione lo ridipingeva col suo.


## 1.2.0

### Aggiunto

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

### Corretto

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
