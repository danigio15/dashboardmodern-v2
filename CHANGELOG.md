# Changelog

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e le
versioni seguono [Semantic Versioning](https://semver.org/lang/it/).

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
- **Assistente** e **Domotica** hanno ora titoli, sottotitoli, stato assistente,
  card entità, microfono, input, CTA, iframe e comandi ripuliti per light/dark.
- I campi entità e i relativi pulsanti nell'Editor sono geometricamente allineati
  in mobile; i pulsanti aggiunta usano il verde principale coerente col salvataggio.
- La modalità scura è verificata tramite token condivisi e screenshot browser,
  senza overlay o patch DOM post-render.

### Verifica

- Contratti frontend aggiornati e Browser E2E dedicati a Home/EV/Assistente,
  popup Tapparelle, modalità scura, layout Editor ed Energy/Report.
- `npm run test:frontend`: 228/228 passati.
- `npm run check:inline-syntax`: passato.
- Browser E2E ITA/ENG su desktop/mobile/iPad: passati.
