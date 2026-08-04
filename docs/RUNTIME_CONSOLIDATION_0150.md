# DashboardModern 0.15.0 — runtime consolidation

## Problema verificato

Il percorso di produzione caricava moduli dati con effetti collaterali e una
catena crescente di patch per release. I layer installavano più broker,
listener, timer, observer e wrapper sulle stesse funzioni di rendering.

La conseguenza non era soltanto il peso JavaScript: più owner scrivevano gli
stessi KPI del Report Energia e rilanciavano rendering completi durante
aggiornamenti live e cambi periodo.

## Architettura 0.15.0

Il percorso di produzione è ora:

```text
dashboard.html
  -> modules-entry.js
     -> energy-projection.js
        -> report-mobile-fixes.js
           -> release-0152-fixes.js (facade)
              -> runtime-consolidated.js
                 -> period-service.js
                 -> appliance-artwork.js
```

I file delle vecchie release rimangono nel repository come storico e per
compatibilità dei test, ma non fanno più parte del grafo runtime di produzione.

## Invarianti

- Un solo broker WebSocket Home Assistant.
- Nessun `setInterval` permanente nel runtime di produzione.
- Nessun `MutationObserver` globale sul documento.
- Un solo listener per il cambio mese/anno.
- Un solo bundle atomico per mese, anno e dispositivi.
- Header, KPI, costi e Analisi leggono lo stesso bundle.
- Il totale anno usa sempre l'intervallo gennaio → fine anno/ora.
- I dispositivi usano il delta Recorder del contatore cumulativo totale.
- I nodi opzionali del flow sono nascosti insieme alle linee se non configurati.
- Il filtro stanza resta nella navigazione canonica superiore; nessun secondo
  filtro viene creato dentro la griglia Elettrodomestici.

Queste invarianti sono protette da test frontend ed E2E e devono essere
mantenute nelle release successive senza aggiungere nuovi layer runtime.
