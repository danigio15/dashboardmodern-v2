# DashboardModern 0.15.1

Hotfix delle regressioni osservate nella vera installazione Home Assistant dopo la 0.15.0.

## Correzioni

- Le card Elettrodomestici seguono il tema effettivo della dashboard e non le variabili scure ereditate da Home Assistant quando la dashboard è chiara.
- I pulsanti ON/OFF mantengono lo stile DashboardModern e non ricadono nel pulsante HTML nativo.
- I contatori energia totali vengono conteggiati nell'editor, salvati nel modello canonico e applicati ai delta Recorder.
- I cerchi dei flussi mensili leggono lo stesso bundle del Report Energia; un valore lifetime già stampato dal renderer legacy non può più essere bloccato come valore mensile.
- La fiamma viene rimossa dalle card Temperatura senza alterare temperatura, umidità o icona stanza.
- Gli Avvisi standard ed extra vengono nuovamente sincronizzati nel runtime, visualizzati e resi modificabili nella configurazione.
- Nessun `setInterval` permanente e nessun `MutationObserver` globale sono stati reintrodotti.

## Verifica reale riprodotta

La suite browser forza i casi mostrati negli screenshot reali:

- dashboard chiara con variabili Home Assistant scure;
- totale lifetime Casa `614.0 kWh` e consumo mensile canonico `413.9 kWh`;
- produzione `288.8 kWh`, rete `222.0 / 5.8 kWh`, batteria `27.0 / 136.0 kWh`;
- temperatura `35.4 °C` senza `🔥`;
- avviso extra presente nel runtime e modificabile nell'editor.
