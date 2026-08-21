<!-- DM-FIX-20260812B -->
# Changelog

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e le
versioni seguono [Semantic Versioning](https://semver.org/lang/it/).

## Non rilasciato

### Aggiunto

- **La plancia parla quindici lingue.** Oltre a italiano e inglese sono
  tradotte per intero spagnolo, francese, tedesco, portoghese, olandese,
  polacco, russo, turco, arabo, hindi, giapponese, coreano e cinese
  semplificato: 941 stringhe per lingua, cioè tutto il vocabolario visibile
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

### Documentazione

- [`docs/TRANSLATIONS.md`](docs/TRANSLATIONS.md): come funziona il sistema e
  cosa serve per aggiungere una lingua.

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
