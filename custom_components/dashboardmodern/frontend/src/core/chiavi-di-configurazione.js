/* Le caselle che sono configurazione della casa, in un elenco solo.
 *
 * L'elenco stava dentro `sections/config-persistence-section.js`, ed era li'
 * che serviva: dice cosa viaggia fra i dispositivi e cosa resta sul vetro che
 * l'ha scritto. Ma non e' il solo che lo guarda. Il cancello degli stati
 * (`core/state-event-gate.js`) legge le stesse caselle per sapere quali entita'
 * la casa ha configurato — quello che non e' configurato non merita un
 * ridisegno — e per anni se n'e' tenuto una copia a mano.
 *
 * Una copia a mano di un elenco che cresce e' un elenco che resta indietro, e
 * infatti era rimasto indietro di una ventina di chiavi: le prese, le aree
 * d'allarme, i lettori, gli animali, e da ultimo i varchi, le macchine del
 * server e la ventilazione. Il difetto che ne veniva era muto e cattivo — le
 * entita' che stavano SOLO in quelle chiavi non passavano piu' il cancello,
 * quindi le loro tessere restavano ferme sull'ultimo valore finche' non si
 * muoveva qualcos'altro.
 *
 * Adesso l'elenco e' uno. Sta qui, in `core/`, perche' qui non ci sono effetti
 * al caricamento e chiunque puo' leggerlo in qualunque ordine: la persistenza
 * lo ri-esporta cosi' com'e' — chi lo importava da li' non si accorge di
 * niente — e il cancello se lo fa passare da chi lo installa.
 *
 * Chi aggiunge una chiave qui alza anche `CONFIG_KEYS_REVISION`, che sta con
 * la persistenza insieme al racconto delle revisioni: e' quel numero a dire
 * alle plance vecchie che il salvataggio parla una lingua piu' nuova della
 * loro. Il guardiano `tests/nessuna-configurazione-resta-a-terra.test.js`
 * legge questo file e non lascia passare una casella dimenticata.
 */

/* La revisione 5 aggiunge le persone (`cd_people`): un salvataggio scritto
 * prima che la chiave esistesse non puo' dire «cancellata», e il travaso di
 * `mergeLegacyMissingConfig` gliela riempie da questo dispositivo.
 * La revisione 6 aggiunge le aperture della Sicurezza (`cd_security_doors`,
 * #195) e le liste ToDo della Home (`cd_todo`, #201), con la stessa regola.
 * La revisione 7 aggiunge le preferenze del ponte dei widget (`cd_widgets`):
 * quali tessere si vedono in Home e in che ordine.
 * La revisione 8 aggiunge le due scelte della 1.3.1: quali modalita' della
 * centrale si vogliono vedere (`cd_antifurto_modi`) e cosa fa il tasto Clima
 * rapido (`cd_clima_rapido`). Sono preferenze della plancia, non del
 * dispositivo che le ha fatte: senza stare qui restavano su un telefono solo e
 * dal backup sparivano.
 * La revisione 9 aggiunge le tre che mancavano ancora: le icone degli avvisi
 * (`cd_avvisi_icone`), le entita' assegnate a mano a una stanza
 * (`cd_stanze_entita`) e il segno progressivo delle auto (`cd_ev_meta`). Le
 * prime due erano configurazione che restava su un dispositivo solo; la terza
 * e' la guardia contro gli identificativi riusati, e senza viaggiare non
 * guardava niente.
 * La revisione 10 aggiunge le cose che si guardano e basta
 * (`cd_solo_lettura`). «Non e' meglio oscurare il tasto accendi/spegni sulla
 * presa del frigo?» — si', ed e' una decisione della casa, non del telefono da
 * cui la si e' presa: se non viaggia, il frigo e' protetto sul telefono di chi
 * ha configurato la plancia e spegnibile su tutti gli altri, che e' esattamente
 * il contrario di quello che serve.
 * La revisione 11 aggiunge le prese (`cd_prese`). Prima le prese si
 * configuravano fra le luci — la scheda Luci accetta anche `switch.` — e
 * viaggiavano dentro `cd_luci`; adesso hanno un elenco loro, e senza stare qui
 * resterebbero sul telefono che le ha configurate.
 * La revisione 12 aggiunge i passi del tasto Clima rapido per unita'
 * (`cd_clima_rapido_unita`): la cameretta a 24 gradi e il salone a 26 sono
 * una scelta della casa, e deve valere da ogni telefono.
 * La revisione 13 aggiunge le entita' in evidenza (`cd_evidenza`) — la tessera
 * della Home che tiene d'occhio sensori senza stanza — e il registro dei
 * sensori di fumo gia' visti (`cd_fumo_rilevato`): entrambe descrivono la
 * casa, non il telefono, e senza stare qui resterebbero sul dispositivo che
 * le ha configurate. */
/* La revisione 14 aggiunge il verso girato (#244): i sensori porta/finestra
 * che stanno a ON quando l'infisso e' chiuso (`cd_stati_invertiti`). E' un
 * fatto dei fili, non del telefono: letto da un dispositivo solo, gli altri
 * continuerebbero a dire «aperta» su una finestra chiusa. Con lei viaggiano
 * anche le quattro della stessa stagione che erano rimaste solo nelle liste
 * legacy del runtime — le voci del Caldo (`cd_termico_caldo`), i programmi
 * della lavatrice (`cd_lavatrice_programmi`), la card del Clima girata
 * (`cd_clima_inverti_card`) e la stazione meteo propria
 * (`cd_meteo_entita_proprie`): senza stare qui restavano sul dispositivo
 * che le aveva configurate e il ripristino da un altro le perdeva. */
/* La revisione 15 aggiunge lo scaldabagno elettrico (`cd_scaldabagni`, #253):
 * quali entita' lo descrivono — l'interruttore, la sonda dell'acqua,
 * l'obiettivo, il consumo. E' la casa, non il telefono: configurata da un
 * dispositivo, gli altri resterebbero senza la tessera. */
/* La revisione 16 aggiunge le altre due macchine del locale caldaia (#253):
 * quali impianti termici ci sono (`cd_impianti_termici`) e le caselle della
 * caldaia (`cd_caldaia`). Sono la casa, non il telefono: senza viaggiare, chi
 * sceglie «solare piu' caldaia» su un dispositivo troverebbe sugli altri la
 * pagina di prima. */
/* La revisione 17 aggiunge il gruppo di continuita' (`cd_ups`, #256): quali
 * entita' dicono se c'e' tensione, come sta la batteria e quanto carico
 * regge. E' la casa, non il telefono: chi lo configura dal tablet in cucina
 * non deve rifarlo dal telefono per vedere se la corrente e' caduta. */
/* La revisione 18 aggiunge i calendari scelti (`cd_calendari`, #259): quali
 * entita' `calendar.*` si guardano, con che nome e di che colore. Sono la
 * casa, non il telefono: chi li sceglie dal tablet non deve rifarlo dal
 * telefono per vedere gli stessi impegni. */
/* La revisione 19 aggiunge le sezioni che si fa l'utente (`cd_sezioni_mie`,
 * #262): titolo, icona e le entita' che ci ha messo dentro. Sono la casa nel
 * senso piu' letterale — le ha disegnate lui — e non viaggiare vorrebbe dire
 * rifarle su ogni dispositivo. */
/* La revisione 23 aggiunge la doppia conferma delle aperture
 * (`cd_porte_conferma`, #275): «poter decidere se attivare la doppia conferma
 * d'apertura o meno, per essere più celeri». È una scelta sulla casa, non sul
 * dispositivo: chi la spegne dal telefono la vuole spenta anche dal tablet. */
/* La revisione 25 aggiunge i lettori multimediali (`cd_media_player`, #269):
 * quali casse ci sono, come si chiamano e in che stanza stanno. È una scelta
 * sulla plancia — chi dichiara il lettore del salotto dal tablet lo vuole
 * anche sul telefono, come tutte le altre macchine di casa. */
/* La revisione 24 aggiunge le entità che uno si aggiunge dove vuole
 * (`cd_entita_mie`, #271). «Sarebbe carino avere la possibilità d'aggiungere
 * le entità o sensori personalizzati in ogni scheda»: quell'elenco dice quali
 * sono, su quale pagina compaiono e come si chiamano. È una scelta sulla
 * plancia, come le sezioni proprie che le stanno accanto — chi la fa dal
 * tablet la vuole anche sul telefono. */
/* La revisione 22 aggiunge come si vede l'energia in Home con più impianti
 * (`cd_energia_tessere`, #286): una tessera sola con la somma, o una per
 * impianto. È una scelta sulla plancia, non su questo dispositivo — chi la fa
 * dal tablet la vuole anche sul telefono, come l'ordine delle tessere. */
/* La revisione 21 aggiunge le aree d'allarme (`cd_centrali`,
 * `cd_centrale_scelta`, #285). Stessa ragione degli impianti solari, e stessa
 * forma: l'elenco dice quali sono le aree, la scelta dice quale sta nella
 * mappatura `dm.security_centrale_allarme` — cioè quale il tastierino comanda.
 * Le due vanno insieme, e la mappatura viaggia da sempre. */
/* La revisione 20 aggiunge gli impianti solari (`cd_solari`, `cd_solare_scelto`).
 * «Solare termico continua ad avere un solo impianto»: adesso ce ne può essere
 * più d'uno, e vanno insieme — l'elenco dice quali sono, la scelta dice quale
 * sta nelle mappature `dm.boiler_*` in questo momento. Le mappature viaggiano
 * da sempre: se la scelta restasse su un dispositivo solo, il telefono
 * mostrerebbe l'impianto del tablet chiamandolo con l'altro nome. */
/* La revisione 36 aggiunge la soglia delle batterie (`cd_batterie`, #398).
 * «Le batterie quelle cariche non le fa vedere? Sarebbe carino che stessero
 * nel config come le altre cose.» Venti per cento stava scritto nel codice,
 * uguale per tutti; adesso lo si sceglie. E' una scelta sulla casa — chi ha
 * una serratura da cambiare al trenta ce l'ha da cambiare al trenta anche
 * guardando dal telefono — quindi viaggia, come la soglia delle tapparelle. */
/* La revisione 26 aggiunge la soglia di chiusura delle tapparelle
 * (`cd_tapparelle_soglia`, #298), le allerte (`cd_allerte`, #296) e la raccolta
 * differenziata (`cd_rifiuti`, #293): tre cose configurate una volta per tutta
 * la casa, che il telefono e il tablet devono leggere uguali. */
/* La revisione 28 aggiunge il segno progressivo dei gruppi di continuita'
 * (`cd_ups_meta`), che nasce con il secondo UPS (#332). Vale la stessa ragione
 * per cui viaggia quello delle auto: se resta a terra, il secondo dispositivo
 * riparte da capo col conteggio e il prossimo gruppo nasce con l'identificativo
 * di uno cancellato, ereditandone le caselle.
 *
 * La revisione 27 aggiunge la soglia dell'umidita' (`cd_umidita_soglia`,
 * #330): «una soglia per l'umidita' oltre la quale suggerisce di aprire la
 * finestra per arieggiare». E' una quota di casa, come quella delle
 * tapparelle: se restasse sul dispositivo che l'ha scritta, il telefono
 * direbbe di aprire la finestra e il tablet no, davanti alla stessa stanza. */
/* La revisione 29 aggiunge l'ordine dei blocchi della Home
 * (`cd_home_blocchi`): quale viene prima fra persone, widget, azioni rapide e
 * dispositivi. E' una scelta della casa, non del vetro da cui la si guarda —
 * se restasse sul dispositivo che l'ha fatta, il telefono e il tablet
 * mostrerebbero la stessa Home in due ordini diversi. */
/* La revisione 30 aggiunge quattro cose, e sono tutte della plancia.
 *
 * La lingua (`cd_lingua`, #350): «È sparito il settaggio per la lingua: su PC
 * avevo settato italiano (HA in inglese) e continua a funzionare, da mobile
 * invece è rimasto inglese.» La scelta stava sotto una chiave che non comincia
 * per `cd_`, quindi non viaggiava e non aveva nemmeno il prefisso che separa
 * due plance: era una preferenza del browser, mentre la tendina dice «la fissa
 * per questa dashboard».
 *
 * La riga sotto il meteo (`cd_barra_casa`, #356 e #357): quali pastiglie si
 * vedono — il ritiro di stasera, le luci accese, le finestre aperte — e quale
 * contatto e' quello della cassetta della posta. Chi le sceglie dal telefono
 * le vuole ritrovare sul tablet appeso in cucina.
 *
 * Quello che invece resta a terra e' cosa QUESTO dispositivo sa della cassetta
 * (`cd_posta_stato`): com'era l'ultima volta che l'ha guardata e se chi la
 * guarda ha gia' visto l'avviso — il primo schermo che se ne accorgesse
 * toglierebbe agli altri il termine di paragone.
 *
 * La revisione 37 aggiunge i tasti d'inserimento scritti a mano
 * (`cd_antifurto_su_misura`, #413): chi si e' fatto l'antifurto con ESPHome
 * un `alarm_control_panel` non ce l'ha, e la fila di tasti se la descrive —
 * nome, icona, entita' da chiamare. E' roba della casa, non dello schermo:
 * l'antifurto configurato sul tablet deve funzionare anche dal telefono.
 *
 * La revisione 38 aggiunge il flusso dell'energia in Home (`cd_flusso_home`,
 * #415): «sulla home, accanto magari alle card delle persone, un'immagine con
 * il flusso dal fotovoltaico alla casa, dalla casa alle batterie, dalla casa
 * all'auto». Vederlo o no e' una scelta sulla casa, come l'ordine dei blocchi
 * che gli sta accanto.
 *
 * E gli animali di casa (`cd_animali`, #358): i loro nomi, le loro foto e le
 * entita' della ciotola, della lettiera, dell'acqua, della porta col microchip
 * e del collare. Anche questa e' roba della casa: il gatto configurato sul
 * tablet deve esistere anche sul telefono.
 *
 * La revisione 39 aggiunge chi resta fuori dal grafico delle Temperature
 * (`cd_grafico_stanze`, #433): «poter togliere dal grafico alcune
 * entità/stanze cliccandoci sopra in modo tale che diventi più leggibile la
 * variazione. Nel mio caso il vano tecnico». Una stanza fuori scala schiaccia
 * tutte le altre, e toglierla è una cosa che si dice della casa, non dello
 * schermo da cui la si è detta: chi ha tolto il vano tecnico dal computer non
 * se lo ritrova dentro sul telefono.
 *
 * La revisione 40 aggiunge la presenza (`cd_presenza`, #432): «ci vorrebbe una
 * sezione con i sensori presenza o movimento». Sono le stesse tre correzioni
 * dei varchi — quale rilevatore non guarda la casa, quale aggiungere a mano,
 * come si chiama — e sono correzioni al rilevamento di CASA: il sensore del
 * cortile è fuori posto su ogni dispositivo, e il nome dato a «Motion 3C» vale
 * per tutti.
 *
 * La revisione 41 aggiunge da che parte scrive la batteria (`cd_batteria_verso`,
 * #434): «sembra scaricarsi perché il flow tratteggiato va dalla batteria verso
 * casa ma non è esatto». Metà dei sensori scrive positivo quando la batteria si
 * CARICA, e da un valore solo non si indovina. È una cosa dell'impianto, non
 * del vetro: la batteria è una sola per tutta la casa, e chi ha girato il verso
 * dal computer non deve vedere le frecce al contrario sul telefono. */
export const CONFIG_KEYS_REVISION = 41;

// Complete shared dashboard configuration snapshot. Runtime counters/timers and
// true per-device preferences (connection credentials, theme/navbar mode) stay
// local. Everything edited as dashboard content is shared across devices.
export const CONFIG_KEYS = Object.freeze([
  "dm_dashboard_state",
  "dm_schema_version",
  "cd_branding",
  "cd_sections",
  // La scelta fatta a mano sulle sezioni viaggia con la configurazione: se
  // resta su un solo dispositivo, gli altri se la riaccendono da soli.
  "cd_sections_manual",
  "cd_section_names",
  "cd_stanze",
  "cd_floors",
  "cd_floor_icons",
  "cd_cameras",
  "cd_appliances",
  "cd_loads",
  "cd_devices",
  "cd_people",
  "cd_security_doors",
  // Quali modalita' della centrale si e' scelto di non vedere.
  "cd_antifurto_modi",
  // I tasti d'inserimento scritti a mano, per chi una centrale non ce l'ha
  // (#413): nome, icona, entita' da chiamare, dove leggere se e' inserita.
  "cd_antifurto_su_misura",
  "cd_todo",
  "cd_widgets",
  // In che ordine stanno i blocchi della Home: persone, widget, azioni, dispositivi.
  "cd_home_blocchi",
  // Se il flusso dell'energia si vede in Home (#415).
  "cd_flusso_home",
  // La riga sotto il meteo (#356): quali pastiglie si vedono, e da quale
  // contatto arriva la posta (#357).
  "cd_barra_casa",
  "cd_luci",
  "cd_luci_rooms",
  "cd_luci_order",
  // Le cose che si guardano e basta: la presa del frigo, quella del modem.
  "cd_solo_lettura",
  // Le prese: TV del salotto, Firestick, modem.
  "cd_prese",
  "cd_luci_room_order",
  // I sensori porta/finestra che parlano al contrario (#244): ON = chiuso.
  "cd_stati_invertiti",
  // Le voci della parte Caldo del Clima (caldaia, pompe): lista libera.
  "cd_termico_caldo",
  // I programmi rapidi della lavatrice: nome, entita', icona.
  "cd_lavatrice_programmi",
  // La card del Clima girata: grande l'ambiente, piccola la target.
  "cd_clima_inverti_card",
  // La stazione meteo con entita' proprie, dietro la sua casella.
  "cd_meteo_entita_proprie",
  "cd_clima_units",
  // Cosa accende il tasto Clima rapido: modalita', temperatura e ventola.
  "cd_clima_rapido",
  // Gli stessi passi, ma di OGNI unita': la cameretta a 24, il salone a 26.
  "cd_clima_rapido_unita",
  // Le entita' in evidenza: la tessera che tiene d'occhio sensori senza stanza.
  "cd_evidenza",
  "cd_scaldabagni",
  "cd_impianti_termici",
  "cd_caldaia",
  // Gli impianti solari e quale di loro sta in pagina (#253 → più d'uno).
  "cd_solari",
  "cd_solare_scelto",
  // Le aree d'allarme e quale di loro il tastierino comanda (#285).
  "cd_centrali",
  "cd_centrale_scelta",
  // Come si vede l'energia in Home con più impianti: somma o una per impianto (#286).
  "cd_energia_tessere",
  // Se il tocco su un'apertura chiede conferma (#275).
  "cd_porte_conferma",
  "cd_ups",
  // Sotto quanto una batteria e' da cambiare (#398): una soglia per tutta la
  // casa, non per questo dispositivo.
  "cd_batterie",
  "cd_calendari",
  // Le sezioni che si fa l'utente (#262): titolo, icona, e le entita' dentro.
  "cd_sezioni_mie",
  // Le entita' aggiunte a una pagina che c'e' gia' (#271): quale entita', su
  // quale scheda, con che nome e che icona.
  "cd_entita_mie",
  // I lettori multimediali (#269): quali casse ci sono e come si chiamano.
  "cd_media_player",
  // I sensori di fumo gia' visti: il rilevamento non li ripropone due volte.
  "cd_fumo_rilevato",
  "cd_ev_cars",
  "cd_ev_car_active",
  "cd_ev_visual",
  /* Il motore dichiarato da chi non ha nessun profilo auto (#326). E' una
   * scelta della plancia, come le caselle `dm.ev_*` a cui appartiene: chi la
   * fa sul telefono deve ritrovarla sul computer, o la pagina Auto racconta
   * due macchine diverse a seconda di dove la si guarda. */
  "cd_ev_motore",
  /* `cd_ev_image` e `cd_ev_image_plugged` non stanno piu' qui.
   *
   * Sono le due caselle da cui il disegno legge la foto dell'auto attiva: non
   * una configurazione, ma il disegno di adesso, ricavato dal profilo scelto su
   * *questo* dispositivo. Spedirle voleva dire che la configurazione condivisa
   * si portava dietro la foto dell'auto che era attiva altrove, e al ritorno la
   * riscriveva qui: si apriva la plancia, compariva la foto giusta — quella che
   * la semina aveva appena messo — e un istante dopo arrivava il salvataggio e
   * ci metteva l'altra vettura. Segnalato esattamente cosi', ed era esattamente
   * questo.
   *
   * Le foto viaggiano dove devono, dentro `cd_ev_cars`: ogni auto si porta le
   * sue, e ogni dispositivo disegna quella dell'auto che ha scelto lui. Chi
   * legge queste due chiavi da un salvataggio vecchio non le trova piu' nella
   * lista, quindi non vengono ne' lette ne' riscritte: restano dove sono senza
   * dare fastidio a nessuno. */
  "cd_visual_prefer_image",
  "cd_tapparelle",
  // Sotto che percentuale una tapparella conta come chiusa (#298).
  "cd_tapparelle_soglia",
  "cd_umidita_soglia",
  // Le allerte (#296): quali sensori guardare per terremoti, meteo, fulmini,
  // pollini, comfort e voli.
  "cd_allerte",
  // La raccolta differenziata (#293): i materiali e da dove si legge il ritiro.
  "cd_rifiuti",
  /* I varchi (#367, #377): quali contatti non contano, quali aggiungere a mano
   * e come si chiamano. Sono correzioni al rilevamento di casa, non del vetro:
   * il sensore del frigo etichettato «door» e' sbagliato su ogni dispositivo,
   * e il nome che gli si da' vale per tutti. */
  "cd_varchi",
  /* La presenza (#432): quali rilevatori di movimento non contano, quali
   * aggiungere a mano e come si chiamano. Stessa natura dei varchi — sono
   * correzioni al rilevamento di casa — e quindi stesso viaggio fra i
   * dispositivi. */
  "cd_presenza",
  /* Il verso della batteria (#434): se il sensore scrive positivo quando si
   * carica. E' dell'impianto, non del dispositivo da cui lo si e' detto — la
   * batteria e' una sola per tutta la casa. */
  "cd_batteria_verso",
  /* Le macchine del server e la rete (#382): quali sensori contano e come si
   * chiamano. Il server e' uno solo per tutta la casa, e il nome che si da' a
   * «pve_qemu_103» vale su ogni dispositivo che lo guarda. */
  "cd_macchine",
  /* La ventilazione meccanica (#371): le sue caselle sono entita' di casa, e
   * viaggiano fra i dispositivi come tutte le altre. */
  "cd_vmc",
  /* Assist (#360): quale assistente, se leggere la risposta ad alta voce, se
   * il tasto si vede. Sono preferenze della casa e non del vetro: chi accende
   * Assist dal computer se lo deve ritrovare sul telefono. */
  "cd_assist",
  // Gli animali di casa (#358): nome, foto e le entita' che li riguardano.
  "cd_animali",
  "cd_piscina",
  "cd_irrigazione",
  "cd_robot",
  "cd_energy_model",
  "cd_entity_overrides",
  "cd_quick_actions",
  "cd_navbar_order",
  // La barra a scomparsa o ferma e' una scelta della plancia, non del
  // dispositivo che l'ha fatta: chi la mette ferma sul telefono se la ritrova
  // ferma anche sul computer.
  "cd_navbar_mode",
  // E la lingua della plancia, per la stessa ragione (#350): «su PC avevo
  // settato italiano, da mobile invece e' rimasto inglese».
  "cd_lingua",
  "cd_energy_views",
  "cd_slot_labels",
  "cd_flow_nodes",
  "cd_gruppi_extra",
  "cd_gruppi_removed",
  "cd_avvisi_names_extra",
  "cd_grafico_stanze",
  "cd_avvisi_custom",
  "cd_subload_groups",
  "cd_subloads_extra",
  "cd_report_devices",
  "cd_lavatrice_visual",
  "cd_text_overrides",
  "cd_hidden_elements",
  "cd_costo_kwh",
  "cd_prezzo_immissione",
  /* Le tre della revisione 9, trovate contando chi scrive cosa.
   *
   * `cd_avvisi_icone`: l'icona scelta per ogni avviso. Si sceglieva sul
   * telefono e sul computer restava quella di serie.
   * `cd_stanze_entita`: a quale stanza appartiene un'entita' che la stanza non
   * ce l'ha per mestiere. Configurata da una parte, di la' non esisteva.
   * `cd_ev_meta`: il numero piu' alto mai dato a un'auto. Questo non e' una
   * comodita': se non viaggia, il secondo dispositivo riparte da capo col
   * conteggio e la prossima auto nasce con l'identificativo di una cancellata,
   * ereditandone le foto — che e' esattamente il difetto che quel numero esiste
   * per impedire. */
  "cd_avvisi_icone",
  "cd_stanze_entita",
  "cd_ev_meta",
  "cd_ups_meta",
  /* Le quattro della revisione 31, trovate contando di nuovo chi scrive cosa —
   * «da smartphone vedo le sezioni configurate da pc invece no».
   *
   * `cd_radar_meteo`: da quale servizio o entita' arriva il radar e con che
   * raggio. Si sceglie una volta e vale per la casa, non per il vetro.
   * `cd_orologio`: se l'ora si vede in testata. E' una scelta della plancia
   * come la barra e la lingua, che stanno gia' qui per la stessa ragione.
   * `dm_campi_scelti`: quali caselle di un carico sono state riempite a mano.
   * Questa non e' una comodita': senza, chi indovina le caselle vuote — il
   * contratto dei dispositivi — non sa che di la' non c'e' niente da
   * indovinare, e una casella svuotata apposta sul computer se la ritrova
   * riscritta sul telefono. E' la segnalazione che quel segno esiste per
   * chiudere: «io elimino l'entita' inserita per far usare il calcolo ma non
   * la elimina.» */
  "cd_radar_meteo",
  "cd_orologio",
  "dm_campi_scelti",
  /* E il gemello di `cd_fumo_rilevato`, che sta gia' qui sopra da un pezzo.
   *
   * Sono i sensori di allagamento gia' passati una volta dal rilevamento
   * automatico. Il segno serve perche' una lista vuota resti vuota: senza,
   * togliere l'ultimo sensore fa ripartire il rilevamento e rimette dentro
   * proprio quello che era stato tolto. Restando del dispositivo faceva
   * esattamente questo, sull'altro: si cancellava un sensore sul computer e il
   * telefono, che quel giro non l'aveva mai fatto, se lo rimetteva da solo. Il
   * fumo aveva gia' avuto la sua correzione; l'acqua era rimasta indietro. */
  "cd_allag_rilevato",
]);
