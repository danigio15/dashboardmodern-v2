# Release 0.15.0

Release di consolidamento del runtime DashboardModern.

## Risolto

- Report Energia con un'unica sorgente dati per chip, KPI e costi.
- Consumo Casa stabile durante gli aggiornamenti live e i cambi periodo.
- Totale anno calcolato sull'intero anno selezionato.
- Elettrodomestici calcolati dal delta del sensore energia totale nel periodo.
- Rimozione del secondo filtro stanze interno alla griglia Elettrodomestici.
- Nodi e linee opzionali del flow nascosti se privi di configurazione.
- Brand Home Assistant/HACS allineato al logo del repository.

## Prestazioni

- Eliminata dal grafo di produzione la catena di patch 0.14.7–0.14.17.
- Un solo broker Home Assistant e un solo controller runtime.
- Rimossi polling permanenti e observer globali del documento.
- Richieste Recorder deduplicate e memorizzate in cache.
- Aggiornamento DOM atomico per mese, anno e dispositivi.
